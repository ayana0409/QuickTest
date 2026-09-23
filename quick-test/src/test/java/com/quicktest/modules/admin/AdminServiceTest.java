package com.quicktest.modules.admin;

import com.quicktest.core.exception.AppException;
import com.quicktest.modules.admin.dto.*;
import com.quicktest.modules.iam.entity.AuthProvider;
import com.quicktest.modules.admin.service.AdminServiceImpl;
import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.assessment.entity.ExamStatus;
import com.quicktest.modules.assessment.repository.ExamRepository;
import com.quicktest.modules.assessment.repository.QuestionRepository;
import com.quicktest.modules.iam.entity.Role;
import com.quicktest.modules.iam.entity.User;
import com.quicktest.modules.iam.repository.UserRepository;
import com.quicktest.modules.proctoring.repository.ViolationLogRepository;
import com.quicktest.modules.session.entity.AttemptStatus;
import com.quicktest.modules.session.repository.ExamAttemptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AdminServiceImpl covering user governance, exam lifecycle
 * control,
 * and dashboard statistics generation.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AdminServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamAttemptRepository examAttemptRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private ViolationLogRepository violationLogRepository;

    @Mock
    private com.quicktest.modules.session.service.ExamSessionService examSessionService;

    @Mock
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @InjectMocks
    private AdminServiceImpl adminService;

    private UUID adminId;
    private UUID targetUserId;
    private User adminUser;
    private User studentUser;
    private Exam sampleExam;

    @BeforeEach
    void setUp() {
        adminId = UUID.randomUUID();
        targetUserId = UUID.randomUUID();

        adminUser = User.builder()
                .id(adminId)
                .username("admin_user")
                .email("admin@quicktest.com")
                .fullName("System Admin")
                .role(Role.ADMIN)
                .isActive(true)
                .createdAt(LocalDateTime.now())
                .build();

        studentUser = User.builder()
                .id(targetUserId)
                .username("student_john")
                .email("john@student.com")
                .fullName("John Doe")
                .role(Role.STUDENT)
                .isActive(true)
                .createdAt(LocalDateTime.now())
                .build();

        sampleExam = Exam.builder()
                .id(UUID.randomUUID())
                .title("Midterm Java Exam")
                .accessCode("JAVA101")
                .status(ExamStatus.DRAFT)
                .durationMinutes(60)
                .maxAttempts(1)
                .createdBy(adminUser)
                .createdAt(LocalDateTime.now())
                .build();
    }

    // =========================================================================
    // User Governance Tests
    // =========================================================================

    @Test
    @DisplayName("listUsers: Should return paginated user summaries without keyword")
    void listUsers_Success() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<User> userPage = new PageImpl<>(List.of(adminUser, studentUser), pageable, 2);

        when(userRepository.findAll(eq(pageable))).thenReturn(userPage);

        Page<AdminUserSummaryResponse> result = adminService.listUsers(null, null, null, pageable);

        assertNotNull(result);
        assertEquals(2, result.getTotalElements());
        assertEquals("admin_user", result.getContent().get(0).getUsername());
    }

    @Test
    @DisplayName("listUsers: Should search with pattern when keyword is provided")
    void listUsers_WithKeyword_Success() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<User> userPage = new PageImpl<>(List.of(studentUser), pageable, 1);

        when(userRepository.searchUsers(isNull(), isNull(), eq("%john%"), eq(pageable))).thenReturn(userPage);

        Page<AdminUserSummaryResponse> result = adminService.listUsers(null, null, "john", pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals("student_john", result.getContent().get(0).getUsername());
    }

    @Test
    @DisplayName("toggleUserStatus: Should deactivate an active user")
    void toggleUserStatus_Deactivate_Success() {
        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(studentUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserSummaryResponse response = adminService.toggleUserStatus(targetUserId, adminId);

        assertNotNull(response);
        assertFalse(response.getIsActive());
        verify(userRepository, times(1)).save(studentUser);
    }

    @Test
    @DisplayName("toggleUserStatus: Should activate an inactive user")
    void toggleUserStatus_Activate_Success() {
        studentUser.setIsActive(false);
        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(studentUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserSummaryResponse response = adminService.toggleUserStatus(targetUserId, adminId);

        assertNotNull(response);
        assertTrue(response.getIsActive());
        verify(userRepository, times(1)).save(studentUser);
    }

    @Test
    @DisplayName("toggleUserStatus: Self-toggle should throw AppException")
    void toggleUserStatus_SelfToggle_ThrowsException() {
        AppException ex = assertThrows(AppException.class,
                () -> adminService.toggleUserStatus(adminId, adminId));

        assertTrue(ex.getMessage().contains("cannot toggle their own active status"));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateUserRole: Should change user role to TEACHER")
    void updateUserRole_Success() {
        UpdateUserRoleRequest req = UpdateUserRoleRequest.builder().role(Role.TEACHER).build();
        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(studentUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AdminUserSummaryResponse response = adminService.updateUserRole(targetUserId, req, adminId);

        assertNotNull(response);
        assertEquals(Role.TEACHER, response.getRole());
        verify(userRepository, times(1)).save(studentUser);
    }

    @Test
    @DisplayName("updateUserRole: Admin demoting self should throw AppException")
    void updateUserRole_SelfDemotion_ThrowsException() {
        UpdateUserRoleRequest req = UpdateUserRoleRequest.builder().role(Role.TEACHER).build();
        when(userRepository.findById(adminId)).thenReturn(Optional.of(adminUser));

        AppException ex = assertThrows(AppException.class,
                () -> adminService.updateUserRole(adminId, req, adminId));

        assertTrue(ex.getMessage().contains("cannot remove their own ADMIN role"));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("updateUserRole: Demoting last admin should throw AppException")
    void updateUserRole_DemoteLastAdmin_ThrowsException() {
        UUID otherAdminId = UUID.randomUUID();
        User otherAdmin = User.builder().id(otherAdminId).role(Role.ADMIN).build();
        UpdateUserRoleRequest req = UpdateUserRoleRequest.builder().role(Role.TEACHER).build();

        when(userRepository.findById(otherAdminId)).thenReturn(Optional.of(otherAdmin));
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(1L);

        AppException ex = assertThrows(AppException.class,
                () -> adminService.updateUserRole(otherAdminId, req, adminId));

        assertTrue(ex.getMessage().contains("last remaining administrator"));
        verify(userRepository, never()).save(any());
    }

    // --- createUser tests ---

    @Test
    @DisplayName("createUser: Successfully create user with any role")
    void createUser_Success() {
        AdminCreateUserRequest req = AdminCreateUserRequest.builder()
                .username("new_teacher")
                .email("teacher@quicktest.com")
                .fullName("New Teacher")
                .password("securePassword123")
                .role(Role.TEACHER)
                .build();

        when(userRepository.existsByUsername("new_teacher")).thenReturn(false);
        when(userRepository.existsByEmail("teacher@quicktest.com")).thenReturn(false);
        when(passwordEncoder.encode("securePassword123")).thenReturn("hashedPassword");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        AdminUserSummaryResponse result = adminService.createUser(req);

        assertNotNull(result);
        assertEquals("new_teacher", result.getUsername());
        assertEquals("teacher@quicktest.com", result.getEmail());
        assertEquals("New Teacher", result.getFullName());
        assertEquals(Role.TEACHER, result.getRole());
        assertEquals(com.quicktest.modules.iam.entity.AuthProvider.LOCAL, result.getAuthProvider());
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("createUser: Duplicate username throws UserAlreadyExistsException")
    void createUser_DuplicateUsername_ThrowsException() {
        AdminCreateUserRequest req = AdminCreateUserRequest.builder()
                .username("existing_user")
                .email("user@quicktest.com")
                .fullName("User")
                .password("password")
                .role(Role.STUDENT)
                .build();

        when(userRepository.existsByUsername("existing_user")).thenReturn(true);

        assertThrows(com.quicktest.core.exception.UserAlreadyExistsException.class,
                () -> adminService.createUser(req));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("createUser: Duplicate email throws UserAlreadyExistsException")
    void createUser_DuplicateEmail_ThrowsException() {
        AdminCreateUserRequest req = AdminCreateUserRequest.builder()
                .username("new_user")
                .email("existing@quicktest.com")
                .fullName("User")
                .password("password")
                .role(Role.STUDENT)
                .build();

        when(userRepository.existsByUsername("new_user")).thenReturn(false);
        when(userRepository.existsByEmail("existing@quicktest.com")).thenReturn(true);

        assertThrows(com.quicktest.core.exception.UserAlreadyExistsException.class,
                () -> adminService.createUser(req));
        verify(userRepository, never()).save(any());
    }

    // --- updateUserProfile tests ---

    @Test
    @DisplayName("updateUserProfile: Successfully update profile details")
    void updateUserProfile_Success() {
        AdminUpdateProfileRequest req = AdminUpdateProfileRequest.builder()
                .fullName("Updated Student Name")
                .email("updated_student@quicktest.com")
                .username("updated_student")
                .build();

        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(studentUser));
        when(userRepository.existsByUsernameAndIdNot("updated_student", targetUserId)).thenReturn(false);
        when(userRepository.existsByEmailAndIdNot("updated_student@quicktest.com", targetUserId)).thenReturn(false);
        when(userRepository.save(any(User.class))).thenReturn(studentUser);

        AdminUserSummaryResponse result = adminService.updateUserProfile(targetUserId, req);

        assertNotNull(result);
        assertEquals("Updated Student Name", studentUser.getFullName());
        assertEquals("updated_student@quicktest.com", studentUser.getEmail());
        assertEquals("updated_student", studentUser.getUsername());
        verify(userRepository).save(studentUser);
    }

    @Test
    @DisplayName("updateUserProfile: Username taken by other user throws exception")
    void updateUserProfile_UsernameTaken_ThrowsException() {
        AdminUpdateProfileRequest req = AdminUpdateProfileRequest.builder()
                .fullName("Student Name")
                .username("another_user")
                .build();

        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(studentUser));
        when(userRepository.existsByUsernameAndIdNot("another_user", targetUserId)).thenReturn(true);

        assertThrows(com.quicktest.core.exception.UserAlreadyExistsException.class,
                () -> adminService.updateUserProfile(targetUserId, req));
        verify(userRepository, never()).save(any());
    }

    // --- resetUserPassword tests ---

    @Test
    @DisplayName("resetUserPassword: Successfully reset password for LOCAL user")
    void resetUserPassword_Success() {
        AdminResetPasswordRequest req = AdminResetPasswordRequest.builder()
                .newPassword("newAdminProvidedSecret123")
                .build();

        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(studentUser));
        when(passwordEncoder.encode("newAdminProvidedSecret123")).thenReturn("encodedNewSecret");

        adminService.resetUserPassword(targetUserId, req);

        assertEquals("encodedNewSecret", studentUser.getPassword());
        verify(userRepository).save(studentUser);
    }

    @Test
    @DisplayName("resetUserPassword: Non-LOCAL/SSO user throws AppException")
    void resetUserPassword_NonLocalUser_ThrowsException() {
        User googleUser = User.builder()
                .id(UUID.randomUUID())
                .username("google_user")
                .email("google@gmail.com")
                .authProvider(AuthProvider.QUICK_BITE_SSO)
                .build();

        AdminResetPasswordRequest req = AdminResetPasswordRequest.builder()
                .newPassword("newPassword123")
                .build();

        when(userRepository.findById(googleUser.getId())).thenReturn(Optional.of(googleUser));

        AppException ex = assertThrows(AppException.class,
                () -> adminService.resetUserPassword(googleUser.getId(), req));

        assertTrue(ex.getMessage().contains("external/SSO"));
        verify(userRepository, never()).save(any());
    }

    // =========================================================================
    // Exam Governance Tests
    // =========================================================================


    @Test
    @DisplayName("listExams: Should return exam summaries without keyword")
    void listExams_Success() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<Exam> examPage = new PageImpl<>(List.of(sampleExam), pageable, 1);

        when(examRepository.findAllWithCreatedBy(eq(pageable))).thenReturn(examPage);
        List<Object[]> attemptRows = Collections.singletonList(new Object[] { sampleExam.getId(), 5L });
        List<Object[]> questionRows = Collections.singletonList(new Object[] { sampleExam.getId(), 10L });
        when(examAttemptRepository.countAttemptsByExamIds(anyList())).thenReturn(attemptRows);
        when(questionRepository.countQuestionsByExamIds(anyList())).thenReturn(questionRows);

        Page<AdminExamSummaryResponse> result = adminService.listExams(null, null, pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(5L, result.getContent().get(0).getTotalAttempts());
        assertEquals(10, result.getContent().get(0).getTotalQuestions());
        assertEquals("Midterm Java Exam", result.getContent().get(0).getTitle());
    }

    @Test
    @DisplayName("listExams: Should search with pattern when keyword is provided")
    void listExams_WithKeyword_Success() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<Exam> examPage = new PageImpl<>(List.of(sampleExam), pageable, 1);

        when(examRepository.searchExams(isNull(), eq("%midterm%"), eq(pageable))).thenReturn(examPage);
        List<Object[]> attemptRows = Collections.singletonList(new Object[] { sampleExam.getId(), 5L });
        List<Object[]> questionRows = Collections.singletonList(new Object[] { sampleExam.getId(), 10L });
        when(examAttemptRepository.countAttemptsByExamIds(anyList())).thenReturn(attemptRows);
        when(questionRepository.countQuestionsByExamIds(anyList())).thenReturn(questionRows);

        Page<AdminExamSummaryResponse> result = adminService.listExams(null, "midterm", pageable);

        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(5L, result.getContent().get(0).getTotalAttempts());
        assertEquals(10, result.getContent().get(0).getTotalQuestions());
        assertEquals("Midterm Java Exam", result.getContent().get(0).getTitle());
    }

    @Test
    @DisplayName("forceCloseExam: Should set status to CLOSED")
    void forceCloseExam_Success() {
        sampleExam.setStatus(ExamStatus.PUBLISHED);
        when(examRepository.findById(sampleExam.getId())).thenReturn(Optional.of(sampleExam));

        adminService.forceCloseExam(sampleExam.getId());

        assertEquals(ExamStatus.CLOSED, sampleExam.getStatus());
        verify(examRepository, times(1)).save(sampleExam);
        verify(examSessionService, times(1)).autoSubmitActiveAttemptsForExam(eq(sampleExam.getId()), anyString());
    }

    @Test
    @DisplayName("deleteExam: Should delete DRAFT exam with zero attempts")
    void deleteExam_Draft_Success() {
        when(examRepository.findById(sampleExam.getId())).thenReturn(Optional.of(sampleExam));
        when(examAttemptRepository.countByExamId(sampleExam.getId())).thenReturn(0L);

        adminService.deleteExam(sampleExam.getId());

        verify(examRepository, times(1)).delete(sampleExam);
    }

    @Test
    @DisplayName("deleteExam: PUBLISHED exam should throw AppException")
    void deleteExam_Published_ThrowsException() {
        sampleExam.setStatus(ExamStatus.PUBLISHED);
        when(examRepository.findById(sampleExam.getId())).thenReturn(Optional.of(sampleExam));

        AppException ex = assertThrows(AppException.class,
                () -> adminService.deleteExam(sampleExam.getId()));

        assertTrue(ex.getMessage().contains("Cannot delete a PUBLISHED exam"));
        verify(examRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteExam: Exam with existing attempts should throw AppException")
    void deleteExam_WithAttempts_ThrowsException() {
        sampleExam.setStatus(ExamStatus.CLOSED);
        when(examRepository.findById(sampleExam.getId())).thenReturn(Optional.of(sampleExam));
        when(examAttemptRepository.countByExamId(sampleExam.getId())).thenReturn(3L);

        AppException ex = assertThrows(AppException.class,
                () -> adminService.deleteExam(sampleExam.getId()));

        assertTrue(ex.getMessage().contains("existing candidate attempts"));
        verify(examRepository, never()).delete(any());
    }

    // =========================================================================
    // Dashboard Analytics Tests
    // =========================================================================

    @Test
    @DisplayName("getDashboard: Should return all aggregate metrics and recent violations")
    void getDashboard_Success() {
        when(userRepository.count()).thenReturn(100L);
        when(userRepository.countByRole(Role.TEACHER)).thenReturn(20L);
        when(userRepository.countByRole(Role.STUDENT)).thenReturn(78L);
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(2L);
        when(userRepository.countByIsActive(true)).thenReturn(95L);
        when(userRepository.countByIsActive(false)).thenReturn(5L);

        when(examRepository.count()).thenReturn(30L);
        when(examRepository.countByStatus(ExamStatus.DRAFT)).thenReturn(5L);
        when(examRepository.countByStatus(ExamStatus.PUBLISHED)).thenReturn(15L);
        when(examRepository.countByStatus(ExamStatus.CLOSED)).thenReturn(8L);
        when(examRepository.countByStatus(ExamStatus.ARCHIVED)).thenReturn(2L);

        when(examAttemptRepository.count()).thenReturn(500L);
        when(examAttemptRepository.countByStatus(AttemptStatus.IN_PROGRESS)).thenReturn(50L);
        when(examAttemptRepository.countByStatus(AttemptStatus.SUBMITTED)).thenReturn(420L);
        when(examAttemptRepository.countByStatus(AttemptStatus.AWAITING_MANUAL_GRADING)).thenReturn(25L);
        when(examAttemptRepository.countByStatus(AttemptStatus.DISQUALIFIED)).thenReturn(5L);

        when(violationLogRepository.count()).thenReturn(12L);
        when(violationLogRepository.findRecentViolations(any())).thenReturn(Collections.emptyList());

        AdminDashboardResponse dashboard = adminService.getDashboard();

        assertNotNull(dashboard);
        assertEquals(100L, dashboard.getTotalUsers());
        assertEquals(20L, dashboard.getTotalTeachers());
        assertEquals(78L, dashboard.getTotalStudents());
        assertEquals(2L, dashboard.getTotalAdmins());
        assertEquals(95L, dashboard.getActiveUsers());
        assertEquals(30L, dashboard.getTotalExams());
        assertEquals(15L, dashboard.getPublishedExams());
        assertEquals(500L, dashboard.getTotalAttempts());
        assertEquals(12L, dashboard.getTotalViolations());
        assertTrue(dashboard.getRecentViolations().isEmpty());
    }
}
