package com.quicktest.modules.assessment.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.session.dto.*;
import com.quicktest.modules.session.entity.GradingStatus;
import com.quicktest.modules.session.service.QuestionGradingService;
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

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * REST controller for question-centric essay grading workflows and batch AI evaluation.
 */
@Slf4j
@RestController
@RequestMapping("/api/teacher/grading")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class QuestionGradingController {

    private final QuestionGradingService questionGradingService;
    private final UserRepository userRepository;

    /**
     * Retrieve all essay questions in an exam with grading progress summary.
     */
    @GetMapping("/exams/{examId}/questions")
    public ResponseEntity<ApiResponse<List<QuestionGradingSummaryResponse>>> getQuestionsForGrading(
            @PathVariable("examId") UUID examId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        List<QuestionGradingSummaryResponse> response =
                questionGradingService.getQuestionsForGrading(examId, teacher);

        return ResponseEntity.ok(ApiResponse.success(response, "Essay questions retrieved successfully"));
    }

    /**
     * Retrieve rubric, sample answer, and paginated candidate submissions for a specific essay question.
     */
    @GetMapping("/questions/{questionId}/submissions")
    public ResponseEntity<ApiResponse<QuestionSubmissionsDetailResponse>> getQuestionSubmissions(
            @PathVariable("questionId") UUID questionId,
            @RequestParam(value = "status", required = false) GradingStatus status,
            @PageableDefault(size = 10) Pageable pageable,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {


        User teacher = getAuthenticatedTeacher(currentUser);
        QuestionSubmissionsDetailResponse response =
                questionGradingService.getQuestionSubmissions(questionId, status, pageable, teacher);

        return ResponseEntity.ok(ApiResponse.success(response, "Submissions for question retrieved successfully"));
    }

    /**
     * Save manual grades and feedback for candidate submissions of a question.
     */
    @PostMapping("/questions/{questionId}/manual")
    public ResponseEntity<ApiResponse<ManualBatchGradeResponse>> saveManualGrades(
            @PathVariable("questionId") UUID questionId,
            @Valid @RequestBody ManualBatchGradeRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        ManualBatchGradeResponse response =
                questionGradingService.saveManualGrades(questionId, request, teacher);

        return ResponseEntity.ok(ApiResponse.success(response, response.getMessage()));
    }

    /**
     * Trigger asynchronous batch AI grading using Google Gemini (HTTP 202 Accepted).
     */
    @PostMapping("/trigger-ai")
    public ResponseEntity<ApiResponse<TriggerAiGradingResponse>> triggerAiGrading(
            @Valid @RequestBody TriggerAiGradingRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User teacher = getAuthenticatedTeacher(currentUser);
        TriggerAiGradingResponse response =
                questionGradingService.triggerAiGrading(request, teacher);

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(response, response.getMessage()));
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
