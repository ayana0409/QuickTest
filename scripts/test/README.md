# Hướng Dẫn Sử Dụng Bộ Kiểm Thử Tải K6 (QuickTest Load & Stress Testing)

Bộ công cụ kiểm thử tải và chịu tải cao (Load & Stress Testing) cho hệ thống thi trực tuyến **QuickTest** (Spring Boot 3.x, Redis, RabbitMQ, PostgreSQL).

---

## 🌟 Tính Năng Nổi Bật

1. **Thích ứng câu hỏi động (Dynamic Question Adaptation):**
   * Không bị gán cứng (hardcoded) vào bất kỳ đề thi hay câu hỏi nào.
   * Tự động lấy danh sách câu hỏi thực tế từ phản hồi `POST /api/session/start`.
   * Tự động nhận diện và sinh câu trả lời hợp lệ cho cả 4 loại câu hỏi:
     * `SINGLE_CHOICE`: Trắc nghiệm 1 đáp án.
     * `MULTIPLE_CHOICE`: Trắc nghiệm nhiều đáp án.
     * `NUMERIC`: Câu hỏi điền số thực tế.
     * `ESSAY_TEXT`: Câu hỏi tự luận bằng đoạn văn bản tiếng Việt.
2. **Tự động tìm hoặc tự tạo đề (Auto-Discovery & Auto-Provisioning):**
   * Nếu bạn truyền mã đề (`-AccessCode XYZ`), k6 sẽ test đề đó.
   * Nếu không truyền mã đề, k6 tự tìm đề thi công khai đang mở (`GET /api/public/exams`).
   * **Đặc biệt:** Nếu cơ sở dữ liệu hoàn toàn trống (chưa có đề nào), k6 sẽ tự động đăng nhập/đăng ký tài khoản giáo viên, tự tạo một đề thi chuẩn 180 phút, thêm 4 câu hỏi mẫu đầy đủ các dạng, tự xuất bản (`PUBLISH`) và cấp cho các thí sinh ảo test tải ngay lập tức!
3. **Dọn dẹp tự động (Auto-Cleanup):**
   * Đề thi do k6 tự tạo sẽ tự động được đóng lại (`CLOSED`) sau khi đợt test kết thúc để giữ sạch hệ thống (có thể giữ lại bằng `-KeepExam $true`).
4. **Vượt qua Rate-Limit & Giả lập trung thực:**
   * Thuật toán sinh IP ngẫu nhiên đảm bảo duy nhất toán học qua 8 dải IP nhà mạng Việt Nam (VNPT, Viettel, FPT).
   * Họ và tên tiếng Việt ngẫu nhiên kèm định danh phiên thi `guestIdentifier` duy nhất.
   * Gửi `Heartbeat` định kỳ 10 giây giữ thí sinh hiển thị `ONLINE` trên màn hình giám sát giáo viên.

---

## 📁 Cấu Trúc Thư Mục `scripts/test/`

```text
scripts/test/
├── k6.exe                  # File nhị phân K6 Portable chạy trực tiếp trên Windows
├── k6_load_test.js         # Script kiểm thử tải K6 chính (Dynamic & Auto-Provisioning)
├── run_k6_test.bat         # File thực thi Batch Windows (One-click double-click để chạy)
├── run_k6_test.ps1         # File thực thi PowerShell mở rộng hỗ trợ đầy đủ tham số
└── README.md               # Tài liệu hướng dẫn sử dụng chi tiết (tệp này)
```

---

## 🚀 Hướng Dẫn Chạy Nhanh

### Cách 1: Chạy bằng PowerShell (`run_k6_test.ps1`) *(Khuyên dùng)*

Mở PowerShell tại thư mục dự án và gọi:

#### 1. Chạy tự động hoàn toàn (Default: 10 VUs, 30 giây)
```powershell
.\scripts\test\run_k6_test.ps1
```
*K6 sẽ tự tìm đề thi trên hệ thống hoặc tự tạo đề mới nếu DB chưa có đề.*

#### 2. Tùy chỉnh số lượng Virtual Users (Users) và thời gian (Duration)
```powershell
# Chạy 50 thí sinh đồng thời trong 2 phút
.\scripts\test\run_k6_test.ps1 -Users 50 -Duration 2m

# Chạy 100 thí sinh trong 5 phút
.\scripts\test\run_k6_test.ps1 -Users 100 -Duration 5m
```

#### 3. Chỉ định mã đề thi cụ thể
```powershell
# Chạy vào đề thi cụ thể (ví dụ mã EXAM01)
.\scripts\test\run_k6_test.ps1 -AccessCode EXAM01 -Users 30 -Duration 1m
```

#### 4. Chạy đủ số lượng bài thi rồi dừng (Iterations)
```powershell
# Chạy hoàn thành đúng 100 bài thi rồi kết thúc
.\scripts\test\run_k6_test.ps1 -Users 20 -Iterations 100
```

