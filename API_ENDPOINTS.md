# QuickTest Online Exam System - Comprehensive API Documentation

Tài liệu đặc tả toàn bộ **118+ RESTful Endpoints & WebSocket Protocols** của hệ thống thi trực tuyến **QuickTest** (Spring Boot 3.x, PostgreSQL Full-Text Search, Redis, RabbitMQ, Cloudinary, Google Gemini AI, Centralized Audit Logging).

---

## I. Quy Chuẩn Chung (Common Standards)

### 1. Base URL
```http
http://localhost:8080
```

### 2. Định dạng phản hồi chuẩn (`ApiResponse<T>`)
Tất cả các API đều bọc dữ liệu trả về trong cấu trúc chuẩn:
```json
{
  "status": 200,
  "message": "Success message description",
  "data": { ... },
  "timestamp": "2026-09-12T12:00:00.000"
}
```

### 3. Cấu trúc phân trang chuẩn (`PageResponse<T>`)
Đối với các endpoint có phân trang:
```json
{
  "content": [ ... ],
  "pageNumber": 0,
  "pageSize": 10,
  "totalElements": 42,
  "totalPages": 5,
  "last": false
}
```

### 4. Cơ chế xác thực (Authentication)
- Sử dụng **Bearer Token** (JWT) trong header:
  ```http
  Authorization: Bearer <access_token>
  ```
- Phân quyền theo Role:
  - `PUBLIC`: Không yêu cầu token.
  - `STUDENT`: Thí sinh đã đăng ký.
  - `TEACHER`: Giáo viên / Giảng viên tạo đề và chấm thi.
  - `GUEST`: Thí sinh tự do làm bài không cần tài khoản, định danh qua query param `guestIdentifier` hoặc header `X-Guest-Identifier`.

---

## II. Bảng Tra Cứu Nhanh (API Cheat Sheet)

| # | Nhóm chức năng | Method | Endpoint | Quyền hạn | Mô tả chức năng |
|:---|:---|:---:|:---|:---:|:---|
| 1 | **IAM & Auth** | `POST` | `/api/auth/register` | `PUBLIC` | Đăng ký tài khoản mới (STUDENT hoặc TEACHER) |
| 2 | | `POST` | `/api/auth/login` | `PUBLIC` | Đăng nhập hệ thống & nhận JWT Access / Refresh Token |
| 3 | | `GET` | `/api/auth/me` | Authenticated | Lấy hồ sơ tài khoản hiện tại |
| 4 | | `POST` | `/api/auth/refresh` | `PUBLIC` | Cấp mới Access Token bằng Refresh Token |
| 5 | | `POST` | `/api/auth/sso/quickbite` | `PUBLIC` | Xác thực / cấp tài khoản tự động qua QuickBite Access Token |
| 6 | | `POST` | `/api/auth/sso/quickbite/login` | `PUBLIC` | Đăng nhập trực tiếp bằng tài khoản QuickBite (Resource Owner flow) |
| 7 | | `POST` | `/api/auth/sso/quickbite/code` | `PUBLIC` | Trao đổi Authorization Code lấy token QuickTest (OIDC Redirect flow) |
| 8 | | `PUT` | `/api/auth/profile` | Authenticated | Cập nhật thông tin cá nhân (họ tên) của tài khoản hiện tại |
| 9 | | `PUT` | `/api/auth/password` | Authenticated | Đổi mật khẩu tài khoản hiện tại |
| 10 | **Teacher Exams & Dashboard** | `GET` | `/api/teacher/dashboard` | `TEACHER` | Dashboard tổng quan KPI, tiến độ giảng dạy, đề thi ưu tiên & cảnh báo |
| 11 | | `POST` | `/api/teacher/exams` | `TEACHER` | Tạo đề thi mới (DRAFT) |
| 12 | | `GET` | `/api/teacher/exams` | `TEACHER` | Lấy danh sách đề thi của giáo viên (phân trang, lọc theo trạng thái/mã truy cập) |
| 13 | | `GET` | `/api/teacher/exams/{id}` | `TEACHER` | Lấy chi tiết cấu hình và danh sách câu hỏi đề thi |
| 14 | | `PUT` | `/api/teacher/exams/{id}` | `TEACHER` | Cập nhật thông tin đề thi (cho phép cả khi CLOSED) |
| 15 | | `PATCH` | `/api/teacher/exams/{id}/publish` | `TEACHER` | Xuất bản đề thi (từ DRAFT hoặc CLOSED -> PUBLISHED) |
| 16 | | `PATCH` | `/api/teacher/exams/{id}/close` | `TEACHER` | Đóng đề thi (CLOSED) & tự động thu các bài dở dang |
| 17 | | `PATCH` | `/api/teacher/exams/{id}/republish` | `TEACHER` | Mở lại đề thi đã đóng (cập nhật hạn chót, chuyển sang PUBLISHED) |
| 18 | | `POST` | `/api/teacher/exams/{id}/duplicate` | `TEACHER` | Nhân bản đề thi sang bản nháp mới (bất đồng bộ sao chép ảnh qua RabbitMQ) |
| 19 | | `DELETE` | `/api/teacher/exams/{id}` | `TEACHER` | Xóa đề thi (chỉ xóa DRAFT) |
| 20 | **Questions & Bank** | `POST` | `/api/teacher/exams/{examId}/questions` | `TEACHER` | Thêm câu hỏi vào đề thi (dữ liệu JSON) |
| 21 | | `POST` | `/api/teacher/exams/{examId}/questions/with-media` | `TEACHER` | Thêm câu hỏi kèm tải lên tệp ảnh trực tiếp (multipart/form-data) |
| 22 | | `PUT` | `/api/teacher/questions/{questionId}` | `TEACHER` | Cập nhật câu hỏi và đáp án (dữ liệu JSON) |
| 23 | | `PUT` | `/api/teacher/questions/{questionId}/with-media` | `TEACHER` | Cập nhật câu hỏi kèm tải lên tệp ảnh trực tiếp (multipart/form-data) |
| 24 | | `PUT` | `/api/teacher/questions/{questionId}/image` | `TEACHER` | Cập nhật trực tiếp ảnh câu hỏi (xóa ảnh cũ Cloudinary) |
| 25 | | `DELETE` | `/api/teacher/questions/{questionId}` | `TEACHER` | Xóa câu hỏi (tự động dọn ảnh câu hỏi + đáp án trên Cloudinary) |
| 26 | | `GET` | `/api/teacher/question-bank` | `TEACHER` | Lấy ngân hàng câu hỏi của giáo viên (phân trang, lọc theo đề/từ khóa FTS) |
| 27 | | `POST` | `/api/teacher/exams/{examId}/questions/import` | `TEACHER` | Nhập câu hỏi từ ngân hàng vào đề thi (deep copy dữ liệu & ảnh) |
| 28 | **Media Upload** | `POST` | `/api/teacher/media/upload` | `TEACHER` | Upload 1 file ảnh đồng bộ lên Cloudinary |
| 29 | | `POST` | `/api/teacher/media/batch-upload` | `TEACHER` | Upload hàng loạt ảnh chạy nền (Async RabbitMQ) |
| 30 | | `GET` | `/api/teacher/media/batch/{batchId}/status` | `TEACHER` | Kiểm tra tiến độ upload batch & lấy danh sách URL |
| 31 | **Candidate Session** | `GET` | `/api/public/exams` | `PUBLIC` | Khám phá tối đa 10 đề thi công khai mở tự do trên trang chủ (Redis Cache 60s) |
| 32 | | `POST` | `/api/session/start` | All (Student/Guest) | Bắt đầu hoặc khôi phục lượt thi, nhận đề thi masked |
| 33 | | `PUT` | `/api/session/{attemptId}/save` | All (Student/Guest) | Auto-save câu trả lời đơn lẻ vào Redis Hash |
| 34 | | `GET` | `/api/session/{attemptId}/resume` | All (Student/Guest) | Khôi phục bài làm kèm danh sách nháp đã lưu trong Redis |
| 35 | | `POST` | `/api/session/{attemptId}/submit` | All (Student/Guest) | Nộp bài thi bất đồng bộ qua RabbitMQ (202 Accepted) |
| 36 | | `GET` | `/api/session/{attemptId}/result` | All (Student/Guest) | Xem kết quả điểm số và trạng thái chấm bài |
| 37 | **Candidate Proctoring** | `GET` | `/api/session/{attemptId}/proctoring/upload-signature` | All (Student/Guest) | Lấy chữ ký ủy quyền upload thẳng ảnh bằng chứng lên Cloudinary từ client |
| 38 | | `POST` | `/api/session/{attemptId}/proctoring/violation` | All (Student/Guest) | Ingestion báo cáo vi phạm viễn trắc thông lượng cao (<1ms, Redis buffer) |
| 39 | | `POST` | `/api/session/proctoring/violations` | All (Student/Guest) | Báo cáo sự kiện vi phạm viễn trắc tổng quát |
| 40 | | `POST` | `/api/session/proctoring/heartbeat` | All (Student/Guest) | Gửi tín hiệu heartbeat giữ phiên làm bài active |
| 41 | **Teacher Proctoring** | `GET` | `/api/teacher/proctoring/exams/{examId}/attempts` | `TEACHER` | Giám sát thí sinh phòng thi theo thời gian thực (alias `/monitoring`) |
| 42 | | `GET` | `/api/teacher/proctoring/exams/{examId}/realtime-token` | `TEACHER` | Lấy vé JWT giám sát thời gian thực & địa chỉ QuickNotify Go Hub |
| 43 | | `GET` | `/api/teacher/proctoring/attempts/{attemptId}/violations` | `TEACHER` | Xem nhật ký kiểm toán (audit log) vi phạm của thí sinh |
| 44 | | `GET` | `/api/teacher/proctoring/attempts/{attemptId}/violations/detailed` | `TEACHER` | Xem chi tiết vi phạm kèm phân tích nguồn dữ liệu (Redis vs Postgres) |
| 45 | | `GET` | `/api/teacher/proctoring/attempts/{attemptId}/status` | `TEACHER` | Xem trạng thái viễn trắc, heartbeat, tỷ lệ tập trung |
| 46 | | `POST` | `/api/teacher/proctoring/attempts/{attemptId}/disqualify` | `TEACHER` | Đình chỉ thi cưỡng chế thí sinh vi phạm |
| 47 | **Attempt Grading** | `GET` | `/api/teacher/grading/exams/{examId}/attempts` | `TEACHER` | Lấy danh sách bài nộp cần chấm theo đề thi |
| 48 | | `GET` | `/api/teacher/grading/exams/{examId}/stats` | `TEACHER` | Lấy thống kê tổng quan các phiên thi (điểm, thời gian, vi phạm) |
| 49 | | `GET` | `/api/teacher/grading/exams/{examId}/attempts/export-excel` | `TEACHER` | Xuất file Excel (.xlsx) danh sách phiên thi đầy đủ thông tin |
| 50 | | `GET` | `/api/teacher/grading/attempts/{attemptId}` | `TEACHER` | Xem chi tiết bài làm của 1 thí sinh để chấm |
| 51 | | `GET` | `/api/teacher/grading/attempts/{attemptId}/export-excel` | `TEACHER` | Xuất file Excel (.xlsx) bài làm riêng lẻ kèm điểm từng câu & feedback |
| 52 | | `POST` | `/api/teacher/grading/attempts/submit-grades` | `TEACHER` | Lưu điểm các câu tự luận của 1 bài thi |
| 53 | **Question Grading** | `GET` | `/api/teacher/grading/exams/{examId}/questions` | `TEACHER` | Danh sách câu hỏi tự luận cần chấm (thống kê tiến độ) |
| 54 | | `GET` | `/api/teacher/grading/questions/{questionId}/submissions` | `TEACHER` | Xem biểu điểm và bài làm học sinh theo câu hỏi |
| 55 | | `POST` | `/api/teacher/grading/questions/{questionId}/manual` | `TEACHER` | Chấm tay hàng loạt/lẻ theo câu hỏi (tính điểm tự động) |
| 56 | | `POST` | `/api/teacher/grading/answers/{candidateAnswerId}/ai` | `TEACHER` | Chấm tự động 1 câu trả lời tự luận đơn lẻ bằng Google Gemini AI |
| 57 | | `POST` | `/api/teacher/grading/trigger-ai` | `TEACHER` | Kích hoạt Google Gemini chấm tự động theo batch (202 Accepted) |
| 58 | **Admin Dashboard** | `GET` | `/api/admin/dashboard` | `ADMIN` | Xem thống kê toàn hệ thống & nhật ký vi phạm gần nhất (alias `/overview`, `/analytics`) |
| 59 | **Admin Users** | `GET` | `/api/admin/users` | `ADMIN` | Lấy danh sách tài khoản (lọc role, isActive, search FTS) |
| 60 | | `GET` | `/api/admin/users/{id}` | `ADMIN` | Xem chi tiết thông tin tài khoản |
| 61 | | `POST` | `/api/admin/users` | `ADMIN` | Tạo tài khoản người dùng mới trực tiếp với bất kỳ vai trò nào |
| 62 | | `PUT` | `/api/admin/users/{id}/profile` | `ADMIN` | Cập nhật thông tin hồ sơ người dùng (họ tên, email, username) |
| 63 | | `PUT` | `/api/admin/users/{id}/password` | `ADMIN` | Đặt lại mật khẩu trực tiếp cho người dùng |
| 64 | | `PATCH` | `/api/admin/users/{id}/toggle-status` | `ADMIN` | Kích hoạt / Vô hiệu hóa tài khoản (chống tự khóa) |
| 65 | | `PATCH` | `/api/admin/users/{id}/role` | `ADMIN` | Phân quyền vai trò người dùng (chống tự hạ quyền) |
| 66 | **Admin Exams** | `GET` | `/api/admin/exams` | `ADMIN` | Quản lý danh sách toàn bộ đề thi của tất cả giáo viên |
| 67 | | `GET` | `/api/admin/exams/{id}` | `ADMIN` | Xem chi tiết đề thi và câu hỏi |
| 68 | | `PATCH` | `/api/admin/exams/{id}/close` | `ADMIN` | Đóng khẩn cấp đề thi đang mở |
| 69 | | `DELETE` | `/api/admin/exams/{id}` | `ADMIN` | Xóa đề thi (chỉ DRAFT/CLOSED và chưa có lượt thi) |
| 70 | **Student Dashboard & History** | `GET` | `/api/student/dashboard` | `STUDENT` | Thống kê tổng quan học tập, điểm TB, bài thi của tôi & bài thi khám phá |
| 71 | | `GET` | `/api/student/attempts` | `STUDENT` | Lấy danh sách lịch sử thi phân trang của sinh viên |
| 72 | | `GET` | `/api/student/attempts/{attemptId}` | `STUDENT` | Xem chi tiết bài làm, điểm từng câu, đáp án & vi phạm quy chế |
| 73 | **Admin System Logs** | `GET` | `/api/admin/logs` | `ADMIN` | Tìm kiếm FTS & Lọc nhật ký đa tiêu chí (alias `/api/v1/admin/logs`) |
| 74 | | `GET` | `/api/admin/logs/{id}` | `ADMIN` | Xem chi tiết nhật ký kiểm toán, Payload JSON và Stacktrace |
| 75 | | `GET` | `/api/admin/logs/stats` | `ADMIN` | Thống kê phân tích KPI nhật ký, tỉ lệ lỗi và độ trễ |
| 76 | | `GET` | `/api/admin/logs/metadata` | `ADMIN` | Lấy danh mục distinct module & action phục vụ lọc động |
| 77 | | `DELETE` | `/api/admin/logs/cleanup` | `ADMIN` | Kích hoạt dọn dẹp nhật ký cũ ngầm theo chu kỳ ngày lưu trữ retention |
| 78 | | `GET` | `/api/admin/logs/cleanup/status` | `ADMIN` | Kiểm tra tiến độ và trạng thái tiến trình dọn dẹp nhật ký ngầm |
| 79 | **Teacher AI Quiz Gen** | `POST` | `/api/teacher/ai-generate/from-document` | `TEACHER` | Đưa tài liệu/văn bản vào hàng đợi AI soạn đề thi ngầm (202 Accepted) |
| 80 | | `GET` | `/api/teacher/ai-generate/jobs/{jobId}` | `TEACHER` | Kiểm tra tiến độ và danh sách câu hỏi xem trước của job tạo đề |
| 81 | | `POST` | `/api/teacher/ai-generate/jobs/{jobId}/cancel` | `TEACHER` | Hủy tiến trình tạo đề thi ngầm và giải phóng khóa tài khoản |
| 82 | | `POST` | `/api/teacher/ai-generate/commit-to-exam/{examId}` | `TEACHER` | Lưu các câu hỏi AI đã duyệt trực tiếp vào đề thi |
| 83 | **Teacher AI Tasks** | `GET` | `/api/teacher/ai-tasks` | `TEACHER` | Lấy danh sách tác vụ AI ngầm của giáo viên (soạn đề & chấm thi) |
| 84 | | `GET` | `/api/teacher/ai-tasks/{taskId}` | `TEACHER` | Lấy chi tiết tác vụ AI và dữ liệu câu hỏi xem trước |
| 85 | | `POST` | `/api/teacher/ai-tasks/{taskId}/cancel` | `TEACHER` | Hủy tác vụ AI đang xếp hàng / đang chạy và giải phóng khóa |
| 86 | | `DELETE` | `/api/teacher/ai-tasks/{taskId}` | `TEACHER` | Xóa tác vụ AI khỏi lịch sử theo dõi |
| 87 | **Admin AI Pool** | `GET` | `/api/admin/ai/status` | `ADMIN` | Xem tổng quan trạng thái hệ thống AI, slot metrics live & active workers |
| 88 | | `GET` | `/api/admin/ai/keys` | `ADMIN` | Lấy danh sách toàn bộ AI API Keys và model slots cấu hình |
| 89 | | `GET` | `/api/admin/ai/keys/{id}` | `ADMIN` | Xem chi tiết cấu hình 1 AI API Key |
| 90 | | `POST` | `/api/admin/ai/keys` | `ADMIN` | Thêm AI API Key mới kèm giới hạn RPM/TPM từng model |
| 91 | | `PUT` | `/api/admin/ai/keys/{id}` | `ADMIN` | Cập nhật thông tin AI API Key và model limits |
| 92 | | `DELETE` | `/api/admin/ai/keys/{id}` | `ADMIN` | Xóa AI API Key khỏi cơ sở dữ liệu và rotation pool |
| 93 | | `PATCH` | `/api/admin/ai/keys/{id}/toggle` | `ADMIN` | Bật / Tắt kích hoạt AI API Key |
| 94 | | `PATCH` | `/api/admin/ai/models/{id}/toggle` | `ADMIN` | Bật / Tắt kích hoạt slot model cụ thể |
| 95 | | `POST` | `/api/admin/ai/reload` | `ADMIN` | Buộc nạp lại toàn bộ slot xoay vòng AI từ Database |
| 96 | | `DELETE` | `/api/admin/ai/jobs/{jobId}` | `ADMIN` | Hủy khẩn cấp 1 tác vụ chấm thi / soạn đề ngầm bị kẹt |
| 97 | | `DELETE` | `/api/admin/ai/jobs` | `ADMIN` | Dọn dẹp toàn bộ tác vụ AI đang chạy và giải phóng toàn bộ khóa thi |
| 98 | **Admin Moderation** | `GET` | `/api/admin/moderation/questions` | `ADMIN` | Danh sách câu hỏi kiểm duyệt nội dung (lọc an toàn, ảnh, loại câu, FTS) |
| 99 | | `GET` | `/api/admin/moderation/stats` | `ADMIN` | Thống kê số lượng câu hỏi an toàn, vi phạm, chờ duyệt |
| 100 | | `PATCH` | `/api/admin/moderation/questions/{id}/safety` | `ADMIN` | Cập nhật nhãn an toàn (đánh dấu an toàn / thu hồi cờ) |
| 101 | | `DELETE` | `/api/admin/moderation/questions/{id}` | `ADMIN` | Xóa câu hỏi vi phạm tiêu chuẩn cộng đồng |
| 102 | | `POST` | `/api/admin/moderation/ai-run` | `ADMIN` | Kích hoạt tác vụ AI quét kiểm duyệt hàng loạt ngầm (202 Accepted) |
| 103 | | `GET` | `/api/admin/moderation/ai-status` | `ADMIN` | Kiểm tra tiến độ tác vụ AI kiểm duyệt nội dung |
| 104 | | `DELETE` | `/api/admin/moderation/ai-cursor` | `ADMIN` | Đặt lại con trỏ duyệt AI trên Redis để quét lại từ đầu |
| 105 | **Admin Health** | `GET` | `/api/admin/system/health` | `ADMIN` | Kiểm tra trạng thái sức khỏe hệ thống (Database, Redis, Disk, RAM, Uptime) |
| 106 | **Public Ping Probe** | `GET` | `/api/ping` (hoặc `/`, `/ping`) | `PUBLIC` | Kiểm tra kết nối, trạng thái máy chủ, trả về JSON hoặc HTML Dashboard |
| 107 | **Proctoring Media Governance** | `GET` | `/api/admin/proctoring-media` | `ADMIN` | Tìm kiếm & phân trang ảnh bằng chứng vi phạm (alias `/api/v1/...`) |
| 108 | | `GET` | `/api/admin/proctoring-media/stats` | `ADMIN` | Thống kê số lượng & phân tích dung lượng ảnh viễn trắc |
| 109 | | `GET` | `/api/admin/proctoring-media/cleanup/preview` | `ADMIN` | Xem trước số lượng ảnh sẽ dọn dẹp theo thời gian lưu trữ |
| 110 | | `POST` | `/api/admin/proctoring-media/cleanup` | `ADMIN` | Kích hoạt tác vụ dọn dẹp hàng loạt ảnh ngầm (RabbitMQ Batch) |
| 111 | | `GET` | `/api/admin/proctoring-media/cleanup/status` | `ADMIN` | Kiểm tra tiến độ tác vụ dọn dẹp ảnh ngầm |
| 112 | | `DELETE` | `/api/admin/proctoring-media/batch` | `ADMIN` | Xóa hàng loạt ảnh bằng chứng theo danh sách ID |
| 113 | | `DELETE` | `/api/admin/proctoring-media/{id}` | `ADMIN` | Xóa một ảnh bằng chứng đơn lẻ |
| 114 | **Realtime Protocols** | `WS` | `/ws/proctoring` | All (Student/Guest) | Kết nối và bắt tay STOMP WebSocket thời gian thực |
| 115 | | `SEND` | `/app/proctoring/violation` | All (Student/Guest) | Gửi sự kiện vi phạm viễn trắc qua WebSocket |
| 116 | | `SEND` | `/app/proctoring/heartbeat` | All (Student/Guest) | Gửi tín hiệu nhịp tim định kỳ giữ phiên làm bài |
| 117 | | `SUB` | `/topic/exam/{examId}/proctoring` | `TEACHER` | Đăng ký nhận thông báo vi phạm trực tiếp của phòng thi |
| 118 | | `SUB` | `/topic/exam/{examId}/attempt/{attemptId}` | `STUDENT/GUEST` | Đăng ký nhận thông điệp khóa phòng thi / đình chỉ thi cá nhân |

