# Tài Liệu Thiết Kế Kỹ Thuật: Nền Tảng Thi Trực Tuyến Quick Test (Dự Án Cá Nhân Tinh Gọn & Hiệu Năng Cao)

## 1. Định Vị Dự Án & Tổng Quan Kiến Trúc
- **Định vị cốt lõi:** **QuickTest** là một **dự án cá nhân** xây dựng **nền tảng thi trực tuyến (Online Exam & Quiz Platform)** hiện đại, tinh gọn và nhanh chóng. Dự án không hướng tới mô hình khảo thí hàn lâm cồng kềnh hay hệ thống quản trị doanh nghiệp (Enterprise ERP/LMS) nặng nề, mà tập trung giải quyết trực diện bài toán thi cử thực tế: tạo đề nhanh, làm bài mượt mà, chống gian lận hiệu quả và chấm điểm tự động bằng AI với chi phí vận hành siêu tiết kiệm.
- **Giáo viên (Teacher):** Đăng ký/đăng nhập để soạn đề nhanh, quản lý ngân hàng câu hỏi, duyệt điểm tự luận thủ công, bật giám sát phòng thi và xem thống kê kết quả.
- **Học sinh (Student):** Đăng nhập bằng tài khoản để lưu vết lịch sử làm bài và theo dõi tiến độ học tập.
- **Khách vãng lai (Guest):** Thí sinh vào thi tức thì mà không cần thủ tục tạo tài khoản rườm rà — chỉ cần Họ tên, Mã định danh (MSSV/Email/SĐT) và Mã truy cập phòng thi (`accessCode`).
- **Khả năng liên kết Single Sign-On (SSO):**
  - Đóng vai trò là OAuth2/OIDC Resource Server nhẹ nhàng.
  - Sẵn sàng đồng bộ danh tính với các ứng dụng khác (ví dụ: ABP Framework Identity Server / OpenIddict) qua claim `sub` (User Guid) với cơ chế Just-in-Time (JIT) Provisioning độc lập.
- **Đa dạng dạng câu hỏi hỗ trợ:**
  1. `SINGLE_CHOICE`: Trắc nghiệm 1 đáp án đúng (tự động chấm điểm).
  2. `MULTIPLE_CHOICE`: Trắc nghiệm nhiều đáp án đúng (tự động chấm điểm tuyệt đối hoặc từng phần).
  3. `NUMERIC`: Nhập số chính xác (tự động chấm điểm, hỗ trợ dung sai sai số $\pm \epsilon$).
  4. `ESSAY_TEXT`: Nhập câu trả lời văn bản tự luận.
     - **Chấm điểm thủ công (Manual Grading):** Giáo viên vào biểu ghi bài làm theo đề thi hoặc theo từng câu hỏi (`Question-Centric Grading`) để chấm điểm và nhận xét.
     - **Chấm điểm tự động bằng AI (AI Grading with Google Gemini):** Hàng đợi đơn luồng bất đồng bộ kết hợp khóa phân tán Redis Lock cho từng đề thi. AI phân tích ngữ nghĩa, so khớp bài làm với đáp án mẫu (`sampleAnswer`) và biểu điểm (`gradingRubric`) để gợi ý điểm số, độ tương đồng ngữ nghĩa (`aiSimilarityScore`) và giải thích sư phạm chi tiết (`aiGradingExplanation`).
- **Soạn đề thi thông minh bằng AI (AI Document-to-Exam Generation):**
  - Trích xuất tài liệu bài học đa định dạng (PDF, DOCX, TXT) bằng Apache Tika & PDFBox.
  - Phân tích cấu trúc sư phạm và tạo câu hỏi tự động theo độ khó (`EASY`, `MEDIUM`, `HARD`, `BALANCED`) và ngôn ngữ (`vi`, `en`).
  - Cơ chế **Adaptive Multi-Pass & Rotation Continuation**: Chia đợt tạo an toàn (tối đa 15 câu/lượt để không chạm trần 8,192 tokens của Gemini), tự động xoay API key/model kế tiếp, đưa danh sách câu đã tạo vào prompt để chống trùng lặp, và fallback giữ nguyên các câu hỏi hoàn chỉnh thu thập được.
  - Giáo viên xem trước, chỉnh sửa hoặc chọn lọc trực tiếp trên giao diện trước khi commit vào đề thi.
