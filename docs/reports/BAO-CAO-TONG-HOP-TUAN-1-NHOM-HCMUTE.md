# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM
---

# BÁO CÁO TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN — TUẦN 01 (PHASE 0 & PHASE 1)

* **Tên đề tài:** Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh Theo Mô Hình SaaS & Phân Quyền Đa Cấp (Hotel SaaS Platform v2)
* **Mã đề tài / Topic:** 578
* **Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 1:** Từ ngày 03/10/2026 đến ngày 10/10/2026
* **Họ và tên Nhóm trưởng:** Ngô Võ Tuấn An — MSSV: `24TX810001` — Email: `ngovotuananh@gmail.com`
* **Kho mã nguồn GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)

---

## I. THÀNH VIÊN VÀ PHÂN CÔNG TRÁCH NHIỆM

| STT | Họ và Tên | MSSV | Vai trò chính | Phân hệ / Module phụ trách Tuần 1 | Mức độ hoàn thành | Tự đánh giá |
|:---:|:---|:---:|:---|:---|:---:|:---:|
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | Trưởng nhóm, KTS Hệ thống | Kiến trúc nền tảng (Clean Architecture, Multi-tenant, Auth + RBAC, Seed Data, Global Exception, CI/CD Pipeline) | 100% | 10 / 10 |
| 2 | **Nguyễn Khởi Nguyên** | `24TX810011` | Thành viên, Lập trình viên | Phân hệ Danh mục Phòng & Hạng phòng (Room & RoomType CRUD, Filters, DTOs, Angular Catalog Pages) | 100% | 9.5 / 10 |
| 3 | **Trần Trọng Tân** | `24TX810025` | Thành viên, Lập trình viên | Phân hệ Điều phối Buồng phòng (Housekeeping Task FSM, State Machine, Concurrency Lock, Angular Board, KPI Calculation) | 100% | 9.5 / 10 |

---

## II. KẾT QUẢ TRIỂN KHAI TOÀN DIỆN TRONG TUẦN 1

### 1. Về mặt Tài liệu Phân tích & Thiết kế (SRS, SDD, Test Plan)
Nhóm đã hoàn thành hệ thống tài liệu đồ án chuyên nghiệp, đồng bộ chuẩn mực doanh nghiệp đặt tại thư mục `docs/`:
- **Đặc tả yêu cầu phần mềm (SRS - 8 tài liệu):** Phân tích thị trường OTA, hồ sơ người dùng (Actor personas), 28 User Stories chi tiết, quy trình nghiệp vụ khách sạn, từ điển dữ liệu (Data dictionary), yêu cầu phi chức năng (NFR) và cam kết KPI hệ thống.
- **Tài liệu thiết kế kiến trúc (SDD - 10 tài liệu):** Mô hình dữ liệu ERD 20 thực thể, sơ đồ kiến trúc Clean Architecture, sơ đồ C4 (Context, Container, Component), sequence diagrams quy trình xác thực/đặt phòng/chuyển trạng thái, ma trận phân quyền RBAC đa cấp, đặc tả RESTful API, tài liệu UI/UX Design System, mô hình triển khai Docker/Cloud và an toàn thông tin.
- **Kế hoạch kiểm thử (Test Plan):** Chiến lược kiểm thử tự động đa tầng (Unit Test, Integration Test với Real Database, Security Scan).

### 2. Về mặt Mã nguồn & Nền tảng Kỹ thuật (Backend .NET 10 + Frontend Angular 22)
- **Backend .NET 10 (Clean Architecture + CQRS + MediatR):**
  - Tách bạch 4 tầng kiến trúc: `Domain`, `Application`, `Infrastructure`, `WebApi`.
  - Cơ chế **Multi-tenant Isolation**: Cách ly dữ liệu khách thuê (Tenant) và chi nhánh (Property) bằng EF Core Global Query Filter kết hợp Interceptor kiểm tra bảo mật ở mức dữ liệu.
  - Cơ chế **Authentication & Authorization đa tầng**: JWT Bearer token, Refresh Token xoay vòng (Rotation) chống replay attack, hàm băm mật khẩu chuẩn BCrypt, quản lý quyền hạn chi tiết bằng Bitmask Permissions (`Read`, `Create`, `Update`, `Delete`, `Admin`).
  - Bộ nạp dữ liệu mẫu **`LocalDevDataSeeder`**: Khởi tạo đầy đủ chuỗi khách sạn mẫu, tài khoản quản trị, nhân viên, buồng phòng sẵn sàng cho việc kiểm thử mà không cần thao tác thủ công.
- **Frontend Angular 22 (Standalone Components + Signals + Tailwind CSS + PrimeNG):**
  - Khởi tạo kiến trúc Frontend hiện đại không dùng NgModule, áp dụng triệt để Reactive State với Angular Signals và RxJS.
  - Triển khai UI Dashboard, trang Đăng nhập/Đăng ký, Catalog quản lý phòng, bảng điều phối buồng phòng trực quan.

### 3. Về mặt CI/CD & Đảm bảo Chất lượng
- Thiết lập GitHub Actions Pipeline tự động kiểm thử và kiểm tra chất lượng code:
  - Kiểm tra biên dịch backend .NET 10 Release mode.
  - Kiểm tra lint, build và đóng gói frontend Angular production.
  - Tích hợp kiểm thử bảo mật quét lộ lọt thông tin nhạy cảm (Secret Scanning qua Gitleaks).
- Toàn bộ solution biên dịch đạt chuẩn: **0 Warning(s), 0 Error(s)**.

---

## III. CHI TIẾT ĐÓNG GÓP TỪNG THÀNH VIÊN

