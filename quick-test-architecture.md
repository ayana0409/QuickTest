# Tài Liệu Thiết Kế Dự Án: Hệ Thống Thi Trực Tuyến Quick Test (Đa Dạng Câu Hỏi & Chấm Điểm Linh Hoạt)

## 1. Tổng Quan Kiến Trúc & Yêu Cầu Chức Năng
- **Giáo viên (Teacher):** Bắt buộc đăng ký/đăng nhập để tạo đề, ngân hàng câu hỏi, chấm điểm tự luận thủ công, xem kết quả và giám sát gian lận.
- **Học sinh (Student):** Có tài khoản đăng nhập để theo dõi lịch sử làm bài và điểm số lâu dài.
- **Khách (Guest):** Học sinh thi tự do, không cần đăng nhập tài khoản. Chỉ cần nhập thông tin cơ bản (Họ tên, Mã định danh/MSSV/Email) và Mã đề thi (Exam Access Code) để làm bài.
- **Các loại câu hỏi hỗ trợ:**
  1. `SINGLE_CHOICE`: Trắc nghiệm chọn 1 đáp án đúng (tự động chấm).
  2. `MULTIPLE_CHOICE`: Trắc nghiệm chọn nhiều đáp án đúng (tự động chấm, hỗ trợ chấm từng phần).
  3. `NUMERIC`: Nhập số chính xác (tự động chấm, hỗ trợ sai số dung sai $\pm \epsilon$).
  4. `ESSAY_TEXT`: Nhập câu trả lời dạng văn bản/tự luận.
     - **Hiện tại:** Giáo viên chấm điểm thủ công (Manual Grading) kèm nhận xét.
     - **Tương lai (Tính năng mở rộng):** Tích hợp AI (Spring AI / LLM) để phân tích ngữ nghĩa, so khớp với đáp án mẫu và đề xuất điểm tự động.
- **Công nghệ cốt lõi:**
  - Backend: Spring Boot 3.x, Spring Data JPA, Hibernate, Spring Security, WebSocket.
  - Database & In-memory: PostgreSQL, Redis (Lưu phiên làm bài, Timer, Cache câu hỏi).
  - Messaging (Tùy chọn tải cao): RabbitMQ.
  - Frontend: React.

---

## 2. Cấu Trúc Thư Mục Dự Án (Package by Feature)

```text
com.quicktest
├── config/                     # Cấu hình Spring Security, Redis, WebSocket, JPA
├── core/                       # Thành phần dùng chung toàn hệ thống
│   ├── exception/              # GlobalExceptionHandler, Custom Exceptions
│   ├── security/               # JWT Filters, UserDetailsImpl, TokenProvider
│   └── utils/                  # Tiện ích chuỗi, mã hóa, ngày giờ
├── modules/                    # Các module nghiệp vụ độc lập
│   ├── iam/                    # Identity & Access Management (Teacher & Student)
│   │   ├── controller/         # AuthController (Login, Register)
│   │   ├── dto/                # AuthRequest, AuthResponse, RegisterRequest
│   │   ├── entity/             # User, Role
│   │   ├── repository/         # UserRepository
│   │   └── service/            # AuthService
│   ├── assessment/             # Quản lý đề thi & Câu hỏi (Dành cho Teacher)
│   │   ├── controller/         # ExamController, QuestionController
│   │   ├── dto/                # ExamCreateRequest, QuestionCreateDto
│   │   ├── entity/             # Exam, Question, AnswerOption, QuestionType
│   │   ├── repository/         # ExamRepository, QuestionRepository
│   │   └── service/            # ExamService, QuestionService
│   ├── session/                # Phiên thi, lưu bài & chấm điểm (Guest & Student)
│   │   ├── controller/         # ExamSessionController (Vào thi, Auto-save, Nộp bài)
│   │   ├── dto/                # StartExamRequest, SubmitAnswerDto, GradeEssayDto
│   │   ├── entity/             # ExamAttempt, CandidateAnswer, AttemptStatus, GradingStatus
│   │   ├── repository/         # ExamAttemptRepository, CandidateAnswerRepository
│   │   └── service/            # ExamSessionService, GradingService
│   └── proctoring/             # Hệ thống chống gian lận & Giám sát
│       ├── controller/         # TelemetryController (Nhận cảnh báo từ React)
│       ├── entity/             # ViolationLog
│       ├── repository/         # ViolationLogRepository
│       ├── service/            # ProctoringService
│       └── websocket/          # ProctoringWebSocketHandler
└── QuickTestApplication.java
```

