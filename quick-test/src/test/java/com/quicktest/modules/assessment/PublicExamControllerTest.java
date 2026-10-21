package com.quicktest.modules.assessment;

import com.quicktest.modules.assessment.controller.PublicExamController;
import com.quicktest.modules.assessment.dto.PublicExamCardResponse;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.service.ExamService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PublicExamControllerTest {

    @Mock
    private ExamService examService;

    @InjectMocks
    private PublicExamController publicExamController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(publicExamController).build();
    }

    @Test
    @DisplayName("GET /api/public/exams returns 200 with list of public exams")
    void getPublicExams_Success() throws Exception {
        UUID examId = UUID.randomUUID();
        PublicExamCardResponse card = PublicExamCardResponse.builder()
                .id(examId)
                .title("Luyện thi THPT Quốc gia 2026")
                .accessCode("THPT2026")
                .description("Đề thi thử môn Toán chất lượng cao")
                .status(ExamStatus.PUBLISHED)
                .durationMinutes(90)
                .maxAttempts(3)
                .questionCount(50L)
                .totalPoints(10.0)
                .teacherName("Thầy Nguyễn Văn A")
                .examTimeStatus("OPEN")
                .isOpen(true)
                .createdAt(LocalDateTime.now())
                .build();

        when(examService.getRandomPublicExams()).thenReturn(List.of(card));

        mockMvc.perform(get("/api/public/exams"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data[0].id").value(examId.toString()))
                .andExpect(jsonPath("$.data[0].title").value("Luyện thi THPT Quốc gia 2026"))
                .andExpect(jsonPath("$.data[0].accessCode").value("THPT2026"))
                .andExpect(jsonPath("$.data[0].durationMinutes").value(90))
                .andExpect(jsonPath("$.data[0].questionCount").value(50))
                .andExpect(jsonPath("$.data[0].isOpen").value(true));
    }
}
