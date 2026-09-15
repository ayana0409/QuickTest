package com.quicktest.modules.session.service;

import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.dto.*;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.entity.GradingStatus;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service implementation handling teacher manual grading operations for candidate essay submissions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class TeacherGradingServiceImpl implements TeacherGradingService {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final CandidateAnswerRepository candidateAnswerRepository;
    private final RedisExamSessionService redisExamSessionService;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<AttemptSummaryResponse> getAttemptsToGrade(
            UUID examId,
            AttemptStatus status,
            String search,
            Pageable pageable,
            User currentTeacher) {

        log.debug("Retrieving attempts to grade for examId: {}, status: {}, teacherId: {}",
                examId, status, currentTeacher.getId());

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));

        verifyExamOwnership(exam, currentTeacher);

        Page<ExamAttempt> attemptsPage;
        boolean hasKeyword = search != null && !search.isBlank();

        if (hasKeyword) {
            String pattern = "%" + search.trim().toLowerCase() + "%";
            if (status != null) {
                attemptsPage = examAttemptRepository.searchAttemptsByExamIdAndStatus(examId, status, pattern, pageable);
            } else {
                attemptsPage = examAttemptRepository.searchAttemptsByExamId(examId, pattern, pageable);
            }
        } else {
            if (status != null) {
                attemptsPage = examAttemptRepository.findByExamIdAndStatus(examId, status, pageable);
            } else {
                attemptsPage = examAttemptRepository.findByExamId(examId, pageable);
            }
        }

        Page<AttemptSummaryResponse> responsePage = attemptsPage.map(ea -> {
            String candidateName = resolveCandidateName(ea);
            String candidateIdentifier = resolveCandidateIdentifier(ea);

            long pendingEssayCount = candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(
                    ea.getId(), GradingStatus.PENDING_MANUAL);

            long totalQuestions = ea.getExam().getQuestions() != null
                    ? ea.getExam().getQuestions().size()
                    : 0;

            return AttemptSummaryResponse.builder()
                    .attemptId(ea.getId())
                    .examId(exam.getId())
                    .candidateName(candidateName)
                    .candidateIdentifier(candidateIdentifier)
                    .status(ea.getStatus())
                    .totalScore(ea.getTotalScore())
                    .startTime(ea.getStartTime())
                    .submitTime(ea.getSubmitTime())
                    .totalQuestions(totalQuestions)
                    .pendingEssayCount(pendingEssayCount)
                    .hasPendingEssay(pendingEssayCount > 0)
                    .violationCount(ea.getViolationCount() != null ? ea.getViolationCount() : 0)
                    .build();
        });

        return PageResponse.from(responsePage);
    }

    @Override
    @Transactional(readOnly = true)
    public AttemptGradingDetailResponse getAttemptDetailForGrading(UUID attemptId, User currentTeacher) {
        log.debug("Fetching grading details for attemptId: {}, teacherId: {}", attemptId, currentTeacher.getId());

        ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyExamOwnership(attempt.getExam(), currentTeacher);

        List<CandidateAnswer> answers = candidateAnswerRepository.findByExamAttemptIdWithQuestion(attemptId);

        List<EssayGradingItemDto> essayQuestions = new ArrayList<>();
        List<AutoGradedItemDto> autoGradedQuestions = new ArrayList<>();

        double autoGradedScore = 0.0;
        double maxTotalPoints = 0.0;

        for (CandidateAnswer ca : answers) {
            Question q = ca.getQuestion();
            double points = q.getPoints() != null ? q.getPoints() : 0.0;
            maxTotalPoints += points;

            if (q.getQuestionType() == QuestionType.ESSAY_TEXT) {
                essayQuestions.add(EssayGradingItemDto.builder()
                        .candidateAnswerId(ca.getId())
                        .questionId(q.getId())
                        .orderIndex(q.getOrderIndex())
                        .content(q.getContent())
                        .points(points)
                        .textAnswer(ca.getTextAnswer())
                        .sampleAnswer(q.getSampleAnswer())
                        .gradingRubric(q.getGradingRubric())
                        .awardedScore(ca.getAwardedScore())
                        .gradingStatus(ca.getGradingStatus())
                        .teacherFeedback(ca.getTeacherFeedback())
                        .build());
            } else {
                double awarded = ca.getAwardedScore() != null ? ca.getAwardedScore() : 0.0;
                autoGradedScore += awarded;

                autoGradedQuestions.add(AutoGradedItemDto.builder()
                        .questionId(q.getId())
                        .orderIndex(q.getOrderIndex())
                        .content(q.getContent())
                        .questionType(q.getQuestionType())
                        .points(points)
                        .awardedScore(ca.getAwardedScore())
                        .gradingStatus(ca.getGradingStatus())
                        .build());
            }
        }

        return AttemptGradingDetailResponse.builder()
                .attemptId(attempt.getId())
                .examId(attempt.getExam().getId())
                .examTitle(attempt.getExam().getTitle())
                .candidateName(resolveCandidateName(attempt))
                .candidateIdentifier(resolveCandidateIdentifier(attempt))
                .status(attempt.getStatus())
                .currentTotalScore(attempt.getTotalScore())
                .autoGradedScore(autoGradedScore)
                .maxTotalPoints(maxTotalPoints)
                .startTime(attempt.getStartTime())
                .submitTime(attempt.getSubmitTime())
                .violationCount(attempt.getViolationCount() != null ? attempt.getViolationCount() : 0)
                .essayQuestions(essayQuestions)
                .autoGradedQuestions(autoGradedQuestions)
                .build();
    }

    @Override
    @Transactional
    public GradingResultResponse submitEssayGrades(GradeEssaySubmissionRequest request, User currentTeacher) {
        UUID attemptId = request.getAttemptId();
        log.info("Teacher {} submitting manual grades for attemptId: {}", currentTeacher.getId(), attemptId);

        ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        verifyExamOwnership(attempt.getExam(), currentTeacher);

        if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
            throw new AppException("Cannot grade an exam attempt that is still in progress", HttpStatus.BAD_REQUEST);
        }

        for (GradeEssayItemRequest item : request.getGrades()) {
            CandidateAnswer ans = candidateAnswerRepository.findById(item.getCandidateAnswerId())
                    .orElseThrow(() -> new ResourceNotFoundException("CandidateAnswer", "id", item.getCandidateAnswerId()));

            if (!ans.getExamAttempt().getId().equals(attemptId)) {
                throw new AppException("Candidate answer does not belong to attempt ID: " + attemptId, HttpStatus.BAD_REQUEST);
            }

            Question question = ans.getQuestion();
            if (question.getQuestionType() != QuestionType.ESSAY_TEXT) {
                throw new AppException("Only essay questions can be manually graded", HttpStatus.BAD_REQUEST);
            }

            double awarded = item.getAwardedScore();
            double maxPoints = question.getPoints() != null ? question.getPoints() : 0.0;

            if (awarded < 0.0 || awarded > maxPoints) {
                throw new IllegalArgumentException(String.format(
                        "Awarded score (%.2f) must be between 0.0 and %.2f for question '%s'",
                        awarded, maxPoints, question.getContent()));
            }

            ans.setAwardedScore(awarded);
            ans.setTeacherFeedback(item.getTeacherFeedback() != null ? item.getTeacherFeedback().trim() : null);
            ans.setGradingStatus(GradingStatus.GRADED);
            candidateAnswerRepository.save(ans);
        }

        // Check if there are any remaining pending essay questions for this attempt
        long remainingPending = candidateAnswerRepository.countByExamAttemptIdAndGradingStatus(
                attemptId, GradingStatus.PENDING_MANUAL);

        Double totalScore = candidateAnswerRepository.sumAwardedScoreByAttemptId(attemptId);

        if (remainingPending == 0) {
            attempt.setStatus(AttemptStatus.SUBMITTED);
            attempt.setTotalScore(totalScore);
            log.info("All essays graded for attemptId: {}. Final status SUBMITTED, totalScore: {}",
                    attemptId, totalScore);
        } else {
            attempt.setStatus(AttemptStatus.AWAITING_MANUAL_GRADING);
            attempt.setTotalScore(null);
            log.info("Partially graded attemptId: {}. Remaining pending essays: {}", attemptId, remainingPending);
        }

        examAttemptRepository.save(attempt);

        // Synchronize updated result with Redis Cache
        SubmitResultResponse cachedResult = SubmitResultResponse.builder()
                .attemptId(attempt.getId())
                .examTitle(attempt.getExam().getTitle())
                .status(attempt.getStatus())
                .totalScore(attempt.getTotalScore())
                .submitTime(attempt.getSubmitTime())
                .message(remainingPending == 0
                        ? "Exam submitted and graded successfully."
                        : "Exam submitted successfully. Essay questions are awaiting manual grading by the teacher.")
                .build();
        redisExamSessionService.cacheSubmissionResult(attempt.getId(), cachedResult, 86400L);

        return GradingResultResponse.builder()
                .attemptId(attempt.getId())
                .status(attempt.getStatus())
                .totalScore(remainingPending == 0 ? totalScore : null)
                .remainingPendingEssays(remainingPending)
                .message(remainingPending == 0
                        ? "All essay questions graded successfully. Exam score finalized."
                        : String.format("Grades saved. %d essay question(s) still pending manual grading.", remainingPending))
                .build();
    }

    private void verifyExamOwnership(Exam exam, User currentTeacher) {
        if (exam.getCreatedBy() == null || currentTeacher == null
                || !exam.getCreatedBy().getId().equals(currentTeacher.getId())) {
            throw new AccessDeniedException("You are not authorized to view or grade submissions for this exam");
        }
    }

    private String resolveCandidateName(ExamAttempt ea) {
        if (ea.getUser() != null && ea.getUser().getFullName() != null) {
            return ea.getUser().getFullName();
        }
        if (ea.getGuestName() != null && !ea.getGuestName().isBlank()) {
            return ea.getGuestName().trim();
        }
        return "Anonymous Candidate";
    }

    private String resolveCandidateIdentifier(ExamAttempt ea) {
        if (ea.getUser() != null && ea.getUser().getEmail() != null) {
            return ea.getUser().getEmail();
        }
        if (ea.getGuestIdentifier() != null && !ea.getGuestIdentifier().isBlank()) {
            return ea.getGuestIdentifier().trim();
        }
        return null;
    }
}
