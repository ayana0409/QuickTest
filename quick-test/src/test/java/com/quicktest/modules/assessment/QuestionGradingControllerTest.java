package com.quicktest.modules.assessment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quicktest.core.common.PageResponse;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.assessment.controller.QuestionGradingController;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.session.dto.*;
import com.quicktest.modules.session.service.QuestionGradingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Controller tests for QuestionGradingController covering question retrieval,
 * candidate submissions, manual grading, batch AI trigger, and single answer AI evaluation.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class QuestionGradingControllerTest {

    @Mock
    private QuestionGradingService questionGradingService;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private QuestionGradingController questionGradingController;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;
    private User teacherEntity;
    private UserDetailsImpl teacherPrincipal;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();

        UUID teacherId = UUID.randomUUID();
        teacherEntity = User.builder()
                .id(teacherId)
                .username("prof_smith")
                .email("smith@quicktest.com")
                .role(Role.TEACHER)
                .isActive(true)
                .build();

        teacherPrincipal = UserDetailsImpl.builder()
                .id(teacherId)
                .username("prof_smith")
                .email("smith@quicktest.com")
                .role(Role.TEACHER)
                .isActive(true)
                .build();

        HandlerMethodArgumentResolver authPrincipalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter parameter) {
                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
            }

            @Override
            public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                          NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
                return teacherPrincipal;
            }
        };

        mockMvc = MockMvcBuilders.standaloneSetup(questionGradingController)
                .setCustomArgumentResolvers(authPrincipalResolver, new PageableHandlerMethodArgumentResolver())
                .build();

        when(userRepository.findById(teacherId)).thenReturn(Optional.of(teacherEntity));
    }

    @Test
    @DisplayName("GET /api/teacher/grading/exams/{examId}/questions: Should return 200 with essay questions summary")
    void getQuestionsForGrading_Success() throws Exception {
        UUID examId = UUID.randomUUID();
        QuestionGradingSummaryResponse summary = QuestionGradingSummaryResponse.builder()
                .questionId(UUID.randomUUID())
                .orderIndex(1)
                .content("Analyze the theme of power in Hamlet.")
                .maxPoints(10.0)
                .pendingCount(2L)
                .gradedCount(5L)
                .totalSubmissions(7L)
                .build();

        when(questionGradingService.getQuestionsForGrading(eq(examId), any(User.class)))
                .thenReturn(List.of(summary));

        mockMvc.perform(get("/api/teacher/grading/exams/" + examId + "/questions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data[0].maxPoints").value(10.0))
                .andExpect(jsonPath("$.data[0].pendingCount").value(2));
    }

    @Test
    @DisplayName("GET /api/teacher/grading/questions/{questionId}/submissions: Should return 200 with rubric and submissions")
    void getQuestionSubmissions_Success() throws Exception {
        UUID questionId = UUID.randomUUID();
        QuestionSubmissionsDetailResponse response = QuestionSubmissionsDetailResponse.builder()
                .questionId(questionId)
                .content("Explain thermodynamics laws.")
                .gradingRubric("Full points for 1st and 2nd laws.")
                .maxPoints(5.0)
                .submissions(PageResponse.from(new PageImpl<>(Collections.emptyList(), PageRequest.of(0, 10), 0)))
                .build();

        when(questionGradingService.getQuestionSubmissions(eq(questionId), any(), any(), any(User.class)))
                .thenReturn(response);

        mockMvc.perform(get("/api/teacher/grading/questions/" + questionId + "/submissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.maxPoints").value(5.0))
                .andExpect(jsonPath("$.data.gradingRubric").value("Full points for 1st and 2nd laws."));
    }

    @Test
    @DisplayName("POST /api/teacher/grading/questions/{questionId}/manual: Should return 200 after saving grades")
    void saveManualGrades_Success() throws Exception {
        UUID questionId = UUID.randomUUID();
        ManualBatchGradeRequest request = ManualBatchGradeRequest.builder()
                .items(List.of(
                        ManualGradeItemRequest.builder()
                                .candidateAnswerId(UUID.randomUUID())
                                .awardedScore(4.5)
                                .teacherFeedback("Well written essay.")
                                .build()
                ))
                .build();

        ManualBatchGradeResponse response = ManualBatchGradeResponse.builder()
                .gradedCount(1)
                .finalizedAttemptsCount(1)
                .message("Manual grades saved successfully")
                .build();

        when(questionGradingService.saveManualGrades(eq(questionId), any(ManualBatchGradeRequest.class), any(User.class)))
                .thenReturn(response);

        mockMvc.perform(post("/api/teacher/grading/questions/" + questionId + "/manual")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.gradedCount").value(1))
                .andExpect(jsonPath("$.data.finalizedAttemptsCount").value(1));
    }

    @Test
    @DisplayName("POST /api/teacher/grading/trigger-ai: Should return 202 Accepted when batch AI job is queued")
    void triggerAiGrading_Success() throws Exception {
        TriggerAiGradingRequest request = TriggerAiGradingRequest.builder()
                .examId(UUID.randomUUID())
                .scope("ENTIRE_EXAM")
                .batchSize(5)
                .build();

        TriggerAiGradingResponse response = TriggerAiGradingResponse.builder()
                .status("ACCEPTED")
                .totalQuestionsScheduled(3)
                .totalSubmissionsScheduled(15)
                .message("AI grading batch job successfully scheduled")
                .build();

        when(questionGradingService.triggerAiGrading(any(TriggerAiGradingRequest.class), any(User.class)))
                .thenReturn(response);

        mockMvc.perform(post("/api/teacher/grading/trigger-ai")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.data.totalSubmissionsScheduled").value(15));
    }

    @Test
    @DisplayName("POST /api/teacher/grading/answers/{candidateAnswerId}/ai: Should return 200 with AI evaluation")
    void gradeSingleAnswerWithAi_Success() throws Exception {
        UUID answerId = UUID.randomUUID();
        AiSingleGradeDto response = AiSingleGradeDto.builder()
                .candidateAnswerId(answerId.toString())
                .awardedScore(4.0)
                .feedback("Strong arguments, minor grammar inaccuracies.")
                .build();

        when(questionGradingService.gradeSingleAnswerWithAi(eq(answerId), any(User.class)))
                .thenReturn(response);

        mockMvc.perform(post("/api/teacher/grading/answers/" + answerId + "/ai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(200))
                .andExpect(jsonPath("$.data.awardedScore").value(4.0))
                .andExpect(jsonPath("$.data.feedback").value("Strong arguments, minor grammar inaccuracies."));
    }
}
