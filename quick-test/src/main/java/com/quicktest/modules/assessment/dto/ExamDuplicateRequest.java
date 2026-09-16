package com.quicktest.modules.assessment.dto;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for duplicating an existing exam with optional custom title.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamDuplicateRequest {

    @Size(max = 200, message = "Exam title must not exceed 200 characters")
    private String title;
}
