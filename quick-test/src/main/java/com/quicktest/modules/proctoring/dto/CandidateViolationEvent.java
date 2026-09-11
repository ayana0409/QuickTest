package com.quicktest.modules.proctoring.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.proctoring.entity.ViolationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Event broadcast to teacher monitoring room when a candidate violation is detected.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CandidateViolationEvent {

    private UUID attemptId;
    private UUID examId;
    private String candidateName;
    private String candidateIdentifier;
    private ViolationType violationType;
    private Integer violationCount;
    private String description;
    private Boolean disqualified;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
