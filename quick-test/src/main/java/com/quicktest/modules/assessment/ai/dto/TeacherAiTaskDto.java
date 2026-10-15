package com.quicktest.modules.assessment.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;
import java.util.UUID;

/**
 * Data Transfer Object representing an asynchronous AI background task
 * belonging to a specific teacher (either document-to-quiz generation or essay grading).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherAiTaskDto implements Serializable {

    private String taskId;

    /**
     * Type of AI task: "AI_QUIZ_GEN" or "AI_GRADING".
     */
    private String type;

    private UUID teacherId;

    /**
     * Display title: original document file name for quiz generation,
     * or exam title for essay grading.
     */
    private String title;

    private UUID targetExamId;

    private String targetExamTitle;

    /**
     * Current execution status: "QUEUED", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED".
     */
    @Builder.Default
    private String status = "QUEUED";

    @Builder.Default
    private int progressPercent = 0;

    private String currentStep;

    /**
     * Target count: number of questions to generate OR total candidate submissions to grade.
     */
    private int totalItems;

    /**
     * Processed count: number of questions generated OR submissions already graded.
     */
    private int processedItems;

    private String createdAt;

    private String completedAt;

    private String errorMessage;

    /**
     * Generated questions payload (populated when type is AI_QUIZ_GEN and status is COMPLETED).
     */
    private List<AiGeneratedQuestionDto> questions;
}
