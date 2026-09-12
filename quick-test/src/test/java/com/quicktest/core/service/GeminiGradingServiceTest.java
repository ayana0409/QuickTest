package com.quicktest.core.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.config.GeminiProperties;
import com.quicktest.core.exception.AppException;
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
import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class GeminiGradingServiceTest {

    @Mock
    private GeminiProperties geminiProperties;

    private ObjectMapper objectMapper;
    private GeminiGradingServiceImpl geminiGradingService;
    private Question question;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        geminiGradingService = new GeminiGradingServiceImpl(geminiProperties, objectMapper);

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
    @DisplayName("Should throw BAD_REQUEST when API key is null or blank (Fail-Fast)")
    void testGradeBatch_BlankApiKey_ThrowsException() {
        CandidateAnswer answer = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .textAnswer("It is the process by which plants make food.")
                .build();

        when(geminiProperties.getApiKey()).thenReturn("");

        AppException ex = assertThrows(AppException.class, () ->
                geminiGradingService.gradeBatch(question, List.of(answer)));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Google Gemini API key is not configured"));
    }

    @Test
    @DisplayName("Should throw BAD_REQUEST when API key is placeholder 'xxx' (Fail-Fast)")
    void testGradeBatch_PlaceholderApiKey_ThrowsException() {
        CandidateAnswer answer = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .textAnswer("Plants use sunlight to produce glucose.")
                .build();

        when(geminiProperties.getApiKey()).thenReturn("xxx");

        AppException ex = assertThrows(AppException.class, () ->
                geminiGradingService.gradeBatch(question, List.of(answer)));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Google Gemini API key is not configured"));
    }
}
