package com.quicktest.modules.session.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.session.dto.StudentAttemptDetailResponse;
import com.quicktest.modules.session.dto.StudentAttemptSummaryDto;
import com.quicktest.modules.session.service.StudentAttemptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST controller providing attempt history and performance insights for authenticated students.
 */
@Slf4j
@RestController
@RequestMapping("/api/student/attempts")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
public class StudentAttemptController {

    private final StudentAttemptService studentAttemptService;

    /**
     * Retrieve paginated attempt history for the currently authenticated student.
     * Guarantees student can only access their own submissions.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<StudentAttemptSummaryDto>>> getStudentAttempts(
            @AuthenticationPrincipal UserDetailsImpl currentUser,
            @PageableDefault(size = 10) Pageable pageable) {

        if (currentUser == null || currentUser.getId() == null) {
            throw new AppException("User must be authenticated to view attempt history", HttpStatus.UNAUTHORIZED);
        }

        log.info("Student {} requested attempt history, page: {}, size: {}",
                currentUser.getId(), pageable.getPageNumber(), pageable.getPageSize());

        PageResponse<StudentAttemptSummaryDto> response =
                studentAttemptService.getStudentAttempts(currentUser.getId(), pageable);

        return ResponseEntity.ok(ApiResponse.success(response, "Attempt history retrieved successfully"));
    }

    /**
     * Retrieve detailed attempt review for the authenticated student,
     * including question breakdowns, submitted answers, correct options, and proctoring violations.
     */
    @GetMapping("/{attemptId}")
    public ResponseEntity<ApiResponse<StudentAttemptDetailResponse>> getStudentAttemptDetail(
            @PathVariable("attemptId") UUID attemptId,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        if (currentUser == null || currentUser.getId() == null) {
            throw new AppException("User must be authenticated to view attempt details", HttpStatus.UNAUTHORIZED);
        }

        log.info("Student {} requested attempt details for attemptId: {}",
                currentUser.getId(), attemptId);

        StudentAttemptDetailResponse response =
                studentAttemptService.getStudentAttemptDetail(attemptId, currentUser.getId());

        return ResponseEntity.ok(ApiResponse.success(response, "Attempt details retrieved successfully"));
    }
}
