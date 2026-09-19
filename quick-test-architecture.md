# Tài Liệu Thiết Kế Kỹ Thuật: Hệ Thống Thi Trực Tuyến Quick Test (Phiên Bản Toàn Diện & Chuẩn Hóa)

## 1. Tổng Quan Kiến Trúc & Yêu Cầu Chức Năng
- **Giáo viên (Teacher):** Đăng ký/đăng nhập để soạn đề, phân loại câu hỏi, duyệt điểm tự luận thủ công, cấu hình giám sát và xem phân tích gian lận.
- **Học sinh (Student):** Đăng nhập bằng tài khoản nội bộ hoặc tài khoản SSO (QuickBite/ABP Framework) để lưu vết lịch sử thi.
- **Khách (Guest):** Thí sinh vãng lai không cần tài khoản, vào thi trực tiếp chỉ bằng: Họ tên, Mã định danh cá nhân (MSSV/Email/SĐT) và Mã truy cập phòng thi (`accessCode`).
- **Sẵn sàng tích hợp Single Sign-On (SSO):**
  - Đóng vai trò là OAuth2/OIDC Resource Server.
  - Sẵn sàng đồng bộ danh tính với QuickBite (ABP Framework Identity Server / OpenIddict) qua claim `sub` (ABP User Guid) với cơ chế Just-in-Time (JIT) Provisioning mà không cần sửa đổi mã nguồn QuickBite.
- **Đa dạng dạng câu hỏi hỗ trợ:**
  1. `SINGLE_CHOICE`: Trắc nghiệm 1 đáp án đúng (tự động chấm điểm).
  2. `MULTIPLE_CHOICE`: Trắc nghiệm nhiều đáp án đúng (tự động chấm điểm tuyệt đối hoặc từng phần).
  3. `NUMERIC`: Nhập số chính xác (tự động chấm điểm, hỗ trợ dung sai sai số $\pm \epsilon$).
  4. `ESSAY_TEXT`: Nhập câu trả lời văn bản tự luận.
     - **Giai đoạn hiện tại:** Giáo viên chấm điểm thủ công (Manual Grading) kèm phản hồi/nhận xét.
     - **Giai đoạn mở rộng sau này (Future AI):** Tích hợp Spring AI / LLM để so khớp ngữ nghĩa và tự động gợi ý điểm dựa trên đáp án mẫu (`sampleAnswer`) và tiêu chí chấm (`gradingRubric`).
- **Công nghệ nền tảng:**
  - Backend: Spring Boot 3.x, Spring Data JPA, Hibernate, Spring Security (OAuth2 Resource Server), Spring WebSocket.
  - Caching & State: Redis (Lưu phiên làm bài, đếm ngược Timer server-side, bộ đếm vi phạm atomic counter).
  - Database: PostgreSQL (ACID persistence, UUID primary keys, Optimistic Locking).
  - Messaging (Tùy chọn chịu tải nộp dồn): RabbitMQ / Redis Streams.
  - Frontend: React + Tailwind CSS + WebSocket client.

---

## 2. Cấu Trúc Thư Mục Dự Án (Package-by-Feature Chuẩn Hóa)

```text
com.quicktest
├── config/                         # Cấu hình Spring Security, Redis, WebSocket, JPA Auditing
├── core/                           # Thành phần dùng chung toàn hệ thống
│   ├── exception/                  # GlobalExceptionHandler, BusinessException, ResourceNotFoundException
│   ├── security/                   # JwtAuthenticationFilter, UserDetailsImpl, SsoClaimsExtractor
│   └── utils/                      # Tiện ích mã hóa, chuỗi, thời gian, toán học
├── modules/                        # Phân rã nghiệp vụ theo module
│   ├── common/                     # Shared    ├── admin/                          # System administration and oversight
│   │   ├── controller/             # AdminUserController, AdminExamController, AdminDashboardController
│   │   ├── dto/                    # Admin statistics and management DTOs
│   │   └── service/                # AdminService, StatsService
    ├── assessment/                 # Quản lý ngân hàng đề & câu hỏi (Teacher)
│   │   ├── controller/             # ExamController, QuestionController
│   │   ├── dto/                    # ExamRequest, QuestionRequest, ExamDetailResponse, QuestionBankItemResponse
│   │   ├── entity/                 # Exam, ExamStatus, Question, QuestionType, AnswerOption
│   │   ├── repository/             # ExamRepository, QuestionRepository, AnswerOptionRepository
│   │   └── service/                # ExamService, QuestionService
    ├── session/                    # Phiên làm bài, chấm điểm & nộp bài (Guest & Student)
│   │   ├── controller/             # ExamSessionController, GradingController
│   │   ├── dto/                    # StartSessionRequest, SubmitAnswerDto, GradeEssayDto
│   │   ├── entity/                 # ExamAttempt, AttemptStatus, CandidateAnswer, GradingStatus
│   │   ├── repository/             # ExamAttemptRepository, CandidateAnswerRepository
│   │   └── service/                # ExamSessionService, GradingService, RedisSessionService
    └── proctoring/                 # Hệ thống telemetry, phát hiện & xử phạt gian lận
        ├── controller/             # ProctoringTelemetryController
        ├── dto/                    # ViolationTelemetryDto
        ├── entity/                 # ViolationLog, ViolationType
        ├── repository/             # ViolationLogRepository
        ├── service/                # ProctoringService
        └── websocket/              # ProctoringWebSocketHandler
└── QuickTestApplication.java─ repository/             # ExamAttemptRepository, CandidateAnswerRepository
│   │   └── service/                # ExamSessionService, GradingService, RedisSessionService
│   └── proctoring/                 # Hệ thống telemetry, phát hiện & xử phạt gian lận
│       ├── controller/             # ProctoringTelemetryController
│       ├── dto/                    # ViolationTelemetryDto
│       ├── entity/                 # ViolationLog, ViolationType
│       ├── repository/             # ViolationLogRepository
│       ├── service/                # ProctoringService
│       └── websocket/              # ProctoringWebSocketHandler
└── QuickTestApplication.java
```

