package com.quicktest.modules.session.service;

import com.quicktest.core.common.PageResponse;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.AttemptGradingDetailResponse;
import com.quicktest.modules.session.dto.AttemptSummaryResponse;
import com.quicktest.modules.session.dto.GradeEssaySubmissionRequest;
import com.quicktest.modules.session.dto.GradingResultResponse;
import com.quicktest.modules.session.entity.AttemptStatus;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

/**
 * Service interface managing teacher manual grading workflows for essay submissions.
 */
public interface TeacherGradingService {

    /**
     * Retrieve paginated list of candidate attempts for an exam, filtered by status and candidate keyword.
     */
    PageResponse<AttemptSummaryResponse> getAttemptsToGrade(
            UUID examId,
            AttemptStatus status,
            String search,
            Pageable pageable,
            User currentTeacher);

    /**
     * Retrieve full grading details of a specific exam attempt (questions, answers, rubrics, points).
     */
    AttemptGradingDetailResponse getAttemptDetailForGrading(UUID attemptId, User currentTeacher);

    /**
     * Submit awarded scores and comments for essay questions and finalize attempt status if complete.
     */
    GradingResultResponse submitEssayGrades(GradeEssaySubmissionRequest request, User currentTeacher);
}
