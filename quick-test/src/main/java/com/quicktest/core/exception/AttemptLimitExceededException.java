package com.quicktest.core.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception thrown when a candidate (user or guest) exceeds the allowed number of exam attempts.
 */
public class AttemptLimitExceededException extends AppException {

    public AttemptLimitExceededException(String message) {
        super(message, HttpStatus.BAD_REQUEST);
    }
}