---

## III. Đặc Tả Chi Tiết Từng Endpoint

---

### Module 1: Xác Thực & Quản Lý Người Dùng (IAM & Auth)

#### 1.1. Đăng ký tài khoản (`POST /api/auth/register`)
- **Mô tả:** Đăng ký tài khoản người dùng mới (STUDENT hoặc TEACHER).
- **Quyền hạn:** `PUBLIC`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "username": "teacher_alice",
    "email": "alice@quicktest.com",
    "password": "Password@123",
    "fullName": "Alice Johnson",
    "role": "TEACHER"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "status": 201,
    "message": "User registered successfully",
    "data": {
      "accessToken": "eyJhbGciOi...",
      "tokenType": "Bearer",
      "user": {
        "id": "c1f7b032-1598-4b77-8025-a74581f33230",
        "username": "teacher_alice",
        "email": "alice@quicktest.com",
        "fullName": "Alice Johnson",
        "role": "TEACHER"
      }
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 1.2. Đăng nhập hệ thống (`POST /api/auth/login`)
- **Mô tả:** Xác thực danh tính người dùng bằng email/username và mật khẩu, cấp JWT token.
- **Quyền hạn:** `PUBLIC`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "usernameOrEmail": "alice@quicktest.com",
    "password": "Password@123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Login successful",
    "data": {
      "accessToken": "eyJhbGciOi...",
      "tokenType": "Bearer",
      "user": {
        "id": "c1f7b032-1598-4b77-8025-a74581f33230",
        "username": "teacher_alice",
        "email": "alice@quicktest.com",
        "fullName": "Alice Johnson",
        "role": "TEACHER"
      }
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 1.3. Lấy hồ sơ tài khoản hiện tại (`GET /api/auth/me`)
- **Mô tả:** Lấy thông tin cá nhân của tài khoản đang đăng nhập từ JWT Token.
- **Quyền hạn:** `Authenticated` (Yêu cầu Token)
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Profile retrieved successfully",
    "data": {
      "id": "c1f7b032-1598-4b77-8025-a74581f33230",
      "username": "teacher_alice",
      "email": "alice@quicktest.com",
      "fullName": "Alice Johnson",
      "role": "TEACHER"
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 1.4. Làm mới Token truy cập (`POST /api/auth/refresh`)
- **Mô tả:** Cấp mới JWT Access Token và Refresh Token khi Access Token hiện tại sắp hoặc đã hết hạn, giúp duy trì phiên đăng nhập mà không yêu cầu người dùng nhập lại thông tin xác thực.
- **Quyền hạn:** `PUBLIC`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "refreshToken": "7c189b88-51ec-4364-a690-3490b8f05e32"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Token refreshed successfully",
    "data": {
      "accessToken": "eyJhbGciOiJIUzUxMiJ9...",
      "tokenType": "Bearer",
      "expiresIn": 86400,
      "refreshToken": "9a38f322-11bc-4dc2-8239-2819cd481021",
      "refreshExpiresIn": 604800,
      "userInfo": {
        "id": "c1f7b032-1598-4b77-8025-a74581f33230",
        "username": "teacher_alice",
        "email": "alice@quicktest.com",
        "fullName": "Alice Johnson",
        "roles": ["ROLE_TEACHER"],
        "authProvider": "LOCAL",
        "isActive": true,
        "createdAt": "2026-09-12T12:00:00",
        "lastLoginAt": "2026-11-13T11:00:00"
      }
    },
    "timestamp": "2026-11-13T11:00:05.120"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Refresh token bị để trống hoặc sai định dạng.
  - `401 Unauthorized`: Refresh token không hợp lệ, đã hết hạn (expired) hoặc đã bị thu hồi trong Redis/Database.

#### 1.5. Đăng nhập Single Sign-On qua QuickBite Access Token (`POST /api/auth/sso/quickbite`)
- **Mô tả:** Xác thực hoặc tự động cấp tài khoản QuickTest cho người dùng đã đăng nhập từ hệ sinh thái QuickBite bằng việc truyền trực tiếp QuickBite Bearer Token.
- **Quyền hạn:** `PUBLIC`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "accessToken": "qb_eyJh..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "QuickBite SSO authentication successful",
    "data": {
      "accessToken": "eyJhbGciOiJIUzUxMiJ9...",
      "tokenType": "Bearer",
      "expiresIn": 86400,
      "refreshToken": "b3e098df-8fa2-4be1-8b29-e85df6a94b41",
      "refreshExpiresIn": 604800,
      "userInfo": {
        "id": "78fa2c30-4e56-42bb-a320-c8f7d983412e",
        "username": "qb_john_doe",
        "email": "johndoe@quickbite.io",
        "fullName": "John Doe",
        "roles": ["ROLE_STUDENT"],
        "authProvider": "QUICKBITE",
        "isActive": true,
        "createdAt": "2026-10-27T12:00:00",
        "lastLoginAt": "2026-11-13T11:15:20"
      }
    },
    "timestamp": "2026-11-13T11:15:20.450"
  }
  ```

#### 1.6. Đăng nhập trực tiếp bằng tài khoản QuickBite (`POST /api/auth/sso/quickbite/login`)
- **Mô tả:** Xác thực người dùng bằng thông tin đăng nhập trực tiếp (Username/Password của QuickBite) theo cơ chế Resource Owner Password Credentials Grant flow.
- **Quyền hạn:** `PUBLIC`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "username": "john_quickbite",
    "password": "SecurePassword@2026"
  }
  ```
- **Response (200 OK):** Cấu trúc tương tự mục 1.5, trả về JWT QuickTest kèm hồ sơ tài khoản liên kết với `authProvider: "QUICKBITE"`.

#### 1.7. Trao đổi OAuth2 Authorization Code QuickBite (`POST /api/auth/sso/quickbite/code`)
- **Mô tả:** Xử lý callback chuyển hướng OAuth2/OIDC. Frontend gửi `code` và `redirectUri` nhận từ QuickBite Identity Service để Backend QuickTest trao đổi Token an toàn ở tầng Server-to-Server.
- **Quyền hạn:** `PUBLIC`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "code": "auth_code_78ab6210f92b45ca9",
    "redirectUri": "https://quicktest.app/signin-oidc"
  }
  ```
- **Response (200 OK):** Trả về `AuthResponse` đầy đủ chứa Token và thông tin tài khoản QuickTest.

#### 1.8. Cập nhật hồ sơ cá nhân (`PUT /api/auth/profile`)
- **Mô tả:** Người dùng đang đăng nhập tự cập nhật thông tin hiển thị của bản thân (họ và tên).
- **Quyền hạn:** `Authenticated` (Yêu cầu JWT Token bất kỳ vai trò nào)
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "fullName": "Alice Johnson Ph.D"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Profile updated successfully",
    "data": {
      "id": "c1f7b032-1598-4b77-8025-a74581f33230",
      "username": "teacher_alice",
      "email": "alice@quicktest.com",
      "fullName": "Alice Johnson Ph.D",
      "roles": ["ROLE_TEACHER"],
      "authProvider": "LOCAL",
      "isActive": true,
      "createdAt": "2026-09-12T12:00:00",
      "lastLoginAt": "2026-11-13T11:00:00"
    },
    "timestamp": "2026-11-13T11:18:00.000"
  }
  ```

#### 1.9. Đổi mật khẩu tài khoản (`PUT /api/auth/password`)
- **Mô tả:** Người dùng đang đăng nhập đổi mật khẩu tài khoản bằng cách xác minh mật khẩu hiện tại và nhập mật khẩu mới.
- **Quyền hạn:** `Authenticated` (Yêu cầu JWT Token)
- **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "oldPassword": "Password@123",
    "newPassword": "NewStrongPassword@2026",
    "confirmPassword": "NewStrongPassword@2026"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Password updated successfully",
    "data": null,
    "timestamp": "2026-11-13T11:20:00.000"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `newPassword` và `confirmPassword` không trùng khớp, hoặc mật khẩu mới quá ngắn (< 6 ký tự).
  - `400 Bad Request`: Mật khẩu hiện tại (`oldPassword`) không chính xác.

---

### Module 2: Quản Lý Đề Thi Giáo Viên (Teacher Exam Management)

#### 2.1. Tạo đề thi mới (`POST /api/teacher/exams`)
- **Mô tả:** Giáo viên khởi tạo đề thi mới ở trạng thái mặc định `DRAFT`.
- **Quyền hạn:** `TEACHER`
- **Headers:** `Authorization: Bearer <teacher_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "title": "Kiểm tra Giữa kỳ Sinh học 12",
    "accessCode": "BIO12GK",
    "description": "Đề thi chính thức 45 phút",
    "durationMinutes": 45,
    "maxAttempts": 1,
    "shuffleQuestions": true,
    "shuffleOptions": true,
    "isProctoringEnabled": true,
    "maxViolations": 3,
    "showResultsToStudents": true,
    "startTime": "2026-10-01T08:00:00",
    "endTime": "2026-10-01T12:00:00"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "status": 201,
    "message": "Exam created successfully",
    "data": {
      "id": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
      "title": "Kiểm tra Giữa kỳ Sinh học 12",
      "accessCode": "BIO12GK",
      "description": "Đề thi chính thức 45 phút",
      "status": "DRAFT",
      "durationMinutes": 45,
      "maxAttempts": 1,
      "shuffleQuestions": true,
      "shuffleOptions": true,
      "isProctoringEnabled": true,
      "maxViolations": 3,
      "showResultsToStudents": true,
      "startTime": "2026-10-01T08:00:00",
      "endTime": "2026-10-01T12:00:00",
      "totalQuestions": 0,
      "totalPoints": 0.0,
      "questions": []
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 2.2. Danh sách đề thi của giáo viên (`GET /api/teacher/exams`)
- **Mô tả:** Lấy danh sách đề thi do giáo viên hiện tại tạo, có phân trang.
- **Quyền hạn:** `TEACHER`
- **Query Params:**
  - `search` (optional): Từ khóa tìm kiếm theo tiêu đề bài thi (`title`) hoặc mã phòng thi (`accessCode`), không phân biệt hoa thường
  - `status` (optional): Lọc theo trạng thái đề thi (`DRAFT`, `PUBLISHED`, `CLOSED`)
  - `page` (default: 0): Chỉ số trang
  - `size` (default: 10): Số lượng bản ghi mỗi trang
  - `sort` (default: "createdAt,desc"): Tiêu chí sắp xếp
- **Response (200 OK):** `PageResponse<ExamSummaryResponse>`

#### 2.3. Xem chi tiết đề thi (`GET /api/teacher/exams/{id}`)
- **Mô tả:** Lấy đầy đủ thông tin cấu hình đề thi cùng toàn bộ danh sách câu hỏi và đáp án.
- **Quyền hạn:** `TEACHER` (Chỉ chủ sở hữu đề thi mới xem được)
- **Path Variable:** `id` (UUID đề thi)
- **Response (200 OK):** `ExamDetailResponse` (kèm danh sách `QuestionResponse`)

#### 2.4. Cập nhật đề thi (`PUT /api/teacher/exams/{id}`)
- **Mô tả:** Cập nhật thông tin cấu hình (tiêu đề, thời lượng, số lần thi, thời gian mở/đóng).
- **Quyền hạn:** `TEACHER`
- **Request Body:** `ExamUpdateRequest`
- **Response (200 OK):** `ExamDetailResponse`

#### 2.5. Xuất bản đề thi (`PATCH /api/teacher/exams/{id}/publish`)
- **Mô tả:** Chuyển trạng thái đề thi từ `DRAFT` sang `PUBLISHED` để thí sinh có thể vào thi.
- **Quyền hạn:** `TEACHER`
- **Response (200 OK):** `ExamDetailResponse` (status = "PUBLISHED")

#### 2.6. Đóng đề thi (`PATCH /api/teacher/exams/{id}/close`)
- **Mô tả:** Chuyển trạng thái đề thi sang `CLOSED` (ngừng nhận thí sinh làm bài mới), đồng thời tự động thu và chấm tất cả các bài thi đang dở dang (`IN_PROGRESS`).
- **Quyền hạn:** `TEACHER`
- **Response (200 OK):** `ExamDetailResponse` (status = "CLOSED")

#### 2.7. Mở lại đề thi đã đóng (`PATCH /api/teacher/exams/{id}/republish`)
- **Mô tả:** Mở lại đề thi đã đóng (`CLOSED` -> `PUBLISHED`) để tiếp tục tổ chức thi hoặc gia hạn thời gian làm bài. Bảo lưu toàn bộ lịch sử các lượt thi cũ.
- **Quyền hạn:** `TEACHER`
- **Request Body (Tùy chọn):** `ExamRepublishRequest`
  ```json
  {
    "startTime": "2026-10-01T08:00:00",
    "endTime": "2026-10-05T23:59:59",
    "durationMinutes": 60,
    "maxAttempts": 2
  }
  ```
- **Ràng buộc nghiệp vụ:**
  - Đề thi phải có ít nhất 1 câu hỏi.
  - Nếu có thiết lập `endTime`, hạn chót phải ở tương lai (`endTime > now`).
- **Response (200 OK):** `ExamDetailResponse` (status = "PUBLISHED")

#### 2.8. Nhân bản đề thi (`POST /api/teacher/exams/{id}/duplicate`)
- **Mô tả:** Nhân bản một đề thi đã có sẵn của giáo viên thành một đề thi mới ở trạng thái `DRAFT` với mã phòng thi (`accessCode`) mới ngẫu nhiên.
  - Sao chép toàn bộ danh sách câu hỏi, đáp án, điểm số và cấu hình.
  - Nếu đề thi có hình ảnh minh họa (câu hỏi hoặc đáp án): đề thi tạm chuyển sang trạng thái `CLONING` (ẩn khỏi danh sách giáo viên), đẩy tác vụ sao chép ảnh sang hàng đợi RabbitMQ (`exam.clone.queue`). Sau khi Background Worker nhân bản toàn bộ ảnh sang asset Cloudinary độc lập (ID mới), đề thi tự động chuyển sang `DRAFT` và phát thông báo WebSocket (`/topic/teachers/{teacherId}/notifications`) về cho giáo viên.
  - Nếu đề thi không có hình ảnh: tạo trực tiếp trạng thái `DRAFT` ngay lập tức (201 Created).
- **Quyền hạn:** `TEACHER`
- **Path Variable:** `id` (UUID đề thi nguồn cần nhân bản)
- **Request Body (Tùy chọn):** `ExamDuplicateRequest`
  ```json
  {
    "title": "Kỳ thi thử THPT Toán 2026 - Lần 2"
  }
  ```
  *(Nếu để trống `title`, hệ thống tự động đặt tiền tố `[Bản sao] <Tên đề gốc>`)*
- **Response (201 Created hoặc 202 Accepted):** `ExamDetailResponse`

#### 2.9. Xóa đề thi (`DELETE /api/teacher/exams/{id}`)
- **Mô tả:** Xóa vĩnh viễn đề thi. Chỉ cho phép xóa khi đề thi đang ở trạng thái `DRAFT`.
- **Quyền hạn:** `TEACHER`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Exam deleted successfully",
    "data": null,
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 2.10. Dashboard tổng quan giáo viên (`GET /api/teacher/dashboard`)
- **Mô tả:** Cung cấp số liệu thống kê toàn diện phục vụ giảng dạy của giáo viên: tổng số đề thi theo vòng đời (Draft, Published, Closed), phân loại câu hỏi (Single, Multi, Numeric, Essay), khối lượng bài nộp cần chấm tay, điểm trung bình toàn bộ học sinh, danh sách việc cần xử lý gấp (priority exams), biểu đồ chuỗi thời gian 7 ngày và danh sách cảnh báo vi phạm viễn trắc gần nhất.
- **Quyền hạn:** `TEACHER` hoặc `ADMIN`
- **Query Parameters:**
  - `refresh` (boolean, tùy chọn, mặc định `false`): Nếu đặt `true`, hệ thống sẽ bỏ qua cache Redis tạm thời để tính toán lại số liệu tươi mới nhất từ Database.
- **Headers:** `Authorization: Bearer <teacher_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Teacher dashboard statistics retrieved successfully",
    "data": {
      "totalExams": 12,
      "draftExams": 3,
      "publishedExams": 6,
      "closedExams": 3,
      "totalQuestions": 240,
      "singleChoiceQuestions": 160,
      "multipleChoiceQuestions": 40,
      "numericQuestions": 25,
      "essayQuestions": 15,
      "totalAttempts": 580,
      "inProgressAttempts": 24,
      "submittedAttempts": 520,
      "awaitingGradingAttempts": 36,
      "disqualifiedAttempts": 4,
      "pendingManualAnswers": 48,
      "averageScore": 7.82,
      "totalViolations": 14,
      "dailyActivities": [
        {
          "date": "2026-11-07",
          "label": "T7",
          "attemptsCount": 85,
          "submittedCount": 80,
          "violationsCount": 2
        },
        {
          "date": "2026-11-13",
          "label": "T6",
          "attemptsCount": 120,
          "submittedCount": 115,
          "violationsCount": 1
        }
      ],
      "priorityExams": [
        {
          "id": "b3e098df-8fa2-4be1-8b29-e85df6a94b41",
          "title": "Kiểm tra Giữa kỳ Sinh học 12",
          "accessCode": "BIO12GK",
          "status": "PUBLISHED",
          "durationMinutes": 45,
          "createdAt": "2026-11-01T08:00:00",
          "totalAttempts": 150,
          "inProgressCount": 12,
          "submittedCount": 138,
          "pendingGradingCount": 15,
          "averageScore": 8.15
        }
      ],
      "recentViolations": [
        {
          "id": "e9b2a750-f81d-4048-b4b6-79177a64ce12",
          "attemptId": "f78d10b4-374e-4b68-b789-98246e72b4f9",
          "studentName": "Nguyễn Văn An",
          "examTitle": "Kiểm tra Giữa kỳ Sinh học 12",
          "violationType": "TAB_SWITCH",
          "description": "Chuyển tab trình duyệt trong khi thi",
          "timestamp": "2026-11-13T10:45:22"
        }
      ]
    },
    "timestamp": "2026-11-13T11:21:00.000"
  }
  ```

---

### Module 3: Soạn Thảo & Quản Lý Câu Hỏi (Question Management)

#### 3.1. Thêm câu hỏi vào đề thi (`POST /api/teacher/exams/{examId}/questions`)
- **Mô tả:** Thêm câu hỏi mới vào đề thi `DRAFT`. Hỗ trợ 4 loại câu hỏi:
  - `SINGLE_CHOICE`: Trắc nghiệm 1 đáp án đúng.
  - `MULTIPLE_CHOICE`: Trắc nghiệm nhiều đáp án đúng.
  - `NUMERIC`: Điền đáp số số học (có `numericTolerance`).
  - `ESSAY_TEXT`: Tự luận (có `sampleAnswer` và `gradingRubric`).
  - Hỗ trợ câu hỏi có văn bản, có hình ảnh (`imageUrl`, `imagePublicId`), hoặc chỉ có hình ảnh không cần văn bản.
- **Quyền hạn:** `TEACHER`
- **Request Body Example (Trắc nghiệm có ảnh đáp án):**
  ```json
  {
    "orderIndex": 1,
    "content": "Bào quan nào sau đây thực hiện chức năng quang hợp?",
    "imageUrl": "https://res.cloudinary.com/demo/image/upload/plant_cell.png",
    "imagePublicId": "quick-test/questions/plant_cell",
    "questionType": "SINGLE_CHOICE",
    "points": 2.0,
    "options": [
      {
        "orderIndex": 1,
        "content": "Lục lạp",
        "imageUrl": "https://res.cloudinary.com/demo/image/upload/chloroplast.png",
        "isCorrect": true
      },
      {
        "orderIndex": 2,
        "content": "Ty thể",
        "imageUrl": "https://res.cloudinary.com/demo/image/upload/mitochondria.png",
        "isCorrect": false
      }
    ]
  }
  ```
- **Response (201 Created):** `ApiResponse<QuestionResponse>`

#### 3.2. Cập nhật câu hỏi (`PUT /api/teacher/questions/{questionId}`)
- **Mô tả:** Cập nhật nội dung câu hỏi, loại, điểm, danh sách lựa chọn hoặc hình ảnh.
- **Tính năng mở rộng:** Nếu ảnh câu hỏi bị thay thế hoặc bỏ trống, hệ thống **tự động xóa ảnh cũ trên Cloudinary**. Nếu danh sách đáp án cũ bị loại bỏ, toàn bộ ảnh của các đáp án đó cũng được xóa trên Cloudinary.
- **Quyền hạn:** `TEACHER`
- **Request Body:** `QuestionUpdateRequest`
- **Response (200 OK):** `ApiResponse<QuestionResponse>`

#### 3.3. Cập nhật trực tiếp ảnh câu hỏi (`PUT /api/teacher/questions/{questionId}/image`)
- **Mô tả:** Upload trực tiếp file ảnh mới dạng Multipart để thay thế ảnh cho câu hỏi. Tự động xóa ảnh cũ trên Cloudinary.
- **Quyền hạn:** `TEACHER`
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `file`: File ảnh (jpg, png, webp, gif < 3MB)
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Question image updated successfully",
    "data": {
      "id": "7662cbf7-fffa-4da6-a6fe-4fbe9cf2bbf6",
      "imageUrl": "https://res.cloudinary.com/rg1alnza/image/upload/v1726/quick-test/questions/diagram.png",
      "imagePublicId": "quick-test/questions/diagram",
      "content": "Xác định tên đồ thị sau:",
      "points": 2.0
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 3.4. Xóa câu hỏi khỏi đề thi (`DELETE /api/teacher/questions/{questionId}`)
- **Mô tả:** Xóa câu hỏi khỏi đề thi.
- **Tính năng dọn dẹp:** Tự động gọi Cloudinary API xóa ảnh câu hỏi (nếu có) và **duyệt xóa toàn bộ ảnh đính kèm của các đáp án** trên Cloudinary trước khi xóa bản ghi DB.
- **Quyền hạn:** `TEACHER`
- **Response (200 OK):** `ApiResponse<Void>`

#### 3.5. Lấy ngân hàng câu hỏi của giáo viên (`GET /api/teacher/question-bank`)
- **Mô tả:** Lấy danh sách toàn bộ câu hỏi thuộc tất cả các đề thi mà giáo viên hiện tại sở hữu. Hỗ trợ phân trang, tìm kiếm từ khóa theo nội dung câu hỏi hoặc tên đề thi gốc, và loại trừ một đề thi mục tiêu.
- **Quyền hạn:** `TEACHER`
- **Query Params:**
  - `excludeExamId` (optional): UUID đề thi cần loại trừ (thường là đề thi đang soạn thảo).
  - `search` (optional): Từ khóa tìm kiếm theo nội dung câu hỏi hoặc tiêu đề đề thi gốc.
  - `page` (default: 0): Chỉ số trang.
  - `size` (default: 10): Số lượng bản ghi mỗi trang.
  - `sort` (default: "orderIndex"): Tiêu chí sắp xếp.
- **Response (200 OK):** `ApiResponse<PageResponse<QuestionBankItemResponse>>`
  ```json
  {
    "status": 200,
    "message": "Question bank retrieved successfully",
    "data": {
      "content": [
        {
          "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "examId": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
          "examTitle": "Kiểm tra Giữa kỳ Sinh học 12",
          "examAccessCode": "BIO12GK",
          "examSubject": "Sinh học",
          "content": "Bào quan nào sau đây thực hiện chức năng quang hợp?",
          "imageUrl": "https://res.cloudinary.com/demo/image/upload/plant_cell.png",
          "imagePublicId": "quick-test/questions/plant_cell",
          "questionType": "SINGLE_CHOICE",
          "points": 2.0,
          "orderIndex": 1,
          "sampleAnswer": null,
          "numericTolerance": null,
          "gradingRubric": null,
          "options": [
            {
              "id": "c1d2e3f4-5678-90ab-cdef-123456789012",
              "orderIndex": 1,
              "content": "Lục lạp",
              "imageUrl": null,
              "imagePublicId": null,
              "isCorrect": true
            }
          ]
        }
      ],
      "pageNumber": 0,
      "pageSize": 10,
      "totalElements": 25,
      "totalPages": 3,
      "last": false
    },
    "timestamp": "2026-09-19T12:00:00"
  }
  ```

#### 3.6. Nhập câu hỏi từ ngân hàng vào đề thi (`POST /api/teacher/exams/{examId}/questions/import`)
- **Mô tả:** Nhập hàng loạt câu hỏi đã chọn từ ngân hàng vào đề thi đích đang ở trạng thái `DRAFT`.
  - Thực hiện **Deep Copy**: nhân bản toàn bộ câu hỏi, đáp án, và tự động gọi Cloudinary nhân bản độc lập các hình ảnh minh họa (cả câu hỏi và đáp án).
  - Tự động đánh số thứ tự tiếp nối (`orderIndex`) cho các câu hỏi mới thêm vào cuối đề thi.
  - Xác thực quyền sở hữu nghiêm ngặt: giáo viên phải sở hữu cả đề thi đích và tất cả các đề thi chứa câu hỏi nguồn.
- **Quyền hạn:** `TEACHER`
- **Path Variable:** `examId` (UUID đề thi đích cần nhập câu hỏi vào)
- **Request Body:**
  ```json
  {
    "questionIds": [
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "b2c3d4e5-f678-90ab-cdef-234567890123"
    ]
  }
  ```
- **Response (201 Created):** `ApiResponse<List<QuestionResponse>>`
  ```json
  {
    "status": 201,
    "message": "2 question(s) imported successfully",
    "data": [
      {
        "id": "f7e6d5c4-b3a2-1098-7654-3210fedcba98",
        "orderIndex": 5,
        "content": "Bào quan nào sau đây thực hiện chức năng quang hợp?",
        "imageUrl": "https://res.cloudinary.com/demo/image/upload/plant_cell_clone.png",
        "imagePublicId": "quick-test/questions/plant_cell_clone",
        "questionType": "SINGLE_CHOICE",
        "points": 2.0,
        "options": [ ... ]
      }
    ],
    "timestamp": "2026-09-19T12:00:00"
  }
  ```

#### 3.7. Thêm câu hỏi kèm tải lên ảnh trực tiếp (`POST /api/teacher/exams/{examId}/questions/with-media`)
- **Mô tả:** Tạo câu hỏi mới trong đề thi đồng thời tải trực tiếp tệp hình ảnh của câu hỏi và hình ảnh của từng phương án lựa chọn trong cùng 1 request dạng `multipart/form-data`. Hệ thống tải ảnh bất đồng bộ lên Cloudinary qua RabbitMQ giúp phản hồi ngay lập tức.
- **Endpoint alias:** Hỗ trợ cả `POST /api/teacher/exams/{examId}/questions` (khi gửi header `Content-Type: multipart/form-data`).
- **Quyền hạn:** `TEACHER`
- **Headers:** `Authorization: Bearer <teacher_token>`, `Content-Type: multipart/form-data`
- **Form Data Parts:**
  - `question` (application/json, Bắt buộc): Dữ liệu câu hỏi chuẩn (`QuestionCreateRequest`).
  - `questionImage` (file binary, Tùy chọn): Tệp ảnh của câu hỏi (PNG, JPEG, WebP, dung lượng tối đa 10MB).
  - `optionImages` (danh sách file binary, Tùy chọn): Danh sách tệp ảnh cho các đáp án lựa chọn.
  - `optionIndices` (danh sách số nguyên, Tùy chọn): Thứ tự index tương ứng của các lựa chọn gắn với `optionImages` (Ví dụ: `0`, `2`).
- **Response (201 Created):**
  ```json
  {
    "status": 201,
    "message": "Question added to exam successfully. Media is processing in background.",
    "data": {
      "id": "5f3a8b29-192a-4ce2-b281-229184baef10",
      "examId": "b3e098df-8fa2-4be1-8b29-e85df6a94b41",
      "content": "Quan sát đồ thị cấu trúc ADN dưới đây và xác định liên kết X:",
      "type": "SINGLE_CHOICE",
      "score": 1.0,
      "orderIndex": 5,
      "imageUrl": null,
      "imagePending": true,
      "options": [
        { "id": "opt-1", "content": "Liên kết Hydro", "isCorrect": true, "imageUrl": null },
        { "id": "opt-2", "content": "Liên kết Photphodiester", "isCorrect": false, "imageUrl": null }
      ]
    },
    "timestamp": "2026-11-13T11:22:15.000"
  }
  ```

#### 3.8. Cập nhật câu hỏi kèm tải lên ảnh trực tiếp (`PUT /api/teacher/questions/{questionId}/with-media`)
- **Mô tả:** Cập nhật nội dung câu hỏi, danh sách đáp án, đồng thời thay thế hoặc bổ sung ảnh minh họa câu hỏi / lựa chọn bằng tệp nhị phân tải lên trực tiếp (`multipart/form-data`).
- **Endpoint alias:** Hỗ trợ cả `PUT /api/teacher/questions/{questionId}` (khi gửi header `Content-Type: multipart/form-data`).
- **Quyền hạn:** `TEACHER`
- **Headers:** `Authorization: Bearer <teacher_token>`, `Content-Type: multipart/form-data`
- **Form Data Parts:** Tương tự mục 3.7 (`question`, `questionImage`, `optionImages`, `optionIndices`).
- **Response (200 OK):** Trả về `QuestionResponse` sau khi cập nhật thành công.

---

### Module 4: Quản Lý Media & Upload Cloudinary (Media Upload)

#### 4.1. Upload 1 ảnh đồng bộ (`POST /api/teacher/media/upload`)
- **Mô tả:** Upload trực tiếp 1 file ảnh lên Cloudinary và nhận ngay URL.
- **Quyền hạn:** `TEACHER`
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `file`: File ảnh đính kèm (bắt buộc, < 3MB)
  - `folderType`: "questions" (mặc định) hoặc "options"
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Media uploaded successfully",
    "data": {
      "url": "https://res.cloudinary.com/rg1alnza/image/upload/quick-test/questions/cell.png",
      "publicId": "quick-test/questions/cell",
      "originalFilename": "cell.png",
      "folder": "quick-test/questions",
      "format": "png",
      "size": 124500
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 4.2. Upload hàng loạt ảnh bất đồng bộ (`POST /api/teacher/media/batch-upload`)
- **Mô tả:** Gửi một tập hợp nhiều file ảnh (tối đa 30 files). Hệ thống đẩy vào hàng đợi RabbitMQ `media.upload.queue` và xử lý ngầm, cập nhật tiến độ vào Redis.
- **Quyền hạn:** `TEACHER`
- **Content-Type:** `multipart/form-data`
- **Form Data:**
  - `files`: Danh sách file ảnh
  - `folderType`: "questions" hoặc "options"
- **Response (202 Accepted):**
  ```json
  {
    "status": 200,
    "message": "Batch upload accepted and processing",
    "data": {
      "batchId": "65cb76e2-276e-44db-a2d7-95764d8a1c97"
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 4.3. Tra cứu tiến độ batch upload (`GET /api/teacher/media/batch/{batchId}/status`)
- **Mô tả:** Polling kiểm tra tiến độ upload batch qua Redis và lấy danh sách URL ảnh đã hoàn thành.
- **Quyền hạn:** `TEACHER`
- **Path Variable:** `batchId` (UUID)
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Batch status retrieved",
    "data": {
      "batchId": "65cb76e2-276e-44db-a2d7-95764d8a1c97",
      "status": "COMPLETED",
      "totalFiles": 3,
      "completedFiles": 3,
      "fileUrlMap": {
        "pic1.png": "https://res.cloudinary.com/.../pic1.png",
        "pic2.png": "https://res.cloudinary.com/.../pic2.png"
      },
      "errorMessage": null
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

---

### Module 5: Làm Bài Thi & Phiên Thí Sinh (Candidate Exam Session)

#### 5.1. Bắt đầu làm bài thi (`POST /api/session/start`)
- **Mô tả:** Thí sinh (hoặc khách vãng lai) nhập `accessCode` để bắt đầu làm bài. Hệ thống trả về đề thi masked (loại bỏ cờ `isCorrect`, `sampleAnswer`, `gradingRubric`).
- **Quyền hạn:** All (Student có token hoặc Guest không token)
- **Request Body:**
  ```json
  {
    "accessCode": "BIO12GK",
    "guestName": "Nguyen Van A",
    "guestIdentifier": "SV2026001"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Exam session started successfully",
    "data": {
      "attemptId": "a93e3d64-e5e3-4d64-8ee1-d309be0d23aa",
      "examId": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
      "examTitle": "Kiểm tra Giữa kỳ Sinh học 12",
      "durationMinutes": 45,
      "startTime": "2026-09-12T12:00:00",
      "expireAt": "2026-09-12T12:45:00",
      "questions": [
        {
          "questionId": "7662cbf7-fffa-4da6-a6fe-4fbe9cf2bbf6",
          "orderIndex": 1,
          "content": "Bào quan nào thực hiện quang hợp?",
          "imageUrl": "https://res.cloudinary.com/.../cell.png",
          "questionType": "SINGLE_CHOICE",
          "points": 2.0,
          "options": [
            { "optionId": "1111...", "orderIndex": 1, "content": "Lục lạp", "imageUrl": null },
            { "optionId": "2222...", "orderIndex": 2, "content": "Ty thể", "imageUrl": null }
          ]
        }
      ]
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 5.2. Auto-save nháp câu trả lời (`PUT /api/session/{attemptId}/save`)
- **Mô tả:** Lưu nháp câu trả lời tức thời vào Redis Hash (`session:attempt:{id}:drafts`). Không khóa DB.
- **Path Variable:** `attemptId` (UUID)
- **Request Body:**
  ```json
  {
    "questionId": "7662cbf7-fffa-4da6-a6fe-4fbe9cf2bbf6",
    "selectedOptionIds": ["1111..."],
    "textAnswer": null
  }
  ```
- **Response (200 OK):** `ApiResponse<Void>`

#### 5.3. Khôi phục bài làm (`GET /api/session/{attemptId}/resume`)
- **Mô tả:** Thí sinh bị rớt mạng hoặc refresh trang gọi endpoint này để lấy lại đề thi kèm toàn bộ các đáp án nháp đã lưu trong Redis.
- **Path Variable:** `attemptId` (UUID)
- **Response (200 OK):** `ResumeExamResponse`

#### 5.4. Nộp bài thi (`POST /api/session/{attemptId}/submit`)
- **Mô tả:** Nộp bài thi. Hệ thống ghi nhận trạng thái nộp, khóa bài thi, và đẩy payload chấm điểm vào RabbitMQ queue `exam.submission.queue`.
- **Response (202 Accepted):**
  ```json
  {
    "status": 200,
    "message": "Exam submission accepted and queued for background grading",
    "data": {
      "attemptId": "a93e3d64-e5e3-4d64-8ee1-d309be0d23aa",
      "status": "AWAITING_MANUAL_GRADING",
      "submitTime": "2026-09-12T12:35:10"
    },
    "timestamp": "2026-09-12T12:35:10"
  }
  ```

#### 5.5. Xem kết quả bài thi (`GET /api/session/{attemptId}/result`)
- **Mô tả:** Thí sinh xem kết quả bài thi. Tự động kiểm tra Redis Cache trước, nếu bài thi đã hoàn tất chấm điểm sẽ trả về `totalScore`. Nếu còn câu tự luận chờ chấm, status sẽ là `AWAITING_MANUAL_GRADING`.
- **Response (200 OK):** `SubmitResultResponse`

#### 5.6. Khám phá danh sách đề thi mở tự do (`GET /api/public/exams`)
- **Mô tả:** Endpoint mở hoàn toàn cho khách vãng lai và thí sinh tự do duyệt xem tối đa 10 đề thi công khai (`status = PUBLISHED`, `isPublic = true`) ngẫu nhiên trên trang chủ, có cơ chế quay vòng và lưu bộ đệm Redis TTL 60 giây.
- **Quyền hạn:** `PUBLIC` (Không yêu cầu Token)
- **Headers:** `Content-Type: application/json`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Random public exams retrieved successfully",
    "data": [
      {
        "id": "b3e098df-8fa2-4be1-8b29-e85df6a94b41",
        "title": "Khảo sát kiến thức Trí Tuệ Nhân Tạo căn bản",
        "accessCode": "AI101_OPEN",
        "description": "Đề thi mở tự do cho mọi thành viên trải nghiệm",
        "status": "PUBLISHED",
        "durationMinutes": 30,
        "maxAttempts": 5,
        "questionCount": 20,
        "totalPoints": 10.0,
        "teacherName": "ThS. Trần Minh Đức",
        "startTime": "2026-10-01T00:00:00",
        "endTime": "2026-12-31T23:59:59",
        "examTimeStatus": "OPEN",
        "isOpen": true,
        "createdAt": "2026-09-30T10:15:00"
      }
    ],
    "timestamp": "2026-11-13T11:23:00.000"
  }
  ```

---

### Module 6 & 7: Giám Sát Phòng Thi Trực Tuyến & Viễn Trắc (Proctoring)

#### 6.1. Thí sinh báo cáo vi phạm (`POST /api/session/proctoring/violations`)
- **Mô tả:** SDK giám sát phía client gửi telemetry khi phát hiện gian lận: rời màn hình, switch tab, mất tiêu điểm chuột, phím tắt cấm, mở DevTools, v.v.
  - Hệ thống kiểm tra cấu hình `isProctoringEnabled` của đề thi: nếu giáo viên tắt giám sát, các báo cáo sẽ được bỏ qua mà không lưu audit logs hay tăng bộ đếm.
  - Nếu bật giám sát, hệ thống ghi nhận vi phạm và so sánh với ngưỡng `maxViolations` do giáo viên cấu hình cho đề thi đó. Vượt quá ngưỡng sẽ tự động chuyển bài thi sang `DISQUALIFIED` (đình chỉ).
- **Request Body:**
  ```json
  {
    "attemptId": "a93e3d64-e5e3-4d64-8ee1-d309be0d23aa",
    "violationType": "TAB_SWITCH",
    "details": "User switched away to another application for 6 seconds"
  }
  ```
- **Response (200 OK):** `ViolationAlertMessage` (thông báo cảnh báo vi phạm kèm `maxAllowed` và `remainingAllowed`)

#### 6.2. Thí sinh gửi Heartbeat (`POST /api/session/proctoring/heartbeat`)
- **Mô tả:** HTTP beacon fallback gửi tín hiệu duy trì trạng thái kết nối active mỗi 15-30 giây.
- **Request Body:** `{ "attemptId": "a93e3d64-e5e3-4d64-8ee1-d309be0d23aa" }`
- **Response (200 OK):** `"Heartbeat received"`

#### 6.3. Lấy chữ ký ủy quyền tải ảnh vi phạm trực tiếp lên Cloudinary (`GET /api/session/{attemptId}/proctoring/upload-signature`)
- **Mô tả:** Tạo chữ ký số (Signed Upload Signature) để trình duyệt client của thí sinh có thể tải thẳng ảnh bằng chứng (Webcam snapshot / Screenshot) lên dịch vụ Cloudinary. Giải pháp này giúp máy chủ Backend không phải hứng chịu tải xử lý luồng nhị phân lớn, đồng thời tuyệt đối không làm lộ khóa bí mật `apiSecret` cho phía Client.
- **Quyền hạn:** `All (Student/Guest)` (Sở hữu phiên thi tương ứng)
- **Headers:** `Authorization: Bearer <token>` (đối với sinh viên) hoặc Header phiên định danh.
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Upload signature generated successfully",
    "data": {
      "signature": "1a2b3c4d5e6f7890abcdef1234567890abcdef12",
      "timestamp": 1794567890,
      "apiKey": "748927163916294",
      "cloudName": "quicktest-cloud",
      "folder": "quick-test/proctoring/f78d10b4-374e-4b68-b789-98246e72b4f9"
    },
    "timestamp": "2026-11-13T11:24:00.000"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Phiên thi không còn ở trạng thái `IN_PROGRESS` (đã nộp bài hoặc bị đình chỉ).
  - `403 Forbidden`: Người dùng không có quyền đối với phiên thi được chỉ định.

#### 6.4. Ingestion vi phạm viễn trắc thông lượng cao (`POST /api/session/{attemptId}/proctoring/violation`)
- **Mô tả:** Endpoint chuyên dụng tiếp nhận dữ liệu vi phạm viễn trắc (telemetry ingestion) với thông lượng cực cao. Dữ liệu được ghi thẳng vào Redis bộ nhớ tạm với độ trễ phản hồi dưới 1ms, không ghi Database đồng bộ. Hệ thống tự động kích hoạt điều phối thông báo vi phạm sang Go WebSocket Hub (QuickNotify), kiểm tra giới hạn vi phạm (`maxViolations`) và tự động khóa bài/đình chỉ thi cưỡng chế (`DISQUALIFIED`) nếu vượt ngưỡng.
- **Quyền hạn:** `All (Student/Guest)` (Sở hữu phiên thi tương ứng)
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "attemptId": "f78d10b4-374e-4b68-b789-98246e72b4f9",
    "violationType": "DEVTOOLS_OPEN",
    "description": "Thí sinh mở công cụ kiểm tra DevTools F12",
    "evidenceUrl": "https://res.cloudinary.com/quicktest-cloud/image/upload/v1/quick-test/proctoring/f78d10b4/ev1.jpg",
    "snapshotBase64": null,
    "timestamp": "2026-11-13T11:24:10"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Vi phạm đã được ghi nhận vào hệ thống giám sát.",
    "data": {
      "attemptId": "f78d10b4-374e-4b68-b789-98246e72b4f9",
      "violationType": "DEVTOOLS_OPEN",
      "violationCount": 3,
      "maxAllowed": 5,
      "remainingAllowed": 2,
      "disqualified": false,
      "message": "Cảnh báo: Bạn đã vi phạm 3/5 lần quy chế thi!",
      "timestamp": "2026-11-13T11:24:10"
    },
    "timestamp": "2026-11-13T11:24:10.025"
  }
  ```
- **Tự động đình chỉ (Auto-Disqualification):**
  - Khi `violationCount >= maxAllowed`, cờ `disqualified` trả về `true`. Trạng thái phiên thi chuyển thành `DISQUALIFIED`, toàn bộ bài làm nháp trong Redis được đóng gói gửi sang RabbitMQ để chấm dứt phiên thi ngay lập tức.

#### 7.1. Giáo viên giám sát phòng thi realtime (`GET /api/teacher/proctoring/exams/{examId}/attempts`)
- **Mô tả:** Xem danh sách thí sinh đang thi, tình trạng kết nối (ONLINE / OFFLINE), số lần vi phạm (`violationCount`), tiến độ nộp bài.
- **Quyền hạn:** `TEACHER`
- **Query Params:** `status`, `search`, `page`, `size`
- **Response (200 OK):** `PageResponse<AttemptMonitorResponse>`

#### 7.2. Xem lịch sử vi phạm của thí sinh (`GET /api/teacher/proctoring/attempts/{attemptId}/violations`)
- **Mô tả:** Xem toàn bộ audit logs chi tiết về các lần vi phạm của 1 thí sinh theo thời gian.
- **Quyền hạn:** `TEACHER`
- **Response (200 OK):** `List<ViolationLogResponse>`

#### 7.3. Xem viễn trắc telemetry của thí sinh (`GET /api/teacher/proctoring/attempts/{attemptId}/status`)
- **Mô tả:** Xem tỷ lệ tập trung màn hình (`focusPercentage`), heartbeat cuối, thời gian mất kết nối.
- **Quyền hạn:** `TEACHER`
- **Response (200 OK):** `AttemptRealtimeStatusResponse`

#### 7.4. Đình chỉ thi thí sinh (`POST /api/teacher/proctoring/attempts/{attemptId}/disqualify`)
- **Mô tả:** Giáo viên hủy quyền thi cưỡng chế của thí sinh vi phạm nặng. Bài thi chuyển sang `DISQUALIFIED` với điểm 0.0.
- **Quyền hạn:** `TEACHER`
- **Request Body:** `{ "reason": "Phát hiện tra cứu tài liệu nhiều lần" }`
- **Response (200 OK):** `"Candidate has been successfully disqualified"`

#### 7.5. Lấy vé giám sát thời gian thực & địa chỉ QuickNotify Go Hub (`GET /api/teacher/proctoring/exams/{examId}/realtime-token`)
- **Mô tả:** Cấp vé bảo mật JWT thời gian thực (Realtime Entry Ticket) kèm đường dẫn kết nối WebSocket đến trung tâm điều phối sự kiện QuickNotify (Go Hub). Giúp màn hình giám sát của giáo viên tiếp nhận thông báo vi phạm viễn trắc ngay tức thì (Push model) với độ trễ cực thấp.
- **Quyền hạn:** `TEACHER` (Chủ sở hữu đề thi)
- **Headers:** `Authorization: Bearer <teacher_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Realtime token generated successfully",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZWFjaGVyX2FsaWNlIi...",
      "realtimeToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZWFjaGVyX2FsaWNlIi...",
      "wsUrl": "wss://notify.quicktest.app/ws/events",
      "realtimeWsUrl": "wss://notify.quicktest.app/ws/events",
      "topic": "exam_monitor_b3e098df-8fa2-4be1-8b29-e85df6a94b41"
    },
    "timestamp": "2026-11-13T11:25:00.000"
  }
  ```

#### 7.6. Lấy chi tiết lịch sử vi phạm kèm phân tích nguồn dữ liệu (`GET /api/teacher/proctoring/attempts/{attemptId}/violations/detailed`)
- **Mô tả:** Lấy toàn bộ nhật ký vi phạm viễn trắc của một lượt thi kèm chỉ thị nguồn gốc dữ liệu: `REDIS_LIVE` (lấy dữ liệu tươi từ bộ nhớ đệm RAM nếu thí sinh đang làm bài) hoặc `POSTGRESQL_FINAL` (truy vấn dữ liệu đã chốt lưu trữ vĩnh viễn trong CSDL sau khi nộp bài).
- **Quyền hạn:** `TEACHER` (Chủ sở hữu đề thi)
- **Headers:** `Authorization: Bearer <teacher_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Detailed violations retrieved successfully",
    "data": {
      "attemptId": "f78d10b4-374e-4b68-b789-98246e72b4f9",
      "source": "REDIS_LIVE",
      "violationCount": 2,
      "status": "IN_PROGRESS",
      "violations": [
        {
          "violationType": "TAB_SWITCH",
          "description": "Thí sinh chuyển sang tab khác",
          "evidenceUrl": "https://res.cloudinary.com/.../ev1.jpg",
          "timestamp": "2026-11-13T10:30:15"
        },
        {
          "violationType": "MULTIPLE_FACES",
          "description": "Phát hiện có nhiều hơn một khuôn mặt trước màn hình",
          "evidenceUrl": "https://res.cloudinary.com/.../ev2.jpg",
          "timestamp": "2026-11-13T10:32:40"
        }
      ]
    },
    "timestamp": "2026-11-13T11:25:30.000"
  }
  ```

---

### Module 8: Chấm Điểm Theo Thí Sinh (Attempt-Centric Grading)

#### 8.1. Lấy danh sách bài thi cần chấm (`GET /api/teacher/grading/exams/{examId}/attempts`)
- **Mô tả:** Lấy danh sách bài thi của các học sinh, lọc theo `status` (`AWAITING_MANUAL_GRADING`, `SUBMITTED`).
- **Quyền hạn:** `TEACHER`
- **Response (200 OK):** `PageResponse<AttemptSummaryResponse>`

#### 8.2. Chi tiết bài làm của 1 thí sinh (`GET /api/teacher/grading/attempts/{attemptId}`)
- **Mô tả:** Xem câu trả lời của 1 thí sinh cho toàn bộ bài thi kèm biểu điểm rubric của giáo viên.
- **Quyền hạn:** `TEACHER`
- **Response (200 OK):** `AttemptGradingDetailResponse`

#### 8.3. Lưu điểm tự luận theo bài thi (`POST /api/teacher/grading/attempts/submit-grades`)
- **Mô tả:** Giáo viên chấm điểm và nhập feedback cho các câu tự luận của 1 học sinh cụ thể.
- **Quyền hạn:** `TEACHER`
- **Request Body:**
  ```json
  {
    "attemptId": "a93e3d64-e5e3-4d64-8ee1-d309be0d23aa",
    "grades": [
      {
        "candidateAnswerId": "b18274a2-1111-...",
        "awardedScore": 3.5,
        "teacherFeedback": "Nêu đủ ý nhưng cần phân tích sâu hơn."
      }
    ]
  }
  ```
- **Response (200 OK):** `GradingResultResponse`

#### 8.4. Thống kê tổng quan các phiên thi (`GET /api/teacher/grading/exams/{examId}/stats`)
- **Mô tả:** Lấy toàn bộ chỉ số tổng hợp về các lượt thi của đề thi: tổng số lượt thi, phân loại trạng thái (đã nộp, chờ chấm, đang làm, đình chỉ), điểm trung bình / cao nhất / thấp nhất, số bài có vi phạm, thời gian làm bài trung bình / tối đa / tối thiểu.
- **Quyền hạn:** `TEACHER` (chỉ xem đề của chính mình)
- **Path Variable:** `examId` (UUID)
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Exam statistics computed successfully",
    "data": {
      "totalAttempts": 45,
      "completedAttempts": 40,
      "pendingGradingAttempts": 5,
      "inProgressAttempts": 0,
      "disqualifiedAttempts": 1,
      "averageScore": 7.85,
      "highestScore": 10.0,
      "lowestScore": 3.5,
      "gradedCount": 40,
      "totalViolations": 12,
      "maxViolations": 5,
      "attemptsWithViolations": 4,
      "averageDurationSeconds": 1820.5,
      "maxDurationSeconds": 2700,
      "minDurationSeconds": 950
    },
    "timestamp": "2026-09-18T12:00:00"
  }
  ```

