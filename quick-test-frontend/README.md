# QuickTest Frontend Client ⚡

> **Modern, High-Performance Online Examination & AI Proctoring Web Application**  
> Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**, **Zustand**, **Axios**, and **STOMP WebSocket**.

---

## 📑 Mục lục
- [1. Giới thiệu tổng quan](#1-giới-thiệu-tổng-quan)
- [2. Các phân hệ người dùng (Portals & Core Features)](#2-các-phân-hệ-người-dùng-portals--core-features)
- [3. Ngăn xếp công nghệ (Technology Stack)](#3-ngăn-xếp-công-nghệ-technology-stack)
- [4. Cấu trúc thư mục mã nguồn (Project Architecture)](#4-cấu-trúc-thư-mục-mã-nguồn-project-architecture)
- [5. Hướng dẫn cài đặt & Khởi chạy (Getting Started)](#5-hướng-dẫn-cài-đặt--khởi-chạy-getting-started)
- [6. Biến môi trường (Environment Variables)](#6-biến-môi-trường-environment-variables)
- [7. Bản đồ định tuyến (Routing Map)](#7-bản-đồ-định-tuyến-routing-map)
- [8. Tài khoản kiểm thử mặc định (Default Accounts)](#8-tài-khoản-kiểm-thử-mặc-định-default-accounts)

---

## 1. Giới thiệu tổng quan

**QuickTest Frontend Client** là giao diện người dùng chính của nền tảng thi trực tuyến QuickTest, cung cấp trải nghiệm làm bài thi hiện đại, mượt mà và trực quan cho học sinh, đồng thời trang bị đầy đủ công cụ quản trị, soạn đề và chấm thi tự động bằng AI cho giáo viên và quản trị viên.

Ứng dụng được xây dựng trên nền tảng **Next.js 16 (App Router)** kết hợp **Tailwind CSS v4**, hỗ trợ Server Components kết hợp Client Components tối ưu tốc độ tải trang, quản lý trạng thái tập trung với **Zustand**, và kết nối viễn trắc thời gian thực qua **WebSocket / STOMP**.

---

## 2. Các phân hệ người dùng (Portals & Core Features)

### 🎓 1. Phân hệ Thí sinh & Làm bài thi (Candidate & Student Portal)
- **Tham gia thi tức thì (Guest Access):** Thí sinh vãng lai không cần tạo tài khoản, chỉ cần nhập Tên, Mã định danh (MSSV/SĐT/Email) và Mã truy cập đề thi (`accessCode`) tại trang chủ `/` hoặc `/exam`.
- **Phòng thi tập trung chống gian lận (`/exam/[attemptId]`):**
  - **Chế độ toàn màn hình cưỡng chế (Enforced Full-Screen):** Tự động phát hiện và cảnh báo khi thí sinh cố tình thoát toàn màn hình.
  - **Server-Side Timer Sync:** Đồng hồ đếm ngược đồng bộ chặt chẽ với máy chủ, tự động thu bài khi hết giờ.
  - **Auto-Save Redis Buffering:** Tự động lưu đáp án sau mỗi thao tác chọn/nhập văn bản, chống mất bài khi mất kết nối mạng.
  - **Viễn trắc giám sát (Proctoring Telemetry):** Theo dõi sự kiện chuyển tab (`TAB_SWITCH`), mở F12/Inspect (`DEVTOOLS_OPEN`), gửi tín hiệu Heartbeat duy trì phiên thi.
- **Xem kết quả & Lịch sử học tập (`/student/history`):**
  - Bảng tổng kết điểm, thời gian làm bài, tỷ lệ câu đúng.
  - Xem chi tiết từng câu hỏi, lời giải thích sư phạm, nhận xét của giáo viên và điểm số gợi ý bởi AI.
  - Xem chi tiết nhật ký vi phạm quy chế thi trong phiên làm bài.

### 👩‍🏫 2. Phân hệ Giáo viên & Giảng viên (Teacher Portal)
- **Quản lý Vòng đời Đề thi (`/teacher/exams`):**
  - Tạo mới, cấu hình thời lượng, số lần vi phạm tối đa, bật/tắt viễn trắc camera, bật/tắt hiển thị kết quả cho học sinh.
  - Quản lý trạng thái đề thi: Bản nháp (`DRAFT`), Xuất bản (`PUBLISHED`), Đóng đề (`CLOSED`), Mở lại đề thi (`REPUBLISH`).
  - Nhân bản đề thi bất đồng bộ và xóa đề thi nháp an toàn.
- **Soạn thảo câu hỏi trực quan (`/teacher/exams/[id]/edit`):**
  - Hỗ trợ đầy đủ 4 dạng câu hỏi: Trắc nghiệm 1 đáp án, Trắc nghiệm nhiều đáp án, Câu số (có dung sai sai số $\pm \epsilon$), Tự luận (kèm biểu điểm Rubric & Đáp án mẫu).
  - Tải ảnh câu hỏi và từng phương án đáp án trực tiếp lên Cloudinary.
  - Tìm kiếm toàn văn (FTS) và nhập câu hỏi từ Ngân hàng câu hỏi cá nhân.
- **Soạn đề thi thông minh bằng AI (AI Quiz Generator Modal):**
  - Tải tệp tài liệu bài học (PDF, DOCX, TXT) hoặc nhập nội dung văn bản.
  - Cấu hình số lượng câu hỏi, độ khó (`EASY`, `MEDIUM`, `HARD`, `BALANCED`), ngôn ngữ (`vi`, `en`) và loại câu hỏi mục tiêu.
  - Cơ chế tạo chạy ngầm đơn luồng kết hợp **Adaptive Multi-Pass & Rotation Continuation** chống tràn token 8,192 của Gemini.
  - Xem trước câu hỏi và duyệt lưu trực tiếp vào đề thi.
- **Trung tâm Giám sát Tác vụ AI Ngầm (`/teacher/ai-tasks`):**
  - Bento Grid thống kê số tác vụ đang chạy, hoàn tất, thất bại.
  - Lắng nghe trạng thái realtime: tiến độ phần trăm (%), thông điệp bước thực thi chi tiết.
  - Lọc danh sách đề thi nháp (`DRAFT`), tìm kiếm mã đề thi, phân trang.
  - Modal duyệt câu hỏi đã tạo và nạp vào đề thi ngay từ trang giám sát.
- **Trung tâm Chấm thi Linh hoạt (`/teacher/grading`):**
  - *Attempt-Centric:* Chấm điểm từng bài làm của học sinh.
  - *Question-Centric:* Chấm tập trung theo từng câu hỏi cho toàn bộ học sinh để đảm bảo tính khách quan và tăng tốc độ chấm.
  - **Kích hoạt chấm điểm tự luận bằng AI:** Chấm tự động cho 1 câu hỏi cụ thể hoặc toàn bộ đề thi qua Gemini Rotation Pool.
  - **Xuất bảng điểm Excel (.xlsx):** Xuất danh sách bài thi và bảng điểm chi tiết từng học sinh.
- **Giám sát phòng thi thời gian thực (`/teacher/exams/[id]/proctoring`):**
  - Giám sát trạng thái Heartbeat, tỷ lệ tập trung và nhật ký vi phạm của từng thí sinh.
  - Đình chỉ thi khẩn cấp (`Disqualify`) đối với thí sinh gian lận nghiêm trọng.

### 🛡️ 3. Phân hệ Quản trị viên (Admin Portal)
- **Dashboard phân tích KPI (`/admin`):** Tổng số tài khoản, đề thi, lượt thi, tỷ lệ vi phạm quy chế.
- **Quản trị người dùng (`/admin/users`):** Danh sách phân trang, tìm kiếm FTS, cập nhật vai trò (Role), kích hoạt/khóa tài khoản (`toggle-status`) có cơ chế chống tự khóa.
- **Quản trị hệ thống AI Gemini Pool (`/admin/ai`):**
  - Theo dõi Live Metrics thời gian thực: chỉ số RPM/TPM Sliding Window trên Redis của từng slot, thời gian cooldown.
  - Quản lý danh sách API Key và Model Slots (`gemini-1.5-flash`, `gemini-2.0-flash-lite`, `gemini-1.5-pro`).
  - Nạp lại Rotation Pool từ Database (`reload`) và hủy khẩn cấp các tác vụ chạy ngầm bị kẹt.
- **Quản trị kiểm duyệt nội dung câu hỏi (`/admin/moderation`):**
  - Bộ lọc câu hỏi: An toàn / Bị gắn cờ vi phạm, câu hỏi có ảnh, loại câu hỏi.
  - Kích hoạt tác vụ AI quét kiểm duyệt hàng loạt ngầm qua Gemini và đặt lại con trỏ duyệt Redis.
  - Can thiệp thủ công: Đánh dấu an toàn, thu hồi cờ hoặc xóa câu hỏi vi phạm tiêu chuẩn cộng đồng.
- **Nhật ký kiểm toán tập trung (`/admin/logs`):** Tìm kiếm toàn văn FTS, lọc đa tiêu chí (Module, Action, Khoảng thời gian, Trạng thái lỗi), xem Stacktrace chi tiết và dọn dẹp log cũ theo chu kỳ ngày.
- **Giám sát sức khỏe hệ thống (`/admin/health`):** Kiểm tra trạng thái kết nối PostgreSQL, Redis, CPU, RAM, dung lượng đĩa và thời gian hoạt động JVM Uptime.

---

## 3. Ngăn xếp công nghệ (Technology Stack)

| Phân loại | Công nghệ / Thư viện | Mục đích sử dụng |
|:---|:---|:---|
| **Core Framework** | Next.js 16 (App Router) | Khung ứng dụng chính, quản lý routing, render Server & Client Components |
| **Language** | TypeScript | Kiểm soát kiểu tĩnh an toàn, tự động gợi ý code |
| **Styling** | Tailwind CSS v4, PostCSS | Thiết kế giao diện hiện đại, tối giản và responsive linh hoạt |
| **State Management** | Zustand | Quản lý trạng thái đăng nhập, phiên thi và dữ liệu toàn cục |
| **Form Handling** | React Hook Form | Xử lý form biểu mẫu hiệu năng cao, giảm re-render |
| **Realtime Protocol**| STOMP.js, SockJS | Kết nối WebSocket nhận viễn trắc phòng thi và giám sát vi phạm |
| **HTTP Client** | Axios | Giao tiếp REST API backend, đính kèm token và xử lý lỗi tập trung |
| **Icons & Alerts** | Lucide Icons, React Hot Toast | Bộ biểu tượng phong phú và thông báo pop-up trực quan |
| **Cookie Storage** | js-cookie | Lưu trữ JWT token an toàn trên trình duyệt |

---

## 4. Cấu trúc thư mục mã nguồn (Project Architecture)

```text
quick-test-frontend/
├── public/                         # Tài nguyên tĩnh (Logo, favicon, ảnh minh họa)
├── src/
│   ├── app/                        # App Router định tuyến phân cấp
│   │   ├── (auth)/                 # Nhóm trang xác thực (Login, Register)
│   │   ├── (dashboard)/            # Nhóm trang bảng điều khiển theo vai trò
│   │   │   ├── admin/              # Admin Portal (KPI, Users, AI Pool, Moderation, Logs, Health)
│   │   │   ├── student/            # Student Portal (Dashboard, History, Attempt Detail)
│   │   │   └── teacher/            # Teacher Portal (Exams, Edit, Proctoring, Grading, AI Tasks)
│   │   ├── exam/                   # Phòng thi tập trung (Guest/Student Entry, Attempt, Result)
│   │   ├── layout.tsx              # Root Layout bọc ToastProvider và Font
│   │   ├── page.tsx                # Landing Page công khai & cổng nhập mã thi nhanh
│   │   └── globals.css             # Tailwind CSS v4 directives & theme styles
│   ├── components/                 # Các thành phần giao diện tái sử dụng
│   │   ├── admin/                  # Components quản trị AI, logs, user, health
│   │   ├── auth/                   # Form đăng nhập, đăng ký
│   │   ├── common/                 # Button, Modal, Card, Input, Loading, Pagination
│   │   ├── exam/                   # Phòng thi: QuestionCard, CountdownTimer, ProctoringShield, AI Modal
│   │   ├── grading/                # Biểu ghi chấm thi, Question-Centric Grader, AI Grading Trigger
│   │   ├── layout/                 # Navbar, Sidebar, Footer, UserMenu
│   │   └── proctoring/             # Bảng giám sát học sinh, cảnh báo vi phạm
│   ├── lib/                        # Thư viện tiện ích
│   │   ├── api.ts                  # Cấu hình Axios Client & Interceptor tự động gán Token
│   │   ├── utils.ts                # Hàm định dạng thời gian, tính điểm, ghép class (clsx/twMerge)
│   │   └── websocket.ts            # Client STOMP/SockJS kết nối phòng thi
│   ├── services/                   # Lớp gọi API backend phân rã theo nghiệp vụ
│   │   ├── auth.service.ts         # Đăng nhập, đăng ký, hồ sơ cá nhân
│   │   ├── exam.service.ts         # CRUD đề thi, xuất bản, nhân bản đề
│   │   ├── question.service.ts     # Thêm/sửa/xóa câu hỏi, import ngân hàng
│   │   ├── session.service.ts      # Bắt đầu thi, lưu nháp Redis, nộp bài
│   │   ├── grading.service.ts      # Chấm bài thi, chấm theo câu, trigger AI
│   │   ├── teacher-ai.service.ts   # Tạo đề AI từ file, giám sát AI Tasks
│   │   ├── admin-ai.service.ts     # Quản lý AI Keys, Slots, Metrics, clear jobs
│   │   ├── moderation.service.ts   # Kiểm duyệt câu hỏi an toàn, AI scan
│   │   └── system-log.service.ts   # Tra cứu audit logs FTS, system health
│   ├── stores/                     # Kho trạng thái Zustand
│   │   ├── auth.store.ts           # Trạng thái đăng nhập, quyền hạn User
│   │   └── exam-session.store.ts   # Trạng thái bài làm, danh sách nháp, đếm ngược
│   ├── types/                      # Định nghĩa kiểu dữ liệu TypeScript (DTOs & Entities)
│   └── middleware.ts               # Next.js Edge Middleware bảo vệ route theo Role
├── .env.example                    # Tệp mẫu cấu hình biến môi trường
├── package.json                    # Cấu hình dự án và dependencies
├── tsconfig.json                   # Cấu hình TypeScript
└── next.config.ts                  # Cấu hình Next.js (Ảnh domain Cloudinary, rewrites)
```

---

## 5. Hướng dẫn cài đặt & Khởi chạy (Getting Started)

### Bước 1: Di chuyển vào thư mục Frontend
```bash
cd quick-test-frontend
```

### Bước 2: Cài đặt các gói phụ thuộc (Dependencies)
```bash
npm install
```

### Bước 3: Cấu hình biến môi trường
Sao chép tệp cấu hình mẫu sang `.env`:
```bash
# Trên Linux/macOS
cp .env.example .env

# Trên Windows (PowerShell)
Copy-Item .env.example .env
```
Mở file `.env` và đảm bảo đường dẫn trỏ tới Backend API đang chạy:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api
NEXT_PUBLIC_WS_URL=http://localhost:8080/ws-exam
```

### Bước 4: Khởi động máy chủ phát triển (Development Mode)
```bash
npm run dev
```
Ứng dụng sẽ khả dụng tại: **`http://localhost:3000`**

### Bước 5: Đóng gói và chạy môi trường Production
```bash
# Biên dịch gói sản phẩm tối ưu hóa
npm run build

# Khởi chạy máy chủ Production
npm run start
```

---

## 6. Biến môi trường (Environment Variables)

| Tên biến môi trường | Giá trị mặc định | Mô tả |
|:---|:---|:---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080/api` | Đường dẫn gốc tới máy chủ Backend REST API |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:8080/ws-exam` | Địa chỉ kết nối SockJS / WebSocket viễn trắc |

---

## 7. Bản đồ định tuyến (Routing Map)

| Đường dẫn (Route) | Phân quyền truy cập | Chức năng chính |
|:---|:---:|:---|
| `/` | Công khai | Trang chủ giới thiệu, cổng nhập mã thi nhanh |
| `/login` | Công khai | Màn hình đăng nhập tài khoản |
| `/register` | Công khai | Màn hình đăng ký tài khoản mới |
| `/exam` | Công khai (Guest/User) | Điền thông tin thí sinh và bắt đầu phòng thi |
| `/exam/[attemptId]` | Người dự thi | Màn hình phòng thi tập trung chống gian lận |
| `/exam/[attemptId]/result` | Người dự thi | Xem kết quả thi sau khi nộp bài |
| `/student` | `ROLE_STUDENT` | Bảng điều khiển học tập, thống kê cá nhân |
| `/student/history` | `ROLE_STUDENT` | Lịch sử toàn bộ các bài thi đã làm |
| `/student/history/[attemptId]`| `ROLE_STUDENT` | Xem chi tiết bài làm, đáp án và nhận xét |
| `/teacher/exams` | `ROLE_TEACHER` | Danh sách quản lý các đề thi của giáo viên |
| `/teacher/exams/create` | `ROLE_TEACHER` | Tạo cấu hình đề thi mới |
| `/teacher/exams/[id]/edit` | `ROLE_TEACHER` | Soạn câu hỏi và tạo đề AI từ tài liệu |
| `/teacher/exams/[id]/proctoring`| `ROLE_TEACHER` | Giám sát thí sinh phòng thi thời gian thực |
| `/teacher/grading` | `ROLE_TEACHER` | Trung tâm chấm thi các bài nộp |
| `/teacher/grading/exams/[examId]`| `ROLE_TEACHER` | Danh sách bài làm theo đề & kích hoạt AI chấm |
| `/teacher/grading/questions/[questionId]`| `ROLE_TEACHER` | Chấm tập trung theo từng câu hỏi (Question-Centric) |
| `/teacher/ai-tasks` | `ROLE_TEACHER` | Bảng giám sát các tác vụ AI ngầm (tạo đề & chấm thi) |
| `/admin` | `ROLE_ADMIN` | Bảng điều khiển phân tích số liệu toàn hệ thống |
| `/admin/users` | `ROLE_ADMIN` | Quản lý danh sách tài khoản, khóa và phân quyền |
| `/admin/ai` | `ROLE_ADMIN` | Bảng quản trị Gemini AI Pool, Live Metrics RPM/TPM |
| `/admin/moderation` | `ROLE_ADMIN` | Kiểm duyệt câu hỏi an toàn và chạy AI quét ngầm |
| `/admin/logs` | `ROLE_ADMIN` | Tra cứu FTS nhật ký kiểm toán hệ thống (Audit Logs) |
| `/admin/health` | `ROLE_ADMIN` | Giám sát trạng thái sức khỏe phần cứng, DB, Redis |

---

## 8. Tài khoản kiểm thử mặc định (Default Accounts)

Bạn có thể sử dụng các tài khoản định danh sẵn sau để đăng nhập và trải nghiệm các phân hệ giao diện:

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Quyền hạn giao diện |
|:---|:---|:---|:---|
| **Quản trị viên (ADMIN)** | `admin@quicktest.com` | `Admin@123` | Toàn quyền Quản trị hệ thống, AI Pool, Logs, Users |
| **Giáo viên (TEACHER)** | `teacher@quicktest.com` | `Teacher@123` | Quản lý đề thi, Soạn câu hỏi, AI Quiz, Chấm thi, Giám sát |
| **Sinh viên (STUDENT)** | `student@quicktest.com` | `Student@123` | Dashboard cá nhân, Lịch sử thi, Làm bài thi |

---

## 📄 Bản quyền & Giấy phép (License)

Dự án này được phân phối dưới giấy phép **Proprietary & Confidential — All Rights Reserved**.  
Toàn bộ mã nguồn và tài sản trí tuệ thuộc quyền sở hữu của **Ayana0409 / QuickTest**.

---

*QuickTest Client — Built for modern, fast & lean online exams.*
