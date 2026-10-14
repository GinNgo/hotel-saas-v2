# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM
---

# BÁO CÁO TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN — TUẦN 01 (CẬP NHẬT THEO GÓP Ý CỦA GVHD)
### ĐỀ TÀI: NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS (HOTEL SAAS PLATFORM V2)

* **Mã đề tài / Topic:** 578
* **Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 1:** Từ ngày 03/10/2026 đến ngày 10/10/2026 (Nghiệm thu tích hợp: 12/10/2026)
* **Kho mã nguồn GitHub chính thức:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh tích hợp chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop) & [`main`](https://github.com/GinNgo/hotel-saas-v2/tree/main)

---

## I. THÀNH VIÊN VÀ PHÂN CÔNG TRÁCH NHIỆM

| STT | Họ và Tên | MSSV | Vai trò chính | Phân hệ / Module phụ trách Tuần 1 |
|:---:|:---|:---:|:---|:---|
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | Trưởng nhóm, KTS Hệ thống | Kiến trúc nền tảng (Clean Architecture .NET 10, Multi-tenant Isolation, Auth JWT + RBAC Bitmask, Seed Data, Global Exception RFC 7807, CI/CD Pipeline) |
| 2 | **Nguyễn Khởi Nguyên** | `24TX810011` | Thành viên, Lập trình viên Fullstack | Trưởng phân hệ Danh mục Phòng & Hạng phòng (Room & RoomType Catalog CQRS, Tiện nghi phòng, Gallery Service, FluentValidation, Bộ lọc phân trang & UI Angular Catalog) |
| 3 | **Trần Trọng Tân** | `24TX810025` | Thành viên, Lập trình viên Fullstack | Trưởng phân hệ Điều phối Buồng phòng (Housekeeping FSM State Machine 5 trạng thái, Concurrency Lock chống xung đột 409, KPI buồng phòng, UI Angular Signals Board & Unit Tests FSM) |

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
  - Cơ chế **Multi-tenant Isolation**: Cách ly dữ liệu khách thuê (`TenantId`) và chi nhánh (`PropertyId`) bằng EF Core Global Query Filter kết hợp Interceptor kiểm tra bảo mật ở mức dữ liệu.
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

## III. CHI TIẾT ĐÓNG GÓP TỪNG THÀNH VIÊN VÀ MINH CHỨNG FILE BLOB GITHUB

### 1. Ngô Võ Tuấn An (Nhóm trưởng — MSSV: 24TX810001)
* **Khối lượng đảm nhiệm:** Khởi tạo cấu trúc Clean Architecture 4 tầng, bảo mật Multi-tenant, Auth JWT/Refresh Token, Bitmask RBAC, Seed Data, Exception Handler, CI/CD và điều phối nhóm.
* **Danh sách File Blob cụ thể trên GitHub:**
  1. [`Tenant.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Tenant.cs): Thực thể khách thuê chuỗi khách sạn.
  2. [`Property.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Property.cs): Thực thể chi nhánh khách sạn trực thuộc Tenant.
  3. [`User.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/User.cs): Thực thể tài khoản người dùng và vai trò toàn cục.
  4. [`RolePermission.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RolePermission.cs): Thực thể lưu trữ quyền hạn dạng Bitmask.
  5. [`RefreshToken.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RefreshToken.cs): Quản lý xoay vòng và thu hồi refresh token.
  6. [`ApplicationDbContext.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs): Cấu hình DbContext và Global Query Filters.
  7. [`TenantPropertySaveChangesInterceptor.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/TenantPropertySaveChangesInterceptor.cs): Interceptor kiểm soát bảo mật ghi dữ liệu xuyên tenant.
  8. [`LocalDevDataSeeder.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs): Seeder nạp 2 chi nhánh mẫu và tài khoản ban đầu.
  9. [`AuthController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs): API Đăng nhập, cấp token và đổi ngữ cảnh chi nhánh.
  10. [`ExceptionHandlingMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs): Bắt lỗi toàn cục chuẩn RFC 7807 ProblemDetails.
  11. [`.github/workflows/ci.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml): Pipeline 6 giai đoạn tự động kiểm thử trên GitHub.
  12. [`auth.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/auth.service.ts): Quản lý đăng nhập và xác thực token phía client.
  13. [`login.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/auth/login/login.page.ts): Giao diện đăng nhập đa chi nhánh kèm 4 nút Quick Fill.
* **Commit Git đối chiếu khớp chính xác (Git Log Verbatim):**
  - [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99): `feat: Phase 0 complete - docs, scaffold, entities, rules` (03/10/2026)
  - [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339): `feat(auth): implement Auth + RBAC - Phase 1A complete` (04/10/2026)
  - [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd): `feat: Phase 1 complete - architecture foundation, auth & RBAC, team roadmaps, week 1 reports, and feature scaffolds` (12/10/2026)

---

### 2. Nguyễn Khởi Nguyên (Thành viên — MSSV: 24TX810011)
* **Khối lượng đảm nhiệm:** Phân hệ Danh mục Phòng & Hạng phòng (Room & RoomType CRUD CQRS), bộ lọc nâng cao, giao diện Angular Catalog.
* **Danh sách File Blob cụ thể trên GitHub:**
  1. [`RoomType.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RoomType.cs): Thực thể hạng phòng và đơn giá cơ sở.
  2. [`Room.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Room.cs): Thực thể phòng vật lý theo tầng và số phòng.
  3. [`CreateRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommand.cs): Thêm mới hạng phòng qua MediatR.
  4. [`DeleteRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/DeleteRoomType/DeleteRoomTypeCommand.cs): Xóa hạng phòng có kiểm tra ràng buộc phòng trực thuộc.
  5. [`GetRoomTypesQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Queries/GetRoomTypes/GetRoomTypesQuery.cs): Truy vấn danh sách hạng phòng có lọc theo chi nhánh.
  6. [`CreateRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommand.cs): Thêm mới phòng vật lý, chống trùng số phòng.
  7. [`DeleteRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/DeleteRoom/DeleteRoomCommand.cs): Chặn xóa phòng nếu có khách đang ở.
  8. [`GetRoomsQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Queries/GetRooms/GetRoomsQuery.cs): Lọc danh sách phòng theo tầng, trạng thái và từ khóa.
  9. [`RoomTypesController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs): RESTful API Hạng phòng có phân quyền `ROOM_TYPES`.
  10. [`RoomsController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs): RESTful API Phòng vật lý có phân quyền `ROOMS`.
  11. [`room-types.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/room-types/room-types.page.ts): Giao diện Angular quản trị hạng phòng.
  12. [`rooms.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/rooms/rooms.page.ts): Giao diện Angular quản trị phòng vật lý theo tầng.
  13. [`room-types-filter.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/room-types-filter.util.ts): Bộ tiện ích lọc hạng phòng theo giá, sức chứa tối đa và từ khóa tìm kiếm.
  14. [`rooms-validation.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/rooms-validation.util.ts): Bộ tiện ích kiểm tra tính hợp lệ của số phòng theo tầng và kiểm tra chống trùng lặp số phòng.
* **Commit Git đối chiếu khớp chính xác (Git Log Verbatim):**
  - [`a6aca5d`](https://github.com/GinNgo/hotel-saas-v2/commit/a6aca5d): `[feat] update dependency package json` (13/10/2026 trên nhánh cá nhân `feature/nguyen-rooms` của tác giả `nguyencd <nguyendev13@gmail.com>`)
  - [`cf80854`](https://github.com/GinNgo/hotel-saas-v2/commit/cf80854): `[feat] add entity Room` (13/10/2026 trên nhánh cá nhân `feature/nguyen-rooms`)
  - [`7ae0136`](https://github.com/GinNgo/hotel-saas-v2/commit/7ae0136): `[feat] add core room utils` (13/10/2026 trên nhánh cá nhân `feature/nguyen-rooms`)
  - [`519b46a`](https://github.com/GinNgo/hotel-saas-v2/commit/519b46a): `[feat] add doc weak 1` (13/10/2026 trên nhánh cá nhân `feature/nguyen-rooms`)
  - [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd): `feat: Phase 1 complete - architecture foundation, auth & RBAC, team roadmaps, week 1 reports, and feature scaffolds` (12/10/2026)
  - [`9bb9fdd`](https://github.com/GinNgo/hotel-saas-v2/commit/9bb9fdd): `merge(rooms): integrate origin/feature/nguyen-rooms into develop with 0 build errors` (14/10/2026 trên nhánh `develop` & `main`)

---

### 3. Trần Trọng Tân (Thành viên — MSSV: 24TX810025)
* **Khối lượng đảm nhiệm:** Phân hệ Điều phối Buồng phòng (Housekeeping State Machine FSM, Concurrency Lock, Angular Board, KPI).
* **Danh sách File Blob cụ thể trên GitHub:**
  1. [`HousekeepingTask.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/HousekeepingTask.cs): Thực thể nhiệm vụ buồng phòng.
  2. [`RoomStatus.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/RoomStatus.cs): Enum 5 trạng thái phòng khách sạn.
  3. [`RoomStatusTransitionValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs): Bộ thẩm định máy trạng thái FSM buồng phòng.
  4. [`UpdateRoomStatusCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommand.cs): Command cập nhật trạng thái kèm `expectedOldStatus` chống lỗi 409.
  5. [`UpdateRoomStatusRequest.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Models/UpdateRoomStatusRequest.cs): Request body API PATCH trạng thái buồng phòng.
  6. [`housekeeping-concurrency.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-concurrency.util.ts): Xử lý xung đột đồng thời phía client khi người khác đổi trạng thái trước.
  7. [`housekeeping-kpi.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-kpi.util.ts): Tính toán KPI tỷ lệ phòng sạch và phòng cần dọn.
  8. [`housekeeping.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/housekeeping/housekeeping.page.ts): Giao diện 680+ dòng code Angular Signals, đổi trạng thái 1 chạm Optimistic UI.
  9. [`RoomStatusTransitionValidatorTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Rooms/RoomStatusTransitionValidatorTests.cs): Unit tests kiểm tra tính hợp lệ của luồng chuyển đổi trạng thái phòng.
* **Commit Git đối chiếu khớp chính xác (Git Log Verbatim):**
  - [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba): `feat(housekeeping): Trần Trọng Tân - implement housekeeping board and state machine (Fullstack BE FSM + FE Angular)` (12/10/2026 trên nhánh `feature/tan-housekeeping`)
  - [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43): `merge(housekeeping): integrate feature/tan-housekeeping into develop with 0 build errors` (14/10/2026 trên nhánh `develop` & `main`)

---

## IV. BẢNG TỔNG KẾT MINH CHỨNG & CHỈ SỐ KỸ THUẬT TUẦN 1

| Chỉ số kỹ thuật | Kết quả đạt được | Link Minh Chứng Cụ Thể |
|:---|:---:|:---|
| **Số tài liệu SRS/SDD/Test Plan** | 25 tài liệu | Thư mục [`docs/srs/`](https://github.com/GinNgo/hotel-saas-v2/tree/develop/docs/srs), [`docs/sdd/`](https://github.com/GinNgo/hotel-saas-v2/tree/develop/docs/sdd) |
| **Số Domain Entities** | 20 thực thể | Thư mục [`Domain/Entities/`](https://github.com/GinNgo/hotel-saas-v2/tree/develop/backend/src/HotelSaas.Domain/Entities) |
| **Số Enums nghiệp vụ** | 17 enums | Thư mục [`Domain/Enums/`](https://github.com/GinNgo/hotel-saas-v2/tree/develop/backend/src/HotelSaas.Domain/Enums) |
| **Số Unit & Integration Tests** | 389 test cases | Thư mục [`backend/tests/`](https://github.com/GinNgo/hotel-saas-v2/tree/develop/backend/tests) |
| **Kết quả Build Backend** | 0 Warnings, 0 Errors | `.NET 10.0` SDK (`dotnet build`) |
| **Kết quả Build Frontend** | 0 Warnings, 0 Errors | `Angular 22.2.0`, Standalone mode (`npm run build`) |
| **Nhật ký sử dụng AI** | Đầy đủ 4 Entries | File [`docs/ai-usage-log/ai-usage-log.md`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/ai-usage-log/ai-usage-log.md) |

---

## V. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE & AUDIT LOG)

> Nhóm thực hiện đề tài cam kết minh bạch 100% trong việc sử dụng công cụ AI trợ lực phát triển phần mềm theo tiêu chuẩn học thuật của Khoa CNTT - HCMUTE. Dưới đây là bảng tổng hợp các lần sử dụng AI trong Tuần 1:

| Lần | Thành Viên Thực Hiện | Công Cụ AI | Phạm Vi Công Việc | Prompt Chính Đã Sử Dụng | Kết Quả AI Đã Sinh Ra | Sinh Viên Kiểm Tra, Phản Biện & Sửa Chữa | Lỗi Ảo Giác (Hallucination) Đã Khắc Phục | Commit Đối Chiếu |
|:---:|:---|:---|:---|:---|:---|:---|:---|:---:|
| **#001** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity / Claude 3.5 | Khởi tạo Solution Clean Architecture .NET 10, Docker Postgres/Redis, dàn bài SRS/SDD | *"Tôi đang dựng backend .NET 10 theo Clean Architecture cho đồ án SaaS quản lý khách sạn đa chi nhánh. Nhờ bạn gợi ý cấu trúc solution 4 tầng Domain, Application, Infrastructure, WebApi. Tích hợp EF Core với PostgreSQL 17, MediatR, FluentValidation và viết file docker-compose chạy Postgres với Redis. Sau đó gợi ý mục lục SRS, SDD chuẩn học thuật."* | AI sinh khung thư mục `.sln`, `.csproj`, `docker-compose.yml` và dàn bài tài liệu. Cú pháp MediatR bị dùng theo phiên bản cũ. | Sinh viên kiểm tra, sửa cú pháp đăng ký MediatR sang chuẩn .NET 10 mới `AddMediatR(cfg => cfg.RegisterServicesFromAssembly(...))`. Chỉnh connection string Docker trên Windows. Build đạt 0 lỗi. | AI sinh cú pháp MediatR cũ lỗi thời $\to$ Sinh viên tra cứu tài liệu mới và sửa lại. | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) |
| **#002** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity | Module Auth JWT, Refresh Token xoay vòng, SaveChangesInterceptor Multi-tenant | *"Hãy viết giúp tôi module Authentication bằng JWT có cơ chế Refresh Token xoay vòng (Token Rotation) để chống Replay Attack trong .NET 10. Đồng thời tạo giúp tôi EF Core Interceptor tự động lấy TenantId và PropertyId từ request header gắn vào entity khi thêm mới, ngăn không cho người dùng sửa hoặc đọc chéo dữ liệu của khách sạn khác."* | AI sinh controller login, cấp token và Interceptor. Code cơ bản chạy được nhưng thiếu kiểm tra tenant bị khóa và thiếu unit tests. | Sinh viên phát hiện AI bỏ sót điều kiện kiểm tra Tenant đang hoạt động (`IsActive == true`). Sinh viên tự viết logic kiểm tra kích hoạt tài khoản và viết 45 unit tests kiểm thử hành vi xoay vòng token. | AI quên gán `TenantId` trong một số trường hợp tạo entity mới $\to$ Sinh viên bổ sung logic inject `ICurrentTenantService`. | [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) |
| **#003** | Nguyễn Khởi Nguyên (`24TX810011`) | GitHub Copilot & ChatGPT Plus | CRUD RoomType và Room theo CQRS, xây dựng UI Angular Catalog | *"Mình đang làm tính năng quản lý danh mục Loại phòng (RoomType) và Phòng (Room) cho khách sạn bằng C# .NET 10. Bạn viết giúp mình các Command và Query MediatR để thêm, sửa, xóa, lấy danh sách có phân trang và lọc theo tầng. Lưu ý số phòng không được trùng nhau trong cùng một khách sạn và không cho xóa loại phòng nếu đang có phòng trực thuộc."* | AI sinh đầy đủ Command, Query, Handler, Validator và service Angular. Nhưng phần xóa AI viết xóa cứng (hard delete) trực tiếp vào DB, không kiểm tra đơn đặt phòng. | Sinh viên kiểm tra nghiệp vụ và sửa lại: thay vì xóa cứng, phải kiểm tra ràng buộc với lịch sử đặt phòng (Reservation). Ở Frontend, sinh viên tự tay viết lại toàn bộ sang Angular Standalone Component dùng Signals. | AI sinh logic xóa cứng (Hard Delete) làm mất lịch sử đặt phòng $\to$ Sinh viên sửa thành kiểm tra ràng buộc khóa ngoại trước khi xóa. | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) |
| **#004** | Trần Trọng Tân (`24TX810025`) | Google Antigravity & Claude 3.5 | Máy trạng thái FSM buồng phòng, Concurrency Lock `expectedOldStatus`, Housekeeping Board | *"Mình cần làm màn hình quản lý buồng phòng (Housekeeping) cho khách sạn. Khách sạn có 5 trạng thái phòng: Sạch, Bẩn, Đang dọn, Có khách và Hỏng/Bảo trì. Bạn viết giúp mình API đổi trạng thái phòng có kiểm tra luồng chuyển đổi hợp lệ và tránh trường hợp 2 nhân viên cùng bấm đổi trạng thái một lúc. Phía giao diện Angular hiển thị các thẻ phòng theo từng tầng và đổi màu theo trạng thái."* | AI đề xuất `RoomStatusTransitionValidator` và gợi ý gửi kèm `expectedOldStatus` lên API PATCH. Phía Angular AI sinh giao diện danh sách có nút bấm đổi trạng thái nhưng dùng thư viện bên ngoài. | Khi dò lại ma trận trạng thái, sinh viên thấy AI bỏ sót trường hợp: phòng bảo dưỡng xong (`OutOfService`) chuyển về lại phòng sạch (`Clean`), nên sinh viên tự thêm rule này vào validator. Ở Angular, sinh viên viết lại bằng Angular Signals thuần và thêm cơ chế khóa nút bấm khi đang gọi API. | AI bỏ sót bước chuyển trạng thái từ Bảo trì (`OutOfService`) về Phòng sạch (`Clean`) $\to$ Sinh viên bổ sung đầy đủ luật chuyển đổi. | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) / [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43) |

---

## VI. KẾ HOẠCH BÀN GIAO & MỤC TIÊU TUẦN 2

1. **Tuấn An (Leader):** Triển khai Module Đặt phòng cốt lõi (Reservation Engine), máy trạng thái đặt phòng (Pending -> Confirmed -> CheckedIn -> CheckedOut -> Cancelled), tính toán giá phòng và tiền cọc.
2. **Khởi Nguyên:** Triển khai Module Chính sách giá & Khuyến mãi (Room Pricing, Seasonal Rates, Promotion Codes), hoàn thiện form đặt phòng nhanh cho lễ tân.
3. **Trọng Tân:** Mở rộng Module Buồng phòng: Phân công nhân viên dọn phòng theo ca (Housekeeping Staff Assignment), đính kèm ghi chú vật tư tiêu hao và biên bản kiểm tra phòng.
4. **Mục tiêu nhóm:** Tiến hành kiểm thử E2E liên thông giữa Danh mục phòng $\to$ Đặt phòng $\to$ Nhận phòng $\to$ Dọn phòng $\to$ Trả phòng.

---

*TP. Hồ Chí Minh, ngày 14 tháng 10 năm 2026*

**XÁC NHẬN CỦA NHÓM TRƯỞNG**  
*(Ký và ghi rõ họ tên)*  


**Ngô Võ Tuấn An**