---

## 3. Thiết Kế Cơ Sở Dữ Liệu (Database Schema)

| Bảng (Table) | Mô tả | Quan hệ chính |
| :--- | :--- | :--- |
| **users** | Lưu tài khoản của Giáo viên và Học sinh có đăng ký. | 1 Teacher -> N Exams |
| **exams** | Cấu hình đề thi (Thời lượng, mã phòng thi, thời gian mở/đóng). | 1 Exam -> N Questions, N ExamAttempts |
| **questions** | Nội dung câu hỏi và cấu hình chấm (loại câu, đáp án mẫu, dung sai số, rubric). | 1 Exam -> N Questions, 1 Question -> N AnswerOptions |
| **answer_options** | Các đáp án A, B, C, D cho câu hỏi trắc nghiệm. | N AnswerOptions -> 1 Question |
| **exam_attempts** | Phiên làm bài của thí sinh (Linh hoạt cho cả User đăng nhập và Guest). | 1 ExamAttempt -> N CandidateAnswers, N ViolationLogs |
| **candidate_answers** | Câu trả lời thực tế của thí sinh (cả trắc nghiệm, số và bài tự luận). | N CandidateAnswers -> 1 ExamAttempt |
| **candidate_selected_options** | Bảng trung gian lưu các đáp án trắc nghiệm được chọn (hỗ trợ chọn nhiều đáp án). | N-N giữa CandidateAnswer và AnswerOption |
| **violation_logs** | Lịch sử vi phạm quy chế thi (chuyển tab, thoát fullscreen,...). | N ViolationLogs -> 1 ExamAttempt |

---

## 4. Chi Tiết Các JPA Entity Classes

### 4.1. Module IAM - `User` & `Role`

```java
package com.quicktest.modules.iam.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false, length = 100)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 150)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Role role; // TEACHER, STUDENT

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
}
```

```java
package com.quicktest.modules.iam.entity;

public enum Role {
    TEACHER,
    STUDENT
}
```

---

### 4.2. Module Assessment - `QuestionType`, `Exam`, `Question`, `AnswerOption`

```java
package com.quicktest.modules.assessment.entity;

public enum QuestionType {
    SINGLE_CHOICE,    // Trắc nghiệm 1 đáp án đúng
    MULTIPLE_CHOICE,  // Trắc nghiệm nhiều đáp án đúng
    NUMERIC,          // Nhập số chính xác (có hỗ trợ sai số)
    ESSAY_TEXT        // Nhập văn bản/tự luận (chấm tay, AI tích hợp sau)
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
@Table(name = "exams")
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

    @Column(unique = true, nullable = false, length = 20)
    private String accessCode; // Mã phòng thi để học sinh và guest truy cập

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Integer durationMinutes; // Thời gian làm bài

    private LocalDateTime startTime; // Thời gian bắt đầu mở đề
    private LocalDateTime endTime;   // Thời gian kết thúc/đóng đề

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy; // Giáo viên tạo đề

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Question> questions = new ArrayList<>();

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
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
@Table(name = "questions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

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
    private String gradingRubric; // Tiêu chí chấm điểm cho Giáo viên (hoặc Context Prompt cho AI sau này)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    // Lựa chọn đáp án dành cho SINGLE_CHOICE và MULTIPLE_CHOICE
    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
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
@Table(name = "answer_options")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnswerOption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isCorrect = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;
}
```

---

### 4.3. Module Session - `ExamAttempt`, `AttemptStatus`, `GradingStatus`

```java
package com.quicktest.modules.session.entity;

public enum AttemptStatus {
    IN_PROGRESS,                  // Đang làm bài
    SUBMITTED,                    // Đã nộp bài (toàn bộ câu hỏi đã chấm xong)
    AWAITING_MANUAL_GRADING,      // Đã nộp bài, đang chờ giáo viên chấm câu tự luận
    DISQUALIFIED                  // Bị đình chỉ do vi phạm quy chế
}
```

