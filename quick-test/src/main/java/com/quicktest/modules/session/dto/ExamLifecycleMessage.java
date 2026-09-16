package com.quicktest.modules.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Message dispatched via WebSocket when an exam lifecycle event occurs
 * (e.g. EXAM_CLOSED, AUTO_SUBMIT).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamLifecycleMessage {

    @Builder.Default
    private String eventType = "EXAM_CLOSED";

    @Builder.Default
    private String action = "AUTO_SUBMIT";

    private UUID examId;
    private UUID attemptId;
    private String reason;
    private String message;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
