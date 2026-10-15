package com.quicktest.core.util;

import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.session.entity.CandidateAnswer;

import java.util.List;

/**
 * High-performance heuristic token estimator for Google Gemini prompt packing.
 * Estimates token counts for Vietnamese and English texts without external network round-trips.
 * Incorporates a 1.2x safety margin to avoid unexpected rate-limit (TPM) violations.
 */
public final class GeminiTokenEstimator {

    /**
     * Estimated token overhead for the system prompt, instructions, and JSON response schema.
     */
    public static final int BASE_SYSTEM_PROMPT_OVERHEAD = 350;

    /**
     * Estimated token overhead for framing each candidate submission in the prompt.
     */
    public static final int PER_SUBMISSION_PROMPT_OVERHEAD = 40;

    /**
     * Estimated token count generated in Gemini's JSON response per evaluated answer.
     */
    public static final int ESTIMATED_OUTPUT_TOKENS_PER_ANSWER = 120;

    /**
     * Safety multiplier to ensure estimated tokens stay safely under actual API consumption.
     */
    private static final double SAFETY_FACTOR = 1.20;

    private GeminiTokenEstimator() {
        // Utility class
    }

    /**
     * Estimates tokens for raw text.
     * English averages ~4 chars per token, while Vietnamese averages ~2.5 - 3 chars per token.
     */
    public static int estimateTextTokens(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }

        int length = text.trim().length();
        boolean hasVietnameseAccents = containsVietnameseDiacritics(text);

        // Chars per token divisor: 2.8 for accented text, 3.8 for standard ASCII/English
        double divisor = hasVietnameseAccents ? 2.8 : 3.8;
        int rawTokens = (int) Math.ceil(length / divisor);
        return (int) Math.ceil(rawTokens * SAFETY_FACTOR);
    }

    /**
     * Estimates base tokens for the question prompt (question text, rubric, sample answer).
     */
    public static int estimateQuestionBaseTokens(Question question) {
        if (question == null) {
            return BASE_SYSTEM_PROMPT_OVERHEAD;
        }

        int tokens = BASE_SYSTEM_PROMPT_OVERHEAD;
        tokens += estimateTextTokens(question.getContent());
        tokens += estimateTextTokens(question.getGradingRubric());
        tokens += estimateTextTokens(question.getSampleAnswer());

        if (question.getImageUrl() != null && !question.getImageUrl().isBlank()) {
            tokens += 65; // URL reference token cost
        }

        return tokens;
    }

    /**
     * Estimates prompt token cost for a single candidate submission.
     */
    public static int estimateSubmissionTokens(CandidateAnswer answer) {
        if (answer == null) {
            return PER_SUBMISSION_PROMPT_OVERHEAD;
        }
        int tokens = PER_SUBMISSION_PROMPT_OVERHEAD;
        tokens += estimateTextTokens(answer.getTextAnswer());
        return tokens;
    }

    /**
     * Estimates the total input tokens for a batch of candidate submissions with the question.
     */
    public static int estimateBatchInputTokens(Question question, List<CandidateAnswer> batchAnswers) {
        int total = estimateQuestionBaseTokens(question);
        if (batchAnswers != null) {
            for (CandidateAnswer answer : batchAnswers) {
                total += estimateSubmissionTokens(answer);
            }
        }
        return total;
    }

    /**
     * Estimates expected output tokens for a given batch size.
     */
    public static int estimateBatchOutputTokens(int batchSize) {
        return Math.max(1, batchSize) * ESTIMATED_OUTPUT_TOKENS_PER_ANSWER;
    }

    /**
     * Estimates total tokens (input prompt + expected response) for a batch.
     */
    public static int estimateTotalBatchTokens(Question question, List<CandidateAnswer> batchAnswers) {
        int inputTokens = estimateBatchInputTokens(question, batchAnswers);
        int outputTokens = estimateBatchOutputTokens(batchAnswers != null ? batchAnswers.size() : 0);
        return inputTokens + outputTokens;
    }

    /**
     * Detects common Vietnamese diacritic vowel markers in a string.
     */
    private static boolean containsVietnameseDiacritics(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c > 127) {
                // Non-ASCII character (Vietnamese vowels, accents, etc.)
                return true;
            }
        }
        return false;
    }
}
