package com.quicktest.modules.proctoring.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Redis session lock payload enforcing single active exam session per attempt.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttemptSessionLockDto {

    private String sessionToken;
    private String deviceFingerprint;
    private String ipAddress;
    private String userAgent;
    private Long lockedAt;
}

