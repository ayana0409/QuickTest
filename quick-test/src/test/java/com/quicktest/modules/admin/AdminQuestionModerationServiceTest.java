package com.quicktest.modules.admin;

import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.core.service.MediaDeleteProducer;
import com.quicktest.modules.admin.dto.AdminModerationStatsResponse;
import com.quicktest.modules.admin.dto.AdminQuestionModerationResponse;
import com.quicktest.modules.admin.service.AdminQuestionModerationServiceImpl;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AdminQuestionModerationServiceImpl.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AdminQuestionModerationServiceTest {

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private AnswerOptionRepository answerOptionRepository;

    @Mock
    private CandidateAnswerRepository candidateAnswerRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private MediaDeleteProducer mediaDeleteProducer;

    @InjectMocks
    private AdminQuestionModerationServiceImpl moderationService;

    private User admin;
    private User teacher;
    private Exam exam;
    private Question sampleQuestion;

    @BeforeEach
    void setUp() {
        admin = User.builder()
                .id(UUID.randomUUID())
                .username("admin")
                .fullName("System Admin")
                .email("admin@quicktest.com")
                .role(Role.ADMIN)
                .build();

        teacher = User.builder()
                .id(UUID.randomUUID())
                .username("teacher1")
                .fullName("Teacher Alice")
                .email("teacher@quicktest.com")
                .role(Role.TEACHER)
                .build();

        exam = Exam.builder()
                .id(UUID.randomUUID())
                .title("Sample Biology Exam")
                .accessCode("BIO101")
                .status(ExamStatus.PUBLISHED)
                .createdBy(teacher)
                .build();

        sampleQuestion = Question.builder()
                .id(UUID.randomUUID())
                .content("What is the powerhouse of the cell?")
                .imageUrl("https://res.cloudinary.com/test/image/upload/sample.jpg")
                .imagePublicId("sample_public_id")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(2.0)
                .isSafe(false)
                .exam(exam)
                .options(new ArrayList<>())
                .build();

        AnswerOption option1 = AnswerOption.builder()
                .id(UUID.randomUUID())
                .content("Mitochondria")
                .isCorrect(true)
                .question(sampleQuestion)
                .build();
        sampleQuestion.getOptions().add(option1);
    }

    @Test
    @DisplayName("getModerationQuestions: returns page with reviewer name and submission count")
    void getModerationQuestions_Success() {
        sampleQuestion.setIsSafe(true);
        sampleQuestion.setReviewedBy(admin.getId());

        Page<String> mockIdPage = new PageImpl<>(List.of(sampleQuestion.getId().toString()));
        when(questionRepository.findModerationQuestionIds(
                eq(true), eq(true), eq("SINGLE_CHOICE"), eq("mitochondria"), any(), any(), any(Pageable.class)))
                .thenReturn(mockIdPage);
        when(questionRepository.findAllByIdInWithOptionsAndExam(anyList()))
                .thenReturn(List.of(sampleQuestion));

        List<Object[]> attemptRows = new ArrayList<>();
        attemptRows.add(new Object[]{sampleQuestion.getId(), 5L});
        when(candidateAnswerRepository.countAttemptsByQuestionIds(anyList())).thenReturn(attemptRows);
        when(userRepository.findAllById(anySet())).thenReturn(List.of(admin));

        Page<AdminQuestionModerationResponse> result = moderationService.getModerationQuestions(
                true, true, QuestionType.SINGLE_CHOICE, "mitochondria", PageRequest.of(0, 10));

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        AdminQuestionModerationResponse item = result.getContent().get(0);
        assertEquals(sampleQuestion.getId(), item.getId());
        assertTrue(item.getIsSafe());
        assertTrue(item.getHasImage());
        assertEquals("System Admin", item.getReviewedByName());
        assertEquals(5L, item.getAttemptsCount());
        assertEquals(exam.getTitle(), item.getExam().getTitle());
        assertEquals(teacher.getFullName(), item.getTeacher().getFullName());
    }

    @Test
    @DisplayName("getModerationStats: accurately aggregates all 4 KPI numbers")
    void getModerationStats_Success() {
        when(questionRepository.count()).thenReturn(120L);
        when(questionRepository.countQuestionsWithImages()).thenReturn(45L);
        when(questionRepository.countByIsSafe(true)).thenReturn(80L);
        when(questionRepository.countByIsSafe(false)).thenReturn(40L);

        AdminModerationStatsResponse stats = moderationService.getModerationStats();

        assertNotNull(stats);
        assertEquals(120L, stats.getTotalQuestions());
        assertEquals(45L, stats.getQuestionsWithImages());
        assertEquals(80L, stats.getSafeQuestions());
        assertEquals(40L, stats.getUnreviewedQuestions());
    }

    @Test
    @DisplayName("updateSafetyFlag: mark as safe sets isSafe true and audit fields")
    void updateSafetyFlag_MarkSafe_Success() {
        when(questionRepository.findByIdWithOptionsAndExam(sampleQuestion.getId()))
                .thenReturn(Optional.of(sampleQuestion));
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(candidateAnswerRepository.countByQuestionId(sampleQuestion.getId())).thenReturn(3L);

        AdminQuestionModerationResponse response = moderationService.updateSafetyFlag(
                sampleQuestion.getId(), true, admin);

        assertNotNull(response);
        assertTrue(response.getIsSafe());
        assertNotNull(response.getReviewedAt());
        assertEquals(admin.getId(), response.getReviewedBy());
        assertEquals("System Admin", response.getReviewedByName());
        assertEquals(3L, response.getAttemptsCount());

        verify(questionRepository).save(sampleQuestion);
    }

    @Test
    @DisplayName("updateSafetyFlag: revoke safety flag resets reviewed fields to null")
    void updateSafetyFlag_Revoke_Success() {
        sampleQuestion.setIsSafe(true);
        sampleQuestion.setReviewedBy(admin.getId());

        when(questionRepository.findByIdWithOptionsAndExam(sampleQuestion.getId()))
                .thenReturn(Optional.of(sampleQuestion));
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(candidateAnswerRepository.countByQuestionId(sampleQuestion.getId())).thenReturn(0L);

        AdminQuestionModerationResponse response = moderationService.updateSafetyFlag(
                sampleQuestion.getId(), false, admin);

        assertNotNull(response);
        assertFalse(response.getIsSafe());
        assertNull(response.getReviewedAt());
        assertNull(response.getReviewedBy());
        assertNull(response.getReviewedByName());
    }

    @Test
    @DisplayName("deleteQuestionByAdmin: cascade deletes submissions, options, question and purges Cloudinary media")
    void deleteQuestionByAdmin_Success() {
        when(questionRepository.findByIdWithOptionsAndExam(sampleQuestion.getId()))
                .thenReturn(Optional.of(sampleQuestion));

        moderationService.deleteQuestionByAdmin(sampleQuestion.getId(), admin);

        // Verify cascade submissions cleanup
        verify(candidateAnswerRepository).deleteSelectedOptionsByQuestionId(sampleQuestion.getId());
        verify(candidateAnswerRepository).deleteByQuestionId(sampleQuestion.getId());

        // Verify options and question deletion
        verify(answerOptionRepository).deleteByQuestionId(sampleQuestion.getId());
        verify(questionRepository).deleteQuestionById(sampleQuestion.getId());

        // Verify media deletion dispatched to RabbitMQ
        verify(mediaDeleteProducer).sendDeleteBatches(
                eq(exam.getId()),
                argThat(list -> list.contains("sample_public_id")),
                eq("ADMIN_QUESTION_MODERATION_DELETION")
        );
    }

    @Test
    @DisplayName("deleteQuestionByAdmin: question not found throws ResourceNotFoundException")
    void deleteQuestionByAdmin_NotFound_ThrowsException() {
        UUID randomId = UUID.randomUUID();
        when(questionRepository.findByIdWithOptionsAndExam(randomId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                moderationService.deleteQuestionByAdmin(randomId, admin));

        verify(questionRepository, never()).deleteQuestionById(any());
    }
}
