package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * Real-time metric snapshot for a single AI Model Slot in the rotation pool.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiSlotMetricDto implements Serializable {

    private int slotIndex;
    private String keyId;
    private String keyName;
    private String maskedKey;
    private String modelName;
    private int rpmCurrent;
    private int rpmMax;
    private long tpmCurrent;
    private long tpmMax;
    private boolean isExhausted;
    private long cooldownRemainingSeconds;
    private int totalRequests;
    private int successCount;
    private int failureCount;
    private String lastUsedAt;
    private String lastError;
}
