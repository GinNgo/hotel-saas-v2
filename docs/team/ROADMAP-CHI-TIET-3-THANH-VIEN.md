# LỘ TRÌNH CHI TIẾT TỪNG TUẦN CHO 3 THÀNH VIÊN
### ĐỀ TÀI: XÂY DỰNG HỆ THỐNG QUẢN LÝ KHÁCH SẠN (HOTEL SAAS PLATFORM)
- **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
- **Nhánh tích hợp chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop)
- **Phân định vai trò:**
  1. 👤 **Ngô Võ Tuấn An** (MSSV: **24TX810001**) — Nhóm trưởng / Kiến trúc sư hệ thống & Backend (.NET 10, EF Core, PostgreSQL 17, Docker, AI)
  2. 👤 **Nguyễn Khôi Nguyên** (MSSV: **24TX810011**) — Lập trình viên Frontend (Angular 22 — Module Danh mục Phòng, Hạng phòng, Bảng giá, Sơ đồ phòng)
  3. 👤 **Trần Trọng Tân** (MSSV: **24TX810025**) — Lập trình viên Frontend (Angular 22 — Module Buồng phòng, Đơn đặt phòng, Thu ngân, Cổng khách OTA)

---

## 1. MA TRẬN PHÂN CÔNG TỔNG HỢP (TUẦN 1 ĐẾN TUẦN 7+)

| Tuần | Mốc Phase | Ngô Võ Tuấn An *(24TX810001)* | Nguyễn Khởi Nguyên *(24TX810011)* | Trần Trọng Tân *(24TX810025)* |
|:---:|:---:|---|---|---|
| **Tuần 1** | **P0 - P1A** | Khởi tạo Clean Arch, CI/CD 6 stages, Auth JWT & RBAC, Seeder data mẫu. | Hoàn thành Phân hệ Danh mục Phòng & Hạng phòng (Room & RoomType CRUD CQRS). | Hoàn thành Sơ đồ Buồng phòng FSM (Housekeeping Board, Optimistic Concurrency, KPI). |
| **Tuần 2** | **P2 - P3** | Pricing Engine đa hình thức, Reservation Engine Core, Stay Lifecycle API (Check-in/Out), Danh mục 2 cấp. | Màn hình Đặt phòng Lễ tân tại quầy (`reservations.page.ts`), Chọn phòng trống trực quan + Sơ đồ Timeline phòng. | Quy trình Lễ tân Check-in / Check-out liên thông buồng phòng + Bảng kê Hóa đơn Folio & Thu ngân (`payments.page.ts`). |
| **Tuần 3** | **P4 - P5** | Public OTA API tra cứu phòng, Cơ chế Giữ phòng 15 phút (Hold TTL), Tự động nhả tồn, Webhook thanh toán. | Giao diện Đặt phòng công khai (OTA Discovery), Tìm kiếm theo Tỉnh thành & Xã phường (Danh mục 2 cấp). | Giao diện Giữ chỗ 15 phút (`booking-hold.page`), Đồng hồ đếm ngược, Tra cứu đơn đặt phòng bằng mã bí mật `lookupToken`. |
| **Tuần 4** | **P6** | Tích hợp Google Gemini AI tìm phòng tiếng Việt, Kiểm tra phòng trống thời gian thực, Báo cáo doanh thu tổng hợp. | Giao diện Khung chat / Tìm phòng AI thông minh, Gợi ý phòng tự động, Tối ưu hóa trải nghiệm tìm kiếm. | Màn hình Báo cáo Quản trị Doanh thu chi nhánh, Thống kê tỷ lệ lấp đầy phòng (Occupancy Rate), Bàn giao ca. |
| **Tuần 5** | **P7A** | Đóng gói Docker Compose toàn hệ thống (Backend, Frontend, PostgreSQL 17), Tối ưu hóa bảo mật và hiệu năng. | Tối ưu hóa UI/UX toàn hệ thống theo chuẩn Enterprise, Thiết kế Responsive Mobile (375px) cho nhân viên. | Kiểm thử tích hợp luồng nghiệp vụ E2E từ Đặt phòng $\to$ Nhận phòng $\to$ Buồng phòng $\to$ Trả phòng $\to$ Thu ngân. |
| **Tuần 6** | **P7B** | Triển khai Staging Server có HTTPS, Quét lỗ hổng mã nguồn SonarQube, Kiểm thử tải đồng thời. | Thực hiện khảo sát đo lường trải nghiệm người dùng chuẩn SUS ($\ge$ 10 người), Viết tài liệu hướng dẫn sử dụng. | Đo lường độ tin cậy và thời gian phản hồi buồng phòng thực tế, Chuẩn bị dữ liệu demo chạy thật. |
| **Tuần 7+** | **Nghiệm thu** | Hoàn thiện tài liệu kiến trúc, Báo cáo kỹ thuật tổng kết, Hỗ trợ thành viên bảo vệ đồ án. | Hoàn thiện chương tài liệu giao diện và đánh giá người dùng, Chuẩn bị slide thuyết trình. | Hoàn thiện tài liệu quy trình vận hành và kiểm thử, Diễn tập kịch bản demo trước hội đồng. |

