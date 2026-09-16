package com.quicktest.core.exception;

import com.quicktest.core.common.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * Global exception handler returning standardized ApiResponse wrappers.
 */
@Slf4j
@RestControllerAdvice
@SuppressWarnings("null")
public class GlobalExceptionHandler {

    /**
     * Handle business application exceptions.
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Object>> handleAppException(AppException ex) {
        log.warn("Application exception occurred: {}", ex.getMessage());
        HttpStatus status = ex.getStatus() != null ? ex.getStatus() : HttpStatus.BAD_REQUEST;
        return ResponseEntity
                .status(java.util.Objects.requireNonNull(status))
                .body(ApiResponse.error(status.value(), ex.getMessage()));
    }

    /**
     * Handle illegal argument or business validation failures.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Object>> handleIllegalArgumentException(IllegalArgumentException ex) {
        log.warn("Illegal argument: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), ex.getMessage()));
    }

    /**
     * Handle DTO validation failures (@Valid).
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(
            MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        log.warn("Validation error: {}", errors);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), "Validation failed", errors));
    }

    /**
     * Handle path variable or request parameter type conversion failures (e.g.
     * invalid UUID format or missing ID).
     */
    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Object>> handleTypeMismatch(
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex) {
        log.warn("Type mismatch error for parameter '{}': {}", ex.getName(), ex.getMessage());
        Class<?> requiredType = ex.getRequiredType();
        String typeName = requiredType != null ? requiredType.getSimpleName() : "valid parameter";
        String msg = String.format("Parameter '%s' has invalid value '%s'. Expected format: %s",
                ex.getName(), ex.getValue(), typeName);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), msg));
    }

    /**
     * Handle authentication credentials failure.
     */
    @ExceptionHandler({ BadCredentialsException.class, UsernameNotFoundException.class })
    public ResponseEntity<ApiResponse<Object>> handleBadCredentialsException(Exception ex) {
        log.warn("Authentication failed: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(HttpStatus.UNAUTHORIZED.value(), "Invalid username, email, or password"));
    }

    /**
     * Handle authorization access denied.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccessDeniedException(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        String message = (ex.getMessage() != null && !ex.getMessage().isBlank()
                && !ex.getMessage().equalsIgnoreCase("Access is denied"))
                        ? ex.getMessage()
                        : "You do not have permission to access this resource";
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(HttpStatus.FORBIDDEN.value(), message));
    }

    /**
     * Handle unsupported media type.
     */
    @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Object>> handleHttpMediaTypeNotSupported(
            org.springframework.web.HttpMediaTypeNotSupportedException ex) {
        log.warn("Unsupported Media Type: {}", ex.getMessage());
        String msg = String.format("Content-Type '%s' is not supported", ex.getContentType());
        return ResponseEntity
                .status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(ApiResponse.error(HttpStatus.UNSUPPORTED_MEDIA_TYPE.value(), msg));
    }

    /**
     * Handle missing multipart part or missing request parameter.
     */
    @ExceptionHandler({
            org.springframework.web.multipart.support.MissingServletRequestPartException.class,
            org.springframework.web.bind.MissingServletRequestParameterException.class
    })
    public ResponseEntity<ApiResponse<Object>> handleMissingRequestPart(Exception ex) {
        log.warn("Missing request part or parameter: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), ex.getMessage()));
    }

    /**
     * Handle unreadable/malformed JSON body.
     */
    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Object>> handleHttpMessageNotReadable(
            org.springframework.http.converter.HttpMessageNotReadableException ex) {
        log.warn("Malformed JSON request body: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(),
                        "Malformed JSON request body or missing required request body"));
    }

    /**
     * Handle unsupported HTTP method (e.g. GET instead of POST).
     */
    @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Object>> handleHttpRequestMethodNotSupported(
            org.springframework.web.HttpRequestMethodNotSupportedException ex) {
        log.warn("Method not allowed: {}", ex.getMessage());
        String msg = String.format("Request method '%s' is not supported for this endpoint", ex.getMethod());
        return ResponseEntity
                .status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiResponse.error(HttpStatus.METHOD_NOT_ALLOWED.value(), msg));
    }

    /**
     * Handle multipart file size exceeded limit.
     */
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Object>> handleMaxUploadSizeExceeded(
            org.springframework.web.multipart.MaxUploadSizeExceededException ex) {
        log.warn("Max upload size exceeded: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(HttpStatus.BAD_REQUEST.value(), "File size exceeds maximum permitted limit"));
    }

    /**
     * Handle Spring MVC NoResourceFoundException (404 for unmapped endpoints or missing static resources).
     */
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Object>> handleNoResourceFound(
            org.springframework.web.servlet.resource.NoResourceFoundException ex) {
        log.warn("Resource not found: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(HttpStatus.NOT_FOUND.value(), "Resource not found: " + ex.getResourcePath()));
    }

    /**
     * Fallback handler for all uncaught exceptions.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleGeneralException(Exception ex) {
        log.error("Internal server error: ", ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        "An unexpected server error occurred. Please try again later."));
    }
}