#### 8.5. Xuất file Excel danh sách phiên thi (`GET /api/teacher/grading/exams/{examId}/attempts/export-excel`)
- **Mô tả:** Xuất toàn bộ danh sách phiên thi của đề thi ra file bảng tính Excel (`.xlsx`) được định dạng chuyên nghiệp.
  - **Khối thông tin đề thi (Banner Overview):** Tên kỳ thi, mã phòng thi, thời lượng, điểm tối đa, tổng số câu hỏi, tổng số lượt thi, thống kê điểm số (trung bình, cao nhất, thấp nhất), bộ lọc đang áp dụng.
  - **Bảng dữ liệu chi tiết (17 cột):** STT, Mã phiên thi, Họ và tên thí sinh, Email / Định danh, Loại thí sinh (Thành viên / Tự do), Trạng thái (Đang làm bài, Đã nộp bài, Chờ chấm tự luận, Bị đình chỉ), Điểm đạt được, Điểm tối đa, Tỷ lệ %, Số câu đã làm, Thời gian bắt đầu, Thời gian nộp bài, Thời gian làm bài, Số vi phạm, Bị đình chỉ, Địa chỉ IP, Thiết bị / Trình duyệt.
  - Hỗ trợ các tham số lọc: `status` (lọc theo trạng thái) và `search` (tìm kiếm theo tên, email, định danh thí sinh).
