package com.quicktest.core.config.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

/**
 * Request payload for updating a system configuration value.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemConfigUpdateRequest {

    @NotNull(message = "Configuration value must not be null")
    private String value;
}
