package com.quicktest.core.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Base application runtime exception with HTTP status code.
 */
@Getter
public class AppException extends RuntimeException {

    private final HttpStatus status;

    public AppException(String message) {
        super(message);
        this.status = HttpStatus.BAD_REQUEST;
    }

    public AppException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public AppException(String message, Throwable cause, HttpStatus status) {
        super(message, cause);
        this.status = status;
    }
}