#### 5. Thí sinh nộp bài thi thực sự (`-Submit $true`)
*Mặc định:* Thí sinh làm bài, lưu nháp, gửi heartbeat và giữ trạng thái `IN_PROGRESS` (đang làm bài) để giáo viên quan sát trên giao diện giám sát. Nếu muốn thí sinh bấm nộp bài thực sự vào hàng đợi RabbitMQ:
```powershell
.\scripts\test\run_k6_test.ps1 -Users 50 -Duration 1m -Submit $true
```

#### 6. Chạy với Backend Localhost
```powershell
.\scripts\test\run_k6_test.ps1 -BaseUrl "http://localhost:8080/api" -Users 20 -Duration 30s
```

#### 7. Giữ lại đề thi tự tạo để xem lại trên giao diện Web
```powershell
.\scripts\test\run_k6_test.ps1 -Users 10 -Duration 30s -KeepExam $true
```

---

### Cách 2: Chạy bằng File Batch (`run_k6_test.bat`)

* **One-click:** Nhấp đúp chuột vào file `scripts/test/run_k6_test.bat` trong Windows Explorer để chạy ngay với cấu hình mặc định (20 VUs, 30s).
* **Chạy từ Command Prompt (CMD):**
  ```cmd
  scripts\test\run_k6_test.bat --vus 50 --duration 1m -e ACCESS_CODE=EXAM01
  ```

---

### Cách 3: Chạy trực tiếp bằng `k6.exe`

```powershell
.\scripts\test\k6.exe run --vus 50 --duration 1m `
  -e BASE_URL="http://100.76.224.64/quick-test-be/api" `
  -e ACCESS_CODE="EXAM01" `
  -e SUBMIT=true `
  .\scripts\test\k6_load_test.js
```

---

## ⚙️ Bảng Tra Cứu Toàn Bộ Tham Số Cấu Hình

| Biến môi trường (`-e`) | Tham số PowerShell | Mặc định | Ý nghĩa & Mô tả |
|:---|:---|:---:|:---|
| `BASE_URL` | `-BaseUrl` | `http://100.76.224.64/quick-test-be` | Địa chỉ gốc Backend API (tự bổ sung `/api` nếu thiếu). |
| `ACCESS_CODE` | `-AccessCode` | `""` (để trống) | Mã đề thi cần test. Nếu để trống: k6 tự động tìm hoặc tự tạo đề mới. |
| `VUS` | `-Users` | `10` | Số lượng người dùng ảo chạy đồng thời (Virtual Users). |
| `DURATION` | `-Duration` | `30s` | Thời gian chạy test (ví dụ: `30s`, `1m`, `5m`, `10m`). |
| `ITERATIONS` | `-Iterations` | `0` (không dùng) | Tổng số lượt thi cần chạy (khi đạt số lượt sẽ dừng test). |
| `SUBMIT` | `-Submit` | `false` | `true`: Nộp bài thi cuối giờ qua RabbitMQ. `false`: Giữ trạng thái làm bài `IN_PROGRESS`. |
| `HOLD_SESSION` | `-HoldSession` | `true` | Gửi heartbeat định kỳ 10 giây giữ thí sinh hiển thị `ONLINE`. |
| `SAVE_DRAFT` | `-SaveDraft` | `true` | Tự động lưu nháp từng câu trả lời vào Redis (`PUT /api/session/{id}/save`). |
| `KEEP_EXAM` | `-KeepExam` | `false` | Giữ lại đề thi do k6 tự tạo (mặc định tự động đóng đề sau khi test xong). |
| `SLEEP_MIN` | *(ENV)* | `0.05` | Thời gian nghỉ tối thiểu (giây) giữa các câu hỏi khi lưu nháp. |
| `SLEEP_MAX` | *(ENV)* | `0.2` | Thời gian nghỉ tối đa (giây) giữa các câu hỏi khi lưu nháp. |

---

## 📊 Các Chỉ Số Đo Lường (Metrics & Thresholds)

Khi test hoàn tất, k6 sẽ xuất bảng báo cáo với các chỉ số tiêu chuẩn:

* `start_exam_duration`: Thời gian phản hồi khi thí sinh vào phòng thi (`POST /api/session/start`). Tiêu chuẩn: **P95 < 2s**.
* `save_draft_duration`: Thời gian lưu nháp câu trả lời vào Redis (`PUT /api/session/{id}/save`). Tiêu chuẩn: **P95 < 1.5s**.
* `submit_exam_duration`: Thời gian tiếp nhận nộp bài qua RabbitMQ (`POST /api/session/{id}/submit`). Tiêu chuẩn: **P95 < 2.5s**.
* `http_req_failed`: Tỷ lệ request HTTP bị lỗi. Tiêu chuẩn: **< 5%**.
* `exam_completion_rate`: Tỷ lệ thí sinh hoàn thành quy trình vào phòng thi và làm bài.
* `successful_heartbeats`: Tổng số gói tin nhịp tim giữ kết nối thành công.

