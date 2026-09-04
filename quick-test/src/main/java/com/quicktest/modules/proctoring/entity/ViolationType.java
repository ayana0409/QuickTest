package com.quicktest.modules.proctoring.entity;

/**
 * Violation types recorded by the proctoring subsystem.
 */
public enum ViolationType {
    TAB_SWITCH,         // Browser tab switch detected
    EXIT_FULLSCREEN,    // Fullscreen mode exited
    DEVTOOLS_OPEN,      // DevTools/Inspect attempted
    NO_FACE_DETECTED,   // No face detected via webcam
    MULTIPLE_FACES,     // Multiple faces detected in frame
    COPY_PASTE_ATTEMPT  // Copy/paste attempt detected
}
