package com.quicktest.modules.assessment;

import com.quicktest.config.RabbitMQConfig;
import com.quicktest.modules.assessment.dto.ExamCloneTaskMessage;
import com.quicktest.modules.assessment.dto.ExamDetailResponse;
import com.quicktest.modules.assessment.dto.ExamDuplicateRequest;
import com.quicktest.modules.assessment.entity.*;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.assessment.service.ExamServiceImpl;
import com.quicktest.core.service.MediaDeleteProducer;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.service.ExamSessionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.security.access.AccessDeniedException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ExamDuplicateTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private AnswerOptionRepository answerOptionRepository;

    @Mock
    private MediaDeleteProducer mediaDeleteProducer;

    @Mock
    private ExamSessionService examSessionService;

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private ExamServiceImpl examService;

    private User teacher;
    private User otherTeacher;
    private Exam sourceExam;

    @BeforeEach
    void setUp() {
        teacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Teacher Original")
                .email("teacher@quicktest.com")
                .role(Role.TEACHER)
                .build();

        otherTeacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Imposter Teacher")
                .email("imposter@quicktest.com")
                .role(Role.TEACHER)
                .build();

        sourceExam = Exam.builder()
                .id(UUID.randomUUID())
                .title("Midterm Math Exam")
                .accessCode("MATH01")
                .description("Sample math exam")
                .status(ExamStatus.PUBLISHED)
                .durationMinutes(60)
                .maxAttempts(2)
                .shuffleQuestions(true)
                .shuffleOptions(true)
                .createdBy(teacher)
                .questions(new ArrayList<>())
                .build();
    }

    @Test
    @DisplayName("Should duplicate exam without images immediately to DRAFT status")
    void shouldDuplicateExamWithoutImagesImmediately() {
        when(examRepository.findByIdWithCreatedBy(sourceExam.getId())).thenReturn(Optional.of(sourceExam));
        when(examRepository.existsByAccessCode(anyString())).thenReturn(false);

        Question q1 = Question.builder()
                .id(UUID.randomUUID())
                .orderIndex(1)
                .content("What is 2 + 2?")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(5.0)
                .exam(sourceExam)
                .options(new ArrayList<>())
                .build();

        AnswerOption opt1 = AnswerOption.builder()
                .id(UUID.randomUUID())
                .orderIndex(1)
                .content("4")
                .isCorrect(true)
                .question(q1)
                .build();
        q1.getOptions().add(opt1);

        when(questionRepository.findByExamIdWithOptions(sourceExam.getId())).thenReturn(List.of(q1));

        when(examRepository.save(any(Exam.class))).thenAnswer(invocation -> {
            Exam e = invocation.getArgument(0);
            if (e.getId() == null) {
                e.setId(UUID.randomUUID());
            }
            return e;
        });

        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> {
            Question q = invocation.getArgument(0);
            if (q.getId() == null) {
                q.setId(UUID.randomUUID());
            }
            return q;
        });

        when(answerOptionRepository.save(any(AnswerOption.class))).thenAnswer(invocation -> {
            AnswerOption o = invocation.getArgument(0);
            if (o.getId() == null) {
                o.setId(UUID.randomUUID());
            }
            return o;
        });

        ExamDetailResponse response = examService.duplicateExam(sourceExam.getId(), null, teacher);

        assertNotNull(response);
        assertEquals(ExamStatus.DRAFT, response.getStatus());
        assertEquals("[Bản sao] Midterm Math Exam", response.getTitle());
        assertNotEquals("MATH01", response.getAccessCode());
        assertEquals(60, response.getDurationMinutes());
        assertEquals(1, response.getQuestions().size());

        // Verify RabbitMQ is not invoked when there are no images
        verifyNoInteractions(rabbitTemplate);
    }

    @Test
    @DisplayName("Should duplicate exam with images and set status to CLONING, queuing tasks to RabbitMQ")
    void shouldQueueImageDuplicationWhenExamHasImages() {
        when(examRepository.findByIdWithCreatedBy(sourceExam.getId())).thenReturn(Optional.of(sourceExam));
        when(examRepository.existsByAccessCode(anyString())).thenReturn(false);

        Question q1 = Question.builder()
                .id(UUID.randomUUID())
                .orderIndex(1)
                .content("Look at the diagram:")
                .imageUrl("https://res.cloudinary.com/test/diagram.png")
                .imagePublicId("questions/diagram_123")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(5.0)
                .exam(sourceExam)
                .options(new ArrayList<>())
                .build();

        AnswerOption opt1 = AnswerOption.builder()
                .id(UUID.randomUUID())
                .orderIndex(1)
                .content("Option A diagram")
                .imageUrl("https://res.cloudinary.com/test/option_a.png")
                .imagePublicId("options/opt_a_456")
                .isCorrect(true)
                .question(q1)
                .build();
        q1.getOptions().add(opt1);

        when(questionRepository.findByExamIdWithOptions(sourceExam.getId())).thenReturn(List.of(q1));

        when(examRepository.save(any(Exam.class))).thenAnswer(invocation -> {
            Exam e = invocation.getArgument(0);
            if (e.getId() == null) {
                e.setId(UUID.randomUUID());
            }
            return e;
        });

        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> {
            Question q = invocation.getArgument(0);
            if (q.getId() == null) {
                q.setId(UUID.randomUUID());
            }
            return q;
        });

        when(answerOptionRepository.save(any(AnswerOption.class))).thenAnswer(invocation -> {
            AnswerOption o = invocation.getArgument(0);
            if (o.getId() == null) {
                o.setId(UUID.randomUUID());
            }
            return o;
        });

        ExamDuplicateRequest req = ExamDuplicateRequest.builder().title("Custom Cloned Title").build();
        ExamDetailResponse response = examService.duplicateExam(sourceExam.getId(), req, teacher);

        assertNotNull(response);
        assertEquals(ExamStatus.CLONING, response.getStatus());
        assertEquals("Custom Cloned Title", response.getTitle());
        assertNotEquals("MATH01", response.getAccessCode());

        // Verify task dispatched to RabbitMQ with 2 images to duplicate
        ArgumentCaptor<ExamCloneTaskMessage> messageCaptor = ArgumentCaptor.forClass(ExamCloneTaskMessage.class);
        verify(rabbitTemplate, times(1)).convertAndSend(
                eq(RabbitMQConfig.EXAM_CLONE_EXCHANGE),
                eq(RabbitMQConfig.EXAM_CLONE_ROUTING_KEY),
                messageCaptor.capture()
        );

        ExamCloneTaskMessage message = messageCaptor.getValue();
        assertEquals(2, message.getItems().size());
        assertEquals("questions", message.getItems().get(0).getTargetFolder());
        assertEquals("options", message.getItems().get(1).getTargetFolder());
    }

    @Test
    @DisplayName("Should throw AccessDeniedException when another teacher tries to duplicate")
    void shouldRejectDuplicatingForbiddenExam() {
        when(examRepository.findByIdWithCreatedBy(sourceExam.getId())).thenReturn(Optional.of(sourceExam));

        assertThrows(AccessDeniedException.class, () ->
                examService.duplicateExam(sourceExam.getId(), null, otherTeacher));

        verify(examRepository, never()).save(any());
        verifyNoInteractions(rabbitTemplate);
    }
}
