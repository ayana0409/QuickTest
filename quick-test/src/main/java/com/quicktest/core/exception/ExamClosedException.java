package com.quicktest.core.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception thrown when an exam is not open, has reached its closing deadline, or is in DRAFT/CLOSED status.
 */
public class ExamClosedException extends AppException {

    public ExamClosedException(String message) {
        super(message, HttpStatus.BAD_REQUEST);
    }
}
