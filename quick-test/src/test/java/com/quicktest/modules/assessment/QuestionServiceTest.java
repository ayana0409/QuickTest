package com.quicktest.modules.assessment;

import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.dto.AnswerOptionDto;
import com.quicktest.modules.assessment.dto.QuestionCreateRequest;
import com.quicktest.modules.assessment.dto.QuestionResponse;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.assessment.service.QuestionServiceImpl;
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

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for QuestionServiceImpl covering adding, updating, deleting questions,
 * ownership checks, and status restrictions.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class QuestionServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private com.quicktest.core.service.CloudinaryStorageService cloudinaryStorageService;

    @InjectMocks
    private QuestionServiceImpl questionService;

    private User teacher;
    private User intruder;
    private Exam draftExam;
    private Question sampleQuestion;

    @BeforeEach
    void setUp() {
        teacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Teacher Alice")
                .email("alice@quicktest.com")
                .role(Role.TEACHER)
                .build();

        intruder = User.builder()
                .id(UUID.randomUUID())
                .fullName("Intruder Bob")
                .email("bob@quicktest.com")
                .role(Role.TEACHER)
                .build();

        draftExam = Exam.builder()
                .id(UUID.randomUUID())
                .title("Chemistry Test")
                .accessCode("CHEM01")
                .status(ExamStatus.DRAFT)
                .createdBy(teacher)
                .build();

        sampleQuestion = Question.builder()
                .id(UUID.randomUUID())
                .exam(draftExam)
                .content("What is the atomic number of Hydrogen?")
                .questionType(QuestionType.NUMERIC)
                .sampleAnswer("1")
                .numericTolerance(0.0)
                .points(2.0)
                .options(new ArrayList<>())
                .build();
    }

    @Test
    @DisplayName("Add question should succeed when exam is DRAFT and user is owner")
    void shouldAddQuestionSuccessfully() {
        QuestionCreateRequest request = QuestionCreateRequest.builder()
                .content("What is the capital of France?")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(1.5)
                .options(Arrays.asList(
                        AnswerOptionDto.builder().content("Paris").isCorrect(true).build(),
                        AnswerOptionDto.builder().content("London").isCorrect(false).build()
                ))
                .build();

        when(examRepository.findByIdWithCreatedBy(draftExam.getId())).thenReturn(Optional.of(draftExam));
        when(questionRepository.countByExamId(draftExam.getId())).thenReturn(0L);
        when(questionRepository.save(any(Question.class))).thenAnswer(inv -> {
            Question q = inv.getArgument(0);
            q.setId(UUID.randomUUID());
            return q;
        });

        QuestionResponse response = questionService.addQuestionToExam(draftExam.getId(), request, teacher);

        assertNotNull(response);
        assertEquals("What is the capital of France?", response.getContent());
        assertEquals(QuestionType.SINGLE_CHOICE, response.getQuestionType());
        assertEquals(2, response.getOptions().size());
        verify(questionRepository).save(any(Question.class));
    }

    @Test
    @DisplayName("Add question should fail when exam is not in DRAFT status")
    void shouldFailAddQuestionWhenExamPublished() {
        draftExam.setStatus(ExamStatus.PUBLISHED);
        when(examRepository.findByIdWithCreatedBy(draftExam.getId())).thenReturn(Optional.of(draftExam));

        QuestionCreateRequest request = QuestionCreateRequest.builder()
                .content("New question?")
                .questionType(QuestionType.NUMERIC)
                .sampleAnswer("10")
                .build();

        AppException ex = assertThrows(AppException.class, () ->
                questionService.addQuestionToExam(draftExam.getId(), request, teacher));
        assertTrue(ex.getMessage().contains("Only DRAFT exams can be modified"));
        verify(questionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Add question should fail with AccessDeniedException when caller is not owner")
    void shouldDenyAddQuestionWhenNotOwner() {
        when(examRepository.findByIdWithCreatedBy(draftExam.getId())).thenReturn(Optional.of(draftExam));

        QuestionCreateRequest request = QuestionCreateRequest.builder()
                .content("Question?")
                .questionType(QuestionType.NUMERIC)
                .sampleAnswer("5")
                .build();

        assertThrows(AccessDeniedException.class, () ->
                questionService.addQuestionToExam(draftExam.getId(), request, intruder));
        verify(questionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Delete question should fail when exam is CLOSED")
    void shouldFailDeleteWhenExamClosed() {
        draftExam.setStatus(ExamStatus.CLOSED);
        when(questionRepository.findByIdWithOptionsAndExam(sampleQuestion.getId()))
                .thenReturn(Optional.of(sampleQuestion));

        AppException ex = assertThrows(AppException.class, () ->
                questionService.deleteQuestion(sampleQuestion.getId(), teacher));
        assertTrue(ex.getMessage().contains("Only DRAFT exams can be modified"));
        verify(questionRepository, never()).delete(any());
    }

    @Test
    @DisplayName("Delete question should succeed when exam is DRAFT and caller is owner")
    void shouldDeleteQuestionSuccessfully() {
        when(questionRepository.findByIdWithOptionsAndExam(sampleQuestion.getId()))
                .thenReturn(Optional.of(sampleQuestion));

        questionService.deleteQuestion(sampleQuestion.getId(), teacher);
        verify(questionRepository).delete(sampleQuestion);
    }
}
