package com.quicktest.modules.proctoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.quicktest.modules.proctoring.dto.ViolationDetailResponse;
import com.quicktest.modules.proctoring.dto.ViolationItemRedisDto;
import com.quicktest.modules.proctoring.entity.ViolationLog;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.proctoring.service.ProctoringQueryService;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProctoringQueryServiceTest {

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private ViolationLogRepository violationLogRepository;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private ListOperations<String, String> listOperations;

    private ObjectMapper objectMapper;
    private ProctoringQueryService queryService;

    private UUID attemptId;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        queryService = new ProctoringQueryService(examAttemptRepository, violationLogRepository, redisTemplate, objectMapper);
        attemptId = UUID.randomUUID();
    }

    @Test
    @DisplayName("Should route to Redis RAM for IN_PROGRESS attempt (zero database log queries)")
    void getAttemptViolations_RoutesToRedis_WhenInProgress() throws Exception {
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .status(AttemptStatus.IN_PROGRESS)
                .build();

        when(examAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(redisTemplate.opsForList()).thenReturn(listOperations);

        when(valueOperations.get("quicktest:attempt:" + attemptId + ":violation_count")).thenReturn("2");

        ViolationItemRedisDto dto = ViolationItemRedisDto.builder()
                .violationType(ViolationType.TAB_SWITCH)
                .description("Switched tab")
                .timestamp(LocalDateTime.now())
                .build();

        when(listOperations.range("quicktest:attempt:" + attemptId + ":violation_logs", 0, -1))
                .thenReturn(List.of(objectMapper.writeValueAsString(dto)));

        ViolationDetailResponse result = queryService.getAttemptViolations(attemptId);

        assertThat(result).isNotNull();
        assertThat(result.getSource()).isEqualTo("REDIS_LIVE");
        assertThat(result.getViolationCount()).isEqualTo(2);
        assertThat(result.getViolations()).hasSize(1);
        assertThat(result.getViolations().get(0).getViolationType()).isEqualTo(ViolationType.TAB_SWITCH);

        verifyNoInteractions(violationLogRepository);
    }

    @Test
    @DisplayName("Should route to PostgreSQL for SUBMITTED attempt (finalized historical logs)")
    void getAttemptViolations_RoutesToDatabase_WhenSubmitted() {
        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .status(AttemptStatus.SUBMITTED)
                .violationCount(1)
                .build();

        when(examAttemptRepository.findById(attemptId)).thenReturn(Optional.of(attempt));

        ViolationLog logEntry = ViolationLog.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .violationType(ViolationType.EXIT_FULLSCREEN)
                .description("Exited fullscreen")
                .timestamp(LocalDateTime.now())
                .build();

        when(violationLogRepository.findByExamAttemptIdOrderByTimestampAsc(attemptId))
                .thenReturn(List.of(logEntry));

        ViolationDetailResponse result = queryService.getAttemptViolations(attemptId);

        assertThat(result).isNotNull();
        assertThat(result.getSource()).isEqualTo("POSTGRESQL_FINAL");
        assertThat(result.getViolationCount()).isEqualTo(1);
        assertThat(result.getViolations()).hasSize(1);
        assertThat(result.getViolations().get(0).getViolationType()).isEqualTo(ViolationType.EXIT_FULLSCREEN);

        verify(violationLogRepository).findByExamAttemptIdOrderByTimestampAsc(attemptId);
        verifyNoInteractions(redisTemplate);
    }
}