- **Hệ thống Xoay vòng Khóa AI Thông minh (Gemini Rotation Pool):**
  - Cấu hình động đa khóa API Key và đa Model (`gemini-1.5-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-pro`) từ Database với fallback biến môi trường.
  - Giám sát hạn ngạch chủ động (Proactive Quota Window) theo dõi RPM và TPM qua Redis Sliding Window.
  - Tự động xoay sang slot khác khi gặp lỗi HTTP 429 (Rate Limit) hoặc máy chủ Google quá tải (HTTP 5xx).
  - Bảng điều khiển Admin theo dõi metrics thời gian thực và quản lý key/model.
- **Công nghệ nền tảng:**
  - **Backend:** Spring Boot 3.4.x, Java 21, Spring Data JPA, Hibernate, Spring Security (JWT & OAuth2 Resource Server), Spring WebSocket.
  - **AI Engine:** Google Gemini API (1.5 Flash, 2.0 Flash Lite, 1.5 Pro) qua GeminiRotationService.
  - **Caching & Locks:** Redis 7.x (Session cache, Timer server-side, Distributed Locks cho đề thi và người dùng, TPM/RPM Sliding Window, AI Tasks cache 48h).
  - **Database:** PostgreSQL (ACID persistence, UUID primary keys, Optimistic Locking, Full-Text Search).
  - **Storage:** Cloudinary (Lưu trữ ảnh câu hỏi và đáp án).
  - **Logging:** Centralized Audit Logging (`system_logs`, ghi nhận IP, User Agent, Execution Time).
  - **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Zustand + Axios + STOMP.js + Lucide Icons.

---

## 2. Cấu Trúc Thư Mục Dự Án (Package-by-Feature Chuẩn Hóa)

```text
com.quicktest
├── config/                         # Cấu hình Spring Security, Redis, WebSocket STOMP, JPA Auditing, RabbitMQ, GeminiPoolProperties
├── core/                           # Thành phần hạ tầng dùng chung toàn hệ thống
│   ├── common/                     # ApiResponse, PageResponse
│   ├── controller/                 # HealthController (/api/health)
│   ├── exception/                  # GlobalExceptionHandler, AppException, ResourceNotFoundException
│   ├── logging/                    # Centralized Audit Logging (SystemLog, @AuditLog, SystemLoggingAspect, SystemLogService, SystemLogRepository)
│   ├── ratelimit/                  # Distributed Rate Limiting Subsystem (@RateLimit, Token Bucket, Sliding Window, RedisRateLimitService)
│   ├── security/                   # JwtAuthenticationFilter, UserDetailsImpl, CustomAccessDeniedHandler
│   ├── service/                    # GeminiRotationService, GeminiModelSlot, AiMetricsRedisService
│   └── util/                       # Tiện ích mã hóa, chuỗi, thời gian, toán học
├── modules/                        # Phân rã nghiệp vụ theo module độc lập
│   ├── admin/                      # Quản trị hệ thống, người dùng, kỳ thi, log và AI
│   │   ├── controller/             # AdminAiController, AdminQuestionModerationController, AdminSystemHealthController, AdminSystemLogController, AdminUserController, AdminExamController, AdminDashboardController
│   │   ├── dto/                    # Các DTO quản trị AI, kiểm duyệt câu hỏi, logs, user, stats
│   │   ├── entity/                 # AiApiKey, AiModelConfigEntity
│   │   ├── repository/             # AiApiKeyRepository, AiModelConfigEntityRepository
│   │   └── service/                # AdminAiService, AdminQuestionModerationService, AdminSystemHealthService, AdminUserService, AdminService
│   ├── assessment/                 # Ngân hàng đề, câu hỏi và AI Document Generator
│   │   ├── ai/                     # Phân hệ Soạn đề AI & Giám sát tác vụ ngầm
│   │   │   ├── controller/         # AiGenerateController, TeacherAiTaskController
│   │   │   ├── dto/                # AiGenerateQuizRequest, AiGeneratedQuestionDto, TeacherAiTaskDto...
│   │   │   └── service/            # AiGenerateService, AiQuizGeneratorService, TeacherAiTaskService, DocumentParserService, AiQuizGeneratorAsyncWorker
│   │   ├── controller/             # ExamController, QuestionController, TeacherMediaController, QuestionGradingController
│   │   ├── dto/                    # ExamCreateRequest, QuestionCreateRequest, AnswerOptionDto, ExamDetailResponse...
│   │   ├── entity/                 # Exam, ExamStatus, Question, QuestionType, AnswerOption
│   │   ├── repository/             # ExamRepository, QuestionRepository, AnswerOptionRepository
│   │   └── service/                # ExamService, QuestionService, CloudinaryStorageService
│   ├── iam/                        # Xác thực & Quản lý danh tính
│   │   ├── controller/             # AuthController
│   │   ├── dto/                    # LoginRequest, RegisterRequest, AuthResponse, UserSummaryDto
│   │   ├── entity/                 # User, Role, AuthProvider
│   │   ├── repository/             # UserRepository
│   │   └── service/                # AuthService
│   ├── proctoring/                 # Viễn trắc giám sát & phát hiện gian lận
│   │   ├── controller/             # CandidateProctoringController, TeacherProctoringController, ProctoringWebSocketController
│   │   ├── dto/                    # ViolationReportMessage, HeartbeatMessage, ViolationAlertMessage, AttemptMonitorResponse
│   │   ├── entity/                 # ViolationLog, ViolationType
│   │   ├── repository/             # ViolationLogRepository
│   │   └── service/                # ProctoringService, ProctoringServiceImpl
│   └── session/                    # Phiên làm bài thi, nộp bài, chấm thi & báo cáo
│       ├── controller/             # ExamSessionController, StudentAttemptController, TeacherGradingController
│       ├── dto/                    # StartExamRequest, SaveAnswerRequest, SubmitExamRequest, GradeEssaySubmissionRequest
│       ├── entity/                 # ExamAttempt, AttemptStatus, CandidateAnswer, GradingStatus
│       ├── repository/             # ExamAttemptRepository, CandidateAnswerRepository
│       ├── scheduler/              # ExamLifecycleScheduler (Tự động rà soát đóng đề thi quá hạn)
│       └── service/                # ExamSessionService, TeacherGradingService, QuestionGradingService, QuestionGradingAsyncWorker, RedisExamSessionService, ExamSubmissionProducer, ExamSubmissionConsumer, ExamExportService
└── QuickTestApplication.java
```

