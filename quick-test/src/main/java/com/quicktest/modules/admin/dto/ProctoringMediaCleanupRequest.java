package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Filter conditions for batch cleanup of old proctoring evidence images.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProctoringMediaCleanupRequest {

    @Builder.Default
    private int days = 30;

    private String violationType;

    private UUID examId;

    @Builder.Default
    private Boolean onlyFinishedExams = true;

    @Builder.Default
    private Integer batchSize = 100;
}

