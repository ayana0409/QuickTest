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
 * Audit log entry response for recorded candidate violations.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ViolationLogResponse {

    private UUID id;
    private UUID attemptId;
    private ViolationType violationType;
    private String description;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime timestamp;
}