---

## 3. Thiết Kế Cơ Sở Dữ Liệu & Ràng Buộc Schema

| Bảng (Table) | Mô tả | Ràng buộc & Chỉ mục chính |
| :--- | :--- | :--- |
| **users** | Tài khoản nội bộ và tài khoản liên kết SSO (QuickBite/ABP). | `sso_subject_id` (Unique, Nullable), `email` (Unique), `username` (Unique, Nullable). Index: `idx_users_sso_sub`, `idx_users_email`. |
| **exams** | Cấu hình kỳ thi, thời lượng, trạng thái phát hành, chống gian lận. | `access_code` (Unique), Index `(created_by, created_at)`. Hỗ trợ cờ proctoring (`is_proctoring_enabled`), ngưỡng vi phạm (`max_violations`) và bảo mật kết quả (`show_results_to_students`). |
| **questions** | Ngân hàng câu hỏi thuộc đề thi. Hỗ trợ 4 dạng câu hỏi, ảnh Cloudinary, kiểm duyệt nội dung của Admin. | FK `exam_id`, Index: `idx_questions_exam_order` `(exam_id, order_index)` và `idx_questions_moderation` `(is_safe, exam_id)`. Các cột: `image_url`, `sample_answer`, `grading_rubric`, `is_safe`, `reviewed_at`, `reviewed_by`. |
| **answer_options** | Các đáp án lựa chọn cho câu hỏi trắc nghiệm. Hỗ trợ ảnh đính kèm. | FK `question_id`, Index: `idx_options_question_order` `(question_id, order_index)`. Hỗ trợ `image_url`, `image_public_id`, `is_correct`. |
| **exam_attempts** | Phiên làm bài của thí sinh (User hoặc Guest). | Optimistic Lock `@Version`, Check Constraint: `(user_id IS NOT NULL) OR (guest_name IS NOT NULL AND guest_identifier IS NOT NULL)`. Index: `idx_attempts_user_exam`, `idx_attempts_guest_exam`. |
| **candidate_answers** | Câu trả lời của thí sinh cho từng câu hỏi, lưu điểm AI, điểm giáo viên và giải thích. | Unique Constraint: `uk_candidate_answers_attempt_question` `(attempt_id, question_id)`. Index: `idx_ca_question_grading_status` `(question_id, grading_status)`. Các cột: `awarded_score`, `ai_suggested_score`, `ai_similarity_score`, `ai_grading_explanation`. |
| **candidate_selected_options** | Bảng trung gian lưu danh sách đáp án chọn (Multiple Choice). | Composite PK: `(candidate_answer_id, option_id)`. |
| **violation_logs** | Lịch sử ghi nhận gian lận (chuyển tab, thoát fullscreen, devtools, đình chỉ...). | FK `attempt_id`, Index: `idx_violations_attempt_time` `(attempt_id, timestamp)`. |
| **ai_api_keys** | Quản lý các khóa API Google Gemini của hệ thống (tương ứng entity `AiApiKey`). | `api_key` (TEXT), Index: `idx_ai_keys_active` `(is_active, order_index)`. |
| **ai_models** | Cấu hình các model slot thuộc API Key, hạn ngạch RPM và TPM (tương ứng entity `AiModelConfigEntity`). | FK `ai_key_id`, Index: `idx_ai_models_key_active` `(ai_key_id, is_active, order_index)`. |
| **system_logs** | Nhật ký kiểm toán tập trung ghi lại hoạt động người dùng và hệ thống. | Index: `created_at DESC`, `(module, action)`, `actor_id`, `level`, `status`. Lưu IP, User Agent, Execution Time. |

