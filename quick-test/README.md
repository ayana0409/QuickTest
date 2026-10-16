# QuickTest Backend Engine 🚀

> **Core Enterprise REST API & Background Processing Service for the QuickTest Online Exam Platform**  
> Built with **Spring Boot 3.4.3**, **Java 21 LTS**, **PostgreSQL**, **Redis**, **RabbitMQ**, **Google Gemini AI**, and **Cloudinary**.

---

## 📑 Mục lục
- [1. Giới thiệu tổng quan](#1-giới-thiệu-tổng-quan)
- [2. Tính năng cốt lõi (Key Features)](#2-tính-năng-cốt-lõi-key-features)
- [3. Ngăn xếp công nghệ (Technology Stack)](#3-ngăn-xếp-công-nghệ-technology-stack)
- [4. Cấu trúc thư mục (Package-by-Feature Structure)](#4-cấu-trúc-thư-mục-package-by-feature-structure)
- [5. Yêu cầu hệ thống (Prerequisites)](#5-yêu-cầu-hệ-thống-prerequisites)
- [6. Hướng dẫn cài đặt & Khởi chạy (Getting Started)](#6-hướng-dẫn-cài-đặt--khởi-chạy-getting-started)
- [7. Biến môi trường & Cấu hình (Environment Variables)](#7-biến-môi-trường--cấu-hình-environment-variables)
- [8. Tài liệu API & Kiểm thử (API Documentation & Bruno Testing)](#8-tài-liệu-api--kiểm-thử-api-documentation--bruno-testing)
- [9. Tài khoản mặc định (Default Seed Accounts)](#9-tài-khoản-mặc-định-default-seed-accounts)

---

## 1. Giới thiệu tổng quan

**QuickTest Backend Engine** là hệ thống máy chủ cung cấp toàn bộ API, logic nghiệp vụ, hàng đợi xử lý bất đồng bộ và cơ chế bảo mật cho nền tảng thi trực tuyến QuickTest. Hệ thống được thiết kế theo kiến trúc **Package-by-Feature Modular Monolith**, tối ưu hóa hiệu năng cao, chịu tải lớn khi hàng ngàn thí sinh nộp bài cùng lúc, tích hợp công nghệ AI tiên tiến phục vụ soạn đề và chấm thi tự động.

---

## 2. Tính năng cốt lõi (Key Features)

### 🔐 1. Xác thực & Phân quyền (IAM & Security)
- **Chuẩn JWT HMAC-SHA256:** Quản lý phiên làm việc không trạng thái (Stateless Authentication).
- **Phân quyền dựa trên vai trò (RBAC):** `ROLE_STUDENT`, `ROLE_TEACHER`, `ROLE_ADMIN`.
- **Thí sinh vãng lai (Guest Mode):** Cho phép thí sinh không cần tài khoản tham gia làm bài thi chỉ với Tên, Mã định danh (MSSV/SĐT/Email) và Mã truy cập phòng thi (`accessCode`).
- **Sẵn sàng kết nối Single Sign-On (SSO):** Đóng vai trò OAuth2/OIDC Resource Server, tương thích với ABP Framework / OpenIddict.

### 📝 2. Quản lý Đề thi & Ngân hàng câu hỏi (Exams & Question Bank)
- **Hỗ trợ 4 loại câu hỏi chuẩn sư phạm:**
  1. `SINGLE_CHOICE`: Trắc nghiệm 1 đáp án đúng (tự động chấm điểm).
  2. `MULTIPLE_CHOICE`: Trắc nghiệm nhiều đáp án đúng (chấm điểm tuyệt đối hoặc từng phần).
  3. `NUMERIC`: Điền số chính xác (hỗ trợ kiểm tra dung sai sai số $\pm \epsilon$).
  4. `ESSAY_TEXT`: Tự luận văn bản (hỗ trợ Rubric chấm điểm và đáp án mẫu).
- **Đính kèm đa phương tiện:** Tải ảnh câu hỏi và từng phương án đáp án trực tiếp lên **Cloudinary**.
- **Ngân hàng câu hỏi cá nhân:** Tìm kiếm toàn văn (PostgreSQL FTS), lọc theo chủ đề và import câu hỏi sang đề thi mới (deep copy dữ liệu và ảnh).
- **Nhân bản đề thi:** Clone đề thi bản nháp bất đồng bộ qua RabbitMQ.

### ⏱️ 3. Phiên thi & Viễn trắc chống gian lận (Session & Proctoring)
- **Bộ đệm lưu nháp Redis Hash:** Tự động lưu từng câu trả lời của thí sinh vào Redis, giảm tải 95% áp lực ghi trực tiếp xuống PostgreSQL trong giờ cao điểm.
- **Server-Side Countdown Timer:** Đếm ngược thời gian làm bài an toàn từ server, ngăn chặn hành vi chỉnh sửa đồng hồ trình duyệt của thí sinh.
- **Viễn trắc giám sát gian lận thời gian thực (Telemetry & Heartbeat):**
  - Ghi nhận vi phạm: Chuyển tab (`TAB_SWITCH`), thoát toàn màn hình (`EXIT_FULLSCREEN`), mở F12/Inspect (`DEVTOOLS_OPEN`), không có mặt / nhiều khuôn mặt trước camera.
  - Tự động đình chỉ thi (`disqualify`) nếu vượt ngưỡng vi phạm tối đa cho phép.
  - Giáo viên theo dõi danh sách phòng thi live và chỉ số tập trung của từng học sinh.

### 🤖 4. Phân hệ Trí tuệ Nhân tạo (Google Gemini AI Engine)
- **Hệ thống Xoay vòng Khóa AI Thông minh (Gemini Rotation Pool):**
  - Quản lý đa khóa API Key và đa model (`gemini-1.5-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-pro`) linh hoạt từ Database.
  - Theo dõi hạn mức RPM/TPM theo thời gian thực qua cơ chế **Redis Sliding Window**.
  - Tự động xoay sang slot kế tiếp khi gặp lỗi HTTP 429 (Rate Limit) hoặc máy chủ Google quá tải (HTTP 5xx).
- **Tự động chấm thi tự luận bằng AI (AI Essay Grading):**
  - Hàng đợi xử lý đơn luồng bất đồng bộ (`aiGradingExecutor`) kết hợp khóa phân tán Redis `EXAM_LOCK` chống xung đột.
  - Tính toán ngân sách token động (`Optimal Token Budgeting`), chia đợt chấm an toàn (tối đa 25 bài/batch).
  - So khớp bài làm với đáp án mẫu và Rubric, trả về điểm số đề xuất (`aiSuggestedScore`), độ tương đồng ngữ nghĩa (`aiSimilarityScore`) và giải thích sư phạm chi tiết (`aiGradingExplanation`).
- **Soạn đề thi tự động từ tài liệu (AI Document-to-Exam Generator):**
  - Trích xuất tệp PDF, Word (DOCX), Text (TXT) qua Apache PDFBox & Apache POI.
  - Cơ chế **Adaptive Multi-Pass & Rotation Continuation**: Chia đợt tạo an toàn (tối đa 15 câu/lượt để không chạm trần 8,192 tokens của Gemini), tự động xoay API key, prompt chống trùng lặp, graceful fallback giữ trọn vẹn câu hỏi hoàn chỉnh.
  - Giáo viên xem trước, chỉnh sửa và commit trực tiếp vào đề thi.
- **Kiểm duyệt nội dung câu hỏi (AI Question Content Moderation):**
  - Quét nền hàng loạt câu hỏi chưa kiểm duyệt, tự động phát hiện và gắn cờ câu hỏi vi phạm tiêu chuẩn cộng đồng.

### 📊 5. Chấm thi linh hoạt & Quản trị hệ thống (Grading & Admin Management)
- **Mô hình chấm thi đa dạng:**
  - *Attempt-Centric:* Chấm theo từng bài thi của học sinh.
  - *Question-Centric:* Chấm tập trung theo từng câu hỏi cho toàn bộ học sinh để đảm bảo tính công bằng và tốc độ chấm nhanh.
- **Xuất báo cáo Excel (.xlsx):** Xuất bảng điểm tổng quan phòng thi và chi tiết từng bài làm học sinh bằng Apache POI.
- **Giám sát tác vụ AI ngầm (`/teacher/ai-tasks`):** Lưu vết snapshot tiến trình 48 giờ trên Redis, cập nhật phần trăm và bước thực thi thời gian thực.
- **Centralized Audit Logging (`system_logs`):** Ghi vết kiểm toán tự động qua `@AuditLog` AOP (IP, User Agent, Execution Time, Payload, Stacktrace).
- **Admin System Health & Metrics:** Giám sát trạng thái kết nối PostgreSQL, Redis, CPU, RAM, Disk, JVM Uptime qua OSHI & Spring Actuator.

---

## 3. Ngăn xếp công nghệ (Technology Stack)

| Thành phần | Công nghệ / Thư viện | Vai trò |
|:---|:---|:---|
| **Core Framework** | Spring Boot 3.4.3 (Java 21 LTS) | Khung ứng dụng REST API & Micro-services |
| **Persistence** | Spring Data JPA / Hibernate 6.x | Tương tác cơ sở dữ liệu quan hệ, Optimistic Locking |
| **Database** | PostgreSQL 15+ | Cơ sở dữ liệu chính, hỗ trợ Full-Text Search FTS |
| **In-Memory Cache** | Redis 7.x (Spring Data Redis) | Session cache, Timer, Distributed Lock, Token metrics, AI Task Snapshot |
| **Messaging** | RabbitMQ / Spring AMQP | Hàng đợi tin nhắn nộp bài và sao chép ảnh bất đồng bộ |
| **AI Integration** | Google Gemini API (1.5 Flash, 2.0 Flash) | Phân tích bài giảng, tạo câu hỏi đề thi và chấm điểm tự luận |
| **Security** | Spring Security 6.x, JJWT 0.12.6 | Xác thực Bearer JWT, phân quyền RBAC |
| **Media Storage** | Cloudinary Java SDK 1.38.0 | Lưu trữ đám mây hình ảnh câu hỏi & đáp án |
| **Office/PDF Parser**| Apache POI 5.3.0, Apache PDFBox 3.0.4 | Trích xuất file Word/PDF và xuất báo cáo Excel |
| **System Diagnostics**| OSHI 6.4.13, Spring Boot Actuator | Giám sát phần cứng, RAM, Disk, Uptime |

---

## 4. Cấu trúc thư mục (Package-by-Feature Structure)

```text
com.quicktest
├── config/                         # Cấu hình Security, Redis, WebSocket, RabbitMQ, GeminiPoolProperties
├── core/                           # Thành phần hạ tầng dùng chung toàn hệ thống
│   ├── common/                     # ApiResponse, PageResponse
│   ├── exception/                  # GlobalExceptionHandler, AppException, ResourceNotFoundException
│   ├── logging/                    # Centralized Audit Logging (@AuditLog, SystemLogService, SystemLogServiceImpl)
│   ├── security/                   # JwtAuthenticationFilter, UserDetailsImpl, CustomAccessDeniedHandler
│   ├── service/                    # GeminiRotationService, GeminiModelSlot, AiMetricsRedisService
│   └── utils/                      # Tiện ích mã hóa, chuỗi, thời gian, toán học
├── modules/                        # Phân rã nghiệp vụ theo module độc lập
│   ├── admin/                      # Quản trị hệ thống, người dùng, kỳ thi, logs và AI Pool
│   │   ├── controller/             # AdminAiController, AdminQuestionModerationController, AdminSystemHealthController...
│   │   ├── dto/                    # Các DTO quản trị AI, kiểm duyệt, logs, user, stats
│   │   ├── entity/                 # AiKey, AiModel, SystemLog
│   │   ├── repository/             # AiKeyRepository, AiModelRepository, SystemLogRepository
│   │   └── service/                # AdminAiService, AdminQuestionModerationService, AdminSystemHealthService...
│   ├── assessment/                 # Ngân hàng đề, câu hỏi, media và AI Document Generator
│   │   ├── ai/                     # Phân hệ Soạn đề AI & Giám sát tác vụ ngầm
│   │   │   ├── controller/         # AiGenerateController, TeacherAiTaskController
│   │   │   ├── dto/                # AiGenerateQuizRequest, AiGeneratedQuestionDto, TeacherAiTaskDto...
│   │   │   └── service/            # AiGenerateService, AiQuizGeneratorService, TeacherAiTaskService, DocumentParserService, AiQuizGeneratorAsyncWorker
│   │   ├── controller/             # ExamController, QuestionController, TeacherMediaController, QuestionGradingController
│   │   ├── dto/                    # ExamCreateRequest, QuestionRequest, AnswerOptionDto...
│   │   ├── entity/                 # Exam, ExamStatus, Question, QuestionType, AnswerOption
│   │   ├── repository/             # ExamRepository, QuestionRepository, AnswerOptionRepository
│   │   └── service/                # ExamService, QuestionService, QuestionGradingService, CloudinaryStorageService
│   ├── iam/                        # Xác thực & Quản lý danh tính
│   │   ├── controller/             # AuthController
│   │   ├── dto/                    # LoginRequest, RegisterRequest, AuthResponse
│   │   ├── entity/                 # User, Role, AuthProvider
│   │   ├── repository/             # UserRepository
│   │   └── service/                # AuthService
│   ├── proctoring/                 # Viễn trắc giám sát & phát hiện gian lận
│   │   ├── controller/             # CandidateProctoringController, TeacherProctoringController
│   │   ├── dto/                    # ViolationTelemetryDto, CandidateHeartbeatDto
│   │   ├── entity/                 # ViolationLog, ViolationType
│   │   ├── repository/             # ViolationLogRepository
│   │   ├── service/                # ProctoringService
│   │   └── websocket/              # ProctoringWebSocketHandler
│   └── session/                    # Phiên làm bài thi, nộp bài & chấm thi
│       ├── controller/             # ExamSessionController, StudentAttemptController, TeacherGradingController
│       ├── dto/                    # StartSessionRequest, SaveAnswerDto, SubmitGradesRequest
│       ├── entity/                 # ExamAttempt, AttemptStatus, CandidateAnswer, GradingStatus
│       ├── repository/             # ExamAttemptRepository, CandidateAnswerRepository
│       └── service/                # ExamSessionService, GradingService, QuestionGradingAsyncWorker, RedisSessionService
└── QuickTestApplication.java       # Main Spring Boot Entry Point
```

---

## 5. Yêu cầu hệ thống (Prerequisites)

- **Java Development Kit (JDK):** Phiên bản **Java 21 LTS** trở lên.
- **Apache Maven:** 3.9+ (hoặc dùng Maven Wrapper `./mvnw` đính kèm sẵn trong mã nguồn).
- **PostgreSQL Database:** Phiên bản 15+ (tạo sẵn database tên `quick_test_db`).
- **Redis Server:** Phiên bản 7+ (port mặc định `6379`).
- **RabbitMQ:** Phiên bản 3.12+ (port `5672`, tùy chọn bật web management `15672`).
- **API Keys:**
  - Google Gemini API Key (lấy miễn phí tại [Google AI Studio](https://aistudio.google.com/)).
  - Cloudinary credentials (tùy chọn để lưu trữ hình ảnh).

---

## 6. Hướng dẫn cài đặt & Khởi chạy (Getting Started)

### Bước 1: Chuẩn bị mã nguồn
```bash
# Điều hướng vào thư mục backend
cd quick-test
```

### Bước 2: Tạo tệp cấu hình môi trường
Sao chép tệp cấu hình mẫu:
```bash
cp src/main/resources/application.properties.example src/main/resources/application.properties
```
Mở file `src/main/resources/application.properties` và cập nhật thông tin kết nối Database, Redis và Gemini API Key của bạn.

### Bước 3: Biên dịch dự án
```bash
# Trên Linux/macOS
./mvnw clean compile

# Trên Windows (PowerShell)
.\mvnw.cmd clean compile
```

### Bước 4: Chạy kiểm thử tự động (Unit & Integration Tests)
```bash
# Chạy toàn bộ test suites
.\mvnw.cmd test

# Chạy riêng biệt test phân hệ AI
.\mvnw.cmd test -Dtest=AiQuizGeneratorServiceTest
```

### Bước 5: Khởi động ứng dụng
```bash
# Chạy trực tiếp qua Spring Boot Maven Plugin
.\mvnw.cmd spring-boot:run

# Hoặc đóng gói thành JAR và thực thi
.\mvnw.cmd clean package -DskipTests
java -jar target/quick-test-0.0.1-SNAPSHOT.jar
```
Server sẽ khởi động tại: `http://localhost:8080/api`

---

## 7. Biến môi trường & Cấu hình (Environment Variables)

Hệ thống hỗ trợ ghi đè cấu hình linh hoạt thông qua các biến môi trường:

| Tên biến môi trường | Giá trị mặc định | Mô tả |
|:---|:---|:---|
| `SERVER_PORT` | `8080` | Cổng HTTP của ứng dụng |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/quick_test_db` | URL kết nối PostgreSQL |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | Tài khoản cơ sở dữ liệu |
| `SPRING_DATASOURCE_PASSWORD` | `your_password` | Mật khẩu cơ sở dữ liệu |
| `SPRING_DATA_REDIS_HOST` | `localhost` | Địa chỉ máy chủ Redis |
| `SPRING_DATA_REDIS_PORT` | `6379` | Cổng máy chủ Redis |
| `SPRING_RABBITMQ_HOST` | `localhost` | Địa chỉ máy chủ RabbitMQ |
| `SPRING_RABBITMQ_PORT` | `5672` | Cổng máy chủ RabbitMQ |
| `APP_JWT_SECRET` | *(256-bit Hex Key)* | Khóa bí mật ký mã hóa JWT token |
| `APP_JWT_EXPIRATION_MS` | `86400000` (24 giờ) | Thời gian sống của Access Token |
| `GEMINI_API_KEY` | `""` | Khóa API Google Gemini dự phòng (Env fallback) |
| `CLOUDINARY_CLOUD_NAME` | `""` | Tên Cloudinary Cloud Name |
| `CLOUDINARY_API_KEY` | `""` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | `""` | Cloudinary API Secret |

---

## 8. Tài liệu API & Kiểm thử (API Documentation & Bruno Testing)

### 📖 1. Tài liệu đặc tả API chuẩn
- Xem tài liệu đặc tả chi tiết toàn bộ **78+ Endpoints** tại: [API_ENDPOINTS.md](../API_ENDPOINTS.md).
- Xem sơ đồ luồng nghiệp vụ hệ thống (Mermaid Sequence Diagrams) tại: [quick-test-system-flows.md](../quick-test-system-flows.md).
- Xem tài liệu thiết kế kỹ thuật kiến trúc toàn diện tại: [quick-test-architecture.md](../quick-test-architecture.md).

### 🧪 2. Bộ kiểm thử API Bruno Collection
Toàn bộ API của QuickTest được đóng gói sẵn trong thư mục `../bruno/` với 14 bộ sưu tập có sẵn script đăng nhập tự động và assertions:
1. `01-Auth-IAM`: Đăng ký, đăng nhập, lấy thông tin cá nhân.
2. `02-Teacher-Exams`: Tạo đề, xuất bản, đóng đề, nhân bản, xóa đề thi.
3. `03-Teacher-Questions`: Thêm, sửa, xóa, tìm kiếm FTS ngân hàng câu hỏi.
4. `04-Candidate-Session`: Bắt đầu thi, auto-save nháp vào Redis, nộp bài, xem kết quả.
5. `05-Teacher-Grading`: Lấy bài nộp, chấm điểm, xuất Excel danh sách bài thi và bài thi lẻ.
6. `06-Proctoring`: Giám sát thí sinh realtime, báo cáo vi phạm, heartbeat, đình chỉ thi.
7. `07-Media-Upload`: Upload ảnh câu hỏi đơn lẻ và hàng loạt qua Cloudinary.
8. `08-Question-Centric-Grading`: Chấm bài tập trung theo từng câu hỏi, trigger AI chấm tự luận.
9. `09-Admin-Management`: Quản trị User, Exam, System Logs FTS, System Health.
10. `10-Student-History`: Tra cứu lịch sử thi, xem lại bài làm chi tiết của sinh viên.
11. `11-Rate-Limiting`: Kiểm thử giới hạn tần suất yêu cầu HTTP 429.
12. `12-Teacher-Ai-Quiz-Generation`: Tạo đề thi ngầm từ file/text, poll tiến độ, commit câu hỏi.
13. `13-Teacher-Ai-Tasks-Monitor`: Giám sát tiến trình AI, hủy task, xóa lịch sử task 48h.
14. `14-Admin-Ai-Management`: Thống kê live metrics (RPM/TPM), CRUD AI Keys, reload pool, hủy jobs.

### 🩺 3. Kiểm tra sức khỏe hệ thống (Health Check)
```http
GET http://localhost:8080/api/actuator/health
GET http://localhost:8080/api/admin/system/health
```

---

## 9. Tài khoản mặc định (Default Seed Accounts)

Sau khi khởi chạy ứng dụng lần đầu với cơ sở dữ liệu đã nạp sẵn dữ liệu khởi tạo (seed data), bạn có thể sử dụng các tài khoản sau để kiểm thử:

| Vai trò | Email đăng nhập | Tên người dùng | Mật khẩu mặc định |
|:---|:---|:---|:---|
| **Quản trị viên (ADMIN)** | `admin@quicktest.com` | `admin` | `Admin@123` |
| **Giáo viên (TEACHER)** | `teacher@quicktest.com` | `teacher` | `Teacher@123` |
| **Sinh viên (STUDENT)** | `student@quicktest.com` | `student` | `Student@123` |

---

*QuickTest Engine — Developed with excellence.*
