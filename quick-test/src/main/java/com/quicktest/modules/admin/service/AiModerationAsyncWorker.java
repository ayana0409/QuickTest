package com.quicktest.modules.admin.service;

import com.quicktest.config.GeminiProperties;
import com.quicktest.core.service.AiModerationService;
import com.quicktest.modules.admin.dto.AiModerationResultDto;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

/**
 * Background worker that performs AI batch content moderation on text-only questions.
 *
 * Workflow:
 *   1. Read last processed question ID cursor from Redis (for resumability).
 *   2. Fetch next batch of text-only, unreviewed questions after that cursor.
 *   3. Send batch to Gemini AI for safety classification.
 *   4. Bulk-update question safety flags in DB.
 *   5. Save the last processed ID back to Redis (for the next batch / recovery).
 *   6. Repeat until no more eligible questions.
 *   7. On any AI error, stop immediately and preserve the cursor for next run.
 *
 * Rate limiting: The worker tracks estimated tokens used per minute and sleeps
 * if approaching the 50k token/minute limit to avoid Gemini API quota errors.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiModerationAsyncWorker {

    // Redis key storing the UUID of the last successfully processed question (cursor)
    static final String REDIS_KEY_LAST_ID = "ai:moderation:lastProcessedId";

    // Redis key indicating a job is currently running (prevent duplicate runs)
    static final String REDIS_KEY_RUNNING = "ai:moderation:running";

    // Redis keys storing moderation metrics of the latest job run
    static final String REDIS_KEY_PROCESSED_COUNT = "ai:moderation:stats:processed";
    static final String REDIS_KEY_SAFE_COUNT = "ai:moderation:stats:safe";
    static final String REDIS_KEY_UNSAFE_COUNT = "ai:moderation:stats:unsafe";

    // Rough estimate of tokens per character (Gemini tokenizes ~4 chars per token)
    private static final double CHARS_PER_TOKEN = 4.0;

    // Flag to detect duplicate in-process runs within the same JVM instance
    private static final AtomicBoolean isRunning = new AtomicBoolean(false);

    private final AiModerationService aiModerationService;
    private final QuestionRepository questionRepository;
    private final StringRedisTemplate redisTemplate;
    private final GeminiProperties geminiProperties;

    /**
     * Main async method triggered by admin to run AI moderation in the background.
     * Runs in a dedicated thread pool via @Async.
     * Returns statistics about the run via the shared job state (polled by status endpoint).
     *
     * @return total number of questions processed in this run
     */
    @Async("aiModerationExecutor")
    public void runModerationJob() {
        // Double-check guard: prevent concurrent jobs (both JVM-level and Redis-level)
        if (!isRunning.compareAndSet(false, true)) {
            log.warn("[AI Moderation Worker] A moderation job is already running in this instance. Skipping.");
            return;
        }

        // Set Redis running flag and reset counters for fresh job run
        redisTemplate.opsForValue().set(REDIS_KEY_RUNNING, "true");
        redisTemplate.opsForValue().set(REDIS_KEY_PROCESSED_COUNT, "0");
        redisTemplate.opsForValue().set(REDIS_KEY_SAFE_COUNT, "0");
        redisTemplate.opsForValue().set(REDIS_KEY_UNSAFE_COUNT, "0");

        int batchSize = geminiProperties.getModerationBatchSize();
        int maxTokensPerMinute = geminiProperties.getMaxInputTokensPerMinute();
        int totalProcessed = 0;
        int totalSafe = 0;
        int totalUnsafe = 0;

        // Track token usage within the current minute window for rate limiting
        long windowStartMs = System.currentTimeMillis();
        int tokenUsedInWindow = 0;

        log.info("[AI Moderation Worker] Starting AI content moderation job. batchSize={}, maxTokensPerMinute={}",
                batchSize, maxTokensPerMinute);

        try {
            while (true) {
                // Read cursor (last processed question ID) from Redis for resumable processing
                String lastId = redisTemplate.opsForValue().get(REDIS_KEY_LAST_ID);
                log.debug("[AI Moderation Worker] Fetching next batch. lastProcessedId={}", lastId);

                // Fetch next batch of text-only, unreviewed questions after the cursor
                List<String> questionIds = questionRepository.findTextOnlyUnreviewedForModeration(lastId, batchSize);

                if (questionIds == null || questionIds.isEmpty()) {
                    log.info("[AI Moderation Worker] No more eligible questions found. Job complete.");
                    break;
                }

                log.info("[AI Moderation Worker] Found {} questions to moderate in this batch.", questionIds.size());

                // Batch-load full question entities with options (avoid N+1)
                List<UUID> uuids = questionIds.stream().map(UUID::fromString).toList();
                List<Question> questions = questionRepository.findAllByIdInWithOptionsAndExam(uuids);

                // Preserve the original cursor-ordered sequence from the ID list
                Map<UUID, Question> questionMap = questions.stream()
                        .collect(Collectors.toMap(Question::getId, q -> q));
                List<Question> orderedQuestions = uuids.stream()
                        .map(questionMap::get)
                        .filter(Objects::nonNull)
                        .toList();

                if (orderedQuestions.isEmpty()) {
                    log.warn("[AI Moderation Worker] All fetched question IDs returned empty entities. Breaking.");
                    break;
                }

                // === Rate Limiting: Estimate tokens in this batch ===
                int estimatedTokens = estimateTokens(orderedQuestions);
                long elapsedMs = System.currentTimeMillis() - windowStartMs;

                if (elapsedMs < 60_000 && (tokenUsedInWindow + estimatedTokens) > maxTokensPerMinute) {
                    // Wait for the remaining time in this 1-minute window before sending
                    long sleepMs = 60_000 - elapsedMs + 500; // +500ms buffer
                    log.info("[AI Moderation Worker] Rate limit approaching ({} tokens used / {} limit). " +
                            "Sleeping {}ms before next batch...", tokenUsedInWindow, maxTokensPerMinute, sleepMs);
                    try {
                        Thread.sleep(sleepMs);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        log.warn("[AI Moderation Worker] Sleep interrupted. Stopping job.");
                        break;
                    }
                    // Reset the window
                    windowStartMs = System.currentTimeMillis();
                    tokenUsedInWindow = 0;
                }

                // Advance token counter
                tokenUsedInWindow += estimatedTokens;
                if (elapsedMs >= 60_000) {
                    // New minute window has started naturally
                    windowStartMs = System.currentTimeMillis();
                    tokenUsedInWindow = estimatedTokens;
                }

                // === Call Gemini AI for safety classification ===
                AiModerationResultDto result;
                try {
                    result = aiModerationService.moderateBatch(orderedQuestions);
                } catch (Exception aiEx) {
                    // On ANY AI error: stop immediately, preserve cursor for next run
                    log.error("[AI Moderation Worker] AI call failed. Stopping job to preserve cursor. Error: {}",
                            aiEx.getMessage(), aiEx);
                    break;
                }

                // === Map results and bulk-update DB ===
                List<String> safeIds = new ArrayList<>();
                List<String> unsafeIds = new ArrayList<>();

                for (AiModerationResultDto.AiQuestionVerdict verdict : result.getResults()) {
                    if (verdict.getQuestionId() == null) continue;
                    if (Boolean.TRUE.equals(verdict.getSafe())) {
                        safeIds.add(verdict.getQuestionId());
                    } else {
                        unsafeIds.add(verdict.getQuestionId());
                    }
                }

                // Bulk update in a dedicated transaction for isolation
                persistModerationResults(safeIds, unsafeIds);

                totalSafe += safeIds.size();
                totalUnsafe += unsafeIds.size();
                totalProcessed += orderedQuestions.size();

                // Persist current cumulative metrics to Redis for real-time polling
                redisTemplate.opsForValue().set(REDIS_KEY_PROCESSED_COUNT, String.valueOf(totalProcessed));
                redisTemplate.opsForValue().set(REDIS_KEY_SAFE_COUNT, String.valueOf(totalSafe));
                redisTemplate.opsForValue().set(REDIS_KEY_UNSAFE_COUNT, String.valueOf(totalUnsafe));

                // Save cursor: last question ID in this batch (ordered by ID ASC)
                String newLastId = orderedQuestions.get(orderedQuestions.size() - 1).getId().toString();
                redisTemplate.opsForValue().set(REDIS_KEY_LAST_ID, newLastId);

                log.info("[AI Moderation Worker] Batch done. processed={}, safe={}, unsafe={}, newCursor={}",
                        orderedQuestions.size(), safeIds.size(), unsafeIds.size(), newLastId);

                // If the batch returned fewer questions than the batch size, we've reached the end
                if (orderedQuestions.size() < batchSize) {
                    log.info("[AI Moderation Worker] Batch returned fewer than batchSize ({}). All done.", batchSize);
                    // Clear cursor so the next manual run starts fresh
                    redisTemplate.delete(REDIS_KEY_LAST_ID);
                    break;
                }
            }

        } catch (Exception e) {
            log.error("[AI Moderation Worker] Unexpected error during moderation job: {}", e.getMessage(), e);
        } finally {
            // Always clear the running flag so a new job can be triggered
            isRunning.set(false);
            redisTemplate.delete(REDIS_KEY_RUNNING);
            log.info("[AI Moderation Worker] Job finished. totalProcessed={}, safe={}, unsafe={}",
                    totalProcessed, totalSafe, totalUnsafe);
        }
    }

    /**
     * Persist AI moderation verdicts in bulk via separate SAFE and UNSAFE update queries.
     * Runs in its own transaction to isolate each bulk write.
     *
     * @param safeIds   list of question UUIDs classified as safe
     * @param unsafeIds list of question UUIDs classified as unsafe
     */
    public void persistModerationResults(List<String> safeIds, List<String> unsafeIds) {
        if (!safeIds.isEmpty()) {
            // Convert UUID list to PostgreSQL array literal: '{uuid1,uuid2,...}'
            String safeArray = toPostgresArray(safeIds);
            int updatedSafe = questionRepository.bulkMarkAsSafe(safeArray);
            log.debug("[AI Moderation Worker] Bulk marked {} questions as SAFE", updatedSafe);
        }
        if (!unsafeIds.isEmpty()) {
            String unsafeArray = toPostgresArray(unsafeIds);
            int updatedUnsafe = questionRepository.bulkMarkAsUnsafe(unsafeArray);
            log.debug("[AI Moderation Worker] Bulk marked {} questions as UNSAFE", updatedUnsafe);
        }
    }

    /**
     * Check if a moderation job is currently running (checks both JVM flag and Redis).
     */
    public boolean isJobRunning() {
        return isRunning.get() || Boolean.parseBoolean(redisTemplate.opsForValue().get(REDIS_KEY_RUNNING));
    }

    /**
     * Get the cursor (last processed question ID) stored in Redis.
     * Null if no prior job has run or cursor was cleared.
     */
    public String getLastProcessedId() {
        return redisTemplate.opsForValue().get(REDIS_KEY_LAST_ID);
    }

    /**
     * Get the number of questions processed in the latest moderation run.
     */
    public int getProcessedCount() {
        try {
            String val = redisTemplate.opsForValue().get(REDIS_KEY_PROCESSED_COUNT);
            return val != null ? Integer.parseInt(val) : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * Get the number of safe questions in the latest moderation run.
     */
    public int getSafeCount() {
        try {
            String val = redisTemplate.opsForValue().get(REDIS_KEY_SAFE_COUNT);
            return val != null ? Integer.parseInt(val) : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * Get the number of unsafe questions in the latest moderation run.
     */
    public int getUnsafeCount() {
        try {
            String val = redisTemplate.opsForValue().get(REDIS_KEY_UNSAFE_COUNT);
            return val != null ? Integer.parseInt(val) : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * Clears the moderation cursor and stats from Redis, forcing the next run to start from scratch.
     */
    public void resetCursor() {
        redisTemplate.delete(REDIS_KEY_LAST_ID);
        redisTemplate.delete(REDIS_KEY_PROCESSED_COUNT);
        redisTemplate.delete(REDIS_KEY_SAFE_COUNT);
        redisTemplate.delete(REDIS_KEY_UNSAFE_COUNT);
        log.info("[AI Moderation Worker] Moderation cursor and stats reset. Next job will start from the beginning.");
    }

    /**
     * Converts a list of UUID strings to a PostgreSQL array literal for use in ANY() queries.
     * Example: ['uuid1', 'uuid2'] -> '{uuid1,uuid2}'
     */
    private String toPostgresArray(List<String> ids) {
        return "{" + String.join(",", ids) + "}";
    }

    /**
     * Estimates the token count for a batch of questions by approximating via character count.
     * Used for rate limiting: 1 token ≈ 4 characters.
     *
     * @param questions batch of questions
     * @return estimated token count
     */
    private int estimateTokens(List<Question> questions) {
        int totalChars = 0;
        for (Question q : questions) {
            if (q.getContent() != null) totalChars += q.getContent().length();
            if (q.getSampleAnswer() != null) totalChars += q.getSampleAnswer().length();
            if (q.getGradingRubric() != null) totalChars += q.getGradingRubric().length();
            if (q.getOptions() != null) {
                for (var opt : q.getOptions()) {
                    if (opt.getContent() != null) totalChars += opt.getContent().length();
                }
            }
        }
        // Add prompt overhead estimate (~500 tokens for system instructions + schema)
        return (int) (totalChars / CHARS_PER_TOKEN) + 500;
    }
}
