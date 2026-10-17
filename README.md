# QuickTest ⚡ — AI-Powered Online Exam & Quiz Platform

> **Nền tảng thi trực tuyến nhanh gọn, giám sát vi phạm thời gian thực và hỗ trợ tạo đề & chấm bài tự động bằng AI (Google Gemini Rotation Pool).**

---

## 📌 Tổng quan dự án

**QuickTest** là một dự án cá nhân xây dựng **nền tảng thi trực tuyến** hiện đại, tinh gọn và linh hoạt. Hệ thống tập trung tối ưu hóa trải nghiệm cho giáo viên và học sinh: vào thi tức thì qua mã phòng thi (không bắt buộc đăng ký tài khoản), tự động lưu bài theo thời gian thực (auto-save), cảnh báo vi phạm viễn trắc và ứng dụng mô hình ngôn ngữ lớn (Google Gemini) để hỗ trợ tạo đề thi từ tài liệu cũng như chấm điểm tự luận với chi phí vận hành cực kỳ tối ưu.

```
QuickTest Workspace
├── quick-test/                  # Backend Service (Spring Boot, Java)
├── quick-test-frontend/         # Frontend Client (Next.js 16, Tailwind v4)
├── bruno/                       # Bruno API Test Suite
├── API_ENDPOINTS.md             # Đặc tả chi tiết 70+ RESTful Endpoints
├── quick-test-architecture.md   # Tài liệu Kiến trúc Hệ thống & AI Rotation Engine
└── quick-test-system-flows.md   # Biểu đồ Luồng Nghiệp vụ
```

---

## 🌟 Tính năng nổi bật

### 1. Phân hệ Thí sinh & Phòng thi Chống gian lận (Candidate & Proctoring)
- **Vào thi tức thì (Guest Access):** Không bắt buộc tạo tài khoản, chỉ cần Mã truy cập đề thi (`accessCode`).
- **Phòng thi cưỡng chế Fullscreen:** Tự động phát hiện và cảnh báo vi phạm khi thoát màn hình.
- **Viễn trắc giám sát (Proctoring Telemetry):** Theo dõi chuyển tab (`TAB_SWITCH`), mở công cụ nhà phát triển (`DEVTOOLS_OPEN`), đếm số lần vi phạm và tự động đình chỉ nếu vượt ngưỡng cho phép.
- **Auto-Save Redis Buffering & Server-Sync Timer:** Tự động lưu đáp án sau mỗi thao tác chọn/nhập, đồng hồ đếm ngược đồng bộ chống tua giờ máy khách.

### 2. Phân hệ Giảng viên & Soạn đề Thông minh (Teacher Portal)
- **Soạn thảo đa dạng câu hỏi:** Trắc nghiệm 1 đáp án, nhiều đáp án, câu hỏi số (dung sai sai số $\pm \epsilon$), tự luận kèm biểu điểm Rubric.
- **AI Quiz Generator từ tài liệu (PDF, DOCX, TXT):** Tự động sinh câu hỏi theo độ khó và ngôn ngữ chỉ định với cơ chế Adaptive Multi-Pass & Rotation Continuation vượt giới hạn token Gemini.
- **Trung tâm Giám sát AI Tasks ngầm (`/teacher/ai-tasks`):** Theo dõi tiến độ chạy ngầm, hủy tác vụ hoặc duyệt câu hỏi nạp vào đề thi nháp (`DRAFT`).
- **Chấm thi linh hoạt (Attempt-Centric & Question-Centric):** Hỗ trợ chấm toàn diện hoặc chấm tập trung theo từng câu hỏi, kích hoạt AI chấm tự luận tự động và xuất bảng điểm Excel (`.xlsx`).

### 3. Phân hệ Quản trị viên (Admin Portal)
- **Gemini Rotation Pool Manager (`/admin/ai`):** Quản lý động các API Key và Model slot (`gemini-1.5-flash`, `gemini-2.0-flash-lite`), giám sát Live Metrics Sliding Window RPM/TPM trên Redis.
- **Kiểm duyệt nội dung câu hỏi (`/admin/moderation`):** AI scan quét phát hiện câu hỏi độc hại/nhạy cảm chạy ngầm và cho phép Admin can thiệp thủ công.
- **Nhật ký kiểm toán tập trung (Audit Logs) & Giám sát sức khỏe phần cứng (`/admin/health`):** PostgreSQL, Redis, JVM Uptime, CPU, RAM.

---

