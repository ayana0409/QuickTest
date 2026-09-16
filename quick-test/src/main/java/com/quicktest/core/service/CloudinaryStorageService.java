package com.quicktest.core.service;

import com.quicktest.modules.assessment.dto.MediaUploadResponse;
import org.springframework.web.multipart.MultipartFile;

/**
 * Service for managing media uploads and deletions using Cloudinary.
 */
public interface CloudinaryStorageService {

    /**
     * Uploads a single multipart file synchronously to Cloudinary.
     *
     * @param file       multipart file from client
     * @param folderType target folder alias (e.g. "questions", "options")
     * @return metadata of uploaded image
     */
    MediaUploadResponse uploadSingle(MultipartFile file, String folderType);

    /**
     * Uploads an image from raw byte array (used by asynchronous background workers).
     *
     * @param data        binary data of image
     * @param filename    original file name
     * @param contentType MIME type of image
     * @param folder      target Cloudinary folder path
     * @return metadata of uploaded image
     */
    MediaUploadResponse uploadFromBytes(byte[] data, String filename, String contentType, String folder);

    /**
     * Deletes an image from Cloudinary by its publicId.
     *
     * @param publicId Cloudinary public identifier
     */
    void deleteMedia(String publicId);

    /**
     * Batch deletes multiple media items from Cloudinary in a single API request,
     * avoiding N+1 network calls.
     *
     * @param publicIdsOrUrls list of Cloudinary public identifiers or secure URLs
     */
    void deleteMediaBatch(java.util.List<String> publicIdsOrUrls);

    /**
     * Duplicates an existing image by uploading from its source URL to a new asset in Cloudinary,
     * generating a distinct publicId and secureUrl.
     *
     * @param sourceUrl  URL of the existing image to clone
     * @param folderType target folder alias (e.g. "questions", "options")
     * @return metadata of the newly duplicated image
     */
    MediaUploadResponse duplicateImage(String sourceUrl, String folderType);
}

