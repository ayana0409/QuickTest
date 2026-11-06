package com.quicktest.modules.proctoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.exception.GlobalExceptionHandler;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.proctoring.controller.ViolationIngestionController;
import com.quicktest.modules.proctoring.dto.ViolationAlertMessage;
import com.quicktest.modules.proctoring.dto.ViolationReportMessage;
import com.quicktest.modules.proctoring.entity.ViolationType;
import com.quicktest.modules.proctoring.service.RedisProctoringService;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import com.quicktest.modules.session.service.ExamSubmissionProducer;
import com.quicktest.modules.session.service.RedisExamSessionService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ViolationIngestionControllerTest {

    private MockMvc mockMvc;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private RedisProctoringService redisProctoringService;

    @Mock
    private RedisExamSessionService redisExamSessionService;

    @Mock
    private ExamSubmissionProducer examSubmissionProducer;

    @InjectMocks
    private ViolationIngestionController controller;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private UUID attemptId;
    private UUID examId;
    private ExamAttempt activeAttempt;
    private Exam proctoredExam;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        attemptId = UUID.randomUUID();
        examId = UUID.randomUUID();

        proctoredExam = Exam.builder()
                .id(examId)
                .title("Midterm Test")
                .isProctoringEnabled(true)
                .maxViolations(3)
                .build();

        activeAttempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(proctoredExam)
                .status(AttemptStatus.IN_PROGRESS)
                .startTime(LocalDateTime.now().minusMinutes(10))
                .expireAt(LocalDateTime.now().plusMinutes(50))
                .build();
    }

    @Test
    @DisplayName("Should successfully record violation in Redis RAM when attempt is active")
    void recordViolation_Success_InProgressAttempt() throws Exception {
        when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(activeAttempt));

        ViolationAlertMessage alertMessage = ViolationAlertMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.TAB_SWITCH)
                .violationCount(1)
                .maxAllowed(3)
                .remainingAllowed(2)
                .disqualified(false)
                .message("Cảnh báo vi phạm [TAB_SWITCH]: Số lần 1/3.")
                .timestamp(LocalDateTime.now())
                .build();

        when(redisProctoringService.recordViolationInMemory(
                eq(attemptId), eq(examId), eq(3), any(Duration.class), any(ViolationReportMessage.class)))
                .thenReturn(alertMessage);

        ViolationReportMessage report = ViolationReportMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.TAB_SWITCH)
                .description("Tab switch detected")
                .build();

        mockMvc.perform(post("/api/session/{attemptId}/proctoring/violation", attemptId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(report)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.attemptId").value(attemptId.toString()))
                .andExpect(jsonPath("$.data.violationCount").value(1))
                .andExpect(jsonPath("$.data.disqualified").value(false));

        verify(redisProctoringService).recordViolationInMemory(
                eq(attemptId), eq(examId), eq(3), any(Duration.class), any(ViolationReportMessage.class));
    }

    @Test
    @DisplayName("Should reject violation recording when attempt is already submitted")
    void recordViolation_Reject_WhenAttemptAlreadySubmitted() throws Exception {
        activeAttempt.setStatus(AttemptStatus.SUBMITTED);
        when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(activeAttempt));

        ViolationReportMessage report = ViolationReportMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.TAB_SWITCH)
                .description("Late violation")
                .build();

        mockMvc.perform(post("/api/session/{attemptId}/proctoring/violation", attemptId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(report)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(redisProctoringService);
    }

    @Test
    @DisplayName("Should return 404 when attempt ID is not found")
    void recordViolation_NotFound_WhenAttemptMissing() throws Exception {
        when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.empty());

        ViolationReportMessage report = ViolationReportMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.DEVTOOLS_OPEN)
                .build();

        mockMvc.perform(post("/api/session/{attemptId}/proctoring/violation", attemptId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(report)))
                .andExpect(status().isNotFound());

        verifyNoInteractions(redisProctoringService);
    }

    @Test
    @DisplayName("Should ignore violation when exam proctoring is disabled")
    void recordViolation_Ignored_WhenProctoringDisabled() throws Exception {
        proctoredExam.setIsProctoringEnabled(false);
        when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(activeAttempt));

        ViolationReportMessage report = ViolationReportMessage.builder()
                .attemptId(attemptId)
                .violationType(ViolationType.TAB_SWITCH)
                .build();

        mockMvc.perform(post("/api/session/{attemptId}/proctoring/violation", attemptId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(report)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.disqualified").value(false));

        verifyNoInteractions(redisProctoringService);
    }
}
