package com.quicktest.modules.assessment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response returned after a media file is successfully uploaded to Cloudinary.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MediaUploadResponse {

    private String url;
    private String publicId;
    private String originalFilename;
    private String folder;
    private Long size;
    private String format;
}
