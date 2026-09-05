package com.quicktest.core.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception thrown when a candidate attempts to save or submit an exam after the expiration deadline.
 */
public class SessionExpiredException extends AppException {

    public SessionExpiredException(String message) {
        super(message, HttpStatus.GONE); // HTTP 410 Gone indicates session deadline has elapsed
    }
}
