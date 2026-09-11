package com.quicktest.modules.proctoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload for manually disqualifying a candidate from an exam attempt.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DisqualifyAttemptRequest {

    private String reason;
}
