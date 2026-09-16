package com.quicktest.modules.assessment;

import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.dto.ExamCreateRequest;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.dto.ExamUpdateRequest;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.core.service.MediaDeleteProducer;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.assessment.service.ExamServiceImpl;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ExamServiceImpl covering creation, ownership, access code generation,
 * and state transitions.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ExamServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private AnswerOptionRepository answerOptionRepository;

    @Mock
    private MediaDeleteProducer mediaDeleteProducer;

    @Mock
    private com.quicktest.modules.session.service.ExamSessionService examSessionService;

    @InjectMocks
    private ExamServiceImpl examService;

    private User teacher;
    private User otherTeacher;
    private Exam sampleExam;

    @BeforeEach
    void setUp() {
        teacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Teacher One")
                .email("teacher1@quicktest.com")
                .role(Role.TEACHER)
                .build();

        otherTeacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Teacher Two")
                .email("teacher2@quicktest.com")
                .role(Role.TEACHER)
                .build();

        sampleExam = Exam.builder()
                .id(UUID.randomUUID())
                .title("Math Midterm")
                .accessCode("MATH123")
                .status(ExamStatus.DRAFT)
                .durationMinutes(60)
                .maxAttempts(1)
                .createdBy(teacher)
                .build();
    }

    @Test
    @DisplayName("Create exam should auto-generate access code if omitted")
    void shouldAutoGenerateAccessCodeWhenOmitted() {
        ExamCreateRequest request = ExamCreateRequest.builder()
                .title("Physics Quiz")
                .durationMinutes(45)
                .build();

        when(examRepository.existsByAccessCode(anyString())).thenReturn(false);
        when(examRepository.save(any(Exam.class))).thenAnswer(invocation -> {
            Exam e = invocation.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        ExamDetailResponse response = examService.createExam(request, teacher);

        assertNotNull(response);
        assertNotNull(response.getAccessCode());
        assertTrue(response.getAccessCode().length() >= 6);
        assertEquals(ExamStatus.DRAFT, response.getStatus());
        verify(examRepository).save(any(Exam.class));
    }

    @Test
    @DisplayName("Create exam should fail when custom access code already exists")
    void shouldFailWhenCustomAccessCodeExists() {
        ExamCreateRequest request = ExamCreateRequest.builder()
                .title("Biology Quiz")
                .accessCode("BIO101")
                .durationMinutes(45)
                .build();

        when(examRepository.existsByAccessCode("BIO101")).thenReturn(true);

        AppException ex = assertThrows(AppException.class, () -> examService.createExam(request, teacher));
        assertTrue(ex.getMessage().contains("already in use"));
        verify(examRepository, never()).save(any());
    }

    @Test
    @DisplayName("Create exam should fail when endTime is before startTime")
    void shouldFailWhenEndTimeBeforeStartTime() {
        LocalDateTime start = LocalDateTime.now().plusDays(2);
        LocalDateTime end = LocalDateTime.now().plusDays(1);

        ExamCreateRequest request = ExamCreateRequest.builder()
                .title("History Test")
                .durationMinutes(30)
                .startTime(start)
                .endTime(end)
                .build();

        AppException ex = assertThrows(AppException.class, () -> examService.createExam(request, teacher));
        assertTrue(ex.getMessage().contains("Exam end time must be after start time"));
    }

    @Test
    @DisplayName("Update exam should throw AccessDeniedException when caller is not owner")
    void shouldDenyUpdateWhenNotOwner() {
        when(examRepository.findByIdWithCreatedBy(sampleExam.getId())).thenReturn(Optional.of(sampleExam));

        ExamUpdateRequest request = ExamUpdateRequest.builder()
                .title("Hacked Title")
                .durationMinutes(90)
                .build();

        assertThrows(AccessDeniedException.class, () ->
                examService.updateExam(sampleExam.getId(), request, otherTeacher));
    }

    @Test
    @DisplayName("Delete exam should fail if exam is already PUBLISHED or CLOSED")
    void shouldFailDeleteWhenExamNotDraft() {
        sampleExam.setStatus(ExamStatus.PUBLISHED);
        when(examRepository.findByIdWithCreatedBy(sampleExam.getId())).thenReturn(Optional.of(sampleExam));

        AppException ex = assertThrows(AppException.class, () ->
                examService.deleteExam(sampleExam.getId(), teacher));
        assertTrue(ex.getMessage().contains("Only DRAFT exams can be deleted"));
        verify(examRepository, never()).deleteExamById(any());
    }

    @Test
    @DisplayName("Delete exam should succeed, trigger media deletion batches, and bulk delete in database")
    void shouldDeleteExamSuccessfullyAndPublishMediaBatches() {
        when(examRepository.findByIdWithCreatedBy(sampleExam.getId())).thenReturn(Optional.of(sampleExam));
        when(questionRepository.findImageIdentifiersByExamId(sampleExam.getId()))
                .thenReturn(List.of("q_img_1", "q_img_2"));
        when(answerOptionRepository.findImageIdentifiersByExamId(sampleExam.getId()))
                .thenReturn(List.of("opt_img_1"));

        examService.deleteExam(sampleExam.getId(), teacher);

        verify(mediaDeleteProducer).sendDeleteBatches(
                eq(sampleExam.getId()),
                argThat(list -> list.containsAll(List.of("q_img_1", "q_img_2", "opt_img_1"))),
                eq("EXAM_DELETION")
        );
        verify(answerOptionRepository).deleteByExamId(sampleExam.getId());
        verify(questionRepository).deleteByExamId(sampleExam.getId());
        verify(examRepository).deleteExamById(sampleExam.getId());
    }

    @Test
    @DisplayName("Publish exam should fail if exam has no questions")
    void shouldFailPublishWhenNoQuestions() {
        when(examRepository.findByIdWithCreatedBy(sampleExam.getId())).thenReturn(Optional.of(sampleExam));
        when(questionRepository.countByExamId(sampleExam.getId())).thenReturn(0L);

        AppException ex = assertThrows(AppException.class, () ->
                examService.publishExam(sampleExam.getId(), teacher));
        assertTrue(ex.getMessage().contains("Cannot publish an exam without any questions"));
    }

    @Test
    @DisplayName("Publish exam should succeed when exam is DRAFT and has questions")
    void shouldPublishSuccessfully() {
        when(examRepository.findByIdWithCreatedBy(sampleExam.getId())).thenReturn(Optional.of(sampleExam));
        when(questionRepository.countByExamId(sampleExam.getId())).thenReturn(5L);
        when(examRepository.save(any(Exam.class))).thenAnswer(inv -> inv.getArgument(0));
        when(questionRepository.findByExamIdWithOptions(sampleExam.getId())).thenReturn(Collections.emptyList());

        ExamDetailResponse response = examService.publishExam(sampleExam.getId(), teacher);

        assertNotNull(response);
        assertEquals(ExamStatus.PUBLISHED, response.getStatus());
        verify(examRepository).save(sampleExam);
    }

    @Test
    @DisplayName("Close exam should transition status to CLOSED")
    void shouldCloseExamSuccessfully() {
        sampleExam.setStatus(ExamStatus.PUBLISHED);
        when(examRepository.findByIdWithCreatedBy(sampleExam.getId())).thenReturn(Optional.of(sampleExam));
        when(examRepository.save(any(Exam.class))).thenAnswer(inv -> inv.getArgument(0));
        when(questionRepository.findByExamIdWithOptions(sampleExam.getId())).thenReturn(Collections.emptyList());

        ExamDetailResponse response = examService.closeExam(sampleExam.getId(), teacher);

        assertEquals(ExamStatus.CLOSED, response.getStatus());
        verify(examSessionService).autoSubmitActiveAttemptsForExam(eq(sampleExam.getId()), anyString());
    }

    @Test
    @DisplayName("Update exam should succeed even when exam status is CLOSED")
    void shouldAllowUpdatingClosedExam() {
        sampleExam.setStatus(ExamStatus.CLOSED);
        when(examRepository.findByIdWithCreatedBy(sampleExam.getId())).thenReturn(Optional.of(sampleExam));
        when(examRepository.save(any(Exam.class))).thenAnswer(inv -> inv.getArgument(0));
        when(questionRepository.findByExamIdWithOptions(sampleExam.getId())).thenReturn(Collections.emptyList());

        ExamUpdateRequest request = ExamUpdateRequest.builder()
                .title("Updated Closed Exam Title")
                .durationMinutes(60)
                .build();

        ExamDetailResponse response = examService.updateExam(sampleExam.getId(), request, teacher);

        assertNotNull(response);
        assertEquals("Updated Closed Exam Title", response.getTitle());
        verify(examRepository).save(sampleExam);
    }

    @Test
    @DisplayName("Republish exam should succeed when exam is CLOSED and endTime is in future")
    void shouldRepublishClosedExamSuccessfully() {
        sampleExam.setStatus(ExamStatus.CLOSED);
        when(examRepository.findByIdWithCreatedBy(sampleExam.getId())).thenReturn(Optional.of(sampleExam));
        when(questionRepository.countByExamId(sampleExam.getId())).thenReturn(5L);
        when(examRepository.save(any(Exam.class))).thenAnswer(inv -> inv.getArgument(0));
        when(questionRepository.findByExamIdWithOptions(sampleExam.getId())).thenReturn(Collections.emptyList());

        com.quicktest.modules.assessment.dto.ExamRepublishRequest request = com.quicktest.modules.assessment.dto.ExamRepublishRequest.builder()
                .endTime(LocalDateTime.now().plusDays(2))
                .durationMinutes(50)
                .build();

        ExamDetailResponse response = examService.republishExam(sampleExam.getId(), request, teacher);

        assertNotNull(response);
        assertEquals(ExamStatus.PUBLISHED, response.getStatus());
        assertEquals(50, sampleExam.getDurationMinutes());
        verify(examRepository).save(sampleExam);
    }

    @Test
    @DisplayName("Republish exam should fail when endTime is in the past")
    void shouldFailRepublishWhenEndTimeInPast() {
        sampleExam.setStatus(ExamStatus.CLOSED);
        when(examRepository.findByIdWithCreatedBy(sampleExam.getId())).thenReturn(Optional.of(sampleExam));
        when(questionRepository.countByExamId(sampleExam.getId())).thenReturn(5L);

        com.quicktest.modules.assessment.dto.ExamRepublishRequest request = com.quicktest.modules.assessment.dto.ExamRepublishRequest.builder()
                .endTime(LocalDateTime.now().minusHours(1))
                .build();

        AppException ex = assertThrows(AppException.class, () ->
                examService.republishExam(sampleExam.getId(), request, teacher));

        assertTrue(ex.getMessage().contains("sau thời điểm hiện tại"));
        verify(examRepository, never()).save(any());
    }
}
