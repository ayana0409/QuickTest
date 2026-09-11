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
}
