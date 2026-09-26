package com.quicktest.core.logging;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to mark methods for automated centralized audit logging.
 * Can be placed on service methods, controller actions, or background worker listeners.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditLog {

    /**
     * Target functional module name (e.g. "EXAM", "QUESTION", "WORKER_AI_MODERATION").
     * If blank, defaults to inferred module name from the declaring class.
     */
    String module() default "";

    /**
     * Target action name (e.g. "CREATE_EXAM", "UPDATE_QUESTION", "PROCESS_SUBMISSION").
     * If blank, defaults to inferred action from method name.
     */
    String action() default "";

    /**
     * Whether to serialize and record method arguments into log details.
     */
    boolean logParams() default true;

    /**
     * Whether to serialize and record method return value into log details.
     */
    boolean logResult() default false;

    /**
     * Optional human-readable description of the operation.
     */
    String description() default "";
}
