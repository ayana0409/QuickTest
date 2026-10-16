package com.quicktest.core.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SystemPingControllerTest {

    private final SystemPingController controller = new SystemPingController();

    @Test
    @DisplayName("Should return UP status and JSON details for API client requests")
    void testPing_ReturnsJson() {
        ResponseEntity<?> response = controller.ping("application/json");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody() instanceof Map);

        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals("UP", body.get("status"));
        assertTrue(body.containsKey("uptimeSeconds"));
        assertTrue(body.containsKey("timestamp"));
    }

    @Test
    @DisplayName("Should return HTML status dashboard for browser visits")
    void testPing_ReturnsHtmlForBrowser() {
        ResponseEntity<?> response = controller.ping("text/html,application/xhtml+xml");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(MediaType.TEXT_HTML, response.getHeaders().getContentType());
        assertTrue(response.getBody() instanceof String);

        String html = (String) response.getBody();
        assertTrue(html.contains("QuickTest Backend"));
        assertTrue(html.contains("OPERATIONAL"));
        assertTrue(html.contains("JVM Uptime"));
    }
}
