package com.quicktest.modules.admin.service;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.admin.dto.*;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
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
    public AdminUserSummaryResponse toggleUserStatus(UUID userId, UUID currentAdminId) {
        if (userId.equals(currentAdminId)) {
            throw new AppException("Administrators cannot toggle their own active status", HttpStatus.BAD_REQUEST);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (Boolean.TRUE.equals(user.getIsActive())) {
            user.deactivate();
            log.info("User {} (ID: {}) deactivated by admin ID: {}", user.getUsername(), userId, currentAdminId);
        } else {
            user.activate();
            log.info("User {} (ID: {}) activated by admin ID: {}", user.getUsername(), userId, currentAdminId);
        }

        User updatedUser = userRepository.save(user);
        return AdminUserSummaryResponse.fromEntity(updatedUser);
    }

    @Override
    @Transactional
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
        log.info("User {} (ID: {}) role updated to {} by admin ID: {}", user.getUsername(), userId, request.getRole(),
                currentAdminId);
        return AdminUserSummaryResponse.fromEntity(updatedUser);
    }

    // =========================================================================
    // Exam Governance
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
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
    public void forceCloseExam(UUID examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));

        if (exam.getStatus() == ExamStatus.CLOSED) {
            log.info("Exam ID: {} is already CLOSED", examId);
            return;
        }

        exam.setStatus(ExamStatus.CLOSED);
        examRepository.save(exam);
        log.info("Exam ID: {} force-closed by administrator", examId);
    }

    @Override
    @Transactional
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
        log.info("Exam ID: {} successfully deleted by administrator", examId);
    }

    // =========================================================================
    // Dashboard & Analytics
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public AdminDashboardResponse getDashboard() {
        // User metrics
        long totalUsers = userRepository.count();
        long totalTeachers = userRepository.countByRole(Role.TEACHER);
        long totalStudents = userRepository.countByRole(Role.STUDENT);
        long totalAdmins = userRepository.countByRole(Role.ADMIN);
        long activeUsers = userRepository.countByIsActive(true);
        long inactiveUsers = userRepository.countByIsActive(false);

        // Exam metrics
        long totalExams = examRepository.count();
        long draftExams = examRepository.countByStatus(ExamStatus.DRAFT);
        long publishedExams = examRepository.countByStatus(ExamStatus.PUBLISHED);
        long closedExams = examRepository.countByStatus(ExamStatus.CLOSED);
        long archivedExams = examRepository.countByStatus(ExamStatus.ARCHIVED);

        // Attempt metrics
        long totalAttempts = examAttemptRepository.count();
        long inProgressAttempts = examAttemptRepository.countByStatus(AttemptStatus.IN_PROGRESS);
        long submittedAttempts = examAttemptRepository.countByStatus(AttemptStatus.SUBMITTED);
        long awaitingGradingAttempts = examAttemptRepository.countByStatus(AttemptStatus.AWAITING_MANUAL_GRADING);
        long disqualifiedAttempts = examAttemptRepository.countByStatus(AttemptStatus.DISQUALIFIED);

        // Proctoring violation metrics
        long totalViolations = violationLogRepository.count();
        Pageable recentLimit = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "timestamp"));
        List<ViolationLog> recentLogs = violationLogRepository.findRecentViolations(recentLimit);

        List<RecentViolationResponse> recentViolations = recentLogs.stream()
                .map(RecentViolationResponse::fromEntity)
                .collect(Collectors.toList());

        return AdminDashboardResponse.builder()
                .totalUsers(totalUsers)
                .totalTeachers(totalTeachers)
                .totalStudents(totalStudents)
                .totalAdmins(totalAdmins)
                .activeUsers(activeUsers)
                .inactiveUsers(inactiveUsers)
                .totalExams(totalExams)
                .draftExams(draftExams)
                .publishedExams(publishedExams)
                .closedExams(closedExams)
                .archivedExams(archivedExams)
                .totalAttempts(totalAttempts)
                .inProgressAttempts(inProgressAttempts)
                .submittedAttempts(submittedAttempts)
                .awaitingGradingAttempts(awaitingGradingAttempts)
                .disqualifiedAttempts(disqualifiedAttempts)
                .totalViolations(totalViolations)
                .recentViolations(recentViolations)
                .build();
    }
}