- **Quyền hạn:** `TEACHER` (chỉ xuất đề do chính mình tạo)
- **Path Variable:** `examId` (UUID)
- **Query Params (Tùy chọn):**
  - `status` (`IN_PROGRESS` | `SUBMITTED` | `AWAITING_MANUAL_GRADING` | `DISQUALIFIED`)
  - `search` (chuỗi ký tự tìm kiếm)
- **Headers:** `Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Response (200 OK):** Binary file stream (`.xlsx`), header `Content-Disposition: attachment; filename="Exam_Attempts_{examId}.xlsx"`

#### 8.6. Xuất file Excel bài làm riêng lẻ của 1 thí sinh (`GET /api/teacher/grading/attempts/{attemptId}/export-excel`)
- **Mô tả:** Xuất chi tiết bài làm của một thí sinh cụ thể ra file bảng tính Excel (`.xlsx`) phục vụ lưu trữ hồ sơ, in ấn hoặc gửi bảng điểm cho học sinh/phụ huynh.
  - **Khối thông tin tổng quan (Header Banner):**
    - Thông tin thí sinh: Họ và tên, Email/Mã định danh, Loại tài khoản (Thành viên / Tự do), Địa chỉ IP và Thiết bị (User Agent).
    - Thông tin bài thi: Tên bài thi, Mã phòng thi, Trạng thái nộp bài, Thời gian bắt đầu và nộp bài, Tổng thời gian làm bài thực tế, Ghi nhận vi phạm giám sát (số lần vi phạm, tình trạng đình chỉ).
    - Kết quả đạt được nổi bật: Tổng điểm đạt được / Tổng điểm đề thi, Tỷ lệ %, Số câu đã trả lời / Tổng số câu hỏi.
  - **Bảng chi tiết từng câu hỏi (10 cột):**
    1. STT (Câu số theo đề thi)
    2. Loại câu hỏi (Trắc nghiệm 1 đáp án, Trắc nghiệm nhiều đáp án, Điền số, Tự luận)
    3. Nội dung câu hỏi (bật text wrapping)
    4. Câu trả lời của thí sinh (các phương án đã chọn dạng `A. Nội dung`, hoặc văn bản tự luận/số thí sinh nhập)
    5. Đáp án đúng / Đáp án chuẩn (các phương án đúng, hoặc đáp án mẫu / tiêu chí rubric)
    6. Điểm tối đa của câu hỏi
    7. Điểm đạt được
    8. Tỷ lệ %
    9. Trạng thái chấm (Tự động chấm, Giáo viên đã chấm, Chờ chấm tự luận)
    10. **Nhận xét của giáo viên (Teacher Feedback)** kèm giải thích chấm của AI nếu có
  - **Dòng tổng kết (Summary Row):** Tổng kết điểm tối đa đề thi, tổng điểm đạt được, tỷ lệ % chung toàn bài.
- **Quyền hạn:** `TEACHER` (chỉ xuất bài làm thuộc đề thi của chính mình)
- **Path Variable:** `attemptId` (UUID)
- **Headers:** `Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Response (200 OK):** Binary file stream (`.xlsx`), header `Content-Disposition: attachment; filename="Attempt_{attemptId}.xlsx"`

