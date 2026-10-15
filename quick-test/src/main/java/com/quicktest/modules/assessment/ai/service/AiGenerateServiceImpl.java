package com.quicktest.modules.assessment.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.service.AiMetricsRedisService;
import com.quicktest.modules.assessment.ai.dto.*;
import com.quicktest.modules.assessment.dto.AnswerOptionDto;
import com.quicktest.modules.assessment.dto.QuestionCreateRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.assessment.service.QuestionService;
import com.quicktest.modules.iam.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Implementation of {@link AiGenerateService}.
 * Manages document text parsing, enqueues background generation to the shared single-thread queue,
 * checks and enforces per-user concurrency lock with 8-hour safety TTL, and coordinates bulk exam imports.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AiGenerateServiceImpl implements AiGenerateService {

    private final DocumentParserService documentParserService;
    private final AiQuizGeneratorAsyncWorker asyncWorker;
    private final QuestionService questionService;
    private final AiMetricsRedisService aiMetricsRedisService;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public AiGenerateJobResponse submitQuizGenerationJob(
            MultipartFile file,
            AiGenerateQuizRequest request,
            User teacher) {

        if (teacher == null) {
            throw new AppException("User authentication required", HttpStatus.UNAUTHORIZED);
        }

        // Enforce: exactly ONE active AI task per user account at any time
        String userLockKey = AiQuizGeneratorAsyncWorker.REDIS_USER_LOCK_PREFIX + teacher.getId();
        Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(userLockKey, "LOCKED", Duration.ofHours(8));

        if (!Boolean.TRUE.equals(acquired)) {
            log.warn("[AiGenerate] User {} attempted to spawn concurrent AI task while another AI job is active/queued.", teacher.getId());
            throw new AppException(
                    "Tài khoản của bạn hiện đang có một tác vụ AI (chấm bài hoặc soạn đề) đang được xử lý hoặc xếp hàng. " +
                    "Vui lòng chờ tác vụ hiện tại hoàn tất trước khi tạo thêm!",
                    HttpStatus.CONFLICT);
        }

        String documentText;
        String fileName;

        try {
            if (file != null && !file.isEmpty()) {
                documentText = documentParserService.extractText(file);
                fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document.pdf";
            } else if (request.getRawText() != null && !request.getRawText().isBlank()) {
                documentText = documentParserService.sanitizeText(request.getRawText());
                fileName = "van_ban_truc_tiep.txt";
            } else {
                stringRedisTemplate.delete(userLockKey);
                throw new AppException("Vui lòng tải lên file tài liệu (PDF, Word, TXT) hoặc nhập nội dung văn bản để AI soạn đề.",
                        HttpStatus.BAD_REQUEST);
            }
        } catch (Exception ex) {
            // Guarantee lock release if parsing fails synchronously before worker begins
            stringRedisTemplate.delete(userLockKey);
            throw ex;
        }

        String jobId = UUID.randomUUID().toString();
        int questionCount = request.getTotalQuestions() != null ? request.getTotalQuestions() : 10;

        // Save QUEUED state in Redis immediately
        asyncWorker.updateJobStatus(jobId, fileName, "QUEUED", 0,
                "Đang xếp hàng chờ luồng AI duy nhất của hệ thống...", null, null);

        // Register job in Admin live metrics tracking
        aiMetricsRedisService.registerActiveJob(
                jobId,
                "AI_QUIZ_GEN",
                request.getExamId(),
                fileName,
                1,
                questionCount,
                "QUEUED");

        // Dispatch to shared single-thread executor
        asyncWorker.executeQuizGenerationAsync(jobId, teacher.getId(), documentText, fileName, request);

        return AiGenerateJobResponse.builder()
                .jobId(jobId)
                .status("QUEUED")
                .progressPercent(0)
                .currentStep("Đã tiếp nhận yêu cầu và xếp hàng vào luồng xử lý AI duy nhất.")
                .sourceFileName(fileName)
                .totalQuestionsGenerated(0)
                .createdAt(Instant.now().toString())
                .build();
    }

    @Override
    public AiGenerateJobResponse getJobStatus(String jobId, User teacher) {
        if (jobId == null || jobId.isBlank()) {
            throw new AppException("Job ID cannot be empty", HttpStatus.BAD_REQUEST);
        }

        String key = AiQuizGeneratorAsyncWorker.REDIS_QUIZ_JOB_PREFIX + jobId;
        String json = stringRedisTemplate.opsForValue().get(key);

        if (json == null || json.isBlank()) {
            throw new ResourceNotFoundException("AiGenerateJob", "id", jobId);
        }

        try {
            return objectMapper.readValue(json, AiGenerateJobResponse.class);
        } catch (Exception e) {
            log.error("[AiGenerate] Failed to deserialize job response for {}: {}", jobId, e.getMessage(), e);
            throw new AppException("Failed to read job status: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Override
    public void cancelQuizGenerationJob(String jobId, User teacher) {
        if (jobId == null || jobId.isBlank()) return;

        // Release user concurrency lock
        String userLockKey = AiQuizGeneratorAsyncWorker.REDIS_USER_LOCK_PREFIX + teacher.getId();
        stringRedisTemplate.delete(userLockKey);

        // Mark as FAILED / CANCELLED in Redis
        asyncWorker.updateJobStatus(jobId, "Cancelled", "FAILED", 0,
                "Tiến trình tạo đề đã bị hủy bởi giáo viên.", null, "User cancelled job");

        aiMetricsRedisService.removeActiveJob(jobId);
        log.info("[AiGenerate] User {} cancelled quiz generation job {}", teacher.getId(), jobId);
    }

    @Override
    @Transactional
    public List<QuestionResponse> commitQuestionsToExam(
            UUID examId,
            AiCommitQuestionsRequest request,
            User teacher) {

        if (examId == null) {
            throw new AppException("Exam ID cannot be empty", HttpStatus.BAD_REQUEST);
        }
        if (request == null || request.getQuestions() == null || request.getQuestions().isEmpty()) {
            throw new AppException("Questions list to commit cannot be empty", HttpStatus.BAD_REQUEST);
        }

        log.info("[AiGenerate] Teacher {} committing {} AI-generated questions to exam ID: {}",
                teacher.getId(), request.getQuestions().size(), examId);

        List<QuestionResponse> createdList = new ArrayList<>();

        for (AiGeneratedQuestionDto dto : request.getQuestions()) {
            if (dto.getContent() == null || dto.getContent().isBlank()) continue;

            List<AnswerOptionDto> options = new ArrayList<>();
            if (dto.getOptions() != null) {
                int optIdx = 0;
                for (var opt : dto.getOptions()) {
                    options.add(AnswerOptionDto.builder()
                            .orderIndex(opt.getOrderIndex() != null ? opt.getOrderIndex() : optIdx++)
                            .content(opt.getContent())
                            .isCorrect(Boolean.TRUE.equals(opt.getIsCorrect()))
                            .build());
                }
            }

            QuestionCreateRequest createReq = QuestionCreateRequest.builder()
                    .content(dto.getContent().trim())
                    .questionType(dto.getQuestionType())
                    .points(dto.getPoints() != null && dto.getPoints() > 0 ? dto.getPoints() : 1.0)
                    .sampleAnswer(dto.getSampleAnswer())
                    .gradingRubric(dto.getGradingRubric())
                    .numericTolerance(dto.getNumericTolerance())
                    .options(options)
                    .build();

            // Re-use standard QuestionService: checks teacher exam ownership, draft status, and executes moderation
            QuestionResponse created = questionService.addQuestionToExam(examId, createReq, teacher);
            createdList.add(created);
        }

        log.info("[AiGenerate] Successfully committed {} question(s) into exam ID: {}", createdList.size(), examId);
        return createdList;
    }
}