---

## 4. Chi Tiết Các JPA Entity Classes

### 4.1. Module IAM - `User`, `Role`, `AuthProvider`

Sẵn sàng tích hợp Single Sign-On từ ABP Framework mà không cần chỉnh sửa database hay code QuickBite:
- `ssoSubjectId`: Ánh xạ tới claim `sub` (kiểu `Guid` trên ABP Framework).
- `password`: Đặt là nullable để phục vụ user SSO chỉ login bằng OAuth2 token.

```java
package com.quicktest.modules.iam.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "users",
    indexes = {
        @Index(name = "idx_users_sso_sub", columnList = "ssoSubjectId"),
        @Index(name = "idx_users_email", columnList = "email")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Mapping trực tiếp với claim "sub" (ABP User Guid). Nullable cho tài khoản tạo nội bộ
    @Column(unique = true, length = 64)
    private String ssoSubjectId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private AuthProvider authProvider = AuthProvider.LOCAL;

    @Column(unique = true, length = 100)
    private String username;

    // Nullable đối với người dùng đăng nhập qua SSO
    @Column(nullable = true)
    private String password;

    @Column(unique = true, nullable = false, length = 150)
    private String email;

    @Column(nullable = false, length = 150)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Role role; // TEACHER, STUDENT

    @Builder.Default
    private Boolean isActive = true;

    private LocalDateTime lastLoginAt;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
```

```java
package com.quicktest.modules.iam.entity;

public enum Role {
    TEACHER,
    STUDENT,
    ADMIN
}
```

```java
package com.quicktest.modules.iam.entity;

public enum AuthProvider {
    LOCAL,
    QUICK_BITE_SSO
}
```

---

### 4.2. Module Assessment - `Exam`, `Question`, `AnswerOption`

```java
package com.quicktest.modules.assessment.entity;

public enum ExamStatus {
    DRAFT,          // Đang soạn thảo, chưa mở thi
    PUBLISHED,      // Đã phát hành, sẵn sàng cho thi
    CLOSED,         // Đã đóng, không nhận thêm lượt thi
    ARCHIVED        // Đã lưu trữ
}
```

```java
package com.quicktest.modules.assessment.entity;

import com.quicktest.modules.iam.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
    name = "exams",
    indexes = {
        @Index(name = "idx_exams_access_code", columnList = "accessCode", unique = true),
        @Index(name = "idx_exams_created_by", columnList = "created_by, createdAt")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(unique = true, nullable = false, length = 30)
    private String accessCode; // Mã phòng thi

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private ExamStatus status = ExamStatus.DRAFT;

    @Column(nullable = false)
    private Integer durationMinutes; // Thời lượng thi (phút)

    @Builder.Default
    private Integer maxAttempts = 1; // Số lượt thi tối đa cho phép

    @Builder.Default
    private Boolean shuffleQuestions = true; // Xáo trộn thứ tự câu hỏi

    @Builder.Default
    private Boolean shuffleOptions = true;   // Xáo trộn thứ tự đáp án

    @Builder.Default
    @Column(name = "is_proctoring_enabled", nullable = false, columnDefinition = "boolean default false")
    private Boolean isProctoringEnabled = false; // Bật/tắt giám sát chống gian lận

    @Builder.Default
    @Column(name = "show_results_to_students", nullable = false, columnDefinition = "boolean default true")
    private Boolean showResultsToStudents = true; // Cấu hình cho phép học sinh xem điểm và đáp án

    @Builder.Default
    @Column(name = "max_violations", nullable = false, columnDefinition = "integer default 5")
    private Integer maxViolations = 5; // Số lần vi phạm tối đa trước khi tự động đình chỉ thi

    private LocalDateTime startTime; // Thời điểm bắt đầu mở thi
    private LocalDateTime endTime;   // Thời điểm đóng phòng thi

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy; // Giáo viên phụ trách

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @Builder.Default
    private List<Question> questions = new ArrayList<>();

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
```

