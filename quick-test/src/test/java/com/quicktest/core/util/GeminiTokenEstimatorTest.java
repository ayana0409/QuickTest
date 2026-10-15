package com.quicktest.core.util;

import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.session.entity.CandidateAnswer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class GeminiTokenEstimatorTest {

    @Test
    @DisplayName("Should estimate 0 tokens for null or blank text")
    void testEstimateTextTokens_NullOrBlank() {
        assertEquals(0, GeminiTokenEstimator.estimateTextTokens(null));
        assertEquals(0, GeminiTokenEstimator.estimateTextTokens(""));
        assertEquals(0, GeminiTokenEstimator.estimateTextTokens("   "));
    }

    @Test
    @DisplayName("Should estimate English text tokens with safety factor")
    void testEstimateTextTokens_English() {
        String text = "The Industrial Revolution marked a period of rapid development and urbanization.";
        int tokens = GeminiTokenEstimator.estimateTextTokens(text);
        assertTrue(tokens > 15, "Tokens should be estimated for sentence");
        assertTrue(tokens < 60, "Tokens should not wildly exceed reasonable bounds");
    }

    @Test
    @DisplayName("Should estimate Vietnamese text with diacritics using lower divisor")
    void testEstimateTextTokens_Vietnamese() {
        String viText = "Cách mạng công nghiệp đã thay đổi hoàn toàn cơ cấu kinh tế và đời sống xã hội.";
        int viTokens = GeminiTokenEstimator.estimateTextTokens(viText);

        assertTrue(viTokens > 20);
    }

    @Test
    @DisplayName("Should estimate question base tokens including prompt overhead")
    void testEstimateQuestionBaseTokens() {
        Question q = Question.builder()
                .content("Phân tích tác động của biến đổi khí hậu đối với đồng bằng sông Cửu Long.")
                .gradingRubric("Đánh giá các khía cạnh: ngập mặn, hạn hán, kinh tế nông nghiệp.")
                .sampleAnswer("Đồng bằng sông Cửu Long chịu ảnh hưởng nặng nề bởi xâm nhập mặn...")
                .imageUrl("https://cdn.quicktest.vn/diagram1.png")
                .build();

        int tokens = GeminiTokenEstimator.estimateQuestionBaseTokens(q);
        assertTrue(tokens > GeminiTokenEstimator.BASE_SYSTEM_PROMPT_OVERHEAD, "Base tokens should exceed system prompt overhead");
    }

    @Test
    @DisplayName("Should estimate batch tokens accurately across multiple submissions")
    void testEstimateTotalBatchTokens() {
        Question q = Question.builder()
                .content("What is photosynthesis?")
                .build();

        CandidateAnswer ans1 = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .textAnswer("Process by which green plants use sunlight to synthesize nutrients.")
                .build();

        CandidateAnswer ans2 = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .textAnswer("Plants converting carbon dioxide and water into oxygen and glucose.")
                .build();

        int totalTokens = GeminiTokenEstimator.estimateTotalBatchTokens(q, List.of(ans1, ans2));
        int expectedOutput = GeminiTokenEstimator.estimateBatchOutputTokens(2);

        assertTrue(totalTokens > expectedOutput);
        assertTrue(totalTokens > GeminiTokenEstimator.BASE_SYSTEM_PROMPT_OVERHEAD);
    }
}