## 🛠️ Ngăn xếp công nghệ (Technology Stack)

| Thành phần | Công nghệ chính |
|:---|:---|
| **Backend** | Java 21, Spring Boot 3.4.3, Spring Security 6 (Stateless JWT), Spring Data JPA, Hibernate, WebSocket / STOMP |
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Zustand, Axios |
| **Database & Cache**| PostgreSQL 16 (Relational DB, B-Tree / GIN Indexes), Redis 7 (Token Blacklist, Sliding Window Rate Limit, Distributed Lock, Heartbeats) |
| **AI Integration** | Google Gemini API (1.5 Flash, 2.0 Flash Lite, 1.5 Pro) qua Dynamic Rotation Pool |
| **Object Storage** | Cloudinary API (Lưu trữ hình ảnh câu hỏi & phương án) |
| **API Testing** | Bruno Test Collection (`bruno/`) |

---

## 🚀 Hướng dẫn khởi chạy nhanh (Quick Start)

### Yêu cầu tiên quyết
- **Java:** JDK 21 trở lên
- **Node.js:** v20.x trở lên (khuyên dùng Node LTS)
- **PostgreSQL:** Port 5432 (Database: `quicktest`)
- **Redis Server:** Port 6379

---

### Bước 1: Khởi động Backend

```bash
# Di chuyển vào thư mục backend
cd quick-test

# Cấu hình biến môi trường trong file .env (hoặc application.yml)
# DB_URL, DB_USERNAME, DB_PASSWORD, REDIS_HOST, JWT_SECRET, GEMINI_API_KEYS

# Khởi chạy ứng dụng bằng Maven Wrapper
./mvnw spring-boot:run
```
*Backend sẽ lắng nghe tại: `http://localhost:8080`*  
👉 **Chi tiết xem tại:** [quick-test/README.md](file:///d:/Workspace/QuickTest/quick-test/README.md)

---

### Bước 2: Khởi động Frontend Client

Mở cửa sổ dòng lệnh thứ hai:

```bash
# Di chuyển vào thư mục frontend
cd quick-test-frontend

# Cài đặt thư viện phụ thuộc
npm install

# Khởi chạy môi trường phát triển
npm run dev
```
*Giao diện người dùng sẽ khả dụng tại: `http://localhost:3000`*  
👉 **Chi tiết xem tại:** [quick-test-frontend/README.md](file:///d:/Workspace/QuickTest/quick-test-frontend/README.md)

---

## 🔑 Tài khoản kiểm thử mặc định (Seed Accounts)

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Phân quyền |
|:---|:---|:---|:---|
| **Quản trị viên (ADMIN)** | `admin@quicktest.com` | `Admin@123` | Toàn quyền Quản trị AI Pool, Users, Logs, Moderation |
| **Giáo viên (TEACHER)** | `teacher@quicktest.com` | `Teacher@123` | Soạn đề, AI Quiz, Giám sát, Chấm thi |
| **Sinh viên (STUDENT)** | `student@quicktest.com` | `Student@123` | Làm bài thi, Lịch sử kết quả |

---

## 📚 Tài liệu kỹ thuật chi tiết

- 📖 [Frontend Client Documentation](file:///d:/Workspace/QuickTest/quick-test-frontend/README.md)
- ⚙️ [Backend Service Documentation](file:///d:/Workspace/QuickTest/quick-test/README.md)
- 🔌 [REST API Specification (78+ Endpoints)](file:///d:/Workspace/QuickTest/API_ENDPOINTS.md)
- 🏗️ [Hệ thống Kiến trúc & Cơ chế AI Gemini Pool](file:///d:/Workspace/QuickTest/quick-test-architecture.md)
- 🔄 [Biểu đồ Luồng nghiệp vụ & Viễn trắc thời gian thực](file:///d:/Workspace/QuickTest/quick-test-system-flows.md)
- 🧪 [Bộ kiểm thử tự động Bruno](file:///d:/Workspace/QuickTest/bruno)

---

## 📄 Bản quyền & Giấy phép (License)

Dự án này được phân phối dưới giấy phép **Proprietary & Confidential — All Rights Reserved**.  
Toàn bộ mã nguồn, kiến trúc và tài sản trí tuệ thuộc quyền sở hữu của **Ayana0409 / QuickTest**. Nghiêm cấm sao chép, tái phân phối hoặc thương mại hóa mà không có sự đồng ý bằng văn bản của tác giả.

---

*QuickTest — Built for robust, scalable, and intelligent assessment systems.*
