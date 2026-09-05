package com.quicktest.modules.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for creating and updating answer options.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnswerOptionDto {

    private Integer orderIndex;

    @NotBlank(message = "Option content must not be blank")
    private String content;

    @Builder.Default
    private Boolean isCorrect = false;
}