---

## 3. Thiết Kế Cơ Sở Dữ Liệu & Ràng Buộc Schema

| Bảng (Table) | Mô tả | Ràng buộc & Chỉ mục chính |
| :--- | :--- | :--- |
| **users** | Tài khoản nội bộ và tài khoản liên kết SSO (QuickBite/ABP). | `sso_subject_id` (Unique, Nullable), `email` (Unique), `username` (Unique, Nullable). |
| **exams** | Cấu hình kỳ thi, thời lượng, trạng thái phát hành. | `access_code` (Unique), Index `(created_by, created_at)`. Hỗ trợ bật/tắt chống gian lận (`is_proctoring_enabled`) và bảo mật kết quả (`show_results_to_students`). |
| **questions** | Ngân hàng câu hỏi thuộc đề thi. Hỗ trợ 4 dạng câu hỏi và ảnh đính kèm. | FK `exam_id`, Index `(exam_id, order_index)`. |
| **answer_options** | Các đáp án lựa chọn cho câu hỏi trắc nghiệm. Hỗ trợ ảnh đính kèm. | FK `question_id`, Index `(question_id, order_index)`. |
| **exam_attempts** | Phiên làm bài của thí sinh (User hoặc Guest). | Optimistic Lock `@Version`, Check Constraint: `(user_id IS NOT NULL) OR (guest_name IS NOT NULL AND guest_identifier IS NOT NULL)`. |
| **candidate_answers** | Câu trả lời của thí sinh cho từng câu hỏi. | Unique Constraint: `(attempt_id, question_id)`. |
| **candidate_selected_options** | Bảng trung gian lưu danh sách đáp án chọn (Multiple Choice). | Composite PK: `(candidate_answer_id, option_id)`. |
| **violation_logs** | Lịch sử ghi nhận gian lận (chuyển tab, thoát toàn màn hình,...). | FK `attempt_id`, Index `(attempt_id, timestamp)`. |

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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
    name = "questions",
    indexes = {
        @Index(name = "idx_questions_exam_order", columnList = "exam_id, orderIndex")
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
    private String gradingRubric; // Tiêu chí chấm cho Giáo viên (hoặc Context Prompt cho AI sau này)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    // Dành cho SINGLE_CHOICE và MULTIPLE_CHOICE
    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @org.hibernate.annotations.BatchSize(size = 50)
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
    private String teacherFeedback; // Lời phê / nhận xét của giáo viên (Hiện tại)

    // --- NOTE: TÍNH NĂNG TÍCH HỢP SAU (FUTURE AI ENHANCEMENT) ---
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
    COPY_PASTE_ATTEMPT  // Cố tình copy / paste nội dung
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

## 5. Quy Trình Vận Hành & Chấm Điểm

### 5.1. Cơ chế phân loại thí sinh (Guest vs Logged User vs SSO)
1. **Thí sinh có tài khoản (Local hoặc SSO từ QuickBite):**
   - Đăng nhập, gửi JWT Bearer token kèm `accessCode`.
   - Hệ thống tạo `ExamAttempt` liên kết trực tiếp với `User`.
2. **Thí sinh vãng lai (Guest - Không cần đăng nhập):**
   - Truy cập giao diện làm bài nhanh, nhập `accessCode`, `guestName`, `guestIdentifier`.
   - Hệ thống kiểm tra phòng thi hợp lệ, tạo `ExamAttempt` với `user_id = null`, ghi nhận tên và mã định danh tự do để giáo viên đối soát.

### 5.2. Luồng chấm điểm (Hiện tại: Thủ công / Tự động)
1. **Câu hỏi trắc nghiệm & nhập số:**
   - Hệ thống so khớp tự động ngay khi thí sinh nộp bài.
   - Trắc nghiệm tính điểm tuyệt đối hoặc từng phần dựa trên tập hợp `selectedOptions`.
   - Câu số tính điểm nếu sai số $|x_{thí sinh} - x_{chuẩn}| \le \text{numericTolerance}$.
2. **Câu hỏi tự luận (`ESSAY_TEXT`):**
   - Câu hỏi được gán trạng thái `PENDING_MANUAL`.
   - Bài thi chuyển trạng thái `AWAITING_MANUAL_GRADING`.
   - Giáo viên vào xem bài nộp, đọc hướng dẫn chấm (`gradingRubric`) và nhập `awardedScore` kèm `teacherFeedback`.
   - Khi hoàn tất chấm tất cả câu hỏi tự luận, hệ thống tổng kết điểm và chuyển `ExamAttempt` sang trạng thái `SUBMITTED`.

### 5.3. Note: Kế hoạch tích hợp AI tương lai (Future AI Enhancement)
- **Mô hình triển khai:** Khi kích hoạt cờ tính năng AI, các câu hỏi `ESSAY_TEXT` được đẩy vào Message Queue (`PENDING_AI`).
- **Xử lý bất đồng bộ:** Worker gọi mô hình ngôn ngữ lớn (Spring AI kết nối với Gemini / GPT-4) kèm prompt gồm: Nội dung câu hỏi, Rubric, Đáp án mẫu và Bài làm của học sinh.
- **Kết quả gợi ý:** AI trả về điểm số dự kiến, độ tương đồng (`aiSimilarityScore`) và lý do chấm (`aiGradingExplanation`). Giáo viên duyệt nhanh bằng 1 click hoặc điều chỉnh thủ công nếu cần.