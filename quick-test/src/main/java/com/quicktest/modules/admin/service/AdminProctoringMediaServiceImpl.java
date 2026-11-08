package com.quicktest.modules.admin.service;

import com.quicktest.core.service.CloudinaryStorageService;
import com.quicktest.modules.admin.dto.*;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.entity.ExamAttempt;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Implementation of AdminProctoringMediaService providing search, KPI stats,
 * and high-efficiency background batch cleanup executing exactly 1 UPDATE query per batch.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminProctoringMediaServiceImpl implements AdminProctoringMediaService {

    private final ViolationLogRepository violationLogRepository;
    private final CloudinaryStorageService cloudinaryStorageService;
    private final JdbcTemplate jdbcTemplate;
    private final PlatformTransactionManager transactionManager;

    @Qualifier("loggingExecutor")
    private final Executor loggingExecutor;

    private final AtomicBoolean isCleaningUp = new AtomicBoolean(false);
    private volatile ProctoringMediaCleanupStatusResponse currentCleanupStatus;
    private TransactionTemplate transactionTemplate;

    private synchronized TransactionTemplate getTransactionTemplate() {
        if (transactionTemplate == null) {
            transactionTemplate = new TransactionTemplate(transactionManager);
            transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        }
        return transactionTemplate;
    }

    @Transactional(readOnly = true)
    @Override
    public Page<AdminProctoringMediaResponse> searchMedia(
            String violationTypeStr,
            UUID examId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Pageable pageable) {

        String trimmedSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        String likePattern = trimmedSearch != null ? "%" + trimmedSearch + "%" : null;
        String vTypeStr = (violationTypeStr != null && !violationTypeStr.isBlank() && !"ALL".equalsIgnoreCase(violationTypeStr))
                ? violationTypeStr.trim() : null;

        Pageable nativePageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        Page<String> idPage = violationLogRepository.findEvidenceMediaIds(
                vTypeStr, examId, startDate, endDate, trimmedSearch, likePattern, nativePageable);

        if (idPage.isEmpty()) {
            return new PageImpl<>(Collections.emptyList(), pageable, idPage.getTotalElements());
        }

        List<UUID> ids = idPage.getContent().stream()
                .map(UUID::fromString)
                .toList();

        List<ViolationLog> logs = violationLogRepository.findAllByIdInWithDetails(ids);
        Map<UUID, ViolationLog> logMap = logs.stream()
                .collect(Collectors.toMap(ViolationLog::getId, Function.identity(), (a, b) -> a));

        List<AdminProctoringMediaResponse> content = ids.stream()
                .map(logMap::get)
                .filter(Objects::nonNull)
                .map(this::mapToResponse)
                .toList();

        return new PageImpl<>(content, pageable, idPage.getTotalElements());
    }

    private AdminProctoringMediaResponse mapToResponse(ViolationLog v) {
        ExamAttempt attempt = v.getExamAttempt();
        Exam exam = (attempt != null) ? attempt.getExam() : null;
        User user = (attempt != null) ? attempt.getUser() : null;

        String studentName = (user != null) ? user.getFullName() : (attempt != null ? attempt.getGuestName() : null);
        String studentEmail = (user != null) ? user.getEmail() : (attempt != null ? attempt.getGuestIdentifier() : null);
        UUID studentId = (user != null) ? user.getId() : null;

        String evidenceUrl = v.getEvidenceUrl();
        String storageType = (evidenceUrl != null && evidenceUrl.startsWith("data:")) ? "INLINE_DATA" : "CLOUDINARY";
        boolean isAnimatedBurst = v.getViolationType() == ViolationType.MULTIPLE_FACES;

        return AdminProctoringMediaResponse.builder()
                .id(v.getId())
                .attemptId(attempt != null ? attempt.getId() : null)
                .examId(exam != null ? exam.getId() : null)
                .examTitle(exam != null ? exam.getTitle() : "N/A")
                .attemptStatus(attempt != null && attempt.getStatus() != null ? attempt.getStatus().name() : null)
                .studentId(studentId)
                .studentName(studentName != null && !studentName.isBlank() ? studentName : "Thí sinh tự do")
                .studentEmail(studentEmail != null ? studentEmail : "")
                .violationType(v.getViolationType())
                .description(v.getDescription())
                .evidenceUrl(evidenceUrl)
                .timestamp(v.getTimestamp())
                .isAnimatedBurst(isAnimatedBurst)
                .storageType(storageType)
                .build();
    }

    @Transactional(readOnly = true)
    @Override
    public AdminProctoringMediaStatsResponse getStats() {
        long total = violationLogRepository.countAllEvidenceMedia();
        long singleSnapshot = violationLogRepository.countEvidenceMediaByViolationType(ViolationType.NO_FACE_DETECTED);
        long burstAnimation = violationLogRepository.countEvidenceMediaByViolationType(ViolationType.MULTIPLE_FACES);

        LocalDateTime now = LocalDateTime.now();
        long recent7Days = violationLogRepository.countEvidenceMediaSince(now.minusDays(7));
        long olderThan30Days = violationLogRepository.countEvidenceMediaBefore(now.minusDays(30));
        long examsCount = violationLogRepository.countDistinctExamsWithEvidenceMedia();

        return AdminProctoringMediaStatsResponse.builder()
                .totalMediaCount(total)
                .singleSnapshotCount(singleSnapshot)
                .burstAnimationCount(burstAnimation)
                .recent7DaysCount(recent7Days)
                .olderThan30DaysCount(olderThan30Days)
                .examsWithMediaCount(examsCount)
                .build();
    }

    @Transactional(readOnly = true)
    @Override
    public long countCleanupPreview(int days, String violationTypeStr, UUID examId, boolean onlyFinishedExams) {
        LocalDateTime cutoff = (days > 0) ? LocalDateTime.now().minusDays(days) : null;
        String vTypeStr = (violationTypeStr != null && !violationTypeStr.isBlank() && !"ALL".equalsIgnoreCase(violationTypeStr))
                ? violationTypeStr.trim() : null;
        return violationLogRepository.countEvidenceMediaForCleanup(cutoff, vTypeStr, examId, onlyFinishedExams);
    }

    @Override
    public ProctoringMediaCleanupStatusResponse triggerBatchCleanup(ProctoringMediaCleanupRequest request) {
        if (request == null) {
            request = new ProctoringMediaCleanupRequest();
        }
        int days = Math.max(request.getDays(), 0);
        int batchSize = Math.max(10, Math.min(request.getBatchSize() != null ? request.getBatchSize() : 100, 1000));
        boolean onlyFinishedExams = request.getOnlyFinishedExams() == null || request.getOnlyFinishedExams();
        String violationTypeStr = (request.getViolationType() != null && !request.getViolationType().isBlank() && !"ALL".equalsIgnoreCase(request.getViolationType()))
                ? request.getViolationType().trim() : null;
        UUID examId = request.getExamId();
        LocalDateTime cutoff = (days > 0) ? LocalDateTime.now().minusDays(days) : null;

        if (!isCleaningUp.compareAndSet(false, true)) {
            log.warn("[ProctoringMedia] Cleanup job already running. Refusing concurrent trigger.");
            return getCleanupStatus();
        }

        long estimatedRemaining = 0;
        try {
            estimatedRemaining = violationLogRepository.countEvidenceMediaForCleanup(cutoff, violationTypeStr, examId, onlyFinishedExams);
        } catch (Exception e) {
            log.warn("[ProctoringMedia] Failed to estimate cleanup count: {}", e.getMessage());
        }

        currentCleanupStatus = ProctoringMediaCleanupStatusResponse.builder()
                .isRunning(true)
                .totalDeleted(0)
                .estimatedRemaining(estimatedRemaining)
                .retentionDaysKept(days)
                .batchSize(batchSize)
                .cutoff(cutoff)
                .startedAt(LocalDateTime.now())
                .status("RUNNING")
                .message("Đang bắt đầu dọn dẹp ảnh giám sát cũ...")
                .build();

        final long finalEstimated = estimatedRemaining;
        final int finalBatchSize = batchSize;
        final int finalDays = days;
        CompletableFuture.runAsync(
                () -> executeBatchCleanupLoop(cutoff, violationTypeStr, examId, onlyFinishedExams, finalBatchSize, finalDays, finalEstimated),
                loggingExecutor
        );

        return currentCleanupStatus;
    }

    private void executeBatchCleanupLoop(
            LocalDateTime cutoff,
            String violationType,
            UUID examId,
            boolean onlyFinishedExams,
            int batchSize,
            int daysKept,
            long estimated) {
        long totalDeleted = 0;
        try {
            log.info("[ProctoringMedia] Background batch media cleanup started: cutoff={}, violationType={}, examId={}, onlyFinished={}, batchSize={}, estimated={}",
                    cutoff, violationType, examId, onlyFinishedExams, batchSize, estimated);

            TransactionTemplate txTemplate = getTransactionTemplate();

            final String batchUpdateSql = """
                    WITH target_batch AS (
                        SELECT v.id, v.evidence_url
                        FROM violation_logs v
                        JOIN exam_attempts ea ON ea.id = v.attempt_id
                        WHERE v.evidence_url IS NOT NULL AND v.evidence_url <> ''
                          AND (CAST(? AS TIMESTAMP) IS NULL OR v.timestamp < CAST(? AS TIMESTAMP))
                          AND (CAST(? AS VARCHAR) IS NULL OR v.violation_type = CAST(? AS VARCHAR))
                          AND (CAST(? AS UUID) IS NULL OR ea.exam_id = CAST(? AS UUID))
                          AND (? = FALSE OR ea.status <> 'IN_PROGRESS')
                        ORDER BY v.timestamp ASC
                        LIMIT ?
                        FOR UPDATE OF v SKIP LOCKED
                    )
                    UPDATE violation_logs u
                    SET evidence_url = NULL
                    FROM target_batch tb
                    WHERE u.id = tb.id
                    RETURNING tb.evidence_url
                    """;

            while (!Thread.currentThread().isInterrupted()) {
                final int currentBatchSize = batchSize;

                // Execute exactly 1 UPDATE query for this batch
                List<String> clearedUrls = txTemplate.execute(status -> {
                    return jdbcTemplate.query(
                            batchUpdateSql,
                            (rs, rowNum) -> rs.getString("evidence_url"),
                            cutoff != null ? java.sql.Timestamp.valueOf(cutoff) : null,
                            cutoff != null ? java.sql.Timestamp.valueOf(cutoff) : null,
                            violationType,
                            violationType,
                            examId,
                            examId,
                            onlyFinishedExams,
                            currentBatchSize
                    );
                });

                if (clearedUrls == null || clearedUrls.isEmpty()) {
                    break; // No more rows to clean up
                }

                int batchDeletedCount = clearedUrls.size();
                totalDeleted += batchDeletedCount;

                // Delete removed files from Cloudinary storage in batch
                try {
                    cloudinaryStorageService.deleteMediaBatch(clearedUrls);
                } catch (Exception ce) {
                    log.warn("[ProctoringMedia] Error batch deleting media files from Cloudinary: {}", ce.getMessage());
                }

                currentCleanupStatus = ProctoringMediaCleanupStatusResponse.builder()
                        .isRunning(true)
                        .totalDeleted(totalDeleted)
                        .estimatedRemaining(Math.max(0, estimated - totalDeleted))
                        .retentionDaysKept(daysKept)
                        .batchSize(batchSize)
                        .cutoff(cutoff)
                        .startedAt(currentCleanupStatus.getStartedAt())
                        .status("RUNNING")
                        .message(String.format("Đang dọn dẹp ảnh cũ: đã xóa %d ảnh...", totalDeleted))
                        .build();

                if (batchDeletedCount < batchSize) {
                    break; // Last batch finished
                }

                // Yield briefly to avoid hogging CPU/disk IO
                try {
                    Thread.sleep(50);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("[ProctoringMedia] Background batch media cleanup was interrupted");
                    break;
                }
            }

            log.info("[ProctoringMedia] Background batch media cleanup finished successfully. Total images cleared: {}", totalDeleted);
            currentCleanupStatus = ProctoringMediaCleanupStatusResponse.builder()
                    .isRunning(false)
                    .totalDeleted(totalDeleted)
                    .estimatedRemaining(0)
                    .retentionDaysKept(daysKept)
                    .batchSize(batchSize)
                    .cutoff(cutoff)
                    .startedAt(currentCleanupStatus.getStartedAt())
                    .finishedAt(LocalDateTime.now())
                    .status("COMPLETED")
                    .message(String.format("Đã dọn dẹp thành công %d ảnh giám sát cũ.", totalDeleted))
                    .build();

        } catch (Exception e) {
            log.error("[ProctoringMedia] Error during background batch media cleanup: {}", e.getMessage(), e);
            currentCleanupStatus = ProctoringMediaCleanupStatusResponse.builder()
                    .isRunning(false)
                    .totalDeleted(totalDeleted)
                    .retentionDaysKept(daysKept)
                    .batchSize(batchSize)
                    .cutoff(cutoff)
                    .startedAt(currentCleanupStatus != null ? currentCleanupStatus.getStartedAt() : LocalDateTime.now())
                    .finishedAt(LocalDateTime.now())
                    .status("FAILED")
                    .message("Lỗi khi dọn dẹp ảnh giám sát: " + e.getMessage())
                    .build();
        } finally {
            isCleaningUp.set(false);
        }
    }

    @Override
    public ProctoringMediaCleanupStatusResponse getCleanupStatus() {
        if (currentCleanupStatus == null) {
            return ProctoringMediaCleanupStatusResponse.builder()
                    .isRunning(false)
                    .totalDeleted(0)
                    .estimatedRemaining(0)
                    .status("IDLE")
                    .message("Không có tác vụ dọn dẹp ảnh nào đang chạy.")
                    .build();
        }
        return currentCleanupStatus;
    }

    @Override
    public long deleteSelectedMedia(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        List<UUID> validIds = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (validIds.isEmpty()) {
            return 0;
        }

        String placeholders = String.join(",", Collections.nCopies(validIds.size(), "?::uuid"));
        String sql = String.format("""
                WITH target_batch AS (
                    SELECT v.id, v.evidence_url
                    FROM violation_logs v
                    WHERE v.id IN (%s)
                      AND v.evidence_url IS NOT NULL AND v.evidence_url <> ''
                    FOR UPDATE OF v SKIP LOCKED
                )
                UPDATE violation_logs u
                SET evidence_url = NULL
                FROM target_batch tb
                WHERE u.id = tb.id
                RETURNING tb.evidence_url
                """, placeholders);

        Object[] params = validIds.toArray();

        TransactionTemplate txTemplate = getTransactionTemplate();
        List<String> clearedUrls = txTemplate.execute(status ->
                jdbcTemplate.query(sql, (rs, rowNum) -> rs.getString("evidence_url"), params)
        );

        if (clearedUrls != null && !clearedUrls.isEmpty()) {
            try {
                cloudinaryStorageService.deleteMediaBatch(clearedUrls);
            } catch (Exception e) {
                log.warn("[ProctoringMedia] Error batch deleting selected media from Cloudinary: {}", e.getMessage());
            }
            return clearedUrls.size();
        }
        return 0;
    }
}

