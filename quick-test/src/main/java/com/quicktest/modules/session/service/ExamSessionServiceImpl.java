package com.quicktest.modules.session.service;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.AttemptLimitExceededException;
import com.quicktest.core.exception.ExamClosedException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.exception.SessionExpiredException;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.*;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Service implementation orchestrating student and guest exam sessions,
 * countdown timers, Redis auto-save synchronization, and final auto-grading.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class ExamSessionServiceImpl implements ExamSessionService {

    private static final int GRACE_PERIOD_SECONDS = 15;

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final RedisExamSessionService redisExamSessionService;
    private final ExamSubmissionProducer examSubmissionProducer;

    @Override
    @Transactional
    public ExamPaperResponse startExam(StartExamRequest request, User currentUser, HttpServletRequest servletRequest) {
        String accessCode = request.getAccessCode().trim().toUpperCase();
        log.info("Attempting to start exam with accessCode: '{}', user: '{}', guest: '{}'",
                accessCode,
                currentUser != null ? currentUser.getEmail() : "ANONYMOUS",
                request.getGuestIdentifier());

        // 1. Validate exam exists and is published
        Exam exam = examRepository.findByAccessCode(accessCode)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "accessCode", accessCode));

        if (exam.getStatus() != ExamStatus.PUBLISHED) {
            throw new ExamClosedException("Exam is not available for testing. Current status: " + exam.getStatus());
        }

        // 2. Validate exam active time window
        LocalDateTime now = LocalDateTime.now();
        if (exam.getStartTime() != null && now.isBefore(exam.getStartTime())) {
            throw new ExamClosedException("Exam has not started yet. Starts at: " + exam.getStartTime());
        }
        if (exam.getEndTime() != null && now.isAfter(exam.getEndTime())) {
            throw new ExamClosedException("Exam has already closed at: " + exam.getEndTime());
        }

        // 3. Resolve candidate identity and check attempt limits
        ExamAttempt attempt;
        if (currentUser != null) {
            // Authenticated candidate flow
            Optional<ExamAttempt> activeAttempt = examAttemptRepository.findFirstByUserIdAndExamIdAndStatus(
                    currentUser.getId(), exam.getId(), AttemptStatus.IN_PROGRESS);

            if (activeAttempt.isPresent() && !isExpired(activeAttempt.get())) {
                log.info("Candidate has an active attempt in progress. Resuming attemptId: {}", activeAttempt.get().getId());
                return buildMaskedPaper(activeAttempt.get(), exam);
            }

            long completedAttempts = examAttemptRepository.countByUserIdAndExamId(currentUser.getId(), exam.getId());
            if (completedAttempts >= exam.getMaxAttempts()) {
                throw new AttemptLimitExceededException("You have reached the maximum allowed attempts ("
                        + exam.getMaxAttempts() + ") for this exam.");
            }

            attempt = createNewAttempt(exam, currentUser, null, null, servletRequest);
        } else {
            // Guest candidate flow
            if (request.getGuestName() == null || request.getGuestName().isBlank() ||
                request.getGuestIdentifier() == null || request.getGuestIdentifier().isBlank()) {
                throw new AppException("Guest candidates must provide both full name and a unique identifier (student ID, email, or phone)");
            }

            String guestName = request.getGuestName().trim();
            String guestIdentifier = request.getGuestIdentifier().trim();

            Optional<ExamAttempt> activeAttempt = examAttemptRepository.findFirstByExamIdAndGuestIdentifierAndStatus(
                    exam.getId(), guestIdentifier, AttemptStatus.IN_PROGRESS);

            if (activeAttempt.isPresent() && !isExpired(activeAttempt.get())) {
                log.info("Guest has an active attempt in progress. Resuming attemptId: {}", activeAttempt.get().getId());
                return buildMaskedPaper(activeAttempt.get(), exam);
            }

            long completedAttempts = examAttemptRepository.countByGuestIdentifierAndExamId(guestIdentifier, exam.getId());
            if (completedAttempts >= exam.getMaxAttempts()) {
                throw new AttemptLimitExceededException("Maximum allowed attempts (" + exam.getMaxAttempts()
                        + ") reached for identifier: " + guestIdentifier);
            }

            attempt = createNewAttempt(exam, null, guestName, guestIdentifier, servletRequest);
        }

        ExamAttempt savedAttempt = examAttemptRepository.save(attempt);
        log.info("Successfully started exam attempt ID: {} for exam ID: {}", savedAttempt.getId(), exam.getId());

        return buildMaskedPaper(savedAttempt, exam);
    }

    @Override
    public void saveDraft(UUID attemptId, SaveAnswerRequest request, User currentUser, String guestIdentifier) {
        log.debug("Auto-saving draft answer for attemptId: {}, questionId: {}", attemptId, request.getQuestionId());

        ExamAttempt attempt = examAttemptRepository.findByIdWithExam(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyCandidateAccess(attempt, currentUser, guestIdentifier);

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new AppException("Exam attempt is not active (Status: " + attempt.getStatus() + ")");
        }

        if (isExpiredWithGrace(attempt)) {
            throw new SessionExpiredException("Exam duration has expired. Answers can no longer be saved.");
        }

        long ttlMinutes = attempt.getExam().getDurationMinutes() + 30L;
        redisExamSessionService.saveDraftAnswer(attemptId, request.getQuestionId(), request, ttlMinutes);
    }

    @Override
    @Transactional(readOnly = true)
    public ResumeExamResponse resumeExam(UUID attemptId, User currentUser, String guestIdentifier) {
        log.info("Resuming exam attempt ID: {}", attemptId);

        ExamAttempt attempt = examAttemptRepository.findByIdWithExam(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyCandidateAccess(attempt, currentUser, guestIdentifier);

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new AppException("Exam attempt is already finalized with status: " + attempt.getStatus());
        }

        if (isExpiredWithGrace(attempt)) {
            throw new SessionExpiredException("Exam duration has expired. Cannot resume.");
        }

        ExamPaperResponse paper = buildMaskedPaper(attempt, attempt.getExam());
        Map<UUID, SaveAnswerRequest> draftAnswers = redisExamSessionService.getDraftAnswers(attemptId);

        return ResumeExamResponse.builder()
                .paper(paper)
                .savedAnswers(draftAnswers)
                .build();
    }

    @Override
    public SubmitAcceptedResponse submitExam(UUID attemptId, SubmitExamRequest request, User currentUser, String guestIdentifier) {
        log.info("Ingesting asynchronous exam submission for attempt ID: {}", attemptId);

        // 1. Acquire atomic submission lock on Redis to prevent concurrent/duplicate submissions
        boolean lockAcquired = redisExamSessionService.acquireSubmissionLock(attemptId, 300L);
        if (!lockAcquired) {
            throw new AppException("Exam attempt is already being submitted or finalized", HttpStatus.CONFLICT);
        }

        try {
            // 2. Validate attempt existence and access without opening a DB write transaction
            ExamAttempt attempt = examAttemptRepository.findByIdWithExam(attemptId)
                    .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

            verifyCandidateAccess(attempt, currentUser, guestIdentifier);

            if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
                throw new AppException("Exam attempt has already been submitted or finalized (Status: " + attempt.getStatus() + ")");
            }

            // Validate submission deadline with network grace period (15s)
            if (isExpiredWithGrace(attempt)) {
                throw new SessionExpiredException("Exam duration has expired. Submissions are no longer accepted.");
            }

            // 3. Gather candidate answers (Redis drafts + optional direct payload merge)
            Map<UUID, SaveAnswerRequest> answersMap = new HashMap<>(redisExamSessionService.getDraftAnswers(attemptId));
            if (request != null && request.getAnswers() != null) {
                for (SaveAnswerRequest ans : request.getAnswers()) {
                    if (ans.getQuestionId() != null && !answersMap.containsKey(ans.getQuestionId())) {
                        answersMap.put(ans.getQuestionId(), ans);
                    }
                }
            }

            // 4. Package submission message and dispatch to RabbitMQ queue (< 5ms)
            LocalDateTime submitTime = LocalDateTime.now();
            SubmissionMessage message = SubmissionMessage.builder()
                    .attemptId(attemptId)
                    .examId(attempt.getExam().getId())
                    .examTitle(attempt.getExam().getTitle())
                    .userId(currentUser != null ? currentUser.getId() : null)
                    .guestIdentifier(guestIdentifier)
                    .submitTime(submitTime)
                    .answers(answersMap)
                    .build();

            examSubmissionProducer.sendSubmissionMessage(message);

            // 5. Return immediate HTTP 202 Accepted response without holding DB connections
            return SubmitAcceptedResponse.builder()
                    .attemptId(attemptId)
                    .status("PROCESSING")
                    .submitTime(submitTime)
                    .message("Exam submission accepted and queued for background grading")
                    .build();

        } catch (Exception ex) {
            redisExamSessionService.releaseSubmissionLock(attemptId);
            throw ex;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public SubmitResultResponse getSubmissionResult(UUID attemptId, User currentUser, String guestIdentifier) {
        log.debug("Polling submission result for attempt ID: {}", attemptId);

        // 1. Check Redis Cache first (< 1ms response, 0 DB query)
        SubmitResultResponse cachedResult = redisExamSessionService.getCachedSubmissionResult(attemptId);
        if (cachedResult != null) {
            return cachedResult;
        }

        // 2. Fallback to PostgreSQL if cache miss
        ExamAttempt attempt = examAttemptRepository.findByIdWithExam(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyCandidateAccess(attempt, currentUser, guestIdentifier);

        if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
            return SubmitResultResponse.builder()
                    .attemptId(attemptId)
                    .examTitle(attempt.getExam().getTitle())
                    .status(AttemptStatus.IN_PROGRESS)
                    .submitTime(attempt.getSubmitTime())
                    .message("Exam submission is currently being processed and graded.")
                    .build();
        }

        return SubmitResultResponse.builder()
                .attemptId(attemptId)
                .examTitle(attempt.getExam().getTitle())
                .status(attempt.getStatus())
                .totalScore(attempt.getTotalScore())
                .submitTime(attempt.getSubmitTime())
                .message(attempt.getStatus() == AttemptStatus.AWAITING_MANUAL_GRADING
                        ? "Exam submitted successfully. Essay questions are awaiting manual grading by the teacher."
                        : "Exam submitted and graded successfully.")
                .build();
    }

    // ==========================================
    // Private Helper Methods
    // ==========================================

    private ExamAttempt createNewAttempt(
            Exam exam,
            User user,
            String guestName,
            String guestIdentifier,
            HttpServletRequest request) {

        LocalDateTime startTime = LocalDateTime.now();
        LocalDateTime calculatedExpireAt = startTime.plusMinutes(exam.getDurationMinutes());

        // Cap expireAt with exam endTime if configured
        if (exam.getEndTime() != null && exam.getEndTime().isBefore(calculatedExpireAt)) {
            calculatedExpireAt = exam.getEndTime();
        }

        return ExamAttempt.builder()
                .exam(exam)
                .user(user)
                .guestName(guestName)
                .guestIdentifier(guestIdentifier)
                .startTime(startTime)
                .expireAt(calculatedExpireAt)
                .status(AttemptStatus.IN_PROGRESS)
                .ipAddress(extractIp(request))
                .userAgent(request != null ? request.getHeader("User-Agent") : null)
                .totalScore(0.0)
                .violationCount(0)
                .build();
    }

    /**
     * Build candidate-facing exam paper with data masking (strictly hides isCorrect, sampleAnswer, rubric).
     */
    private ExamPaperResponse buildMaskedPaper(ExamAttempt attempt, Exam exam) {
        List<Question> questions = questionRepository.findByExamIdWithOptions(exam.getId());

        // Question shuffling
        List<Question> processedQuestions = new ArrayList<>(questions);
        if (Boolean.TRUE.equals(exam.getShuffleQuestions())) {
            Collections.shuffle(processedQuestions);
        }

        List<QuestionInPaperDto> maskedQuestions = new ArrayList<>();
        int questionIndex = 1;

        for (Question q : processedQuestions) {
            List<OptionInPaperDto> maskedOptions = new ArrayList<>();

            if (q.getOptions() != null && !q.getOptions().isEmpty()) {
                List<AnswerOption> optionsCopy = new ArrayList<>(q.getOptions());
                if (Boolean.TRUE.equals(exam.getShuffleOptions())) {
                    Collections.shuffle(optionsCopy);
                }

                int optionIndex = 1;
                for (AnswerOption opt : optionsCopy) {
                    maskedOptions.add(OptionInPaperDto.builder()
                            .id(opt.getId())
                            .orderIndex(optionIndex++)
                            .content(opt.getContent())
                            .build());
                }
            }

            maskedQuestions.add(QuestionInPaperDto.builder()
                    .id(q.getId())
                    .orderIndex(questionIndex++)
                    .content(q.getContent())
                    .questionType(q.getQuestionType())
                    .points(q.getPoints())
                    .options(maskedOptions)
                    .build());
        }

        LocalDateTime now = LocalDateTime.now();
        long remainingSeconds = Math.max(0, Duration.between(now, attempt.getExpireAt()).getSeconds());

        String candidateName = attempt.getUser() != null ? attempt.getUser().getFullName() : attempt.getGuestName();
        String candidateIdentifier = attempt.getUser() != null ? attempt.getUser().getEmail() : attempt.getGuestIdentifier();

        return ExamPaperResponse.builder()
                .attemptId(attempt.getId())
                .examId(exam.getId())
                .examTitle(exam.getTitle())
                .examDescription(exam.getDescription())
                .durationMinutes(exam.getDurationMinutes())
                .totalQuestions(maskedQuestions.size())
                .startTime(attempt.getStartTime())
                .expireAt(attempt.getExpireAt())
                .serverTime(now)
                .remainingSeconds(remainingSeconds)
                .candidateName(candidateName)
                .candidateIdentifier(candidateIdentifier)
                .questions(maskedQuestions)
                .build();
    }

    private void verifyCandidateAccess(ExamAttempt attempt, User currentUser, String guestIdentifier) {
        if (attempt.getUser() != null) {
            if (currentUser == null || !attempt.getUser().getId().equals(currentUser.getId())) {
                throw new AccessDeniedException("You do not have permission to access this exam attempt");
            }
        } else {
            if (guestIdentifier != null && !guestIdentifier.trim().equalsIgnoreCase(attempt.getGuestIdentifier())) {
                throw new AccessDeniedException("Guest identifier does not match this exam attempt");
            }
        }
    }

    private boolean isExpired(ExamAttempt attempt) {
        return LocalDateTime.now().isAfter(attempt.getExpireAt());
    }

    private boolean isExpiredWithGrace(ExamAttempt attempt) {
        return LocalDateTime.now().isAfter(attempt.getExpireAt().plusSeconds(GRACE_PERIOD_SECONDS));
    }

    private String extractIp(HttpServletRequest request) {
        if (request == null) {
            return "UNKNOWN";
        }
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
