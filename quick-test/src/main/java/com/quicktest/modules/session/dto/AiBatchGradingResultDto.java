package com.quicktest.modules.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Encapsulates the batch grading results returned by Google Gemini in JSON format.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiBatchGradingResultDto {

    @Builder.Default
    private List<AiSingleGradeDto> results = new ArrayList<>();
}
