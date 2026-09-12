# QuickTest Online Exam System - Comprehensive API Documentation

Tài liệu đặc tả toàn bộ **44 RESTful Endpoints** của hệ thống thi trực tuyến **QuickTest** (Spring Boot 3.x, PostgreSQL, Redis, RabbitMQ, Cloudinary, Google Gemini AI).

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
| 7 | | `PUT` | `/api/teacher/exams/{id}` | `TEACHER` | Cập nhật thông tin đề thi |
| 8 | | `PATCH` | `/api/teacher/exams/{id}/publish` | `TEACHER` | Xuất bản đề thi (PUBLISHED) |
| 9 | | `PATCH` | `/api/teacher/exams/{id}/close` | `TEACHER` | Đóng đề thi (CLOSED) |
| 10 | | `DELETE` | `/api/teacher/exams/{id}` | `TEACHER` | Xóa đề thi (chỉ xóa DRAFT) |
| 11 | **Questions** | `POST` | `/api/teacher/exams/{examId}/questions` | `TEACHER` | Thêm câu hỏi vào đề thi |
| 12 | | `PUT` | `/api/teacher/questions/{questionId}` | `TEACHER` | Cập nhật câu hỏi và đáp án |
| 13 | | `PUT` | `/api/teacher/questions/{questionId}/image` | `TEACHER` | Cập nhật trực tiếp ảnh câu hỏi (xóa ảnh cũ Cloudinary) |
| 14 | | `DELETE` | `/api/teacher/questions/{questionId}` | `TEACHER` | Xóa câu hỏi (tự động dọn ảnh câu hỏi + đáp án trên Cloudinary) |
| 15 | **Media Upload** | `POST` | `/api/teacher/media/upload` | `TEACHER` | Upload 1 file ảnh đồng bộ lên Cloudinary |
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
| 30 | | `GET` | `/api/teacher/grading/attempts/{attemptId}` | `TEACHER` | Xem chi tiết bài làm của 1 thí sinh để chấm |
| 31 | | `POST` | `/api/teacher/grading/attempts/submit-grades` | `TEACHER` | Lưu điểm các câu tự luận của 1 bài thi |
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
- **Mô tả:** Chuyển trạng thái đề thi sang `CLOSED` (ngừng nhận thí sinh làm bài mới).
- **Quyền hạn:** `TEACHER`
- **Response (200 OK):** `ExamDetailResponse` (status = "CLOSED")

#### 2.7. Xóa đề thi (`DELETE /api/teacher/exams/{id}`)
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
- **Mô tả:** SDK giám sát phía client gửi telemetry khi phát hiện gian lận: rời màn hình, switch tab, mất tiêu điểm chuột, phím tắt cấm, v.v.
- **Request Body:**
  ```json
  {
    "attemptId": "a93e3d64-e5e3-4d64-8ee1-d309be0d23aa",
    "violationType": "TAB_SWITCH",
    "details": "User switched away to another application for 6 seconds"
  }
  ```
- **Response (200 OK):** `ViolationAlertMessage` (thông báo cảnh báo vi phạm)

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

## IV. Bảng Mã Lỗi Thường Gặp (Common Error Responses)

| HTTP Status | Nguyên nhân | Cấu trúc phản hồi lỗi |
|:---:|:---|:---|
| `400 Bad Request` | Dữ liệu đầu vào không hợp lệ (sai định dạng JSON, điểm vượt quá thang điểm, v.v.) | `{"status": 400, "message": "Validation failed: ...", "data": null}` |
| `401 Unauthorized` | Không có hoặc Token JWT hết hạn | `{"status": 401, "message": "User is not authenticated", "data": null}` |
| `403 Forbidden` | Không có quyền (Ví dụ: STUDENT truy cập API TEACHER, hoặc Giáo viên không sở hữu đề thi) | `{"status": 403, "message": "Access Denied: You do not have permission...", "data": null}` |
| `404 Not Found` | Không tìm thấy tài nguyên (Exam, Question, Attempt, v.v.) | `{"status": 404, "message": "Resource not found: ...", "data": null}` |
| `503 Service Unavailable` | Dịch vụ bên ngoài (Cloudinary hoặc AI) tạm thời không kết nối được | `{"status": 503, "message": "Media upload service temporarily unavailable", "data": null}` |
