package com.quicktest.core.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when all available Google Gemini API slots (keys and models)
 * in the rotation pool are currently exhausted or rate-limited (HTTP 429).
 */
public class GeminiAllSlotsExhaustedException extends AppException {

    public GeminiAllSlotsExhaustedException(String message) {
        super(message, HttpStatus.TOO_MANY_REQUESTS);
    }
}
