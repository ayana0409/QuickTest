package com.quicktest.modules.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

/**
 * Payload delivered when a candidate refreshes the page or resumes an active exam session.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResumeExamResponse {

    private ExamPaperResponse paper;

    // Map of questionId -> last auto-saved draft answer retrieved from Redis Hash
    private Map<UUID, SaveAnswerRequest> savedAnswers;
}
