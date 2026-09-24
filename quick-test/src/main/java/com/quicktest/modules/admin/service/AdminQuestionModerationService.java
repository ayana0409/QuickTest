package com.quicktest.modules.admin.service;

import com.quicktest.modules.admin.dto.AdminModerationStatsResponse;
import com.quicktest.modules.admin.dto.AdminQuestionModerationResponse;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.iam.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

/**
 * Service interface for Admin Question and Answer Content Moderation.
 */
public interface AdminQuestionModerationService {

    /**
     * Get paginated questions for moderation with multiple filter criteria.
     */
    Page<AdminQuestionModerationResponse> getModerationQuestions(
            Boolean isSafe,
            Boolean hasImage,
            QuestionType questionType,
            String search,
            Pageable pageable);

    /**
     * Retrieve aggregate KPI statistics for content moderation.
     */
    AdminModerationStatsResponse getModerationStats();

    /**
     * Set or revoke content safety flag on a question.
     */
    AdminQuestionModerationResponse updateSafetyFlag(UUID questionId, boolean isSafe, User adminUser);

    /**
     * Admin delete an unsafe/inappropriate question, cleaning up associated answers,
     * candidate submissions, and images on Cloudinary via RabbitMQ.
     */
    void deleteQuestionByAdmin(UUID questionId, User adminUser);
}