---

### Module 9: Chấm Điểm Tự Luận Tập Trung Theo Câu Hỏi & AI Grading (Question-Centric & Gemini AI)

#### 9.1. Lấy danh sách câu hỏi cần chấm (`GET /api/teacher/grading/exams/{examId}/questions`)
- **Mô tả:** Lấy thông tin tóm tắt đề thi (`examId`, `examTitle`, `examStatus`, `totalEssayQuestions`) cùng toàn bộ danh sách câu hỏi tự luận (`ESSAY_TEXT`) kèm thống kê số lượng bài chờ chấm (`pendingCount`), đã chấm (`gradedCount`), và tổng số bài (`totalSubmissions`). Giúp Frontend hiển thị tiêu đề và trạng thái trực tiếp mà không cần thêm một lượt gọi `GET /api/teacher/exams/{id}` (loại bỏ overfetching toàn bộ cây câu hỏi và options).
- **Quyền hạn:** `TEACHER`
- **Path Variable:** `examId` (UUID)
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Essay questions retrieved successfully",
    "data": {
      "examId": "7662cbf7-fffa-4da6-a6fe-4fbe9cf2bbf6",
      "examTitle": "Kỳ thi Cuối kỳ Lịch sử 12",
      "examStatus": "PUBLISHED",
      "totalEssayQuestions": 1,
      "questions": [
        {
          "questionId": "7662cbf7-fffa-4da6-a6fe-4fbe9cf2bbf6",
          "orderIndex": 1,
          "content": "Phân tích nguyên nhân thắng lợi của Cách mạng Tháng Tám 1945.",
          "imageUrl": null,
          "maxPoints": 4.0,
          "pendingCount": 15,
          "gradedCount": 25,
          "totalSubmissions": 40
        }
      ]
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 9.2. Xem biểu điểm và bài làm học sinh theo câu hỏi (`GET /api/teacher/grading/questions/{questionId}/submissions`)
- **Mô tả:** Hiển thị chi tiết đề bài, thang điểm `maxPoints`, đáp án tham khảo `sampleAnswer`, tiêu chí chấm `gradingRubric` và danh sách bài làm của các thí sinh (có phân trang và lọc theo trạng thái).
- **Quyền hạn:** `TEACHER`
- **Path Variable:** `questionId` (UUID)
- **Query Params:**
  - `status` (optional): `PENDING_MANUAL` hoặc `GRADED`
  - `page` (default: 0)
  - `size` (default: 10)
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Submissions for question retrieved successfully",
    "data": {
      "questionId": "7662cbf7-fffa-4da6-a6fe-4fbe9cf2bbf6",
      "orderIndex": 1,
      "content": "Phân tích nguyên nhân thắng lợi của Cách mạng Tháng Tám 1945.",
      "imageUrl": null,
      "sampleAnswer": "Nguyên nhân chủ quan: Đảng lãnh đạo, khối đại đoàn kết. Khách quan: Phát xít Nhật đầu hàng Đồng minh.",
      "gradingRubric": "Nguyên nhân chủ quan (2.5đ), nguyên nhân khách quan (1.5đ).",
      "maxPoints": 4.0,
      "submissions": {
        "content": [
          {
            "candidateAnswerId": "f901823a-5555-...",
            "attemptId": "a93e3d64-e5e3-...",
            "candidateName": "Tran Thi B",
            "studentIdentifier": "student_b@quicktest.com",
            "submittedAt": "2026-09-12T12:35:00",
            "textAnswer": "Cách mạng thành công nhờ sự chuẩn bị chu đáo và thời cơ ngàn năm có một khi phát xít Nhật đầu hàng...",
            "awardedScore": null,
            "teacherFeedback": null,
            "gradingStatus": "PENDING_MANUAL"
          }
        ],
        "pageNumber": 0,
        "pageSize": 10,
        "totalElements": 15,
        "totalPages": 2,
        "last": false
      }
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 9.3. Lưu điểm chấm tay hàng loạt theo câu hỏi (`POST /api/teacher/grading/questions/{questionId}/manual`)
- **Mô tả:** Giáo viên chấm điểm và nhập nhận xét cho 1 hoặc nhiều bài làm cùng lúc.
- **Cơ chế tính điểm tự động:** Hệ thống kiểm tra các bài thi liên quan (`ExamAttempt`), nếu không còn bất kỳ câu hỏi nào mang trạng thái `PENDING_MANUAL`, hệ thống tự động:
  1. Tính tổng điểm `totalScore = SUM(awardedScore)`.
  2. Chuyển trạng thái sang `SUBMITTED`.
  3. Đồng bộ vào Redis Cache cho thí sinh tra cứu tức thì.
- **Quyền hạn:** `TEACHER`
- **Request Body:**
  ```json
  {
    "items": [
      {
        "candidateAnswerId": "f901823a-5555-...",
        "awardedScore": 3.5,
        "teacherFeedback": "Phân tích đúng trọng tâm, dẫn chứng lịch sử rõ ràng."
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Successfully saved grades for 1 submission(s). 1 exam attempt(s) finalized.",
    "data": {
      "gradedCount": 1,
      "finalizedAttemptsCount": 1,
      "message": "Successfully saved grades for 1 submission(s). 1 exam attempt(s) finalized."
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 9.4. Kích hoạt Google Gemini chấm tự động theo Batch (`POST /api/teacher/grading/trigger-ai`)
- **Mô tả:** Kích hoạt tiến trình bất đồng bộ (`@Async`) chạy ngầm. Hệ thống gom bài thi thành từng nhóm nhỏ (`batchSize`, mặc định 5 bài/lần), gửi kèm biểu điểm và đáp án mẫu sang Google Gemini v1beta API với JSON Schema chặt chẽ.
- **Quyền hạn:** `TEACHER`
- **Scope hỗ trợ:**
  - `SINGLE_QUESTION`: Chấm riêng cho câu hỏi chỉ định (`questionId` bắt buộc).
  - `ENTIRE_EXAM`: Chấm toàn bộ các câu tự luận có trong đề thi (`questionId` không bắt buộc).
- **Request Body:**
  ```json
  {
    "examId": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
    "questionId": "7662cbf7-fffa-4da6-a6fe-4fbe9cf2bbf6",
    "scope": "SINGLE_QUESTION",
    "batchSize": 5
  }
  ```
- **Response (202 Accepted):**
  ```json
  {
    "status": 200,
    "message": "AI grading scheduled for 1 essay question(s) with 15 submission(s) using batch size 5.",
    "data": {
      "status": "ACCEPTED",
      "message": "AI grading scheduled for 1 essay question(s) with 15 submission(s) using batch size 5.",
      "totalQuestionsScheduled": 1,
      "totalSubmissionsScheduled": 15
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 8.11. Chấm điểm tự động 1 câu trả lời tự luận bằng AI (`POST /api/teacher/grading/answers/{candidateAnswerId}/ai`)
- **Mô tả:** Giáo viên yêu cầu Google Gemini AI đánh giá và chấm điểm tự động cho một câu trả lời tự luận đơn lẻ (`CandidateAnswer`). AI phân tích câu trả lời của thí sinh đối chiếu với đáp án mẫu và tiêu chí chấm (rubric), trả về điểm số đề xuất và nhận xét chi tiết.
- **Quyền hạn:** `TEACHER` (Chủ sở hữu đề thi)
- **Headers:** `Authorization: Bearer <teacher_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Candidate answer evaluated by AI successfully",
    "data": {
      "candidateAnswerId": "d982b17a-2110-4fa8-b648-912a74cbe112",
      "awardedScore": 1.75,
      "feedback": "Thí sinh trình bày đầy đủ bản chất của cơ chế phiên mã và dịch mã. Tuy nhiên còn thiếu một số bước chi tiết về giai đoạn kết thúc dịch mã (Stop Codon)."
    },
    "timestamp": "2026-11-13T11:26:00.000"
  }
  ```
- **Error Responses:**
  - `404 Not Found`: Không tìm thấy câu trả lời với ID đã cho.
  - `400 Bad Request`: Câu trả lời không thuộc dạng tự luận (`ESSAY_TEXT`).

---

### Module 10: Quản Trị Hệ Thống (Admin Management & System Analytics)

#### 10.1. Xem thống kê Dashboard toàn hệ thống (`GET /api/admin/dashboard`)
- **Mô tả:** Trả về số liệu tổng quan hệ sinh thái: thống kê người dùng theo vai trò, trạng thái hoạt động; thống kê đề thi theo trạng thái vòng đời; số lượt thi nộp bài, chờ chấm, bị đình chỉ; và 10 nhật ký vi phạm gian lận mới nhất.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Admin dashboard statistics retrieved successfully",
    "data": {
      "totalUsers": 120,
      "totalTeachers": 15,
      "totalStudents": 103,
      "totalAdmins": 2,
      "activeUsers": 118,
      "inactiveUsers": 2,
      "totalExams": 24,
      "draftExams": 4,
      "publishedExams": 12,
      "closedExams": 7,
      "archivedExams": 1,
      "totalAttempts": 450,
      "inProgressAttempts": 30,
      "submittedAttempts": 400,
      "awaitingGradingAttempts": 15,
      "disqualifiedAttempts": 5,
      "totalViolations": 28,
      "recentViolations": [
        {
          "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "attemptId": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
          "candidateName": "Nguyen Van A",
          "candidateIdentifier": "student01@quicktest.com",
          "examId": "7662cbf7-fffa-4da6-a6fe-4fbe9cf2bbf6",
          "examTitle": "Midterm Examination",
          "violationType": "TAB_SWITCH",
          "description": "Candidate switched browser tab",
          "timestamp": "2026-09-12T10:15:30"
        }
      ]
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 10.2. Danh sách người dùng hệ thống (`GET /api/admin/users`)
- **Mô tả:** Phân trang và tìm kiếm danh sách người dùng toàn hệ sinh thái. Hỗ trợ lọc theo `role` (`TEACHER`, `STUDENT`, `ADMIN`), `isActive` (`true`, `false`), hoặc từ khóa `search`.
- **Quyền hạn:** `ADMIN`
- **Query Params:** `role`, `isActive`, `search`, `page`, `size`, `sort`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Users retrieved successfully",
    "data": {
      "content": [
        {
          "id": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
          "username": "teacher_alice",
          "email": "alice@quicktest.com",
          "fullName": "Alice Johnson",
          "role": "TEACHER",
          "isActive": true,
          "createdAt": "2026-09-10T08:00:00",
          "lastLoginAt": "2026-09-12T09:30:00"
        }
      ],
      "page": 0,
      "size": 20,
      "totalElements": 1,
      "totalPages": 1,
      "isFirst": true,
      "isLast": true,
      "hasNext": false,
      "hasPrevious": false
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 10.3. Chi tiết người dùng (`GET /api/admin/users/{id}`)
- **Mô tả:** Lấy thông tin chi tiết một tài khoản người dùng theo UUID.
- **Quyền hạn:** `ADMIN`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "User details retrieved successfully",
    "data": {
      "id": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
      "username": "teacher_alice",
      "email": "alice@quicktest.com",
      "fullName": "Alice Johnson",
      "role": "TEACHER",
      "isActive": true,
      "createdAt": "2026-09-10T08:00:00",
      "lastLoginAt": "2026-09-12T09:30:00"
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 10.4. Bật/Tắt trạng thái hoạt động người dùng (`PATCH /api/admin/users/{id}/toggle-status`)
- **Mô tả:** Vô hiệu hóa hoặc kích hoạt lại tài khoản người dùng. Hệ thống tự động chặn quản trị viên tự vô hiệu hóa tài khoản của chính mình.
- **Quyền hạn:** `ADMIN`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "User deactivated successfully",
    "data": {
      "id": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
      "username": "student_bob",
      "role": "STUDENT",
      "isActive": false
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 10.5. Cập nhật vai trò người dùng (`PATCH /api/admin/users/{id}/role`)
- **Mô tả:** Phân quyền vai trò mới cho người dùng (`TEACHER`, `STUDENT`, `ADMIN`). Ngăn chặn admin tự hạ quyền mình hoặc tước quyền ADMIN của quản trị viên duy nhất còn lại trong hệ thống.
- **Quyền hạn:** `ADMIN`
- **Request Body:**
  ```json
  {
    "role": "TEACHER"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "User role updated successfully to TEACHER",
    "data": {
      "id": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
      "role": "TEACHER"
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 10.5. Tạo tài khoản người dùng mới trực tiếp (`POST /api/admin/users`)
- **Mô tả:** Quản trị viên khởi tạo tài khoản người dùng mới trực tiếp trong hệ thống với bất kỳ vai trò nào (`ADMIN`, `TEACHER`, `STUDENT`).
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "username": "teacher_david",
    "email": "david.teacher@quicktest.edu",
    "fullName": "David Tran",
    "password": "InitialSecurePassword@2026",
    "role": "TEACHER"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "User created successfully",
    "data": {
      "id": "e43b1790-21a4-4df8-bfa3-0192a74be110",
      "username": "teacher_david",
      "email": "david.teacher@quicktest.edu",
      "fullName": "David Tran",
      "role": "TEACHER",
      "isActive": true,
      "authProvider": "LOCAL",
      "createdAt": "2026-11-13T11:27:00",
      "lastLoginAt": null
    },
    "timestamp": "2026-11-13T11:27:00.000"
  }
  ```

#### 10.6. Cập nhật hồ sơ tài khoản người dùng (`PUT /api/admin/users/{id}/profile`)
- **Mô tả:** Quản trị viên cập nhật thông tin hiển thị (họ tên, email, tên đăng nhập) của một tài khoản người dùng bất kỳ.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "fullName": "David Tran M.Sc",
    "email": "david.tran.new@quicktest.edu",
    "username": "teacher_david"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "User profile updated successfully",
    "data": {
      "id": "e43b1790-21a4-4df8-bfa3-0192a74be110",
      "username": "teacher_david",
      "email": "david.tran.new@quicktest.edu",
      "fullName": "David Tran M.Sc",
      "role": "TEACHER",
      "isActive": true,
      "authProvider": "LOCAL",
      "createdAt": "2026-11-13T11:27:00",
      "lastLoginAt": null
    },
    "timestamp": "2026-11-13T11:27:30.000"
  }
  ```

#### 10.7. Đặt lại mật khẩu tài khoản người dùng (`PUT /api/admin/users/{id}/password`)
- **Mô tả:** Quản trị viên thực hiện đặt lại mật khẩu trực tiếp cho một tài khoản người dùng khi được yêu cầu hỗ trợ khôi phục tài khoản.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "newPassword": "NewAdminAssignedPassword@2026"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Password reset successfully",
    "data": null,
    "timestamp": "2026-11-13T11:28:00.000"
  }
  ```

#### 10.6. Danh sách toàn bộ đề thi hệ thống (`GET /api/admin/exams`)
- **Mô tả:** Xem danh sách toàn bộ đề thi của tất cả các giáo viên, kèm số lượt thi thực tế và thông tin người tạo. Hỗ trợ lọc theo `status` (`DRAFT`, `PUBLISHED`, `CLOSED`, `ARCHIVED`) hoặc từ khóa `search`.
- **Quyền hạn:** `ADMIN`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Exams retrieved successfully",
    "data": {
      "content": [
        {
          "id": "7662cbf7-fffa-4da6-a6fe-4fbe9cf2bbf6",
          "title": "Kỳ thi Cuối kỳ Java Spring Boot",
          "accessCode": "JAVA2026",
          "status": "PUBLISHED",
          "durationMinutes": 60,
          "maxAttempts": 1,
          "totalQuestions": 25,
          "totalAttempts": 48,
          "createdById": "e4b1752b-7c5e-4c74-8b1e-6adbc79bfb54",
          "createdByName": "Alice Johnson",
          "createdByEmail": "alice@quicktest.com",
          "createdAt": "2026-09-10T08:00:00"
        }
      ],
      "page": 0,
      "size": 20,
      "totalElements": 1,
      "totalPages": 1
    },
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 10.7. Chi tiết đề thi (`GET /api/admin/exams/{id}`)
- **Mô tả:** Xem chi tiết toàn bộ cấu hình, danh sách câu hỏi, đáp án của đề thi.
- **Quyền hạn:** `ADMIN`
- **Response (200 OK):** Tương tự cấu trúc chi tiết đề thi giáo viên (`ExamDetailResponse`).

#### 10.8. Đóng khẩn cấp đề thi (`PATCH /api/admin/exams/{id}/close`)
- **Mô tả:** Cưỡng chế chuyển trạng thái đề thi sang `CLOSED`, ngăn chặn thí sinh mới tiếp tục vào làm bài.
- **Quyền hạn:** `ADMIN`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Exam force-closed successfully",
    "data": null,
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

#### 10.9. Xóa đề thi (`DELETE /api/admin/exams/{id}`)
- **Mô tả:** Xóa đề thi khỏi hệ thống. Chỉ cho phép xóa khi đề thi ở trạng thái `DRAFT` hoặc `CLOSED` và chưa có bất kỳ bài nộp (attempt) nào của thí sinh nhằm bảo vệ toàn vẹn dữ liệu điểm số.
- **Quyền hạn:** `ADMIN`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Exam deleted successfully",
    "data": null,
    "timestamp": "2026-09-12T12:00:00"
  }
  ```

---

### Module 11: Lịch Sử Thi & Xem Lại Bài Làm Của Sinh Viên (Student Attempt History & Review)

Cung cấp cho thí sinh (học sinh / sinh viên đã đăng ký) khả năng tự theo dõi toàn diện tiến trình học tập, lịch sử các bài thi đã làm, điểm số đạt được, xem lại đáp án chi tiết từng câu hỏi (câu trắc nghiệm, tự luận, điền số) và minh bạch nhật ký vi phạm quy chế phòng thi.

#### 11.1. Lấy danh sách lịch sử thi của sinh viên (`GET /api/student/attempts`)
- **Mô tả:** Trả về danh sách tóm tắt tất cả các lượt làm bài của sinh viên đang đăng nhập, hỗ trợ phân trang chuẩn Spring Data JPA và sắp xếp theo thời gian bắt đầu mới nhất (`startTime DESC`).
- **Quyền hạn:** `STUDENT`, `TEACHER`, `ADMIN` (Được bảo vệ bởi JWT, tự động trích xuất `userId` từ token, sinh viên chỉ thấy bài thi của chính mình).
- **Headers:** `Authorization: Bearer <student_token>`
- **Query Parameters:**
  - `page` (integer, optional, default: 0): Số thứ tự trang (0-indexed).
  - `size` (integer, optional, default: 10): Số lượng bản ghi mỗi trang.
  - `sort` (string, optional, default: `startTime,desc`): Tiêu chí sắp xếp.
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Attempt history retrieved successfully",
    "data": {
      "content": [
        {
          "attemptId": "c29a7eb0-2890-4283-b76b-7feca554cf08",
          "examId": "e1f7a220-410a-4712-a17a-8f972b9a7101",
          "examTitle": "Kỳ thi thử THPT Quốc Gia môn Toán 2026",
          "startTime": "2026-09-18T10:15:00",
          "submitTime": "2026-09-18T11:00:00",
          "status": "SUBMITTED",
          "awardedScore": 6.5,
          "maxScore": 7.0,
          "violationCount": 0
        },
        {
          "attemptId": "2fd7961d-e6e7-4a1b-9c61-9a4ea6a321dd",
          "examId": "a8bf1160-c8e3-494c-9ebe-303352f81ce1",
          "examTitle": "Exam With Strict Proctoring (Limit 2)",
          "startTime": "2026-09-18T12:00:00",
          "submitTime": "2026-09-18T12:35:00",
          "status": "SUBMITTED",
          "awardedScore": 0.0,
          "maxScore": 10.0,
          "violationCount": 2
        }
      ],
      "page": 0,
      "size": 10,
      "totalElements": 33,
      "totalPages": 4,
      "isFirst": true,
      "isLast": false,
      "hasNext": true,
      "hasPrevious": false
    },
    "timestamp": "2026-09-19T12:00:00"
  }
  ```

#### 11.2. Xem chi tiết bài làm, đáp án & giám sát quy chế (`GET /api/student/attempts/{attemptId}`)
- **Mô tả:** Trả về toàn bộ chi tiết của bài thi đã nộp: điểm số đạt được, thang điểm tối đa, thời gian hoàn thành (`durationSeconds`), danh sách câu hỏi kèm đáp án thí sinh đã nộp, và nhật ký vi phạm telemetry.
  - **Cơ chế bảo vệ đề thi (`showResultsToStudents`):**
    - **Nếu `true`:** Hiển thị điểm thi (`awardedScore`, `maxScore`), điểm từng câu (`points`, `awardedScore`), trạng thái chấm (`gradingStatus`), đáp án đúng (`isCorrect`), đáp án mẫu (`sampleAnswer`) và nhận xét của giáo viên (`teacherFeedback`).
    - **Nếu `false`:** Hệ thống tự động che giấu (mask) toàn bộ đáp án đúng (`isCorrect = null`), điểm số (`awardedScore = null`, `maxScore = null`, `points = null`), đáp án mẫu và nhận xét để ngăn chặn lộ đề thi hoặc đáp án cho người khác. Học sinh chỉ thấy câu hỏi và câu trả lời mà mình đã nộp (`isSelected`, `textAnswer`).
- **Quyền hạn:** `STUDENT`, `TEACHER`, `ADMIN` (Kiểm tra nghiêm ngặt quyền sở hữu: sinh viên chỉ được xem chi tiết bài làm của chính mình).
- **Headers:** `Authorization: Bearer <student_token>`
- **Path Variables:**
  - `attemptId` (UUID, required): Mã định danh lượt thi cần xem.
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Attempt details retrieved successfully",
    "data": {
      "attemptId": "c29a7eb0-2890-4283-b76b-7feca554cf08",
      "examId": "e1f7a220-410a-4712-a17a-8f972b9a7101",
      "examTitle": "Kỳ thi thử THPT Quốc Gia môn Toán 2026",
      "accessCode": "MATH-2026",
      "status": "SUBMITTED",
      "showResultsToStudents": true,
      "awardedScore": 6.5,
      "maxScore": 7.0,
      "startTime": "2026-09-18T10:15:00",
      "submitTime": "2026-09-18T11:00:00",
      "durationSeconds": 2700,
      "violationCount": 1,
      "violations": [
        {
          "id": "66597854-c177-48d4-8e54-6e8e32161e57",
          "violationType": "TAB_SWITCH",
          "description": "Switched to browser tab",
          "timestamp": "2026-09-18T10:35:12"
        }
      ],
      "questions": [
        {
          "questionId": "db2e451a-3b2a-41f2-bf41-766894c08153",
          "orderIndex": 1,
          "content": "Giá trị của tích phân $\\int_0^1 x dx$ bằng bao nhiêu?",
          "imageUrl": null,
          "questionType": "SINGLE_CHOICE",
          "points": 1.0,
          "awardedScore": 1.0,
          "gradingStatus": "GRADED",
          "textAnswer": null,
          "sampleAnswer": null,
          "teacherFeedback": null,
          "selectedOptionIds": [
            "a1111111-1111-1111-1111-111111111111"
          ],
          "options": [
            {
              "id": "a1111111-1111-1111-1111-111111111111",
              "content": "1/2",
              "imageUrl": null,
              "orderIndex": 1,
              "isCorrect": true,
              "isSelected": true
            },
            {
              "id": "b2222222-2222-2222-2222-222222222222",
              "content": "1",
              "imageUrl": null,
              "orderIndex": 2,
              "isCorrect": false,
              "isSelected": false
            }
          ]
        },
        {
          "questionId": "ec3f562b-4c3b-52f3-cf52-877905d19264",
          "orderIndex": 2,
          "content": "Trình bày phương pháp tìm cực trị của hàm số $y = f(x)$.",
          "imageUrl": null,
          "questionType": "ESSAY_TEXT",
          "points": 2.0,
          "awardedScore": 1.5,
          "gradingStatus": "GRADED",
          "textAnswer": "Bước 1: Tìm tập xác định. Bước 2: Tính đạo hàm f'(x) và giải phương trình f'(x) = 0...",
          "sampleAnswer": "1. Tìm TXĐ. 2. Tính f'(x), tìm nghiệm f'(x)=0. 3. Lập bảng biến thiên kết luận.",
          "teacherFeedback": "Trình bày tốt, cần bổ sung điều kiện đủ của dấu đạo hàm khi qua điểm cực trị.",
          "selectedOptionIds": [],
          "options": []
        }
      ]
    },
    "timestamp": "2026-09-19T12:00:00"
  }
  ```

#### 12.3. Dashboard tổng quan học tập sinh viên (`GET /api/student/dashboard`)
- **Mô tả:** Cung cấp số liệu thống kê cá nhân hóa cho sinh viên: tổng số bài thi đã tham gia, điểm trung bình toàn diện, điểm cao nhất, số bài thi đang chờ chấm tự luận, lịch sử và phân bố các lỗi vi phạm quy chế (tab switch, đa khuôn mặt, v.v.), biểu đồ hoạt động 7 ngày, danh sách đề thi của tôi (`myExams`) và đề thi công khai gợi ý (`exploreExams`).
- **Quyền hạn:** `STUDENT` (hoặc `TEACHER`, `ADMIN`)
- **Query Parameters:**
  - `refresh` (boolean, tùy chọn, mặc định `false`): Bỏ qua bộ đệm Redis để tính toán lại số liệu tươi mới nhất.
- **Headers:** `Authorization: Bearer <student_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Student dashboard retrieved successfully",
    "data": {
      "totalExamsAttempted": 8,
      "openExamsCount": 4,
      "activeSessionsCount": 0,
      "completedAttemptsCount": 12,
      "totalAttemptsCount": 12,
      "submittedAttemptsCount": 12,
      "inProgressAttemptsCount": 0,
      "awaitingGradingCount": 1,
      "disqualifiedAttemptsCount": 0,
      "averageScore": 8.45,
      "bestScore": 10.0,
      "totalViolations": 3,
      "attemptsWithViolations": 2,
      "violationByTypes": {
        "TAB_SWITCH": 2,
        "EXIT_FULLSCREEN": 1
      },
      "recentViolations": [
        {
          "id": "a1b2c3d4-0001-4444-8888-abcdef123456",
          "attemptId": "f78d10b4-374e-4b68-b789-98246e72b4f9",
          "studentName": "Nguyễn Văn An",
          "examTitle": "Kiểm tra Giữa kỳ Sinh học 12",
          "violationType": "TAB_SWITCH",
          "description": "Chuyển tab trình duyệt trong khi thi",
          "timestamp": "2026-11-13T10:45:22"
        }
      ],
      "dailyActivities": [
        {
          "date": "2026-11-12",
          "label": "T5",
          "attemptsCount": 2,
          "submittedCount": 2,
          "violationsCount": 0
        },
        {
          "date": "2026-11-13",
          "label": "T6",
          "attemptsCount": 1,
          "submittedCount": 1,
          "violationsCount": 1
        }
      ],
      "myExams": [
        {
          "id": "b3e098df-8fa2-4be1-8b29-e85df6a94b41",
          "title": "Kiểm tra Giữa kỳ Sinh học 12",
          "accessCode": "BIO12GK",
          "status": "PUBLISHED",
          "durationMinutes": 45,
          "attemptsCount": 1,
          "maxAttempts": 1,
          "highestScore": 9.25,
          "lastAttemptStatus": "SUBMITTED"
        }
      ],
      "exploreExams": [
        {
          "id": "a98dfb01-1122-4433-8899-001122334455",
          "title": "Khảo sát kiến thức Trí Tuệ Nhân Tạo căn bản",
          "accessCode": "AI101_OPEN",
          "status": "PUBLISHED",
          "durationMinutes": 30,
          "attemptsCount": 0,
          "maxAttempts": 5,
          "highestScore": null,
          "lastAttemptStatus": null
        }
      ]
    },
    "timestamp": "2026-11-13T11:29:00.000"
  }
  ```

---

### Module 11: Quản Trị Hệ Thống - Quản Lý Nhật Ký Tập Trung (System Logs Management)

Toàn bộ hoạt động quan trọng trong hệ thống (tạo/sửa/xóa bài thi, câu hỏi, nộp bài, đăng nhập, vi phạm viễn trắc, lỗi ngoại lệ hệ thống và tiến trình worker) được tự động ghi nhận tập trung vào bảng `system_logs` thông qua `SystemLoggingAspect` (AOP), bảo vệ thông tin nhạy cảm (auto-masking mật khẩu/token) và hỗ trợ tìm kiếm toàn văn PostgreSQL Full-Text Search (GIN index `idx_syslog_fts`) cùng phân trang 2 bước hiệu năng cao.

---

#### 47. Tìm kiếm & Lọc nhật ký hệ thống (Search System Logs)
- **Method**: `GET`
- **Endpoint**: `/api/admin/logs` (hoặc `/api/v1/admin/logs`)
- **Quyền hạn**: `ADMIN`
- **Mô tả**: Tìm kiếm toàn văn (FTS) trên các trường `module`, `action`, `actorUsername`, `ipAddress`, `actorId`, `details`, `errorMessage` kết hợp lọc theo tiêu chí `level`, `status`, `module`, `action`, `actorId`, khoảng thời gian `startDate` / `endDate`. Phân trang 2 bước: quét ID qua index GIN trước, sau đó batch-fetch entity để tối ưu băng thông và bộ nhớ.
- **Query Parameters**:
  - `search` (string, optional): Từ khóa tìm kiếm Full-Text Search.
  - `level` (string, optional): Severity (`INFO`, `WARN`, `ERROR`, `DEBUG`).
  - `status` (string, optional): Trạng thái kết quả (`SUCCESS`, `FAILURE`).
  - `module` (string, optional): Module nghiệp vụ (`ASSESSMENT`, `IAM`, `PROCTORING`, v.v.).
  - `action` (string, optional): Tên hành vi (`CREATE_EXAM`, `LOGIN`, `SUBMIT_EXAM`, v.v.).
  - `actorId` (UUID, optional): Định danh tài khoản người thực hiện.
  - `startDate` (ISO LocalDateTime, optional): Thời điểm bắt đầu lọc.
  - `endDate` (ISO LocalDateTime, optional): Thời điểm kết thúc lọc.
  - `page` (int, default: 0): Số thứ tự trang.
  - `size` (int, default: 20): Số lượng bản ghi mỗi trang.
  - `sort` (string, default: `createdAt,desc`): Thứ tự sắp xếp.
- **Request Headers**:
  ```http
  Authorization: Bearer <admin_jwt_token>
  Accept: application/json
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": 200,
    "message": "System logs retrieved successfully",
    "data": {
      "content": [
        {
          "id": "c7f99999-8888-4444-9999-1234567890ab",
          "level": "INFO",
          "module": "ASSESSMENT",
          "action": "CREATE_EXAM",
          "status": "SUCCESS",
          "actorId": "b4e0bb18-d7b5-40ef-bb71-1b63868fbd5c",
          "actorUsername": "teacher1",
          "actorRole": "TEACHER",
          "endpoint": "/api/teacher/exams",
          "httpMethod": "POST",
          "ipAddress": "192.168.1.10",
          "errorMessage": null,
          "executionTimeMs": 48,
          "createdAt": "2026-09-26T18:40:00",
          "hasDetails": true
        }
      ],
      "page": 0,
      "size": 20,
      "totalElements": 1,
      "totalPages": 1,
      "isFirst": true,
      "isLast": true,
      "hasNext": false,
      "hasPrevious": false
    },
    "timestamp": "2026-09-26T18:40:01"
  }
  ```

---

#### 48. Xem chi tiết nhật ký kiểm toán (Get System Log Detail)
- **Method**: `GET`
- **Endpoint**: `/api/admin/logs/{id}`
- **Quyền hạn**: `ADMIN`
- **Mô tả**: Xem đầy đủ dữ liệu ngữ cảnh thực thi của một bản ghi nhật ký, bao gồm toàn bộ payload chi tiết JSON (đã che các trường nhạy cảm như password/token) và ngoại lệ/stacktrace lỗi nếu có.
- **Request Headers**:
  ```http
  Authorization: Bearer <admin_jwt_token>
  Accept: application/json
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": 200,
    "message": "System log detail retrieved successfully",
    "data": {
      "id": "c7f99999-8888-4444-9999-1234567890ab",
      "level": "ERROR",
      "module": "PROCTORING",
      "action": "RECORD_VIOLATION",
      "status": "FAILURE",
      "actorId": "b4e0bb18-d7b5-40ef-bb71-1b63868fbd5c",
      "actorUsername": "student_01",
      "actorRole": "STUDENT",
      "endpoint": "/api/session/proctoring/violations",
      "httpMethod": "POST",
      "ipAddress": "14.241.12.8",
      "details": "{\"violationType\":\"TAB_SWITCH\",\"attemptId\":\"a18057c8-da00-49e1-9ada-1e4b8b62104a\"}",
      "errorMessage": "Attempt is not IN_PROGRESS (status: SUBMITTED). Rejecting violation recording.",
      "executionTimeMs": 14,
      "createdAt": "2026-09-26T18:40:00"
    },
    "timestamp": "2026-09-26T18:40:01"
  }
  ```

---

#### 49. Thống kê phân tích KPI nhật ký (Get System Log Stats)
- **Method**: `GET`
- **Endpoint**: `/api/admin/logs/stats`
- **Quyền hạn**: `ADMIN`
- **Mô tả**: Trả về số liệu phân tích tổng quan phục vụ các thẻ KPI trên Dashboard: tổng số log, số lần thành công/thất bại, tỷ lệ lỗi (error rate %), độ trễ thực thi trung bình và số lượng log phân bổ theo từng module.
- **Request Headers**:
  ```http
  Authorization: Bearer <admin_jwt_token>
  Accept: application/json
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": 200,
    "message": "System log stats retrieved successfully",
    "data": {
      "totalLogs": 1540,
      "successCount": 1480,
      "failureCount": 60,
      "errorRate": 3.9,
      "infoCount": 1420,
      "warnCount": 60,
      "errorCount": 60,
      "averageExecutionTimeMs": 42.6,
      "moduleCounts": {
        "ASSESSMENT": 620,
        "IAM": 450,
        "PROCTORING": 290,
        "STORAGE": 180
      }
    },
    "timestamp": "2026-09-26T18:40:01"
  }
  ```

---

#### 50. Danh mục module & action động (Get System Log Metadata)
- **Method**: `GET`
- **Endpoint**: `/api/admin/logs/metadata`
- **Quyền hạn**: `ADMIN`
- **Mô tả**: Lấy danh sách các module và action hiện có thực tế trong cơ sở dữ liệu để tự động điền vào các dropdown bộ lọc trên giao diện frontend.
- **Request Headers**:
  ```http
  Authorization: Bearer <admin_jwt_token>
  Accept: application/json
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": 200,
    "message": "System log metadata retrieved successfully",
    "data": {
      "modules": [
        "ADMIN_USER",
        "ASSESSMENT",
        "GRADING",
        "IAM",
        "PROCTORING",
        "STORAGE"
      ],
      "actions": [
        "CREATE_EXAM",
        "DELETE_EXAM",
        "LOGIN",
        "PUBLISH_EXAM",
        "RECORD_VIOLATION",
        "SUBMIT_EXAM",
        "UPDATE_USER_ROLE"
      ]
    },
    "timestamp": "2026-09-26T18:40:01"
  }
  ```

---

#### 51. Dọn dẹp nhật ký kiểm toán cũ (Cleanup Old System Logs)
- **Method**: `DELETE`
- **Endpoint**: `/api/admin/logs/cleanup`
- **Quyền hạn**: `ADMIN`
- **Mô tả**: Tiến hành dọn dẹp các bản ghi nhật ký kiểm toán cũ hơn số ngày quy định (mặc định 30 ngày) để giải phóng không gian lưu trữ của database.
- **Query Parameters**:
  - `days` (int, default: 30): Số ngày lưu giữ (các bản ghi trước mốc `now - days` sẽ bị xóa).
- **Request Headers**:
  ```http
  Authorization: Bearer <admin_jwt_token>
  Accept: application/json
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": 200,
    "message": "Log cleanup executed successfully",
    "data": {
      "deletedCount": 320,
      "retentionDaysKept": 30
    },
    "timestamp": "2026-09-26T18:40:01"
  }
  ```

#### 13.6. Kiểm tra tiến độ tác vụ dọn dẹp nhật ký kiểm toán (`GET /api/admin/logs/cleanup/status`)
- **Mô tả:** Lấy thông tin trạng thái, tiến độ và khối lượng bản ghi đã được dọn dẹp của tiến trình background worker dọn dẹp nhật ký cũ.
- **Endpoint alias:** Hỗ trợ cả `GET /api/v1/admin/logs/cleanup/status`.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Log cleanup status retrieved successfully",
    "data": {
      "isRunning": false,
      "totalDeleted": 14500,
      "estimatedRemaining": 0,
      "retentionDaysKept": 30,
      "batchSize": 500,
      "cutoff": "2026-10-14T00:00:00",
      "startedAt": "2026-11-13T02:00:00",
      "finishedAt": "2026-11-13T02:03:15",
      "status": "COMPLETED",
      "message": "Cleanup completed successfully. 14,500 logs purged."
    },
    "timestamp": "2026-11-13T11:30:00.000"
  }
  ```

