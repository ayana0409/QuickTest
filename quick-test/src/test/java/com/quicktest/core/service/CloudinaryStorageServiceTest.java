package com.quicktest.core.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Uploader;
import com.quicktest.config.CloudinaryProperties;
import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.dto.MediaUploadResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class CloudinaryStorageServiceTest {

    @Mock
    private Cloudinary cloudinary;

    @Mock
    private Uploader uploader;

    private CloudinaryProperties properties;
    private CloudinaryStorageServiceImpl storageService;

    @BeforeEach
    void setUp() {
        properties = new CloudinaryProperties();
        properties.getUpload().setMaxFileSizeBytes(3145728L);
        properties.getUpload().setAllowedFormats("jpg,jpeg,png,webp,gif");
        properties.getStorage().setQuestionFolder("quick-test/questions");
        properties.getStorage().setOptionFolder("quick-test/options");

        storageService = new CloudinaryStorageServiceImpl(cloudinary, properties);
    }

    @Test
    @DisplayName("Should throw exception when uploading empty file")
    void testUploadSingle_EmptyFile_ThrowsException() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "test.png", "image/png", new byte[0]);

        AppException ex = assertThrows(AppException.class, () ->
                storageService.uploadSingle(emptyFile, "questions"));

        assertTrue(ex.getMessage().contains("empty"));
    }

    @Test
    @DisplayName("Should throw exception when file format is not allowed")
    void testUploadSingle_InvalidFormat_ThrowsException() {
        MockMultipartFile txtFile = new MockMultipartFile("file", "document.pdf", "application/pdf", new byte[]{1, 2, 3});

        AppException ex = assertThrows(AppException.class, () ->
                storageService.uploadSingle(txtFile, "questions"));

        assertTrue(ex.getMessage().contains("Invalid file format"));
    }

    @Test
    @DisplayName("Should throw exception when file size exceeds 3MB limit")
    void testUploadSingle_FileTooLarge_ThrowsException() {
        byte[] largeData = new byte[3145728 + 10]; // Exceeds 3MB
        MockMultipartFile largeFile = new MockMultipartFile("file", "large.png", "image/png", largeData);

        AppException ex = assertThrows(AppException.class, () ->
                storageService.uploadSingle(largeFile, "questions"));

        assertTrue(ex.getMessage().contains("File size exceeds"));
    }

    @Test
    @DisplayName("Should upload single image successfully when valid")
    void testUploadSingle_Success() throws IOException {
        MockMultipartFile validFile = new MockMultipartFile("file", "diagram.png", "image/png", new byte[]{10, 20, 30});

        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.upload(any(byte[].class), anyMap())).thenReturn(Map.of(
                "secure_url", "https://res.cloudinary.com/test/image/upload/diagram.png",
                "public_id", "quick-test/questions/diagram",
                "format", "png",
                "bytes", 30L
        ));

        MediaUploadResponse response = storageService.uploadSingle(validFile, "questions");

        assertNotNull(response);
        assertEquals("https://res.cloudinary.com/test/image/upload/diagram.png", response.getUrl());
        assertEquals("quick-test/questions/diagram", response.getPublicId());
        assertEquals("diagram.png", response.getOriginalFilename());
        assertEquals("png", response.getFormat());
    }

    @Test
    @DisplayName("Should delete media from Cloudinary without error")
    void testDeleteMedia_Success() throws IOException {
        when(cloudinary.uploader()).thenReturn(uploader);
        when(uploader.destroy(eq("test_public_id"), anyMap())).thenReturn(Map.of("result", "ok"));

        assertDoesNotThrow(() -> storageService.deleteMedia("test_public_id"));
        verify(uploader, times(1)).destroy(eq("test_public_id"), anyMap());
    }
}
