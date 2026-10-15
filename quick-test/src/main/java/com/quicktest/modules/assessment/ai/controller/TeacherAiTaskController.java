package com.quicktest.modules.assessment.ai.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.assessment.ai.dto.TeacherAiTaskDto;
import com.quicktest.modules.assessment.ai.service.TeacherAiTaskService;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Controller exposing REST endpoints for teachers to view and manage their
 * background AI tasks (both document quiz generation and essay grading).
 */
@Slf4j
@RestController
@RequestMapping("/api/teacher/ai-tasks")
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
@RequiredArgsConstructor
public class TeacherAiTaskController {

    private final TeacherAiTaskService teacherAiTaskService;
    private final UserRepository userRepository;

    /**
     * Retrieves all recent AI tasks for the currently authenticated teacher.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<TeacherAiTaskDto>>> getMyTasks(
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        List<TeacherAiTaskDto> tasks = teacherAiTaskService.getTeacherTasks(teacher.getId());
        return ResponseEntity.ok(ApiResponse.success(tasks, "Lấy danh sách tác vụ AI thành công"));
    }

    /**
     * Retrieves full detail for a specific AI task (including generated questions for quiz generation).
     */
    @GetMapping("/{taskId}")
    public ResponseEntity<ApiResponse<TeacherAiTaskDto>> getTaskDetail(
            @PathVariable String taskId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        TeacherAiTaskDto task = teacherAiTaskService.getTaskDetail(taskId, teacher.getId());
        return ResponseEntity.ok(ApiResponse.success(task, "Lấy chi tiết tác vụ AI thành công"));
    }

    /**
     * Cancels an active or queued AI task and releases concurrency locks.
     */
    @PostMapping("/{taskId}/cancel")
    public ResponseEntity<ApiResponse<Void>> cancelTask(
            @PathVariable String taskId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        teacherAiTaskService.cancelTask(taskId, teacher.getId());
        return ResponseEntity.ok(ApiResponse.success(null, "Đã hủy tác vụ AI thành công"));
    }

    /**
     * Removes an AI task from the teacher's task history.
     */
    @DeleteMapping("/{taskId}")
    public ResponseEntity<ApiResponse<Void>> deleteTask(
            @PathVariable String taskId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        teacherAiTaskService.deleteTask(taskId, teacher.getId());
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa tác vụ khỏi lịch sử"));
    }

    private User getAuthenticatedTeacher(UserDetailsImpl currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new AppException("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }
        UUID teacherId = Objects.requireNonNull(currentUser.getId());
        return userRepository.findById(teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", teacherId));
    }
}