---

### Module 11: Soạn Đề Thi Tự Động Bằng AI (Teacher AI Document Quiz Generation)

#### 52. Đưa tài liệu vào hàng đợi tạo đề ngầm (`POST /api/teacher/ai-generate/from-document`)
- **Mô tả:** Tải lên tệp tài liệu bài học (PDF, DOCX, TXT) hoặc nhập nội dung văn bản trực tiếp. Hệ thống xác thực kiểm tra khóa đơn luồng người dùng (mỗi giáo viên chỉ chạy 1 tác vụ AI tại một thời điểm), sau đó đưa tác vụ vào hàng đợi đơn luồng xử lý ngầm và trả về mã tiến trình ngay lập tức.
- **Quyền hạn:** `TEACHER`, `ADMIN`
- **Headers:** `Authorization: Bearer <teacher_jwt_token>`, `Content-Type: multipart/form-data`
- **Multipart Form Data:**
  - `file` (File, optional): Tệp tài liệu nguồn (PDF, DOCX, TXT).
  - `rawText` (string, optional): Nội dung văn bản thô (nếu không upload file).
  - `examId` (UUID, optional): Mã đề thi mục tiêu để liên kết.
  - `totalQuestions` (integer, default: 10): Số lượng câu hỏi muốn tạo (hệ thống tự động chia nhỏ đợt an toàn qua cơ chế Adaptive Multi-Pass).
  - `difficulty` (string, default: "BALANCED"): Phân bố độ khó (`EASY`, `MEDIUM`, `HARD`, `BALANCED`).
  - `language` (string, default: "vi"): Ngôn ngữ đề thi (`vi`, `en`).
  - `targetQuestionTypes` (list, optional): Các loại câu hỏi cho phép (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `ESSAY_TEXT`, `NUMERIC`).
  - `additionalInstructions` (string, optional): Lời dặn bổ sung cho mô hình AI.
