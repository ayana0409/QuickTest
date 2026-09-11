package com.quicktest.modules.assessment;

import com.quicktest.core.exception.AppException;
import com.quicktest.core.service.CloudinaryStorageService;
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

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class QuestionImageTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private CloudinaryStorageService cloudinaryStorageService;

    @InjectMocks
    private QuestionServiceImpl questionService;

    private User teacher;
    private Exam draftExam;

    @BeforeEach
    void setUp() {
        teacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Teacher Alice")
                .role(Role.TEACHER)
                .build();

        draftExam = Exam.builder()
                .id(UUID.randomUUID())
                .title("Biology Exam")
                .status(ExamStatus.DRAFT)
                .createdBy(teacher)
                .build();
    }

    @Test
    @DisplayName("Should create question with image URL successfully")
    void testCreateQuestion_WithImageUrl_Success() {
        QuestionCreateRequest request = QuestionCreateRequest.builder()
                .content("Identify the following structure:")
                .imageUrl("https://res.cloudinary.com/test/image/upload/cell.png")
                .imagePublicId("quick-test/questions/cell")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(2.0)
                .options(List.of(
                        AnswerOptionDto.builder().content("Chloroplast").isCorrect(true).build(),
                        AnswerOptionDto.builder().content("Mitochondria").isCorrect(false).build()
                ))
                .build();

        when(examRepository.findByIdWithCreatedBy(draftExam.getId())).thenReturn(Optional.of(draftExam));
        when(questionRepository.countByExamId(draftExam.getId())).thenReturn(0L);
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> {
            Question q = invocation.getArgument(0);
            q.setId(UUID.randomUUID());
            return q;
        });

        QuestionResponse response = questionService.addQuestionToExam(draftExam.getId(), request, teacher);

        assertNotNull(response);
        assertEquals("https://res.cloudinary.com/test/image/upload/cell.png", response.getImageUrl());
        assertEquals("quick-test/questions/cell", response.getImagePublicId());
        verify(questionRepository, times(1)).save(any(Question.class));
    }

    @Test
    @DisplayName("Should create question with image only (null content) successfully")
    void testCreateQuestion_ImageOnly_Success() {
        QuestionCreateRequest request = QuestionCreateRequest.builder()
                .content(null)
                .imageUrl("https://res.cloudinary.com/test/image/upload/geometry.png")
                .imagePublicId("quick-test/questions/geometry")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(1.5)
                .options(List.of(
                        AnswerOptionDto.builder().content("A").isCorrect(true).build(),
                        AnswerOptionDto.builder().content("B").isCorrect(false).build()
                ))
                .build();

        when(examRepository.findByIdWithCreatedBy(draftExam.getId())).thenReturn(Optional.of(draftExam));
        when(questionRepository.countByExamId(draftExam.getId())).thenReturn(0L);
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> {
            Question q = invocation.getArgument(0);
            q.setId(UUID.randomUUID());
            return q;
        });

        QuestionResponse response = questionService.addQuestionToExam(draftExam.getId(), request, teacher);

        assertNotNull(response);
        assertNull(response.getContent());
        assertEquals("https://res.cloudinary.com/test/image/upload/geometry.png", response.getImageUrl());
    }

    @Test
    @DisplayName("Should throw exception when neither content nor imageUrl is provided")
    void testCreateQuestion_NeitherContentNorImage_ThrowsException() {
        QuestionCreateRequest request = QuestionCreateRequest.builder()
                .content(null)
                .imageUrl(null)
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(1.0)
                .options(List.of(
                        AnswerOptionDto.builder().content("A").isCorrect(true).build(),
                        AnswerOptionDto.builder().content("B").isCorrect(false).build()
                ))
                .build();

        when(examRepository.findByIdWithCreatedBy(draftExam.getId())).thenReturn(Optional.of(draftExam));

        AppException ex = assertThrows(AppException.class, () ->
                questionService.addQuestionToExam(draftExam.getId(), request, teacher));

        assertTrue(ex.getMessage().contains("Question must have either text content or an image URL"));
        verify(questionRepository, never()).save(any(Question.class));
    }

    @Test
    @DisplayName("Should throw exception when answer option has neither content nor imageUrl")
    void testCreateQuestion_OptionNeitherContentNorImage_ThrowsException() {
        QuestionCreateRequest request = QuestionCreateRequest.builder()
                .content("Valid question text")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(1.0)
                .options(List.of(
                        AnswerOptionDto.builder().content("Valid option 1").isCorrect(true).build(),
                        AnswerOptionDto.builder().content(null).imageUrl(null).isCorrect(false).build()
                ))
                .build();

        when(examRepository.findByIdWithCreatedBy(draftExam.getId())).thenReturn(Optional.of(draftExam));

        AppException ex = assertThrows(AppException.class, () ->
                questionService.addQuestionToExam(draftExam.getId(), request, teacher));

        assertTrue(ex.getMessage().contains("Answer option must have either text content or an image URL"));
        verify(questionRepository, never()).save(any(Question.class));
    }

    @Test
    @DisplayName("Should upload new image and delete previous image when updateQuestionImage is called")
    void testUpdateQuestionImage_Success() {
        UUID questionId = UUID.randomUUID();
        Question existingQuestion = Question.builder()
                .id(questionId)
                .exam(draftExam)
                .content("Existing content")
                .imageUrl("https://res.cloudinary.com/test/old.png")
                .imagePublicId("quick-test/questions/old_public_id")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(1.0)
                .options(new ArrayList<>())
                .build();

        org.springframework.mock.web.MockMultipartFile newFile =
                new org.springframework.mock.web.MockMultipartFile("file", "new.png", "image/png", new byte[]{1, 2, 3});

        when(questionRepository.findByIdWithOptionsAndExam(questionId)).thenReturn(Optional.of(existingQuestion));
        when(cloudinaryStorageService.uploadSingle(eq(newFile), eq("questions"))).thenReturn(
                com.quicktest.modules.assessment.dto.MediaUploadResponse.builder()
                        .url("https://res.cloudinary.com/test/new.png")
                        .publicId("quick-test/questions/new_public_id")
                        .build()
        );
        when(questionRepository.save(any(Question.class))).thenAnswer(i -> i.getArgument(0));

        QuestionResponse response = questionService.updateQuestionImage(questionId, newFile, teacher);

        assertNotNull(response);
        assertEquals("https://res.cloudinary.com/test/new.png", response.getImageUrl());
        assertEquals("quick-test/questions/new_public_id", response.getImagePublicId());

        // Verify old image was deleted from Cloudinary
        verify(cloudinaryStorageService, times(1)).deleteMedia("quick-test/questions/old_public_id");
        verify(questionRepository, times(1)).save(existingQuestion);
    }

    @Test
    @DisplayName("Should delete both question image and option images when deleteQuestion is called")
    void testDeleteQuestion_DeletesImages() {
        UUID questionId = UUID.randomUUID();
        com.quicktest.modules.assessment.entity.AnswerOption opt =
                com.quicktest.modules.assessment.entity.AnswerOption.builder()
                        .id(UUID.randomUUID())
                        .content("Option A")
                        .imageUrl("https://res.cloudinary.com/test/opt.png")
                        .imagePublicId("quick-test/options/opt_public_id")
                        .isCorrect(true)
                        .build();

        List<com.quicktest.modules.assessment.entity.AnswerOption> options = new ArrayList<>();
        options.add(opt);

        Question question = Question.builder()
                .id(questionId)
                .exam(draftExam)
                .content("Question to delete")
                .imageUrl("https://res.cloudinary.com/test/q.png")
                .imagePublicId("quick-test/questions/q_public_id")
                .questionType(QuestionType.SINGLE_CHOICE)
                .points(1.0)
                .options(options)
                .build();

        when(questionRepository.findByIdWithOptionsAndExam(questionId)).thenReturn(Optional.of(question));

        questionService.deleteQuestion(questionId, teacher);

        // Verify media deletion called for question and option
        verify(cloudinaryStorageService, times(1)).deleteMedia("quick-test/questions/q_public_id");
        verify(cloudinaryStorageService, times(1)).deleteMedia("quick-test/options/opt_public_id");
        verify(questionRepository, times(1)).delete(question);
    }
}
