package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiModelResponse {

    private UUID id;
    private String modelName;
    private Integer rpm;
    private Integer tpm;
    private Boolean isActive;
    private Integer orderIndex;
}
