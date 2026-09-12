package com.quicktest.modules.assessment.dto;

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

    private String content;

    private String imageUrl;

    private String imagePublicId;

    @Builder.Default
    private Boolean isCorrect = false;
}
