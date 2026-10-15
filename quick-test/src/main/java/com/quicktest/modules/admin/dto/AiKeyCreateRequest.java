package com.quicktest.modules.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiKeyCreateRequest {

    @NotBlank(message = "Key name is required")
    private String name;

    @NotBlank(message = "API key is required")
    private String apiKey;

    @Builder.Default
    private String provider = "GEMINI";

    @Builder.Default
    private Boolean isActive = true;

    @Builder.Default
    private Integer orderIndex = 0;

    @Valid
    @Builder.Default
    private List<AiModelCreateRequest> models = new ArrayList<>();
}
