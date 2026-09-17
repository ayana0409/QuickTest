package com.quicktest.modules.session.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Aggregated statistical summary of all attempts within a specific exam.
 * All metrics are computed in a single JPQL query for maximum performance.
 * Duration fields represent the actual elapsed time (submitTime - startTime) in seconds.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamAttemptStatsResponse {

    /** Total number of attempts (all statuses) */
    private long totalAttempts;

    /** Number of fully graded/submitted attempts */
    private long completedAttempts;

    /** Number of attempts awaiting manual essay grading */
    private long pendingGradingAttempts;

    /** Number of currently in-progress attempts */
    private long inProgressAttempts;

    /** Number of disqualified attempts */
    private long disqualifiedAttempts;

    // ------- Score stats (only from SUBMITTED attempts with non-null totalScore) -------

    /** Average total score across all graded attempts. Null if no graded attempts exist. */
    private Double averageScore;

    /** Highest total score achieved. Null if no graded attempts exist. */
    private Double highestScore;

    /** Lowest total score achieved. Null if no graded attempts exist. */
    private Double lowestScore;

    /** Number of attempts with a graded total score */
    private long gradedCount;

    // ------- Violation stats -------

    /** Total violation events across all attempts */
    private long totalViolations;

    /** Maximum violation count by a single candidate */
    private int maxViolations;

    /** Number of attempts that had at least one violation */
    private long attemptsWithViolations;

    // ------- Duration stats (in seconds, based on submitTime - startTime) -------
    // Only counted for SUBMITTED attempts where both times are present

    /** Average duration in seconds. Null if no completed attempts with both timestamps. */
    private Double averageDurationSeconds;

    /** Maximum duration in seconds (slowest submission). */
    private Long maxDurationSeconds;

    /** Minimum duration in seconds (fastest submission). */
    private Long minDurationSeconds;
}
