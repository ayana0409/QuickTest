package com.quicktest.modules.admin.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.admin.dto.AdminModerationStatsResponse;
import com.quicktest.modules.admin.dto.AdminQuestionModerationResponse;
import com.quicktest.modules.admin.dto.AdminSafetyFlagRequest;
import com.quicktest.modules.admin.service.AdminQuestionModerationService;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller providing administrative question & answer content moderation operations.
 * Requires ROLE_ADMIN authority.
 */
@RestController
@RequestMapping("/api/admin/moderation")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminQuestionModerationController {

    private final AdminQuestionModerationService moderationService;
    private final UserRepository userRepository;

    /**
     * Get paginated list of all questions with rich filters (isSafe, hasImage, questionType, search).
     */
    @GetMapping("/questions")
    public ResponseEntity<ApiResponse<PageResponse<AdminQuestionModerationResponse>>> getModerationQuestions(
            @RequestParam(name = "isSafe", required = false) Boolean isSafe,
            @RequestParam(name = "hasImage", required = false) Boolean hasImage,
            @RequestParam(name = "questionType", required = false) QuestionType questionType,
            @RequestParam(name = "search", required = false) String search,
            @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {

        Page<AdminQuestionModerationResponse> questions = moderationService.getModerationQuestions(
                isSafe, hasImage, questionType, search, pageable);
        return ResponseEntity.ok(ApiResponse.success(PageResponse.from(questions), "Moderation questions retrieved successfully"));
    }

    /**
     * Get aggregate moderation statistics for dashboard cards.
     */
    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminModerationStatsResponse>> getModerationStats() {
        AdminModerationStatsResponse stats = moderationService.getModerationStats();
        return ResponseEntity.ok(ApiResponse.success(stats, "Moderation stats retrieved successfully"));
    }

    /**
     * Toggle or update the safety flag for a specific question.
     */
    @PatchMapping("/questions/{id}/safety")
    public ResponseEntity<ApiResponse<AdminQuestionModerationResponse>> updateSafetyFlag(
            @PathVariable("id") UUID id,
            @Valid @RequestBody AdminSafetyFlagRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User admin = getAuthenticatedAdmin(currentUser);
        AdminQuestionModerationResponse response = moderationService.updateSafetyFlag(id, request.getIsSafe(), admin);
        String message = request.getIsSafe() ? "Question marked as safe successfully" : "Question safety flag revoked successfully";
        return ResponseEntity.ok(ApiResponse.success(response, message));
    }

    /**
     * Delete an unsafe or policy-violating question.
     */
    @DeleteMapping("/questions/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteQuestion(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        User admin = getAuthenticatedAdmin(currentUser);
        moderationService.deleteQuestionByAdmin(id, admin);
        return ResponseEntity.ok(ApiResponse.success(null, "Question deleted successfully by administrator"));
    }

    private User getAuthenticatedAdmin(UserDetailsImpl currentUser) {
        return userRepository.findById(currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", currentUser.getId()));
    }
}
