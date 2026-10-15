package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiKeyResponse {

    private UUID id;
    private String name;
    private String maskedKey;
    private String provider;
    private Boolean isActive;
    private Integer orderIndex;

    @Builder.Default
    private List<AiModelResponse> models = new ArrayList<>();

    private String createdAt;
    private String updatedAt;
}
