package com.quicktest.modules.iam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * DTO for receiving refresh token.
 */
@Data
public class RefreshTokenRequest {
    @NotBlank(message = "Refresh token is required")
    private String refreshToken;
}
