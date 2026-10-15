package com.quicktest.modules.assessment.ai;

import com.quicktest.core.exception.AppException;
import com.quicktest.modules.assessment.ai.service.DocumentParserService;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("DocumentParserService Unit Tests")
class DocumentParserServiceTest {

    private DocumentParserService documentParserService;

    @BeforeEach
    void setUp() {
        documentParserService = new DocumentParserService();
    }

    @Test
    @DisplayName("Should successfully extract and sanitize text from plain text file")
    void testExtractText_PlainText_Success() {
        String content = "Chương 1: Lập trình Java căn bản\n" +
                "Java là một ngôn ngữ lập trình hướng đối tượng mạnh mẽ và bảo mật.\n" +
                "Nó hỗ trợ tính đa hình, kế thừa, đóng gói và trừu tượng.";

        MockMultipartFile file = new MockMultipartFile(
                "file", "bai_hoc.txt", "text/plain", content.getBytes(StandardCharsets.UTF_8));

        String extracted = documentParserService.extractText(file);

        assertNotNull(extracted);
        assertTrue(extracted.contains("Lập trình Java căn bản"));
        assertTrue(extracted.contains("đa hình, kế thừa"));
    }

    @Test
    @DisplayName("Should extract text from DOCX document")
    void testExtractText_Docx_Success() throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (XWPFDocument doc = new XWPFDocument()) {
            XWPFParagraph p1 = doc.createParagraph();
            p1.createRun().setText("Bài giảng: Cấu trúc dữ liệu và giải thuật.");
            XWPFParagraph p2 = doc.createParagraph();
            p2.createRun().setText("Cây tìm kiếm nhị phân (Binary Search Tree - BST) có độ phức tạp trung bình O(log N).");
            doc.write(baos);
        }

        MockMultipartFile file = new MockMultipartFile(
                "file", "bai_giang.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                baos.toByteArray());

        String extracted = documentParserService.extractText(file);

        assertNotNull(extracted);
        assertTrue(extracted.contains("Cấu trúc dữ liệu và giải thuật"));
        assertTrue(extracted.contains("Binary Search Tree"));
    }

    @Test
    @DisplayName("Should throw BAD_REQUEST when file is empty or missing")
    void testExtractText_EmptyFile_ThrowsBadRequest() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.txt", "text/plain", new byte[0]);

        AppException ex = assertThrows(AppException.class, () ->
                documentParserService.extractText(emptyFile));

        assertEquals(400, ex.getStatus().value());
    }

    @Test
    @DisplayName("Should throw BAD_REQUEST when file format is unsupported")
    void testExtractText_UnsupportedFormat_ThrowsBadRequest() {
        MockMultipartFile exeFile = new MockMultipartFile(
                "file", "malware.exe", "application/octet-stream", "dummy binary data".getBytes());

        AppException ex = assertThrows(AppException.class, () ->
                documentParserService.extractText(exeFile));

        assertEquals(400, ex.getStatus().value());
        assertTrue(ex.getMessage().contains("Unsupported file format"));
    }

    @Test
    @DisplayName("Should sanitize control characters and normalize excessive whitespace")
    void testSanitizeText_CleansFormattingAndControlChars() {
        String dirtyText = "   Dòng 1    với    khoảng trắng thừa.   \n\n\n\n\n\r   Dòng 2.\u0000\u0007   ";

        String sanitized = documentParserService.sanitizeText(dirtyText);

        assertFalse(sanitized.contains("\u0000"));
        assertFalse(sanitized.contains("   "));
        assertTrue(sanitized.contains("Dòng 1 với khoảng trắng thừa."));
        assertTrue(sanitized.contains("Dòng 2."));
    }
}