- **Response `202 Accepted`:**
  ```json
  {
    "status": 200,
    "message": "Yêu cầu tạo đề thi bằng AI đã được đưa vào hàng đợi xử lý.",
    "data": {
      "jobId": "b53f65fa-c38d-4a1e-8e42-7efc926c8b01",
      "status": "QUEUED",
      "progressPercent": 0,
      "currentStep": "Đang xếp hàng chờ luồng AI duy nhất của hệ thống...",
      "sourceFileName": "Giao_trinh_OOP.pdf",
      "totalQuestionsGenerated": 0,
      "errorMessage": null,
      "createdAt": "2026-10-16T12:00:00Z",
      "completedAt": null,
      "questions": null
    },
    "timestamp": "2026-10-16T12:00:00.123"
  }
  ```

---

#### 53. Kiểm tra tiến độ và kết quả tạo đề ngầm (`GET /api/teacher/ai-generate/jobs/{jobId}`)
- **Mô tả:** Truy vấn trạng thái tiến trình thời gian thực, tỉ lệ hoàn thành (%) và danh sách các câu hỏi xem trước đã sinh ra sau khi hoàn tất.
- **Quyền hạn:** `TEACHER`, `ADMIN`
- **Headers:** `Authorization: Bearer <teacher_jwt_token>`
- **Response `200 OK` (Khi hoàn thành):**
  ```json
  {
    "status": 200,
    "message": "Lấy trạng thái tiến trình thành công",
    "data": {
      "jobId": "b53f65fa-c38d-4a1e-8e42-7efc926c8b01",
      "status": "COMPLETED",
      "progressPercent": 100,
      "currentStep": "Đã soạn thành công 15 câu hỏi từ tài liệu.",
      "sourceFileName": "Giao_trinh_OOP.pdf",
      "totalQuestionsGenerated": 15,
      "errorMessage": null,
      "createdAt": "2026-10-16T12:00:00Z",
      "completedAt": "2026-10-16T12:01:15Z",
      "questions": [
        {
          "tempId": "ai-q-1",
          "content": "Bốn tính chất cơ bản của lập trình hướng đối tượng là gì?",
          "questionType": "SINGLE_CHOICE",
          "points": 1.0,
          "explanation": "OOP được xây dựng dựa trên 4 trụ cột: Đóng gói, Kế thừa, Đa hình và Trừu tượng.",
          "difficulty": "EASY",
          "options": [
            { "orderIndex": 0, "content": "Đóng gói, Kế thừa, Đa hình, Trừu tượng", "isCorrect": true },
            { "orderIndex": 1, "content": "Tuần tự, Rẽ nhánh, Lặp, Đệ quy", "isCorrect": false },
            { "orderIndex": 2, "content": "Lớp, Đối tượng, Thuộc tính, Phương thức", "isCorrect": false },
            { "orderIndex": 3, "content": "Khai báo, Khởi tạo, Thực thi, Hủy bỏ", "isCorrect": false }
          ]
        }
      ]
    },
    "timestamp": "2026-10-16T12:01:16.456"
  }
  ```

---

#### 54. Hủy tiến trình tạo đề ngầm (`POST /api/teacher/ai-generate/jobs/{jobId}/cancel`)
- **Mô tả:** Cho phép giáo viên chủ động hủy một tác vụ đang xếp hàng hoặc đang chạy, lập tức giải phóng khóa độc quyền AI của tài khoản.
- **Quyền hạn:** `TEACHER`, `ADMIN`
- **Headers:** `Authorization: Bearer <teacher_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Đã hủy tiến trình tạo đề thi thành công",
    "data": null,
    "timestamp": "2026-10-16T12:02:00.000"
  }
  ```

---

#### 55. Lưu câu hỏi AI đã duyệt vào đề thi (`POST /api/teacher/ai-generate/commit-to-exam/{examId}`)
- **Mô tả:** Nhập hàng loạt các câu hỏi sau khi giáo viên đã xem lại, chỉnh sửa hoặc chọn lọc từ màn hình xem trước trực tiếp vào cơ sở dữ liệu của đề thi mục tiêu.
- **Quyền hạn:** `TEACHER`, `ADMIN`
- **Headers:** `Authorization: Bearer <teacher_jwt_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "questions": [
      {
        "content": "Tính chất nào cho phép che giấu thông tin nội bộ của đối tượng?",
        "questionType": "SINGLE_CHOICE",
        "points": 1.0,
        "difficulty": "EASY",
        "explanation": "Tính đóng gói (Encapsulation) bảo vệ trạng thái nội bộ bằng cách giới hạn quyền truy cập trực tiếp.",
        "options": [
          { "orderIndex": 0, "content": "Đóng gói (Encapsulation)", "isCorrect": true },
          { "orderIndex": 1, "content": "Đa hình (Polymorphism)", "isCorrect": false },
          { "orderIndex": 2, "content": "Kế thừa (Inheritance)", "isCorrect": false },
          { "orderIndex": 3, "content": "Trừu tượng (Abstraction)", "isCorrect": false }
        ]
      }
    ]
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "status": 201,
    "message": "Đã thêm thành công 1 câu hỏi vào đề thi.",
    "data": [
      {
        "id": "e3b0c442-98fc-1c14-9afb-4c72e0509a01",
        "content": "Tính chất nào cho phép che giấu thông tin nội bộ của đối tượng?",
        "questionType": "SINGLE_CHOICE",
        "points": 1.0,
        "orderIndex": 1
      }
    ],
    "timestamp": "2026-10-16T12:03:00.000"
  }
  ```

---

### Module 12: Giám Sát Tác Vụ Ngầm AI Giáo Viên (Teacher AI Background Tasks Monitor)

#### 56. Lấy danh sách tác vụ AI ngầm của giáo viên (`GET /api/teacher/ai-tasks`)
- **Mô tả:** Lấy danh sách toàn bộ các tác vụ nền AI (soạn câu hỏi từ file `AI_QUIZ_GEN` và chấm thi tự luận `AI_GRADING`) của giáo viên trong vòng 48 giờ lưu trữ trên Redis, sắp xếp theo thời gian mới nhất.
- **Quyền hạn:** `TEACHER`, `ADMIN`
- **Headers:** `Authorization: Bearer <teacher_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Lấy danh sách tác vụ AI thành công",
    "data": [
      {
        "taskId": "b53f65fa-c38d-4a1e-8e42-7efc926c8b01",
        "taskType": "AI_QUIZ_GEN",
        "status": "COMPLETED",
        "progressPercent": 100,
        "currentStep": "Đã soạn thành công 15 câu hỏi từ tài liệu.",
        "fileName": "Giao_trinh_OOP.pdf",
        "examId": null,
        "examTitle": null,
        "totalItems": 15,
        "processedItems": 15,
        "errorMessage": null,
        "createdAt": "2026-10-16T12:00:00Z",
        "completedAt": "2026-10-16T12:01:15Z"
      }
    ],
    "timestamp": "2026-10-16T12:04:00.000"
  }
  ```

---

#### 57. Lấy chi tiết tác vụ AI ngầm (`GET /api/teacher/ai-tasks/{taskId}`)
- **Mô tả:** Lấy chi tiết đầy đủ của một tác vụ cụ thể, bao gồm toàn bộ mảng dữ liệu câu hỏi xem trước (đối với tác vụ tạo đề) để giáo viên duyệt lại hoặc khôi phục.
- **Quyền hạn:** `TEACHER`, `ADMIN`
- **Headers:** `Authorization: Bearer <teacher_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Lấy chi tiết tác vụ AI thành công",
    "data": {
      "taskId": "b53f65fa-c38d-4a1e-8e42-7efc926c8b01",
      "taskType": "AI_QUIZ_GEN",
      "status": "COMPLETED",
      "progressPercent": 100,
      "currentStep": "Đã soạn thành công 15 câu hỏi từ tài liệu.",
      "questions": [ ... ],
      "createdAt": "2026-10-16T12:00:00Z",
      "completedAt": "2026-10-16T12:01:15Z"
    },
    "timestamp": "2026-10-16T12:04:30.000"
  }
  ```

---

#### 58. Hủy tác vụ AI ngầm (`POST /api/teacher/ai-tasks/{taskId}/cancel`)
- **Mô tả:** Hủy khẩn cấp một tác vụ AI đang chạy hoặc xếp hàng từ màn hình giám sát, đồng thời giải phóng khóa phân tán tương ứng.
- **Quyền hạn:** `TEACHER`, `ADMIN`
- **Headers:** `Authorization: Bearer <teacher_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Đã hủy tác vụ AI thành công",
    "data": null,
    "timestamp": "2026-10-16T12:05:00.000"
  }
  ```

---

#### 59. Xóa tác vụ khỏi lịch sử (`DELETE /api/teacher/ai-tasks/{taskId}`)
- **Mô tả:** Xóa một tác vụ đã hoàn thành hoặc thất bại khỏi danh sách theo dõi của giáo viên trên Redis.
- **Quyền hạn:** `TEACHER`, `ADMIN`
- **Headers:** `Authorization: Bearer <teacher_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Đã xóa tác vụ khỏi lịch sử",
    "data": null,
    "timestamp": "2026-10-16T12:05:30.000"
  }
  ```

---

### Module 13: Quản Trị Hệ Thống AI & Quản Lý Khóa Xoay Vòng (Admin AI Pool Management)

#### 60. Trạng thái hệ thống AI và Slot Metrics live (`GET /api/admin/ai/status`)
- **Mô tả:** Cung cấp thông tin tổng quan về Rotation Pool: nguồn cấu hình (`DATABASE` hoặc `ENV_FALLBACK`), tổng số slot, số slot đang hoạt động, danh sách chi tiết từng slot kèm chỉ số RPM/TPM live đọc trực tiếp từ Redis Sliding Window, thời gian cooldown còn lại, và danh sách các background jobs đang chạy.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "AI system status retrieved successfully",
    "data": {
      "configSource": "DATABASE",
      "totalSlots": 2,
      "activeSlots": 2,
      "totalKeys": 2,
      "optimalBatchTokenBudget": 30000,
      "maxBatchCandidateCount": 25,
      "slots": [
        {
          "slotIndex": 0,
          "keyName": "Primary Key",
          "maskedKey": "AIzaSy...4x8a",
          "modelName": "gemini-1.5-flash",
          "rpmCurrent": 1,
          "rpmMax": 15,
          "tpmCurrent": 3200,
          "tpmMax": 1000000,
          "isExhausted": false,
          "cooldownRemainingSeconds": 0,
          "totalRequests": 45,
          "successCount": 45,
          "failureCount": 0
        }
      ],
      "activeJobs": []
    },
    "timestamp": "2026-10-16T12:06:00.000"
  }
  ```

---

#### 61. Danh sách AI API Keys (`GET /api/admin/ai/keys`)
- **Mô tả:** Lấy danh sách toàn bộ các API Key cấu hình trong cơ sở dữ liệu cùng các model slot con và thông số giới hạn RPM/TPM.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "AI keys retrieved successfully",
    "data": [
      {
        "id": "7fa1bc82-9921-4d10-8201-1b948df921a0",
        "name": "Production Primary Gemini",
        "maskedKey": "AIzaSy...7890",
        "provider": "GEMINI",
        "isActive": true,
        "orderIndex": 0,
        "models": [
          {
            "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
            "modelName": "gemini-1.5-flash",
            "rpm": 15,
            "tpm": 1000000,
            "isActive": true,
            "orderIndex": 0
          }
        ]
      }
    ],
    "timestamp": "2026-10-16T12:06:30.000"
  }
  ```

---

#### 62. Tạo mới AI API Key (`POST /api/admin/ai/keys`)
- **Mô tả:** Đăng ký thêm API Key mới vào hệ thống kèm các model được phép sử dụng và hạn mức. Sau khi lưu, hệ thống tự động làm mới Rotation Pool ngay lập tức.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "name": "Secondary Gemini Backup",
    "apiKey": "AIzaSyAnotherKeyHere1234567890",
    "provider": "GEMINI",
    "isActive": true,
    "orderIndex": 1,
    "models": [
      {
        "modelName": "gemini-1.5-flash",
        "rpm": 15,
        "tpm": 1000000,
        "isActive": true,
        "orderIndex": 0
      }
    ]
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "status": 201,
    "message": "AI key created and rotation pool refreshed",
    "data": {
      "id": "8cb2de91-1122-4a33-9122-2c059ef032b1",
      "name": "Secondary Gemini Backup",
      "maskedKey": "AIzaSy...7890",
      "isActive": true
    },
    "timestamp": "2026-10-16T12:07:00.000"
  }
  ```

---

#### 63. Cập nhật AI API Key (`PUT /api/admin/ai/keys/{id}`)
- **Mô tả:** Cập nhật thông tin khóa, thay đổi token bí mật hoặc điều chỉnh hạn mức RPM/TPM của các model.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`, `Content-Type: application/json`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "AI key updated and rotation pool refreshed",
    "data": { ... },
    "timestamp": "2026-10-16T12:07:30.000"
  }
  ```

---

#### 64. Bật / Tắt kích hoạt AI Key (`PATCH /api/admin/ai/keys/{id}/toggle`)
- **Mô tả:** Bật hoặc tắt trạng thái hoạt động của một API Key. Các model thuộc key bị tắt sẽ tạm thời không nhận tải request.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "AI key status toggled successfully",
    "data": { "id": "...", "isActive": false },
    "timestamp": "2026-10-16T12:08:00.000"
  }
  ```

---

#### 65. Bật / Tắt kích hoạt Model Slot (`PATCH /api/admin/ai/models/{id}/toggle`)
- **Mô tả:** Tắt hoặc bật một model cụ thể (ví dụ tạm dừng `gemini-1.5-pro` khi quá đắt, chỉ chạy `gemini-1.5-flash`).
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "AI model status toggled successfully",
    "data": { "id": "...", "isActive": false },
    "timestamp": "2026-10-16T12:08:30.000"
  }
  ```

---

#### 66. Nạp lại Rotation Pool từ DB (`POST /api/admin/ai/reload`)
- **Mô tả:** Buộc hệ thống tái nạp toàn bộ cấu hình khóa và model từ Database, đồng bộ lại các bộ đếm vào Redis.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "AI rotation pool reloaded successfully",
    "data": null,
    "timestamp": "2026-10-16T12:09:00.000"
  }
  ```

---

#### 67. Hủy tác vụ chấm/tạo đề ngầm khẩn cấp (`DELETE /api/admin/ai/jobs/{jobId}`)
- **Mô tả:** Quản trị viên can thiệp hủy một tác vụ AI đang bị treo hoặc quá hạn, đồng thời giải phóng khóa phân tán Redis tương ứng của đề thi hoặc giáo viên.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Background job cancelled and lock released successfully",
    "data": null,
    "timestamp": "2026-10-16T12:09:30.000"
  }
  ```

---

#### 68. Xóa toàn bộ tác vụ AI ngầm và giải phóng khóa (`DELETE /api/admin/ai/jobs`)
- **Mô tả:** Hủy toàn bộ tất cả tác vụ nền đang chạy trên hệ thống và giải phóng toàn bộ khóa phân tán trên Redis (dùng trong trường hợp bảo trì hoặc hệ thống khởi động lại).
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "All background jobs cleared and locks released successfully",
    "data": null,
    "timestamp": "2026-10-16T12:10:00.000"
  }
  ```

---

#### 69. Xóa AI API Key (`DELETE /api/admin/ai/keys/{id}`)
- **Mô tả:** Xóa vĩnh viễn một AI Key khỏi Database và loại bỏ khỏi Rotation Pool.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "AI key deleted and rotation pool refreshed",
    "data": null,
    "timestamp": "2026-10-16T12:10:30.000"
  }
  ```

---

### Module 14: Kiểm Duyệt Nội Dung Câu Hỏi (Admin Question Content Moderation)

#### 71. Danh sách câu hỏi kiểm duyệt nội dung (`GET /api/admin/moderation/questions`)
- **Mô tả:** Lấy danh sách toàn bộ câu hỏi trong hệ thống kèm cờ an toàn (`isSafe`), trạng thái kiểm duyệt, bộ lọc hình ảnh (`hasImage`), loại câu hỏi và tìm kiếm toàn văn FTS.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Query Parameters:**
  - `isSafe` (boolean, optional): Lọc theo trạng thái an toàn (`true`: an toàn, `false`: gắn cờ vi phạm).
  - `hasImage` (boolean, optional): Lọc câu hỏi có đính kèm hình ảnh.
  - `questionType` (string, optional): Lọc theo loại câu hỏi (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `ESSAY_TEXT`, `NUMERIC`).
  - `search` (string, optional): Từ khóa tìm kiếm nội dung câu hỏi.
  - `page`, `size`, `sort` (Pageable).
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Moderation questions retrieved successfully",
    "data": {
      "content": [
        {
          "id": "e3b0c442-98fc-1c14-9afb-4c72e0509a01",
          "content": "Nội dung câu hỏi...",
          "questionType": "SINGLE_CHOICE",
          "points": 1.0,
          "hasImage": false,
          "imageUrl": null,
          "isSafe": true,
          "moderationStatus": "APPROVED",
          "moderatedAt": "2026-10-15T10:00:00Z",
          "moderatedBy": "admin_system"
        }
      ],
      "pageNumber": 0,
      "pageSize": 10,
      "totalElements": 150,
      "totalPages": 15,
      "last": false
    },
    "timestamp": "2026-10-16T12:15:00.000"
  }
  ```

---

#### 72. Thống kê kiểm duyệt nội dung (`GET /api/admin/moderation/stats`)
- **Mô tả:** Cung cấp số liệu tổng hợp: tổng số câu hỏi, số câu an toàn, số câu bị gắn cờ vi phạm, và số câu chưa được duyệt để hiển thị dashboard thẻ thống kê.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Moderation stats retrieved successfully",
    "data": {
      "totalQuestions": 450,
      "safeQuestions": 435,
      "unsafeQuestions": 5,
      "pendingReviewQuestions": 10
    },
    "timestamp": "2026-10-16T12:15:30.000"
  }
  ```

---

#### 73. Cập nhật nhãn an toàn câu hỏi (`PATCH /api/admin/moderation/questions/{id}/safety`)
- **Mô tả:** Quản trị viên can thiệp thủ công đánh dấu câu hỏi là an toàn (`isSafe = true`) hoặc thu hồi cờ an toàn (`isSafe = false`).
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "isSafe": true
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Question marked as safe successfully",
    "data": { ... },
    "timestamp": "2026-10-16T12:16:00.000"
  }
  ```

---

