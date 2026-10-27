package com.quicktest.core.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter that intercepts incoming HTTP requests, extracts JWT Bearer token,
 * validates it, and sets the authenticated user in the SecurityContext.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsServiceImpl userDetailsService;
    private final com.quicktest.core.security.sso.QuickBiteTokenValidator quickBiteTokenValidator;
    private final com.quicktest.modules.iam.repository.UserRepository userRepository;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        try {
            String jwt = parseJwt(request);
            if (jwt != null) {
                // 1. Try local QuickTest HMAC JWT validation
                if (jwtTokenProvider.validateToken(jwt)) {
                    String username = jwtTokenProvider.getUsernameFromToken(jwt);
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);

                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(
                                    userDetails,
                                    null,
                                    userDetails.getAuthorities()
                            );
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
                // 2. Fallback to QuickBite Identity OpenIddict JWT validation (Resource Server mode)
                else if (quickBiteTokenValidator.isSsoEnabled() && quickBiteTokenValidator.isQuickBiteToken(jwt)) {
                    com.quicktest.core.security.sso.QuickBiteUserClaims claims =
                            quickBiteTokenValidator.validateAndExtractClaims(jwt);

                    com.quicktest.modules.iam.entity.User user = userRepository.findBySsoSubjectId(claims.getSub())
                            .or(() -> userRepository.findByEmail(claims.getEmail()))
                            .orElseGet(() -> {
                                String candidateUsername = claims.getUsername();
                                int suffix = 1;
                                while (userRepository.existsByUsername(candidateUsername)) {
                                    candidateUsername = claims.getUsername() + "_" + suffix++;
                                }
                                com.quicktest.modules.iam.entity.User newUser = com.quicktest.modules.iam.entity.User.createSsoUser(
                                        claims.getSub(),
                                        candidateUsername,
                                        claims.getEmail(),
                                        claims.getFullName(),
                                        claims.getMappedRole() != null ? claims.getMappedRole() : com.quicktest.modules.iam.entity.Role.STUDENT
                                );
                                return userRepository.save(newUser);
                            });

                    if (Boolean.TRUE.equals(user.getIsActive())) {
                        UserDetails userDetails = UserDetailsImpl.build(user);
                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(
                                        userDetails,
                                        null,
                                        userDetails.getAuthorities()
                                );
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            }
        } catch (Exception ex) {
            log.error("Cannot set user authentication in security context: {}", ex.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Extract Bearer token from the Authorization HTTP header.
     */
    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");

        if (StringUtils.hasText(headerAuth) && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }

        return null;
    }
}
