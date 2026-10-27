package com.quicktest.modules.iam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for exchanging an OAuth2/OIDC Authorization Code for QuickTest credentials.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QuickBiteSsoCodeRequest {

    @NotBlank(message = "Authorization code is required")
    private String code;

    @NotBlank(message = "Redirect URI is required")
    private String redirectUri;
}
