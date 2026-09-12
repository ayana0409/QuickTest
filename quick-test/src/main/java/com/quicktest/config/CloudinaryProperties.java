package com.quicktest.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;

/**
 * Configuration properties for Cloudinary media storage.
 * Mapped from prefix "cloudinary" in application.properties / application.yml.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "cloudinary")
@SuppressWarnings("null")
public class CloudinaryProperties {

    /**
     * Cloudinary cloud name.
     */
    private String cloudName = "xxx";

    /**
     * Cloudinary API key.
     */
    private String apiKey = "xxx";

    /**
     * Cloudinary API secret.
     */
    private String apiSecret = "xxx";

    /**
     * Storage folder and path configurations.
     */
    private StorageConfig storage = new StorageConfig();

    /**
     * Upload validation rules (max file size, permitted formats).
     */
    private UploadConfig upload = new UploadConfig();

    @Getter
    @Setter
    public static class StorageConfig {
        /**
         * Local temporary upload directory if needed.
         */
        private String uploadDir = "uploads";

        /**
         * Cloudinary folder path for question images.
         */
        private String questionFolder = "quick-test/questions";

        /**
         * Cloudinary folder path for answer option images.
         */
        private String optionFolder = "quick-test/options";

        /**
         * Base URL for Cloudinary images.
         */
        private String imageBaseUrl = "https://res.cloudinary.com/rg1alnza/image/upload/quick-test/questions/";
    }

    @Getter
    @Setter
    public static class UploadConfig {
        /**
         * Maximum allowed file size in bytes (default 3MB = 3,145,728 bytes).
         */
        private long maxFileSizeBytes = 3145728L;

        /**
         * Comma-separated or list of allowed image extensions.
         */
        private String allowedFormats = "jpg,jpeg,png,webp,gif";

        public List<String> getAllowedFormatList() {
            if (allowedFormats == null || allowedFormats.isBlank()) {
                return List.of("jpg", "jpeg", "png", "webp", "gif");
            }
            return Arrays.stream(allowedFormats.split(","))
                    .map(String::trim)
                    .map(String::toLowerCase)
                    .toList();
        }
    }
}
