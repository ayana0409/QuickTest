package com.quicktest.core.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Public ping and server wake-up controller.
 * Provides both JSON API and HTML status dashboard for monitoring, uptime probes,
 * and waking up free-tier cold instances (Render, Railway, Koyeb).
 */
@RestController
public class SystemPingController {

    @Value("${spring.application.name:quick-test}")
    private String applicationName;

    @Value("${app.version:1.0.0}")
    private String appVersion;

    /**
     * Unified root and ping endpoint supporting JSON for API probes and HTML for browser visits.
     */
    @GetMapping(value = { "/", "/ping", "/api/ping" })
    public ResponseEntity<?> ping(@RequestHeader(value = HttpHeaders.ACCEPT, defaultValue = "*/*") String acceptHeader) {
        long uptimeSeconds = ManagementFactory.getRuntimeMXBean().getUptime() / 1000;
        long totalMemoryMb = Runtime.getRuntime().totalMemory() / (1024 * 1024);
        long freeMemoryMb = Runtime.getRuntime().freeMemory() / (1024 * 1024);
        long usedMemoryMb = totalMemoryMb - freeMemoryMb;

        if (acceptHeader != null && acceptHeader.contains(MediaType.TEXT_HTML_VALUE)) {
            String html = generateStatusHtml(uptimeSeconds, usedMemoryMb, totalMemoryMb);
            return ResponseEntity.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .body(html);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "UP");
        response.put("message", "QuickTest Backend is Live & Healthy");
        response.put("service", applicationName);
        response.put("version", appVersion);
        response.put("uptimeSeconds", uptimeSeconds);
        response.put("usedMemoryMb", usedMemoryMb);
        response.put("timestamp", Instant.now().toString());

        return ResponseEntity.ok(response);
    }

