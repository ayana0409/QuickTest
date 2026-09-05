package com.quicktest.modules.session.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO to initialize or start an exam session.
 * Supports authenticated students and guest candidates.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StartExamRequest {

    @NotBlank(message = "Access code is required")
    private String accessCode;

    // Optional for authenticated users; required for guests
    private String guestName;

    // Optional for authenticated users; required for guests (Student ID, email, or phone)
    private String guestIdentifier;
}
