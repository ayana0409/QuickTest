package com.quicktest.modules.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.quicktest.core.security.UserDetailsImpl;
import com.quicktest.modules.admin.controller.AdminQuestionModerationController;
import com.quicktest.modules.admin.dto.AdminModerationStatsResponse;
import com.quicktest.modules.admin.dto.AdminQuestionModerationResponse;
import com.quicktest.modules.admin.dto.AdminSafetyFlagRequest;
import com.quicktest.modules.admin.service.AdminQuestionModerationService;
import com.quicktest.modules.assessment.entity.QuestionType;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.data.domain.Page;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for AdminQuestionModerationController REST endpoints.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AdminQuestionModerationControllerTest {

        @Mock
        private AdminQuestionModerationService moderationService;

        @Mock
        private UserRepository userRepository;

        @InjectMocks
        private AdminQuestionModerationController controller;

        private MockMvc mockMvc;
        private ObjectMapper objectMapper;
        private User admin;
        private UserDetailsImpl currentUser;

        @BeforeEach
        void setUp() {
                objectMapper = new ObjectMapper();
                objectMapper.registerModule(new JavaTimeModule());

                UUID adminId = UUID.randomUUID();
                admin = User.builder()
                                .id(adminId)
                                .username("admin")
                                .fullName("System Admin")
                                .email("admin@quicktest.com")
                                .role(Role.ADMIN)
                                .build();

                currentUser = UserDetailsImpl.build(admin);

                HandlerMethodArgumentResolver authPrincipalResolver = new HandlerMethodArgumentResolver() {
                        @Override
                        public boolean supportsParameter(MethodParameter parameter) {
                                return parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
                        }

                        @Override
                        public Object resolveArgument(MethodParameter parameter,
                                        ModelAndViewContainer mavContainer,
                                        NativeWebRequest webRequest,
                                        WebDataBinderFactory binderFactory) {
                                return currentUser;
                        }
                };

                mockMvc = MockMvcBuilders.standaloneSetup(controller)
                                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver(),
                                                authPrincipalResolver)
                                .build();
        }

        @Test
        @DisplayName("GET /api/admin/moderation/questions: returns paginated list of moderation items")
        void getModerationQuestions_Success() throws Exception {
                UUID qId = UUID.randomUUID();
                AdminQuestionModerationResponse item = AdminQuestionModerationResponse.builder()
                                .id(qId)
                                .content("Sample question content")
                                .questionType(QuestionType.SINGLE_CHOICE)
                                .isSafe(false)
                                .hasImage(true)
                                .build();

                Page<AdminQuestionModerationResponse> page = new PageImpl<>(List.of(item), PageRequest.of(0, 10), 1);
                when(moderationService.getModerationQuestions(eq(false), eq(true), eq(QuestionType.SINGLE_CHOICE),
                                eq("sample"), any()))
                                .thenReturn(page);

                mockMvc.perform(get("/api/admin/moderation/questions")
                                .param("isSafe", "false")
                                .param("hasImage", "true")
                                .param("questionType", "SINGLE_CHOICE")
                                .param("search", "sample"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value(200))
                                .andExpect(jsonPath("$.data.content[0].id").value(qId.toString()))
                                .andExpect(jsonPath("$.data.content[0].isSafe").value(false))
                                .andExpect(jsonPath("$.data.content[0].hasImage").value(true));
        }

        @Test
        @DisplayName("GET /api/admin/moderation/stats: returns dashboard KPI metrics")
        void getModerationStats_Success() throws Exception {
                AdminModerationStatsResponse stats = AdminModerationStatsResponse.builder()
                                .totalQuestions(150)
                                .questionsWithImages(40)
                                .safeQuestions(110)
                                .unreviewedQuestions(40)
                                .build();

                when(moderationService.getModerationStats()).thenReturn(stats);

                mockMvc.perform(get("/api/admin/moderation/stats"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value(200))
                                .andExpect(jsonPath("$.data.totalQuestions").value(150))
                                .andExpect(jsonPath("$.data.questionsWithImages").value(40))
                                .andExpect(jsonPath("$.data.safeQuestions").value(110))
                                .andExpect(jsonPath("$.data.unreviewedQuestions").value(40));
        }

        @Test
        @DisplayName("PATCH /api/admin/moderation/questions/{id}/safety: mark question as safe")
        void updateSafetyFlag_Success() throws Exception {
                UUID qId = UUID.randomUUID();
                when(userRepository.findById(currentUser.getId())).thenReturn(Optional.of(admin));

                AdminQuestionModerationResponse updated = AdminQuestionModerationResponse.builder()
                                .id(qId)
                                .isSafe(true)
                                .reviewedByName("System Admin")
                                .build();

                when(moderationService.updateSafetyFlag(eq(qId), eq(true), eq(admin))).thenReturn(updated);

                AdminSafetyFlagRequest request = new AdminSafetyFlagRequest(true);

                mockMvc.perform(patch("/api/admin/moderation/questions/{id}/safety", qId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value(200))
                                .andExpect(jsonPath("$.data.isSafe").value(true))
                                .andExpect(jsonPath("$.message").value("Question marked as safe successfully"));
        }

        @Test
        @DisplayName("DELETE /api/admin/moderation/questions/{id}: successfully deletes question")
        void deleteQuestion_Success() throws Exception {
                UUID qId = UUID.randomUUID();
                when(userRepository.findById(currentUser.getId())).thenReturn(Optional.of(admin));
                doNothing().when(moderationService).deleteQuestionByAdmin(eq(qId), eq(admin));

                mockMvc.perform(delete("/api/admin/moderation/questions/{id}", qId))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.status").value(200))
                                .andExpect(jsonPath("$.message")
                                                .value("Question deleted successfully by administrator"));

                verify(moderationService).deleteQuestionByAdmin(eq(qId), eq(admin));
        }
}
