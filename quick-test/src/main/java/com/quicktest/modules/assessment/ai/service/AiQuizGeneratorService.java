package com.quicktest.modules.assessment.ai.service;

import com.fasterxml.jackson.core.JsonProcessingException;
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
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;

/**
 * Service that constructs structured prompts and coordinates with
 * GeminiRotationService
 * to generate curriculum-aligned quiz questions from parsed text content.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AiQuizGeneratorService {

    private static final int MAX_BATCH_SIZE_PER_PASS = 15;
    private static final int MAX_CONTINUATION_PASSES = 4;
    private static final int MAX_SAFE_OUTPUT_TOKENS = 8192;

    private final GeminiRotationService geminiRotationService;
    private final GeminiPoolProperties geminiPoolProperties;
    private final ObjectMapper objectMapper;

    /**
     * Generates a list of quiz questions from document text based on configuration
     * parameters. Backwards-compatible overload.
     */
    public List<AiGeneratedQuestionDto> generateQuestions(String documentText, AiGenerateQuizRequest request) {
        return generateQuestions(documentText, request, null);
    }

    /**
     * Generates quiz questions using an adaptive multi-pass continuation and rotation loop.
     * When a large question count (e.g. 30 questions) exceeds Gemini's hard 8,192 token output limit,
     * this method automatically rotates slots and invokes continuation passes to retrieve remaining questions,
     * while gracefully falling back to returning all valid accumulated questions if no further questions can be generated.
     */
    public List<AiGeneratedQuestionDto> generateQuestions(
            String documentText,
            AiGenerateQuizRequest request,
            BiConsumer<Integer, String> progressCallback) {

        if (documentText == null || documentText.isBlank()) {
            throw new AppException("Document text content is empty", HttpStatus.BAD_REQUEST);
        }

        int totalRequested = request.getTotalQuestions() != null ? request.getTotalQuestions() : 10;
        List<AiGeneratedQuestionDto> accumulatedQuestions = new ArrayList<>();
        Set<String> seenNormalizedContents = new HashSet<>();

        log.info("[AiQuizGenerator] Initiating adaptive generation for {} questions (targetTypes: {}, difficulty: {})...",
                totalRequested, request.getTargetQuestionTypes(), request.getDifficulty());

        int pass = 1;
        while (accumulatedQuestions.size() < totalRequested && pass <= MAX_CONTINUATION_PASSES) {
            int remaining = totalRequested - accumulatedQuestions.size();
            int batchToRequest = Math.min(MAX_BATCH_SIZE_PER_PASS, remaining);

            String progressMsg = (pass == 1)
                    ? String.format("AI đang soạn đợt 1 (%d câu hỏi)...", batchToRequest)
                    : String.format("Đã tạo %d/%d câu. Đang xoay slot tiếp theo để tạo thêm %d câu...",
                            accumulatedQuestions.size(), totalRequested, batchToRequest);

            if (progressCallback != null) {
                progressCallback.accept(accumulatedQuestions.size(), progressMsg);
            }

            String prompt = buildPrompt(documentText, request, batchToRequest, accumulatedQuestions);
            // Limit output tokens to 8,192 (Gemini maximum allowed limit)
            int maxTokens = Math.min(MAX_SAFE_OUTPUT_TOKENS, Math.max(2048, batchToRequest * 600));

            try {
                log.info("[AiQuizGenerator] Pass {}/{}: Requesting {} questions with maxTokens={}...",
                        pass, MAX_CONTINUATION_PASSES, batchToRequest, maxTokens);

                String responseJson = geminiRotationService.executeWithRotation(prompt, 0.3, maxTokens);

                // Rotate sticky slot pointer so subsequent passes utilize other available keys/models
                geminiRotationService.advanceToNextSlot();

                if (responseJson == null || responseJson.isBlank()) {
                    log.warn("[AiQuizGenerator] Empty response from AI in pass {}.", pass);
                    if (!accumulatedQuestions.isEmpty()) {
                        break; // Fallback to accumulated questions
                    } else {
                        throw new AppException("Empty response received from AI model when generating quiz questions",
                                HttpStatus.SERVICE_UNAVAILABLE);
                    }
                }

                List<AiGeneratedQuestionDto> batchQuestions = parseGeminiResponse(responseJson);
                enforceTargetQuestionTypes(batchQuestions, request.getTargetQuestionTypes());

                int addedInThisPass = 0;
                for (AiGeneratedQuestionDto q : batchQuestions) {
                    if (accumulatedQuestions.size() >= totalRequested) {
                        break;
                    }
                    String norm = normalizeForComparison(q.getContent());
                    if (!isDuplicate(norm, seenNormalizedContents)) {
                        seenNormalizedContents.add(norm);
                        accumulatedQuestions.add(q);
                        addedInThisPass++;
                    }
                }

                log.info("[AiQuizGenerator] Pass {} completed: added {} new questions. Progress: {}/{}",
                        pass, addedInThisPass, accumulatedQuestions.size(), totalRequested);

                // If no new unique questions could be generated, break early to prevent redundant API calls
                if (addedInThisPass == 0) {
                    log.warn("[AiQuizGenerator] Pass {} produced no new unique questions. Ending continuation loop.", pass);
                    break;
                }

            } catch (Exception ex) {
                log.warn("[AiQuizGenerator] Exception in generation pass {}: {}", pass, ex.getMessage());
                if (!accumulatedQuestions.isEmpty()) {
                    // Graceful fallback: preserve valid questions collected so far instead of crashing the job!
                    log.warn("[AiQuizGenerator] Graceful fallback: returning {} valid questions collected before failure.",
                            accumulatedQuestions.size());
                    break;
                } else {
                    if (ex instanceof AppException) {
                        throw (AppException) ex;
                    }
                    throw new AppException("Failed to generate quiz questions: " + ex.getMessage(),
                            HttpStatus.INTERNAL_SERVER_ERROR);
                }
            }

            pass++;
        }

        if (accumulatedQuestions.isEmpty()) {
            throw new AppException("AI model could not extract any valid questions from the provided document.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }

        // Renumber tempIds sequentially: ai-q-1, ai-q-2, ..., ai-q-N
        for (int i = 0; i < accumulatedQuestions.size(); i++) {
            accumulatedQuestions.get(i).setTempId("ai-q-" + (i + 1));
        }

        log.info("[AiQuizGenerator] Generation finished. Total questions: {} (requested: {})",
                accumulatedQuestions.size(), totalRequested);
        return accumulatedQuestions;
    }

    private String normalizeForComparison(String text) {
        if (text == null) {
            return "";
        }
        return text.toLowerCase()
                .replaceAll("[\\p{Punct}\\s]+", " ")
                .trim();
    }

    private boolean isDuplicate(String norm, Set<String> seen) {
        if (norm.isBlank()) {
            return true;
        }
        if (seen.contains(norm)) {
            return true;
        }
        for (String existing : seen) {
            if (existing.equals(norm)
                    || (norm.length() > 25 && existing.startsWith(norm))
                    || (existing.length() > 25 && norm.startsWith(existing))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Post-validation: guarantees that generated questions strictly conform to
     * requested question types.
     */
    private void enforceTargetQuestionTypes(List<AiGeneratedQuestionDto> questions, List<QuestionType> targetTypes) {
        if (questions == null || questions.isEmpty() || targetTypes == null || targetTypes.isEmpty()) {
            return;
        }

        if (targetTypes.size() == 1) {
            QuestionType requestedType = targetTypes.get(0);
            for (AiGeneratedQuestionDto q : questions) {
                if (q.getQuestionType() != requestedType) {
                    log.warn(
                            "[AiQuizGenerator] Question type mismatch: expected {}, but AI returned {}. Normalizing...",
                            requestedType, q.getQuestionType());

                    if (requestedType == QuestionType.SINGLE_CHOICE && q.getOptions() != null
                            && !q.getOptions().isEmpty()) {
                        q.setQuestionType(QuestionType.SINGLE_CHOICE);
                        boolean hasOneCorrect = false;
                        for (var opt : q.getOptions()) {
                            if (Boolean.TRUE.equals(opt.getIsCorrect())) {
                                if (hasOneCorrect) {
                                    opt.setIsCorrect(false);
                                } else {
                                    hasOneCorrect = true;
                                }
                            }
                        }
                        if (!hasOneCorrect && !q.getOptions().isEmpty()) {
                            q.getOptions().get(0).setIsCorrect(true);
                        }
                    } else {
                        q.setQuestionType(requestedType);
                    }
                }
            }
        } else {
            Set<QuestionType> allowedSet = new HashSet<>(targetTypes);
            questions.removeIf(q -> q.getQuestionType() != null && !allowedSet.contains(q.getQuestionType()));
        }
    }

    /**
     * Builds a comprehensive prompt instructing Gemini to produce valid JSON questions.
     */
    private String buildPrompt(String documentText, AiGenerateQuizRequest request, int count, List<AiGeneratedQuestionDto> accumulatedQuestions) {
        String language = "en".equalsIgnoreCase(request.getLanguage()) ? "English" : "Vietnamese";

        // Explicit cognitive difficulty distribution
        String difficultyDesc;
        if ("EASY".equalsIgnoreCase(request.getDifficulty())) {
            difficultyDesc = "All questions MUST be EASY (basic factual recall, direct definitions).";
        } else if ("MEDIUM".equalsIgnoreCase(request.getDifficulty())) {
            difficultyDesc = "All questions MUST be MEDIUM (application, conceptual understanding).";
        } else if ("HARD".equalsIgnoreCase(request.getDifficulty())) {
            difficultyDesc = "All questions MUST be HARD (advanced analysis, synthesis, deep problem-solving).";
        } else {
            difficultyDesc = "Pedagogical difficulty distribution: ~30% EASY, ~50% MEDIUM, ~20% HARD.";
        }

        List<QuestionType> targetTypes = request.getTargetQuestionTypes();
        StringBuilder typeRequirements = new StringBuilder();
        StringBuilder guidelines = new StringBuilder();
        String allowedTypesSchema;

        if (targetTypes != null && !targetTypes.isEmpty()) {
            if (targetTypes.size() == 1) {
                QuestionType onlyType = targetTypes.get(0);
                typeRequirements.append(String.format(
                        "CRITICAL MANDATORY CONSTRAINT: 100%% of all %d questions MUST be exclusively of questionType \"%s\". "
                                +
                                "DO NOT generate any other question type (such as %s) under any circumstances.",
                        count, onlyType.name(),
                        getOtherTypesNames(onlyType)));
                allowedTypesSchema = onlyType.name();
            } else {
                typeRequirements.append(
                        "CRITICAL MANDATORY CONSTRAINT: Questions MUST ONLY be chosen from these allowed types: ");
                for (QuestionType t : targetTypes) {
                    typeRequirements.append(t.name()).append(", ");
                }
                typeRequirements.append(". DO NOT generate any question type not included in this allowed list.");
                allowedTypesSchema = targetTypes.stream().map(Enum::name).collect(Collectors.joining(", "));
            }

            // Only append guidelines for the requested types to avoid confusing AI
            if (targetTypes.contains(QuestionType.SINGLE_CHOICE)) {
                guidelines.append(
                        "   - For SINGLE_CHOICE: Exactly 4 options. Exactly 1 option must have \"isCorrect\": true, and the other 3 must have \"isCorrect\": false.\n");
            }
            if (targetTypes.contains(QuestionType.MULTIPLE_CHOICE)) {
                guidelines.append(
                        "   - For MULTIPLE_CHOICE: Exactly 4 options. At least 2 options must have \"isCorrect\": true.\n");
            }
            if (targetTypes.contains(QuestionType.ESSAY_TEXT)) {
                guidelines.append(
                        "   - For ESSAY_TEXT: Provide a comprehensive \"sampleAnswer\" (model answer) and \"gradingRubric\" (criteria and points breakdown). Leave \"options\" empty [].\n");
            }
            if (targetTypes.contains(QuestionType.NUMERIC)) {
                guidelines.append(
                        "   - For NUMERIC: The question must ask for a precise numerical result. Provide the numerical answer in \"sampleAnswer\" (e.g. \"42.5\") and specify \"numericTolerance\" (e.g. 0.1). Leave \"options\" empty [].\n");
            }
        } else {
            typeRequirements.append(
                    "Allowed question types: Primarily SINGLE_CHOICE, with optional MULTIPLE_CHOICE or ESSAY_TEXT.");
            allowedTypesSchema = "SINGLE_CHOICE, MULTIPLE_CHOICE, ESSAY_TEXT, NUMERIC";
            guidelines.append(
                    "   - For SINGLE_CHOICE: Provide exactly 4 options. Exactly 1 option must have \"isCorrect\": true, and the other 3 must have \"isCorrect\": false.\n");
            guidelines.append(
                    "   - For MULTIPLE_CHOICE: Provide 4 options. At least 2 options must have \"isCorrect\": true.\n");
            guidelines.append(
                    "   - For ESSAY_TEXT: Provide a comprehensive \"sampleAnswer\" and \"gradingRubric\". Leave \"options\" empty [].\n");
            guidelines.append(
                    "   - For NUMERIC: Provide numerical answer in \"sampleAnswer\" and specify \"numericTolerance\". Leave \"options\" empty [].\n");
        }

        String extra = (request.getAdditionalInstructions() != null && !request.getAdditionalInstructions().isBlank())
                ? "Additional Focus Instructions: " + request.getAdditionalInstructions().trim() + "\n"
                : "";

        StringBuilder antiDuplicationContext = new StringBuilder();
        if (accumulatedQuestions != null && !accumulatedQuestions.isEmpty()) {
            antiDuplicationContext.append("\n=== MANDATORY ANTI-DUPLICATION / CONTINUATION CONSTRAINTS ===\n");
            antiDuplicationContext.append("The following questions have ALREADY been generated from this document in previous passes.\n");
            antiDuplicationContext.append("DO NOT repeat, re-phrase, or test the exact same facts as any of these questions:\n");
            int qIndex = 1;
            for (AiGeneratedQuestionDto existingQ : accumulatedQuestions) {
                String snippet = existingQ.getContent() != null ? existingQ.getContent().replaceAll("\\s+", " ").trim() : "";
                if (snippet.length() > 100) {
                    snippet = snippet.substring(0, 97) + "...";
                }
                antiDuplicationContext.append(String.format("  %d. [%s] %s\n", qIndex++, existingQ.getQuestionType(), snippet));
            }
            antiDuplicationContext.append("You MUST focus strictly on other concepts, sections, definitions, or details in the document to produce completely NEW questions.\n");
        }

        return String.format(
                """
                        You are an expert pedagogical exam creator and educational assessment specialist.
                        Your task is to analyze the provided source document text and generate EXACTLY %d high-quality %squestions for an exam.
                        %s
                        === REQUIREMENTS ===
                        1. Language: All questions, answers, and explanations MUST be written in %s.
                        2. Cognitive Difficulty Distribution: %s
                        3. %s
                        4. %s
                        5. Question Guidelines:
                        %s
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
                              "questionType": "%s", // Allowed types: %s
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
                        """,
                count,
                (accumulatedQuestions != null && !accumulatedQuestions.isEmpty()) ? "NEW and UNIQUE " : "",
                antiDuplicationContext.toString(),
                language,
                difficultyDesc,
                typeRequirements,
                extra,
                guidelines.toString(),
                targetTypes != null && targetTypes.size() == 1 ? targetTypes.get(0).name() : "SINGLE_CHOICE",
                allowedTypesSchema,
                documentText);
    }

    private String getOtherTypesNames(QuestionType selected) {
        List<String> others = new ArrayList<>();
        for (QuestionType t : QuestionType.values()) {
            if (t != selected)
                others.add(t.name());
        }
        return String.join(", ", others);
    }

    /**
     * Parses and validates raw JSON output from Gemini into structured Question
     * DTOs.
     */
    private List<AiGeneratedQuestionDto> parseGeminiResponse(String responseJson) {
        try {
            String rawJsonText = responseJson;
            try {
                JsonNode root = objectMapper.readTree(responseJson);
                if (root.has("candidates")) {
                    JsonNode candidates = root.path("candidates");
                    if (!candidates.isArray() || candidates.isEmpty()) {
                        throw new AppException("Google Gemini response does not contain valid generation candidates",
                                HttpStatus.SERVICE_UNAVAILABLE);
                    }
                    JsonNode textPart = candidates.get(0).path("content").path("parts").get(0).path("text");
                    rawJsonText = textPart.asText();
                }
            } catch (AppException ae) {
                throw ae;
            } catch (Exception ignored) {
                // Not a top-level Gemini wrapper, use responseJson as-is
            }

            // Strip any surrounding markdown code block or extraneous leading/trailing text
            String cleaned = rawJsonText.trim();
            if (cleaned.startsWith("```json")) {
                cleaned = cleaned.substring(7);
            } else if (cleaned.startsWith("```")) {
                cleaned = cleaned.substring(3);
            }
            if (cleaned.endsWith("```")) {
                cleaned = cleaned.substring(0, cleaned.length() - 3);
            }
            cleaned = cleaned.trim();

            // Locate JSON object or array boundaries if surrounded by conversational prose
            int firstBrace = cleaned.indexOf("{");
            int firstBracket = cleaned.indexOf("[");
            int startIdx = -1;
            if (firstBrace != -1 && firstBracket != -1) {
                startIdx = Math.min(firstBrace, firstBracket);
            } else if (firstBrace != -1) {
                startIdx = firstBrace;
            } else if (firstBracket != -1) {
                startIdx = firstBracket;
            }

            if (startIdx != -1) {
                cleaned = cleaned.substring(startIdx);
            }

            JsonNode contentNode = parseOrRepairJson(cleaned);
            JsonNode questionsNode = contentNode.has("questions") ? contentNode.get("questions") : contentNode;

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
                        ? qNode.path("numericTolerance").asDouble()
                        : null;

                List<AiGeneratedOptionDto> options = new ArrayList<>();
                JsonNode optionsNode = qNode.path("options");
                if (optionsNode.isArray()) {
                    int optIdx = 0;
                    boolean hasCorrect = false;
                    for (JsonNode optNode : optionsNode) {
                        String optContent = optNode.path("content").asText(null);
                        if (optContent != null && !optContent.isBlank()) {
                            boolean isCorrect = optNode.path("isCorrect").asBoolean(false);
                            if (isCorrect)
                                hasCorrect = true;
                            options.add(AiGeneratedOptionDto.builder()
                                    .orderIndex(optIdx++)
                                    .content(optContent.trim())
                                    .isCorrect(isCorrect)
                                    .build());
                        }
                    }
                    // Safety: Ensure choice questions have at least 1 correct option
                    if (!hasCorrect && !options.isEmpty()
                            && (qType == QuestionType.SINGLE_CHOICE || qType == QuestionType.MULTIPLE_CHOICE)) {
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

            log.info("[AiQuizGenerator] Successfully parsed and validated {} questions from Gemini output.",
                    result.size());
            return result;

        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            log.error("[AiQuizGenerator] Failed to parse Gemini response JSON: {}. Response snippet: {}",
                    e.getMessage(), responseJson.length() > 500 ? responseJson.substring(0, 500) : responseJson, e);
            throw new AppException("Failed to parse AI quiz response: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Attempts standard JSON parsing, and if truncated, repairs the JSON by closing
     * any open "questions" array.
     */
    private JsonNode parseOrRepairJson(String cleaned) throws JsonProcessingException {
        try {
            return objectMapper.readTree(cleaned);
        } catch (JsonProcessingException initialEx) {
            log.warn(
                    "[AiQuizGenerator] Standard JSON parse encountered an issue ({}), attempting truncation recovery...",
                    initialEx.getMessage());

            // 1. Try appending closing markers directly if just the tail was truncated
            try {
                return objectMapper.readTree(cleaned + "\n  ]\n}");
            } catch (Exception ignored) {
            }

            try {
                return objectMapper.readTree(cleaned + "\n}");
            } catch (Exception ignored) {
            }

            // 2. Scan backwards for the last closed question object '}' and close the array
            int questionsArrayStart = cleaned.indexOf("\"questions\"");
            if (questionsArrayStart == -1) {
                questionsArrayStart = cleaned.indexOf("[");
            }

            if (questionsArrayStart != -1) {
                int searchPos = cleaned.length() - 1;
                while (searchPos > questionsArrayStart) {
                    int lastBrace = cleaned.lastIndexOf('}', searchPos);
                    if (lastBrace == -1 || lastBrace <= questionsArrayStart) {
                        break;
                    }

                    // Candidate repair: take content up to this complete '}' and close the array
                    // and root object
                    String candidate = cleaned.substring(0, lastBrace + 1) + "\n  ]\n}";
                    try {
                        JsonNode repairedNode = objectMapper.readTree(candidate);
                        JsonNode qNode = repairedNode.has("questions") ? repairedNode.get("questions") : repairedNode;
                        if (qNode.isArray() && !qNode.isEmpty()) {
                            log.info(
                                    "[AiQuizGenerator] Successfully recovered {} complete questions from truncated JSON output.",
                                    qNode.size());
                            return repairedNode;
                        }
                    } catch (Exception ignored) {
                        // Keep scanning backwards for a valid parent question boundary
                    }

                    searchPos = lastBrace - 1;
                }
            }

            throw initialEx;
        }
    }
}
