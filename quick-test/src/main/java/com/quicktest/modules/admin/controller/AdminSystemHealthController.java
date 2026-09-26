package com.quicktest.modules.admin.controller;

import com.quicktest.modules.admin.dto.SystemHealthResponse;
import com.quicktest.modules.admin.service.AdminSystemHealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({ "/api/admin/system/health", "/api/v1/admin/system/health" })
@RequiredArgsConstructor
public class AdminSystemHealthController {

    private final AdminSystemHealthService adminSystemHealthService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SystemHealthResponse> getSystemHealth() {
        SystemHealthResponse health = adminSystemHealthService.getSystemHealth();
        return ResponseEntity.ok(health);
    }
}
