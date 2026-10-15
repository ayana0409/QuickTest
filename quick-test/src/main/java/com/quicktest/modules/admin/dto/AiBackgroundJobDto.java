package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * Representation of an active background AI evaluation job tracked in Redis.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiBackgroundJobDto implements Serializable {

    private String jobId;
    private String type;
    private String examId;
    private String examTitle;
    private int totalQuestions;
    private int totalAnswers;
    private int processedAnswers;
    private String startedAt;
    private String threadName;
    @Builder.Default
    private String status = "PROCESSING"; // "PROCESSING" or "QUEUED"
}
