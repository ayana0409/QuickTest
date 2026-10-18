package com.quicktest.modules.session.service;

import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.dto.StudentAttemptDetailResponse;
import com.quicktest.modules.session.dto.StudentAttemptSummaryDto;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.session.dto.StudentDashboardResponse;
import com.quicktest.modules.session.dto.StudentExamCardDto;
import com.quicktest.modules.session.entity.AttemptStatus;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation managing student attempt history queries and detailed
 * reviews.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class StudentAttemptServiceImpl implements StudentAttemptService {

        private final ExamAttemptRepository examAttemptRepository;
        private final CandidateAnswerRepository candidateAnswerRepository;
        private final ViolationLogRepository violationLogRepository;
        private final ExamRepository examRepository;
        private final QuestionRepository questionRepository;

        @Override
        @Transactional(readOnly = true)
        public PageResponse<StudentAttemptSummaryDto> getStudentAttempts(UUID userId, Pageable pageable) {
                log.info("Fetching attempt history for student: {}, page: {}, size: {}",
                                userId, pageable.getPageNumber(), pageable.getPageSize());

                Page<StudentAttemptSummaryDto> pageResult = examAttemptRepository.findStudentAttemptSummaries(
                                userId,
                                PageRequest.of(pageable.getPageNumber(), pageable.getPageSize()));

                return PageResponse.from(pageResult);
        }

        @Override
        @Transactional(readOnly = true)
        public StudentAttemptDetailResponse getStudentAttemptDetail(UUID attemptId, UUID userId) {
                log.info("Fetching attempt detail for student: {}, attemptId: {}", userId, attemptId);

                ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

                // Ensure student can only view their own attempt
                if (attempt.getUser() == null || !attempt.getUser().getId().equals(userId)) {
                        throw new AppException("Access denied: You can only view your own exam attempts",
                                        HttpStatus.FORBIDDEN);
                }

                // Fetch candidate answers
                List<CandidateAnswer> candidateAnswers = candidateAnswerRepository
                                .findByExamAttemptIdWithQuestion(attemptId);

                // Fetch violation logs
                List<ViolationLog> violationLogs = violationLogRepository
                                .findByExamAttemptIdOrderByTimestampAsc(attemptId);

                List<StudentAttemptDetailResponse.ViolationItemDto> violationDtos = violationLogs.stream()
                                .map(vl -> StudentAttemptDetailResponse.ViolationItemDto.builder()
                                                .id(vl.getId())
                                                .violationType(vl.getViolationType())
                                                .description(vl.getDescription())
                                                .timestamp(vl.getTimestamp())
                                                .build())
                                .collect(Collectors.toList());

                Exam exam = attempt.getExam();
                boolean showResults = exam == null || exam.getShowResultsToStudents() == null
                                || exam.getShowResultsToStudents();

                // Calculate duration in seconds
                Long durationSeconds = null;
                if (attempt.getStartTime() != null && attempt.getSubmitTime() != null) {
                        durationSeconds = Duration.between(attempt.getStartTime(), attempt.getSubmitTime())
                                        .getSeconds();
                }

                // Build question details
                double maxTotalScore = 0.0;
                List<StudentAttemptDetailResponse.QuestionDetailDto> questionDtos = new ArrayList<>();

                for (CandidateAnswer ca : candidateAnswers) {
                        Question q = ca.getQuestion();
                        double points = q.getPoints() != null ? q.getPoints() : 1.0;
                        maxTotalScore += points;

                        Set<UUID> selectedIds = ca.getSelectedOptions() != null
                                        ? ca.getSelectedOptions().stream().map(AnswerOption::getId)
                                                        .collect(Collectors.toSet())
                                        : Collections.emptySet();

                        List<StudentAttemptDetailResponse.OptionDto> optionDtos = new ArrayList<>();
                        if (q.getOptions() != null) {
                                optionDtos = q.getOptions().stream()
                                                .sorted(Comparator.comparing(AnswerOption::getOrderIndex))
                                                .map(opt -> StudentAttemptDetailResponse.OptionDto.builder()
                                                                .id(opt.getId())
                                                                .content(opt.getContent())
                                                                .imageUrl(opt.getImageUrl())
                                                                .orderIndex(opt.getOrderIndex())
                                                                .isCorrect(showResults ? opt.getIsCorrect() : null)
                                                                .isSelected(selectedIds.contains(opt.getId()))
                                                                .build())
                                                .collect(Collectors.toList());
                        }

                        questionDtos.add(StudentAttemptDetailResponse.QuestionDetailDto.builder()
                                        .questionId(q.getId())
                                        .orderIndex(q.getOrderIndex())
                                        .content(q.getContent())
                                        .imageUrl(q.getImageUrl())
                                        .questionType(q.getQuestionType())
                                        .points(showResults ? points : null)
                                        .awardedScore(showResults ? ca.getAwardedScore() : null)
                                        .gradingStatus(showResults ? ca.getGradingStatus() : null)
                                        .textAnswer(ca.getTextAnswer())
                                        .sampleAnswer(showResults ? q.getSampleAnswer() : null)
                                        .teacherFeedback(showResults ? ca.getTeacherFeedback() : null)
                                        .selectedOptionIds(new ArrayList<>(selectedIds))
                                        .options(optionDtos)
                                        .build());
                }

                return StudentAttemptDetailResponse.builder()
                                .attemptId(attempt.getId())
                                .examId(exam != null ? exam.getId() : null)
                                .examTitle(exam != null ? exam.getTitle() : null)
                                .accessCode(exam != null ? exam.getAccessCode() : null)
                                .status(attempt.getStatus())
                                .awardedScore(showResults ? attempt.getTotalScore() : null)
                                .maxScore(showResults ? (maxTotalScore > 0 ? maxTotalScore : 10.0) : null)
                                .startTime(attempt.getStartTime())
                                .submitTime(attempt.getSubmitTime())
                                .durationSeconds(durationSeconds)
                                .violationCount(attempt.getViolationCount() != null ? attempt.getViolationCount()
                                                : violationDtos.size())
                                .violations(violationDtos)
                                .questions(questionDtos)
                                .showResultsToStudents(showResults)
                                .build();
        }

        @Override
        @Transactional(readOnly = true)
        public StudentDashboardResponse getStudentDashboard(UUID userId) {
                log.info("Fetching student dashboard for user: {}", userId);
                LocalDateTime now = LocalDateTime.now();

                // 1. Fetch all candidate attempts with parent exam and creator (ordered by
                // startTime DESC)
                List<ExamAttempt> userAttempts = examAttemptRepository.findByUserIdWithExamAndCreator(userId);

                // Group attempts by Exam ID preserving insertion order (most recently attempted
                // exam first)
                Map<UUID, List<ExamAttempt>> attemptsByExam = new LinkedHashMap<>();
                Map<UUID, Exam> examMap = new HashMap<>();

                for (ExamAttempt attempt : userAttempts) {
                        Exam exam = attempt.getExam();
                        if (exam != null) {
                                attemptsByExam.computeIfAbsent(exam.getId(), k -> new ArrayList<>()).add(attempt);
                                examMap.putIfAbsent(exam.getId(), exam);
                        }
                }

                // 2. Fetch question counts for all attempted exams in a single batch query
                List<UUID> attemptedExamIds = new ArrayList<>(examMap.keySet());
                Map<UUID, Long> questionCounts = new HashMap<>();
                if (!attemptedExamIds.isEmpty()) {
                        List<Object[]> countRows = questionRepository.countQuestionsByExamIds(attemptedExamIds);
                        for (Object[] row : countRows) {
                                if (row != null && row.length >= 2 && row[0] instanceof UUID
                                                && row[1] instanceof Number) {
                                        questionCounts.put((UUID) row[0], ((Number) row[1]).longValue());
                                }
                        }
                }

                // 3. Build card DTOs for exams the student has attempted
                List<StudentExamCardDto> myExams = new ArrayList<>();
                int activeSessionsCount = 0;
                int completedAttemptsCount = 0;
                double totalScoreSum = 0.0;
                int gradedAttemptsCount = 0;

                for (Map.Entry<UUID, List<ExamAttempt>> entry : attemptsByExam.entrySet()) {
                        UUID examId = entry.getKey();
                        Exam exam = examMap.get(examId);
                        List<ExamAttempt> examAttempts = entry.getValue();

                        int maxAttempts = exam.getMaxAttempts() != null ? exam.getMaxAttempts() : 1;
                        int attemptsUsed = examAttempts.size();
                        int remainingAttempts = Math.max(0, maxAttempts - attemptsUsed);

                        // Determine exam time window status
                        boolean isPublished = exam.getStatus() == ExamStatus.PUBLISHED;
                        boolean isEnded = exam.getEndTime() != null && now.isAfter(exam.getEndTime());
                        boolean isStarted = exam.getStartTime() == null || !now.isBefore(exam.getStartTime());

                        String timeStatus;
                        boolean isOpen;
                        if (!isPublished || isEnded) {
                                timeStatus = "CLOSED";
                                isOpen = false;
                        } else if (!isStarted) {
                                timeStatus = "UPCOMING";
                                isOpen = false;
                        } else {
                                timeStatus = "OPEN";
                                isOpen = true;
                        }

                        // Check if candidate currently has an active session (IN_PROGRESS and not
                        // expired)
                        ExamAttempt activeAttempt = null;
                        for (ExamAttempt ea : examAttempts) {
                                if (ea.getStatus() == AttemptStatus.IN_PROGRESS) {
                                        if (ea.getExpireAt() == null || ea.getExpireAt().isAfter(now)) {
                                                activeAttempt = ea;
                                                break;
                                        }
                                }
                        }

                        boolean hasActive = activeAttempt != null;
                        if (hasActive) {
                                activeSessionsCount++;
                        }

                        Long activeRemainingSeconds = null;
                        if (hasActive && activeAttempt.getExpireAt() != null) {
                                activeRemainingSeconds = Math.max(0,
                                                Duration.between(now, activeAttempt.getExpireAt()).getSeconds());
                        }

                        // Historical performance and scores across attempts
                        ExamAttempt latestAttempt = examAttempts.get(0); // Recent first
                        Double highestScore = null;
                        for (ExamAttempt ea : examAttempts) {
                                if (ea.getStatus() == AttemptStatus.SUBMITTED) {
                                        completedAttemptsCount++;
                                }
                                if (ea.getTotalScore() != null) {
                                        totalScoreSum += ea.getTotalScore();
                                        gradedAttemptsCount++;
                                        if (highestScore == null || ea.getTotalScore() > highestScore) {
                                                highestScore = ea.getTotalScore();
                                        }
                                }
                        }

                        String teacherName = exam.getCreatedBy() != null ? exam.getCreatedBy().getFullName() : null;
                        int qCount = questionCounts.getOrDefault(examId, 0L).intValue();

                        myExams.add(StudentExamCardDto.builder()
                                        .examId(exam.getId())
                                        .title(exam.getTitle())
                                        .accessCode(exam.getAccessCode())
                                        .description(exam.getDescription())
                                        .durationMinutes(exam.getDurationMinutes())
                                        .questionCount(qCount)
                                        .teacherName(teacherName)
                                        .examRawStatus(exam.getStatus())
                                        .examTimeStatus(timeStatus)
                                        .isOpen(isOpen)
                                        .startTime(exam.getStartTime())
                                        .endTime(exam.getEndTime())
                                        .maxAttempts(maxAttempts)
                                        .attemptsUsed(attemptsUsed)
                                        .remainingAttempts(remainingAttempts)
                                        .canTakeExam((isOpen && remainingAttempts > 0) || hasActive)
                                        .hasActiveSession(hasActive)
                                        .activeAttemptId(hasActive ? activeAttempt.getId() : null)
                                        .activeAttemptStartTime(hasActive ? activeAttempt.getStartTime() : null)
                                        .activeAttemptExpireAt(hasActive ? activeAttempt.getExpireAt() : null)
                                        .activeAttemptRemainingSeconds(activeRemainingSeconds)
                                        .latestAttemptId(latestAttempt.getId())
                                        .latestAttemptStatus(latestAttempt.getStatus())
                                        .latestScore(latestAttempt.getTotalScore())
                                        .highestScore(highestScore)
                                        .latestSubmittedAt(latestAttempt.getSubmitTime())
                                        .lastAttemptedAt(latestAttempt.getStartTime())
                                        .build());
                }

                // 4. Also fetch other open published exams the candidate has not attempted yet
                List<Exam> otherPublishedExams = examRepository.findOpenPublishedExams();
                List<StudentExamCardDto> availableExams = new ArrayList<>();
                List<UUID> otherExamIds = otherPublishedExams.stream()
                                .map(Exam::getId)
                                .filter(id -> !attemptsByExam.containsKey(id))
                                .collect(Collectors.toList());

                Map<UUID, Long> otherQuestionCounts = new HashMap<>();
                if (!otherExamIds.isEmpty()) {
                        List<Object[]> otherCounts = questionRepository.countQuestionsByExamIds(otherExamIds);
                        for (Object[] row : otherCounts) {
                                if (row != null && row.length >= 2 && row[0] instanceof UUID
                                                && row[1] instanceof Number) {
                                        otherQuestionCounts.put((UUID) row[0], ((Number) row[1]).longValue());
                                }
                        }
                }

                for (Exam exam : otherPublishedExams) {
                        if (attemptsByExam.containsKey(exam.getId())) {
                                continue; // Already in myExams
                        }

                        boolean isEnded = exam.getEndTime() != null && now.isAfter(exam.getEndTime());
                        boolean isStarted = exam.getStartTime() == null || !now.isBefore(exam.getStartTime());
                        String timeStatus = isEnded ? "CLOSED" : (!isStarted ? "UPCOMING" : "OPEN");
                        boolean isOpen = "OPEN".equals(timeStatus);

                        int maxAttempts = exam.getMaxAttempts() != null ? exam.getMaxAttempts() : 1;
                        String teacherName = exam.getCreatedBy() != null ? exam.getCreatedBy().getFullName() : null;
                        int qCount = otherQuestionCounts.getOrDefault(exam.getId(), 0L).intValue();

                        availableExams.add(StudentExamCardDto.builder()
                                        .examId(exam.getId())
                                        .title(exam.getTitle())
                                        .accessCode(exam.getAccessCode())
                                        .description(exam.getDescription())
                                        .durationMinutes(exam.getDurationMinutes())
                                        .questionCount(qCount)
                                        .teacherName(teacherName)
                                        .examRawStatus(exam.getStatus())
                                        .examTimeStatus(timeStatus)
                                        .isOpen(isOpen)
                                        .startTime(exam.getStartTime())
                                        .endTime(exam.getEndTime())
                                        .maxAttempts(maxAttempts)
                                        .attemptsUsed(0)
                                        .remainingAttempts(maxAttempts)
                                        .canTakeExam(isOpen)
                                        .hasActiveSession(false)
                                        .build());
                }

                // 5. Calculate summary metrics
                int openExamsCount = (int) myExams.stream().filter(StudentExamCardDto::getIsOpen).count();
                Double avgScore = gradedAttemptsCount > 0
                                ? Math.round((totalScoreSum / gradedAttemptsCount) * 100.0) / 100.0
                                : null;

                return StudentDashboardResponse.builder()
                                .totalExamsAttempted(myExams.size())
                                .openExamsCount(openExamsCount)
                                .activeSessionsCount(activeSessionsCount)
                                .completedAttemptsCount(completedAttemptsCount)
                                .averageScore(avgScore)
                                .myExams(myExams)
                                .availableExams(availableExams)
                                .build();
        }
}
