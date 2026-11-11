package com.quicktest.modules.session.service;

import com.quicktest.config.CacheConfig;
import com.quicktest.modules.admin.dto.RecentViolationResponse;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.dto.TeacherDashboardResponse;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static com.quicktest.core.util.NativeQueryResultUtils.*;

/**
 * Implementation of {@link TeacherDashboardService} aggregating teacher-scoped metrics
 * with single-scan SQL queries and Redis caching.
 */
@Service
@RequiredArgsConstructor
public class TeacherDashboardServiceImpl implements TeacherDashboardService {

    private static final int DASHBOARD_SERIES_DAYS = 7;
    private static final int PRIORITY_EXAM_LIMIT = 5;
    private static final int RECENT_VIOLATION_LIMIT = 5;
    private static final DateTimeFormatter DASHBOARD_DAY_LABEL = DateTimeFormatter.ofPattern("dd/MM");

    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final CandidateAnswerRepository candidateAnswerRepository;
    private final ViolationLogRepository violationLogRepository;

    @Override
    @Transactional(readOnly = true)
    @Cacheable(value = CacheConfig.CACHE_TEACHER_DASHBOARD, key = "#teacherId")
    public TeacherDashboardResponse getTeacherDashboard(UUID teacherId) {
        return computeDashboardMetrics(teacherId);
    }

    @Override
    @Transactional(readOnly = true)
    @CachePut(value = CacheConfig.CACHE_TEACHER_DASHBOARD, key = "#teacherId")
    public TeacherDashboardResponse refreshTeacherDashboard(UUID teacherId) {
        return computeDashboardMetrics(teacherId);
    }

    private TeacherDashboardResponse computeDashboardMetrics(UUID teacherId) {
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(DASHBOARD_SERIES_DAYS - 1L);
        LocalDateTime sinceStartOfWindow = startDate.atStartOfDay();

        Object[] examRow = unwrapSingleRow(examRepository.computeTeacherExamMetrics(teacherId));
        Object[] questionRow = unwrapSingleRow(questionRepository.computeTeacherQuestionMetrics(teacherId));
        Object[] attemptRow = unwrapSingleRow(examAttemptRepository.computeTeacherAttemptMetrics(teacherId));
        long pendingManualAnswers = candidateAnswerRepository.countPendingManualAnswersByTeacherId(teacherId);

        List<TeacherDashboardResponse.DailyActivityPoint> dailyActivities = buildDailyActivitySeries(
                teacherId, startDate, sinceStartOfWindow);

        List<TeacherDashboardResponse.TeacherExamOverviewItem> priorityExams = buildPriorityExamItems(teacherId);

        Pageable recentLimit = PageRequest.of(0, RECENT_VIOLATION_LIMIT);
        List<ViolationLog> recentLogs = violationLogRepository.findRecentViolationsByTeacherId(teacherId, recentLimit);
        List<RecentViolationResponse> recentViolations = recentLogs.stream()
                .map(RecentViolationResponse::fromEntity)
                .collect(Collectors.toCollection(ArrayList::new));

        double roundedAverageScore = roundTwoDecimals(toDouble(attemptRow, 5));

        return TeacherDashboardResponse.builder()
                .totalExams(toLong(examRow, 0))
                .draftExams(toLong(examRow, 1))
                .publishedExams(toLong(examRow, 2))
                .closedExams(toLong(examRow, 3))
                .totalQuestions(toLong(questionRow, 0))
                .singleChoiceQuestions(toLong(questionRow, 1))
                .multipleChoiceQuestions(toLong(questionRow, 2))
                .numericQuestions(toLong(questionRow, 3))
                .essayQuestions(toLong(questionRow, 4))
                .totalAttempts(toLong(attemptRow, 0))
                .inProgressAttempts(toLong(attemptRow, 1))
                .submittedAttempts(toLong(attemptRow, 2))
                .awaitingGradingAttempts(toLong(attemptRow, 3))
                .disqualifiedAttempts(toLong(attemptRow, 4))
                .pendingManualAnswers(pendingManualAnswers)
                .averageScore(roundedAverageScore)
                .totalViolations(toLong(attemptRow, 6))
                .dailyActivities(dailyActivities)
                .priorityExams(priorityExams)
                .recentViolations(recentViolations)
                .build();
    }

    private List<TeacherDashboardResponse.DailyActivityPoint> buildDailyActivitySeries(
            UUID teacherId, LocalDate startDate, LocalDateTime sinceStartOfWindow) {
        Map<LocalDate, long[]> attemptSeriesMap = new HashMap<>();
        for (Object[] row : examAttemptRepository.countTeacherDailyAttemptsSince(teacherId, sinceStartOfWindow)) {
            LocalDate date = toLocalDate(row[0]);
            if (date != null) {
                attemptSeriesMap.put(date, new long[]{toLong(row, 1), toLong(row, 2)});
            }
        }

        Map<LocalDate, Long> violationSeriesMap = new HashMap<>();
        for (Object[] row : violationLogRepository.countTeacherDailyViolationsSince(teacherId, sinceStartOfWindow)) {
            LocalDate date = toLocalDate(row[0]);
            if (date != null) {
                violationSeriesMap.put(date, toLong(row, 1));
            }
        }

        List<TeacherDashboardResponse.DailyActivityPoint> series = new ArrayList<>(DASHBOARD_SERIES_DAYS);
        for (int i = 0; i < DASHBOARD_SERIES_DAYS; i++) {
            LocalDate day = startDate.plusDays(i);
            long[] dayAttempts = attemptSeriesMap.getOrDefault(day, new long[]{0L, 0L});
            long dayViolations = violationSeriesMap.getOrDefault(day, 0L);

            series.add(TeacherDashboardResponse.DailyActivityPoint.builder()
                    .date(day.toString())
                    .label(day.format(DASHBOARD_DAY_LABEL))
                    .attemptsCount(dayAttempts[0])
                    .submittedCount(dayAttempts[1])
                    .violationsCount(dayViolations)
                    .build());
        }
        return series;
    }

    private List<TeacherDashboardResponse.TeacherExamOverviewItem> buildPriorityExamItems(UUID teacherId) {
        List<Object[]> rawRows = examRepository.findTeacherPriorityExams(teacherId);
        List<TeacherDashboardResponse.TeacherExamOverviewItem> items = new ArrayList<>(
                Math.min(rawRows.size(), PRIORITY_EXAM_LIMIT));

        for (Object[] row : rawRows) {
            if (items.size() >= PRIORITY_EXAM_LIMIT) {
                break;
            }
            items.add(TeacherDashboardResponse.TeacherExamOverviewItem.builder()
                    .id(toUuid(row[0]))
                    .title(toStringValue(row, 1))
                    .accessCode(toStringValue(row, 2))
                    .status(toStringValue(row, 3))
                    .durationMinutes(toInt(row, 4))
                    .createdAt(toLocalDateTime(row[5]))
                    .totalAttempts(toLong(row, 6))
                    .inProgressCount(toLong(row, 7))
                    .submittedCount(toLong(row, 8))
                    .pendingGradingCount(toLong(row, 9))
                    .averageScore(roundTwoDecimals(toDouble(row, 10)))
                    .build());
        }
        return items;
    }

    private double roundTwoDecimals(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}

