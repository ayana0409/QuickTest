package com.quicktest.modules.admin.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiModelCreateRequest {

    @NotBlank(message = "Model name is required")
    private String modelName;

    @Min(value = 1, message = "RPM limit must be at least 1")
    @Builder.Default
    private Integer rpm = 15;

    @Min(value = 1000, message = "TPM limit must be at least 1000")
    @Builder.Default
    private Integer tpm = 200000;

    @Builder.Default
    private Boolean isActive = true;

    @Builder.Default
    private Integer orderIndex = 0;
}