---

## 2. CHI TIẾT NHIỆM VỤ TỪNG TUẦN CHO TỪNG THÀNH VIÊN

---

### PHẦN I: LỘ TRÌNH CHI TIẾT CỦA BẠN NGÔ VÕ TUẤN AN (MSSV: 24TX810001 — LEADER / BACKEND)

#### 🔹 Tuần 1: Khởi tạo Kiến trúc, CI/CD và Xác thực Phân quyền (Phase 0 – 1A)
- **Đầu việc:**
  - Khởi tạo kiến trúc .NET 10 Clean Architecture (`Domain`, `Application`, `Infrastructure`, `WebApi`).
  - Xây dựng file cấu hình CI/CD [`.github/workflows/ci.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml) gồm 6 stages kiểm thử tự động trên PostgreSQL 17 container.
  - Định nghĩa các thực thể miền trong `backend/src/HotelSaas.Domain/Entities/`.
  - Viết `AuthController` (Đăng ký, Đăng nhập, JWT, Refresh Token).
  - Viết `TenantPropertyContextMiddleware` kiểm soát cách ly chi nhánh và phân quyền RBAC.
  - Viết `LocalDevDataSeeder` nạp sẵn 2 chi nhánh và dữ liệu mẫu phục vụ team.
- **Tệp bàn giao:** `backend/`, `.github/workflows/ci.yml`, `docs/srs/`, `docs/sdd/`.

#### 🔹 Tuần 2: Pricing Engine & Quản lý Chính sách Bảng giá (Phase 1B – 2)
- **Đầu việc:**
  - Xây dựng `PricingCalculator`: Tính tiền phòng theo giờ (giờ đầu + phụ thu làm tròn 60 phút) và theo đêm (12:00 hôm trước đến 12:00 hôm sau).
  - Viết API Chính sách chi nhánh: `GET/PUT /api/properties/{id}/policies` (giờ check-in/out, buffer dọn phòng $\ge$ 30 phút, phụ thu sớm/trễ).
  - Viết API Bảng giá loại phòng: `GET/POST /api/room-types/{id}/rates` (giá theo khoảng ngày, kiểm tra không đè chéo khoảng thời gian - 409 Overlap).
  - Viết Unit Tests kiểm tra tính đúng đắn của logic tính giá với 100% test cases pass.
  - Hỗ trợ review và merge Pull Request của Nguyên và Tân.
- **Tệp bàn giao:** `backend/src/HotelSaas.Application/Pricing/`, `backend/tests/HotelSaas.Application.Tests/`.

#### 🔹 Tuần 3: Đặt phòng Nội bộ & Khóa Phòng Concurrency (Phase 3)
- **Đầu việc:**
  - Xây dựng API Đặt phòng trực tiếp tại quầy: `POST /api/reservations`.
  - Thuật toán khóa chống đặt trùng phòng (Anti-overlap Concurrency): Dùng Database Transaction cách ly kiểm tra khoảng thời gian `[StartAt, EndAt)` trước khi gán phòng.
  - API Vòng đời lưu trú: `POST /api/reservations/{id}/check-in` (chuyển phòng sang `Occupied`) và `POST /api/reservations/{id}/check-out` (chuyển phòng sang `Dirty`).
- **Tệp bàn giao:** `backend/src/HotelSaas.Application/Reservations/`, `backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs`.

#### 🔹 Tuần 4: Thu ngân, Bảng kê Folio & Báo cáo Ca trực (Phase 4)
- **Đầu việc:**
  - Xây dựng API Quản lý thanh toán: `POST /api/payments` (thu tiền mặt, chuyển khoản ngân hàng, cọc trước).
  - API Bảng kê hóa đơn `FolioDto`: Tổng tiền, tiền đã thanh toán, số dư còn nợ.
  - API Báo cáo tổng thực thu ca trực `PaymentSummaryDto`: Thống kê tổng thu theo ngày địa phương Việt Nam (UTC+7).
  - Đảm bảo tính bất biến của lịch sử giao dịch (Audit Log).
- **Tệp bàn giao:** `backend/src/HotelSaas.Application/Payments/`, `backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs`.

#### 🔹 Tuần 5: Cổng Đặt phòng Online (Guest OTA) & Giữ phòng 15 phút (Phase 5)
- **Đầu việc:**
  - Xây dựng Public API không cần đăng nhập: `GET /api/public/properties`, `GET /api/public/properties/{slug}/availability`.
  - Thuật toán Giữ phòng 15 phút (`POST /api/public/bookings/hold`): Tự động giải phóng phòng nếu sau 15 phút khách không nộp cọc.
  - Tạo và mã hóa mã tra cứu bí mật `lookupToken` để khách theo dõi đơn phòng ẩn danh.
- **Tệp bàn giao:** `backend/src/HotelSaas.Application/Public/`, `backend/src/HotelSaas.WebApi/Controllers/PublicController.cs`.

#### 🔹 Tuần 6: Tích hợp Gemini AI & Đóng gói Docker (Phase 6 – 7A)
- **Đầu việc:**
  - Tích hợp Google Gemini API: Nhận yêu cầu tìm phòng bằng tiếng Việt từ khách (ví dụ: *"Tìm phòng đôi cho 2 người ở Phú Nhuận vào cuối tuần"*), chuyển thành tham số tìm kiếm có cấu trúc.
  - Bộ tiền xử lý Backend: Xác thực kết quả từ AI, chỉ trả về phòng và giá thực tế trong hệ thống, tuyệt đối không bịa giá hay số lượng phòng trống.
  - Viết `Dockerfile` và `docker-compose.yml` đóng gói đồng bộ Backend, Frontend, PostgreSQL 17.
- **Tệp bàn giao:** `backend/src/HotelSaas.Infrastructure/Ai/`, `docker-compose.yml`.

#### 🔹 Tuần 7+: Triển khai Staging, Quét SonarQube & Báo cáo Luận văn (Phase 7B)
- **Đầu việc:**
  - Triển khai toàn bộ hệ thống lên máy chủ thử nghiệm (Staging Server) có tên miền và HTTPS phục vụ demo cho hội đồng.
  - Quét kiểm tra chất lượng mã nguồn bằng SonarQube / Roslyn Analyzers, đảm bảo 0 lỗi bảo mật nghiêm trọng.
  - Tổng hợp số liệu kỹ thuật, hoàn thiện tài liệu luận văn và chuẩn bị slide thuyết trình.

---

### PHẦN II: LỘ TRÌNH CHI TIẾT CỦA BẠN NGUYỄN KHÔI NGUYÊN (MSSV: 24TX810011 — FRONTEND — DANH MỤC & SƠ ĐỒ)

#### 🔹 Tuần 1: Khung Giao diện Danh mục Phòng & Hạng phòng (Phase 0 – 1A)
- **Đầu việc:**
  - Khảo sát giao diện và luồng dữ liệu cho module Quản lý Phòng và Loại phòng.
  - Xây dựng component `rooms.page.ts` và `room-types.page.ts`.
  - Định nghĩa models TypeScript: `room.model.ts`, `room-type.model.ts`.
  - Viết services gọi API: `room.service.ts`, `room-type.service.ts`.
  - Xây dựng ô tìm kiếm với debounce 300ms + `switchMap` và phân trang.
- **Tệp bàn giao:** `frontend/src/app/features/rooms/`, `frontend/src/app/features/room-types/`.

#### 🔹 Tuần 2: Hoàn thiện CRUD Phòng & Giao diện Bảng giá (Phase 1B – 2)
- **Đầu việc:**
  - Hoàn thiện Modal Form Thêm và Sửa phòng sử dụng `<p-dialog>` của PrimeNG.
  - Bổ sung Form Validation: Bắt buộc nhập số phòng, kiểm tra số phòng hợp lệ theo tầng.
  - Bắt mã lỗi `409 Conflict` từ backend khi số phòng bị trùng trong chi nhánh và hiển thị thông báo lỗi rõ ràng.
  - Xây dựng giao diện xem và cấu hình Bảng giá theo loại phòng (`rates.page.ts`).
  - Tạo nhánh `feature/nguyen-rooms`, commit code và tạo Pull Request vào `develop`.
- **Tệp bàn giao:** `frontend/src/app/features/rooms/`, `frontend/src/app/features/rates/`.

#### 🔹 Tuần 3: Sơ đồ Phòng Dạng Lưới (Room Matrix Grid) (Phase 3)
- **Đầu việc:**
  - Xây dựng giao diện Sơ đồ phòng trực quan dạng lưới (Grid View) theo tầng lầu.
  - Thể hiện màu sắc phòng trực quan theo thời gian thực:
    - 🟩 Màu xanh lá: Phòng sạch, sẵn sàng đón khách.
    - 🟥 Màu đỏ: Phòng đang có khách lưu trú (`Occupied`).
    - 🟨 Màu vàng: Phòng đang được dọn dẹp (`Cleaning`).
    - 🟧 Màu cam: Phòng bẩn, chờ dọn (`Dirty`).
  - Modal xem nhanh thông tin phòng và tiện ích khi click vào từng ô phòng trên sơ đồ.
- **Tệp bàn giao:** `frontend/src/app/features/rooms/room-matrix.component.ts`.

#### 🔹 Tuần 4: Bảng kê Hóa đơn Folio & In Phiếu Tính Tiền (Phase 4)
- **Đầu việc:**
  - Xây dựng giao diện Chi tiết hóa đơn thanh toán (`Folio`):
    - Tiền phòng gốc theo số đêm/giờ.
    - Phụ phí check-in sớm / check-out muộn tự động tính.
    - Danh sách các khoản tiền khách đã trả (tiền cọc, thanh toán thêm).
    - Số dư còn phải thanh toán.
  - Nút bấm xem trước và in phiếu tính tiền cho khách hàng.
- **Tệp bàn giao:** `frontend/src/app/features/reservations/folio-detail.component.ts`.

#### 🔹 Tuần 5: Giao diện Đặt phòng Trực tuyến Công khai (Guest OTA) (Phase 5)
- **Đầu việc:**
  - Xây dựng trang Đặt phòng trực tuyến dành cho khách (`booking.page.ts`):
    - Thanh tìm kiếm trung tâm: chọn ngày nhận phòng, ngày trả phòng, số lượng khách.
    - Danh sách thẻ loại phòng: tên phòng, mô tả, sức chứa, giá ước tính.
    - Đồ họa minh họa phòng và hình ảnh thực tế.
  - Đảm bảo khi khách chuyển chi nhánh khách sạn, dữ liệu phòng cũ được xóa ngay lập tức (không rò rỉ dữ liệu cũ).
- **Tệp bàn giao:** `frontend/src/app/features/public-booking/booking.page.ts`.

#### 🔹 Tuần 6: Khung Tìm kiếm Trợ lý AI & Tối ưu Tiếp cận (Accessibility) (Phase 6 – 7A)
- **Đầu việc:**
  - Xây dựng hộp thoại / thanh tìm kiếm thông minh tích hợp AI: Cho phép khách gõ câu hỏi ngôn ngữ tự nhiên.
  - Hiển thị danh sách kết quả gợi ý phòng từ AI một cách trực quan, có thẻ giá và nút "Đặt ngay".
  - Tối ưu khả năng tiếp cận (Accessibility): Hỗ trợ đầy đủ phím Tab, Enter, Escape cho người dùng khiếm thị hoặc thao tác bằng bàn phím.
- **Tệp bàn giao:** `frontend/src/app/features/public-booking/ai-search-box.component.ts`.

#### 🔹 Tuần 7+: Thực nghiệm Người dùng (SUS Testing) & Báo cáo Luận văn (Phase 7B)
- **Đầu việc:**
  - Soạn thảo bảng câu hỏi đo lường trải nghiệm người dùng theo thang đo SUS (System Usability Scale) gồm 10 câu hỏi tiêu chuẩn.
  - Phát phiếu khảo sát cho $\ge$ 10 người dùng thực tế thử nghiệm hệ thống và tổng hợp điểm số (mục tiêu $\ge$ 80 điểm).
  - Hoàn thiện chương tài liệu luận văn: Phân tích thiết kế giao diện và Trải nghiệm người dùng.

---

### PHẦN III: LỘ TRÌNH CHI TIẾT CỦA BẠN TRẦN TRỌNG TÂN (MSSV: 24TX810025 — FRONTEND — BUỒNG PHÒNG & VẬN HÀNH)

#### 🔹 Tuần 1: Khung Giao diện Bảng Buồng phòng & Phân trang (Phase 0 – 1A)
- **Đầu việc:**
  - Khảo sát máy trạng thái buồng phòng (State Machine): `Dirty` $\to$ `Cleaning` $\to$ `Clean`.
  - Xây dựng trang giao diện `housekeeping.page.ts`.
  - Khai báo Enum `RoomStatus` và đối tượng màu sắc `ROOM_STATUS_LABELS` trong `enums.ts`.
  - Viết hàm gọi API `updateRoomStatus` gửi kèm `expectedOldStatus` chống lỗi 409.
  - Xây dựng component phân trang `pagination.component.ts` và khung xương `skeleton-table`.
- **Tệp bàn giao:** `frontend/src/app/features/housekeeping/`, `frontend/src/app/shared/components/`.

#### 🔹 Tuần 2: Nút bấm Chuyển trạng thái 1 chạm & Xử lý Xung đột 409 (Phase 1B – 2)
- **Đầu việc:**
  - Hoàn thiện các nút thao tác nhanh trên từng dòng phòng:
    - Phòng `Dirty`: Nút "Bắt đầu dọn" $\to$ chuyển sang `Cleaning`.
    - Phòng `Cleaning`: Nút "Hoàn tất dọn" $\to$ chuyển sang `Clean`.
  - Xử lý lỗi xung đột đồng thời 409 (`ERR_STALE_STATE`): Khi người khác đã đổi trạng thái phòng trước, hiển thị thông báo Toast cảnh báo và tự động nạp lại bảng dữ liệu mới nhất.
  - Khóa nút bấm (disable) khi request đang gửi để chống nhân viên click đúp liên tục.
  - Hoàn thiện bộ lọc theo tầng lầu (Tất cả tầng, Tầng 1, Tầng 2, Tầng 3, Tầng 4).
  - Tạo nhánh `feature/tan-housekeeping`, commit code và tạo Pull Request vào `develop`.
- **Tệp bàn giao:** `frontend/src/app/features/housekeeping/housekeeping.page.ts`.

#### 🔹 Tuần 3: Giao diện Danh sách Đơn đặt phòng & Check-in/out (Phase 3)
- **Đầu việc:**
  - Xây dựng trang Quản lý Đơn đặt phòng (`reservations.page.ts`):
    - Bảng danh sách đơn đặt phòng theo chi nhánh, tìm kiếm theo tên khách hoặc mã đơn.
    - Cột trạng thái đơn: Chờ thanh toán, Đã xác nhận, Đang ở (`CheckedIn`), Đã trả phòng (`CheckedOut`), Đã hủy.
  - Thao tác nhanh của Lễ tân:
    - Nút "Check-in": Nhận phòng cho khách $\to$ chuyển phòng sang `Occupied`.
    - Nút "Check-out": Trả phòng $\to$ hệ thống tự động chuyển phòng sang `Dirty` và gửi thông báo cho buồng phòng.
- **Tệp bàn giao:** `frontend/src/app/features/reservations/reservations.page.ts`.

#### 🔹 Tuần 4: Giao diện Thu ngân & Báo cáo Ca trực (Phase 4)
- **Đầu việc:**
  - Xây dựng trang Thu ngân (`payments.page.ts`):
    - Khối KPI tổng thực thu trong ngày: Tiền mặt, Chuyển khoản, Thẻ tín dụng, Tổng thu.
    - Bảng lịch sử các giao dịch thanh toán trong ca trực.
    - Bộ lọc giao dịch theo ngày, phương thức thanh toán và trạng thái.
  - Form ghi nhận thu tiền trực tiếp tại quầy khi khách trả tiền phòng hoặc thanh toán thêm.
- **Tệp bàn giao:** `frontend/src/app/features/payments/payments.page.ts`.

#### 🔹 Tuần 5: Trang Giữ chỗ 15 phút & Tra cứu Đơn phòng (Phase 5)
- **Đầu việc:**
  - Xây dựng trang Giữ phòng 15 phút (`booking-hold.page.ts`):
    - Hiển thị đồng hồ đếm ngược 15:00 phút thời gian thực.
    - Thông tin phòng đã giữ và hướng dẫn thanh toán cọc chuyển khoản ngân hàng (mã QR / số tài khoản).
    - Cảnh báo: Sau 15 phút không cọc, phòng sẽ tự động được trả lại cho khách khác.
  - Xây dựng trang Tra cứu trạng thái đơn phòng (`booking-status.page.ts`) qua mã bí mật `lookupToken`.
- **Tệp bàn giao:** `frontend/src/app/features/public-booking/booking-hold.page.ts`, `booking-status.page.ts`.

#### 🔹 Tuần 6: Kiểm thử Luồng Đặt phòng E2E & Tối ưu Mobile 375px (Phase 6 – 7A)
- **Đầu việc:**
  - Thực hiện kiểm thử toàn trình từ đầu đến cuối (End-to-End): Khách đặt online giữ chỗ 15 phút $\to$ Lễ tân xác nhận cọc $\to$ Khách đến Check-in $\to$ Khách trả phòng Check-out $\to$ Phòng chuyển thành Bẩn $\to$ Nhân viên dọn phòng hoàn tất sạch sẽ $\to$ Phòng sẵn sàng đón khách mới.
  - Tối ưu giao diện trên màn hình điện thoại di động (Mobile 375px) cho nhân viên buồng phòng và lễ tân thao tác thuận tiện.
- **Tệp bàn giao:** Kịch bản kiểm thử E2E và bản cập nhật CSS Responsive.

#### 🔹 Tuần 7+: Thực nghiệm Nghiệp vụ Buồng phòng, Slide & Demo (Phase 7B)
- **Đầu việc:**
  - Khảo sát thực tế nhân viên khách sạn về tính tiện dụng của bảng buồng phòng và quy trình thu ngân.
  - Hoàn thiện chương tài liệu luận văn: Quy trình Nghiệp vụ Khách sạn và Kiểm thử Phần mềm.
  - Cùng nhóm chuẩn bị Slide thuyết trình và kịch bản demo chạy thật phục vụ buổi bảo vệ đề tài.

---

## 3. QUY TRÌNH PHỐI HỢP GIT ĐỂ TẠO VẾT ĐÓNG GÓP CHO CẢ 3 BẠN

Để đảm bảo lịch sử Git trên GitHub thể hiện rõ ràng sự đóng góp của cả 3 thành viên (phục vụ chấm điểm Rubric TC2.4):

1. **Bước 1 — Nhận việc (Handoff):**
   - Nguyên mở hướng dẫn tại: [`team-handoff/nguyen-khoi-nguyen-24TX810011/HUONG-DAN-GIT-PUSH-VA-PR.md`](file:///C:/Dev/hotel-saas-v2/team-handoff/nguyen-khoi-nguyen-24TX810011/HUONG-DAN-GIT-PUSH-VA-PR.md).
   - Tân mở hướng dẫn tại: [`team-handoff/tran-trong-tan-24TX810025/HUONG-DAN-GIT-PUSH-VA-PR.md`](file:///C:/Dev/hotel-saas-v2/team-handoff/tran-trong-tan-24TX810025/HUONG-DAN-GIT-PUSH-VA-PR.md).
2. **Bước 2 — Tạo nhánh & Commit:**
   - Nguyên checkout nhánh `feature/nguyen-rooms` $\to$ commit mã nguồn bằng tài khoản GitHub của Nguyên.
   - Tân checkout nhánh `feature/tan-housekeeping` $\to$ commit mã nguồn bằng tài khoản GitHub của Tân.
3. **Bước 3 — Tạo Pull Request (PR):**
   - Đẩy nhánh lên GitHub: `git push -u origin <tên-nhánh>`.
   - Lên giao diện GitHub tạo Pull Request trỏ vào nhánh `develop`.
4. **Bước 4 — Review & Merge:**
   - Nhóm trưởng Ngô Võ Tuấn An vào review code trên GitHub, để lại nhận xét và bấm **Merge Pull Request**.
   - $\implies$ **Kết quả:** Lịch sử Git trên GitHub sẽ lưu vết rõ ràng: Commit của tác giả Nguyên/Tân + Pull Request mang tên Nguyên/Tân + Merge Commit của Tuấn An!
