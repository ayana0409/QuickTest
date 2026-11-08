package com.quicktest.modules.admin.dto;

import com.quicktest.modules.proctoring.entity.ViolationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO representing a proctoring evidence media item displayed in the Admin Dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminProctoringMediaResponse {

    private UUID id;
    private UUID attemptId;
    private UUID examId;
    private String examTitle;
    private String attemptStatus;
    private UUID studentId;
    private String studentName;
    private String studentEmail;
    private ViolationType violationType;
    private String description;
    private String evidenceUrl;
    private LocalDateTime timestamp;
    private boolean isAnimatedBurst;
    private String storageType;
}

