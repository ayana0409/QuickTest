package com.quicktest.modules.session.service;

import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.CandidateAnswer;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.entity.GradingStatus;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.DefaultIndexedColorMap;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Implementation of ExamExportService providing professional Excel reports for exam sessions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExamExportServiceImpl implements ExamExportService {

    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ExamRepository examRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final CandidateAnswerRepository candidateAnswerRepository;
    private final QuestionRepository questionRepository;

    @Override
    @Transactional(readOnly = true)
    public byte[] exportExamAttemptsToExcel(UUID examId, AttemptStatus status, String search, User currentTeacher) {
        log.info("Exporting exam attempts to Excel for examId: {}, status: {}, search: {}, teacherId: {}",
                examId, status, search, currentTeacher != null ? currentTeacher.getId() : null);

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam", "id", examId));

        verifyExamOwnership(exam, currentTeacher);

        String searchPattern = (search != null && !search.isBlank())
                ? "%" + search.trim().toLowerCase() + "%"
                : null;

        List<ExamAttempt> attempts = examAttemptRepository.findAttemptsForExport(
                examId,
                status,
                searchPattern,
                Sort.by(Sort.Direction.DESC, "submitTime")
        );

        // Fetch answered question counts in a single query to eliminate N+1 overhead
        List<Object[]> answeredRows = candidateAnswerRepository.countAnsweredQuestionsByExamId(examId);
        Map<UUID, Long> answeredCountMap = new HashMap<>();
        for (Object[] row : answeredRows) {
            if (row != null && row.length >= 2 && row[0] instanceof UUID attemptId && row[1] instanceof Number count) {
                answeredCountMap.put(attemptId, count.longValue());
            }
        }

        // Fetch aggregate statistics for the exam overview block
        Object[] stats = examAttemptRepository.computeAttemptStats(examId);

        return buildWorkbookBytes(exam, attempts, answeredCountMap, stats, status, search);
    }

    @Override
    @Transactional(readOnly = true)
    public byte[] exportSingleAttemptToExcel(UUID attemptId, User currentTeacher) {
        log.info("Exporting single exam attempt to Excel for attemptId: {}, teacherId: {}",
                attemptId, currentTeacher != null ? currentTeacher.getId() : null);

        ExamAttempt attempt = examAttemptRepository.findByIdWithExamAndUser(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("ExamAttempt", "id", attemptId));

        Exam exam = attempt.getExam();
        verifyExamOwnership(exam, currentTeacher);

        List<Question> questions = questionRepository.findByExamIdWithOptions(exam.getId());
        List<CandidateAnswer> answers = candidateAnswerRepository.findByExamAttemptIdWithQuestion(attemptId);

        Map<UUID, CandidateAnswer> answerMap = new HashMap<>();
        for (CandidateAnswer ca : answers) {
            if (ca.getQuestion() != null && ca.getQuestion().getId() != null) {
                answerMap.put(ca.getQuestion().getId(), ca);
            }
        }

        return buildSingleAttemptWorkbookBytes(attempt, exam, questions, answerMap);
    }

    private void verifyExamOwnership(Exam exam, User currentTeacher) {
        if (exam.getCreatedBy() == null || currentTeacher == null
                || !exam.getCreatedBy().getId().equals(currentTeacher.getId())) {
            throw new AccessDeniedException("You are not authorized to export data for this exam");
        }
    }

    private byte[] buildWorkbookBytes(
            Exam exam,
            List<ExamAttempt> attempts,
            Map<UUID, Long> answeredCountMap,
            Object[] stats,
            AttemptStatus statusFilter,
            String searchFilter) {

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Danh Sách Phiên Thi");
            sheet.setDisplayGridlines(true);

            // Palette colors
            byte[] primaryIndigo = new byte[]{(byte) 79, (byte) 70, (byte) 229}; // #4F46E5
            byte[] zebraStripe = new byte[]{(byte) 248, (byte) 250, (byte) 252}; // #F8FAFC
            byte[] metaBg = new byte[]{(byte) 241, (byte) 245, (byte) 249}; // #F1F5F9
            byte[] metaLabelBg = new byte[]{(byte) 226, (byte) 232, (byte) 240}; // #E2E8F0
            byte[] borderGray = new byte[]{(byte) 203, (byte) 213, (byte) 225}; // #CBD5E1

            DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();

            // Cell Styles
            XSSFCellStyle titleStyle = workbook.createCellStyle();
            XSSFFont titleFont = workbook.createFont();
            titleFont.setFontName("Segoe UI");
            titleFont.setFontHeightInPoints((short) 16);
            titleFont.setBold(true);
            titleFont.setColor(new XSSFColor(primaryIndigo, colorMap));
            titleStyle.setFont(titleFont);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFCellStyle subtitleStyle = workbook.createCellStyle();
            XSSFFont subtitleFont = workbook.createFont();
            subtitleFont.setFontName("Segoe UI");
            subtitleFont.setFontHeightInPoints((short) 9);
            subtitleFont.setItalic(true);
            subtitleFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subtitleStyle.setFont(subtitleFont);
            subtitleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // Metadata styles
            XSSFCellStyle metaLabelStyle = workbook.createCellStyle();
            XSSFFont metaLabelFont = workbook.createFont();
            metaLabelFont.setFontName("Segoe UI");
            metaLabelFont.setFontHeightInPoints((short) 10);
            metaLabelFont.setBold(true);
            metaLabelStyle.setFont(metaLabelFont);
            metaLabelStyle.setFillForegroundColor(new XSSFColor(metaLabelBg, colorMap));
            metaLabelStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            setThinBorders(metaLabelStyle, new XSSFColor(borderGray, colorMap));

            XSSFCellStyle metaValueStyle = workbook.createCellStyle();
            XSSFFont metaValueFont = workbook.createFont();
            metaValueFont.setFontName("Segoe UI");
            metaValueFont.setFontHeightInPoints((short) 10);
            metaValueStyle.setFont(metaValueFont);
            metaValueStyle.setFillForegroundColor(new XSSFColor(metaBg, colorMap));
            metaValueStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            setThinBorders(metaValueStyle, new XSSFColor(borderGray, colorMap));

            // Table Header style
            XSSFCellStyle headerStyle = workbook.createCellStyle();
            XSSFFont headerFont = workbook.createFont();
            headerFont.setFontName("Segoe UI");
            headerFont.setFontHeightInPoints((short) 10);
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(new XSSFColor(primaryIndigo, colorMap));
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            setThinBorders(headerStyle, new XSSFColor(new byte[]{(byte) 55, (byte) 48, (byte) 163}, colorMap));

            // Data styles
            DataFormat dataFormat = workbook.createDataFormat();

            XSSFCellStyle dataLeft = createDataStyle(workbook, HorizontalAlignment.LEFT, null, borderGray, colorMap);
            XSSFCellStyle dataCenter = createDataStyle(workbook, HorizontalAlignment.CENTER, null, borderGray, colorMap);
            XSSFCellStyle dataRight = createDataStyle(workbook, HorizontalAlignment.RIGHT, null, borderGray, colorMap);
            XSSFCellStyle dataNumber = createDataStyle(workbook, HorizontalAlignment.RIGHT, null, borderGray, colorMap);
            dataNumber.setDataFormat(dataFormat.getFormat("#,##0.00"));

            XSSFCellStyle dataZebraLeft = createDataStyle(workbook, HorizontalAlignment.LEFT, zebraStripe, borderGray, colorMap);
            XSSFCellStyle dataZebraCenter = createDataStyle(workbook, HorizontalAlignment.CENTER, zebraStripe, borderGray, colorMap);
            XSSFCellStyle dataZebraRight = createDataStyle(workbook, HorizontalAlignment.RIGHT, zebraStripe, borderGray, colorMap);
            XSSFCellStyle dataZebraNumber = createDataStyle(workbook, HorizontalAlignment.RIGHT, zebraStripe, borderGray, colorMap);
            dataZebraNumber.setDataFormat(dataFormat.getFormat("#,##0.00"));

            // Row 0: Title
            Row row0 = sheet.createRow(0);
            row0.setHeightInPoints(28);
            Cell cellTitle = row0.createCell(0);
            cellTitle.setCellValue("BÁO CÁO DANH SÁCH PHIÊN THI & KẾT QUẢ");
            cellTitle.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 7));

            // Row 1: Subtitle & Generated timestamp
            Row row1 = sheet.createRow(1);
            row1.setHeightInPoints(18);
            Cell cellSub = row1.createCell(0);
            cellSub.setCellValue("Hệ thống QuickTest - Xuất lúc: " + LocalDateTime.now().format(DATE_TIME_FORMATTER));
            cellSub.setCellStyle(subtitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 7));

            // Metadata block (Rows 3 - 6)
            int totalQuestions = (exam.getQuestions() != null) ? exam.getQuestions().size() : 0;
            double calculatedMaxPoints = 0.0;
            if (exam.getQuestions() != null) {
                for (Question q : exam.getQuestions()) {
                    if (q.getPoints() != null) {
                        calculatedMaxPoints += q.getPoints();
                    }
                }
            }
            Double maxScore = calculatedMaxPoints > 0 ? calculatedMaxPoints : null;
            Integer durationMins = exam.getDurationMinutes();

            // Stats extraction with safe array length bounds checking
            boolean hasStats = stats != null && stats.length >= 8;
            long totalAttempts = hasStats && stats[0] != null ? ((Number) stats[0]).longValue() : attempts.size();
            long completedAttempts = hasStats && stats[1] != null ? ((Number) stats[1]).longValue() : 0;
            Double avgScore = hasStats && stats[5] != null ? ((Number) stats[5]).doubleValue() : null;
            Double highestScore = hasStats && stats[6] != null ? ((Number) stats[6]).doubleValue() : null;
            Double lowestScore = hasStats && stats[7] != null ? ((Number) stats[7]).doubleValue() : null;

            createMetadataRow(sheet, 3, "Tên kỳ thi:", exam.getTitle(), "Mã phòng thi:", exam.getAccessCode() != null ? exam.getAccessCode() : "N/A", metaLabelStyle, metaValueStyle);
            createMetadataRow(sheet, 4, "Thời lượng:", (durationMins != null ? durationMins + " phút" : "Không giới hạn"), "Điểm tối đa:", (maxScore != null ? String.format("%.2f", maxScore) : "N/A"), metaLabelStyle, metaValueStyle);
            createMetadataRow(sheet, 5, "Tổng số câu hỏi:", String.valueOf(totalQuestions), "Tổng số lượt thi:", String.valueOf(totalAttempts) + " (Đã nộp: " + completedAttempts + ")", metaLabelStyle, metaValueStyle);
            
            String scoreStatsText = String.format("TB: %s | Cao nhất: %s | Thấp nhất: %s",
                    avgScore != null ? String.format("%.2f", avgScore) : "N/A",
                    highestScore != null ? String.format("%.2f", highestScore) : "N/A",
                    lowestScore != null ? String.format("%.2f", lowestScore) : "N/A");

            String filterText = "Tất cả";
            if (statusFilter != null || (searchFilter != null && !searchFilter.isBlank())) {
                List<String> filters = new ArrayList<>();
                if (statusFilter != null) filters.add("Trạng thái: " + statusFilter);
                if (searchFilter != null && !searchFilter.isBlank()) filters.add("Từ khóa: " + searchFilter.trim());
                filterText = String.join(", ", filters);
            }
            createMetadataRow(sheet, 6, "Thống kê điểm số:", scoreStatsText, "Bộ lọc áp dụng:", filterText, metaLabelStyle, metaValueStyle);

            // Table Header Row at Row 8
            int headerRowIndex = 8;
            Row headerRow = sheet.createRow(headerRowIndex);
            headerRow.setHeightInPoints(26);

            String[] headers = new String[]{
                    "STT",
                    "Mã phiên thi",
                    "Họ và tên thí sinh",
                    "Email / Định danh",
                    "Loại thí sinh",
                    "Trạng thái",
                    "Điểm đạt được",
                    "Điểm tối đa",
                    "Tỷ lệ %",
                    "Số câu đã làm",
                    "Thời gian bắt đầu",
                    "Thời gian nộp bài",
                    "Thời gian làm bài",
                    "Số vi phạm",
                    "Bị đình chỉ",
                    "Địa chỉ IP",
                    "Thiết bị / Trình duyệt"
            };

            for (int col = 0; col < headers.length; col++) {
                Cell c = headerRow.createCell(col);
                c.setCellValue(headers[col]);
                c.setCellStyle(headerStyle);
            }

            // Data Rows
            int rowIndex = headerRowIndex + 1;
            int stt = 1;
            for (ExamAttempt attempt : attempts) {
                Row row = sheet.createRow(rowIndex);
                row.setHeightInPoints(21);
                boolean isZebra = (stt % 2 == 0);

                XSSFCellStyle currentLeft = isZebra ? dataZebraLeft : dataLeft;
                XSSFCellStyle currentCenter = isZebra ? dataZebraCenter : dataCenter;
                XSSFCellStyle currentRight = isZebra ? dataZebraRight : dataRight;
                XSSFCellStyle currentNumber = isZebra ? dataZebraNumber : dataNumber;

                // 0. STT
                Cell c0 = row.createCell(0);
                c0.setCellValue(stt++);
                c0.setCellStyle(currentCenter);

                // 1. Mã phiên thi
                Cell c1 = row.createCell(1);
                c1.setCellValue(attempt.getId() != null ? attempt.getId().toString() : "");
                c1.setCellStyle(currentCenter);

                // 2. Họ và tên thí sinh
                Cell c2 = row.createCell(2);
                c2.setCellValue(resolveCandidateName(attempt));
                c2.setCellStyle(currentLeft);

                // 3. Email / Định danh
                Cell c3 = row.createCell(3);
                c3.setCellValue(resolveCandidateIdentifier(attempt));
                c3.setCellStyle(currentLeft);

                // 4. Loại thí sinh
                Cell c4 = row.createCell(4);
                c4.setCellValue(attempt.getUser() != null ? "Thành viên" : "Tự do");
                c4.setCellStyle(currentCenter);

                // 5. Trạng thái
                Cell c5 = row.createCell(5);
                c5.setCellValue(formatStatus(attempt.getStatus()));
                c5.setCellStyle(currentCenter);

                // 6. Điểm đạt được
                Cell c6 = row.createCell(6);
                if (attempt.getTotalScore() != null) {
                    c6.setCellValue(attempt.getTotalScore());
                    c6.setCellStyle(currentNumber);
                } else {
                    c6.setCellValue("-");
                    c6.setCellStyle(currentCenter);
                }

                // 7. Điểm tối đa
                Cell c7 = row.createCell(7);
                if (maxScore != null) {
                    c7.setCellValue(maxScore);
                    c7.setCellStyle(currentNumber);
                } else {
                    c7.setCellValue("-");
                    c7.setCellStyle(currentCenter);
                }

                // 8. Tỷ lệ %
                Cell c8 = row.createCell(8);
                if (attempt.getTotalScore() != null && maxScore != null && maxScore > 0) {
                    double pct = (attempt.getTotalScore() / maxScore) * 100.0;
                    c8.setCellValue(String.format("%.1f%%", pct));
                } else {
                    c8.setCellValue("-");
                }
                c8.setCellStyle(currentCenter);

                // 9. Số câu đã làm
                Cell c9 = row.createCell(9);
                long answered = answeredCountMap.getOrDefault(attempt.getId(), 0L);
                c9.setCellValue(answered + " / " + totalQuestions);
                c9.setCellStyle(currentCenter);

                // 10. Thời gian bắt đầu
                Cell c10 = row.createCell(10);
                c10.setCellValue(attempt.getStartTime() != null ? attempt.getStartTime().format(DATE_TIME_FORMATTER) : "-");
                c10.setCellStyle(currentCenter);

                // 11. Thời gian nộp bài
                Cell c11 = row.createCell(11);
                c11.setCellValue(attempt.getSubmitTime() != null ? attempt.getSubmitTime().format(DATE_TIME_FORMATTER) : "-");
                c11.setCellStyle(currentCenter);

                // 12. Thời gian làm bài
                Cell c12 = row.createCell(12);
                c12.setCellValue(formatDuration(attempt.getStartTime(), attempt.getSubmitTime()));
                c12.setCellStyle(currentCenter);

                // 13. Số vi phạm
                Cell c13 = row.createCell(13);
                int violations = attempt.getViolationCount() != null ? attempt.getViolationCount() : 0;
                c13.setCellValue(violations);
                c13.setCellStyle(currentCenter);

                // 14. Bị đình chỉ
                Cell c14 = row.createCell(14);
                boolean isDisqualified = (attempt.getStatus() == AttemptStatus.DISQUALIFIED);
                c14.setCellValue(isDisqualified ? "Có" : "Không");
                c14.setCellStyle(currentCenter);

                // 15. Địa chỉ IP
                Cell c15 = row.createCell(15);
                c15.setCellValue(attempt.getIpAddress() != null ? attempt.getIpAddress() : "-");
                c15.setCellStyle(currentCenter);

                // 16. Thiết bị / Trình duyệt
                Cell c16 = row.createCell(16);
                c16.setCellValue(attempt.getUserAgent() != null ? attempt.getUserAgent() : "-");
                c16.setCellStyle(currentLeft);

                rowIndex++;
            }

            // Adjust column widths with extra padding and bounds
            for (int col = 0; col < headers.length; col++) {
                sheet.autoSizeColumn(col);
                int currentWidth = sheet.getColumnWidth(col);
                int paddedWidth = currentWidth + 1200; // Extra padding
                if (col == 1) {
                    // Attempt ID: fixed reasonable width
                    sheet.setColumnWidth(col, Math.max(paddedWidth, 9500));
                } else if (col == 16) {
                    // User Agent: clamp to avoid oversized columns
                    sheet.setColumnWidth(col, Math.min(Math.max(paddedWidth, 8000), 14000));
                } else {
                    sheet.setColumnWidth(col, Math.max(paddedWidth, 3200));
                }
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (IOException e) {
            log.error("Failed to generate Excel workbook for examId: {}", exam.getId(), e);
            throw new RuntimeException("Error generating Excel report", e);
        }
    }

    private void createMetadataRow(
            Sheet sheet,
            int rowIndex,
            String label1,
            String val1,
            String label2,
            String val2,
            XSSFCellStyle labelStyle,
            XSSFCellStyle valStyle) {

        Row r = sheet.createRow(rowIndex);
        r.setHeightInPoints(20);

        // Col 0: Label 1
        Cell c0 = r.createCell(0);
        c0.setCellValue(label1);
        c0.setCellStyle(labelStyle);

        // Col 1-3: Val 1
        Cell c1 = r.createCell(1);
        c1.setCellValue(val1 != null ? val1 : "");
        c1.setCellStyle(valStyle);
        for (int c = 2; c <= 3; c++) {
            Cell empty = r.createCell(c);
            empty.setCellStyle(valStyle);
        }
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 1, 3));

        // Col 4: Label 2
        Cell c4 = r.createCell(4);
        c4.setCellValue(label2);
        c4.setCellStyle(labelStyle);

        // Col 5-7: Val 2
        Cell c5 = r.createCell(5);
        c5.setCellValue(val2 != null ? val2 : "");
        c5.setCellStyle(valStyle);
        for (int c = 6; c <= 7; c++) {
            Cell empty = r.createCell(c);
            empty.setCellStyle(valStyle);
        }
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 5, 7));
    }

    private XSSFCellStyle createDataStyle(
            XSSFWorkbook wb,
            HorizontalAlignment align,
            byte[] bgRgb,
            byte[] borderRgb,
            DefaultIndexedColorMap colorMap) {

        XSSFCellStyle style = wb.createCellStyle();
        XSSFFont font = wb.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 9);
        style.setFont(font);

        style.setAlignment(align);
        style.setVerticalAlignment(VerticalAlignment.CENTER);

        if (bgRgb != null) {
            style.setFillForegroundColor(new XSSFColor(bgRgb, colorMap));
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }

        setThinBorders(style, new XSSFColor(borderRgb, colorMap));
        return style;
    }

    private void setThinBorders(XSSFCellStyle style, XSSFColor borderColor) {
        style.setBorderTop(BorderStyle.THIN);
        style.setTopBorderColor(borderColor);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(borderColor);
        style.setBorderLeft(BorderStyle.THIN);
        style.setLeftBorderColor(borderColor);
        style.setBorderRight(BorderStyle.THIN);
        style.setRightBorderColor(borderColor);
    }

    private String resolveCandidateName(ExamAttempt ea) {
        if (ea.getUser() != null && ea.getUser().getFullName() != null && !ea.getUser().getFullName().isBlank()) {
            return ea.getUser().getFullName().trim();
        }
        if (ea.getGuestName() != null && !ea.getGuestName().isBlank()) {
            return ea.getGuestName().trim();
        }
        return "Thí sinh ẩn danh";
    }

    private String resolveCandidateIdentifier(ExamAttempt ea) {
        if (ea.getUser() != null && ea.getUser().getEmail() != null && !ea.getUser().getEmail().isBlank()) {
            return ea.getUser().getEmail().trim();
        }
        if (ea.getGuestIdentifier() != null && !ea.getGuestIdentifier().isBlank()) {
            return ea.getGuestIdentifier().trim();
        }
        return "-";
    }

    private String formatStatus(AttemptStatus status) {
        if (status == null) return "-";
        return switch (status) {
            case IN_PROGRESS -> "Đang làm bài";
            case SUBMITTED -> "Đã nộp bài";
            case AWAITING_MANUAL_GRADING -> "Chờ chấm tự luận";
            case DISQUALIFIED -> "Bị đình chỉ";
        };
    }

    private String formatDuration(LocalDateTime start, LocalDateTime submit) {
        if (start == null || submit == null) {
            return "-";
        }
        Duration duration = Duration.between(start, submit);
        if (duration.isNegative()) {
            return "-";
        }
        long totalSeconds = duration.getSeconds();
        long hours = totalSeconds / 3600;
        long minutes = (totalSeconds % 3600) / 60;
        long seconds = totalSeconds % 60;

        if (hours > 0) {
            return String.format("%dh %02dm %02ds", hours, minutes, seconds);
        }
        return String.format("%02dm %02ds", minutes, seconds);
    }

    private byte[] buildSingleAttemptWorkbookBytes(
            ExamAttempt attempt,
            Exam exam,
            List<Question> questions,
            Map<UUID, CandidateAnswer> answerMap) {

        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            String candidateName = resolveCandidateName(attempt);
            Sheet sheet = workbook.createSheet("Chi Tiet Bai Lam");
            sheet.setDisplayGridlines(true);

            // Palette colors
            byte[] primaryIndigo = new byte[]{(byte) 79, (byte) 70, (byte) 229}; // #4F46E5
            byte[] zebraStripe = new byte[]{(byte) 248, (byte) 250, (byte) 252}; // #F8FAFC
            byte[] metaBg = new byte[]{(byte) 241, (byte) 245, (byte) 249}; // #F1F5F9
            byte[] metaLabelBg = new byte[]{(byte) 226, (byte) 232, (byte) 240}; // #E2E8F0
            byte[] borderGray = new byte[]{(byte) 203, (byte) 213, (byte) 225}; // #CBD5E1

            DefaultIndexedColorMap colorMap = new DefaultIndexedColorMap();

            // Fonts & Styles
            XSSFCellStyle titleStyle = workbook.createCellStyle();
            XSSFFont titleFont = workbook.createFont();
            titleFont.setFontName("Segoe UI");
            titleFont.setFontHeightInPoints((short) 15);
            titleFont.setBold(true);
            titleFont.setColor(new XSSFColor(primaryIndigo, colorMap));
            titleStyle.setFont(titleFont);
            titleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFCellStyle subtitleStyle = workbook.createCellStyle();
            XSSFFont subtitleFont = workbook.createFont();
            subtitleFont.setFontName("Segoe UI");
            subtitleFont.setFontHeightInPoints((short) 9);
            subtitleFont.setItalic(true);
            subtitleFont.setColor(IndexedColors.GREY_50_PERCENT.getIndex());
            subtitleStyle.setFont(subtitleFont);
            subtitleStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFCellStyle metaLabelStyle = workbook.createCellStyle();
            XSSFFont metaLabelFont = workbook.createFont();
            metaLabelFont.setFontName("Segoe UI");
            metaLabelFont.setFontHeightInPoints((short) 9);
            metaLabelFont.setBold(true);
            metaLabelStyle.setFont(metaLabelFont);
            metaLabelStyle.setFillForegroundColor(new XSSFColor(metaLabelBg, colorMap));
            metaLabelStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            setThinBorders(metaLabelStyle, new XSSFColor(borderGray, colorMap));

            XSSFCellStyle metaValueStyle = workbook.createCellStyle();
            XSSFFont metaValueFont = workbook.createFont();
            metaValueFont.setFontName("Segoe UI");
            metaValueFont.setFontHeightInPoints((short) 9);
            metaValueStyle.setFont(metaValueFont);
            metaValueStyle.setFillForegroundColor(new XSSFColor(metaBg, colorMap));
            metaValueStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            setThinBorders(metaValueStyle, new XSSFColor(borderGray, colorMap));

            XSSFCellStyle sectionStyle = workbook.createCellStyle();
            XSSFFont sectionFont = workbook.createFont();
            sectionFont.setFontName("Segoe UI");
            sectionFont.setFontHeightInPoints((short) 11);
            sectionFont.setBold(true);
            sectionFont.setColor(new XSSFColor(primaryIndigo, colorMap));
            sectionStyle.setFont(sectionFont);
            sectionStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            XSSFCellStyle headerStyle = workbook.createCellStyle();
            XSSFFont headerFont = workbook.createFont();
            headerFont.setFontName("Segoe UI");
            headerFont.setFontHeightInPoints((short) 10);
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(new XSSFColor(primaryIndigo, colorMap));
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            setThinBorders(headerStyle, new XSSFColor(new byte[]{(byte) 55, (byte) 48, (byte) 163}, colorMap));

            DataFormat dataFormat = workbook.createDataFormat();

            XSSFCellStyle dataLeftWrap = createDataStyleWithWrap(workbook, HorizontalAlignment.LEFT, null, borderGray, colorMap, true);
            XSSFCellStyle dataCenter = createDataStyleWithWrap(workbook, HorizontalAlignment.CENTER, null, borderGray, colorMap, false);
            XSSFCellStyle dataNumber = createDataStyleWithWrap(workbook, HorizontalAlignment.RIGHT, null, borderGray, colorMap, false);
            dataNumber.setDataFormat(dataFormat.getFormat("#,##0.00"));

            XSSFCellStyle dataZebraLeftWrap = createDataStyleWithWrap(workbook, HorizontalAlignment.LEFT, zebraStripe, borderGray, colorMap, true);
            XSSFCellStyle dataZebraCenter = createDataStyleWithWrap(workbook, HorizontalAlignment.CENTER, zebraStripe, borderGray, colorMap, false);
            XSSFCellStyle dataZebraNumber = createDataStyleWithWrap(workbook, HorizontalAlignment.RIGHT, zebraStripe, borderGray, colorMap, false);
            dataZebraNumber.setDataFormat(dataFormat.getFormat("#,##0.00"));

            XSSFCellStyle summaryLabelStyle = workbook.createCellStyle();
            XSSFFont summaryFont = workbook.createFont();
            summaryFont.setFontName("Segoe UI");
            summaryFont.setFontHeightInPoints((short) 10);
            summaryFont.setBold(true);
            summaryLabelStyle.setFont(summaryFont);
            summaryLabelStyle.setAlignment(HorizontalAlignment.RIGHT);
            summaryLabelStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            summaryLabelStyle.setFillForegroundColor(new XSSFColor(metaLabelBg, colorMap));
            summaryLabelStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            setThinBorders(summaryLabelStyle, new XSSFColor(borderGray, colorMap));

            XSSFCellStyle summaryNumberStyle = workbook.createCellStyle();
            summaryNumberStyle.setFont(summaryFont);
            summaryNumberStyle.setAlignment(HorizontalAlignment.RIGHT);
            summaryNumberStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            summaryNumberStyle.setFillForegroundColor(new XSSFColor(metaLabelBg, colorMap));
            summaryNumberStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            summaryNumberStyle.setDataFormat(dataFormat.getFormat("#,##0.00"));
            setThinBorders(summaryNumberStyle, new XSSFColor(borderGray, colorMap));

            XSSFCellStyle summaryCenterStyle = workbook.createCellStyle();
            summaryCenterStyle.setFont(summaryFont);
            summaryCenterStyle.setAlignment(HorizontalAlignment.CENTER);
            summaryCenterStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            summaryCenterStyle.setFillForegroundColor(new XSSFColor(metaLabelBg, colorMap));
            summaryCenterStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            setThinBorders(summaryCenterStyle, new XSSFColor(borderGray, colorMap));

            // Row 0: Title Banner
            Row r0 = sheet.createRow(0);
            r0.setHeightInPoints(26);
            Cell cTitle = r0.createCell(0);
            cTitle.setCellValue("KẾT QUẢ BÀI THI CHI TIẾT CỦA THÍ SINH");
            cTitle.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 9));

            // Row 1: Subtitle
            Row r1 = sheet.createRow(1);
            r1.setHeightInPoints(18);
            Cell cSub = r1.createCell(0);
            cSub.setCellValue("Hệ thống QuickTest - Xuất lúc: " + LocalDateTime.now().format(DATE_TIME_FORMATTER));
            cSub.setCellStyle(subtitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 9));

            // Totals
            double totalExamPoints = 0.0;
            for (Question q : questions) {
                if (q.getPoints() != null) totalExamPoints += q.getPoints();
            }
            int totalQuestionsCount = questions.size();
            int answeredCount = 0;
            for (Question q : questions) {
                if (answerMap.containsKey(q.getId())) answeredCount++;
            }

            String violationsText = (attempt.getViolationCount() != null ? attempt.getViolationCount() : 0) + " lần"
                    + (attempt.getStatus() == AttemptStatus.DISQUALIFIED ? " (Bị đình chỉ thi)" : " (Bình thường)");

            String totalScoreSummary = (attempt.getTotalScore() != null
                    ? String.format("%.2f", attempt.getTotalScore()) : "Chờ chấm")
                    + " / " + String.format("%.2f", totalExamPoints) + " đ";

            if (totalExamPoints > 0 && attempt.getTotalScore() != null) {
                double pct = (attempt.getTotalScore() / totalExamPoints) * 100.0;
                totalScoreSummary += String.format(" (%.1f%%)", pct);
            }

            // Metadata rows (Rows 3 - 7)
            createMetadataRowWide(sheet, 3, "Họ tên thí sinh:", candidateName, "Tên bài thi:", exam.getTitle(), metaLabelStyle, metaValueStyle);
            createMetadataRowWide(sheet, 4, "Email / Định danh:", resolveCandidateIdentifier(attempt), "Mã phòng thi:", exam.getAccessCode() != null ? exam.getAccessCode() : "N/A", metaLabelStyle, metaValueStyle);
            createMetadataRowWide(sheet, 5, "Loại thí sinh:", (attempt.getUser() != null ? "Thành viên hệ thống" : "Thí sinh tự do (Guest)"), "Trạng thái bài thi:", formatStatus(attempt.getStatus()), metaLabelStyle, metaValueStyle);
            createMetadataRowWide(sheet, 6, "Thời gian làm bài:", formatDuration(attempt.getStartTime(), attempt.getSubmitTime()), "Ghi nhận vi phạm:", violationsText, metaLabelStyle, metaValueStyle);
            createMetadataRowWide(sheet, 7, "Kết quả đạt được:", totalScoreSummary, "Số câu đã làm:", answeredCount + " / " + totalQuestionsCount + " câu", metaLabelStyle, metaValueStyle);

            // Row 9: Table title
            Row r9 = sheet.createRow(9);
            r9.setHeightInPoints(22);
            Cell cSection = r9.createCell(0);
            cSection.setCellValue("BẢNG ĐIỂM CHI TIẾT TỪNG CÂU HỎI & NHẬN XÉT CỦA GIÁO VIÊN");
            cSection.setCellStyle(sectionStyle);
            sheet.addMergedRegion(new CellRangeAddress(9, 9, 0, 9));

            // Row 10: Table Header
            int headerRowIndex = 10;
            Row headerRow = sheet.createRow(headerRowIndex);
            headerRow.setHeightInPoints(26);

            String[] headers = new String[]{
                    "STT",
                    "Loại câu hỏi",
                    "Nội dung câu hỏi",
                    "Câu trả lời của thí sinh",
                    "Đáp án đúng / Chuẩn",
                    "Điểm tối đa",
                    "Điểm đạt được",
                    "Tỷ lệ %",
                    "Trạng thái chấm",
                    "Nhận xét của giáo viên (Feedback)"
            };

            for (int col = 0; col < headers.length; col++) {
                Cell c = headerRow.createCell(col);
                c.setCellValue(headers[col]);
                c.setCellStyle(headerStyle);
            }

            // Data rows
            int rowIndex = headerRowIndex + 1;
            int qIndex = 1;
            double sumMaxScore = 0.0;
            double sumAwardedScore = 0.0;

            for (Question q : questions) {
                Row row = sheet.createRow(rowIndex);
                boolean isZebra = (qIndex % 2 == 0);

                XSSFCellStyle currentLeft = isZebra ? dataZebraLeftWrap : dataLeftWrap;
                XSSFCellStyle currentCenter = isZebra ? dataZebraCenter : dataCenter;
                XSSFCellStyle currentNumber = isZebra ? dataZebraNumber : dataNumber;

                CandidateAnswer ca = answerMap.get(q.getId());
                double qMaxScore = q.getPoints() != null ? q.getPoints() : 0.0;
                sumMaxScore += qMaxScore;

                // 0. STT
                Cell c0 = row.createCell(0);
                c0.setCellValue(qIndex++);
                c0.setCellStyle(currentCenter);

                // 1. Loại câu hỏi
                Cell c1 = row.createCell(1);
                c1.setCellValue(formatQuestionType(q.getQuestionType()));
                c1.setCellStyle(currentCenter);

                // 2. Nội dung câu hỏi
                Cell c2 = row.createCell(2);
                c2.setCellValue(q.getContent() != null ? q.getContent() : "");
                c2.setCellStyle(currentLeft);

                // 3. Câu trả lời của thí sinh
                Cell c3 = row.createCell(3);
                c3.setCellValue(formatCandidateAnswer(q, ca));
                c3.setCellStyle(currentLeft);

                // 4. Đáp án đúng / Chuẩn
                Cell c4 = row.createCell(4);
                c4.setCellValue(formatCorrectAnswer(q));
                c4.setCellStyle(currentLeft);

                // 5. Điểm tối đa
                Cell c5 = row.createCell(5);
                c5.setCellValue(qMaxScore);
                c5.setCellStyle(currentNumber);

                // 6. Điểm đạt được
                Cell c6 = row.createCell(6);
                if (ca != null && ca.getAwardedScore() != null) {
                    double awarded = ca.getAwardedScore();
                    sumAwardedScore += awarded;
                    c6.setCellValue(awarded);
                    c6.setCellStyle(currentNumber);
                } else if (ca != null && ca.getGradingStatus() == GradingStatus.PENDING_MANUAL) {
                    c6.setCellValue("Chờ chấm");
                    c6.setCellStyle(currentCenter);
                } else {
                    c6.setCellValue(0.0);
                    c6.setCellStyle(currentNumber);
                }

                // 7. Tỷ lệ %
                Cell c7 = row.createCell(7);
                if (ca != null && ca.getAwardedScore() != null && qMaxScore > 0) {
                    double pct = (ca.getAwardedScore() / qMaxScore) * 100.0;
                    c7.setCellValue(String.format("%.1f%%", pct));
                } else if (ca != null && ca.getGradingStatus() == GradingStatus.PENDING_MANUAL) {
                    c7.setCellValue("-");
                } else {
                    c7.setCellValue("0.0%");
                }
                c7.setCellStyle(currentCenter);

                // 8. Trạng thái chấm
                Cell c8 = row.createCell(8);
                c8.setCellValue(ca != null ? formatGradingStatus(ca.getGradingStatus()) : "Chưa làm bài");
                c8.setCellStyle(currentCenter);

                // 9. Nhận xét của giáo viên
                Cell c9 = row.createCell(9);
                c9.setCellValue(formatTeacherFeedback(ca));
                c9.setCellStyle(currentLeft);

                rowIndex++;
            }

            // Summary Row
            Row summaryRow = sheet.createRow(rowIndex);
            summaryRow.setHeightInPoints(24);

            Cell sumLabel = summaryRow.createCell(0);
            sumLabel.setCellValue("TỔNG CỘNG ĐIỂM BÀI THI:");
            sumLabel.setCellStyle(summaryLabelStyle);
            for (int c = 1; c <= 4; c++) {
                Cell empty = summaryRow.createCell(c);
                empty.setCellStyle(summaryLabelStyle);
            }
            sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 0, 4));

            Cell sumMax = summaryRow.createCell(5);
            sumMax.setCellValue(sumMaxScore);
            sumMax.setCellStyle(summaryNumberStyle);

            Cell sumAwarded = summaryRow.createCell(6);
            if (attempt.getTotalScore() != null) {
                sumAwarded.setCellValue(attempt.getTotalScore());
            } else {
                sumAwarded.setCellValue(sumAwardedScore);
            }
            sumAwarded.setCellStyle(summaryNumberStyle);

            Cell sumPct = summaryRow.createCell(7);
            double finalScore = attempt.getTotalScore() != null ? attempt.getTotalScore() : sumAwardedScore;
            if (sumMaxScore > 0) {
                sumPct.setCellValue(String.format("%.1f%%", (finalScore / sumMaxScore) * 100.0));
            } else {
                sumPct.setCellValue("-");
            }
            sumPct.setCellStyle(summaryCenterStyle);

            Cell sumStatus = summaryRow.createCell(8);
            sumStatus.setCellValue(formatStatus(attempt.getStatus()));
            sumStatus.setCellStyle(summaryCenterStyle);

            Cell sumEmpty = summaryRow.createCell(9);
            sumEmpty.setCellValue("");
            sumEmpty.setCellStyle(summaryLabelStyle);

            // Column Widths
            sheet.setColumnWidth(0, 2000);  // STT
            sheet.setColumnWidth(1, 6200);  // Loại câu hỏi
            sheet.setColumnWidth(2, 13000); // Nội dung câu hỏi
            sheet.setColumnWidth(3, 11000); // Câu trả lời thí sinh
            sheet.setColumnWidth(4, 11000); // Đáp án đúng
            sheet.setColumnWidth(5, 3400);  // Điểm tối đa
            sheet.setColumnWidth(6, 3600);  // Điểm đạt được
            sheet.setColumnWidth(7, 3200);  // Tỷ lệ %
            sheet.setColumnWidth(8, 5200);  // Trạng thái chấm
            sheet.setColumnWidth(9, 13000); // Nhận xét giáo viên

            workbook.write(out);
            return out.toByteArray();

        } catch (IOException e) {
            log.error("Failed to generate Single Attempt Excel workbook for attemptId: {}", attempt.getId(), e);
            throw new RuntimeException("Error generating Single Attempt Excel report", e);
        }
    }

    private void createMetadataRowWide(
            Sheet sheet,
            int rowIndex,
            String label1,
            String val1,
            String label2,
            String val2,
            XSSFCellStyle labelStyle,
            XSSFCellStyle valStyle) {

        Row r = sheet.createRow(rowIndex);
        r.setHeightInPoints(20);

        // Col 0-1: Label 1
        Cell c0 = r.createCell(0);
        c0.setCellValue(label1);
        c0.setCellStyle(labelStyle);
        Cell c1 = r.createCell(1);
        c1.setCellStyle(labelStyle);
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 0, 1));

        // Col 2-4: Val 1
        Cell c2 = r.createCell(2);
        c2.setCellValue(val1 != null ? val1 : "");
        c2.setCellStyle(valStyle);
        for (int c = 3; c <= 4; c++) {
            Cell empty = r.createCell(c);
            empty.setCellStyle(valStyle);
        }
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 2, 4));

        // Col 5-6: Label 2
        Cell c5 = r.createCell(5);
        c5.setCellValue(label2);
        c5.setCellStyle(labelStyle);
        Cell c6 = r.createCell(6);
        c6.setCellStyle(labelStyle);
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 5, 6));

        // Col 7-9: Val 2
        Cell c7 = r.createCell(7);
        c7.setCellValue(val2 != null ? val2 : "");
        c7.setCellStyle(valStyle);
        for (int c = 8; c <= 9; c++) {
            Cell empty = r.createCell(c);
            empty.setCellStyle(valStyle);
        }
        sheet.addMergedRegion(new CellRangeAddress(rowIndex, rowIndex, 7, 9));
    }

    private XSSFCellStyle createDataStyleWithWrap(
            XSSFWorkbook wb,
            HorizontalAlignment align,
            byte[] bgRgb,
            byte[] borderRgb,
            DefaultIndexedColorMap colorMap,
            boolean wrapText) {

        XSSFCellStyle style = wb.createCellStyle();
        XSSFFont font = wb.createFont();
        font.setFontName("Segoe UI");
        font.setFontHeightInPoints((short) 9);
        style.setFont(font);

        style.setAlignment(align);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setWrapText(wrapText);

        if (bgRgb != null) {
            style.setFillForegroundColor(new XSSFColor(bgRgb, colorMap));
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }

        setThinBorders(style, new XSSFColor(borderRgb, colorMap));
        return style;
    }

    private String formatCandidateAnswer(Question q, CandidateAnswer ca) {
        if (ca == null) {
            return "(Chưa trả lời)";
        }
        QuestionType type = q.getQuestionType();
        if (type == QuestionType.SINGLE_CHOICE || type == QuestionType.MULTIPLE_CHOICE) {
            if (ca.getSelectedOptions() == null || ca.getSelectedOptions().isEmpty()) {
                return "(Chưa chọn đáp án)";
            }
            List<AnswerOption> sorted = new ArrayList<>(ca.getSelectedOptions());
            sorted.sort(Comparator.comparingInt(AnswerOption::getOrderIndex));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < sorted.size(); i++) {
                AnswerOption opt = sorted.get(i);
                if (i > 0) sb.append(", ");
                sb.append(formatOptionLabel(opt.getOrderIndex())).append(". ").append(opt.getContent() != null ? opt.getContent() : "");
            }
            return sb.toString();
        } else {
            return (ca.getTextAnswer() != null && !ca.getTextAnswer().isBlank())
                    ? ca.getTextAnswer().trim()
                    : "(Chưa trả lời)";
        }
    }

    private String formatCorrectAnswer(Question q) {
        QuestionType type = q.getQuestionType();
        if (type == QuestionType.SINGLE_CHOICE || type == QuestionType.MULTIPLE_CHOICE) {
            if (q.getOptions() == null || q.getOptions().isEmpty()) {
                return "-";
            }
            List<AnswerOption> correctOptions = q.getOptions().stream()
                    .filter(opt -> Boolean.TRUE.equals(opt.getIsCorrect()))
                    .sorted(Comparator.comparingInt(AnswerOption::getOrderIndex))
                    .toList();
            if (correctOptions.isEmpty()) {
                return "-";
            }
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < correctOptions.size(); i++) {
                AnswerOption opt = correctOptions.get(i);
                if (i > 0) sb.append(", ");
                sb.append(formatOptionLabel(opt.getOrderIndex())).append(". ").append(opt.getContent() != null ? opt.getContent() : "");
            }
            return sb.toString();
        } else if (type == QuestionType.NUMERIC) {
            if (q.getSampleAnswer() != null && !q.getSampleAnswer().isBlank()) {
                String ans = q.getSampleAnswer().trim();
                if (q.getNumericTolerance() != null && q.getNumericTolerance() > 0) {
                    ans += " (± " + q.getNumericTolerance() + ")";
                }
                return ans;
            }
            return "-";
        } else {
            // ESSAY_TEXT
            if (q.getSampleAnswer() != null && !q.getSampleAnswer().isBlank()) {
                return q.getSampleAnswer().trim();
            }
            if (q.getGradingRubric() != null && !q.getGradingRubric().isBlank()) {
                return "Tiêu chí: " + q.getGradingRubric().trim();
            }
            return "-";
        }
    }

    private String formatOptionLabel(int orderIndex) {
        if (orderIndex >= 0 && orderIndex < 26) {
            return String.valueOf((char) ('A' + orderIndex));
        }
        return String.valueOf(orderIndex + 1);
    }

    private String formatQuestionType(QuestionType type) {
        if (type == null) return "-";
        return switch (type) {
            case SINGLE_CHOICE -> "Trắc nghiệm (1 đáp án)";
            case MULTIPLE_CHOICE -> "Trắc nghiệm (Nhiều đáp án)";
            case NUMERIC -> "Điền số";
            case ESSAY_TEXT -> "Tự luận";
        };
    }

    private String formatGradingStatus(GradingStatus status) {
        if (status == null) return "Chưa làm bài";
        return switch (status) {
            case AUTO_GRADED -> "Tự động chấm";
            case GRADED -> "Giáo viên đã chấm";
            case PENDING_MANUAL -> "Chờ chấm tự luận";
            case PENDING_AI -> "Đang chờ AI chấm";
        };
    }

    private String formatTeacherFeedback(CandidateAnswer ca) {
        if (ca == null) return "-";
        boolean hasTeacherFeedback = ca.getTeacherFeedback() != null && !ca.getTeacherFeedback().isBlank();
        boolean hasAiExplanation = ca.getAiGradingExplanation() != null && !ca.getAiGradingExplanation().isBlank();

        if (hasTeacherFeedback && hasAiExplanation) {
            return ca.getTeacherFeedback().trim() + "\n(AI): " + ca.getAiGradingExplanation().trim();
        } else if (hasTeacherFeedback) {
            return ca.getTeacherFeedback().trim();
        } else if (hasAiExplanation) {
            return "(AI): " + ca.getAiGradingExplanation().trim();
        }
        return "-";
    }
}
