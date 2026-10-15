package com.quicktest.modules.admin.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.modules.admin.dto.*;
import com.quicktest.modules.admin.service.AdminAiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for Admin AI pool management, live Redis metrics monitoring,
 * and active background grading jobs oversight.
 * Requires ROLE_ADMIN authority.
 */
@RestController
@RequestMapping("/api/admin/ai")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminAiController {

    private final AdminAiService adminAiService;

    /**
     * Retrieves overall AI system status, rotation slot counters from Redis, and active background workers.
     */
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<AiSystemStatusResponse>> getSystemStatus() {
        AiSystemStatusResponse response = adminAiService.getSystemStatus();
        return ResponseEntity.ok(ApiResponse.success(response, "AI system status retrieved successfully"));
    }

    /**
     * Lists all AI API Keys configured in the system.
     */
    @GetMapping("/keys")
    public ResponseEntity<ApiResponse<List<AiKeyResponse>>> getAllKeys() {
        List<AiKeyResponse> list = adminAiService.getAllKeys();
        return ResponseEntity.ok(ApiResponse.success(list, "AI keys retrieved successfully"));
    }

    /**
     * Retrieves details of a specific AI API Key.
     */
    @GetMapping("/keys/{id}")
    public ResponseEntity<ApiResponse<AiKeyResponse>> getKeyById(@PathVariable UUID id) {
        AiKeyResponse response = adminAiService.getKeyById(id);
        return ResponseEntity.ok(ApiResponse.success(response, "AI key retrieved successfully"));
    }

    /**
     * Registers a new AI API Key with model limits and reloads rotation pool.
     */
    @PostMapping("/keys")
    public ResponseEntity<ApiResponse<AiKeyResponse>> createKey(@Valid @RequestBody AiKeyCreateRequest request) {
        AiKeyResponse response = adminAiService.createKey(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "AI key created and rotation pool refreshed"));
    }

    /**
     * Updates an existing AI API Key and its model limits.
     */
    @PutMapping("/keys/{id}")
    public ResponseEntity<ApiResponse<AiKeyResponse>> updateKey(
            @PathVariable UUID id,
            @Valid @RequestBody AiKeyUpdateRequest request) {
        AiKeyResponse response = adminAiService.updateKey(id, request);
        return ResponseEntity.ok(ApiResponse.success(response, "AI key updated and rotation pool refreshed"));
    }

    /**
     * Deletes an AI API Key from Database and removes its slots from rotation.
     */
    @DeleteMapping("/keys/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteKey(@PathVariable UUID id) {
        adminAiService.deleteKey(id);
        return ResponseEntity.ok(ApiResponse.success(null, "AI key deleted and rotation pool refreshed"));
    }

    /**
     * Toggles active state for an AI Key.
     */
    @PatchMapping("/keys/{id}/toggle")
    public ResponseEntity<ApiResponse<AiKeyResponse>> toggleKeyActive(@PathVariable UUID id) {
        AiKeyResponse response = adminAiService.toggleKeyActive(id);
        return ResponseEntity.ok(ApiResponse.success(response, "AI key status toggled successfully"));
    }

    /**
     * Toggles active state for a specific AI Model.
     */
    @PatchMapping("/models/{id}/toggle")
    public ResponseEntity<ApiResponse<AiModelResponse>> toggleModelActive(@PathVariable UUID id) {
        AiModelResponse response = adminAiService.toggleModelActive(id);
        return ResponseEntity.ok(ApiResponse.success(response, "AI model status toggled successfully"));
    }

    /**
     * Explicitly triggers an immediate reload of rotation slots from DB or Env.
     */
    @PostMapping("/reload")
    public ResponseEntity<ApiResponse<Void>> reloadPool() {
        adminAiService.reloadPool();
        return ResponseEntity.ok(ApiResponse.success(null, "AI rotation pool reloaded successfully"));
    }

    /**
     * Cancels an active or stalled background grading job and frees its exam lock.
     */
    @DeleteMapping("/jobs/{jobId}")
    public ResponseEntity<ApiResponse<Void>> cancelJob(@PathVariable String jobId) {
        adminAiService.cancelJob(jobId);
        return ResponseEntity.ok(ApiResponse.success(null, "Background job cancelled and lock released successfully"));
    }

    /**
     * Clears all active or stalled background jobs and frees all corresponding exam locks.
     */
    @DeleteMapping("/jobs")
    public ResponseEntity<ApiResponse<Void>> clearAllJobs() {
        adminAiService.clearAllJobs();
        return ResponseEntity.ok(ApiResponse.success(null, "All background jobs cleared and locks released successfully"));
    }
}
