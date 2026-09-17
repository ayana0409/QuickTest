package com.quicktest.modules.session.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.session.dto.AttemptGradingDetailResponse;
import com.quicktest.modules.session.dto.AttemptSummaryResponse;
import com.quicktest.modules.session.dto.ExamAttemptStatsResponse;
import com.quicktest.modules.session.dto.GradeEssaySubmissionRequest;
import com.quicktest.modules.session.dto.GradingResultResponse;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.service.TeacherGradingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Objects;
import java.util.UUID;

/**
 * REST controller providing manual grading operations for teachers.
 */
@Slf4j
@RestController
@RequestMapping("/api/teacher/grading")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class TeacherGradingController {

    private final TeacherGradingService teacherGradingService;
    private final UserRepository userRepository;

    /**
     * Retrieve paginated candidate submissions for an exam with status and keyword
     * filters.
     */
    @GetMapping("/exams/{examId}/attempts")
    public ResponseEntity<ApiResponse<PageResponse<AttemptSummaryResponse>>> getAttemptsToGrade(
            @PathVariable("examId") UUID examId,
            @RequestParam(value = "status", required = false) AttemptStatus status,
            @RequestParam(value = "search", required = false) String search,
            @PageableDefault(size = 20, sort = "submitTime", direction = Sort.Direction.DESC) Pageable pageable,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        PageResponse<AttemptSummaryResponse> response = teacherGradingService.getAttemptsToGrade(
                examId, status, search, pageable, teacher);

        return ResponseEntity.ok(ApiResponse.success(response, "Submissions retrieved successfully"));
    }

    /**
     * Retrieve aggregated statistics for all attempts of an exam.
     * Computed from a single database query for maximum performance.
     */
    @GetMapping("/exams/{examId}/stats")
    public ResponseEntity<ApiResponse<ExamAttemptStatsResponse>> getExamAttemptStats(
            @PathVariable("examId") UUID examId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        ExamAttemptStatsResponse stats = teacherGradingService.getExamAttemptStats(examId, teacher);

        return ResponseEntity.ok(ApiResponse.success(stats, "Exam statistics computed successfully"));
    }

    /**
     * Retrieve comprehensive grading details for a specific attempt (candidate
     * answers and grading rubrics).
     */
    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<ApiResponse<AttemptGradingDetailResponse>> getAttemptDetail(
            @PathVariable("attemptId") UUID attemptId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        AttemptGradingDetailResponse response = teacherGradingService.getAttemptDetailForGrading(attemptId, teacher);

        return ResponseEntity.ok(ApiResponse.success(response, "Attempt grading details retrieved successfully"));
    }

    /**
     * Submit manual grades and feedback for essay questions.
     */
    @PostMapping("/attempts/submit-grades")
    public ResponseEntity<ApiResponse<GradingResultResponse>> submitEssayGrades(
            @Valid @RequestBody GradeEssaySubmissionRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        GradingResultResponse response = teacherGradingService.submitEssayGrades(request, teacher);

        return ResponseEntity.ok(ApiResponse.success(response, response.getMessage()));
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
