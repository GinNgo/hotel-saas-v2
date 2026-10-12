# Submission: P5-GUEST-SEARCH-FORM-02 (Round 1)

- **TaskId:** P5-GUEST-SEARCH-FORM-02
- **Round:** 1
- **SubmissionId:** sub-p5-guest-search-form-02-r1-20261011
- **ReviewedSubmissionId:** sub-p7-guest-ui-verify-01-r2-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-11T10:42:30+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **Phạm vi Vòng 1 là Đề xuất & Mockup (Round 1 Proposal & Plan Only):** Tuân thủ tuyệt đối quy tắc của PO và Reviewer Codex: *"không production code cho tới review plan"*. Vòng 1 hoàn toàn không chỉnh sửa mã nguồn production (`booking.page.ts`).
2. **0 can thiệp backend C#:** Giữ nguyên 100% mã nguồn backend.
3. **0 kết nối database:** Không truy cập, không migration, không DML tới bất kỳ cơ sở dữ liệu nào.
4. **0 vi phạm quyền sở hữu module của đồng đội:** Không can thiệp module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
5. **0 dependency mới:** Không cài đặt thêm bất kỳ gói npm bên ngoài nào; tái sử dụng các thành phần và styles sẵn có trong repo.

---

## 2. Tóm Tắt Đề Xuất & Thiết Kế Lại Form Tìm Kiếm (Agoda-inspired Search Form)

Tài liệu thiết kế chi tiết đã được lập tại: [`docs/agent-coordination/guest-search-form-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/guest-search-form-proposal.md).

### 2.1. Audit Hiện Trạng & Phân Tích Khoảng Cách Với Mẫu Hình Agoda
- **Xóa bỏ toàn bộ thuật ngữ kỹ thuật nội bộ:** Loại bỏ các chuỗi văn bản gây hoang mang cho khách hàng: *"Thông tin ánh xạ từ PublicPropertyDto"*, *"Pricing Engine"*, *"Khóa hàng độc quyền"*, *"Mã: BD01 • Slug: bien-dong-01"*. Thay bằng copy du lịch hiếu khách (hospitality copy) thân thiện.
- **Thay thế triệt để Emoji:** Thay toàn bộ emoji (`🏨`, `⏱️`, `🛏️`, `📍`, `⌛`, `✕`) bằng hệ thống **Inline SVG Vector Icons** hiện đại, đồng bộ theo tiêu chuẩn `ui-ux-pro-max`.
- **Hợp nhất thành một Floating Search Card:** Đưa ô tìm kiếm khách sạn và chọn ngày/khách vào một card màu trắng nổi bật, đổ bóng nhẹ nhàng trên hero banner thay vì chia tách rời rạc.

### 2.2. Kiến Trúc Form 4 Phân Đoạn Trọng Tâm (Search-First Architecture)
1. **Pill Switcher Hình Thức Thuê:** Chọn nhanh giữa "Nghỉ qua đêm (Overnight)" và "Thuê theo giờ (Hourly)".
2. **Phân đoạn 1 (Điểm đến / Khách sạn):** Ô tìm kiếm tích hợp dropdown gợi ý kết quả tự động từ API server `getProperties(search)`.
3. **Phân đoạn 2 (Thời gian lưu trú):**
   - Đánh giá khả thi: Tận dụng PrimeNG `p-datepicker` sẵn có trong repo (hỗ trợ lịch 2 tháng trên Desktop, touch modal trên Mobile) với fallback an toàn là native inputs được bọc giao diện Agoda.
   - Chế độ theo giờ: Ngày thuê + thời lượng (2h, 3h, 4h).
4. **Phân đoạn 3 (Số lượng khách):** Stepper tương tác nhỏ gọn với nút `[-]` và `[+]`, giới hạn 1 đến 10 khách. Ánh xạ trực tiếp vào `numberOfGuests: number` của API; không bịa thêm trường `adults`/`children` ngoài hợp đồng.
5. **Phân đoạn 4 (Nút Tìm kiếm CTA):** Nút Indigo nổi bật (`min-h-[48px]`), full-width trên Mobile.

---

## 3. Bảng Ánh Xạ Trường & Ranh Giới Hợp Đồng (Field Mapping & Contracts)

| Trường Giao Diện | Thuộc tính DTO Backend | Kiểu Dữ Liệu | Endpoint API | Ràng Buộc Hợp Đồng |
| :--- | :--- | :---: | :--- | :--- |
| **Hình thức thuê** | `RentalType` | `number` | `availability`, `quotes`, `hold` | 1 = Hourly, 2 = Overnight. Mặc định 2. |
| **Điểm đến / Khách sạn** | `search` / `slug` | `string` | `GET /api/public/properties?search=` | Tìm kiếm không dấu/có dấu trên server. |
| **Ngày nhận phòng** | `startAtUtc` | `string` | `availability`, `quotes`, `hold` | Quy đổi UTC+7 (14:00 VN) sang ISO UTC. |
| **Ngày trả phòng** | `endAtUtc` | `string` | `availability`, `quotes`, `hold` | Quy đổi UTC+7 (12:00 VN) sang ISO UTC. |
| **Số lượng khách** | `NumberOfGuests` | `number` | `POST /api/public/bookings/hold` | Giới hạn 1 - 10 khách. Không phân tách adults/children. |

---

## 4. Kế Hoạch Triển Khai Cho Round 2 (Implementation Plan)

1. **Bước 1 (Template Refactoring):** Cập nhật markup form tìm kiếm trong `booking.page.ts` sang card nổi phong cách Agoda, thay thế emojis bằng inline SVG icons, loại bỏ copy kỹ thuật.
2. **Bước 2 (Stepper & Dropdown Wiring):** Tích hợp stepper số lượng khách (`numberOfGuests`) và dropdown gợi ý khách sạn.
3. **Bước 3 (Date Picker Integration):** Hoàn thiện khối chọn ngày lưu trú.
4. **Bước 4 (Unit & Regression Tests):** Cập nhật `public-booking.page.spec.ts` với test cases cho form tìm kiếm mới, stepper và accessibility.
5. **Bước 5 (Visual Evidence & Manifest):** Chạy kiểm chứng trên Chromium tại 375px, 768px, 1440px và xuất ảnh thật kèm manifest.

---

## 5. Artifacts Gửi Kèm

- **Đề xuất chi tiết:** [`docs/agent-coordination/guest-search-form-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/guest-search-form-proposal.md)
- **Lịch sử Round 2 Verification:** [`docs/agent-coordination/history/submission-p7-guest-ui-verify-01-r2-20261011.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/history/submission-p7-guest-ui-verify-01-r2-20261011.md)
- **Baseline mã nguồn:** Giữ nguyên baseline commit develop@`3f95339` (chưa sửa production code trong Round 1).
