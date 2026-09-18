package com.quicktest.modules.session;

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

    @Mock
    private QuestionRepository questionRepository;

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

    @Test
    @DisplayName("Export single attempt successfully generates .xlsx with question details, scores, and feedback")
    void exportSingleAttemptToExcel_Success() throws IOException {
        UUID attemptId = UUID.randomUUID();

        ExamAttempt attempt = ExamAttempt.builder()
                .id(attemptId)
                .exam(exam)
                .user(User.builder().id(UUID.randomUUID()).fullName("Tran Van C").email("tvc@test.edu.vn").build())
                .startTime(LocalDateTime.now().minusMinutes(40))
                .submitTime(LocalDateTime.now().minusMinutes(5))
                .status(AttemptStatus.SUBMITTED)
                .totalScore(9.0)
                .violationCount(1)
                .ipAddress("10.0.0.1")
                .userAgent("Mozilla/5.0")
                .build();

        AnswerOption optA = AnswerOption.builder().id(UUID.randomUUID()).orderIndex(0).content("Đáp án A").isCorrect(true).build();
        AnswerOption optB = AnswerOption.builder().id(UUID.randomUUID()).orderIndex(1).content("Đáp án B").isCorrect(false).build();

        Question q1 = Question.builder()
                .id(UUID.randomUUID())
                .orderIndex(1)
                .points(5.0)
                .questionType(QuestionType.SINGLE_CHOICE)
                .content("Câu hỏi trắc nghiệm 1?")
                .options(List.of(optA, optB))
                .build();

        Question q2 = Question.builder()
                .id(UUID.randomUUID())
                .orderIndex(2)
                .points(5.0)
                .questionType(QuestionType.ESSAY_TEXT)
                .content("Câu hỏi tự luận 2?")
                .sampleAnswer("Bài mẫu tự luận...")
                .build();

        List<Question> questions = List.of(q1, q2);

        CandidateAnswer ca1 = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(q1)
                .selectedOptions(Set.of(optA))
                .awardedScore(5.0)
                .gradingStatus(GradingStatus.AUTO_GRADED)
                .build();

        CandidateAnswer ca2 = CandidateAnswer.builder()
                .id(UUID.randomUUID())
                .examAttempt(attempt)
                .question(q2)
                .textAnswer("Bài làm của thí sinh về câu 2.")
                .awardedScore(4.0)
                .gradingStatus(GradingStatus.GRADED)
                .teacherFeedback("Làm bài tốt, diễn đạt rõ ràng!")
                .build();

        List<CandidateAnswer> answers = List.of(ca1, ca2);

        when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));
        when(questionRepository.findByExamIdWithOptions(exam.getId())).thenReturn(questions);
        when(candidateAnswerRepository.findByExamAttemptIdWithQuestion(attemptId)).thenReturn(answers);

        // Act
        byte[] excelBytes = examExportService.exportSingleAttemptToExcel(attemptId, teacher);

        // Assert
        assertNotNull(excelBytes);
        assertTrue(excelBytes.length > 0);

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(excelBytes))) {
            Sheet sheet = workbook.getSheet("Chi Tiet Bai Lam");
            assertNotNull(sheet, "Worksheet 'Chi Tiet Bai Lam' must exist");

            // Row 0: Title
            Row titleRow = sheet.getRow(0);
            assertNotNull(titleRow);
            assertEquals("KẾT QUẢ BÀI THI CHI TIẾT CỦA THÍ SINH", titleRow.getCell(0).getStringCellValue());

            // Row 10: Table Header
            Row headerRow = sheet.getRow(10);
            assertNotNull(headerRow);
            assertEquals("STT", headerRow.getCell(0).getStringCellValue());
            assertEquals("Loại câu hỏi", headerRow.getCell(1).getStringCellValue());
            assertEquals("Nội dung câu hỏi", headerRow.getCell(2).getStringCellValue());
            assertEquals("Câu trả lời của thí sinh", headerRow.getCell(3).getStringCellValue());
            assertEquals("Đáp án đúng / Chuẩn", headerRow.getCell(4).getStringCellValue());
            assertEquals("Điểm tối đa", headerRow.getCell(5).getStringCellValue());
            assertEquals("Điểm đạt được", headerRow.getCell(6).getStringCellValue());
            assertEquals("Tỷ lệ %", headerRow.getCell(7).getStringCellValue());
            assertEquals("Trạng thái chấm", headerRow.getCell(8).getStringCellValue());
            assertEquals("Nhận xét của giáo viên (Feedback)", headerRow.getCell(9).getStringCellValue());

            // Row 11: Question 1 (Multiple choice)
            Row rowQ1 = sheet.getRow(11);
            assertNotNull(rowQ1);
            assertEquals(1, (int) rowQ1.getCell(0).getNumericCellValue());
            assertEquals("Trắc nghiệm (1 đáp án)", rowQ1.getCell(1).getStringCellValue());
            assertEquals("Câu hỏi trắc nghiệm 1?", rowQ1.getCell(2).getStringCellValue());
            assertEquals("A. Đáp án A", rowQ1.getCell(3).getStringCellValue());
            assertEquals("A. Đáp án A", rowQ1.getCell(4).getStringCellValue());
            assertEquals(5.0, rowQ1.getCell(5).getNumericCellValue(), 0.01);
            assertEquals(5.0, rowQ1.getCell(6).getNumericCellValue(), 0.01);
            assertEquals("100.0%", rowQ1.getCell(7).getStringCellValue());
            assertEquals("Tự động chấm", rowQ1.getCell(8).getStringCellValue());
            assertEquals("-", rowQ1.getCell(9).getStringCellValue());

            // Row 12: Question 2 (Essay with feedback)
            Row rowQ2 = sheet.getRow(12);
            assertNotNull(rowQ2);
            assertEquals(2, (int) rowQ2.getCell(0).getNumericCellValue());
            assertEquals("Tự luận", rowQ2.getCell(1).getStringCellValue());
            assertEquals("Câu hỏi tự luận 2?", rowQ2.getCell(2).getStringCellValue());
            assertEquals("Bài làm của thí sinh về câu 2.", rowQ2.getCell(3).getStringCellValue());
            assertEquals("Bài mẫu tự luận...", rowQ2.getCell(4).getStringCellValue());
            assertEquals(5.0, rowQ2.getCell(5).getNumericCellValue(), 0.01);
            assertEquals(4.0, rowQ2.getCell(6).getNumericCellValue(), 0.01);
            assertEquals("80.0%", rowQ2.getCell(7).getStringCellValue());
            assertEquals("Giáo viên đã chấm", rowQ2.getCell(8).getStringCellValue());
            assertEquals("Làm bài tốt, diễn đạt rõ ràng!", rowQ2.getCell(9).getStringCellValue());
        }
    }

    @Test
    @DisplayName("Export single attempt throws AccessDeniedException when teacher does not own exam")
    void exportSingleAttemptToExcel_ThrowsAccessDenied_WhenNotExamOwner() {
        UUID attemptId = UUID.randomUUID();
        ExamAttempt attempt = ExamAttempt.builder().id(attemptId).exam(exam).build();
        when(examAttemptRepository.findByIdWithExamAndUser(attemptId)).thenReturn(Optional.of(attempt));

        assertThrows(AccessDeniedException.class, () ->
                examExportService.exportSingleAttemptToExcel(attemptId, otherTeacher)
        );
    }

    @Test
    @DisplayName("Export single attempt throws ResourceNotFoundException when attempt does not exist")
    void exportSingleAttemptToExcel_ThrowsResourceNotFound_WhenAttemptDoesNotExist() {
        UUID nonExistentId = UUID.randomUUID();
        when(examAttemptRepository.findByIdWithExamAndUser(nonExistentId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                examExportService.exportSingleAttemptToExcel(nonExistentId, teacher)
        );
    }
}
