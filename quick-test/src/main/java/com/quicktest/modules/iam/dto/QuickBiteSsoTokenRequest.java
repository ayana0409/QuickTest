package com.quicktest.modules.iam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for authenticating via an existing QuickBite SSO Access Token.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuickBiteSsoTokenRequest {

    @NotBlank(message = "QuickBite Access Token is required")
    private String accessToken;
}
