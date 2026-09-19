package com.quicktest.modules.session.service;

import com.quicktest.core.common.PageResponse;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.assessment.entity.AnswerOption;
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

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation managing student attempt history queries and detailed reviews.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class StudentAttemptServiceImpl implements StudentAttemptService {

    private final ExamAttemptRepository examAttemptRepository;
    private final CandidateAnswerRepository candidateAnswerRepository;
    private final ViolationLogRepository violationLogRepository;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<StudentAttemptSummaryDto> getStudentAttempts(UUID userId, Pageable pageable) {
        log.info("Fetching attempt history for student: {}, page: {}, size: {}",
                userId, pageable.getPageNumber(), pageable.getPageSize());

        Page<StudentAttemptSummaryDto> pageResult = examAttemptRepository.findStudentAttemptSummaries(
                userId,
                PageRequest.of(pageable.getPageNumber(), pageable.getPageSize())
        );

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
            throw new AppException("Access denied: You can only view your own exam attempts", HttpStatus.FORBIDDEN);
        }

        // Fetch candidate answers
        List<CandidateAnswer> candidateAnswers = candidateAnswerRepository.findByExamAttemptIdWithQuestion(attemptId);

        // Fetch violation logs
        List<ViolationLog> violationLogs = violationLogRepository.findByExamAttemptIdOrderByTimestampAsc(attemptId);

        List<StudentAttemptDetailResponse.ViolationItemDto> violationDtos = violationLogs.stream()
                .map(vl -> StudentAttemptDetailResponse.ViolationItemDto.builder()
                        .id(vl.getId())
                        .violationType(vl.getViolationType())
                        .description(vl.getDescription())
                        .timestamp(vl.getTimestamp())
                        .build())
                .collect(Collectors.toList());

        // Calculate duration in seconds
        Long durationSeconds = null;
        if (attempt.getStartTime() != null && attempt.getSubmitTime() != null) {
            durationSeconds = Duration.between(attempt.getStartTime(), attempt.getSubmitTime()).getSeconds();
        }

        // Build question details
        double maxTotalScore = 0.0;
        List<StudentAttemptDetailResponse.QuestionDetailDto> questionDtos = new ArrayList<>();

        for (CandidateAnswer ca : candidateAnswers) {
            Question q = ca.getQuestion();
            double points = q.getPoints() != null ? q.getPoints() : 1.0;
            maxTotalScore += points;

            Set<UUID> selectedIds = ca.getSelectedOptions() != null
                    ? ca.getSelectedOptions().stream().map(AnswerOption::getId).collect(Collectors.toSet())
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
                                .isCorrect(opt.getIsCorrect())
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
                    .points(points)
                    .awardedScore(ca.getAwardedScore())
                    .gradingStatus(ca.getGradingStatus())
                    .textAnswer(ca.getTextAnswer())
                    .sampleAnswer(q.getSampleAnswer())
                    .teacherFeedback(ca.getTeacherFeedback())
                    .selectedOptionIds(new ArrayList<>(selectedIds))
                    .options(optionDtos)
                    .build());
        }

        return StudentAttemptDetailResponse.builder()
                .attemptId(attempt.getId())
                .examId(attempt.getExam().getId())
                .examTitle(attempt.getExam().getTitle())
                .accessCode(attempt.getExam().getAccessCode())
                .status(attempt.getStatus())
                .awardedScore(attempt.getTotalScore())
                .maxScore(maxTotalScore > 0 ? maxTotalScore : 10.0)
                .startTime(attempt.getStartTime())
                .submitTime(attempt.getSubmitTime())
                .durationSeconds(durationSeconds)
                .violationCount(attempt.getViolationCount() != null ? attempt.getViolationCount() : violationDtos.size())
                .violations(violationDtos)
                .questions(questionDtos)
                .build();
    }
}
