package com.quicktest.modules.assessment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * Message payload sent over RabbitMQ for asynchronous background Cloudinary upload.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MediaUploadTaskMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    private String batchId;
    private String targetFolder;
    private String originalFilename;
    private byte[] fileData;
    private String contentType;
    private Integer fileIndex;
}
