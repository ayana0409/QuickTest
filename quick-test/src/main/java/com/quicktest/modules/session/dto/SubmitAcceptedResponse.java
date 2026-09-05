package com.quicktest.modules.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Immediate response returned with HTTP 202 Accepted upon successful submission ingestion.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitAcceptedResponse implements Serializable {

    private static final long serialVersionUID = 1L;

    private UUID attemptId;

    @Builder.Default
    private String status = "PROCESSING";

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime submitTime;

    private String message;
}
