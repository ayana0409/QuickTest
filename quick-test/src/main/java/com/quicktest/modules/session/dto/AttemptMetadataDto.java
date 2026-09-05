package com.quicktest.modules.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.session.entity.AttemptStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Lightweight metadata snapshot of an active exam attempt cached in Redis
 * for sub-millisecond validation without querying PostgreSQL.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttemptMetadataDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private UUID attemptId;
    private UUID examId;
    private UUID userId;
    private String guestIdentifier;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime expireAt;

    private AttemptStatus status;
}
