package com.quicktest.modules.admin.dto;

import jakarta.validation.Valid;
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
public class AiKeyUpdateRequest {

    private String name;

    /**
     * Optional: if blank or null, existing API key is preserved.
     */
    private String apiKey;

    private Boolean isActive;
    private Integer orderIndex;

    @Valid
    @Builder.Default
    private List<AiModelCreateRequest> models = new ArrayList<>();
}
