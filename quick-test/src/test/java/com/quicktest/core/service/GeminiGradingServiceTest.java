package com.quicktest.core.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.config.GeminiPoolProperties;
import com.quicktest.core.exception.GeminiAllSlotsExhaustedException;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.session.dto.AiBatchGradingResultDto;
import com.quicktest.modules.session.entity.CandidateAnswer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class GeminiGradingServiceTest {

    @Mock
    private GeminiRotationService geminiRotationService;

    @Mock
    private GeminiPoolProperties geminiPoolProperties;

    private ObjectMapper objectMapper;
    private GeminiGradingServiceImpl geminiGradingService;
    private Question question;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        geminiGradingService = new GeminiGradingServiceImpl(geminiRotationService, geminiPoolProperties, objectMapper);

        question = Question.builder()
                .id(UUID.randomUUID())
                .questionType(QuestionType.ESSAY_TEXT)
                .content("Explain photosynthesis in detail.")
                .points(10.0)
                .sampleAnswer("Plants convert light energy into chemical energy.")
                .gradingRubric("Full points for light and dark reactions explained.")
                .build();
    }

    @Test
    @DisplayName("Should return empty result when batch list is empty")
    void testGradeBatch_EmptyList_ReturnsEmptyResult() {
        AiBatchGradingResultDto result = geminiGradingService.gradeBatch(question, Collections.emptyList());

        assertNotNull(result);
        assertNotNull(result.getResults());
        assertTrue(result.getResults().isEmpty());
    }

    @Test
    @DisplayName("Should successfully grade batch and parse JSON response from rotation service")
    void testGradeBatch_Success() {
        UUID answerId = UUID.randomUUID();
        CandidateAnswer answer = CandidateAnswer.builder()
                .id(answerId)
                .textAnswer("Plants convert solar energy into glucose.")
                .build();

        when(geminiPoolProperties.getMaxTokens()).thenReturn(4000);

        String mockJsonResponse = String.format("""
                {
                  "candidates": [
                    {
                      "content": {
                        "parts": [
                          {
                            "text": "{\\"results\\": [{\\"candidateAnswerId\\": \\"%s\\", \\"awardedScore\\": 8.5, \\"feedback\\": \\"Well explained\\"}]}"
                          }
                        ]
                      }
                    }
                  ]
                }
                """, answerId);

        when(geminiRotationService.executeWithRotation(anyString(), eq(0.2), eq(4000)))
                .thenReturn(mockJsonResponse);

        AiBatchGradingResultDto result = geminiGradingService.gradeBatch(question, List.of(answer));

        assertNotNull(result);
        assertEquals(1, result.getResults().size());
        assertEquals(8.5, result.getResults().get(0).getAwardedScore());
        assertEquals("Well explained", result.getResults().get(0).getFeedback());
    }

    @Test
    @DisplayName("Should propagate GeminiAllSlotsExhaustedException when all pool slots are rate-limited")
    void testGradeBatch_AllSlotsExhausted_ThrowsException() {
        CandidateAnswer answer = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .textAnswer("Some answer text.")
                .build();

        when(geminiPoolProperties.getMaxTokens()).thenReturn(4000);
        when(geminiRotationService.executeWithRotation(anyString(), anyDouble(), anyInt()))
                .thenThrow(new GeminiAllSlotsExhaustedException("All 4 Gemini slots are rate-limited."));

        assertThrows(GeminiAllSlotsExhaustedException.class, () ->
                geminiGradingService.gradeBatch(question, List.of(answer)));
    }
}
