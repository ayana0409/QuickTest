package com.quicktest.modules.admin.service;

import com.quicktest.config.CacheConfig;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.exception.UserAlreadyExistsException;
import com.quicktest.core.logging.AuditLog;
import com.quicktest.modules.admin.dto.*;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.AuthProvider;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import com.quicktest.modules.session.service.ExamSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CachePut;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Implementation of administrative operations for user governance,
 * exam lifecycle control, and system dashboard analytics.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminServiceImpl implements AdminService {

    private final UserRepository userRepository;
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final ViolationLogRepository violationLogRepository;
    private final ExamSessionService examSessionService;
    private final PasswordEncoder passwordEncoder;

    // =========================================================================
    // User Governance
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public Page<AdminUserSummaryResponse> listUsers(Role role, Boolean isActive, String keyword, Pageable pageable) {
        Page<User> users;
        boolean hasKeyword = keyword != null && !keyword.isBlank();

        if (hasKeyword) {
            String pattern = "%" + keyword.trim().toLowerCase() + "%";
            users = userRepository.searchUsers(role, isActive, pattern, pageable);
        } else {
            if (role != null && isActive != null) {
                users = userRepository.findByRoleAndIsActive(role, isActive, pageable);
            } else if (role != null) {
                users = userRepository.findByRole(role, pageable);
            } else if (isActive != null) {
                users = userRepository.findByIsActive(isActive, pageable);
            } else {
                users = userRepository.findAll(pageable);
            }
        }

        return users.map(AdminUserSummaryResponse::fromEntity);
    }

    @Override
    @Transactional(readOnly = true)
    public AdminUserSummaryResponse getUserDetail(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        return AdminUserSummaryResponse.fromEntity(user);
    }

    @Override
    @Transactional
    // Evict dashboard cache: user count metrics change after a new user is created
    @CacheEvict(value = CacheConfig.CACHE_ADMIN_DASHBOARD, key = "'global'")
    @AuditLog(module = "ADMIN", action = "CREATE_USER")
    public AdminUserSummaryResponse createUser(AdminCreateUserRequest request) {
        String username = request.getUsername().trim();
        String email = request.getEmail().trim().toLowerCase();

        if (userRepository.existsByUsername(username)) {
            throw new UserAlreadyExistsException("Username '" + username + "' is already taken");
        }
        if (userRepository.existsByEmail(email)) {
            throw new UserAlreadyExistsException("Email '" + email + "' is already registered");
        }

        String encodedPassword = passwordEncoder.encode(request.getPassword());
        User newUser = User.createLocalUser(
                username,
                email,
                encodedPassword,
                request.getFullName().trim(),
                request.getRole()
        );

        User savedUser = userRepository.save(newUser);
        return AdminUserSummaryResponse.fromEntity(savedUser);
    }

    @Override
    @Transactional
    @AuditLog(module = "ADMIN", action = "UPDATE_USER_PROFILE")
    public AdminUserSummaryResponse updateUserProfile(UUID userId, AdminUpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        // Update fullName
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }

        // Update username if provided and changed
        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            String newUsername = request.getUsername().trim();
            if (!newUsername.equalsIgnoreCase(user.getUsername())) {
                if (userRepository.existsByUsernameAndIdNot(newUsername, userId)) {
                    throw new UserAlreadyExistsException("Username '" + newUsername + "' is already taken");
                }
                user.setUsername(newUsername);
            }
        }

        // Update email if provided and changed
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String newEmail = request.getEmail().trim().toLowerCase();
            if (!newEmail.equalsIgnoreCase(user.getEmail())) {
                if (userRepository.existsByEmailAndIdNot(newEmail, userId)) {
                    throw new UserAlreadyExistsException("Email '" + newEmail + "' is already registered");
                }
                user.setEmail(newEmail);
            }
        }

        User updatedUser = userRepository.save(user);
        return AdminUserSummaryResponse.fromEntity(updatedUser);
    }

    @Override
    @Transactional
    @AuditLog(module = "ADMIN", action = "RESET_USER_PASSWORD")
    public void resetUserPassword(UUID userId, AdminResetPasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (user.getAuthProvider() != null && user.getAuthProvider() != AuthProvider.LOCAL) {
            throw new AppException("Cannot reset password for external/SSO authenticated users", HttpStatus.BAD_REQUEST);
        }

        user.updatePassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }


    @Override
    @Transactional
    // Evict dashboard cache: activeUsers / inactiveUsers counters change
    @CacheEvict(value = CacheConfig.CACHE_ADMIN_DASHBOARD, key = "'global'")
    @AuditLog(module = "ADMIN", action = "TOGGLE_USER_STATUS")
    public AdminUserSummaryResponse toggleUserStatus(UUID userId, UUID currentAdminId) {
        if (userId.equals(currentAdminId)) {
            throw new AppException("Administrators cannot toggle their own active status", HttpStatus.BAD_REQUEST);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (Boolean.TRUE.equals(user.getIsActive())) {
            user.deactivate();
        } else {
            user.activate();
        }

        User updatedUser = userRepository.save(user);
        return AdminUserSummaryResponse.fromEntity(updatedUser);
    }

    @Override
    @Transactional
    // Evict dashboard cache: role-based counts (totalTeachers / totalStudents / totalAdmins) change
    @CacheEvict(value = CacheConfig.CACHE_ADMIN_DASHBOARD, key = "'global'")
    @AuditLog(module = "ADMIN", action = "UPDATE_USER_ROLE")
    public AdminUserSummaryResponse updateUserRole(UUID userId, UpdateUserRoleRequest request, UUID currentAdminId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        // Prevent self-demotion from ADMIN
        if (userId.equals(currentAdminId) && request.getRole() != Role.ADMIN) {
            throw new AppException("Administrators cannot remove their own ADMIN role", HttpStatus.BAD_REQUEST);
        }

        // Prevent removing the last remaining admin
        if (user.getRole() == Role.ADMIN && request.getRole() != Role.ADMIN) {
            long adminCount = userRepository.countByRole(Role.ADMIN);
            if (adminCount <= 1) {
                throw new AppException("Cannot demote the last remaining administrator", HttpStatus.BAD_REQUEST);
            }
        }

        user.setRole(request.getRole());
        User updatedUser = userRepository.save(user);
        return AdminUserSummaryResponse.fromEntity(updatedUser);
    }

    // =========================================================================
    // Exam Governance
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    // Cache exam list: pagination + 2 extra batch queries (attemptCounts, questionCounts)
    @Cacheable(
            value = CacheConfig.CACHE_ADMIN_EXAMS,
            key = "(#status != null ? #status.name() : 'ALL') + ':' + (#keyword != null ? #keyword.trim() : '') + ':' + #pageable.pageNumber + ':' + #pageable.pageSize"
    )
    public Page<AdminExamSummaryResponse> listExams(ExamStatus status, String keyword, Pageable pageable) {
        Page<Exam> exams;
        boolean hasKeyword = keyword != null && !keyword.isBlank();

        if (hasKeyword) {
            String pattern = "%" + keyword.trim().toLowerCase() + "%";
            exams = examRepository.searchExams(status, pattern, pageable);
        } else {
            if (status != null) {
                exams = examRepository.findAllByStatusWithCreatedBy(status, pageable);
            } else {
                exams = examRepository.findAllWithCreatedBy(pageable);
            }
        }

        List<UUID> examIds = exams.getContent().stream().map(Exam::getId).toList();
        Map<UUID, Long> attemptCountMap = new HashMap<>();
        Map<UUID, Long> questionCountMap = new HashMap<>();

        if (!examIds.isEmpty()) {
            examAttemptRepository.countAttemptsByExamIds(examIds)
                    .forEach(row -> attemptCountMap.put((UUID) row[0], (Long) row[1]));
            questionRepository.countQuestionsByExamIds(examIds)
                    .forEach(row -> questionCountMap.put((UUID) row[0], (Long) row[1]));
        }

        return exams.map(exam -> {
            long totalAttempts = attemptCountMap.getOrDefault(exam.getId(), 0L);
            int totalQuestions = questionCountMap.getOrDefault(exam.getId(), 0L).intValue();
            return AdminExamSummaryResponse.fromEntity(exam, totalAttempts, totalQuestions);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public ExamDetailResponse getExamDetail(UUID examId) {
        Exam exam = examRepository.findByIdWithCreatedBy(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));
        return ExamDetailResponse.fromEntity(exam);
    }

    @Override
    @Transactional
    // Evict both dashboard (publishedExams/closedExams change) and exam list cache
    @Caching(evict = {
            @CacheEvict(value = CacheConfig.CACHE_ADMIN_DASHBOARD, key = "'global'"),
            @CacheEvict(value = CacheConfig.CACHE_ADMIN_EXAMS, allEntries = true)
    })
    @AuditLog(module = "ADMIN", action = "FORCE_CLOSE_EXAM")
    public void forceCloseExam(UUID examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));

        if (exam.getStatus() == ExamStatus.CLOSED) {
            return;
        }

        exam.setStatus(ExamStatus.CLOSED);
        examRepository.save(exam);

        // Automatically collect and submit all active in-progress attempts for this force-closed exam
        examSessionService.autoSubmitActiveAttemptsForExam(examId, "Exam force-closed by administrator");
    }

    @Override
    @Transactional
    // Evict dashboard (totalExams changes) and exam list cache
    @Caching(evict = {
            @CacheEvict(value = CacheConfig.CACHE_ADMIN_DASHBOARD, key = "'global'"),
            @CacheEvict(value = CacheConfig.CACHE_ADMIN_EXAMS, allEntries = true)
    })
    @AuditLog(module = "ADMIN", action = "DELETE_EXAM")
    public void deleteExam(UUID examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));

        if (exam.getStatus() == ExamStatus.PUBLISHED) {
            throw new AppException("Cannot delete a PUBLISHED exam. Please force-close it first.",
                    HttpStatus.BAD_REQUEST);
        }

        long attemptCount = examAttemptRepository.countByExamId(examId);
        if (attemptCount > 0) {
            throw new AppException(
                    "Cannot delete exam with " + attemptCount
                            + " existing candidate attempts. Delete or archive attempts first.",
                    HttpStatus.BAD_REQUEST);
        }

        examRepository.delete(exam);
    }

    // =========================================================================
    // Dashboard & Analytics
    // =========================================================================

    private static final DateTimeFormatter DASHBOARD_DAY_LABEL = DateTimeFormatter.ofPattern("dd/MM");
    private static final int DASHBOARD_SERIES_DAYS = 7;

    @Override
    @Transactional(readOnly = true)
    @Cacheable(value = CacheConfig.CACHE_ADMIN_DASHBOARD, key = "'global'")
    public AdminDashboardResponse getDashboard() {
        return computeDashboardMetrics();
    }

    @Override
    @Transactional(readOnly = true)
    @CachePut(value = CacheConfig.CACHE_ADMIN_DASHBOARD, key = "'global'")
    public AdminDashboardResponse refreshDashboard() {
        return computeDashboardMetrics();
    }

    /**
     * Build the system-wide dashboard snapshot using single-scan aggregate queries
     * across each table rather than separate per-status COUNT queries.
     */
    private AdminDashboardResponse computeDashboardMetrics() {
        LocalDate today = LocalDate.now();
        LocalDate startDate = today.minusDays(DASHBOARD_SERIES_DAYS - 1L);
        LocalDateTime sinceStartOfWindow = startDate.atStartOfDay();

        Object[] userRow = unwrapSingleRow(userRepository.computeUserDashboardMetrics(sinceStartOfWindow));
        Object[] examRow = unwrapSingleRow(examRepository.computeExamDashboardMetrics());
        Object[] questionRow = unwrapSingleRow(questionRepository.computeQuestionModerationSummary());
        Object[] attemptRow = unwrapSingleRow(examAttemptRepository.computeGlobalAttemptMetrics());

        Map<LocalDate, long[]> attemptSeriesMap = new HashMap<>();
        for (Object[] row : examAttemptRepository.countDailyAttemptsSince(sinceStartOfWindow)) {
            LocalDate date = toLocalDate(row[0]);
            if (date != null) {
                attemptSeriesMap.put(date, new long[]{toLong(row, 1), toLong(row, 2)});
            }
        }

        Map<LocalDate, Long> violationSeriesMap = new HashMap<>();
        for (Object[] row : violationLogRepository.countDailyViolationsSince(sinceStartOfWindow)) {
            LocalDate date = toLocalDate(row[0]);
            if (date != null) {
                violationSeriesMap.put(date, toLong(row, 1));
            }
        }

        List<AdminDashboardResponse.DailyActivityPoint> dailyActivities = new ArrayList<>(DASHBOARD_SERIES_DAYS);
        for (int i = 0; i < DASHBOARD_SERIES_DAYS; i++) {
            LocalDate day = startDate.plusDays(i);
            long[] dayAttempts = attemptSeriesMap.getOrDefault(day, new long[]{0L, 0L});
            long dayViolations = violationSeriesMap.getOrDefault(day, 0L);

            dailyActivities.add(AdminDashboardResponse.DailyActivityPoint.builder()
                    .date(day.toString())
                    .label(day.format(DASHBOARD_DAY_LABEL))
                    .attemptsCount(dayAttempts[0])
                    .submittedCount(dayAttempts[1])
                    .violationsCount(dayViolations)
                    .build());
        }

        Map<String, Long> violationByTypes = new LinkedHashMap<>();
        long totalViolations = 0L;
        for (Object[] row : violationLogRepository.countAllGroupedByViolationType()) {
            String key = row[0] != null ? row[0].toString() : "OTHER";
            long count = toLong(row, 1);
            violationByTypes.merge(key, count, Long::sum);
            totalViolations += count;
        }

        Pageable recentLimit = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "timestamp"));
        List<ViolationLog> recentLogs = violationLogRepository.findRecentViolations(recentLimit);
        List<RecentViolationResponse> recentViolations = recentLogs.stream()
                .map(RecentViolationResponse::fromEntity)
                .collect(Collectors.toCollection(ArrayList::new));

        double rawAverageScore = toDouble(attemptRow, 5);
        double roundedAverageScore = Math.round(rawAverageScore * 100.0) / 100.0;

        return AdminDashboardResponse.builder()
                .totalUsers(toLong(userRow, 0))
                .totalTeachers(toLong(userRow, 1))
                .totalStudents(toLong(userRow, 2))
                .totalAdmins(toLong(userRow, 3))
                .activeUsers(toLong(userRow, 4))
                .inactiveUsers(toLong(userRow, 5))
                .newUsersLast7Days(toLong(userRow, 6))
                .totalExams(toLong(examRow, 0))
                .draftExams(toLong(examRow, 1))
                .publishedExams(toLong(examRow, 2))
                .closedExams(toLong(examRow, 3))
                .archivedExams(toLong(examRow, 4))
                .totalQuestions(toLong(questionRow, 0))
                .safeQuestions(toLong(questionRow, 1))
                .unsafeQuestions(toLong(questionRow, 2))
                .unreviewedQuestions(toLong(questionRow, 3))
                .totalAttempts(toLong(attemptRow, 0))
                .inProgressAttempts(toLong(attemptRow, 1))
                .submittedAttempts(toLong(attemptRow, 2))
                .awaitingGradingAttempts(toLong(attemptRow, 3))
                .disqualifiedAttempts(toLong(attemptRow, 4))
                .averageScore(roundedAverageScore)
                .dailyActivities(dailyActivities)
                .violationByTypes(violationByTypes)
                .totalViolations(totalViolations)
                .recentViolations(recentViolations)
                .build();
    }

    private Object[] unwrapSingleRow(Object[] raw) {
        if (raw == null || raw.length == 0) {
            return new Object[0];
        }
        // Hibernate may wrap a single multi-column native aggregate row inside a 1-element Object[]
        if (raw.length == 1 && raw[0] instanceof Object[] nested) {
            return nested;
        }
        return raw;
    }

    private long toLong(Object[] row, int index) {
        if (row == null || index >= row.length || row[index] == null) {
            return 0L;
        }
        return ((Number) row[index]).longValue();
    }

    private double toDouble(Object[] row, int index) {
        if (row == null || index >= row.length || row[index] == null) {
            return 0.0;
        }
        return ((Number) row[index]).doubleValue();
    }

    private LocalDate toLocalDate(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        String text = value.toString();
        return text.length() >= 10 ? LocalDate.parse(text.substring(0, 10)) : null;
    }
}
