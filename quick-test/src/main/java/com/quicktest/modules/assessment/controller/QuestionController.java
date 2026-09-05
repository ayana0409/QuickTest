package com.quicktest.modules.assessment.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.assessment.dto.QuestionCreateRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.assessment.dto.QuestionUpdateRequest;
import com.quicktest.modules.assessment.service.QuestionService;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller providing question authoring and management operations for teachers.
 */
@RestController
@RequestMapping("/api/teacher")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;
    private final UserRepository userRepository;

    /**
     * Add a new question to an exam.
     */
    @PostMapping("/exams/{examId}/questions")
    public ResponseEntity<ApiResponse<QuestionResponse>> addQuestionToExam(
            @PathVariable("examId") UUID examId,
            @Valid @RequestBody QuestionCreateRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        QuestionResponse response = questionService.addQuestionToExam(examId, request, teacher);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Question added to exam successfully"));
    }

    /**
     * Update an existing question.
     */
    @PutMapping("/questions/{questionId}")
    public ResponseEntity<ApiResponse<QuestionResponse>> updateQuestion(
            @PathVariable("questionId") UUID questionId,
            @Valid @RequestBody QuestionUpdateRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        QuestionResponse response = questionService.updateQuestion(questionId, request, teacher);
        return ResponseEntity.ok(ApiResponse.success(response, "Question updated successfully"));
    }

    /**
     * Delete a question from an exam.
     */
    @DeleteMapping("/questions/{questionId}")
    public ResponseEntity<ApiResponse<Void>> deleteQuestion(
            @PathVariable("questionId") UUID questionId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {
        User teacher = getAuthenticatedTeacher(currentUser);
        questionService.deleteQuestion(questionId, teacher);
        return ResponseEntity.ok(ApiResponse.success(null, "Question deleted successfully"));
    }

    private User getAuthenticatedTeacher(UserDetailsImpl currentUser) {
        if (currentUser == null || currentUser.getId() == null) {
            throw new AppException("User is not authenticated", HttpStatus.UNAUTHORIZED);
        }
        UUID teacherId = java.util.Objects.requireNonNull(currentUser.getId());
        return userRepository.findById(teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", teacherId));
    }
}