```java
package com.quicktest.modules.assessment.entity;

public enum QuestionType {
    SINGLE_CHOICE,    // Trắc nghiệm 1 đáp án đúng
    MULTIPLE_CHOICE,  // Trắc nghiệm nhiều đáp án đúng
    NUMERIC,          // Nhập số chính xác (có hỗ trợ sai số)
    ESSAY_TEXT        // Nhập văn bản/tự luận (chấm tay, mở rộng AI sau)
}
```

```java
package com.quicktest.modules.assessment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.BatchSize;

@Entity
@Table(
    name = "questions",
    indexes = {
        @Index(name = "idx_questions_exam_order", columnList = "exam_id, orderIndex"),
        @Index(name = "idx_questions_moderation", columnList = "is_safe, exam_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    @Builder.Default
    private Integer orderIndex = 0; // Thứ tự hiển thị mặc định

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_url", length = 1000)
    private String imageUrl; // Link ảnh đính kèm (Cloudinary)

    @Column(name = "image_public_id", length = 255)
    private String imagePublicId; // ID ảnh trên Cloudinary

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private QuestionType questionType;

    @Column(nullable = false)
    @Builder.Default
    private Double points = 1.0;

    // --- Cấu hình chấm cho dạng NUMERIC & ESSAY_TEXT ---
    @Column(columnDefinition = "TEXT")
    private String sampleAnswer; // Đáp án mẫu / từ khóa chuẩn / đáp án số đúng

    private Double numericTolerance; // Dung sai cho phép đối với dạng NUMERIC (vd: +- 0.05)

    @Column(columnDefinition = "TEXT")
    private String gradingRubric; // Tiêu chí chấm cho Giáo viên (hoặc Context Prompt cho AI)

    // --- Quản trị kiểm duyệt nội dung (Content moderation governance) ---
    @Column(name = "is_safe", nullable = false)
    @Builder.Default
    private Boolean isSafe = false;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    // Dành cho SINGLE_CHOICE và MULTIPLE_CHOICE (Batch fetch chống N+1 queries)
    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @BatchSize(size = 50)
    @Builder.Default
    private List<AnswerOption> options = new ArrayList<>();
}
```

```java
package com.quicktest.modules.assessment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(
    name = "answer_options",
    indexes = {
        @Index(name = "idx_options_question_order", columnList = "question_id, orderIndex")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnswerOption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    @Builder.Default
    private Integer orderIndex = 0; // Thứ tự hiển thị A, B, C, D

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "image_url", length = 1000)
    private String imageUrl; // Link ảnh đính kèm

    @Column(name = "image_public_id", length = 255)
    private String imagePublicId; // ID ảnh trên Cloudinary

    @Column(nullable = false)
    @Builder.Default
    private Boolean isCorrect = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;
}
```

---

### 4.3. Module Session - `ExamAttempt`, `AttemptStatus`

Tối ưu hóa cho cả Guest lẫn Logged-in Student:
- Ràng buộc: hoặc có `user_id`, hoặc phải có đủ cả `guestName` và `guestIdentifier`.
- Bổ sung `expireAt` (tính sẵn server-side để chốt thời gian chính xác), `violationCount`, `ipAddress`, `userAgent`.
- Khóa lạc quan `@Version` chống submit 2 lần do mạng lag.

```java
package com.quicktest.modules.session.entity;

public enum AttemptStatus {
    IN_PROGRESS,                  // Đang làm bài
    SUBMITTED,                    // Đã nộp bài (tự động chấm hoàn tất)
    AWAITING_MANUAL_GRADING,      // Đã nộp bài, đang chờ giáo viên chấm câu tự luận
    DISQUALIFIED                  // Bị đình chỉ thi do vi phạm quy chế
}
```

