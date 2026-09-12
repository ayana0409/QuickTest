package com.quicktest.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.config.GeminiProperties;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.session.dto.AiBatchGradingResultDto;
import com.quicktest.modules.session.dto.AiSingleGradeDto;
import com.quicktest.modules.session.entity.CandidateAnswer;
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
 * Production implementation of GeminiGradingService executing strict real AI evaluations
 * via Google Gemini REST API. No simulated data is allowed in production.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class GeminiGradingServiceImpl implements GeminiGradingService {

    private final GeminiProperties geminiProperties;
    private final ObjectMapper objectMapper;

    @Override
    public AiBatchGradingResultDto gradeBatch(Question question, List<CandidateAnswer> batchAnswers) {
        if (batchAnswers == null || batchAnswers.isEmpty()) {
            return AiBatchGradingResultDto.builder().results(Collections.emptyList()).build();
        }

        double maxPoints = question.getPoints() != null ? question.getPoints() : 1.0;
        String apiKey = geminiProperties.getApiKey() != null ? geminiProperties.getApiKey().trim() : "";

        // Strictly validate API Key - Fail immediately if missing
        if (apiKey.isEmpty() || apiKey.equalsIgnoreCase("xxx") || apiKey.contains("YOUR_")) {
            String errMsg = "Google Gemini API key is not configured. Cannot perform AI grading. " +
                    "Please configure 'gemini.api-key' in application.properties or set the GEMINI_API_KEY environment variable.";
            log.error(errMsg);
            throw new AppException(errMsg, HttpStatus.BAD_REQUEST);
        }

        String prompt = buildPrompt(question, batchAnswers, maxPoints);
        String url = String.format("%s/%s:generateContent?key=%s",
                geminiProperties.getBaseUrl(),
                geminiProperties.getModel(),
                apiKey);

        log.info("Sending batch AI grading request to Google Gemini API: model={}, batchCount={}",
                geminiProperties.getModel(), batchAnswers.size());

        Map<String, Object> requestPayload = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "temperature", 0.2,
                        "maxOutputTokens", geminiProperties.getMaxTokens()
                )
        );

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        int timeoutMs = geminiProperties.getTimeoutSeconds() > 0 ? geminiProperties.getTimeoutSeconds() * 1000 : 60000;
        requestFactory.setConnectTimeout(Duration.ofMillis(timeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(timeoutMs));

        RestClient restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .build();

        String responseBody;
        try {
            responseBody = restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestPayload)
                    .retrieve()
                    .body(String.class);

        } catch (RestClientResponseException ex) {
            String errorMsg = String.format("Google Gemini API returned error [%s]: %s",
                    ex.getStatusCode(), ex.getResponseBodyAsString());
            log.error("AI grading failed due to Google Gemini API error: {}", errorMsg, ex);
            throw new AppException(errorMsg, HttpStatus.SERVICE_UNAVAILABLE);

        } catch (Exception e) {
            String errorMsg = "Failed to connect to Google Gemini AI service: " + e.getMessage();
            log.error(errorMsg, e);
            throw new AppException(errorMsg, HttpStatus.SERVICE_UNAVAILABLE);
        }

        if (responseBody == null || responseBody.isBlank()) {
            String errMsg = "Empty response received from Google Gemini AI service";
            log.error(errMsg);
            throw new AppException(errMsg, HttpStatus.SERVICE_UNAVAILABLE);
        }

        log.info("Successfully received AI response from Google Gemini. Parsing evaluation results...");
        return parseGeminiResponse(responseBody, batchAnswers, maxPoints);
    }

    /**
     * Constructs a structured grading prompt for Gemini AI with strict JSON output schema.
     */
    private String buildPrompt(Question question, List<CandidateAnswer> batchAnswers, double maxPoints) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are an expert academic evaluator. Evaluate each candidate's essay response strictly based on the rubric, sample answer, and maximum score.\n\n");
        sb.append("--- EXAM QUESTION DETAILS ---\n");
        sb.append("Question: ").append(question.getContent() != null ? question.getContent() : "[No question text, see diagram]").append("\n");
        if (question.getImageUrl() != null && !question.getImageUrl().isBlank()) {
            sb.append("Reference Image URL: ").append(question.getImageUrl()).append("\n");
        }
        sb.append("Maximum Allowed Score: ").append(maxPoints).append("\n");
        sb.append("Sample / Reference Answer: ").append(question.getSampleAnswer() != null ? question.getSampleAnswer() : "None provided").append("\n");
        sb.append("Grading Rubric / Criteria: ").append(question.getGradingRubric() != null ? question.getGradingRubric() : "General accuracy and completeness").append("\n\n");

        sb.append("--- CANDIDATE SUBMISSIONS TO GRADE ---\n");
        for (int i = 0; i < batchAnswers.size(); i++) {
            CandidateAnswer ans = batchAnswers.get(i);
            sb.append(String.format("Submission #%d:\n", i + 1));
            sb.append("candidateAnswerId: ").append(ans.getId().toString()).append("\n");
            sb.append("textAnswer: ").append(ans.getTextAnswer() != null ? ans.getTextAnswer().trim() : "[Empty submission]").append("\n\n");
        }

        sb.append("--- INSTRUCTIONS ---\n");
        sb.append("1. Score each submission between 0.0 and ").append(maxPoints).append(".\n");
        sb.append("2. If textAnswer is empty or completely irrelevant, score MUST be 0.0.\n");
        sb.append("3. Provide concise, constructive feedback explaining the assigned score.\n");
        sb.append("4. Return MUST BE valid JSON strictly adhering to this schema:\n");
        sb.append("{\n");
        sb.append("  \"results\": [\n");
        sb.append("    {\n");
        sb.append("      \"candidateAnswerId\": \"<UUID string>\",\n");
        sb.append("      \"awardedScore\": <number between 0.0 and ").append(maxPoints).append(">,\n");
        sb.append("      \"feedback\": \"<concise feedback string>\"\n");
        sb.append("    }\n");
        sb.append("  ]\n");
        sb.append("}\n");

        return sb.toString();
    }

    /**
     * Parses the JSON payload from Gemini generateContent response.
     */
    private AiBatchGradingResultDto parseGeminiResponse(String responseJson, List<CandidateAnswer> batchAnswers, double maxPoints) {
        try {
            JsonNode root = objectMapper.readTree(responseJson);
            JsonNode candidates = root.path("candidates");
            if (!candidates.isArray() || candidates.isEmpty()) {
                throw new AppException("Google Gemini response does not contain valid evaluation candidates", HttpStatus.SERVICE_UNAVAILABLE);
            }

            JsonNode textPart = candidates.get(0).path("content").path("parts").get(0).path("text");
            String rawJsonText = textPart.asText();

            // Strip possible markdown fences (e.g. ```json ... ```)
            if (rawJsonText.startsWith("```json")) {
                rawJsonText = rawJsonText.substring(7);
            } else if (rawJsonText.startsWith("```")) {
                rawJsonText = rawJsonText.substring(3);
            }
            if (rawJsonText.endsWith("```")) {
                rawJsonText = rawJsonText.substring(0, rawJsonText.length() - 3);
            }
            rawJsonText = rawJsonText.trim();

            AiBatchGradingResultDto dto = objectMapper.readValue(rawJsonText, AiBatchGradingResultDto.class);

            Map<String, AiSingleGradeDto> evaluatedMap = new HashMap<>();
            if (dto.getResults() != null) {
                for (AiSingleGradeDto item : dto.getResults()) {
                    if (item.getCandidateAnswerId() != null) {
                        double score = item.getAwardedScore() != null ? item.getAwardedScore() : 0.0;
                        if (score < 0.0) score = 0.0;
                        if (score > maxPoints) score = maxPoints;
                        item.setAwardedScore(Math.round(score * 100.0) / 100.0);
                        evaluatedMap.put(item.getCandidateAnswerId().trim().toLowerCase(), item);
                    }
                }
            }

            // Verify every candidate answer in the batch has been evaluated by Gemini
            List<AiSingleGradeDto> finalizedResults = new ArrayList<>();
            for (CandidateAnswer ans : batchAnswers) {
                String idStr = ans.getId().toString().toLowerCase();
                AiSingleGradeDto item = evaluatedMap.get(idStr);
                if (item != null) {
                    finalizedResults.add(item);
                } else {
                    throw new AppException(String.format("Google Gemini response did not evaluate candidateAnswerId: %s", ans.getId()),
                            HttpStatus.INTERNAL_SERVER_ERROR);
                }
            }

            return AiBatchGradingResultDto.builder().results(finalizedResults).build();

        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            log.error("Failed to parse Gemini JSON output: {}. Raw response: {}", e.getMessage(), responseJson);
            throw new AppException("Failed to parse Google Gemini grading response: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
