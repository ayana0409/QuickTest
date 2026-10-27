package com.quicktest.core.security.sso;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.iam.entity.Role;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.*;

/**
 * Validates QuickBite OpenIddict JWT tokens via JWKS (RFC 7517) or UserInfo endpoint,
 * and extracts normalized user claims and roles for QuickTest.
 */
@Slf4j
@Component
public class QuickBiteTokenValidator {

    private final String issuerUri;
    private final String jwkSetUri;
    private final String userInfoUri;
    private final String tokenUri;
    private final String clientId;
    private final String scope;
    private final boolean ssoEnabled;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private volatile JwtDecoder jwtDecoder;

    public QuickBiteTokenValidator(
            @Value("${app.sso.quickbite.enabled:false}") boolean ssoEnabled,
            @Value("${app.sso.quickbite.issuer-uri:}") String issuerUri,
            @Value("${app.sso.quickbite.jwk-set-uri:}") String jwkSetUri,
            @Value("${app.sso.quickbite.userinfo-uri:}") String userInfoUri,
            @Value("${app.sso.quickbite.token-uri:}") String tokenUri,
            @Value("${app.sso.quickbite.client-id:}") String clientId,
            @Value("${app.sso.quickbite.scope:}") String scope,
            RestTemplateBuilder restTemplateBuilder,
            ObjectMapper objectMapper
    ) {
        this.ssoEnabled = ssoEnabled;
        this.issuerUri = issuerUri != null ? issuerUri.trim() : "";
        this.jwkSetUri = jwkSetUri != null ? jwkSetUri.trim() : "";
        this.userInfoUri = userInfoUri != null ? userInfoUri.trim() : "";
        this.tokenUri = tokenUri != null ? tokenUri.trim() : "";
        this.clientId = clientId != null ? clientId.trim() : "";
        this.scope = scope != null && !scope.isBlank() ? scope.trim() : "openid profile email roles offline_access Identity";
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(15))
                .setReadTimeout(Duration.ofSeconds(20))
                .build();
        this.objectMapper = objectMapper;
    }

    public boolean isSsoEnabled() {
        return ssoEnabled;
    }

    /**
     * Validate that SSO is enabled and required token verification configuration is present.
     */
    private void ensureSsoEnabledAndConfigured() {
        if (!ssoEnabled) {
            throw new AppException("QuickBite SSO authentication is currently disabled", HttpStatus.FORBIDDEN);
        }
        if (issuerUri == null || issuerUri.isBlank()) {
            throw new AppException("QuickBite SSO configuration error: 'app.sso.quickbite.issuer-uri' is not configured in environment variables", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        if (jwkSetUri == null || jwkSetUri.isBlank()) {
            throw new AppException("QuickBite SSO configuration error: 'app.sso.quickbite.jwk-set-uri' is not configured in environment variables", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Validate that SSO credentials password grant configuration is present.
     */
    private void ensurePasswordGrantConfigured() {
        ensureSsoEnabledAndConfigured();
        if (tokenUri == null || tokenUri.isBlank()) {
            throw new AppException("QuickBite SSO configuration error: 'app.sso.quickbite.token-uri' is not configured in environment variables", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        if (clientId == null || clientId.isBlank()) {
            throw new AppException("QuickBite SSO configuration error: 'app.sso.quickbite.client-id' is not configured in environment variables", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Lazily initialize NimbusJwtDecoder using QuickBite's JWKS endpoint.
     */
    private JwtDecoder getJwtDecoder() {
        if (jwtDecoder == null) {
            synchronized (this) {
                if (jwtDecoder == null) {
                    try {
                        jwtDecoder = NimbusJwtDecoder.withJwkSetUri(this.jwkSetUri).build();
                        log.info("Initialized QuickBite NimbusJwtDecoder with JWKS: {}", this.jwkSetUri);
                    } catch (Exception ex) {
                        log.error("Failed to initialize NimbusJwtDecoder with JWKS {}: {}", this.jwkSetUri, ex.getMessage());
                    }
                }
            }
        }
        return jwtDecoder;
    }

    /**
     * Validate QuickBite token and extract normalized claims.
     * Tries cryptographic JWKS signature verification first; falls back to /connect/userinfo.
     */
    public QuickBiteUserClaims validateAndExtractClaims(String token) {
        ensureSsoEnabledAndConfigured();

        if (token == null || token.trim().isEmpty()) {
            throw new AppException("Missing QuickBite SSO token", HttpStatus.UNAUTHORIZED);
        }

        String cleanToken = token.trim();
        if (cleanToken.startsWith("Bearer ")) {
            cleanToken = cleanToken.substring(7).trim();
        }

        // 1. Attempt verification via Nimbus JWKS decoder
        try {
            JwtDecoder decoder = getJwtDecoder();
            if (decoder != null) {
                Jwt jwt = decoder.decode(cleanToken);
                return extractClaimsFromJwt(jwt);
            }
        } catch (Exception ex) {
            log.warn("JWKS token decode failed ({}), falling back to UserInfo endpoint: {}", ex.getClass().getSimpleName(), ex.getMessage());
        }

        // 2. Fallback verification via QuickBite UserInfo endpoint
        if (this.userInfoUri == null || this.userInfoUri.isBlank()) {
            throw new AppException("QuickBite SSO configuration error: 'app.sso.quickbite.userinfo-uri' is not configured in environment variables", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        try {
            return extractClaimsFromUserInfoEndpoint(cleanToken);
        } catch (AppException ae) {
            throw ae;
        } catch (Exception ex) {
            log.error("UserInfo verification failed: {}", ex.getMessage());
            throw new AppException("Invalid or expired QuickBite SSO token", HttpStatus.UNAUTHORIZED);
        }
    }

    /**
     * Check if a given JWT token string was issued by QuickBite (based on unverified payload inspection).
     */
    public boolean isQuickBiteToken(String token) {
        if (!ssoEnabled || token == null) {
            return false;
        }
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) {
                return false;
            }
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]));
            JsonNode root = objectMapper.readTree(payloadJson);

            // Compare issuer with configured issuerUri (scheme-agnostic comparison for local dev)
            JsonNode issNode = root.get("iss");
            if (issNode != null && !this.issuerUri.isBlank()) {
                String tokenIss = issNode.asText().toLowerCase().replaceAll("/+$", "").replaceFirst("^https?://", "");
                String configuredIss = this.issuerUri.toLowerCase().replaceAll("/+$", "").replaceFirst("^https?://", "");
                if (tokenIss.equals(configuredIss)) {
                    return true;
                }
            }

            // Compare client_id with configured clientId
            JsonNode clientIdNode = root.get("client_id");
            if (clientIdNode != null && !this.clientId.isBlank()) {
                if (clientIdNode.asText().equalsIgnoreCase(this.clientId)) {
                    return true;
                }
            }
        } catch (Exception ignored) {
            // Not a parsable JWT or not from QuickBite
        }
        return false;
    }

    /**
     * Authenticate directly against QuickBite Identity Service with username/email and password (OAuth2 Password Grant).
     */
    public Map<String, Object> requestTokenByCredentials(String username, String password) {
        ensurePasswordGrantConfigured();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "password");
        body.add("client_id", this.clientId);
        body.add("scope", this.scope);
        body.add("username", username.trim());
        body.add("password", password);

        HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(body, headers);

        try {
            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate.postForEntity(
                    this.tokenUri,
                    requestEntity,
                    Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }
            throw new AppException("Failed to authenticate with QuickBite Identity Service", HttpStatus.UNAUTHORIZED);
        } catch (Exception ex) {
            log.error("QuickBite Password Grant failed: {}", ex.getMessage());
            throw new AppException("Invalid QuickBite username or password", HttpStatus.UNAUTHORIZED);
        }
    }

    /**
     * Exchange an OAuth2 Authorization Code for tokens directly against QuickBite Identity Service.
     */
    public Map<String, Object> requestTokenByAuthorizationCode(String code, String redirectUri) {
        ensurePasswordGrantConfigured();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "authorization_code");
        body.add("client_id", this.clientId);
        body.add("code", code.trim());
        body.add("redirect_uri", redirectUri.trim());

        HttpEntity<MultiValueMap<String, String>> requestEntity = new HttpEntity<>(body, headers);

        try {
            @SuppressWarnings("unchecked")
            ResponseEntity<Map<String, Object>> response = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate.postForEntity(
                    this.tokenUri,
                    requestEntity,
                    Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }
            throw new AppException("Failed to exchange authorization code with QuickBite", HttpStatus.UNAUTHORIZED);
        } catch (Exception ex) {
            log.error("QuickBite Authorization Code exchange failed: {}", ex.getMessage());
            throw new AppException("Invalid or expired QuickBite authorization code: " + ex.getMessage(), HttpStatus.UNAUTHORIZED);
        }
    }

    private QuickBiteUserClaims extractClaimsFromJwt(Jwt jwt) {
        String sub = jwt.getSubject();
        if (sub == null || sub.isBlank()) {
            sub = jwt.getClaimAsString("sub");
        }

        String username = jwt.getClaimAsString("preferred_username");
        if (username == null || username.isBlank()) {
            username = jwt.getClaimAsString("unique_name");
        }
        if (username == null || username.isBlank()) {
            username = jwt.getClaimAsString("given_name");
        }
        if (username == null || username.isBlank()) {
            username = sub;
        }

        String email = jwt.getClaimAsString("email");
        if (email == null || email.isBlank()) {
            email = username.toLowerCase() + "@quickbite.internal";
        }

        String fullName = jwt.getClaimAsString("name");
        if (fullName == null || fullName.isBlank()) {
            fullName = jwt.getClaimAsString("given_name");
        }
        if (fullName == null || fullName.isBlank()) {
            fullName = username;
        }

        List<String> rawRoles = extractRolesFromClaims(jwt.getClaims());
        Role mappedRole = mapToQuickTestRole(rawRoles);

        return QuickBiteUserClaims.builder()
                .sub(sub)
                .username(username)
                .email(email)
                .fullName(fullName)
                .rawRoles(rawRoles)
                .mappedRole(mappedRole)
                .build();
    }

    private QuickBiteUserClaims extractClaimsFromUserInfoEndpoint(String cleanToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(cleanToken);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));
        HttpEntity<Void> requestEntity = new HttpEntity<>(headers);

        @SuppressWarnings("unchecked")
        ResponseEntity<Map<String, Object>> response = (ResponseEntity<Map<String, Object>>) (ResponseEntity<?>) restTemplate.exchange(
                this.userInfoUri,
                HttpMethod.GET,
                requestEntity,
                Map.class
        );

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new AppException("Failed to retrieve userinfo from QuickBite", HttpStatus.UNAUTHORIZED);
        }

        Map<String, Object> body = response.getBody();
        String sub = Objects.toString(body.get("sub"), null);
        String username = Objects.toString(
                body.getOrDefault("preferred_username",
                        body.getOrDefault("name",
                                body.getOrDefault("given_name", sub))),
                "quickbite_user"
        );
        String email = Objects.toString(
                body.get("email"),
                username.toLowerCase() + "@quickbite.internal"
        );
        String fullName = Objects.toString(
                body.getOrDefault("name",
                        body.getOrDefault("given_name", username)),
                username
        );

        List<String> rawRoles = extractRolesFromClaims(body);
        Role mappedRole = mapToQuickTestRole(rawRoles);

        return QuickBiteUserClaims.builder()
                .sub(sub)
                .username(username)
                .email(email)
                .fullName(fullName)
                .rawRoles(rawRoles)
                .mappedRole(mappedRole)
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<String> extractRolesFromClaims(Map<String, Object> claims) {
        List<String> result = new ArrayList<>();

        Object roleClaim = claims.get("role");
        if (roleClaim == null) {
            roleClaim = claims.get("roles");
        }
        if (roleClaim == null) {
            roleClaim = claims.get("http://schemas.microsoft.com/ws/2008/06/identity/claims/role");
        }

        if (roleClaim instanceof Collection<?>) {
            for (Object r : (Collection<?>) roleClaim) {
                if (r != null) result.add(r.toString().trim().toLowerCase());
            }
        } else if (roleClaim instanceof String roleStr) {
            String trimmed = roleStr.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                try {
                    List<String> parsed = objectMapper.readValue(trimmed, List.class);
                    for (String p : parsed) {
                        if (p != null) result.add(p.trim().toLowerCase());
                    }
                } catch (Exception ex) {
                    result.add(trimmed.toLowerCase());
                }
            } else {
                for (String part : trimmed.split("[,\\s]+")) {
                    if (!part.isBlank()) result.add(part.trim().toLowerCase());
                }
            }
        }

        return result;
    }

    /**
     * Role Mapping Matrix matching Section 4 of QuickBite SSO Guide:
     * - Admin Group -> Role.ADMIN
     * - Sub-Admin, Manager, Merchant, Teacher -> Role.TEACHER
     * - Others / Customer -> Role.STUDENT
     */
    public Role mapToQuickTestRole(List<String> roles) {
        Set<String> adminRoles = Set.of(
                "admin", "administrator", "superadmin", "system_admin", "quickbite-admin"
        );
        Set<String> teacherRoles = Set.of(
                "sub-admin", "subadmin", "sub_admin", "quickbite-sub-admin",
                "manager", "quickbite-manager",
                "merchant", "seller", "restaurant", "quickbite-merchant",
                "teacher", "staff"
        );

        for (String r : roles) {
            String clean = r.toLowerCase().trim();
            if (adminRoles.contains(clean)) {
                return Role.ADMIN;
            }
        }

        for (String r : roles) {
            String clean = r.toLowerCase().trim();
            if (teacherRoles.contains(clean)) {
                return Role.TEACHER;
            }
        }

        return Role.STUDENT;
    }
}