```java
package com.quicktest.modules.session.entity;

import com.quicktest.modules.assessment.entity.Exam;
import com.quicktest.modules.iam.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
    name = "exam_attempts",
    indexes = {
        @Index(name = "idx_attempts_user_exam", columnList = "user_id, exam_id"),
        @Index(name = "idx_attempts_guest_exam", columnList = "guest_identifier, exam_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    // Dành cho học sinh đã có tài khoản (Local hoặc SSO)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    // Dành cho học sinh thi tự do (Guest - không đăng nhập)
    @Column(name = "guest_name", length = 150)
    private String guestName;

    @Column(name = "guest_identifier", length = 100)
    private String guestIdentifier; // Mã định danh tự do: MSSV, Email hoặc SĐT

    private LocalDateTime startTime;
    private LocalDateTime expireAt;   // Thời điểm cưỡng chế nộp bài (startTime + durationMinutes)
    private LocalDateTime submitTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 35)
    private AttemptStatus status;

    private Double totalScore; // Tổng điểm bài thi

    @Builder.Default
    private Integer violationCount = 0; // Đếm nhanh số lần vi phạm

    private String ipAddress;
    private String userAgent;

    @Version
    private Long version; // Optimistic Locking chống submit đồng thời 2 lần

    @OneToMany(mappedBy = "examAttempt", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CandidateAnswer> answers = new ArrayList<>();
}
```

---

### 4.4. Module Session & Proctoring - `CandidateAnswer`, `GradingStatus`, `ViolationLog`

```java
package com.quicktest.modules.session.entity;

public enum GradingStatus {
    AUTO_GRADED,       // Đã chấm tự động (áp dụng cho trắc nghiệm và nhập số)
    PENDING_MANUAL,    // Chờ giáo viên chấm thủ công (hiện tại)
    GRADED,            // Giáo viên đã chấm xong
    PENDING_AI         // [TÍNH NĂNG MỞ RỘNG SAU]: Chờ AI phân tích ngữ nghĩa
}
```

```java
package com.quicktest.modules.session.entity;

import com.quicktest.modules.assessment.entity.AnswerOption;
import com.quicktest.modules.assessment.entity.Question;
import jakarta.persistence.*;
import lombok.*;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(
    name = "candidate_answers",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_candidate_answers_attempt_question", columnNames = {"attempt_id", "question_id"})
    },
    indexes = {
        @Index(name = "idx_ca_question_grading_status", columnList = "question_id, grading_status")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt examAttempt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    // Phục vụ SINGLE_CHOICE & MULTIPLE_CHOICE (chọn 1 hoặc nhiều đáp án)
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "candidate_selected_options",
        joinColumns = @JoinColumn(name = "candidate_answer_id"),
        inverseJoinColumns = @JoinColumn(name = "option_id")
    )
    @Builder.Default
    private Set<AnswerOption> selectedOptions = new HashSet<>();

    // Phục vụ NUMERIC và ESSAY_TEXT
    @Column(columnDefinition = "TEXT")
    private String textAnswer; // Lưu văn bản tự luận hoặc chuỗi số thí sinh nhập

    // --- Kết quả chấm điểm riêng cho câu hỏi này ---
    private Double awardedScore; // Điểm số đạt được

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private GradingStatus gradingStatus = GradingStatus.AUTO_GRADED;

    @Column(columnDefinition = "TEXT")
    private String teacherFeedback; // Lời phê / nhận xét của giáo viên

    // --- Tích hợp AI Chấm điểm tự luận (Google Gemini) ---
    private Double aiSimilarityScore; // Điểm tương đồng ngữ nghĩa (0.0 -> 1.0)
    @Column(columnDefinition = "TEXT")
    private String aiGradingExplanation; // Lời giải thích gợi ý từ mô hình ngôn ngữ lớn
}
```

```java
package com.quicktest.modules.proctoring.entity;

public enum ViolationType {
    TAB_SWITCH,         // Chuyển tab trình duyệt
    EXIT_FULLSCREEN,    // Thoát chế độ toàn màn hình
    DEVTOOLS_OPEN,      // Cố tình mở Inspect / F12
    NO_FACE_DETECTED,   // Không tìm thấy khuôn mặt trước webcam
    MULTIPLE_FACES,     // Phát hiện nhiều hơn 1 khuôn mặt trong khung hình
    COPY_PASTE_ATTEMPT, // Cố tình copy / paste nội dung
    TEACHER_DISQUALIFY  // Giáo viên đình chỉ thủ công qua phòng giám sát
}
```

```java
package com.quicktest.modules.proctoring.entity;

import com.quicktest.modules.session.entity.ExamAttempt;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "violation_logs",
    indexes = {
        @Index(name = "idx_violations_attempt_time", columnList = "attempt_id, timestamp")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ViolationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt examAttempt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ViolationType violationType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime timestamp;
}
```

---

### 4.5. Module Admin & AI Pool - `AiApiKey`, `AiModelConfigEntity`

Quản trị cấu hình động các khóa API Google Gemini và các Model Slots trực tiếp từ Database với khả năng tái nạp nóng (`reloadPool`):

