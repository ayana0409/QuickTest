package com.quicktest.core.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.quicktest.config.CloudinaryProperties;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.dto.MediaUploadResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Implementation of CloudinaryStorageService providing synchronous upload,
 * byte array upload, and media deletion using Cloudinary Java SDK.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CloudinaryStorageServiceImpl implements CloudinaryStorageService {

    private final Cloudinary cloudinary;
    private final CloudinaryProperties cloudinaryProperties;

    @Override
    public MediaUploadResponse uploadSingle(MultipartFile file, String folderType) {
        if (file == null || file.isEmpty()) {
            throw new AppException("Uploaded file must not be empty", HttpStatus.BAD_REQUEST);
        }

        validateFile(file.getOriginalFilename(), file.getSize());
        String targetFolder = resolveFolder(folderType);

        try {
            byte[] bytes = file.getBytes();
            return uploadFromBytes(bytes, file.getOriginalFilename(), file.getContentType(), targetFolder);
        } catch (IOException e) {
            log.error("Failed to read file content for upload: {}", file.getOriginalFilename(), e);
            throw new AppException("Failed to process file for upload: " + e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public MediaUploadResponse uploadFromBytes(byte[] data, String filename, String contentType, String folder) {
        if (data == null || data.length == 0) {
            throw new AppException("File content cannot be empty", HttpStatus.BAD_REQUEST);
        }

        validateFile(filename, data.length);
        String targetFolder = (folder != null && !folder.isBlank()) ? folder : resolveFolder(null);

        try {
            Map<String, Object> params = ObjectUtils.asMap(
                    "folder", targetFolder,
                    "resource_type", "image",
                    "quality", "auto",
                    "fetch_format", "auto"
            );

            log.info("Uploading image to Cloudinary: filename={}, targetFolder={}, size={} bytes",
                    filename, targetFolder, data.length);

            Map<String, Object> uploadResult = cloudinary.uploader().upload(data, params);

            String secureUrl = (String) uploadResult.get("secure_url");
            String publicId = (String) uploadResult.get("public_id");
            String format = (String) uploadResult.get("format");
            Number bytesCount = (Number) uploadResult.get("bytes");
            Long size = bytesCount != null ? bytesCount.longValue() : (long) data.length;

            log.info("Successfully uploaded image to Cloudinary: publicId={}, url={}", publicId, secureUrl);

            return MediaUploadResponse.builder()
                    .url(secureUrl)
                    .publicId(publicId)
                    .originalFilename(filename)
                    .folder(targetFolder)
                    .format(format)
                    .size(size)
                    .build();
        } catch (Exception e) {
            log.error("Cloudinary upload failed for filename={}: {}", filename, e.getMessage(), e);
            throw new AppException("Media upload service temporarily unavailable: " + e.getMessage(),
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    @Override
    public void deleteMedia(String publicIdOrUrl) {
        if (publicIdOrUrl == null || publicIdOrUrl.isBlank()) {
            return;
        }

        String targetPublicId = extractPublicId(publicIdOrUrl);
        if (targetPublicId == null || targetPublicId.isBlank()) {
            targetPublicId = publicIdOrUrl.trim();
        }

        try {
            log.info("Deleting media from Cloudinary: publicId={}", targetPublicId);
            cloudinary.uploader().destroy(targetPublicId, ObjectUtils.emptyMap());
            log.info("Successfully requested media deletion for publicId={}", targetPublicId);
        } catch (Exception e) {
            log.warn("Failed to delete media from Cloudinary for publicId={}: {}", targetPublicId, e.getMessage());
            // Do not fail the business operation on deletion cleanup errors
        }
    }

    @Override
    public void deleteMediaBatch(List<String> publicIdsOrUrls) {
        if (publicIdsOrUrls == null || publicIdsOrUrls.isEmpty()) {
            return;
        }

        List<String> targetPublicIds = publicIdsOrUrls.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(item -> {
                    String extracted = extractPublicId(item);
                    return (extracted != null && !extracted.isBlank()) ? extracted : item.trim();
                })
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        if (targetPublicIds.isEmpty()) {
            return;
        }

        try {
            log.info("Batch deleting {} media resources from Cloudinary in a single API call: {}",
                    targetPublicIds.size(), targetPublicIds);
            cloudinary.api().deleteResources(targetPublicIds, ObjectUtils.emptyMap());
            log.info("Successfully executed batch deletion for {} media resources", targetPublicIds.size());
        } catch (Exception e) {
            log.warn("Cloudinary batch delete via Admin API failed ({}), falling back to individual destroy calls", e.getMessage());
            for (String pid : targetPublicIds) {
                try {
                    cloudinary.uploader().destroy(pid, ObjectUtils.emptyMap());
                } catch (Exception ex) {
                    log.warn("Fallback single delete failed for publicId [{}]: {}", pid, ex.getMessage());
                }
            }
        }
    }


    /**
     * Extracts Cloudinary publicId from a secure URL or returns null if not an URL.
     */
    private String extractPublicId(String url) {
        if (url == null || !url.contains("/upload/")) {
            return null;
        }
        try {
            int uploadIdx = url.indexOf("/upload/");
            String afterUpload = url.substring(uploadIdx + "/upload/".length());
            if (afterUpload.contains("/")) {
                String[] segments = afterUpload.split("/");
                int startIdx = 0;
                while (startIdx < segments.length && (segments[startIdx].startsWith("v") && segments[startIdx].substring(1).matches("\\d+") || segments[startIdx].contains(","))) {
                    startIdx++;
                }
                StringBuilder sb = new StringBuilder();
                for (int i = startIdx; i < segments.length; i++) {
                    if (sb.length() > 0) sb.append("/");
                    sb.append(segments[i]);
                }
                afterUpload = sb.toString();
            }
            int dotIdx = afterUpload.lastIndexOf('.');
            if (dotIdx != -1) {
                afterUpload = afterUpload.substring(0, dotIdx);
            }
            return afterUpload.isBlank() ? null : afterUpload;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Validates file size and format against configured properties.
     */
    private void validateFile(String filename, long size) {
        long maxSizeBytes = cloudinaryProperties.getUpload().getMaxFileSizeBytes();
        if (size > maxSizeBytes) {
            throw new AppException(
                    String.format("File size exceeds maximum limit of %dMB", maxSizeBytes / (1024 * 1024)),
                    HttpStatus.BAD_REQUEST
            );
        }

        if (filename == null || !filename.contains(".")) {
            throw new AppException("Invalid file format. Allowed: jpg, png, webp, gif", HttpStatus.BAD_REQUEST);
        }

        String extension = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
        List<String> allowedFormats = cloudinaryProperties.getUpload().getAllowedFormatList();

        if (!allowedFormats.contains(extension)) {
            throw new AppException("Invalid file format. Allowed: jpg, png, webp, gif", HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Resolves target Cloudinary folder name from alias.
     */
    private String resolveFolder(String folderType) {
        if ("options".equalsIgnoreCase(folderType)) {
            return cloudinaryProperties.getStorage().getOptionFolder();
        }
        return cloudinaryProperties.getStorage().getQuestionFolder();
    }
}
