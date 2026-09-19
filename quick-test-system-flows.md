# Tài Liệu Luồng Nghiệp Vụ (System Flows): Hệ Thống Thi Trực Tuyến Quick Test

Tài liệu này mô tả chi tiết các luồng nghiệp vụ dựa CHÍNH XÁC trên các REST API Endpoints, Controllers và logic xử lý hiện tại trong mã nguồn Backend (Spring Boot).

## 1. Luồng Xác Thực và Phân Quyền (Auth Flow)
Ánh xạ theo `AuthController.java` và `AuthService.java`.

```mermaid
sequenceDiagram
    participant C as Client (React)
    participant A as AuthController
    participant S as AuthService
    participant DB as PostgreSQL
    
    C->>A: POST /api/auth/login (LoginRequest)
    A->>S: login(request)
    S->>DB: findByUsername()
    S->>S: Xác minh Mật khẩu & Tạo JWT Token
    S->>DB: recordLogin() (Cập nhật lastLoginAt)
    S-->>A: AuthResponse (accessToken, refreshToken)
    A-->>C: 200 OK + AuthResponse

    Note over C,DB: Truy xuất thông tin cá nhân
    C->>A: GET /api/auth/me (Kèm Bearer Token)
    A->>S: getCurrentUser()
    S-->>A: UserSummaryDto
    A-->>C: 200 OK + UserSummaryDto
```

---

## 2. Luồng Tạo Đề Thi & Quản Lý Câu Hỏi (Exam Creation & Question Bank)
Ánh xạ theo `ExamController.java` và `QuestionController.java`. Giáo viên tạo đề, cấu hình Proctoring, và lấy câu hỏi từ Question Bank.

```mermaid
sequenceDiagram
    participant T as Teacher
    participant E as ExamController
    participant Q as QuestionController
    participant DB as PostgreSQL
    
    T->>E: POST /api/teacher/exams (ExamCreateRequest)
    Note right of T: Payload gồm: duration, isProctoringEnabled,<br/>showResultsToStudents, maxViolations...
    E->>DB: Lưu Exam (Status: DRAFT)
    E-->>T: 201 Created (ExamDetailResponse)
    
    alt Thêm câu hỏi thủ công
        T->>Q: POST /api/teacher/exams/{id}/questions (QuestionRequest)
        Q->>DB: Lưu Question & AnswerOptions
        Q-->>T: 201 Created (QuestionDetailResponse)
    else Import từ Question Bank (Đề thi cũ)
        T->>Q: GET /api/teacher/question-bank?search=...
        Q->>DB: Tìm kiếm các Question đã tạo
        Q-->>T: 200 OK (Page<QuestionBankItemResponse>)
        T->>Q: POST /api/teacher/exams/{id}/questions/import (QuestionImportRequest)
        Q->>DB: Nhân bản Question & Options vào Đề thi mới
        Q-->>T: 200 OK (List<QuestionDetailResponse>)
    end
    
    T->>E: PATCH /api/teacher/exams/{id}/publish
    E->>DB: Cập nhật Status = PUBLISHED
    E-->>T: 200 OK (ExamDetailResponse)
```

---

## 3. Luồng Làm Bài Thi & Giám Sát (Session & Proctoring Flow)
Ánh xạ theo `ExamSessionController.java` và `ProctoringTelemetryController.java`.

```mermaid
sequenceDiagram
    participant S as Student / Guest
    participant C as ExamSessionController
    participant P as ProctoringTelemetryController
    participant R as Redis (Session Cache)
    participant DB as PostgreSQL
    
    S->>C: POST /api/session/start (StartExamRequest)
    C->>DB: Tạo ExamAttempt (Status: IN_PROGRESS, tính toán expireAt)
    C-->>S: 200 OK (ExamPaperResponse - Đã che đáp án đúng)
    
    loop Trong quá trình làm bài
        S->>C: PUT /api/session/{attemptId}/save (SaveAnswerRequest)
        C->>R: Lưu nháp vào Redis Hash (Tránh nghẽn DB)
        C-->>S: 200 OK
        
        alt Bị mất focus / Chuyển Tab (Nếu isProctoringEnabled = true)
            S->>P: POST /api/proctoring/telemetry (ViolationTelemetryDto)
            P->>DB: Lưu ViolationLog & Tăng violationCount
            P-->>S: 200 OK (Kèm cảnh báo)
        end
    end
    
    S->>C: POST /api/session/{attemptId}/submit (SubmitExamRequest)
    C->>R: Push vào Queue xử lý chấm điểm (Async)
    C-->>S: 202 Accepted (SubmitAcceptedResponse)
    
    S->>C: GET /api/session/{attemptId}/result (Polling kết quả)
    C->>DB: Lấy kết quả chấm
    C-->>S: 200 OK (SubmitResultResponse)
```

---

## 4. Luồng Chấm Điểm Tự Luận Thủ Công (Manual Grading Flow)
Ánh xạ theo `GradingController.java`. Dành cho các câu hỏi dạng `ESSAY_TEXT`.

```mermaid
sequenceDiagram
    participant T as Teacher
    participant G as GradingController
    participant DB as PostgreSQL
    
    T->>G: GET /api/teacher/grading/exams/{examId}/pending
    G->>DB: findAttemptsByStatus(AWAITING_MANUAL_GRADING)
    G-->>T: 200 OK (Page<ExamAttemptSummaryDto>)
    
    T->>G: GET /api/teacher/grading/attempts/{attemptId}
    G->>DB: Lấy các CandidateAnswer (Chỉ lấy câu PENDING_MANUAL)
    G-->>T: 200 OK (GradingDetailResponse)
    
    T->>G: POST /api/teacher/grading/attempts/{attemptId}/grade (GradeEssayDto)
    G->>DB: Cập nhật awardedScore, teacherFeedback
    G->>DB: Tính lại totalScore, Đổi Status = SUBMITTED nếu chấm xong
    G-->>T: 200 OK
```

---

## 5. Luồng Quản Trị Hệ Thống (Admin Dashboard & Management)
Ánh xạ theo `AdminDashboardController.java` và `AdminUserController.java`.

```mermaid
sequenceDiagram
    participant A as Admin
    participant C as AdminDashboardController
    participant U as AdminUserController
    participant DB as PostgreSQL
    
    A->>C: GET /api/admin/dashboard
    C->>DB: Query Aggregation (Count Users, Exams, Violations)
    C-->>A: 200 OK (AdminDashboardResponse)
    
    Note over A,DB: Admin quản lý người dùng
    A->>U: PATCH /api/admin/users/{id}/lock
    U->>DB: Cập nhật User.isActive = false
    U-->>A: 200 OK
```
