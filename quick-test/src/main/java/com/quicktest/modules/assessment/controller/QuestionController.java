package com.quicktest.modules.assessment.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.assessment.dto.QuestionBankItemResponse;
import com.quicktest.modules.assessment.dto.QuestionCreateRequest;
import com.quicktest.modules.assessment.dto.QuestionImportRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.assessment.dto.QuestionUpdateRequest;
import com.quicktest.modules.assessment.service.QuestionService;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * REST controller providing question authoring and management operations for
 * teachers.
 */
@RestController
@RequestMapping("/api/teacher")
@PreAuthorize("hasRole('TEACHER')")
@RequiredArgsConstructor
public class QuestionController {

        private final QuestionService questionService;
        private final UserRepository userRepository;

        /**
         * Add a new question to an exam (JSON request).
         */
        @PostMapping(value = "/exams/{examId}/questions", consumes = MediaType.APPLICATION_JSON_VALUE)
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
         * Add a new question to an exam with asynchronous media upload queue (Multipart
         * request).
         */
        @PostMapping(value = { "/exams/{examId}/questions",
                        "/exams/{examId}/questions/with-media" }, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        public ResponseEntity<ApiResponse<QuestionResponse>> addQuestionWithMedia(
                        @PathVariable("examId") UUID examId,
                        @RequestPart("question") @Valid QuestionCreateRequest request,
                        @RequestPart(value = "questionImage", required = false) MultipartFile questionImage,
                        @RequestPart(value = "optionImages", required = false) List<MultipartFile> optionImages,
                        @RequestParam(value = "optionIndices", required = false) List<Integer> optionIndices,
                        @AuthenticationPrincipal UserDetailsImpl currentUser) {
                User teacher = getAuthenticatedTeacher(currentUser);
                QuestionResponse response = questionService.addQuestionWithMedia(
                                examId, request, questionImage, optionImages, optionIndices, teacher);
                return ResponseEntity
                                .status(HttpStatus.CREATED)
                                .body(ApiResponse.success(response,
                                                "Question added to exam successfully. Media is processing in background."));
        }

        /**
         * Update an existing question (JSON request).
         */
        @PutMapping(value = "/questions/{questionId}", consumes = MediaType.APPLICATION_JSON_VALUE)
        public ResponseEntity<ApiResponse<QuestionResponse>> updateQuestion(
                        @PathVariable("questionId") UUID questionId,
                        @Valid @RequestBody QuestionUpdateRequest request,
                        @AuthenticationPrincipal UserDetailsImpl currentUser) {
                User teacher = getAuthenticatedTeacher(currentUser);
                QuestionResponse response = questionService.updateQuestion(questionId, request, teacher);
                return ResponseEntity.ok(ApiResponse.success(response, "Question updated successfully"));
        }

        /**
         * Update an existing question with asynchronous media upload queue (Multipart
         * request).
         */
        @PutMapping(value = { "/questions/{questionId}",
                        "/questions/{questionId}/with-media" }, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        public ResponseEntity<ApiResponse<QuestionResponse>> updateQuestionWithMedia(
                        @PathVariable("questionId") UUID questionId,
                        @RequestPart("question") @Valid QuestionUpdateRequest request,
                        @RequestPart(value = "questionImage", required = false) MultipartFile questionImage,
                        @RequestPart(value = "optionImages", required = false) List<MultipartFile> optionImages,
                        @RequestParam(value = "optionIndices", required = false) List<Integer> optionIndices,
                        @AuthenticationPrincipal UserDetailsImpl currentUser) {
                User teacher = getAuthenticatedTeacher(currentUser);
                QuestionResponse response = questionService.updateQuestionWithMedia(
                                questionId, request, questionImage, optionImages, optionIndices, teacher);
                return ResponseEntity.ok(ApiResponse.success(response,
                                "Question updated successfully. Media is processing in background."));
        }

        /**
         * Directly upload and update the image of a question.
         */
        @PutMapping("/questions/{questionId}/image")
        public ResponseEntity<ApiResponse<QuestionResponse>> updateQuestionImage(
                        @PathVariable("questionId") UUID questionId,
                        @RequestParam("file") MultipartFile file,
                        @AuthenticationPrincipal UserDetailsImpl currentUser) {
                User teacher = getAuthenticatedTeacher(currentUser);
                QuestionResponse response = questionService.updateQuestionImage(questionId, file, teacher);
                return ResponseEntity.ok(ApiResponse.success(response, "Question image updated successfully"));
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

        /**
         * Get paginated list of the teacher's question bank (all questions across all
         * their exams).
         * Optionally excludes a specific exam and supports keyword search.
         *
         * @param excludeExamId optional exam UUID to exclude from the bank
         * @param search        optional keyword to filter by question content or exam
         *                      title
         */
        @GetMapping("/question-bank")
        public ResponseEntity<ApiResponse<PageResponse<QuestionBankItemResponse>>> getQuestionBank(
                        @AuthenticationPrincipal UserDetailsImpl currentUser,
                        @RequestParam(value = "excludeExamId", required = false) UUID excludeExamId,
                        @RequestParam(value = "search", required = false) String search,
                        @PageableDefault(size = 10, sort = "orderIndex") Pageable pageable) {
                User teacher = getAuthenticatedTeacher(currentUser);
                Page<QuestionBankItemResponse> page = questionService.getQuestionBank(teacher, excludeExamId, search,
                                pageable);
                return ResponseEntity.ok(ApiResponse.success(
                                PageResponse.from(page), "Question bank retrieved successfully"));
        }

        /**
         * Import selected questions from the question bank into a target exam.
         * Each question and its options/images are deep-copied; the originals are not
         * modified.
         */
        @PostMapping("/exams/{examId}/questions/import")
        public ResponseEntity<ApiResponse<List<QuestionResponse>>> importQuestionsFromBank(
                        @PathVariable("examId") UUID examId,
                        @Valid @RequestBody QuestionImportRequest request,
                        @AuthenticationPrincipal UserDetailsImpl currentUser) {
                User teacher = getAuthenticatedTeacher(currentUser);
                List<QuestionResponse> imported = questionService.importQuestionsFromBank(
                                examId, request.getQuestionIds(), teacher);
                return ResponseEntity
                                .status(HttpStatus.CREATED)
                                .body(ApiResponse.success(imported,
                                                imported.size() + " question(s) imported successfully"));
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
