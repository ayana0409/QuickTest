# QuickTest Online Exam System - Comprehensive API Documentation

Tài liệu đặc tả toàn bộ **52+ RESTful Endpoints** của hệ thống thi trực tuyến **QuickTest** (Spring Boot 3.x, PostgreSQL Full-Text Search, Redis, RabbitMQ, Cloudinary, Google Gemini AI, Centralized Audit Logging).

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
| 1 | **IAM & Auth** | `POST` | `/api/auth/register` | `PUBLIC` | Đăng ký tài khoản mới |
| 2 | | `POST` | `/api/auth/login` | `PUBLIC` | Đăng nhập hệ thống & nhận JWT |
| 3 | | `GET` | `/api/auth/me` | Authenticated | Lấy hồ sơ tài khoản hiện tại |
| 4 | **Teacher Exams** | `POST` | `/api/teacher/exams` | `TEACHER` | Tạo đề thi mới (DRAFT) |
| 5 | | `GET` | `/api/teacher/exams` | `TEACHER` | Lấy danh sách đề thi của giáo viên |
| 6 | | `GET` | `/api/teacher/exams/{id}` | `TEACHER` | Lấy chi tiết cấu hình đề thi |
| 7 | | `PUT` | `/api/teacher/exams/{id}` | `TEACHER` | Cập nhật thông tin đề thi (cho phép cả khi CLOSED) |
| 8 | | `PATCH` | `/api/teacher/exams/{id}/publish` | `TEACHER` | Xuất bản đề thi (từ DRAFT hoặc CLOSED -> PUBLISHED) |
| 9 | | `PATCH` | `/api/teacher/exams/{id}/close` | `TEACHER` | Đóng đề thi (CLOSED) & tự động thu các bài dở dang |
| 10 | | `PATCH` | `/api/teacher/exams/{id}/republish` | `TEACHER` | Mở lại đề thi đã đóng (cập nhật hạn chót, chuyển sang PUBLISHED) |
| 11 | | `POST` | `/api/teacher/exams/{id}/duplicate` | `TEACHER` | Nhân bản đề thi sang bản nháp mới (bất đồng bộ sao chép ảnh qua RabbitMQ) |
| 12 | | `DELETE` | `/api/teacher/exams/{id}` | `TEACHER` | Xóa đề thi (chỉ xóa DRAFT) |
| 11 | **Questions** | `POST` | `/api/teacher/exams/{examId}/questions` | `TEACHER` | Thêm câu hỏi vào đề thi |
| 12 | | `PUT` | `/api/teacher/questions/{questionId}` | `TEACHER` | Cập nhật câu hỏi và đáp án |
| 13 | | `PUT` | `/api/teacher/questions/{questionId}/image` | `TEACHER` | Cập nhật trực tiếp ảnh câu hỏi (xóa ảnh cũ Cloudinary) |
| 14 | | `DELETE` | `/api/teacher/questions/{questionId}` | `TEACHER` | Xóa câu hỏi (tự động dọn ảnh câu hỏi + đáp án trên Cloudinary) |
| 15 | | `GET` | `/api/teacher/question-bank` | `TEACHER` | Lấy ngân hàng câu hỏi của giáo viên (phân trang, lọc theo đề/từ khóa) |
| 16 | | `POST` | `/api/teacher/exams/{examId}/questions/import` | `TEACHER` | Nhập câu hỏi từ ngân hàng vào đề thi (deep copy dữ liệu & ảnh) |
| 17 | **Media Upload** | `POST` | `/api/teacher/media/upload` | `TEACHER` | Upload 1 file ảnh đồng bộ lên Cloudinary |
| 16 | | `POST` | `/api/teacher/media/batch-upload` | `TEACHER` | Upload hàng loạt ảnh chạy nền (Async RabbitMQ) |
| 17 | | `GET` | `/api/teacher/media/batch/{batchId}/status` | `TEACHER` | Kiểm tra tiến độ upload batch & lấy danh sách URL |
| 18 | **Candidate Session** | `POST` | `/api/session/start` | All (Student/Guest) | Bắt đầu hoặc khôi phục lượt thi, nhận đề thi masked |
| 19 | | `PUT` | `/api/session/{attemptId}/save` | All (Student/Guest) | Auto-save câu trả lời đơn lẻ vào Redis Hash |
| 20 | | `GET` | `/api/session/{attemptId}/resume` | All (Student/Guest) | Khôi phục bài làm kèm danh sách nháp đã lưu |
| 21 | | `POST` | `/api/session/{attemptId}/submit` | All (Student/Guest) | Nộp bài thi bất đồng bộ qua RabbitMQ (202 Accepted) |
| 22 | | `GET` | `/api/session/{attemptId}/result` | All (Student/Guest) | Xem kết quả điểm số và trạng thái chấm bài |
| 23 | **Candidate Proctoring** | `POST` | `/api/session/proctoring/violations` | All (Student/Guest) | Báo cáo sự kiện vi phạm viễn trắc (telemetry) |
| 24 | | `POST` | `/api/session/proctoring/heartbeat` | All (Student/Guest) | Gửi tín hiệu heartbeat giữ phiên làm bài active |
| 25 | **Teacher Proctoring** | `GET` | `/api/teacher/proctoring/exams/{examId}/attempts` | `TEACHER` | Giám sát thí sinh phòng thi theo thời gian thực |
| 26 | | `GET` | `/api/teacher/proctoring/attempts/{attemptId}/violations` | `TEACHER` | Xem nhật ký kiểm toán (audit log) vi phạm của thí sinh |
| 27 | | `GET` | `/api/teacher/proctoring/attempts/{attemptId}/status` | `TEACHER` | Xem trạng thái viễn trắc, heartbeat, tỷ lệ tập trung |
| 28 | | `POST` | `/api/teacher/proctoring/attempts/{attemptId}/disqualify` | `TEACHER` | Đình chỉ thi cưỡng chế thí sinh vi phạm |
| 29 | **Attempt Grading** | `GET` | `/api/teacher/grading/exams/{examId}/attempts` | `TEACHER` | Lấy danh sách bài nộp cần chấm theo đề thi |
| 30 | | `GET` | `/api/teacher/grading/exams/{examId}/stats` | `TEACHER` | Lấy thống kê tổng quan các phiên thi (điểm, thời gian, vi phạm) |
| 31 | | `GET` | `/api/teacher/grading/exams/{examId}/attempts/export-excel` | `TEACHER` | Xuất file Excel (.xlsx) danh sách phiên thi đầy đủ thông tin |
| 32 | | `GET` | `/api/teacher/grading/attempts/{attemptId}` | `TEACHER` | Xem chi tiết bài làm của 1 thí sinh để chấm |
| 33 | | `GET` | `/api/teacher/grading/attempts/{attemptId}/export-excel` | `TEACHER` | Xuất file Excel (.xlsx) bài làm riêng lẻ kèm điểm từng câu & feedback |
| 34 | | `POST` | `/api/teacher/grading/attempts/submit-grades` | `TEACHER` | Lưu điểm các câu tự luận của 1 bài thi |
| 32 | **Question Grading** | `GET` | `/api/teacher/grading/exams/{examId}/questions` | `TEACHER` | Danh sách câu hỏi tự luận cần chấm (thống kê tiến độ) |
| 33 | | `GET` | `/api/teacher/grading/questions/{questionId}/submissions` | `TEACHER` | Xem biểu điểm và bài làm học sinh theo câu hỏi |
| 34 | | `POST` | `/api/teacher/grading/questions/{questionId}/manual` | `TEACHER` | Chấm tay hàng loạt/lẻ theo câu hỏi (tính điểm tự động) |
| 35 | | `POST` | `/api/teacher/grading/trigger-ai` | `TEACHER` | Kích hoạt Google Gemini chấm tự động theo batch (202 Accepted) |
| 36 | **Admin Dashboard** | `GET` | `/api/admin/dashboard` | `ADMIN` | Xem thống kê toàn hệ thống & nhật ký vi phạm gần nhất |
| 37 | **Admin Users** | `GET` | `/api/admin/users` | `ADMIN` | Lấy danh sách tài khoản (lọc role, isActive, search) |
| 38 | | `GET` | `/api/admin/users/{id}` | `ADMIN` | Xem chi tiết thông tin tài khoản |
| 39 | | `PATCH` | `/api/admin/users/{id}/toggle-status` | `ADMIN` | Kích hoạt / Vô hiệu hóa tài khoản (chống tự khóa) |
| 40 | | `PATCH` | `/api/admin/users/{id}/role` | `ADMIN` | Phân quyền vai trò người dùng (chống tự hạ quyền) |
| 41 | **Admin Exams** | `GET` | `/api/admin/exams` | `ADMIN` | Quản lý danh sách toàn bộ đề thi của tất cả giáo viên |
| 42 | | `GET` | `/api/admin/exams/{id}` | `ADMIN` | Xem chi tiết đề thi và câu hỏi |
| 43 | | `PATCH` | `/api/admin/exams/{id}/close` | `ADMIN` | Đóng khẩn cấp đề thi đang mở |
| 44 | | `DELETE` | `/api/admin/exams/{id}` | `ADMIN` | Xóa đề thi (chỉ DRAFT/CLOSED và chưa có lượt thi) |
| 45 | **Student History** | `GET` | `/api/student/attempts` | `STUDENT` | Lấy danh sách lịch sử thi phân trang của sinh viên |
| 46 | | `GET` | `/api/student/attempts/{attemptId}` | `STUDENT` | Xem chi tiết bài làm, điểm từng câu, đáp án & vi phạm quy chế |
| 47 | **Admin System Logs** | `GET` | `/api/admin/logs` | `ADMIN` | Tìm kiếm FTS & Lọc nhật ký đa tiêu chí (phân trang 2 bước) |
| 48 | | `GET` | `/api/admin/logs/{id}` | `ADMIN` | Xem chi tiết nhật ký kiểm toán, Payload JSON và Stacktrace |
| 49 | | `GET` | `/api/admin/logs/stats` | `ADMIN` | Thống kê phân tích KPI nhật ký, tỉ lệ lỗi và độ trễ |
| 50 | | `GET` | `/api/admin/logs/metadata` | `ADMIN` | Lấy danh mục distinct module & action phục vụ lọc động |
| 51 | | `DELETE` | `/api/admin/logs/cleanup` | `ADMIN` | Dọn dẹp nhật ký cũ theo chu kỳ ngày lưu trữ retention |

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
- **Mô tả:** Lấy toàn bộ các câu hỏi tự luận (`ESSAY_TEXT`) của đề thi kèm thống kê số lượng bài chờ chấm (`pendingCount`), đã chấm (`gradedCount`), và tổng số bài (`totalSubmissions`).
- **Quyền hạn:** `TEACHER`
- **Path Variable:** `examId` (UUID)
- **Response (200 OK):**
  ```json
  {
    "status": 200,
    "message": "Essay questions retrieved successfully",
    "data": [
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
    ],
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

---

## IV. Bảng Mã Lỗi Thường Gặp (Common Error Responses)

| HTTP Status | Nguyên nhân | Cấu trúc phản hồi lỗi |
|:---:|:---|:---|
| `400 Bad Request` | Dữ liệu đầu vào không hợp lệ (sai định dạng JSON, điểm vượt quá thang điểm, v.v.) | `{"status": 400, "message": "Validation failed: ...", "data": null}` |
| `401 Unauthorized` | Không có hoặc Token JWT hết hạn | `{"status": 401, "message": "User is not authenticated", "data": null}` |
| `403 Forbidden` | Không có quyền (Ví dụ: STUDENT truy cập API TEACHER, hoặc Giáo viên không sở hữu đề thi) | `{"status": 403, "message": "Access Denied: You do not have permission...", "data": null}` |
| `404 Not Found` | Không tìm thấy tài nguyên (Exam, Question, Attempt, v.v.) | `{"status": 404, "message": "Resource not found: ...", "data": null}` |
| `503 Service Unavailable` | Dịch vụ bên ngoài (Cloudinary hoặc AI) tạm thời không kết nối được | `{"status": 503, "message": "Media upload service temporarily unavailable", "data": null}` |
