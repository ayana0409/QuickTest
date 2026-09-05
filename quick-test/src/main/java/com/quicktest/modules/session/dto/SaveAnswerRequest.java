package com.quicktest.modules.session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

/**
 * Auto-save request payload cached to Redis Hash during exam progress.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SaveAnswerRequest {

    @NotNull(message = "Question ID is required")
    private UUID questionId;

    // Set of selected option IDs (for SINGLE_CHOICE and MULTIPLE_CHOICE)
    private Set<UUID> selectedOptionIds;

    // Raw string input for NUMERIC or ESSAY_TEXT
    private String textAnswer;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    @Builder.Default
    private LocalDateTime savedAt = LocalDateTime.now();
}
