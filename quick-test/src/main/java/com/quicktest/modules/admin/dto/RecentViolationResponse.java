package com.quicktest.modules.admin.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.entity.ViolationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO representing an audit summary of a proctoring violation for the admin dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecentViolationResponse {

    private UUID id;
    private UUID attemptId;
    private String candidateName;
    private String candidateIdentifier;
    private UUID examId;
    private String examTitle;
    private ViolationType violationType;
    private String description;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime timestamp;

    public static RecentViolationResponse fromEntity(ViolationLog log) {
        if (log == null) {
            return null;
        }

        String name = "Unknown";
        String identifier = null;
        UUID examId = null;
        String examTitle = "Unknown";

        if (log.getExamAttempt() != null) {
            if (log.getExamAttempt().getUser() != null) {
                name = log.getExamAttempt().getUser().getFullName();
                identifier = log.getExamAttempt().getUser().getEmail();
            } else {
                name = log.getExamAttempt().getGuestName();
                identifier = log.getExamAttempt().getGuestIdentifier();
            }

            if (log.getExamAttempt().getExam() != null) {
                examId = log.getExamAttempt().getExam().getId();
                examTitle = log.getExamAttempt().getExam().getTitle();
            }
        }

        return RecentViolationResponse.builder()
                .id(log.getId())
                .attemptId(log.getExamAttempt() != null ? log.getExamAttempt().getId() : null)
                .candidateName(name)
                .candidateIdentifier(identifier)
                .examId(examId)
                .examTitle(examTitle)
                .violationType(log.getViolationType())
                .description(log.getDescription())
                .timestamp(log.getTimestamp())
                .build();
    }
}
