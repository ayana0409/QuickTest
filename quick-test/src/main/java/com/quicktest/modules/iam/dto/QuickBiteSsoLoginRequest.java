package com.quicktest.modules.iam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for direct Single Sign-On using QuickBite credentials.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuickBiteSsoLoginRequest {

    @NotBlank(message = "QuickBite username or email is required")
    private String username;

    @NotBlank(message = "QuickBite password is required")
    private String password;
}
