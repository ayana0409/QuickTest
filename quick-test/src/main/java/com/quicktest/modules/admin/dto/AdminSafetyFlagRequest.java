package com.quicktest.modules.admin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload for toggling question safety flag.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSafetyFlagRequest {

    @NotNull(message = "isSafe status is required")
    private Boolean isSafe;
}
