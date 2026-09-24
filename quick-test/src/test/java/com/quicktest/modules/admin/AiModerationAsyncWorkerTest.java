package com.quicktest.modules.admin;

import com.quicktest.config.GeminiProperties;
import com.quicktest.core.service.AiModerationService;
import com.quicktest.modules.admin.dto.AiModerationResultDto;
import com.quicktest.modules.admin.service.AiModerationAsyncWorker;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AiModerationAsyncWorker.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AiModerationAsyncWorkerTest {

    @Mock
    private AiModerationService aiModerationService;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private GeminiProperties geminiProperties;

    @InjectMocks
    private AiModerationAsyncWorker worker;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(geminiProperties.getModerationBatchSize()).thenReturn(30);
        lenient().when(geminiProperties.getMaxInputTokensPerMinute()).thenReturn(50000);
    }

    @Test
    @DisplayName("runModerationJob: successfully processes batch, marks safe and unsafe, and completes")
    void runModerationJob_ProcessesBatchSuccessfully() {
        UUID qId1 = UUID.randomUUID();
        UUID qId2 = UUID.randomUUID();

        Question q1 = Question.builder().id(qId1).content("Safe question").build();
        Question q2 = Question.builder().id(qId2).content("Unsafe question").build();

        when(valueOperations.get("ai:moderation:lastProcessedId")).thenReturn(null);
        when(questionRepository.findTextOnlyUnreviewedForModeration(null, 30))
                .thenReturn(List.of(qId1.toString(), qId2.toString()));
        when(questionRepository.findAllByIdInWithOptionsAndExam(List.of(qId1, qId2)))
                .thenReturn(List.of(q1, q2));

        AiModerationResultDto resultDto = AiModerationResultDto.builder()
                .results(List.of(
                        AiModerationResultDto.AiQuestionVerdict.builder().questionId(qId1.toString()).safe(true).build(),
                        AiModerationResultDto.AiQuestionVerdict.builder().questionId(qId2.toString()).safe(false).build()
                ))
                .build();

        when(aiModerationService.moderateBatch(anyList())).thenReturn(resultDto);
        when(questionRepository.bulkMarkAsSafe(anyString())).thenReturn(1);
        when(questionRepository.bulkMarkAsUnsafe(anyString())).thenReturn(1);

        worker.runModerationJob();

        verify(questionRepository).bulkMarkAsSafe(contains(qId1.toString()));
        verify(questionRepository).bulkMarkAsUnsafe(contains(qId2.toString()));
        verify(redisTemplate).delete("ai:moderation:running");
    }

    @Test
    @DisplayName("runModerationJob: exits cleanly when no unreviewed questions are found")
    void runModerationJob_WhenNoQuestions_ExitsCleanly() {
        when(valueOperations.get("ai:moderation:lastProcessedId")).thenReturn(null);
        when(questionRepository.findTextOnlyUnreviewedForModeration(null, 30))
                .thenReturn(Collections.emptyList());

        worker.runModerationJob();

        verify(aiModerationService, never()).moderateBatch(any());
        verify(questionRepository, never()).bulkMarkAsSafe(any());
        verify(questionRepository, never()).bulkMarkAsUnsafe(any());
        verify(redisTemplate).delete("ai:moderation:running");
    }

    @Test
    @DisplayName("runModerationJob: stops immediately and preserves cursor when AI call throws exception")
    void runModerationJob_WhenAiCallFails_PreservesCursorAndStops() {
        UUID qId = UUID.randomUUID();
        Question q = Question.builder().id(qId).content("Some question").build();

        when(valueOperations.get("ai:moderation:lastProcessedId")).thenReturn("prev-cursor");
        when(questionRepository.findTextOnlyUnreviewedForModeration("prev-cursor", 30))
                .thenReturn(List.of(qId.toString()));
        when(questionRepository.findAllByIdInWithOptionsAndExam(List.of(qId)))
                .thenReturn(List.of(q));
        when(aiModerationService.moderateBatch(anyList()))
                .thenThrow(new RuntimeException("Gemini quota error"));

        worker.runModerationJob();

        verify(questionRepository, never()).bulkMarkAsSafe(any());
        verify(questionRepository, never()).bulkMarkAsUnsafe(any());
        // running flag must be cleared in finally
        verify(redisTemplate).delete("ai:moderation:running");
    }

    @Test
    @DisplayName("isJobRunning: returns true when Redis running key is true")
    void isJobRunning_WhenRedisRunning_ReturnsTrue() {
        when(valueOperations.get("ai:moderation:running")).thenReturn("true");
        assertTrue(worker.isJobRunning());
    }

    @Test
    @DisplayName("getLastProcessedId: returns cursor from Redis")
    void getLastProcessedId_ReturnsRedisCursor() {
        when(valueOperations.get("ai:moderation:lastProcessedId")).thenReturn("saved-cursor-id");
        assertEquals("saved-cursor-id", worker.getLastProcessedId());
    }

    @Test
    @DisplayName("resetCursor: deletes lastProcessedId key from Redis")
    void resetCursor_DeletesRedisKey() {
        worker.resetCursor();
        verify(redisTemplate).delete("ai:moderation:lastProcessedId");
    }
}
