package com.quicktest.modules.assessment.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.config.GeminiPoolProperties;
import com.quicktest.core.exception.AppException;
import com.quicktest.core.service.GeminiRotationService;
import com.quicktest.modules.assessment.ai.dto.AiGenerateQuizRequest;
import com.quicktest.modules.assessment.ai.dto.AiGeneratedOptionDto;
import com.quicktest.modules.assessment.ai.dto.AiGeneratedQuestionDto;
import com.quicktest.modules.assessment.entity.QuestionType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service that constructs structured prompts and coordinates with GeminiRotationService
 * to generate curriculum-aligned quiz questions from parsed text content.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AiQuizGeneratorService {

    private final GeminiRotationService geminiRotationService;
    private final GeminiPoolProperties geminiPoolProperties;
    private final ObjectMapper objectMapper;

    /**
     * Generates a list of quiz questions from document text based on configuration parameters.
     */
    public List<AiGeneratedQuestionDto> generateQuestions(String documentText, AiGenerateQuizRequest request) {
        if (documentText == null || documentText.isBlank()) {
            throw new AppException("Document text content is empty", HttpStatus.BAD_REQUEST);
        }

        int totalCount = request.getTotalQuestions() != null ? request.getTotalQuestions() : 10;
        String prompt = buildPrompt(documentText, request);

        log.info("[AiQuizGenerator] Prompting Gemini Rotation Pool for {} questions (language: {}, difficulty: {})...",
                totalCount, request.getLanguage(), request.getDifficulty());

        // Target up to 4,000 max output tokens for questions JSON
        int maxTokens = geminiPoolProperties.getMaxTokens() > 0 ? geminiPoolProperties.getMaxTokens() : 4000;
        String responseJson = geminiRotationService.executeWithRotation(prompt, 0.3, maxTokens);

        if (responseJson == null || responseJson.isBlank()) {
            throw new AppException("Empty response received from AI model when generating quiz questions",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }

        return parseGeminiResponse(responseJson);
    }

    /**
     * Builds a comprehensive prompt instructing Gemini to produce valid JSON questions.
     */
    private String buildPrompt(String documentText, AiGenerateQuizRequest request) {
        int count = request.getTotalQuestions() != null ? request.getTotalQuestions() : 10;
        String language = "en".equalsIgnoreCase(request.getLanguage()) ? "English" : "Vietnamese";
        String difficulty = request.getDifficulty() != null ? request.getDifficulty() : "BALANCED";

        StringBuilder typeRequirements = new StringBuilder();
        if (request.getTargetQuestionTypes() != null && !request.getTargetQuestionTypes().isEmpty()) {
            typeRequirements.append("You MUST distribute the generated questions among these specific question types: ");
            for (QuestionType t : request.getTargetQuestionTypes()) {
                typeRequirements.append(t.name()).append(", ");
            }
        } else {
            typeRequirements.append("Primarily generate SINGLE_CHOICE (single correct answer) and optionally MULTIPLE_CHOICE or ESSAY_TEXT.");
        }

        String extra = (request.getAdditionalInstructions() != null && !request.getAdditionalInstructions().isBlank())
                ? "Additional Focus Instructions: " + request.getAdditionalInstructions().trim() + "\n"
                : "";

        return String.format("""
                You are an expert pedagogical exam creator and educational assessment specialist.
                Your task is to analyze the provided source document text and generate EXACTLY %d high-quality questions for an exam.

                === REQUIREMENTS ===
                1. Language: All questions, answers, and explanations MUST be written in %s.
                2. Difficulty Distribution: %s.
                3. %s
                4. %s
                5. Question Guidelines:
                   - For SINGLE_CHOICE: Provide exactly 4 options. Exactly 1 option must have "isCorrect": true, and the other 3 must have "isCorrect": false.
                   - For MULTIPLE_CHOICE: Provide 4 options. At least 2 options must have "isCorrect": true.
                   - For ESSAY_TEXT: Provide a comprehensive "sampleAnswer" (model answer) and "gradingRubric" (criteria and points breakdown). Leave "options" empty [].
                   - For NUMERIC: The question must ask for a precise numerical result. Provide the numerical answer in "sampleAnswer" (e.g. "42.5") and specify "numericTolerance" (e.g. 0.1). Leave "options" empty [].
                6. Educational Quality:
                   - Questions must directly test understanding of key concepts, definitions, formulas, and arguments presented in the document.
                   - Distractors (incorrect options) must be plausible and reflect common misconceptions, not trivial or nonsensical.
                   - Provide a clear, educational "explanation" for why the correct answer is right.

                === OUTPUT FORMAT PROTOCOL ===
                Respond with ONLY a valid JSON object. No Markdown code fences, no conversational prose before or after.
                The JSON must strictly conform to this schema:
                {
                  "questions": [
                    {
                      "content": "Question content text here...",
                      "questionType": "SINGLE_CHOICE", // Must be one of: SINGLE_CHOICE, MULTIPLE_CHOICE, ESSAY_TEXT, NUMERIC
                      "points": 1.0,
                      "explanation": "Detailed explanation of the correct answer...",
                      "difficulty": "MEDIUM", // EASY, MEDIUM, or HARD
                      "sampleAnswer": null, // Required string for ESSAY_TEXT and NUMERIC, null otherwise
                      "gradingRubric": null, // Required string for ESSAY_TEXT, null otherwise
                      "numericTolerance": null, // Float number for NUMERIC, null otherwise
                      "options": [
                        { "orderIndex": 0, "content": "Option text 1", "isCorrect": true },
                        { "orderIndex": 1, "content": "Option text 2", "isCorrect": false },
                        { "orderIndex": 2, "content": "Option text 3", "isCorrect": false },
                        { "orderIndex": 3, "content": "Option text 4", "isCorrect": false }
                      ]
                    }
                  ]
                }

                === SOURCE DOCUMENT TEXT ===
                %s
                """, count, language, difficulty, typeRequirements, extra, documentText);
    }

    /**
     * Parses and validates raw JSON output from Gemini into structured Question DTOs.
     */
    private List<AiGeneratedQuestionDto> parseGeminiResponse(String responseJson) {
        try {
            // Strip any surrounding markdown code block if present
            String cleaned = responseJson.trim();
            if (cleaned.startsWith("```json")) {
                cleaned = cleaned.substring(7);
            } else if (cleaned.startsWith("```")) {
                cleaned = cleaned.substring(3);
            }
            if (cleaned.endsWith("```")) {
                cleaned = cleaned.substring(0, cleaned.length() - 3);
            }
            cleaned = cleaned.trim();

            JsonNode rootNode = objectMapper.readTree(cleaned);
            JsonNode questionsNode = rootNode.has("questions") ? rootNode.get("questions") : rootNode;

            if (!questionsNode.isArray()) {
                throw new AppException("Invalid response format: 'questions' array not found in Gemini output",
                        HttpStatus.INTERNAL_SERVER_ERROR);
            }

            List<AiGeneratedQuestionDto> result = new ArrayList<>();
            int index = 1;

            for (JsonNode qNode : questionsNode) {
                String content = qNode.path("content").asText(null);
                if (content == null || content.isBlank()) {
                    continue; // Skip malformed questions
                }

                String typeStr = qNode.path("questionType").asText("SINGLE_CHOICE").toUpperCase();
                QuestionType qType;
                try {
                    qType = QuestionType.valueOf(typeStr);
                } catch (IllegalArgumentException ex) {
                    qType = QuestionType.SINGLE_CHOICE;
                }

                double points = qNode.path("points").asDouble(1.0);
                String explanation = qNode.path("explanation").asText(null);
                String difficulty = qNode.path("difficulty").asText("MEDIUM");
                String sampleAnswer = qNode.path("sampleAnswer").asText(null);
                String gradingRubric = qNode.path("gradingRubric").asText(null);
                Double numericTolerance = qNode.hasNonNull("numericTolerance")
                        ? qNode.path("numericTolerance").asDouble() : null;

                List<AiGeneratedOptionDto> options = new ArrayList<>();
                JsonNode optionsNode = qNode.path("options");
                if (optionsNode.isArray()) {
                    int optIdx = 0;
                    boolean hasCorrect = false;
                    for (JsonNode optNode : optionsNode) {
                        String optContent = optNode.path("content").asText(null);
                        if (optContent != null && !optContent.isBlank()) {
                            boolean isCorrect = optNode.path("isCorrect").asBoolean(false);
                            if (isCorrect) hasCorrect = true;
                            options.add(AiGeneratedOptionDto.builder()
                                    .orderIndex(optIdx++)
                                    .content(optContent.trim())
                                    .isCorrect(isCorrect)
                                    .build());
                        }
                    }
                    // Safety: Ensure choice questions have at least 1 correct option
                    if (!hasCorrect && !options.isEmpty() && (qType == QuestionType.SINGLE_CHOICE || qType == QuestionType.MULTIPLE_CHOICE)) {
                        options.get(0).setIsCorrect(true);
                    }
                }

                result.add(AiGeneratedQuestionDto.builder()
                        .tempId("ai-q-" + index++)
                        .content(content.trim())
                        .questionType(qType)
                        .points(points > 0 ? points : 1.0)
                        .explanation(explanation)
                        .difficulty(difficulty)
                        .sampleAnswer(sampleAnswer)
                        .gradingRubric(gradingRubric)
                        .numericTolerance(numericTolerance)
                        .options(options)
                        .build());
            }

            if (result.isEmpty()) {
                throw new AppException("AI model could not extract any valid questions from the provided document.",
                        HttpStatus.UNPROCESSABLE_ENTITY);
            }

            log.info("[AiQuizGenerator] Successfully parsed and validated {} questions from Gemini output.", result.size());
            return result;

        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            log.error("[AiQuizGenerator] Failed to parse Gemini response JSON: {}. Response snippet: {}",
                    e.getMessage(), responseJson.length() > 500 ? responseJson.substring(0, 500) : responseJson, e);
            throw new AppException("Failed to parse AI quiz response: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
