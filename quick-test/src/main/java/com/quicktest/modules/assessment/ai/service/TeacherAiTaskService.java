package com.quicktest.modules.assessment.ai.service;

import com.quicktest.modules.assessment.ai.dto.AiGeneratedQuestionDto;
import com.quicktest.modules.assessment.ai.dto.TeacherAiTaskDto;

import java.util.List;
import java.util.UUID;

/**
 * Service defining operations for tracking, monitoring, and retrieving
 * asynchronous AI tasks initiated by teachers (document quiz generation and essay grading).
 */
public interface TeacherAiTaskService {

    /**
     * Registers a new AI task for a teacher and stores the initial snapshot in Redis.
     */
    void createTask(TeacherAiTaskDto task);

    /**
     * Updates dynamic execution progress and current human-readable step message.
     */
    void updateTaskProgress(String taskId, int progressPercent, int processedItems, String currentStep);

    /**
     * Marks a quiz generation task as COMPLETED with its generated questions payload.
     */
    void completeQuizGenTask(String taskId, List<AiGeneratedQuestionDto> questions);

    /**
     * Marks an essay grading task as COMPLETED.
     */
    void completeGradingTask(String taskId);

    /**
     * Marks a task as FAILED with error details.
     */
    void failTask(String taskId, String errorMessage);

    /**
     * Retrieves all recent AI tasks for a given teacher, ordered with newest first.
     */
    List<TeacherAiTaskDto> getTeacherTasks(UUID teacherId);

    /**
     * Retrieves full details (including generated questions) of a specific task.
     */
    TeacherAiTaskDto getTaskDetail(String taskId, UUID teacherId);

    /**
     * Cancels an active or queued task and releases associated locks.
     */
    void cancelTask(String taskId, UUID teacherId);

    /**
     * Deletes a task from the teacher's task history.
     */
    void deleteTask(String taskId, UUID teacherId);
}
