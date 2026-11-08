package com.quicktest.modules.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Request payload to delete specific proctoring evidence images by IDs.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminBatchDeleteMediaRequest {

    private List<UUID> ids;
}

