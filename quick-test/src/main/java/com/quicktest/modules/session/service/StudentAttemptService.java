package com.quicktest.modules.session.service;

import com.quicktest.core.common.PageResponse;
import com.quicktest.modules.session.dto.StudentAttemptDetailResponse;
import com.quicktest.modules.session.dto.StudentAttemptSummaryDto;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

/**
 * Service providing student attempt history and progression retrieval.
 */
public interface StudentAttemptService {

    /**
     * Retrieve paginated attempt summaries for a specific student.
     *
     * @param userId Authenticated student user ID
     * @param pageable Pagination configuration
     * @return Paginated student attempt summaries
     */
    PageResponse<StudentAttemptSummaryDto> getStudentAttempts(UUID userId, Pageable pageable);

    /**
     * Retrieve detailed attempt breakdown including questions, candidate answers, and proctoring logs.
     *
     * @param attemptId Exam attempt ID
     * @param userId Authenticated student user ID
     * @return Detailed attempt review response
     */
    StudentAttemptDetailResponse getStudentAttemptDetail(UUID attemptId, UUID userId);
}