```java
package com.quicktest.modules.session.entity;

public enum GradingStatus {
    AUTO_GRADED,       // Đã chấm tự động (áp dụng cho trắc nghiệm và nhập số)
    PENDING_MANUAL,    // Chờ giáo viên chấm thủ công (giai đoạn hiện tại)
    GRADED,            // Giáo viên đã chấm xong
    PENDING_AI         // [TÍNH NĂNG MỞ RỘNG SAU]: Chờ AI phân tích ngữ nghĩa tự động
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
@Table(name = "exam_attempts")
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

    // Dành cho học sinh đã có tài khoản và đăng nhập
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    // Dành cho học sinh thi tự do (Guest - không đăng nhập)
    @Column(name = "guest_name", length = 150)
    private String guestName;

    @Column(name = "guest_identifier", length = 100)
    private String guestIdentifier; // Mã định danh tự do: MSSV, Email hoặc SĐT

    private LocalDateTime startTime;
    private LocalDateTime submitTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 35)
    private AttemptStatus status;

    private Double totalScore; // Tổng điểm cuối cùng sau khi đã chấm xong hết

    @Version
    private Long version; // Optimistic Locking chống submit đồng thời 2 lần

    @OneToMany(mappedBy = "examAttempt", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<CandidateAnswer> answers = new ArrayList<>();
}
```

---

### 4.4. Module Session & Proctoring - `CandidateAnswer` & `ViolationLog`

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
@Table(name = "candidate_answers")
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
    private String textAnswer; // Văn bản tự luận hoặc chuỗi số thí sinh nhập

    // --- Kết quả chấm điểm cho câu này ---
    private Double awardedScore; // Điểm số đạt được

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private GradingStatus gradingStatus = GradingStatus.AUTO_GRADED;

    @Column(columnDefinition = "TEXT")
    private String teacherFeedback; // Lời phê / nhận xét của giáo viên (Hiện tại)

    // --- NOTE: TÍNH NĂNG TÍCH HỢP SAU (FUTURE AI ENHANCEMENT) ---
    // Trường này lưu điểm tương đồng ngữ nghĩa khi tích hợp AI (0.0 -> 1.0)
    private Double aiSimilarityScore; 
    @Column(columnDefinition = "TEXT")
    private String aiGradingExplanation; // Phân tích gợi ý từ mô hình ngôn ngữ lớn
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
@Table(name = "violation_logs")
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

    @Column(nullable = false, length = 50)
    private String violationType; // TAB_SWITCH, EXIT_FULLSCREEN, NO_FACE, MULTI_FACE

    @Column(columnDefinition = "TEXT")
    private String description;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime timestamp;
}
```

---

## 5. Quy Trình Chấm Điểm & Lộ Trình Nâng Cấp AI

### 5.1. Quy trình chấm điểm hiện tại (Current Workflow)
1. **Câu hỏi trắc nghiệm & nhập số (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `NUMERIC`):**
   - Hệ thống tự động đối chiếu đáp án ngay khi nộp bài.
   - Với câu hỏi số: Hệ thống so sánh giá trị $|x_{thí sinh} - x_{đáp án}| \le 	ext{numericTolerance}$.
   - Trạng thái chấm của câu được đặt là `AUTO_GRADED`.
2. **Câu hỏi tự luận (`ESSAY_TEXT`):**
   - Đặt trạng thái câu hỏi là `PENDING_MANUAL`.
   - Trạng thái của bài thi `ExamAttempt` chuyển sang `AWAITING_MANUAL_GRADING`.
   - Giáo viên vào trang quản trị xem bài làm, đọc hướng dẫn chấm (`gradingRubric`) và nhập `awardedScore` kèm `teacherFeedback`.
   - Khi giáo viên chấm hết các câu tự luận, hệ thống tính tổng điểm và chuyển bài thi sang trạng thái `SUBMITTED`.

### 5.2. Note: Kế hoạch tích hợp AI (Future AI Enhancement)
- **Mục tiêu:** Giảm tải thời gian chấm bài tự luận của giáo viên bằng cách tự động đánh giá độ tương đồng ngữ nghĩa giữa câu trả lời của thí sinh và đáp án mẫu (`sampleAnswer`).
- **Cách thức vận hành khi kích hoạt:**
  1. Khi thí sinh nộp bài có câu `ESSAY_TEXT`, hệ thống đẩy payload (Nội dung câu hỏi, Rubric, Đáp án mẫu, Bài làm thí sinh) vào Message Queue.
  2. Worker gọi API của mô hình ngôn ngữ lớn (Spring AI kết nối với Gemini / GPT-4) qua cơ chế Asynchronous.
  3. AI chấm và trả về: Điểm số đề xuất + Điểm tương đồng (`aiSimilarityScore`) + Lời giải thích (`aiGradingExplanation`).
  4. Giáo viên chỉ cần vào màn hình duyệt: bấm chấp thuận điểm đề xuất của AI hoặc can thiệp chỉnh sửa lại.