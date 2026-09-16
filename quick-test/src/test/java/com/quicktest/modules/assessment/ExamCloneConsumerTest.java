package com.quicktest.modules.assessment;

import com.quicktest.core.service.CloudinaryStorageService;
import com.quicktest.modules.assessment.dto.ExamCloneTaskMessage;
import com.quicktest.modules.assessment.dto.MediaUploadResponse;
import com.quicktest.modules.assessment.entity.*;
import com.quicktest.modules.assessment.repository.AnswerOptionRepository;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.assessment.service.ExamCloneConsumer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ExamCloneConsumerTest {

    @Mock
    private CloudinaryStorageService cloudinaryStorageService;

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private AnswerOptionRepository answerOptionRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private ExamCloneConsumer examCloneConsumer;

    private UUID examId;
    private UUID teacherId;
    private Exam exam;

    @BeforeEach
    void setUp() {
        examId = UUID.randomUUID();
        teacherId = UUID.randomUUID();

        exam = Exam.builder()
                .id(examId)
                .title("Cloned Math Exam")
                .status(ExamStatus.CLONING)
                .build();
    }

    @Test
    @DisplayName("Successfully duplicate question and option images and transition exam to DRAFT")
    void testProcessExamClone_Success() {
        UUID questionId = UUID.randomUUID();
        UUID optionId = UUID.randomUUID();

        Question question = Question.builder()
                .id(questionId)
                .content("Question with image")
                .imageUrl("https://res.cloudinary.com/demo/image/upload/v1/source_q.jpg")
                .imagePublicId("source_q_pub")
                .build();

        AnswerOption option = AnswerOption.builder()
                .id(optionId)
                .content("Option with image")
                .imageUrl("https://res.cloudinary.com/demo/image/upload/v1/source_opt.jpg")
                .imagePublicId("source_opt_pub")
                .build();

        ExamCloneTaskMessage message = ExamCloneTaskMessage.builder()
                .newExamId(examId)
                .teacherId(teacherId)
                .items(List.of(
                        ExamCloneTaskMessage.ImageCloneItem.builder()
                                .questionId(questionId)
                                .sourceUrl("https://res.cloudinary.com/demo/image/upload/v1/source_q.jpg")
                                .targetFolder("questions")
                                .build(),
                        ExamCloneTaskMessage.ImageCloneItem.builder()
                                .optionId(optionId)
                                .sourceUrl("https://res.cloudinary.com/demo/image/upload/v1/source_opt.jpg")
                                .targetFolder("options")
                                .build()
                ))
                .build();

        when(cloudinaryStorageService.duplicateImage(eq("https://res.cloudinary.com/demo/image/upload/v1/source_q.jpg"), eq("questions")))
                .thenReturn(MediaUploadResponse.builder()
                        .url("https://res.cloudinary.com/demo/image/upload/v2/new_q.jpg")
                        .publicId("new_q_pub")
                        .build());

        when(cloudinaryStorageService.duplicateImage(eq("https://res.cloudinary.com/demo/image/upload/v1/source_opt.jpg"), eq("options")))
                .thenReturn(MediaUploadResponse.builder()
                        .url("https://res.cloudinary.com/demo/image/upload/v2/new_opt.jpg")
                        .publicId("new_opt_pub")
                        .build());

        when(questionRepository.findById(questionId)).thenReturn(Optional.of(question));
        when(answerOptionRepository.findById(optionId)).thenReturn(Optional.of(option));
        when(examRepository.findById(examId)).thenReturn(Optional.of(exam));

        examCloneConsumer.processExamClone(message);

        // Verify question updated
        assertEquals("https://res.cloudinary.com/demo/image/upload/v2/new_q.jpg", question.getImageUrl());
        assertEquals("new_q_pub", question.getImagePublicId());
        verify(questionRepository).save(question);

        // Verify option updated
        assertEquals("https://res.cloudinary.com/demo/image/upload/v2/new_opt.jpg", option.getImageUrl());
        assertEquals("new_opt_pub", option.getImagePublicId());
        verify(answerOptionRepository).save(option);

        // Verify exam status transitioned to DRAFT
        assertEquals(ExamStatus.DRAFT, exam.getStatus());
        verify(examRepository).save(exam);

        // Verify WebSocket notification sent
        verify(messagingTemplate).convertAndSend(eq("/topic/teachers/" + teacherId + "/notifications"), any(Map.class));
    }

    @Test
    @DisplayName("Cloudinary error during image duplication retains fallback URL and transitions exam to DRAFT")
    void testProcessExamClone_CloudinaryError_StillTransitionsToDraft() {
        UUID questionId = UUID.randomUUID();
        Question question = Question.builder()
                .id(questionId)
                .content("Question with image")
                .imageUrl("https://res.cloudinary.com/demo/image/upload/v1/source_q.jpg")
                .imagePublicId("source_q_pub")
                .build();

        ExamCloneTaskMessage message = ExamCloneTaskMessage.builder()
                .newExamId(examId)
                .teacherId(teacherId)
                .items(List.of(
                        ExamCloneTaskMessage.ImageCloneItem.builder()
                                .questionId(questionId)
                                .sourceUrl("https://res.cloudinary.com/demo/image/upload/v1/source_q.jpg")
                                .targetFolder("questions")
                                .build()
                ))
                .build();

        when(cloudinaryStorageService.duplicateImage(anyString(), anyString()))
                .thenThrow(new RuntimeException("Cloudinary network timeout"));

        when(examRepository.findById(examId)).thenReturn(Optional.of(exam));

        examCloneConsumer.processExamClone(message);

        // Verify question repo save was NOT called due to exception
        verify(questionRepository, never()).save(any());

        // Verify exam status still transitioned to DRAFT
        assertEquals(ExamStatus.DRAFT, exam.getStatus());
        verify(examRepository).save(exam);

        // Verify WebSocket notification sent
        verify(messagingTemplate).convertAndSend(eq("/topic/teachers/" + teacherId + "/notifications"), any(Map.class));
    }
}
