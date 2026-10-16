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

## 4. Luồng Chấm Điểm Tự Luận (Attempt Grading & Question-Centric Grading)
Ánh xạ theo `TeacherGradingController.java` và `QuestionGradingController.java`. Dành cho các câu hỏi dạng `ESSAY_TEXT`.

```mermaid
sequenceDiagram
    participant T as Teacher
    participant TG as TeacherGradingController
    participant QG as QuestionGradingController
    participant DB as PostgreSQL
    
    alt Chấm theo từng bài thi (Attempt-Centric)
        T->>TG: GET /api/teacher/grading/exams/{examId}/attempts
        TG->>DB: Lấy danh sách lượt thi và trạng thái chấm
        TG-->>T: 200 OK (Page<TeacherAttemptSummaryDto>)
        
        T->>TG: GET /api/teacher/grading/attempts/{attemptId}
        TG->>DB: Lấy các câu trả lời tự luận PENDING_MANUAL
        TG-->>T: 200 OK (TeacherAttemptDetailDto)
        
        T->>TG: POST /api/teacher/grading/attempts/submit-grades (SubmitGradesRequest)
        TG->>DB: Cập nhật awardedScore, teacherFeedback, đổi Status = SUBMITTED
        TG-->>T: 200 OK
    else Chấm tập trung theo từng câu hỏi (Question-Centric)
        T->>QG: GET /api/teacher/grading/exams/{examId}/questions
        QG->>DB: Lấy danh sách câu hỏi kèm thống kê tiến độ chấm
        QG-->>T: 200 OK (List<GradingQuestionSummaryDto>)
        
        T->>QG: GET /api/teacher/grading/questions/{questionId}/submissions
        QG->>DB: Lấy tất cả bài làm của học sinh cho câu hỏi này
        QG-->>T: 200 OK (QuestionSubmissionsResponse)
        
        T->>QG: POST /api/teacher/grading/questions/{questionId}/manual
        QG->>DB: Cập nhật điểm và nhận xét hàng loạt, tự động tính lại điểm tổng
        QG-->>T: 200 OK
    end
```

---

## 5. Luồng Tự Động Chấm Thi Bằng AI (AI Grading via Gemini Rotation Pool)
Ánh xạ theo `QuestionGradingController.java`, `QuestionGradingAsyncWorker.java` và `GeminiRotationService.java`.

```mermaid
sequenceDiagram
    participant T as Teacher
    participant C as QuestionGradingController
    participant R as Redis (Lock & Tasks)
    participant W as Single-Thread Worker (aiGradingExecutor)
    participant G as Gemini Rotation Pool
    participant DB as PostgreSQL
    
    T->>C: POST /api/teacher/grading/trigger-ai (scope: SINGLE_QUESTION / FULL_EXAM)
    C->>R: SETNX exam_ai_grading_lock:{examId} (TTL 4h)
    alt Không lấy được lock (Exam đang có tiến trình chấm AI)
        C-->>T: 409 Conflict ("Đề thi đang có tiến trình AI đang chấm")
    else Lấy lock thành công
        C->>R: Khởi tạo Task snapshot (status: QUEUED)
        C->>W: Đẩy task vào hàng đợi đơn luồng bất đồng bộ
        C-->>T: 202 Accepted (TriggerAiGradingResponse)
    end
    
    W->>R: Cập nhật Task status = PROCESSING
    loop Duyệt từng batch bài nộp (Max 25 bài/batch)
        W->>G: executeWithRotation(prompt, temperature, maxTokens)
        Note over G: Tự động xoay API Key / Model<br/>khi gặp HTTP 429 hoặc quá tải
        G-->>W: Raw JSON (aiSuggestedScore, aiSimilarityScore, aiGradingExplanation)
        W->>DB: Lưu kết quả vào candidate_answers
        W->>R: Cập nhật Task progressPercent, processedItems
    end
    
    W->>DB: Tính toán lại tổng điểm bài thi
    W->>R: Cập nhật Task status = COMPLETED (TTL 48h)
    W->>R: DEL exam_ai_grading_lock:{examId} (Giải phóng khóa)
```

---

## 6. Luồng Soạn Đề Thi Bằng AI (AI Document-to-Exam Generation)
Ánh xạ theo `AiGenerateController.java`, `AiQuizGeneratorAsyncWorker.java` và `AiQuizGeneratorService.java`.

