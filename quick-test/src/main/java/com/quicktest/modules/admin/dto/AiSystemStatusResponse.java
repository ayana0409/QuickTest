package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * System-wide live AI status response returned to the Admin AI Dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSystemStatusResponse {

    private String configSource; // "DATABASE" or "ENV_FALLBACK"
    private int totalConfiguredKeys;
    private int totalSlots;
    private int availableSlots;
    private int exhaustedSlots;
    private int totalCapacityRpm;
    private int activeBackgroundJobsCount;
    private String lastReloadedAt;

    @Builder.Default
    private List<AiBackgroundJobDto> activeBackgroundJobs = new ArrayList<>();

    @Builder.Default
    private List<AiSlotMetricDto> slots = new ArrayList<>();
}
