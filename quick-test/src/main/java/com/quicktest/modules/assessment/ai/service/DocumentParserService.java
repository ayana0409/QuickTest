package com.quicktest.modules.assessment.ai.service;

import com.quicktest.core.exception.AppException;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Service for extracting and sanitizing clean textual content from various document formats:
 * PDF (.pdf), Microsoft Word (.docx), and Plain Text (.txt, .md).
 */
@Slf4j
@Service
public class DocumentParserService {

    private static final int MAX_PDF_PAGES = 50;
    private static final int MAX_EXTRACTED_CHARS = 45_000; // ~15,000 tokens safety cap for Gemini context

    /**
     * Extracts text content from an uploaded multipart file based on its filename/MIME type.
     *
     * @param file Uploaded document file.
     * @return Sanitized text extracted from the document.
     */
    public String extractText(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException("Uploaded document file is empty or missing", HttpStatus.BAD_REQUEST);
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        log.info("[DocParser] Extracting text from uploaded file: {}, size: {} bytes",
                originalFilename, file.getSize());

        try {
            String extracted;
            if (originalFilename.endsWith(".pdf") || "application/pdf".equals(file.getContentType())) {
                extracted = extractFromPdf(file.getBytes());
            } else if (originalFilename.endsWith(".docx") ||
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(file.getContentType())) {
                try (InputStream is = file.getInputStream()) {
                    extracted = extractFromDocx(is);
                }
            } else if (originalFilename.endsWith(".txt") || originalFilename.endsWith(".md") ||
                    "text/plain".equals(file.getContentType()) || "text/markdown".equals(file.getContentType())) {
                extracted = new String(file.getBytes(), StandardCharsets.UTF_8);
            } else {
                throw new AppException("Unsupported file format. Please upload a PDF (.pdf), Word (.docx), or Text (.txt/.md) file.",
                        HttpStatus.BAD_REQUEST);
            }

            String sanitized = sanitizeText(extracted);
            if (sanitized.isBlank() || sanitized.length() < 30) {
                throw new AppException("The document does not contain enough readable text content to generate quiz questions.",
                        HttpStatus.BAD_REQUEST);
            }

            log.info("[DocParser] Successfully extracted {} characters from '{}'", sanitized.length(), originalFilename);
            return sanitized;

        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            log.error("[DocParser] Failed to parse document '{}': {}", originalFilename, e.getMessage(), e);
            throw new AppException("Failed to read document contents: " + e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Extracts text from PDF bytes using Apache PDFBox 3.x.
     */
    public String extractFromPdf(byte[] pdfBytes) {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            if (document.isEncrypted()) {
                throw new AppException("Encrypted or password-protected PDF files are not supported.", HttpStatus.BAD_REQUEST);
            }

            int totalPages = document.getNumberOfPages();
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            stripper.setStartPage(1);
            stripper.setEndPage(Math.min(totalPages, MAX_PDF_PAGES));

            String text = stripper.getText(document);
            if (text == null || text.isBlank()) {
                throw new AppException("Unable to extract text from PDF. The document may be an image scan without text layer.",
                        HttpStatus.BAD_REQUEST);
            }
            return text;
        } catch (AppException ae) {
            throw ae;
        } catch (Exception e) {
            throw new AppException("PDF parsing error: " + e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Extracts text from Word (.docx) stream using Apache POI.
     */
    public String extractFromDocx(InputStream inputStream) {
        try (XWPFDocument document = new XWPFDocument(inputStream)) {
            StringBuilder sb = new StringBuilder();

            // Extract paragraphs
            for (XWPFParagraph para : document.getParagraphs()) {
                String text = para.getText();
                if (text != null && !text.isBlank()) {
                    sb.append(text.trim()).append("\n");
                }
            }

            // Extract tables
            for (XWPFTable table : document.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        String cellText = cell.getText();
                        if (cellText != null && !cellText.isBlank()) {
                            sb.append(cellText.trim()).append(" | ");
                        }
                    }
                    sb.append("\n");
                }
            }

            return sb.toString();
        } catch (Exception e) {
            throw new AppException("Word document parsing error: " + e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Cleans whitespace, drops control characters, and applies token safety cap.
     */
    public String sanitizeText(String rawText) {
        if (rawText == null) return "";

        // Remove non-printable control characters (except newline, tab, carriage return)
        String cleaned = rawText.replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", " ");

        // Normalize multiple spaces and repeated blank lines
        cleaned = cleaned.replaceAll("[ \\t]+", " ");
        cleaned = cleaned.replaceAll("(?m)^[ \\t]*\\r?\\n", ""); // remove empty lines
        cleaned = cleaned.replaceAll("(\\r?\\n){3,}", "\n\n");  // max 2 consecutive newlines

        cleaned = cleaned.trim();

        // Enforce maximum character safety cap
        if (cleaned.length() > MAX_EXTRACTED_CHARS) {
            log.info("[DocParser] Document length ({} chars) exceeds safety cap. Truncating to {} chars.",
                    cleaned.length(), MAX_EXTRACTED_CHARS);
            cleaned = cleaned.substring(0, MAX_EXTRACTED_CHARS) + "\n\n[...Content truncated for optimal AI token budget...]";
        }

        return cleaned;
    }
}
