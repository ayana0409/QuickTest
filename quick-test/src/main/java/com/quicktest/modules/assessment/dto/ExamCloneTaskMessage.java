package com.quicktest.modules.assessment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Message payload published to RabbitMQ for asynchronous background exam image duplication.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamCloneTaskMessage implements Serializable {

    private UUID newExamId;
    private UUID teacherId;

    @Builder.Default
    private List<ImageCloneItem> items = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ImageCloneItem implements Serializable {
        private UUID questionId;
        private UUID optionId; // null if this is a question image
        private String sourceUrl;
        private String sourcePublicId;
        private String targetFolder; // "questions" or "options"
    }
}