    /**
     * Generates a sleek, high-end dark mode operational status page for direct browser visits.
     */
    private String generateStatusHtml(long uptimeSeconds, long usedMemoryMb, long totalMemoryMb) {
        long hours = uptimeSeconds / 3600;
        long minutes = (uptimeSeconds % 3600) / 60;
        long seconds = uptimeSeconds % 60;
        String uptimeStr = String.format("%02dh %02dm %02ds", hours, minutes, seconds);

        return """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>QuickTest Backend — Operational Status</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
                <style>
                    :root {
                        --bg: #09090b;
                        --card: #121215;
                        --border: #27272a;
                        --text-primary: #f4f4f5;
                        --text-secondary: #a1a1aa;
                        --emerald: #10b981;
                        --emerald-glow: rgba(16, 185, 129, 0.25);
                        --indigo: #6366f1;
                    }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        background-color: var(--bg);
                        color: var(--text-primary);
                        font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 24px;
                    }
                    .container {
                        max-width: 580px;
                        width: 100%;
                        background: var(--card);
                        border: 1px solid var(--border);
                        border-radius: 20px;
                        padding: 36px;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 80px rgba(99, 102, 241, 0.08);
                        position: relative;
                        overflow: hidden;
                    }
                    .top-glow {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 3px;
                        background: linear-gradient(90deg, #10b981, #6366f1, #10b981);
                        background-size: 200% auto;
                        animation: shine 4s linear infinite;
                    }
                    @keyframes shine { to { background-position: 200% center; } }
                    .header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 24px;
                    }
                    .logo-wrap {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .logo-icon {
                        width: 42px;
                        height: 42px;
                        border-radius: 12px;
                        background: linear-gradient(135deg, #4f46e5, #7c3aed);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 20px;
                        font-weight: 800;
                        box-shadow: 0 8px 16px rgba(79, 70, 229, 0.3);
                    }
                    .logo-text h1 {
                        font-size: 20px;
                        font-weight: 700;
                        letter-spacing: -0.02em;
                    }
                    .logo-text span {
                        font-size: 12px;
                        color: var(--text-secondary);
                        font-family: 'JetBrains Mono', monospace;
                    }
                    .status-pill {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        background: rgba(16, 185, 129, 0.1);
                        border: 1px solid rgba(16, 185, 129, 0.25);
                        padding: 6px 14px;
                        border-radius: 9999px;
                        font-size: 13px;
                        font-weight: 600;
                        color: var(--emerald);
                    }
                    .pulse-dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background-color: var(--emerald);
                        box-shadow: 0 0 12px var(--emerald);
                        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.4; transform: scale(0.85); }
                    }
                    .banner {
                        background: rgba(24, 24, 27, 0.6);
                        border: 1px solid rgba(39, 39, 42, 0.8);
                        border-radius: 14px;
                        padding: 16px 20px;
                        margin-bottom: 24px;
                    }
                    .banner p {
                        font-size: 14px;
                        color: var(--text-secondary);
                        line-height: 1.5;
                    }
                    .banner strong {
                        color: var(--text-primary);
                    }
                    .grid-stats {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 12px;
                        margin-bottom: 24px;
                    }
                    .stat-card {
                        background: rgba(24, 24, 27, 0.4);
                        border: 1px solid var(--border);
                        border-radius: 12px;
                        padding: 14px 16px;
                    }
                    .stat-label {
                        font-size: 12px;
                        color: var(--text-secondary);
                        margin-bottom: 4px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        font-weight: 600;
                    }
                    .stat-value {
                        font-size: 16px;
                        font-weight: 700;
                        font-family: 'JetBrains Mono', monospace;
                        color: var(--text-primary);
                    }
                    .links {
                        display: flex;
                        gap: 10px;
                    }
                    .btn {
                        flex: 1;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        padding: 10px 16px;
                        border-radius: 10px;
                        font-size: 13px;
                        font-weight: 600;
                        text-decoration: none;
                        transition: all 0.2s ease;
                    }
                    .btn-primary {
                        background: #27272a;
                        color: var(--text-primary);
                        border: 1px solid #3f3f46;
                    }
                    .btn-primary:hover {
                        background: #3f3f46;
                        border-color: #52525b;
                    }
                    .btn-accent {
                        background: #4f46e5;
                        color: #ffffff;
                    }
                    .btn-accent:hover {
                        background: #4338ca;
                    }
                    .footer {
                        margin-top: 20px;
                        text-align: center;
                        font-size: 12px;
                        color: #71717a;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="top-glow"></div>
                    <div class="header">
                        <div class="logo-wrap">
                            <div class="logo-icon">⚡</div>
                            <div class="logo-text">
                                <h1>QuickTest Server</h1>
                                <span>API & AI Proctoring Core</span>
                            </div>
                        </div>
                        <div class="status-pill">
                            <span class="pulse-dot"></span>
                            OPERATIONAL
                        </div>
                    </div>
                    <div class="banner">
                        <p>Máy chủ dịch vụ <strong>QuickTest Backend</strong> đang chạy ổn định và sẵn sàng tiếp nhận các kết nối kiểm thử, phòng thi viễn trắc và tiến trình AI.</p>
                    </div>
                    <div class="grid-stats">
                        <div class="stat-card">
                            <div class="stat-label">JVM Uptime</div>
                            <div class="stat-value">{{UPTIME}}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">RAM Usage</div>
                            <div class="stat-value">{{RAM_USAGE}}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Java Version</div>
                            <div class="stat-value">JDK 21 (Temurin)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Protocol</div>
                            <div class="stat-value">REST &amp; STOMP / WS</div>
                        </div>
                    </div>
                    <div class="links">
                        <a href="/swagger-ui/index.html" class="btn btn-primary" target="_blank">📖 Swagger UI</a>
                        <a href="/api/ping" class="btn btn-accent">⚡ JSON Ping Probe</a>
                    </div>
                    <div class="footer">
                        QuickTest Enterprise Assessment Platform &bull; All Rights Reserved
                    </div>
                </div>
            </body>
            </html>
            """
            .replace("{{UPTIME}}", uptimeStr)
            .replace("{{RAM_USAGE}}", usedMemoryMb + "MB / " + totalMemoryMb + "MB");
    }
}
