package com.quicktest.modules.assessment.dto;

import com.quicktest.modules.assessment.entity.AnswerOption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Data Transfer Object for returning answer options to teachers.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnswerOptionResponse {

    private UUID id;
    private Integer orderIndex;
    private String content;
    private String imageUrl;
    private String imagePublicId;
    private Boolean isCorrect;

    /**
     * Map AnswerOption entity to AnswerOptionResponse DTO.
     */
    public static AnswerOptionResponse fromEntity(AnswerOption option) {
        if (option == null) {
            return null;
        }
        return AnswerOptionResponse.builder()
                .id(option.getId())
                .orderIndex(option.getOrderIndex())
                .content(option.getContent())
                .imageUrl(option.getImageUrl())
                .imagePublicId(option.getImagePublicId())
                .isCorrect(option.getIsCorrect())
                .build();
    }
}
