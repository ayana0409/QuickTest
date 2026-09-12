package com.quicktest.modules.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Individual AI grading evaluation result for a single candidate answer.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSingleGradeDto {

    private String candidateAnswerId;
    private Double awardedScore;
    private String feedback;
}
