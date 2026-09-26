package com.quicktest.core.logging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.admin.dto.AdminSystemLogDetailResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogMetadataResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogResponse;
import com.quicktest.modules.admin.dto.AdminSystemLogStatsResponse;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.BindingResult;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.io.OutputStream;
import java.security.Principal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;


/**
 * Implementation of SystemLogService providing asynchronous non-blocking log persistence,
 * sensitive data masking, and resilient error recovery.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemLogServiceImpl implements SystemLogService {

    private static final int MAX_DETAILS_LENGTH = 10_000;
    private static final Pattern SENSITIVE_KEY_PATTERN =
            Pattern.compile("(?i)(password|secret|token|credential|authorization|accesstoken|refreshtoken)");

    private final SystemLogRepository systemLogRepository;
    private final ObjectMapper objectMapper;

    @Async("loggingExecutor")
    @Override
    public void logAsync(SystemLog systemLog) {
        try {
            saveWithTruncation(systemLog);
        } catch (Exception e) {
            // Fail-safe: A failure to persist audit log must never bubble up or disrupt normal operations
            log.warn("[AuditLog] Failed to persist system log asynchronously: {}", e.getMessage());
        }
    }

    @Override
    public void logSync(SystemLog systemLog) {
        try {
            saveWithTruncation(systemLog);
        } catch (Exception e) {
            log.warn("[AuditLog] Failed to persist system log synchronously: {}", e.getMessage());
        }
    }

    private void saveWithTruncation(SystemLog systemLog) {
        if (systemLog.getDetails() != null && systemLog.getDetails().length() > MAX_DETAILS_LENGTH) {
            systemLog.setDetails(systemLog.getDetails().substring(0, MAX_DETAILS_LENGTH) + "... [TRUNCATED]");
        }
        if (systemLog.getErrorMessage() != null && systemLog.getErrorMessage().length() > MAX_DETAILS_LENGTH) {
            systemLog.setErrorMessage(systemLog.getErrorMessage().substring(0, MAX_DETAILS_LENGTH) + "... [TRUNCATED]");
        }
        systemLogRepository.save(systemLog);
    }

    @Override
    public String safeSerialize(Object object) {
        if (object == null) {
            return null;
        }

        try {
            Object sanitized = sanitizeObject(object, 0);
            String json = objectMapper.writeValueAsString(sanitized);
            if (json.length() > MAX_DETAILS_LENGTH) {
                return json.substring(0, MAX_DETAILS_LENGTH) + "... [TRUNCATED]";
            }
            return json;
        } catch (Exception e) {
            // Fallback to simple toString if JSON serialization encounters unexpected types
            String str = String.valueOf(object);
            if (str.length() > MAX_DETAILS_LENGTH) {
                return str.substring(0, MAX_DETAILS_LENGTH) + "... [TRUNCATED]";
            }
            return str;
        }
    }

    /**
     * Recursively sanitizes objects to filter out binary streams, servlets, and mask credentials.
     */
    private Object sanitizeObject(Object obj, int depth) {
        if (obj == null || depth > 4) {
            return null;
        }

        if (obj instanceof MultipartFile multipartFile) {
            return Map.of(
                    "type", "MultipartFile",
                    "originalFilename", String.valueOf(multipartFile.getOriginalFilename()),
                    "size", multipartFile.getSize(),
                    "contentType", String.valueOf(multipartFile.getContentType())
            );
        }

        if (obj instanceof byte[] bytes) {
            return "[byte[] length=" + bytes.length + "]";
        }

        if (obj instanceof ServletRequest || obj instanceof ServletResponse
                || obj instanceof InputStream || obj instanceof OutputStream
                || obj instanceof BindingResult || obj instanceof Principal) {
            return "[" + obj.getClass().getSimpleName() + "]";
        }

        if (obj instanceof Map<?, ?> map) {
            Map<String, Object> sanitizedMap = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (SENSITIVE_KEY_PATTERN.matcher(key).find()) {
                    sanitizedMap.put(key, "***MASKED***");
                } else {
                    sanitizedMap.put(key, sanitizeObject(entry.getValue(), depth + 1));
                }
            }
            return sanitizedMap;
        }

        if (obj instanceof Collection<?> collection) {
            List<Object> sanitizedList = new ArrayList<>();
            for (Object item : collection) {
                sanitizedList.add(sanitizeObject(item, depth + 1));
            }
            return sanitizedList;
        }

        return obj;
    }

    @Transactional(readOnly = true)
    @Override
    public Page<AdminSystemLogResponse> searchLogs(
            String level,
            String status,
            String module,
            String action,
            UUID actorId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            String search,
            Pageable pageable) {

        String trimmedSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        String likePattern = trimmedSearch != null ? "%" + trimmedSearch + "%" : null;

        // Step 1: Query IDs only using index scan with FTS & filters
        // Use unsorted pageable for native query because ORDER BY l.created_at DESC, l.id DESC
        // is already hardcoded in the native query, preventing Spring Data from appending unmapped property names
        Pageable nativePageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
        Page<String> idPage = systemLogRepository.findLogIds(
                level, status, module, action, actorId, startDate, endDate, trimmedSearch, likePattern, nativePageable);

        if (idPage.isEmpty()) {
            return new PageImpl<>(Collections.emptyList(), pageable, idPage.getTotalElements());
        }

        // Step 2: Fetch entities for the page IDs in bulk
        List<UUID> ids = idPage.getContent().stream()
                .map(UUID::fromString)
                .toList();

        List<SystemLog> logs = systemLogRepository.findAllByIdIn(ids);
        Map<UUID, SystemLog> logMap = logs.stream()
                .collect(Collectors.toMap(SystemLog::getId, Function.identity(), (a, b) -> a));

        // Preserve sorting order returned by index query
        List<AdminSystemLogResponse> responses = ids.stream()
                .map(logMap::get)
                .filter(Objects::nonNull)
                .map(AdminSystemLogResponse::fromEntity)
                .toList();

        return new PageImpl<>(responses, pageable, idPage.getTotalElements());
    }

    @Transactional(readOnly = true)
    @Override
    public AdminSystemLogDetailResponse getLogDetail(UUID id) {
        SystemLog log = systemLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SystemLog", "id", id));
        return AdminSystemLogDetailResponse.fromEntity(log);
    }

    @Transactional(readOnly = true)
    @Override
    public AdminSystemLogStatsResponse getLogStats() {
        long totalLogs = systemLogRepository.count();
        long successCount = systemLogRepository.countByStatus(LogStatus.SUCCESS);
        long failureCount = systemLogRepository.countByStatus(LogStatus.FAILURE);
        double errorRate = totalLogs > 0 ? ((double) failureCount * 100.0) / totalLogs : 0.0;

        long infoCount = systemLogRepository.countByLevel(LogLevel.INFO);
        long warnCount = systemLogRepository.countByLevel(LogLevel.WARN);
        long errorCount = systemLogRepository.countByLevel(LogLevel.ERROR);

        Double avgExec = systemLogRepository.getAverageExecutionTime();
        double averageExecutionTimeMs = avgExec != null ? Math.round(avgExec * 100.0) / 100.0 : 0.0;

        List<Object[]> moduleRows = systemLogRepository.countLogsByModule();
        Map<String, Long> moduleCounts = new LinkedHashMap<>();
        if (moduleRows != null) {
            for (Object[] row : moduleRows) {
                if (row.length >= 2 && row[0] != null && row[1] != null) {
                    moduleCounts.put(String.valueOf(row[0]), ((Number) row[1]).longValue());
                }
            }
        }

        return AdminSystemLogStatsResponse.builder()
                .totalLogs(totalLogs)
                .successCount(successCount)
                .failureCount(failureCount)
                .errorRate(Math.round(errorRate * 100.0) / 100.0)
                .infoCount(infoCount)
                .warnCount(warnCount)
                .errorCount(errorCount)
                .averageExecutionTimeMs(averageExecutionTimeMs)
                .moduleCounts(moduleCounts)
                .build();
    }

    @Transactional(readOnly = true)
    @Override
    public AdminSystemLogMetadataResponse getLogMetadata() {
        List<String> modules = systemLogRepository.findDistinctModules();
        List<String> actions = systemLogRepository.findDistinctActions();
        return AdminSystemLogMetadataResponse.builder()
                .modules(modules != null ? modules : Collections.emptyList())
                .actions(actions != null ? actions : Collections.emptyList())
                .build();
    }

    @Transactional
    @Override
    public long cleanupOldLogs(int daysToKeep) {
        int safeDays = Math.max(daysToKeep, 1);
        LocalDateTime cutoff = LocalDateTime.now().minusDays(safeDays);
        long deleted = systemLogRepository.deleteByCreatedAtBefore(cutoff);
        log.info("[AuditLog] Cleaned up {} system logs older than {} days (cutoff: {})", deleted, safeDays, cutoff);
        return deleted;
    }
}