```java
package com.quicktest.modules.admin.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
    name = "ai_api_keys",
    indexes = {
        @Index(name = "idx_ai_keys_active", columnList = "is_active, order_index")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "api_key", nullable = false, columnDefinition = "TEXT")
    private String apiKey;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String provider = "GEMINI";

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "order_index", nullable = false)
    @Builder.Default
    private Integer orderIndex = 0;

    @OneToMany(mappedBy = "aiKey", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("orderIndex ASC")
    @Builder.Default
    private List<AiModelConfigEntity> models = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
```

```java
package com.quicktest.modules.admin.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "ai_models",
    indexes = {
        @Index(name = "idx_ai_models_key_active", columnList = "ai_key_id, is_active, order_index")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiModelConfigEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ai_key_id", nullable = false)
    @JsonIgnore
    private AiApiKey aiKey;

    @Column(name = "model_name", nullable = false, length = 100)
    private String modelName;

    @Column(nullable = false)
    @Builder.Default
    private Integer rpm = 15;

    @Column(nullable = false)
    @Builder.Default
    private Integer tpm = 200000;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "order_index", nullable = false)
    @Builder.Default
    private Integer orderIndex = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
```

---

### 4.6. Core Infrastructure - `SystemLog` (Centralized Audit Logging)

Ghi nhận toàn bộ nhật ký kiểm toán hệ thống tập trung với thông tin người dùng, IP, thiết bị, thời gian thực thi:

```java
package com.quicktest.core.logging;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "system_logs",
    indexes = {
        @Index(name = "idx_syslog_created_at", columnList = "created_at DESC"),
        @Index(name = "idx_syslog_module_action", columnList = "module, action"),
        @Index(name = "idx_syslog_actor", columnList = "actor_id"),
        @Index(name = "idx_syslog_level", columnList = "level"),
        @Index(name = "idx_syslog_status", columnList = "status")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LogLevel level;

    @Column(nullable = false, length = 60)
    private String module;

    @Column(nullable = false, length = 100)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LogStatus status;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_username", length = 100)
    private String actorUsername;

    @Column(name = "actor_role", length = 50)
    private String actorRole;

    @Column(length = 255)
    private String endpoint;

    @Column(name = "http_method", length = 10)
    private String httpMethod;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "execution_time_ms")
    private Long executionTimeMs;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
```

---

## 5. Quy Trình Vận Hành & Chấm Điểm

### 5.1. Cơ chế phân loại thí sinh (Guest vs Logged User vs SSO)
1. **Thí sinh có tài khoản (Local hoặc SSO từ QuickBite):**
   - Đăng nhập, gửi JWT Bearer token kèm `accessCode`.
   - Hệ thống tạo `ExamAttempt` liên kết trực tiếp với `User`.
2. **Thí sinh vãng lai (Guest - Không cần đăng nhập):**
   - Truy cập giao diện làm bài nhanh, nhập `accessCode`, `guestName`, `guestIdentifier`.
   - Hệ thống kiểm tra phòng thi hợp lệ, tạo `ExamAttempt` với `user_id = null`, ghi nhận tên và mã định danh tự do để giáo viên đối soát.

### 5.2. Luồng Chấm Điểm (Trắc Nghiệm, Tự Luận Thủ Công & AI)
1. **Câu hỏi trắc nghiệm & nhập số:**
   - Hệ thống so khớp tự động ngay khi thí sinh nộp bài.
   - Trắc nghiệm tính điểm tuyệt đối hoặc từng phần dựa trên tập hợp `selectedOptions`.
   - Câu số tính điểm nếu sai số $|x_{thí sinh} - x_{chuẩn}| \le \text{numericTolerance}$.
