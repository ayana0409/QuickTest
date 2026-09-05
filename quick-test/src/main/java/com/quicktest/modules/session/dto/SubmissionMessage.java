package com.quicktest.modules.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Payload published to RabbitMQ queue for asynchronous background grading and persistence.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmissionMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    private UUID attemptId;
    private UUID examId;
    private String examTitle;
    private UUID userId;
    private String guestIdentifier;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime submitTime;

    // Map of questionId to candidate's answer draft
    private Map<UUID, SaveAnswerRequest> answers;
}
