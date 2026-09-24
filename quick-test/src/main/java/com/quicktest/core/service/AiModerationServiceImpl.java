package com.quicktest.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.config.GeminiProperties;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.admin.dto.AiModerationResultDto;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.*;

/**
 * Concrete implementation of AiModerationService.
 * Sends text-only questions/answers to Google Gemini for content safety classification.
 * Returns per-question verdicts: safe (true) or unsafe (false).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AiModerationServiceImpl implements AiModerationService {

    private final GeminiProperties geminiProperties;
    private final ObjectMapper objectMapper;

    @Override
    public AiModerationResultDto moderateBatch(List<Question> questions) {
        if (questions == null || questions.isEmpty()) {
            return AiModerationResultDto.builder().results(Collections.emptyList()).build();
        }

        // Validate API key is configured before making an API call
        String apiKey = geminiProperties.getApiKey() != null ? geminiProperties.getApiKey().trim() : "";
        if (apiKey.isEmpty() || apiKey.equalsIgnoreCase("xxx") || apiKey.contains("YOUR_")) {
            String errMsg = "Google Gemini API key is not configured. Cannot perform AI moderation. " +
                    "Please configure 'gemini.api-key' in application.properties.";
            log.error(errMsg);
            throw new AppException(errMsg, HttpStatus.BAD_REQUEST);
        }

        // Build a single structured prompt for the entire batch
        String prompt = buildModerationPrompt(questions);
        String url = String.format("%s/%s:generateContent?key=%s",
                geminiProperties.getBaseUrl(),
                geminiProperties.getModel(),
                apiKey);

        log.info("[AI Moderation] Sending batch of {} questions to Gemini for content safety analysis",
                questions.size());

        // Build request payload with JSON mode enabled for structured output
        Map<String, Object> requestPayload = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "temperature", 0.1,   // Very low temperature for deterministic safety decisions
                        "maxOutputTokens", geminiProperties.getMaxTokens()
                )
        );

        // Configure HTTP client with timeout
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        int timeoutMs = geminiProperties.getTimeoutSeconds() > 0 ? geminiProperties.getTimeoutSeconds() * 1000 : 60000;
        requestFactory.setConnectTimeout(Duration.ofMillis(timeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(timeoutMs));

        RestClient restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .build();

        // Execute the API call with full error capture
        String responseBody;
        try {
            responseBody = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestPayload)
                    .retrieve()
                    .body(String.class);

        } catch (RestClientResponseException ex) {
            String errorMsg = String.format("[AI Moderation] Gemini API returned HTTP error [%s]: %s",
                    ex.getStatusCode(), ex.getResponseBodyAsString());
            log.error(errorMsg, ex);
            throw new AppException(errorMsg, HttpStatus.SERVICE_UNAVAILABLE);

        } catch (Exception e) {
            String errorMsg = "[AI Moderation] Failed to connect to Gemini AI service: " + e.getMessage();
            log.error(errorMsg, e);
            throw new AppException(errorMsg, HttpStatus.SERVICE_UNAVAILABLE);
        }

        // Validate non-empty response
        if (responseBody == null || responseBody.isBlank()) {
            String errMsg = "[AI Moderation] Empty response received from Gemini AI service";
            log.error(errMsg);
            throw new AppException(errMsg, HttpStatus.SERVICE_UNAVAILABLE);
        }

        log.info("[AI Moderation] Received response from Gemini. Parsing safety verdicts...");
        return parseGeminiModerationResponse(responseBody, questions);
    }

    /**
     * Constructs a structured content moderation prompt for Gemini.
     * Each question and its text answers are included as structured blocks.
     * The output format strictly enforces per-question JSON verdicts.
     */
    private String buildModerationPrompt(List<Question> questions) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are a strict content safety moderator for an online examination platform used by educational institutions. ");
        sb.append("Your task is to evaluate whether each exam question and its associated answer options contain safe, appropriate content.\n\n");

        sb.append("CONTENT SAFETY RULES:\n");
        sb.append("- Mark as UNSAFE (safe: false) if the question or any answer option contains:\n");
        sb.append("  * Explicit sexual content, nudity, or pornographic references\n");
        sb.append("  * Hate speech, racial slurs, or discrimination against any group\n");
        sb.append("  * Violent or graphic content unrelated to educational topics\n");
        sb.append("  * Instructions for illegal activities (drug manufacturing, weapons, hacking, etc.)\n");
        sb.append("  * Personal information or privacy violations (real names with sensitive data)\n");
        sb.append("  * Severe profanity or deeply offensive language\n");
        sb.append("- Mark as SAFE (safe: true) if the content is:\n");
        sb.append("  * Standard academic question content (math, science, literature, history, etc.)\n");
        sb.append("  * Questions containing mild sensitive topics handled in an educational context\n");
        sb.append("  * Professional, neutral language appropriate for a school/university setting\n\n");

        sb.append("QUESTIONS TO EVALUATE:\n\n");
        for (int i = 0; i < questions.size(); i++) {
            Question q = questions.get(i);
            sb.append(String.format("--- Question #%d ---\n", i + 1));
            sb.append("questionId: ").append(q.getId().toString()).append("\n");
            sb.append("content: ").append(q.getContent() != null ? q.getContent().trim() : "[No content]").append("\n");

            // Include sample answer / rubric for essay-type questions
            if (q.getSampleAnswer() != null && !q.getSampleAnswer().isBlank()) {
                sb.append("sampleAnswer: ").append(q.getSampleAnswer().trim()).append("\n");
            }
            if (q.getGradingRubric() != null && !q.getGradingRubric().isBlank()) {
                sb.append("gradingRubric: ").append(q.getGradingRubric().trim()).append("\n");
            }

            // Include all answer options text
            if (q.getOptions() != null && !q.getOptions().isEmpty()) {
                sb.append("answerOptions:\n");
                for (AnswerOption opt : q.getOptions()) {
                    if (opt.getContent() != null && !opt.getContent().isBlank()) {
                        sb.append("  - ").append(opt.getContent().trim()).append("\n");
                    }
                }
            }
            sb.append("\n");
        }

        sb.append("REQUIRED OUTPUT FORMAT (strictly follow this JSON schema, no extra text):\n");
        sb.append("{\n");
        sb.append("  \"results\": [\n");
        sb.append("    {\n");
        sb.append("      \"questionId\": \"<UUID string of the question>\",\n");
        sb.append("      \"safe\": <true if content is safe, false if unsafe>\n");
        sb.append("    }\n");
        sb.append("  ]\n");
        sb.append("}\n\n");
        sb.append("Rules:\n");
        sb.append("- Return exactly one result entry per question, in the same order.\n");
        sb.append("- The 'safe' field MUST be a boolean (true/false), not a string.\n");
        sb.append("- Include every questionId from the input list.\n");
        sb.append("- Output ONLY the JSON object, no explanations or markdown.\n");

        return sb.toString();
    }

    /**
     * Parses the Gemini generateContent response to extract per-question safety verdicts.
     * Validates that every question in the batch received a verdict.
     */
    private AiModerationResultDto parseGeminiModerationResponse(String responseJson, List<Question> questions) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode candidates = root.path("candidates");
            if (!candidates.isArray() || candidates.isEmpty()) {
                throw new AppException("[AI Moderation] Gemini response does not contain valid candidates",
                        HttpStatus.SERVICE_UNAVAILABLE);
            }

            // Extract the text content from the first candidate's first part
            JsonNode textPart = candidates.get(0).path("content").path("parts").get(0).path("text");
            String rawJsonText = textPart.asText();

            // Strip markdown code fences if present
            if (rawJsonText.startsWith("```json")) {
                rawJsonText = rawJsonText.substring(7);
            } else if (rawJsonText.startsWith("```")) {
                rawJsonText = rawJsonText.substring(3);
            }
            if (rawJsonText.endsWith("```")) {
                rawJsonText = rawJsonText.substring(0, rawJsonText.length() - 3);
            }
            rawJsonText = rawJsonText.trim();

            // Parse into DTO
            AiModerationResultDto dto = objectMapper.readValue(rawJsonText, AiModerationResultDto.class);

            // Build lookup map: questionId (lowercase) -> verdict
            Map<String, AiModerationResultDto.AiQuestionVerdict> verdictMap = new HashMap<>();
            if (dto.getResults() != null) {
                for (AiModerationResultDto.AiQuestionVerdict verdict : dto.getResults()) {
                    if (verdict.getQuestionId() != null) {
                        verdictMap.put(verdict.getQuestionId().trim().toLowerCase(), verdict);
                    }
                }
            }

            // Validate all questions were evaluated and build final result
            List<AiModerationResultDto.AiQuestionVerdict> finalResults = new ArrayList<>();
            for (Question q : questions) {
                String qIdStr = q.getId().toString().toLowerCase();
                AiModerationResultDto.AiQuestionVerdict verdict = verdictMap.get(qIdStr);
                if (verdict == null) {
                    // If Gemini did not return a verdict for this question, fail the batch
                    throw new AppException(
                            String.format("[AI Moderation] Gemini did not return a verdict for questionId: %s", q.getId()),
                            HttpStatus.INTERNAL_SERVER_ERROR);
                }
                // Default to unsafe if safe field is null
                if (verdict.getSafe() == null) {
                    verdict.setSafe(false);
                }
                finalResults.add(verdict);
            }

            log.info("[AI Moderation] Successfully parsed {} safety verdicts from Gemini", finalResults.size());
            return AiModerationResultDto.builder().results(finalResults).build();

        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            log.error("[AI Moderation] Failed to parse Gemini JSON output: {}. Raw response: {}", e.getMessage(), responseJson);
            throw new AppException(
                    "[AI Moderation] Failed to parse Gemini moderation response: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