```mermaid
sequenceDiagram
    participant T as Teacher
    participant C as AiGenerateController
    participant R as Redis (User Lock & Task Cache)
    participant W as Async Worker (aiGradingExecutor)
    participant S as AiQuizGeneratorService
    participant G as Gemini Rotation Pool
    participant DB as PostgreSQL
    
    T->>C: POST /api/teacher/ai-generate/from-document (File/Text, totalQuestions, difficulty, targetTypes)
    C->>R: SETNX ai:quiz_gen:lock:user:{teacherId} (Chống spam, 1 task/teacher)
    C->>R: Tạo job snapshot (Status: QUEUED)
    C->>W: Đưa job vào hàng đợi đơn luồng
    C-->>T: 202 Accepted (AiGenerateJobResponse: jobId)
    
    W->>R: Cập nhật status = PROCESSING
    
    loop Adaptive Multi-Pass & Rotation Continuation (Max 15 câu/pass)
        W->>S: generateQuestions(documentText, request, progressCallback)
        S->>G: executeWithRotation(Prompt kèm Anti-Duplication Context)
        G-->>S: JSON Questions Array (hoặc tự phục hồi JSON cắt dở)
        S->>G: advanceToNextSlot() (Xoay sang Key / Model kế tiếp)
        S->>S: Lọc trùng lặp & kiểm tra đủ số lượng
        S-->>W: Danh sách câu hỏi tích lũy được (hoặc Graceful Fallback)
    end
    
    W->>R: Lưu kết quả danh sách câu hỏi vào Redis (Status: COMPLETED)
    W->>R: DEL ai:quiz_gen:lock:user:{teacherId} (Giải phóng khóa tài khoản)
    
    T->>C: GET /api/teacher/ai-generate/jobs/{jobId} (Polling hoặc qua trang AI Tasks)
    C-->>T: 200 OK (Danh sách câu hỏi xem trước)
    
    T->>C: POST /api/teacher/ai-generate/commit-to-exam/{examId}
    C->>DB: Lưu các câu hỏi đã duyệt vào bảng questions & answer_options
    C-->>T: 201 Created (List<QuestionResponse>)
```

---

## 7. Luồng Giám Sát Tác Vụ Ngầm AI Giáo Viên (Teacher AI Tasks Monitor)
Ánh xạ theo `TeacherAiTaskController.java` và `TeacherAiTaskService.java`.

```mermaid
sequenceDiagram
    participant T as Teacher (/teacher/ai-tasks)
    participant C as TeacherAiTaskController
    participant R as Redis (ai:teacher_tasks:{teacherId}:*)
    
    T->>C: GET /api/teacher/ai-tasks (Polling định kỳ 3 giây)
    C->>R: Quét các keys tác vụ của giáo viên (Lưu vết 48h)
    C-->>T: 200 OK (List<TeacherAiTaskDto> - Metrics, Progress, Step)
    
    alt Giáo viên xem lại kết quả tạo đề
        T->>C: GET /api/teacher/ai-tasks/{taskId}
        C->>R: Lấy chi tiết tác vụ và toàn bộ payload câu hỏi
        C-->>T: 200 OK (TeacherAiTaskDto kèm preview questions)
    else Giáo viên hủy tác vụ đang chạy
        T->>C: POST /api/teacher/ai-tasks/{taskId}/cancel
        C->>R: Đổi status = CANCELLED, xóa distributed lock
        C-->>T: 200 OK ("Đã hủy tác vụ AI thành công")
    end
```

---

## 8. Luồng Quản Trị Hệ Thống AI & Xoay Vòng Khóa (Admin AI Pool Management)
Ánh xạ theo `AdminAiController.java`, `AdminAiService.java` và `GeminiRotationService.java`.

```mermaid
sequenceDiagram
    participant A as Admin (/admin/ai)
    participant C as AdminAiController
    participant S as AdminAiService
    participant R as Redis (Sliding Window Metrics)
    participant DB as PostgreSQL
    
    A->>C: GET /api/admin/ai/status
    C->>S: getSystemStatus()
    S->>R: Đọc bộ đếm RPM, TPM live từ sliding window và active workers
    S-->>C: AiSystemStatusResponse
    C-->>A: 200 OK (Slots, Live Metrics, Quota Cooldown)
    
    Note over A,DB: Admin thêm/sửa/bật tắt API Key & Model
    A->>C: POST /api/admin/ai/keys (AiKeyCreateRequest)
    C->>S: createKey(request)
    S->>DB: Lưu AiKey & AiModel
    S->>S: reloadPool() (Tái nạp toàn bộ slot trong bộ nhớ)
    S->>R: Đồng bộ lại slot counters
    C-->>A: 201 Created
```

---

## 9. Luồng Quản Trị Hệ Thống & Kiểm Duyệt Câu Hỏi (Admin Management & Moderation)
Ánh xạ theo `AdminDashboardController.java`, `AdminUserController.java` và `AdminQuestionModerationController.java`.

```mermaid
sequenceDiagram
    participant A as Admin
    participant D as AdminDashboardController
    participant U as AdminUserController
    participant M as AdminQuestionModerationController
    participant DB as PostgreSQL
    
    A->>D: GET /api/admin/dashboard
    D->>DB: Query Aggregation (Users, Exams, Violations, Moderation Stats)
    D-->>A: 200 OK (AdminDashboardResponse)
    
    Note over A,DB: Quản lý người dùng
    A->>U: PATCH /api/admin/users/{id}/toggle-status
    U->>DB: Cập nhật User.isActive = !isActive (Chống tự khóa)
    U-->>A: 200 OK
    
    Note over A,DB: Kiểm duyệt nội dung câu hỏi
    A->>M: GET /api/admin/moderation/questions?isSafe=false
    M->>DB: Lấy danh sách câu hỏi bị gắn cờ vi phạm
    M-->>A: 200 OK (Page<AdminQuestionModerationResponse>)
    
    alt Admin can thiệp thủ công
        A->>M: PATCH /api/admin/moderation/questions/{id}/safety (isSafe: true)
        M->>DB: Cập nhật cờ an toàn
        M-->>A: 200 OK
    else Admin chạy AI quét kiểm duyệt hàng loạt
        A->>M: POST /api/admin/moderation/ai-run
        M-->>A: 202 Accepted (Quét ngầm câu hỏi chưa duyệt qua Gemini)
    end
```