### 1. Ngô Võ Tuấn An (Nhóm trưởng — MSSV: 24TX810001)
* **Khối lượng công việc đảm nhiệm:** Thiết kế kiến trúc tổng thể, triển khai Core Platform, Auth/RBAC, Global Middleware, Seed Engine và điều phối nhóm.
* **Mã nguồn hoàn thành:**
  - `HotelSaas.Domain/Entities/` (Tenant, Property, User, AccessRole, RolePermission, TenantStaff, RefreshToken).
  - `HotelSaas.Application/Common/` (Interfaces, Exceptions, Behaviors, Security Guards).
  - `HotelSaas.Infrastructure/Persistence/` (ApplicationDbContext, Interceptors, LocalDevDataSeeder).
  - `HotelSaas.WebApi/Middleware/` (ExceptionHandlingMiddleware chuẩn RFC 7807, TenantPropertyContextMiddleware).
  - `.github/workflows/ci.yml` (CI Pipeline đa giai đoạn).
* **Kết quả:** Xây dựng thành công nền móng vững chắc giúp 2 thành viên còn lại phát triển tính năng độc lập, không xảy ra xung đột.

### 2. Nguyễn Khởi Nguyên (Thành viên — MSSV: 24TX810011)
* **Khối lượng công việc đảm nhiệm:** Phân hệ Danh mục Phòng & Hạng phòng (Admin Room & RoomType Catalog).
* **Mã nguồn hoàn thành:**
  - Backend Commands & Queries: `CreateRoomType`, `UpdateRoomType`, `DeleteRoomType`, `GetRoomTypes`, `CreateRoom`, `UpdateRoom`, `DeleteRoom`, `GetRooms`.
  - Bộ tiện ích kiểm tra nghiệp vụ: `room-types-filter.util.ts`, `rooms-validation.util.ts`.
  - Frontend Pages: `room-types.page.ts`, `rooms.page.ts` (giao diện quản trị danh mục, phân trang, tìm kiếm theo tầng và trạng thái).
* **Kết quả:** Hoàn thành trọn vẹn nghiệp vụ quản lý buồng phòng, tích hợp chuẩn xác với cơ chế Multi-tenant của nhóm trưởng.

### 3. Trần Trọng Tân (Thành viên — MSSV: 24TX810025)
* **Khối lượng công việc đảm nhiệm:** Phân hệ Điều phối Buồng phòng (Housekeeping Board & Task Management).
* **Mã nguồn hoàn thành:**
  - Máy trạng thái buồng phòng FSM: `RoomStatusTransitionValidator.cs`, `UpdateRoomStatusCommand.cs`.
  - Endpoint cập nhật trạng thái buồng phòng với Concurrency Check (`expectedOldStatus`) chống tình trạng ghi đè dữ liệu cũ (Stale Update).
  - Frontend Housekeeping Board: `housekeeping.page.ts` (giao diện thẻ phòng trực quan theo màu sắc trạng thái, đổi trạng thái tức thì Optimistic UI).
  - Tiện ích xử lý dữ liệu: `housekeeping-concurrency.util.ts`, `housekeeping-kpi.util.ts` (tính toán tỷ lệ phòng sạch, phòng bẩn, phòng bảo trì phục vụ báo cáo vận hành).
* **Kết quả:** Module chạy mượt mà, độc lập, hỗ trợ nhân viên dọn phòng thao tác nhanh chóng và chính xác.

---

## IV. BẢNG TỔNG KẾT MINH CHỨNG & CHỈ SỐ KỸ THUẬT TUẦN 1

| Chỉ số kỹ thuật | Kết quả đạt được | Ghi chú minh chứng |
|:---|:---:|:---|
| **Số tài liệu SRS/SDD/Test Plan** | 25 tài liệu | Thư mục `docs/srs/`, `docs/sdd/`, `docs/test-plan/` |
| **Số Domain Entities được ánh xạ** | 20 thực thể | Thư mục `backend/src/HotelSaas.Domain/Entities/` |
| **Số Enums nghiệp vụ** | 17 enums | Thư mục `backend/src/HotelSaas.Domain/Enums/` |
| **Số Unit & Integration Tests** | 389 test cases | Thư mục `backend/tests/` |
| **Kết quả Build Backend** | 0 Warnings, 0 Errors | `.NET 10.0` SDK |
| **Kết quả Build Frontend** | 0 Warnings, 0 Errors | `Angular 22.2.0`, Standalone mode |
| **Nhật ký sử dụng AI (AI Usage Log)** | Có đầy đủ | Thư mục `docs/ai-usage-log/` |

---

## V. KẾ HOẠCH BÀN GIAO & MỤC TIÊU TUẦN 2

1. **Tuấn An (Leader):** Triển khai Module Đặt phòng cốt lõi (Reservation Engine), máy trạng thái đặt phòng (Pending -> Confirmed -> CheckedIn -> CheckedOut -> Cancelled), tính toán giá phòng và tiền cọc.
2. **Khởi Nguyên:** Triển khai Module Chính sách giá & Khuyến mãi (Room Pricing, Seasonal Rates, Promotion Codes), hoàn thiện form đặt phòng nhanh cho lễ tân.
3. **Trọng Tân:** Mở rộng Module Buồng phòng: Phân công nhân viên dọn phòng theo ca (Housekeeping Staff Assignment), đính kèm ghi chú vật tư tiêu hao và biên bản kiểm tra phòng.
4. **Mục tiêu nhóm:** Tiến hành kiểm thử E2E liên thông giữa Danh mục phòng $\to$ Đặt phòng $\to$ Nhận phòng $\to$ Dọn phòng $\to$ Trả phòng.

---

*TP. Hồ Chí Minh, ngày 13 tháng 10 năm 2026*

**XÁC NHẬN CỦA NHÓM TRƯỞNG**  
*(Ký và ghi rõ họ tên)*  

  
**Ngô Võ Tuấn An**
