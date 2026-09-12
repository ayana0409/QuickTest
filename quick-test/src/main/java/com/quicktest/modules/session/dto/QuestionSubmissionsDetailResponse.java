package com.quicktest.modules.session.dto;

import com.quicktest.core.common.PageResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Question detail and rubric along with paginated candidate submissions.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionSubmissionsDetailResponse {

    private UUID questionId;
    private Integer orderIndex;
    private String content;
    private String imageUrl;
    private String sampleAnswer;
    private String gradingRubric;
    private Double maxPoints;
    private PageResponse<CandidateSubmissionItemDto> submissions;
}
