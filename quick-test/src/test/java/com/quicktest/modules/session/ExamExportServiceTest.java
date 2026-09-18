package com.quicktest.modules.session;

import com.quicktest.core.exception.ResourceNotFoundException;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.Question;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.entity.ExamAttempt;
import com.quicktest.modules.session.repository.CandidateAnswerRepository;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import com.quicktest.modules.session.service.ExamExportServiceImpl;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ExamExportServiceImpl.
 * Verifies ownership validation, Excel generation structure, metadata block, and data rows.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ExamExportServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private CandidateAnswerRepository candidateAnswerRepository;

    @InjectMocks
    private ExamExportServiceImpl examExportService;

    private User teacher;
    private User otherTeacher;
    private Exam exam;
    private UUID examId;

    @BeforeEach
    void setUp() {
        examId = UUID.randomUUID();

        teacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Teacher Master")
                .email("teacher@quicktest.com")
                .build();

        otherTeacher = User.builder()
                .id(UUID.randomUUID())
                .fullName("Intruder Teacher")
                .email("intruder@quicktest.com")
                .build();

        Question q1 = Question.builder()
                .id(UUID.randomUUID())
                .orderIndex(1)
                .points(5.0)
                .questionType(QuestionType.SINGLE_CHOICE)
                .content("Question 1")
                .build();

        Question q2 = Question.builder()
                .id(UUID.randomUUID())
                .orderIndex(2)
                .points(5.0)
                .questionType(QuestionType.ESSAY_TEXT)
                .content("Question 2")
                .build();

        exam = Exam.builder()
                .id(examId)
                .title("Kiểm tra giữa kỳ Java & Spring")
                .accessCode("JAVA2026")
                .durationMinutes(45)
                .createdBy(teacher)
                .questions(List.of(q1, q2))
                .build();
    }

    @Test
    @DisplayName("Export Excel successfully generates valid .xlsx with metadata and attempt records")
    void exportExamAttemptsToExcel_Success() throws IOException {
        // Arrange
        ExamAttempt attempt1 = ExamAttempt.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .user(User.builder().id(UUID.randomUUID()).fullName("Nguyen Van A").email("nva@student.edu.vn").build())
                .startTime(LocalDateTime.now().minusMinutes(30))
                .submitTime(LocalDateTime.now().minusMinutes(5))
                .status(AttemptStatus.SUBMITTED)
                .totalScore(8.5)
                .violationCount(0)
                .ipAddress("192.168.1.10")
                .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                .build();

        ExamAttempt attempt2 = ExamAttempt.builder()
                .id(UUID.randomUUID())
                .exam(exam)
                .guestName("Le Thi B")
                .guestIdentifier("GUEST_002")
                .startTime(LocalDateTime.now().minusMinutes(40))
                .submitTime(LocalDateTime.now().minusMinutes(10))
                .status(AttemptStatus.DISQUALIFIED)
                .totalScore(3.0)
                .violationCount(5)
                .ipAddress("192.168.1.15")
                .userAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
                .build();

        List<ExamAttempt> attempts = List.of(attempt1, attempt2);

        when(examRepository.findById(examId)).thenReturn(Optional.of(exam));
        when(examAttemptRepository.findAttemptsForExport(eq(examId), isNull(), isNull(), any(Sort.class)))
                .thenReturn(attempts);

        // Mock answered counts: attempt1 answered 2, attempt2 answered 1
        List<Object[]> answeredRows = List.of(
                new Object[]{attempt1.getId(), 2L},
                new Object[]{attempt2.getId(), 1L}
        );
        when(candidateAnswerRepository.countAnsweredQuestionsByExamId(examId)).thenReturn(answeredRows);

        // Mock computeAttemptStats: [total, submitted, pending, in_progress, disqualified, avg, max, min, ...]
        Object[] statsRow = new Object[]{
                2L, 1L, 0L, 0L, 1L, 5.75, 8.5, 3.0, 2L, 5L, 5, 1L, 1500.0, 1800L, 1200L
        };
        when(examAttemptRepository.computeAttemptStats(examId)).thenReturn(statsRow);

        // Act
        byte[] excelBytes = examExportService.exportExamAttemptsToExcel(examId, null, null, teacher);

        // Assert
        assertNotNull(excelBytes);
        assertTrue(excelBytes.length > 0);

        // Verify valid Excel structure by opening with POI
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(excelBytes))) {
            Sheet sheet = workbook.getSheet("Danh Sách Phiên Thi");
            assertNotNull(sheet, "Worksheet 'Danh Sách Phiên Thi' must exist");

            // Row 0: Title
            Row titleRow = sheet.getRow(0);
            assertNotNull(titleRow);
            assertEquals("BÁO CÁO DANH SÁCH PHIÊN THI & KẾT QUẢ", titleRow.getCell(0).getStringCellValue());

            // Row 8: Table Header
            Row headerRow = sheet.getRow(8);
            assertNotNull(headerRow);
            assertEquals("STT", headerRow.getCell(0).getStringCellValue());
            assertEquals("Mã phiên thi", headerRow.getCell(1).getStringCellValue());
            assertEquals("Họ và tên thí sinh", headerRow.getCell(2).getStringCellValue());
            assertEquals("Email / Định danh", headerRow.getCell(3).getStringCellValue());
            assertEquals("Loại thí sinh", headerRow.getCell(4).getStringCellValue());
            assertEquals("Trạng thái", headerRow.getCell(5).getStringCellValue());
            assertEquals("Điểm đạt được", headerRow.getCell(6).getStringCellValue());

            // Row 9: First attempt
            Row row1 = sheet.getRow(9);
            assertNotNull(row1);
            assertEquals(1, (int) row1.getCell(0).getNumericCellValue());
            assertEquals("Nguyen Van A", row1.getCell(2).getStringCellValue());
            assertEquals("nva@student.edu.vn", row1.getCell(3).getStringCellValue());
            assertEquals("Thành viên", row1.getCell(4).getStringCellValue());
            assertEquals("Đã nộp bài", row1.getCell(5).getStringCellValue());
            assertEquals(8.5, row1.getCell(6).getNumericCellValue(), 0.01);
            assertEquals(10.0, row1.getCell(7).getNumericCellValue(), 0.01);
            assertEquals("Không", row1.getCell(14).getStringCellValue()); // Not disqualified

            // Row 10: Second attempt
            Row row2 = sheet.getRow(10);
            assertNotNull(row2);
            assertEquals(2, (int) row2.getCell(0).getNumericCellValue());
            assertEquals("Le Thi B", row2.getCell(2).getStringCellValue());
            assertEquals("GUEST_002", row2.getCell(3).getStringCellValue());
            assertEquals("Tự do", row2.getCell(4).getStringCellValue());
            assertEquals("Bị đình chỉ", row2.getCell(5).getStringCellValue());
            assertEquals(3.0, row2.getCell(6).getNumericCellValue(), 0.01);
            assertEquals("Có", row2.getCell(14).getStringCellValue()); // Disqualified
        }
    }

    @Test
    @DisplayName("Export Excel throws AccessDeniedException when teacher is not the exam creator")
    void exportExamAttemptsToExcel_ThrowsAccessDenied_WhenNotExamOwner() {
        when(examRepository.findById(examId)).thenReturn(Optional.of(exam));

        assertThrows(AccessDeniedException.class, () ->
                examExportService.exportExamAttemptsToExcel(examId, null, null, otherTeacher)
        );

        verify(examAttemptRepository, never()).findAttemptsForExport(any(), any(), any(), any());
    }

    @Test
    @DisplayName("Export Excel throws ResourceNotFoundException when exam does not exist")
    void exportExamAttemptsToExcel_ThrowsResourceNotFound_WhenExamDoesNotExist() {
        UUID nonExistentId = UUID.randomUUID();
        when(examRepository.findById(nonExistentId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                examExportService.exportExamAttemptsToExcel(nonExistentId, null, null, teacher)
        );
    }

    @Test
    @DisplayName("Export Excel applies status and search filters when provided")
    void exportExamAttemptsToExcel_WithFilters() {
        when(examRepository.findById(examId)).thenReturn(Optional.of(exam));
        when(examAttemptRepository.findAttemptsForExport(eq(examId), eq(AttemptStatus.SUBMITTED), eq("%nguyen%"), any(Sort.class)))
                .thenReturn(Collections.emptyList());
        when(candidateAnswerRepository.countAnsweredQuestionsByExamId(examId)).thenReturn(Collections.emptyList());
        when(examAttemptRepository.computeAttemptStats(examId)).thenReturn(new Object[0]);

        byte[] result = examExportService.exportExamAttemptsToExcel(examId, AttemptStatus.SUBMITTED, "nguyen", teacher);

        assertNotNull(result);
        verify(examAttemptRepository).findAttemptsForExport(eq(examId), eq(AttemptStatus.SUBMITTED), eq("%nguyen%"), any(Sort.class));
    }
}
