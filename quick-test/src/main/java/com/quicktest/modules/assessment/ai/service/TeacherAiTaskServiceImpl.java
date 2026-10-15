package com.quicktest.modules.assessment.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.service.AiMetricsRedisService;
import com.quicktest.modules.assessment.ai.dto.AiGeneratedQuestionDto;
import com.quicktest.modules.assessment.ai.dto.TeacherAiTaskDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Implementation of TeacherAiTaskService utilizing Redis for high-performance,
 * transient storage of teacher AI jobs with a 48-hour retention window.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class TeacherAiTaskServiceImpl implements TeacherAiTaskService {

    public static final String REDIS_TEACHER_TASKS_PREFIX = "ai:teacher:tasks:";
    public static final String REDIS_TASK_PREFIX = "ai:task:";
    public static final String REDIS_USER_LOCK_PREFIX = "ai:lock:user:";
    private static final Duration TASK_TTL = Duration.ofHours(48);

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final AiMetricsRedisService aiMetricsRedisService;

    @Override
    public void createTask(TeacherAiTaskDto task) {
        if (task == null || task.getTaskId() == null || task.getTeacherId() == null) {
            return;
        }

        try {
            if (task.getCreatedAt() == null) {
                task.setCreatedAt(Instant.now().toString());
            }

            String taskKey = REDIS_TASK_PREFIX + task.getTaskId();
            String json = objectMapper.writeValueAsString(task);
            stringRedisTemplate.opsForValue().set(taskKey, json, TASK_TTL);

            // Add to teacher's sorted task index (newest first based on epoch milliseconds)
            String teacherTasksKey = REDIS_TEACHER_TASKS_PREFIX + task.getTeacherId();
            double score = (double) System.currentTimeMillis();
            stringRedisTemplate.opsForZSet().add(teacherTasksKey, task.getTaskId(), score);
            stringRedisTemplate.expire(teacherTasksKey, TASK_TTL);

            log.info("[TeacherAiTask] Created task [{}] for teacher [{}] (type: {}, title: '{}')",
                    task.getTaskId(), task.getTeacherId(), task.getType(), task.getTitle());

        } catch (Exception e) {
            log.warn("[TeacherAiTask] Failed to record task {} in Redis: {}", task.getTaskId(), e.getMessage());
        }
    }

    @Override
    public void updateTaskProgress(String taskId, int progressPercent, int processedItems, String currentStep) {
        if (taskId == null) return;

        try {
            TeacherAiTaskDto task = readTaskRaw(taskId);
            if (task != null) {
                task.setProgressPercent(progressPercent);
                if (processedItems >= 0) {
                    task.setProcessedItems(processedItems);
                }
                if (currentStep != null) {
                    task.setCurrentStep(currentStep);
                }
                if (!"COMPLETED".equals(task.getStatus()) && !"FAILED".equals(task.getStatus()) && !"CANCELLED".equals(task.getStatus())) {
                    task.setStatus("PROCESSING");
                }
                saveTaskRaw(task);
            }
        } catch (Exception e) {
            log.debug("[TeacherAiTask] Failed to update progress for task {}: {}", taskId, e.getMessage());
        }
    }

    @Override
    public void completeQuizGenTask(String taskId, List<AiGeneratedQuestionDto> questions) {
        if (taskId == null) return;

        try {
            TeacherAiTaskDto task = readTaskRaw(taskId);
            if (task != null) {
                task.setStatus("COMPLETED");
                task.setProgressPercent(100);
                task.setProcessedItems(questions != null ? questions.size() : 0);
                task.setCompletedAt(Instant.now().toString());
                task.setCurrentStep(String.format("Đã soạn thành công %d câu hỏi từ tài liệu.",
                        questions != null ? questions.size() : 0));
                task.setQuestions(questions);
                saveTaskRaw(task);
                log.info("[TeacherAiTask] Completed AI quiz generation task [{}] with {} questions",
                        taskId, questions != null ? questions.size() : 0);
            }
        } catch (Exception e) {
            log.warn("[TeacherAiTask] Failed to mark task {} as COMPLETED: {}", taskId, e.getMessage());
        }
    }

    @Override
    public void completeGradingTask(String taskId) {
        if (taskId == null) return;

        try {
            TeacherAiTaskDto task = readTaskRaw(taskId);
            if (task != null) {
                task.setStatus("COMPLETED");
                task.setProgressPercent(100);
                task.setProcessedItems(task.getTotalItems());
                task.setCompletedAt(Instant.now().toString());
                task.setCurrentStep("Đã hoàn tất chấm điểm tất cả bài làm tự luận.");
                saveTaskRaw(task);
                log.info("[TeacherAiTask] Completed AI essay grading task [{}]", taskId);
            }
        } catch (Exception e) {
            log.warn("[TeacherAiTask] Failed to mark task {} as COMPLETED: {}", taskId, e.getMessage());
        }
    }

    @Override
    public void failTask(String taskId, String errorMessage) {
        if (taskId == null) return;

        try {
            TeacherAiTaskDto task = readTaskRaw(taskId);
            if (task != null) {
                task.setStatus("FAILED");
                task.setCompletedAt(Instant.now().toString());
                task.setErrorMessage(errorMessage);
                task.setCurrentStep("Xử lý thất bại: " + (errorMessage != null ? errorMessage : "Lỗi không xác định"));
                saveTaskRaw(task);
                log.info("[TeacherAiTask] Marked task [{}] as FAILED: {}", taskId, errorMessage);
            }
        } catch (Exception e) {
            log.warn("[TeacherAiTask] Failed to mark task {} as FAILED: {}", taskId, e.getMessage());
        }
    }

    @Override
    public List<TeacherAiTaskDto> getTeacherTasks(UUID teacherId) {
        if (teacherId == null) {
            return List.of();
        }

        String teacherTasksKey = REDIS_TEACHER_TASKS_PREFIX + teacherId;
        // Fetch task IDs ordered newest first (highest score first)
        Set<String> taskIds = stringRedisTemplate.opsForZSet().reverseRange(teacherTasksKey, 0, 50);

        if (taskIds == null || taskIds.isEmpty()) {
            return List.of();
        }

        List<TeacherAiTaskDto> result = new ArrayList<>();
        for (String taskId : taskIds) {
            TeacherAiTaskDto task = readTaskRaw(taskId);
            if (task != null) {
                // To keep list responses lightweight, omit detailed questions payload in the overview list
                TeacherAiTaskDto summary = TeacherAiTaskDto.builder()
                        .taskId(task.getTaskId())
                        .type(task.getType())
                        .teacherId(task.getTeacherId())
                        .title(task.getTitle())
                        .targetExamId(task.getTargetExamId())
                        .targetExamTitle(task.getTargetExamTitle())
                        .status(task.getStatus())
                        .progressPercent(task.getProgressPercent())
                        .currentStep(task.getCurrentStep())
                        .totalItems(task.getTotalItems())
                        .processedItems(task.getProcessedItems())
                        .createdAt(task.getCreatedAt())
                        .completedAt(task.getCompletedAt())
                        .errorMessage(task.getErrorMessage())
                        .questions(null) // Exclude large question JSON from list view
                        .build();
                result.add(summary);
            }
        }

        return result;
    }

    @Override
    public TeacherAiTaskDto getTaskDetail(String taskId, UUID teacherId) {
        if (taskId == null || teacherId == null) {
            throw new AppException("Invalid task ID or teacher ID", HttpStatus.BAD_REQUEST);
        }

        TeacherAiTaskDto task = readTaskRaw(taskId);
        if (task == null) {
            throw new ResourceNotFoundException("TeacherAiTask", "id", taskId);
        }

        // Verify task ownership
        if (!teacherId.equals(task.getTeacherId())) {
            throw new AppException("You do not have permission to view this task", HttpStatus.FORBIDDEN);
        }

        return task;
    }

    @Override
    public void cancelTask(String taskId, UUID teacherId) {
        if (taskId == null || teacherId == null) return;

        TeacherAiTaskDto task = readTaskRaw(taskId);
        if (task != null && teacherId.equals(task.getTeacherId())) {
            task.setStatus("CANCELLED");
            task.setCompletedAt(Instant.now().toString());
            task.setCurrentStep("Tiến trình đã bị hủy bởi giáo viên.");
            saveTaskRaw(task);

            // Release per-user concurrency lock
            String userLockKey = REDIS_USER_LOCK_PREFIX + teacherId;
            stringRedisTemplate.delete(userLockKey);

            // If it was a grading task, release exam lock
            if (task.getTargetExamId() != null) {
                stringRedisTemplate.delete("ai:grading:lock:exam:" + task.getTargetExamId());
            }

            // Remove from global active jobs
            aiMetricsRedisService.removeActiveJob(taskId);
            log.info("[TeacherAiTask] Teacher [{}] cancelled task [{}]", teacherId, taskId);
        }
    }

    @Override
    public void deleteTask(String taskId, UUID teacherId) {
        if (taskId == null || teacherId == null) return;

        String teacherTasksKey = REDIS_TEACHER_TASKS_PREFIX + teacherId;
        stringRedisTemplate.opsForZSet().remove(teacherTasksKey, taskId);

        String taskKey = REDIS_TASK_PREFIX + taskId;
        stringRedisTemplate.delete(taskKey);
        log.info("[TeacherAiTask] Deleted task [{}] from teacher [{}]", taskId, teacherId);
    }

    private TeacherAiTaskDto readTaskRaw(String taskId) {
        try {
            String taskKey = REDIS_TASK_PREFIX + taskId;
            String json = stringRedisTemplate.opsForValue().get(taskKey);
            if (json != null && !json.isBlank()) {
                return objectMapper.readValue(json, TeacherAiTaskDto.class);
            }
        } catch (Exception e) {
            log.debug("[TeacherAiTask] Failed to read task {}: {}", taskId, e.getMessage());
        }
        return null;
    }

    private void saveTaskRaw(TeacherAiTaskDto task) {
        try {
            String taskKey = REDIS_TASK_PREFIX + task.getTaskId();
            String json = objectMapper.writeValueAsString(task);
            stringRedisTemplate.opsForValue().set(taskKey, json, TASK_TTL);
        } catch (Exception e) {
            log.warn("[TeacherAiTask] Failed to persist task {}: {}", task.getTaskId(), e.getMessage());
        }
    }
}
