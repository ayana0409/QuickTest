package com.quicktest.modules.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Optional payload when submitting exam, providing fallback answers in case of network latency.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitExamRequest {

    // Optional direct answers submission
    private List<SaveAnswerRequest> answers;
}