2. **Câu hỏi tự luận (`ESSAY_TEXT`):**
   - Khi thí sinh nộp bài, các câu hỏi tự luận được đặt trạng thái `PENDING_MANUAL`.
   - Bài thi chuyển trạng thái `AWAITING_MANUAL_GRADING`.
   - **Chế độ 1: Chấm thủ công (Manual Grading):** Giáo viên vào biểu ghi bài làm của từng thí sinh hoặc chấm hàng loạt theo từng câu hỏi (`Question-Centric Grading`), nhập điểm và nhận xét.
   - **Chế độ 2: Chấm tự động bằng AI (AI Grading via Gemini Rotation Pool):**
     - Giáo viên kích hoạt chấm AI cho 1 câu hỏi cụ thể (`SINGLE_QUESTION`) hoặc toàn bộ đề thi (`FULL_EXAM`).
     - Hệ thống kiểm tra và xác lập khóa phân tán Redis Lock cho đề thi (`EXAM_LOCK`) với TTL an toàn 4 giờ, chống xung đột giữa các giáo viên hoặc tác vụ trùng lặp.
     - Tác vụ được gửi vào hàng đợi xử lý bất đồng bộ đơn luồng (`aiGradingExecutor`) để đảm bảo không bị quá tải quota Gemini.
     - `QuestionGradingAsyncWorker` tính toán ngân sách token tối ưu (`getOptimalBatchTokenBudget`), chia các bài làm thành từng batch (tối đa 25 bài/batch để không vượt trần 8,192 tokens của Gemini).
     - Worker gọi Google Gemini qua `GeminiRotationService` kèm prompt chứa câu hỏi, rubric, đáp án mẫu và bài làm của học sinh.
     - AI trả về điểm số đề xuất (`aiSuggestedScore`), độ tương đồng ngữ nghĩa (`aiSimilarityScore`) và lý do giải thích chi tiết (`aiGradingExplanation`).
     - Dữ liệu được lưu trực tiếp vào bảng `candidate_answers` và cập nhật tiến độ liên tục vào Redis Task Monitor.

### 5.3. Luồng Soạn Đề Thi Bằng AI (AI Document-to-Exam Generation)
- **Tải lên & Tiền xử lý tài liệu:** Giáo viên tải lên tệp giáo trình/bài học (PDF, DOCX, TXT) hoặc dán văn bản trực tiếp. `DocumentParserService` trích xuất và làm sạch nội dung.
- **Khóa đơn luồng giáo viên:** Hệ thống xác lập khóa phân tán `USER_LOCK` trên Redis (mỗi tài khoản giáo viên chỉ chạy 1 tác vụ AI tại một thời điểm) để tránh spam tài nguyên.
- **Xử lý nền đơn luồng:** `AiQuizGeneratorAsyncWorker` nhận nhiệm vụ và thực thi qua `aiGradingExecutor`.
- **Cơ chế Adaptive Multi-Pass & Rotation Continuation:**
  - Nhằm giải quyết triệt để trần 8,192 tokens của Google Gemini (chỉ đủ chứa ~15 câu hỏi tiếng Việt kèm giải thích chi tiết), hệ thống tự động chia đợt tạo (mỗi lượt tối đa 15 câu).
  - Kết thúc mỗi đợt, hệ thống gọi `geminiRotationService.advanceToNextSlot()` để chuyển con trỏ sang API Key / Model kế tiếp, tránh cạn hạn ngạch TPM/RPM.
  - Ở các lượt tiếp theo, danh sách câu hỏi đã tạo được tổng hợp và đưa vào prompt chống trùng lặp (`Anti-Duplication Context`).
  - **Graceful Fallback:** Nếu tài liệu quá ngắn hoặc các slot AI bị cạn quota, hệ thống tự động lưu giữ và trả về toàn bộ số câu hỏi hoàn chỉnh đã tích lũy được thay vì làm hỏng toàn bộ job.
- **Xem trước và Cam kết (Preview & Commit):** Giáo viên xem lại, chỉnh sửa nội dung/đáp án hoặc lọc bỏ câu không ưng ý trên giao diện, sau đó ấn "Thêm vào đề thi" (`commitToExam`).

### 5.4. Hệ Thống Giám Sát Tác Vụ Ngầm AI (Teacher AI Tasks Monitor)
- **Lưu trữ trạng thái tập trung:** Toàn bộ tiến trình AI (`AI_QUIZ_GEN` và `AI_GRADING`) được lưu vết snapshot trên Redis với thời gian sống (TTL) 48 giờ.
- **Cập nhật thời gian thực:** Worker định kỳ cập nhật tỷ lệ hoàn thành (`progressPercent`), bước thực thi hiện tại (`currentStep`), số lượng câu hỏi đã sinh / số bài thi đã chấm.
- **Giao diện Giám sát (`/teacher/ai-tasks`):**
  - Hiển thị danh sách thẻ tác vụ sắp xếp theo thời gian mới nhất.
  - Hỗ trợ lọc theo trạng thái (`PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`).
  - Cho phép giáo viên hủy tác vụ khẩn cấp (giải phóng khóa phân tán) hoặc xóa khỏi lịch sử.
  - Cho phép mở Modal duyệt câu hỏi đã tạo ngay từ trang giám sát mà không cần ở lại màn hình tạo ban đầu.