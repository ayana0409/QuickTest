package com.quicktest.modules.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result response after saving manual grades.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualBatchGradeResponse {

    private int gradedCount;
    private int finalizedAttemptsCount;
    private String message;
}
