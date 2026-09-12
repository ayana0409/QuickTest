package com.quicktest.config;

import com.cloudinary.Cloudinary;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

/**
 * Cloudinary bean configuration initializing a thread-safe Cloudinary instance.
 */
@Configuration
@EnableConfigurationProperties(CloudinaryProperties.class)
public class CloudinaryConfig {

    private final CloudinaryProperties cloudinaryProperties;

    public CloudinaryConfig(CloudinaryProperties cloudinaryProperties) {
        this.cloudinaryProperties = cloudinaryProperties;
    }

    /**
     * Initializes a thread-safe singleton Cloudinary client.
     */
    @Bean
    public Cloudinary cloudinary() {
        Map<String, Object> config = Map.of(
                "cloud_name", cloudinaryProperties.getCloudName() != null ? cloudinaryProperties.getCloudName() : "",
                "api_key", cloudinaryProperties.getApiKey() != null ? cloudinaryProperties.getApiKey() : "",
                "api_secret", cloudinaryProperties.getApiSecret() != null ? cloudinaryProperties.getApiSecret() : "",
                "secure", true
        );
        return new Cloudinary(config);
    }
}
