package com.quicktest.modules.session.dto;

import com.quicktest.modules.assessment.entity.AnswerOption;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Option DTO presented to candidates.
 * CRITICAL SECURITY: Does NOT contain the isCorrect flag to prevent client-side inspection cheating.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OptionInPaperDto {

    private UUID id;
    private Integer orderIndex;
    private String content;

    public static OptionInPaperDto fromEntity(AnswerOption option) {
        if (option == null) {
            return null;
        }
        return OptionInPaperDto.builder()
                .id(option.getId())
                .orderIndex(option.getOrderIndex())
                .content(option.getContent())
                .build();
    }
}
