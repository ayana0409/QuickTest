package com.quicktest.core.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception thrown when attempting to register a user with an already existing username or email.
 */
public class UserAlreadyExistsException extends AppException {

    public UserAlreadyExistsException(String message) {
        super(message, HttpStatus.CONFLICT);
    }
}
