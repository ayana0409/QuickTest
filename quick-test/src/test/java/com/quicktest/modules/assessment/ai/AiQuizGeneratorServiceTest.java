package com.quicktest.modules.assessment.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.config.GeminiPoolProperties;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.service.GeminiRotationService;
import com.quicktest.modules.assessment.ai.dto.AiGenerateQuizRequest;
import com.quicktest.modules.assessment.ai.dto.AiGeneratedQuestionDto;
import com.quicktest.modules.assessment.ai.service.AiQuizGeneratorService;
import com.quicktest.modules.assessment.entity.QuestionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AiQuizGeneratorService Unit Tests")
class AiQuizGeneratorServiceTest {

    @Mock
    private GeminiRotationService geminiRotationService;

    private GeminiPoolProperties geminiPoolProperties;
    private ObjectMapper objectMapper;
    private AiQuizGeneratorService aiQuizGeneratorService;

    @BeforeEach
    void setUp() {
        geminiPoolProperties = new GeminiPoolProperties();
        geminiPoolProperties.setMaxTokens(4000);
        objectMapper = new ObjectMapper();
        aiQuizGeneratorService = new AiQuizGeneratorService(geminiRotationService, geminiPoolProperties, objectMapper);
    }

    @Test
    @DisplayName("Should successfully parse JSON output from Gemini and map to Question DTOs")
    void testGenerateQuestions_Success() {
        String mockAiResponse = """
                ```json
                {
                  "questions": [
                    {
                      "content": "Tính chất nào sau đây là đặc trưng của lập trình hướng đối tượng?",
                      "questionType": "SINGLE_CHOICE",
                      "points": 1.0,
                      "explanation": "Đóng gói (Encapsulation) là một trong 4 trụ cột chính của OOP.",
                      "difficulty": "EASY",
                      "options": [
                        { "orderIndex": 0, "content": "Đóng gói (Encapsulation)", "isCorrect": true },
                        { "orderIndex": 1, "content": "Con trỏ hàm (Function pointer)", "isCorrect": false },
                        { "orderIndex": 2, "content": "Bộ nhớ chia sẻ (Shared memory)", "isCorrect": false },
                        { "orderIndex": 3, "content": "Biên dịch JIT", "isCorrect": false }
                      ]
                    },
                    {
                      "content": "Trình bày sự khác nhau giữa Overloading và Overriding trong Java?",
                      "questionType": "ESSAY_TEXT",
                      "points": 2.0,
                      "explanation": "Overloading xảy ra trong cùng class với tên hàm giống nhau khác tham số; Overriding xảy ra giữa cha và con.",
                      "difficulty": "MEDIUM",
                      "sampleAnswer": "Overloading: Compile-time polymorphism. Overriding: Runtime polymorphism.",
                      "gradingRubric": "- Nêu đúng định nghĩa Overloading: 1đ\\n- Nêu đúng định nghĩa Overriding: 1đ",
                      "options": []
                    }
                  ]
                }
                ```
                """;

        when(geminiRotationService.executeWithRotation(anyString(), anyDouble(), anyInt()))
                .thenReturn(mockAiResponse);

        AiGenerateQuizRequest request = AiGenerateQuizRequest.builder()
                .totalQuestions(2)
                .difficulty("BALANCED")
                .language("vi")
                .targetQuestionTypes(List.of(QuestionType.SINGLE_CHOICE, QuestionType.ESSAY_TEXT))
                .build();

        List<AiGeneratedQuestionDto> questions = aiQuizGeneratorService.generateQuestions("Sample lesson content...", request);

        assertNotNull(questions);
        assertEquals(2, questions.size());

        AiGeneratedQuestionDto q1 = questions.get(0);
        assertEquals(QuestionType.SINGLE_CHOICE, q1.getQuestionType());
        assertEquals("Tính chất nào sau đây là đặc trưng của lập trình hướng đối tượng?", q1.getContent());
        assertEquals(4, q1.getOptions().size());
        assertTrue(q1.getOptions().get(0).getIsCorrect());

        AiGeneratedQuestionDto q2 = questions.get(1);
        assertEquals(QuestionType.ESSAY_TEXT, q2.getQuestionType());
        assertNotNull(q2.getSampleAnswer());
        assertNotNull(q2.getGradingRubric());
    }

    @Test
    @DisplayName("Should throw BAD_REQUEST when input document text is empty")
    void testGenerateQuestions_EmptyDocument_ThrowsBadRequest() {
        AiGenerateQuizRequest request = AiGenerateQuizRequest.builder().totalQuestions(5).build();

        AppException ex = assertThrows(AppException.class, () ->
                aiQuizGeneratorService.generateQuestions("", request));

        assertEquals(400, ex.getStatus().value());
    }

    @Test
    @DisplayName("Should throw SERVICE_UNAVAILABLE when AI returns blank response")
    void testGenerateQuestions_BlankAiResponse_ThrowsServiceUnavailable() {
        when(geminiRotationService.executeWithRotation(anyString(), anyDouble(), anyInt()))
                .thenReturn("");

        AiGenerateQuizRequest request = AiGenerateQuizRequest.builder().totalQuestions(5).build();

        AppException ex = assertThrows(AppException.class, () ->
                aiQuizGeneratorService.generateQuestions("Valid document text...", request));

        assertEquals(503, ex.getStatus().value());
    }
}
