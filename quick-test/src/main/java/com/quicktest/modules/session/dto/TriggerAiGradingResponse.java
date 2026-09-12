package com.quicktest.modules.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Async acceptance response returned when AI grading is scheduled.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TriggerAiGradingResponse {

    private String status;
    private String message;
    private int totalQuestionsScheduled;
    private int totalSubmissionsScheduled;
}