#### 74. Xóa câu hỏi vi phạm tiêu chuẩn (`DELETE /api/admin/moderation/questions/{id}`)
- **Mô tả:** Xóa vĩnh viễn câu hỏi chứa nội dung độc hại hoặc vi phạm chính sách khỏi hệ thống và dọn dẹp các tệp ảnh đính kèm.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "Question deleted successfully by administrator",
    "data": null,
    "timestamp": "2026-10-16T12:16:30.000"
  }
  ```

---

#### 75. Kích hoạt tác vụ AI quét kiểm duyệt hàng loạt (`POST /api/admin/moderation/ai-run`)
- **Mô tả:** Đưa tác vụ kiểm duyệt AI vào xử lý ngầm trong hàng đợi. AI quét tự động các câu hỏi dạng văn bản chưa kiểm duyệt theo batch và gắn cờ tự động các câu hỏi vi phạm. Hỗ trợ resume từ con trỏ Redis nếu bị gián đoạn.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `202 Accepted`:**
  ```json
  {
    "status": 200,
    "message": "Tác vụ kiểm duyệt AI đã được kích hoạt thành công",
    "data": {
      "isRunning": true,
      "cursor": "0",
      "processedCount": 0,
      "flaggedCount": 0,
      "message": "AI content moderation batch job is running"
    },
    "timestamp": "2026-10-16T12:17:00.000"
  }
  ```

---

#### 76. Kiểm tra tiến độ tác vụ AI kiểm duyệt (`GET /api/admin/moderation/ai-status`)
- **Mô tả:** Tra cứu trạng thái hoạt động của tiến trình quét AI (đang chạy hay đã dừng, vị trí con trỏ Redis hiện tại, thông điệp xử lý).
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "AI moderation job status retrieved",
    "data": {
      "isRunning": false,
      "cursor": "45",
      "processedCount": 45,
      "flaggedCount": 2,
      "message": "AI moderation job completed successfully"
    },
    "timestamp": "2026-10-16T12:17:30.000"
  }
  ```

---

#### 77. Đặt lại con trỏ duyệt AI trên Redis (`DELETE /api/admin/moderation/ai-cursor`)
- **Mô tả:** Xóa con trỏ lưu trữ trên Redis để lần chạy tiếp theo của tác vụ AI kiểm duyệt sẽ quét lại toàn bộ câu hỏi từ đầu. Trả về `409 Conflict` nếu tác vụ đang chạy.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": 200,
    "message": "AI moderation cursor reset. Next run will start from the beginning.",
    "data": null,
    "timestamp": "2026-10-16T12:18:00.000"
  }
  ```

---

### Module 15: Kiểm Tra Sức Khỏe Hệ Thống (Admin System Health)

#### 78. Kiểm tra trạng thái sức khỏe hệ thống (`GET /api/admin/system/health`)
- **Mô tả:** Cung cấp thông tin giám sát thời gian thực về tình trạng kết nối PostgreSQL Database, Redis Caching & Lock Service, mức sử dụng CPU, RAM hệ thống và dung lượng đĩa trống.
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_jwt_token>`
- **Response `200 OK`:**
  ```json
  {
    "status": "UP",
    "database": {
      "status": "UP",
      "database": "PostgreSQL",
      "latencyMs": 4
    },
    "redis": {
      "status": "UP",
      "version": "7.2",
      "latencyMs": 1
    },
    "system": {
      "jvmUptimeSeconds": 86400,
      "heapMemoryUsedMb": 384,
      "heapMemoryMaxMb": 2048,
      "diskFreeGb": 45.2
    },
    "timestamp": "2026-10-16T12:18:30.000"
  }
  ```

---

### Module 16: Public Ping & Cold-Start Probe (Hạ Tầng & Khởi Động)

#### 16.1. Ping kiểm tra máy chủ & Đánh thức Cold-Start (`GET /api/ping` hoặc `/`, `/ping`)
- **Mô tả:** Endpoint công khai phục vụ kiểm tra sức khỏe cơ bản, giám sát Uptime, và cho phép Frontend (Vercel) gửi tín hiệu đánh thức máy chủ Backend miễn phí (Render, Railway, Koyeb) khi ở chế độ ngủ (Cold Start).
- **Phân quyền:** Công khai (`permitAll()`).
- **Nội dung trả về:**
  - Nếu gửi `Accept: application/json`: Trả về JSON trạng thái hệ thống.
  - Nếu truy cập trực tiếp bằng trình duyệt (`Accept: text/html`): Trả về giao diện Dashboard HTML Dark Mode hiển thị trực quan trạng thái máy chủ, JVM Uptime, RAM usage.
- **Headers:**
  ```http
  GET /api/ping HTTP/1.1
  Host: localhost:8080
  Accept: application/json
  ```
- **Response `200 OK` (JSON):**
  ```json
  {
    "status": "UP",
    "message": "QuickTest Backend is Live & Healthy",
    "service": "quick-test",
    "version": "1.0.0",
    "uptimeSeconds": 154,
    "usedMemoryMb": 182,
    "timestamp": "2026-10-16T14:15:00.000Z"
  }
  ```

---

### Module 17: Quản Trị Bằng Chứng Media Viễn Trắc (Admin Proctoring Media Governance)

Hệ thống quản lý, giám sát và dọn dẹp bằng chứng hình ảnh (Webcam Snapshots, Animation Bursts) ghi nhận trong quá trình thi. Hỗ trợ cả 2 tiền tố đường dẫn `/api/admin/proctoring-media` và `/api/v1/admin/proctoring-media`.

#### 17.1. Tìm kiếm và phân trang danh sách ảnh bằng chứng (`GET /api/admin/proctoring-media`)
- **Mô tả:** Truy vấn danh sách hình ảnh bằng chứng vi phạm có phân trang, hỗ trợ lọc theo loại vi phạm, mã đề thi, khoảng thời gian chụp ảnh và tìm kiếm Full-Text Search theo tên/email thí sinh.
- **Endpoint alias:** `GET /api/v1/admin/proctoring-media`
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Query Parameters:**
  - `violationType` (string, tùy chọn): Lọc theo loại vi phạm (`TAB_SWITCH`, `MULTIPLE_FACES`, `NO_FACE_DETECTED`, `SUSPICIOUS_OBJECT`, v.v.).
  - `examId` (UUID, tùy chọn): Lọc theo mã định danh đề thi.
  - `startDate` (ISO-8601 string, tùy chọn): Thời điểm bắt đầu lọc.
  - `endDate` (ISO-8601 string, tùy chọn): Thời điểm kết thúc lọc.
  - `search` (string, tùy chọn): Từ khóa tìm kiếm họ tên hoặc email thí sinh.
  - `page` (int, mặc định `0`): Chỉ số trang.
  - `size` (int, mặc định `24`): Số lượng phần tử mỗi trang (tối ưu hiển thị dạng lưới Media Grid).
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Proctoring media retrieved successfully",
    "data": {
      "content": [
        {
          "id": "78da21bc-9988-4e12-8877-665544332211",
          "attemptId": "f78d10b4-374e-4b68-b789-98246e72b4f9",
          "examId": "b3e098df-8fa2-4be1-8b29-e85df6a94b41",
          "examTitle": "Kiểm tra Giữa kỳ Sinh học 12",
          "attemptStatus": "SUBMITTED",
          "studentId": "c1f7b032-1598-4b77-8025-a74581f33230",
          "studentName": "Nguyễn Văn An",
          "studentEmail": "an.nguyen@quicktest.edu",
          "violationType": "MULTIPLE_FACES",
          "description": "Phát hiện 2 khuôn mặt trước camera",
          "evidenceUrl": "https://res.cloudinary.com/quicktest-cloud/image/upload/v1794567890/quick-test/proctoring/f78d10b4/ev1.jpg",
          "timestamp": "2026-11-13T10:35:12",
          "isAnimatedBurst": false,
          "storageType": "CLOUDINARY"
        }
      ],
      "pageNumber": 0,
      "pageSize": 24,
      "totalElements": 1,
      "totalPages": 1,
      "last": true
    },
    "timestamp": "2026-11-13T11:31:00.000"
  }
  ```

#### 17.2. Thống kê KPI & Phân tích dung lượng ảnh viễn trắc (`GET /api/admin/proctoring-media/stats`)
- **Mô tả:** Lấy số liệu thống kê tổng hợp phục vụ các KPI card: tổng số ảnh, ảnh tĩnh đơn lẻ, ảnh động liên hoàn (burst animation), số ảnh chụp trong 7 ngày gần nhất, số ảnh cũ hơn 30 ngày (sẵn sàng dọn dẹp) và số lượng đề thi có lưu trữ bằng chứng.
- **Endpoint alias:** `GET /api/v1/admin/proctoring-media/stats`
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Proctoring media stats retrieved successfully",
    "data": {
      "totalMediaCount": 4580,
      "singleSnapshotCount": 4210,
      "burstAnimationCount": 370,
      "recent7DaysCount": 1120,
      "olderThan30DaysCount": 2350,
      "examsWithMediaCount": 48
    },
    "timestamp": "2026-11-13T11:31:30.000"
  }
  ```

#### 17.3. Xem trước khối lượng ảnh sẽ dọn dẹp (`GET /api/admin/proctoring-media/cleanup/preview`)
- **Mô tả:** Ước tính trước số lượng ảnh và bản ghi sẽ bị loại bỏ theo tiêu chí lưu trữ (retention window) trước khi quản trị viên thực sự kích hoạt tác vụ xóa.
- **Endpoint alias:** `GET /api/v1/admin/proctoring-media/cleanup/preview`
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Query Parameters:**
  - `days` (int, mặc định `30`): Số ngày lưu trữ tối thiểu cần giữ lại.
  - `violationType` (string, tùy chọn): Chỉ lọc loại vi phạm cụ thể nếu muốn dọn dẹp cục bộ.
  - `examId` (UUID, tùy chọn): Chỉ dọn dẹp ảnh thuộc 1 đề thi cụ thể.
  - `onlyFinishedExams` (boolean, mặc định `true`): Chỉ dọn dẹp ảnh thuộc các kỳ thi đã kết thúc / đóng hoàn toàn.
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Cleanup preview count calculated",
    "data": {
      "matchingCount": 2350,
      "days": 30
    },
    "timestamp": "2026-11-13T11:32:00.000"
  }
  ```

#### 17.4. Kích hoạt tác vụ dọn dẹp hàng loạt ảnh ngầm (`POST /api/admin/proctoring-media/cleanup`)
- **Mô tả:** Khởi động tiến trình dọn dẹp hàng loạt (asynchronous background cleanup) các ảnh bằng chứng cũ theo điều kiện chỉ định. Tiến trình chia nhỏ theo batch (mặc định 100 ảnh), gửi thông điệp xóa ảnh Cloudinary qua RabbitMQ Producer và cập nhật trạng thái trong PostgreSQL mà không làm nghẽn luồng xử lý chính.
- **Endpoint alias:** `POST /api/v1/admin/proctoring-media/cleanup`
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Request Body (Tùy chọn):**
  ```json
  {
    "days": 30,
    "violationType": null,
    "examId": null,
    "onlyFinishedExams": true,
    "batchSize": 100
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Proctoring media cleanup initiated in background",
    "data": {
      "isRunning": true,
      "totalDeleted": 0,
      "estimatedRemaining": 2350,
      "retentionDaysKept": 30,
      "batchSize": 100,
      "cutoff": "2026-10-14T00:00:00",
      "startedAt": "2026-11-13T11:32:15",
      "finishedAt": null,
      "status": "RUNNING",
      "message": "Cleanup started for media older than 30 days"
    },
    "timestamp": "2026-11-13T11:32:15.000"
  }
  ```

#### 17.5. Kiểm tra tiến độ tác vụ dọn dẹp ảnh ngầm (`GET /api/admin/proctoring-media/cleanup/status`)
- **Mô tả:** Kiểm tra trạng thái và tiến độ xử lý hiện tại của tiến trình background worker dọn dẹp hình ảnh.
- **Endpoint alias:** `GET /api/v1/admin/proctoring-media/cleanup/status`
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Cleanup status retrieved successfully",
    "data": {
      "isRunning": false,
      "totalDeleted": 2350,
      "estimatedRemaining": 0,
      "retentionDaysKept": 30,
      "batchSize": 100,
      "cutoff": "2026-10-14T00:00:00",
      "startedAt": "2026-11-13T11:32:15",
      "finishedAt": "2026-11-13T11:33:45",
      "status": "COMPLETED",
      "message": "Proctoring media cleanup completed successfully"
    },
    "timestamp": "2026-11-13T11:34:00.000"
  }
  ```

#### 17.6. Xóa hàng loạt ảnh bằng chứng theo danh sách ID (`DELETE /api/admin/proctoring-media/batch`)
- **Mô tả:** Quản trị viên chọn thủ công danh sách các ảnh bằng chứng trên giao diện quản trị để xóa vĩnh viễn. Hệ thống xóa bản ghi trong Database và gửi yêu cầu xóa tệp tài nguyên tương ứng trên Cloudinary.
- **Endpoint alias:** `DELETE /api/v1/admin/proctoring-media/batch`
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "ids": [
      "78da21bc-9988-4e12-8877-665544332211",
      "91ca34de-1234-4567-89ab-cdef01234567"
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Đã xóa thành công 2 ảnh giám sát",
    "data": {
      "deletedCount": 2
    },
    "timestamp": "2026-11-13T11:34:30.000"
  }
  ```

#### 17.7. Xóa một ảnh bằng chứng đơn lẻ (`DELETE /api/admin/proctoring-media/{id}`)
- **Mô tả:** Xóa một hình ảnh bằng chứng cụ thể theo ID và loại bỏ tệp khỏi Cloudinary.
- **Endpoint alias:** `DELETE /api/v1/admin/proctoring-media/{id}`
- **Quyền hạn:** `ADMIN`
- **Headers:** `Authorization: Bearer <admin_token>`
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Ảnh giám sát đã được xóa thành công",
    "data": {
      "deletedCount": 1
    },
    "timestamp": "2026-11-13T11:35:00.000"
  }
  ```

---

### Module 18: Giao Thức Viễn Trắc Thời Gian Thực & WebSocket STOMP (Realtime Telemetry Protocols)

QuickTest trang bị hệ thống giao tiếp 2 chiều (Bidirectional Realtime Communication) kết hợp giữa Spring WebSocket STOMP (Spring Boot) và trung tâm điều phối sự kiện thông lượng cao QuickNotify (Go WebSocket Hub).

#### 18.1. Kết nối và Bắt tay STOMP WebSocket (`/ws/proctoring`)
- **Endpoint kết nối:**
  - Native WebSocket URL: `ws://localhost:8080/ws/proctoring`
  - SockJS Fallback URL: `http://localhost:8080/ws/proctoring`
- **Cơ chế xác thực (STOMP Connect Header):**
  - Thí sinh đã đăng nhập:
    ```http
    CONNECT
    Authorization:Bearer <access_token>
    accept-version:1.1,1.2
    heart-beat:10000,10000
    ```
  - Thí sinh tự do (Guest):
    ```http
    CONNECT
    X-Guest-Identifier:<guest_uuid>
    accept-version:1.1,1.2
    heart-beat:10000,10000
    ```

#### 18.2. Gửi thông điệp báo cáo vi phạm qua STOMP (`/app/proctoring/violation`)
- **Mục đích:** Gửi sự kiện vi phạm viễn trắc (tab switch, camera mất tín hiệu, mở cửa sổ khác) qua kết nối socket liên tục.
- **Destination:** `/app/proctoring/violation`
- **STOMP Frame Message Payload:**
  ```json
  {
    "attemptId": "f78d10b4-374e-4b68-b789-98246e72b4f9",
    "violationType": "TAB_SWITCH",
    "description": "Thí sinh chuyển tab hoặc mất focus cửa sổ làm bài",
    "evidenceUrl": "https://res.cloudinary.com/.../ev1.jpg",
    "snapshotBase64": null,
    "timestamp": "2026-11-13T11:36:00"
  }
  ```
- **Hệ thống xử lý:** Server ghi nhận vi phạm, cập nhật Redis Hash, và phát cảnh báo đến topic giám sát phòng thi tương ứng.

#### 18.3. Gửi nhịp tim giữ phiên (Heartbeat Ping) (`/app/proctoring/heartbeat`)
- **Mục đích:** Giữ nhịp sinh tồn (Candidate Liveness Check) của phiên thi, cập nhật thời điểm hoạt động cuối cùng của thí sinh trong Redis để phát hiện kịp thời các sự cố mất mạng hoặc treo ứng dụng.
- **Destination:** `/app/proctoring/heartbeat`
- **STOMP Frame Message Payload:**
  ```json
  {
    "attemptId": "f78d10b4-374e-4b68-b789-98246e72b4f9",
    "timestamp": 1794567890123
  }
  ```

#### 18.4. Nhận sự kiện vi phạm phòng thi theo thời gian thực (`/topic/exam/{examId}/proctoring`)
- **Mục đích:** Kênh phân phối sự kiện (Publish/Subscribe) dành cho màn hình giám sát của Giảng viên. Bất kỳ khi nào có thí sinh trong phòng thi phát sinh vi phạm, server sẽ phát quảng bá ngay lập tức vào topic này.
- **Destination Subscribe:** `/topic/exam/{examId}/proctoring`
- **Thông điệp broadcast nhận được (`ViolationAlertMessage`):**
  ```json
  {
    "attemptId": "f78d10b4-374e-4b68-b789-98246e72b4f9",
    "studentName": "Nguyễn Văn An",
    "studentEmail": "an.nguyen@quicktest.edu",
    "violationType": "TAB_SWITCH",
    "violationCount": 2,
    "maxAllowed": 5,
    "remainingAllowed": 3,
    "disqualified": false,
    "message": "Cảnh báo vi phạm: Chuyển tab lần 2",
    "evidenceUrl": "https://res.cloudinary.com/.../ev1.jpg",
    "timestamp": "2026-11-13T11:36:05"
  }
  ```

#### 18.5. Kênh cảnh báo cá nhân của thí sinh (`/topic/exam/{examId}/attempt/{attemptId}`)
- **Mục đích:** Kênh thông báo riêng biệt cho từng thí sinh. Khi giám khảo thực hiện đình chỉ thi thủ công (`disqualifyAttempt`) hoặc hệ thống tự động khóa bài do vượt quá vi phạm cho phép, thông điệp khóa phòng thi sẽ được phát trực tiếp vào topic này để client lập tức hiển thị màn hình khóa.
- **Destination Subscribe:** `/topic/exam/{examId}/attempt/{attemptId}`
- **Nội dung thông điệp:** Chứa trạng thái `disqualified: true` kèm thông điệp giải thích lý do đình chỉ thi.

---

## IV. Bảng Mã Lỗi Thường Gặp (Common Error Responses)

| HTTP Status | Nguyên nhân | Cấu trúc phản hồi lỗi |
|:---:|:---|:---|
| `400 Bad Request` | Dữ liệu đầu vào không hợp lệ (sai định dạng JSON, điểm vượt quá thang điểm, v.v.) | `{"status": 400, "message": "Validation failed: ...", "data": null}` |
| `401 Unauthorized` | Không có hoặc Token JWT hết hạn | `{"status": 401, "message": "User is not authenticated", "data": null}` |
| `403 Forbidden` | Không có quyền (Ví dụ: STUDENT truy cập API TEACHER, hoặc Giáo viên không sở hữu đề thi) | `{"status": 403, "message": "Access Denied: You do not have permission...", "data": null}` |
| `404 Not Found` | Không tìm thấy tài nguyên (Exam, Question, Attempt, v.v.) | `{"status": 404, "message": "Resource not found: ...", "data": null}` |
| `503 Service Unavailable` | Dịch vụ bên ngoài (Cloudinary hoặc AI) tạm thời không kết nối được | `{"status": 503, "message": "Media upload service temporarily unavailable", "data": null}` |
