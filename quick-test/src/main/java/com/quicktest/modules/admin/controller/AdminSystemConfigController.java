package com.quicktest.modules.admin.controller;

import com.quicktest.core.common.ApiResponse;
import com.quicktest.core.config.dto.SystemConfigDto;
import com.quicktest.core.config.dto.SystemConfigUpdateRequest;
import com.quicktest.core.config.service.SystemConfigService;
import com.quicktest.core.security.UserDetailsImpl;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for managing externalized system configurations.
 * Allows administrators to update dynamic settings without restarting services.
 * Requires ROLE_ADMIN authority.
 */
@RestController
@RequestMapping("/api/admin/configs")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminSystemConfigController {

    private final SystemConfigService systemConfigService;

    /**
     * Retrieve all system configurations with their active values and sources.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<SystemConfigDto>>> getAllConfigs() {
        List<SystemConfigDto> configs = systemConfigService.getAllConfigs();
        return ResponseEntity.ok(ApiResponse.success(configs, "System configurations retrieved successfully"));
    }

    /**
     * Retrieve a specific system configuration by its key.
     */
    @GetMapping("/{key}")
    public ResponseEntity<ApiResponse<SystemConfigDto>> getConfig(@PathVariable("key") String key) {
        SystemConfigDto config = systemConfigService.getConfig(key);
        return ResponseEntity.ok(ApiResponse.success(config, "System configuration retrieved successfully"));
    }

    /**
     * Update or override a system configuration value in Database and Redis.
     */
    @PutMapping("/{key}")
    public ResponseEntity<ApiResponse<SystemConfigDto>> updateConfig(
            @PathVariable("key") String key,
            @Valid @RequestBody SystemConfigUpdateRequest request,
            @AuthenticationPrincipal UserDetailsImpl currentUser) {

        String updatedBy = currentUser != null ? currentUser.getUsername() : "ADMIN";
        SystemConfigDto updated = systemConfigService.updateConfig(key, request.getValue(), updatedBy);
        return ResponseEntity.ok(ApiResponse.success(updated, "Configuration updated successfully"));
    }

    /**
     * Reset a configuration to Environment default by evicting from Database and Redis.
     */
    @DeleteMapping("/{key}/reset")
    public ResponseEntity<ApiResponse<Void>> resetConfig(
            @PathVariable("key") String key) {

        systemConfigService.resetConfigToDefault(key);
        return ResponseEntity.ok(ApiResponse.success(null, "Configuration reset to default successfully"));
    }

    /**
     * Flush and reload all Database configurations into Redis cache.
     */
    @PostMapping("/refresh-cache")
    public ResponseEntity<ApiResponse<Void>> refreshCache() {
        systemConfigService.refreshRedisCache();
        return ResponseEntity.ok(ApiResponse.success(null, "Redis system configuration cache refreshed successfully"));
    }
}
