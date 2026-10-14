# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM
***

# BÁO CÁO TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN — TUẦN 01
### ĐỀ TÀI: NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS (HOTEL SAAS PLATFORM V2)

* **Mã đề tài (Topic):** 578
* **Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 1:** 03/10/2026 – 10/10/2026 (Nghiệm thu tích hợp: 14/10/2026)
* **Kho mã nguồn GitHub chính thức:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh kiểm tra nghiệm thu:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop) & [`main`](https://github.com/GinNgo/hotel-saas-v2/tree/main)

---

## DANH SÁCH THÀNH VIÊN NHÓM THỰC HIỆN

| STT | Họ và Tên | Mã số sinh viên | Email sinh viên | Vai trò & Phân hệ đảm nhiệm Tuần 1 |
|:---:|:---|:---:|:---|:---|
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | `24tx810001@student.hcmute.edu.vn` | **Nhóm trưởng**: Thiết kế kiến trúc nền tảng Clean Architecture .NET 10, Multi-tenant Isolation, Auth JWT + Refresh Token Rotation, RBAC Bitmask, LocalDevDataSeeder, Exception Handler RFC 7807, CI/CD Pipeline 6 stages. |
| 2 | **Nguyễn Khởi Nguyên** | `24TX810011` | `24tx810011@student.hcmute.edu.vn` | **Thành viên**: Phân hệ Danh mục Hạng phòng & Phòng (Room & RoomType Catalog CQRS MediatR, FluentValidation, Room Rates & History Audit, WebApi Controllers, Frontend Utilities & UI Angular Catalog). |
| 3 | **Trần Trọng Tân** | `24TX810025` | `24tx810025@student.hcmute.edu.vn` | **Thành viên**: Phân hệ Điều phối Buồng phòng (Housekeeping FSM 5 trạng thái, Concurrency Control Lock 409 Conflict với `expectedOldStatus`, WebApi buồng phòng, Thuật toán KPI thời gian thực, UI Angular Signals Housekeeping Board & xUnit Tests). |

---

## PHẦN I. TỔNG QUAN KẾT QUẢ THỰC HIỆN ĐƯỢC TRONG TUẦN 01

Trong giai đoạn Tuần 01, nhóm đã hoàn thành toàn bộ khối lượng công việc được đề ra, bao gồm xây dựng kiến trúc cốt lõi và phát triển 2 phân hệ nghiệp vụ quan trọng với kết quả cụ thể như sau:

### 1. Phân hệ Kiến trúc nền tảng & Hạ tầng (Ngô Võ Tuấn An đảm nhiệm)
* **Kiến trúc Clean Architecture .NET 10**: Thiết lập cấu trúc 4 tầng chuẩn mực (`Domain`, `Application`, `Infrastructure`, `WebApi`), tách biệt hoàn toàn business logic khỏi các phụ thuộc hạ tầng, áp dụng mẫu thiết kế CQRS với MediatR.
* **Cơ chế Multi-tenant Data Isolation**: Xây dựng giải pháp cách ly dữ liệu giữa các chuỗi khách sạn và chi nhánh thông qua EF Core Global Query Filter và `TenantPropertySaveChangesInterceptor`, tự động gán và kiểm tra `TenantId`/`PropertyId` trên tất cả các thực thể kế thừa `BaseEntity`.
* **Xác thực & Bảo mật (Auth & RBAC)**: Triển khai cấp phát JWT Access Token kết hợp cơ chế Refresh Token Rotation (xoay vòng token) chống Replay Attack, băm mật khẩu một chiều bằng thuật toán BCrypt. Thiết kế hệ thống phân quyền chi tiết dạng Bitmask (`Read`, `Create`, `Update`, `Delete`, `Admin`) kiểm tra quyền truy cập ở mức microsecond.
* **Xử lý lỗi tập trung & Dữ liệu mẫu**: Xây dựng Middleware bắt lỗi toàn cục chuẩn RFC 7807 ProblemDetails. Xây dựng bộ tạo dữ liệu mẫu Idempotent `LocalDevDataSeeder` nạp sẵn 1 Tenant, 2 Khách sạn, 4 Tài khoản người dùng, 4 Loại phòng và 20 Phòng phục vụ kiểm thử cục bộ.
* **Tự động hóa CI/CD**: Thiết lập GitHub Actions workflow 6 giai đoạn (kiểm tra format code, bảo mật secret scanning, container PostgreSQL 17, build và test .NET 10, build Angular 22).

### 2. Phân hệ Quản lý Danh mục Phòng & Hạng phòng (Nguyễn Khởi Nguyên đảm nhiệm)
* **Domain & Cơ sở dữ liệu**: Thiết kế thực thể `RoomType` và `Room`, cấu hình EF Core Fluent API với composite unique index `(TenantId, PropertyId, RoomNumber)` đảm bảo tính toàn vẹn dữ liệu trong mô hình SaaS.
* **Nghiệp vụ CQRS Hạng phòng (RoomType)**: Xây dựng các Command thêm mới (`CreateRoomTypeCommand`), cập nhật (`UpdateRoomTypeCommand`), xóa an toàn có kiểm tra phòng trực thuộc (`DeleteRoomTypeCommand`), truy vấn danh sách có phân trang (`GetRoomTypesQuery`).
* **Quản lý Bảng giá & Lịch sử thay đổi**: Xây dựng chức năng thiết lập bảng giá theo ngày/mùa (`CreateRoomTypeRateCommand`), kiểm tra chống chồng lấn thời gian áp dụng giá, tự động ghi vết thay đổi vào bảng Audit log (`GetRoomTypeRateHistoryQuery`).
* **Nghiệp vụ CQRS Phòng vật lý (Room)**: Xây dựng các Command tạo phòng (`CreateRoomCommand`), cập nhật (`UpdateRoomCommand`), xóa an toàn kiểm tra ràng buộc phòng đang có khách hoặc có đơn đặt phòng (`DeleteRoomCommand`), bộ lọc phòng linh hoạt theo tầng và trạng thái (`GetRoomsQuery`).
* **Giao diện & Tiện ích Client**: Xây dựng các tiện ích TypeScript kiểm tra định dạng số phòng (`rooms-validation.util.ts`), lọc định dạng tiền tệ (`room-types-filter.util.ts`), phát triển trang quản lý danh mục phòng trên nền Angular 22 Standalone Components.

### 3. Phân hệ Quản lý Điều phối Buồng phòng (Trần Trọng Tân đảm nhiệm)
* **Mô hình dữ liệu & Hệ thống 5 trạng thái**: Thiết kế thực thể `HousekeepingTask` và enum `RoomStatus` gồm 5 trạng thái chuẩn khách sạn quốc tế: `Clean` (Sạch sẵn sàng), `Dirty` (Bẩn), `Inspecting` (Đang kiểm tra chất lượng), `Occupied` (Có khách lưu trú), `OutOfService` (Bảo trì/Hỏng).
* **Máy trạng thái hữu hạn (Finite State Machine - FSM)**: Hiện thực lớp `RoomStatusTransitionValidator` kiểm soát chặt chẽ các bước chuyển trạng thái hợp lệ, ngăn chặn việc cập nhật trạng thái tùy tiện hoặc nhảy cóc không qua kiểm tra.
* **Khóa lạc quan chống xung đột đồng thời (Concurrency Control Lock)**: Xây dựng cơ chế gửi kèm `expectedOldStatus` trong lệnh `UpdateRoomStatusCommand`. Khi phát hiện xung đột dữ liệu giữa hai nhân viên cùng thao tác, hệ thống lập tức trả về lỗi HTTP 409 Conflict ProblemDetails. Phía Client xây dựng tiện ích `housekeeping-concurrency.util.ts` hiển thị cảnh báo và tự động nạp lại dữ liệu mới nhất.
* **Thuật toán KPI Buồng phòng thời gian thực**: Xây dựng tiện ích `housekeeping-kpi.util.ts` tính toán tỷ lệ phòng sạch sẵn sàng đón khách (Clean Ratio), tỷ lệ phòng bẩn khẩn cấp, có cơ chế bảo vệ chia cho 0 an toàn.
* **Giao diện Housekeeping Board (Angular Signals)**: Xây dựng trang `housekeeping.page.ts` (686 dòng mã) trực quan hóa các phòng theo tầng, hiển thị thẻ màu trạng thái động, thao tác đổi trạng thái nhanh, hỗ trợ cập nhật giao diện lạc quan (Optimistic UI) và khóa nút bấm khi đang gửi request.
* **Kiểm thử tự động xUnit**: Xây dựng 2 file unit tests `RoomStatusTransitionValidatorTests.cs` và `UpdateRoomStatusCommandValidatorTests.cs` bao phủ toàn diện 25 kịch bản chuyển đổi trạng thái (ma trận 5x5).

### 4. Tình trạng kiểm thử & Tích hợp
* **Backend (.NET 10)**: Lệnh `dotnet build backend/HotelSaas.slnx` đạt **0 Cảnh báo (0 Warning), 0 Lỗi (0 Error)**. Toàn bộ Unit Tests vượt qua 100%.
* **Frontend (Angular 22)**: Lệnh `npm --prefix frontend run build` biên dịch thành công đạt **0 Lỗi (0 Error)**.
* **Mã nguồn đã hợp nhất hoàn toàn**: Toàn bộ tính năng của 3 thành viên đã được tích hợp qua Pull Requests và đồng bộ trên các nhánh [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop) và [`main`](https://github.com/GinNgo/hotel-saas-v2/tree/main).

---

## PHẦN II. DANH MỤC LINK GITHUB BLOB MÃ NGUỒN CỤ THỂ CỦA 3 THÀNH VIÊN

Tất cả các liên kết bên dưới dẫn trực tiếp đến file mã nguồn trên kho GitHub của nhóm: `https://github.com/GinNgo/hotel-saas-v2/blob/develop/...`

### 1. Ngô Võ Tuấn An (MSSV: `24TX810001` — Backend & Kiến trúc nền tảng)
*Phân hệ đảm nhiệm: Clean Architecture .NET 10, Multi-tenant Isolation, Auth JWT/Refresh Token xoay vòng, RBAC Bitmask, Seed Data, Exception Handler, CI/CD Pipeline.*

1. Domain Tenant: [`Tenant.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Tenant.cs)
2. Domain Property: [`Property.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Property.cs)
3. Domain User: [`User.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/User.cs)
4. Domain RolePermission: [`RolePermission.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RolePermission.cs)
5. Domain RefreshToken: [`RefreshToken.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RefreshToken.cs)
6. Base Entity Multi-tenant: [`BaseEntity.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Common/BaseEntity.cs)
7. Current Tenant Interface: [`ICurrentTenantService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Common/Interfaces/ICurrentTenantService.cs)
8. Current Property Interface: [`ICurrentPropertyService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Common/Interfaces/ICurrentPropertyService.cs)
9. App DbContext Interface: [`IApplicationDbContext.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs)
10. EF Core DbContext Implementation: [`ApplicationDbContext.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs)
11. Multi-tenant SaveChanges Interceptor: [`TenantPropertySaveChangesInterceptor.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/TenantPropertySaveChangesInterceptor.cs)
12. Bộ nạp dữ liệu môi trường Dev: [`LocalDevDataSeeder.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs)
13. Xử lý cấp phát và kiểm tra JWT: [`JwtService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/JwtService.cs)
14. Bộ mã hóa mật khẩu bảo mật: [`PasswordHasher.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/PasswordHasher.cs)
15. Controller Đăng nhập & Xác thực: [`AuthController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs)
16. Middleware xử lý lỗi tập trung RFC 7807: [`ExceptionHandlingMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs)
17. Pipeline tự động hóa CI GitHub Actions: [`.github/workflows/ci.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml)
18. Cấu hình môi trường chứa Docker: [`docker-compose.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docker-compose.yml)
19. Service Xác thực Angular Client: [`auth.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/auth.service.ts)
20. Service Lưu trữ Token an toàn: [`token-storage.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/token-storage.service.ts)
21. HTTP Interceptor đính kèm Token & TenantId: [`jwt.interceptor.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/interceptors/jwt.interceptor.ts)
22. Guard bảo vệ định tuyến RBAC: [`auth.guard.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/guards/auth.guard.ts)
23. Trang Giao diện Đăng nhập: [`login.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/auth/login/login.page.ts)
24. Template HTML Đăng nhập với Quick Fill: [`login.page.html`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/auth/login/login.page.html)
25. Trang Bảng điều khiển Quản trị: [`dashboard.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/dashboard/dashboard.page.ts)
26. Template HTML Bảng điều khiển: [`dashboard.page.html`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/dashboard/dashboard.page.html)

---

### 2. Nguyễn Khởi Nguyên (MSSV: `24TX810011` — Phân hệ Danh mục Phòng & Hạng phòng)
*Phân hệ đảm nhiệm: Quản lý danh mục Hạng phòng (RoomType) và Phòng vật lý (Room) theo mẫu thiết kế CQRS + MediatR, bộ lọc phòng nâng cao, kiểm tra ràng buộc đặt phòng, giao diện Angular Catalog.*

1. Domain Hạng phòng: [`RoomType.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RoomType.cs)
2. Domain Phòng vật lý: [`Room.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Room.cs)
3. Command Tạo Hạng phòng: [`CreateRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommand.cs)
4. Validator Tạo Hạng phòng: [`CreateRoomTypeCommandValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommandValidator.cs)
5. Command Cập nhật Hạng phòng: [`UpdateRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/UpdateRoomType/UpdateRoomTypeCommand.cs)
6. Command Xóa Hạng phòng (kiểm tra phòng trực thuộc): [`DeleteRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/DeleteRoomType/DeleteRoomTypeCommand.cs)
7. Query Lấy danh sách Hạng phòng: [`GetRoomTypesQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Queries/GetRoomTypes/GetRoomTypesQuery.cs)
8. Query Lấy chi tiết Hạng phòng: [`GetRoomTypeByIdQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Queries/GetRoomTypeById/GetRoomTypeByIdQuery.cs)
9. Command Tạo Bảng giá Hạng phòng: [`CreateRoomTypeRateCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomTypeRate/CreateRoomTypeRateCommand.cs)
10. Query Lịch sử Thay đổi Giá Hạng phòng: [`GetRoomTypeRateHistoryQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Queries/GetRoomTypeRateHistory/GetRoomTypeRateHistoryQuery.cs)
11. DTO Hạng phòng: [`RoomTypeDto.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/DTOs/RoomTypeDto.cs)
12. Command Tạo Phòng: [`CreateRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommand.cs)
13. Validator Tạo Phòng (chống trùng số phòng trong chi nhánh): [`CreateRoomCommandValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommandValidator.cs)
14. Command Cập nhật Phòng: [`UpdateRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoom/UpdateRoomCommand.cs)
15. Command Xóa Phòng (kiểm tra trạng thái đang có khách & đơn đặt): [`DeleteRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/DeleteRoom/DeleteRoomCommand.cs)
16. Query Lấy danh sách Phòng theo tầng/trạng thái: [`GetRoomsQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Queries/GetRooms/GetRoomsQuery.cs)
17. DTO Phòng: [`RoomDto.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/DTOs/RoomDto.cs)
18. WebApi Hạng phòng: [`RoomTypesController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs)
19. WebApi Phòng vật lý: [`RoomsController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs)
20. Component Giao diện Danh mục Hạng phòng: [`room-types.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/room-types/room-types.page.ts)
21. Component Giao diện Danh sách Phòng: [`rooms.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/rooms/rooms.page.ts)
22. Tiện ích Lọc Hạng phòng: [`room-types-filter.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/room-types-filter.util.ts)
23. Tiện ích Kiểm tra Định dạng Số phòng: [`rooms-validation.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/rooms-validation.util.ts)

---

### 3. Trần Trọng Tân (MSSV: `24TX810025` — Phân hệ Điều phối Buồng phòng)
*Phân hệ đảm nhiệm: Máy trạng thái hữu hạn buồng phòng (FSM), Khóa lạc quan chống xung đột đồng thời (Concurrency Lock `expectedOldStatus` trả về 409 Conflict), giao diện Housekeeping Board bằng Angular Signals, thuật toán KPI và bộ unit tests.*

1. Domain Nhiệm vụ Buồng phòng: [`HousekeepingTask.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/HousekeepingTask.cs)
2. Domain Enum Trạng thái Phòng: [`RoomStatus.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/RoomStatus.cs)
3. Domain Enum Mức độ ưu tiên dọn dẹp: [`HousekeepingPriority.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/HousekeepingPriority.cs)
4. Domain Enum Trạng thái nhiệm vụ dọn: [`HousekeepingTaskStatus.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/HousekeepingTaskStatus.cs)
5. Bộ thẩm định Máy trạng thái FSM: [`RoomStatusTransitionValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs)
6. Command Cập nhật Trạng thái Phòng kèm Concurrency Lock: [`UpdateRoomStatusCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommand.cs)
7. Request Model WebApi Cập nhật Trạng thái: [`UpdateRoomStatusRequest.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Models/UpdateRoomStatusRequest.cs)
8. WebApi Buồng phòng: [`HousekeepingController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/HousekeepingController.cs)
9. Xử lý Concurrency Phía Client: [`housekeeping-concurrency.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-concurrency.util.ts)
10. Tiện ích Tính toán KPI Buồng phòng Thời gian thực: [`housekeeping-kpi.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-kpi.util.ts)
11. Giao diện Housekeeping Board (Angular Signals): [`housekeeping.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/housekeeping/housekeeping.page.ts)
12. Bộ Unit Tests Kiểm thử FSM Buồng phòng: [`RoomStatusTransitionValidatorTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Rooms/RoomStatusTransitionValidatorTests.cs)
13. Bộ Unit Tests Kiểm thử Validation Cập nhật Trạng thái: [`UpdateRoomStatusCommandValidatorTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Rooms/UpdateRoomStatusCommandValidatorTests.cs)

---

## PHẦN III. BẢNG ĐỐI CHIẾU COMMIT MESSAGE NGUYÊN VĂN THEO GIT LOG (VERBATIM)

Bảng trích xuất nguyên văn 100% từ lệnh `git log --pretty=format:"%h | %an <%ae> | %ad | %s"` trên nhánh `develop` của kho lưu trữ GitHub hiện tại:

| Commit Hash | Tác Giả (Author) & Email | Ngày Thực Hiện | Commit Message Khớp 100% Nguyên Văn Git Log | Nội Dung Nghiệp Vụ Bàn Giao Cụ Thể |
|:---:|:---|:---:|:---|:---|
| [`6895fc4`](https://github.com/GinNgo/hotel-saas-v2/commit/6895fc4) | AnNgo <br>`90098665+GinNgo@users.noreply.github.com` | 2026-10-14 | `Merge pull request #4 from GinNgo/feature/tan-housekeeping` | Hợp nhất phân hệ Quản lý Buồng phòng của Trần Trọng Tân vào nhánh `develop`, tích hợp FSM và giao diện Board. |
| [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97) | Tan <br>`trantrongtan096@gmail.com` | 2026-10-14 | `feat(housekeeping): Trần Trọng Tân - implement housekeeping board and state machine (Fullstack BE FSM + FE Angular)` | Trần Trọng Tân: Hoàn thiện FSM 5 trạng thái buồng phòng, Concurrency Lock 409 Conflict, KPI buồng phòng, Angular Signals Board và xUnit Tests. |
| [`5a9e65f`](https://github.com/GinNgo/hotel-saas-v2/commit/5a9e65f) | AnNgo <br>`90098665+GinNgo@users.noreply.github.com` | 2026-10-14 | `Merge pull request #3 from GinNgo/feature/nguyen/room-roomtype` | Hợp nhất phân hệ Quản lý Danh mục Phòng & Hạng phòng của Nguyễn Khởi Nguyên vào nhánh `develop`. |
| [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e) | nguyencd <br>`nguyendev13@gmail.com` | 2026-10-14 | `[feat] full CRUD manage Room and RomType` | Nguyễn Khởi Nguyên: Hoàn thiện toàn bộ CRUD Hạng phòng, CRUD Phòng vật lý theo CQRS MediatR, Bảng giá, FluentValidation và UI Angular. |
| [`c756904`](https://github.com/GinNgo/hotel-saas-v2/commit/c756904) | Tuan An <br>`ngovotuananh@gmail.com` | 2026-10-14 | `docs: clean up redundant documentation and establish comprehensive agent rulebook` | Ngô Võ Tuấn An: Tinh gọn tài liệu dự án, thiết lập sổ tay quy chuẩn kỹ thuật cho hệ sinh thái AI Agent phát triển phần mềm. |
| [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) | Tuan An <br>`ngovotuananh@gmail.com` | 2026-10-14 | `feat(arch): initial core architecture foundation - Clean Architecture .NET 10, Multi-tenant, Auth + RBAC, Seed Data, CI/CD` | Ngô Võ Tuấn An: Khởi tạo kiến trúc nền tảng Clean Architecture .NET 10, Multi-tenant Isolation, Auth JWT/Refresh Token Rotation, RBAC Bitmask, Seeder và CI/CD. |

---

## PHẦN IV. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO CHO TỪNG CHỨC NĂNG CỤ THỂ (AI DISCLOSURE & AUDIT LOG)

### 1. Bảng Tổng Hợp Khai Báo Sử Dụng AI (Chuẩn 8 Cột Của Bộ Môn)

| STT | Thành Viên & MSSV | Công Cụ AI | Chức Năng Cụ Thể | Tóm Tắt Prompt Đã Dùng | Kết Quả AI Đã Sinh Ra | Sinh Viên Phản Biện & Sửa Chữa | Lỗi Ảo Giác (Hallucination) Đã Khắc Phục | Commit Đối Chiếu |
|:---:|:---|:---|:---|:---|:---|:---|:---|:---:|
| **#01** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity / Claude 3.5 | Clean Architecture .NET 10 & Docker Compose | Yêu cầu dựng 4 tầng Clean Architecture, Docker Compose Postgres 17 + Redis 7 | Cấu trúc solution `.sln`, `.csproj`, `docker-compose.yml` | Sửa đăng ký MediatR sang chuẩn .NET 10, sửa port mapping Docker trên Windows | AI sinh cú pháp MediatR cũ bị deprecated $\to$ Sinh viên sửa sang API chuẩn mới | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#02** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity | Multi-tenant Data Isolation (Filter & Interceptor) | Yêu cầu tạo Global Query Filter và SaveChangesInterceptor tự động gán và lọc TenantId | Class Interceptor và cấu hình DbContext | Thêm điều kiện an toàn khi không có HTTP context (Background Job), ngăn chặn ghi đè cross-tenant | AI không xử lý trường hợp TenantId rỗng $\to$ Sinh viên bổ sung exception handling an toàn | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#03** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity | Auth JWT & Refresh Token Rotation | Yêu cầu module xác thực JWT có cơ chế xoay vòng Refresh Token chống Replay Attack | `JwtService.cs`, `AuthController.cs` | Thay SHA256 thô bằng BCrypt work factor 12, bổ sung thu hồi toàn bộ token family khi bị replay | AI sinh mã hóa mật khẩu không muối (unsalted) $\to$ Sinh viên thay bằng BCrypt chuẩn an toàn | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#04** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity | Phân quyền RBAC Bitmask & Middleware RFC 7807 | Yêu cầu phân quyền bitmask bitwise và middleware bắt lỗi trả về ProblemDetails RFC 7807 | Enum Bitmask và Middleware tập trung | Chuyển sang dùng `ProblemDetails` native của .NET 10, cấu hình traceId chuẩn RFC | AI tự sinh JSON string thủ công không chuẩn RFC 7807 $\to$ Sinh viên refactor theo chuẩn Microsoft | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#05** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity | LocalDevDataSeeder Môi Trường Cục Bộ | Yêu cầu tạo dữ liệu mẫu Idempotent gồm Tenant, Khách sạn, User, Role, Phòng | Class Seeder dùng `EnsureCreated` | Bỏ `EnsureCreated`, chuyển sang kiểm tra `AnyAsync()` và Deterministic GUID chống lỗi trùng khóa | AI gọi AddRange gây lỗi Primary Key khi chạy lại $\to$ Sinh viên chuyển sang logic Idempotent | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#06** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity | GitHub Actions CI/CD Pipeline 6 Stages | Yêu cầu pipeline CI kiểm thử tự động, container Postgres 17, build .NET 10 và Angular | File YAML `.github/workflows/ci.yml` | Nâng cấp action lên `@v4`, sửa healthcheck Postgres container với `pg_isready` | AI dùng action cũ v3 không hỗ trợ .NET 10 $\to$ Sinh viên nâng cấp v4 và thêm cache npm/nuget | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#07** | Nguyễn Khởi Nguyên (`24TX810011`) | GitHub Copilot / ChatGPT | Entity Room & RoomType + Fluent API Multi-tenant | Yêu cầu tạo thực thể Room, RoomType và cấu hình Unique Index cho số phòng | Domain Entities và Fluent API config | Phát hiện AI tạo Unique Index chỉ trên `RoomNumber`, sửa thành composite index kèm TenantId + PropertyId | AI quên scoped Multi-tenant làm trùng số phòng giữa các khách sạn $\to$ Sinh viên sửa composite index | [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e) |
| **#08** | Nguyễn Khởi Nguyên (`24TX810011`) | GitHub Copilot | Quản lý Hạng phòng (Create/Update RoomType) | Yêu cầu viết Command, Handler và FluentValidation kiểm tra trùng mã Hạng phòng | CQRS Commands, Handlers, Validators | Chuẩn hóa `Code.Trim().ToUpper()`, bổ sung kiểm tra phân quyền chi nhánh và mapping DTO an toàn | AI kiểm tra trùng mã không kèm TenantId $\to$ Sinh viên bổ sung tenant scoping | [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e) |
| **#09** | Nguyễn Khởi Nguyên (`24TX810011`) | GitHub Copilot | Bảng giá Hạng phòng & Lịch sử Audit Rate | Yêu cầu tạo bảng giá theo thời gian và lưu lịch sử thay đổi giá | `CreateRoomTypeRateCommand`, Audit query | Thêm ràng buộc `EffectiveFrom < EffectiveTo` và kiểm tra chống trùng lấn thời gian (overlapping) | AI bỏ qua kiểm tra trùng lấn ngày áp dụng giá $\to$ Sinh viên viết query chặn khoảng ngày giao nhau | [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e) |
| **#10** | Nguyễn Khởi Nguyên (`24TX810011`) | GitHub Copilot | Xóa Phòng an toàn & Ràng buộc Đơn đặt phòng | Yêu cầu viết lệnh xóa phòng có kiểm tra ràng buộc phòng đang có khách hoặc có lịch đặt | `DeleteRoomCommand.cs` | Bác bỏ code xóa cứng của AI, thay bằng kiểm tra ngoại lệ `ValidationException` và chuyển sang Soft Delete | AI sinh lệnh xóa cứng `Remove()` làm mất toàn vẹn dữ liệu $\to$ Sinh viên sửa thành kiểm tra ràng buộc | [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e) |
| **#11** | Nguyễn Khởi Nguyên (`24TX810011`) | GitHub Copilot | Query Lọc Phòng, WebApi Controllers & UI Angular | Yêu cầu viết Query lọc theo tầng/loại phòng, WebApi Controllers và utils kiểm tra số phòng | `GetRoomsQuery`, Controllers, UI utils | Sửa lỗi in-memory evaluation của LINQ sang câu lệnh SQL phân trang, viết regex validate số phòng | AI gọi `.ToList()` trước khi `.Skip().Take()` gây quá tải RAM $\to$ Sinh viên tối ưu truy vấn CSDL | [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e) |
| **#12** | Trần Trọng Tân (`24TX810025`) | Claude 3.5 Sonnet / Antigravity | Mô hình HousekeepingTask & Enum 5 RoomStatus | Yêu cầu thiết kế thực thể nhiệm vụ dọn phòng và 5 trạng thái phòng chuẩn quốc tế | `HousekeepingTask.cs`, Enums | Chuẩn hóa múi giờ sang UTC (`DateTimeKind.Utc`), bổ sung quan hệ khóa ngoại giữa Task và Room | AI dùng Local DateTime gây lỗi lệch múi giờ $\to$ Sinh viên chuẩn hóa toàn bộ sang UTC | [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97) |
| **#13** | Trần Trọng Tân (`24TX810025`) | Claude 3.5 Sonnet | Máy trạng thái hữu hạn Buồng phòng FSM | Yêu cầu viết `RoomStatusTransitionValidator` kiểm soát chuyển trạng thái giữa Clean, Dirty, etc. | Class FSM State Machine Validator | Bổ sung đường dẫn từ `OutOfService` về `Dirty`/`Inspecting` mà AI bỏ sót trong ma trận | AI chặn đường chuyển trạng thái phòng sau bảo dưỡng $\to$ Sinh viên bổ sung quy tắc chuyển đổi | [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97) |
| **#14** | Trần Trọng Tân (`24TX810025`) | Claude 3.5 Sonnet | Khóa Lạc Quan Concurrency Lock 409 Conflict | Yêu cầu chống xung đột đồng thời 2 nhân viên cùng đổi trạng thái bằng `ExpectedOldStatus` | `UpdateRoomStatusCommand` | Sử dụng `ReloadAsync()` đảm bảo lấy trạng thái mới nhất từ DB, ánh xạ trả về lỗi HTTP 409 Conflict | AI đọc cache cũ của DbContext không bắt được xung đột $\to$ Sinh viên viết lại logic concurrency | [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97) |
| **#15** | Trần Trọng Tân (`24TX810025`) | Claude 3.5 Sonnet | WebApi Buồng phòng & Thuật toán KPI Thời gian thực | Yêu cầu viết controller buồng phòng và tiện ích tính tỷ lệ phòng sạch, phòng bẩn | `HousekeepingController`, `housekeeping-kpi.util.ts` | Bổ sung kiểm tra chia cho 0 (`totalRooms === 0`), định dạng hiển thị phần trăm chuẩn | AI không kiểm tra chia cho 0 gây lỗi `NaN%` trên UI $\to$ Sinh viên thêm guard condition | [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97) |
| **#16** | Trần Trọng Tân (`24TX810025`) | Google Antigravity | Màn hình Housekeeping Board bằng Angular Signals | Yêu cầu xây dựng bảng điều phối buồng phòng chia theo tầng, đổi màu trạng thái, khóa nút khi gửi request | `housekeeping.page.ts` (686 dòng) | Viết lại hoàn toàn sang Angular Signals thuần (`computed`, `signal`), quản lý state khóa nút khi click | AI đề xuất thư viện ngoài và RxJS rườm rà $\to$ Sinh viên tự viết bằng Angular Signals hiện đại | [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97) |
| **#17** | Trần Trọng Tân (`24TX810025`) | Claude 3.5 Sonnet | Bộ Unit Tests Kiểm Thử Tự Động xUnit FSM | Yêu cầu viết unit tests xUnit bao phủ các trường hợp chuyển đổi trạng thái hợp lệ và bất hợp lệ | Các test cases xUnit kiểm thử FSM | Sử dụng `[Theory]` và `[InlineData]` bao phủ toàn diện ma trận 5x5 trạng thái (25 kịch bản) | AI chỉ viết 3 test cases sơ sài $\to$ Sinh viên bổ sung trọn vẹn 25 test cases kiểm thử biên | [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97) |

---

### 2. Chi Tiết Toàn Bộ 17 Câu Prompt Thực Tế Của Từng Chức Năng Cụ Thể

#### 🔵 NHÓM CHỨC NĂNG CỦA NGÔ VÕ TUẤN AN (`24TX810001` — Core Architecture & Infrastructure)

##### 📌 Chức năng 1: Khởi tạo Clean Architecture .NET 10 & Môi trường Docker Compose
* **Tệp mã nguồn:** `backend/HotelSaas.slnx`, `docker-compose.yml`
* **Prompt thực tế sử dụng:**
  ```text
  "Tôi đang xây dựng backend .NET 10 cho hệ thống Hotel SaaS đa chi nhánh theo mô hình Clean Architecture (4 tầng: Domain, Application, Infrastructure, WebApi). Nhờ bạn hướng dẫn cấu trúc thư mục chuẩn, cấu hình file docker-compose.yml khởi chạy PostgreSQL 17 và Redis 7, đồng thời thiết lập MediatR v12+ và FluentValidation. Yêu cầu đảm bảo tuân thủ nguyên lý Dependency Inversion."
  ```
* **Kết quả do AI sinh ra:**
  AI đề xuất sơ đồ 4 project trong solution, cấu hình port `5432:5432` cho PostgreSQL, và tạo code đăng ký MediatR dạng cũ `services.AddMediatR(typeof(Program));`.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  1. *Lỗi cú pháp thư viện:* Trên .NET 10 và MediatR v12+, hàm `AddMediatR` kiểu cũ gây lỗi build. Sinh viên sửa lại thành:
     ```csharp
     services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));
     ```
  2. *Xung đột cổng Docker trên Windows:* Cổng mặc định 5432 bị đụng độ với service Postgres cục bộ có sẵn. Sinh viên đã sửa thành ánh xạ biến môi trường linh hoạt và bổ sung volume mapping chuẩn cho Redis data.
* **Commit đối chiếu:** [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372)

##### 📌 Chức năng 2: Cơ chế cách ly dữ liệu Multi-tenant SaaS (Filter & Interceptor)
* **Tệp mã nguồn:** [`BaseEntity.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Common/BaseEntity.cs), [`ApplicationDbContext.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs), [`TenantPropertySaveChangesInterceptor.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/TenantPropertySaveChangesInterceptor.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Hãy viết giúp tôi giải pháp Multi-tenancy cho EF Core trên .NET 10 để bảo vệ dữ liệu SaaS. Mỗi entity đều kế thừa từ BaseEntity có TenantId và PropertyId. Tạo cơ chế Global Query Filters tự động lọc dữ liệu theo ngữ cảnh khách thuê hiện tại lấy từ ICurrentTenantService và ICurrentPropertyService, đồng thời viết một SaveChangesInterceptor tự động điền TenantId/PropertyId khi Insert và chặn ghi đè chéo (Cross-tenant data pollution) khi Update."
  ```
* **Kết quả do AI sinh ra:**
  AI tạo `TenantPropertySaveChangesInterceptor` ghi đè `SavingChangesAsync`. Tuy nhiên, trong Global Query Filter, AI dùng biểu thức lambda trực tiếp `p => p.TenantId == _currentTenantService.TenantId` mà không kiểm tra trường hợp truy vấn từ hệ thống nền (Background Job hoặc System Admin không có HTTP context).
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên bổ sung điều kiện kiểm tra an toàn `if (_currentTenantService.TenantId.HasValue)` và tái cấu trúc interceptor để ném custom exception có thông tin chi tiết thay vì lỗi `NullReferenceException` không xác định.
* **Commit đối chiếu:** [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372)

##### 📌 Chức năng 3: Hệ thống Xác thực JWT & Refresh Token Rotation
* **Tệp mã nguồn:** [`JwtService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/JwtService.cs), [`PasswordHasher.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/PasswordHasher.cs), [`AuthController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Hãy triển khai module xác thực JWT hoàn chỉnh cho .NET 10 với cơ chế Refresh Token xoay vòng (Token Rotation) nhằm ngăn chặn tấn công phát lại (Replay Attack). Khi client gửi Refresh Token hợp lệ lên, hệ thống phải hủy token cũ, sinh một cặp Access Token + Refresh Token mới, lưu lại lịch sử thu hồi (RevokedAtUtc, ReplacedByToken). Nếu một token đã bị thu hồi bị tái sử dụng, hệ thống phải lập tức vô hiệu hóa toàn bộ chuỗi token của người dùng đó (Revoke Token Family) và ghi cảnh báo bảo mật."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh `JwtService.cs` và `AuthController.cs` tạo JWT claims. Tuy nhiên, logic phát hiện token tái sử dụng chỉ xóa token hiện tại mà không thu hồi theo chuỗi (cascade revoke), đồng thời mật khẩu được băm bằng SHA256 thô không có salt.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên thay thế hoàn toàn SHA256 bằng thuật toán BCrypt chuẩn qua thư viện `BCrypt.Net-Next` (work factor = 12). Hoàn thiện thuật toán phát hiện rò rỉ token: khi phát hiện token đã thu hồi được gửi lên, lập tức thu hồi tất cả các Refresh Token đang hoạt động của tài khoản đó.
* **Commit đối chiếu:** [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372)

##### 📌 Chức năng 4: Hệ thống Phân quyền RBAC Bitmask & Middleware RFC 7807
* **Tệp mã nguồn:** [`RolePermission.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RolePermission.cs), [`ExceptionHandlingMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Tôi muốn thiết kế hệ thống phân quyền phân hệ theo dạng Bitmask (Read = 1, Create = 2, Update = 4, Delete = 8, Admin = 16) trong C# .NET 10 để kiểm tra quyền truy cập tài nguyên siêu nhanh bằng toán tử bitwise (userPerm & requiredPerm) != 0. Ngoài ra, viết một middleware ASP.NET Core tập trung bắt tất cả Exception và trả về chuẩn RFC 7807 ProblemDetails (gồm traceId, title, status, errors dictionary cho 400 Validation, 401 Unauthorized, 403 Forbidden, 409 Conflict, 500 Server Error)."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh enum bitmask và middleware. Trong middleware, AI trả về JSON thủ công bằng `context.Response.WriteAsync()` mà không dùng `ProblemDetails` chuẩn của ASP.NET Core, thiếu các thuộc tính `type`, `instance` và `traceId` chuẩn.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên refactor middleware sử dụng class `ProblemDetails` chính thức từ namespace `Microsoft.AspNetCore.Mvc`, bắt đúng kiểu `ValidationException` từ FluentValidation và đóng gói mảng lỗi dạng `Dictionary<string, string[]>`.
* **Commit đối chiếu:** [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372)

##### 📌 Chức năng 5: Bộ nạp dữ liệu mẫu môi trường phát triển cục bộ (`LocalDevDataSeeder`)
* **Tệp mã nguồn:** [`LocalDevDataSeeder.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Viết class C# LocalDevDataSeeder.cs trong tầng Infrastructure để tự động nạp dữ liệu mẫu ban đầu khi ứng dụng khởi chạy ở môi trường Development. Dữ liệu gồm: 1 Tenant mẫu ('Grand Palace Group'), 2 Khách sạn trực thuộc ('Grand Palace Sài Gòn' & 'Grand Palace Đà Nẵng'), 4 tài khoản người dùng tương ứng với các vai trò (SystemAdmin, TenantOwner, PropertyManager, Staff/Housekeeper), 4 loại phòng (Deluxe, Suite, Executive, Standard) và 20 phòng vật lý. Seeder phải có tính chất Idempotent (chạy lặp lại nhiều lần không bị lỗi trùng khóa chính)."
  ```
* **Kết quả do AI sinh ra:**
  AI gọi `context.Database.EnsureCreated()` và gọi `AddRange()` trực tiếp. Khi database đã có sẵn dữ liệu, lệnh này ném lỗi `duplicate key value violates unique constraint`.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên viết lại toàn bộ hàm seeder theo phương thức `await context.Tenants.AnyAsync(t => t.Code == ...)` trước khi thêm, sử dụng GUID cố định (Deterministic GUID) cho các bản ghi gốc giúp tái tạo dữ liệu nhất quán giữa các máy phát triển.
* **Commit đối chiếu:** [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372)

##### 📌 Chức năng 6: Quy trình tích hợp liên tục CI/CD GitHub Actions 6 giai đoạn
* **Tệp mã nguồn:** [`.github/workflows/ci.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml)
* **Prompt thực tế sử dụng:**
  ```text
  "Hãy tạo file pipeline GitHub Actions .github/workflows/ci.yml kích hoạt mỗi khi có pull request hoặc push vào nhánh develop và main. Pipeline gồm các job: kiểm tra format code, bảo mật secret scanning (gitleaks), khởi tạo service container PostgreSQL 17, build và chạy toàn bộ unit tests .NET 10 với code coverage, build frontend Angular 22 với lệnh npm run build, và kiểm tra Docker build."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh workflow YAML dùng actions phiên bản cũ (`actions/checkout@v3`, `actions/setup-dotnet@v3` - không hỗ trợ .NET 10), đồng thời service container Postgres bị lỗi healthcheck do thiếu biến `POSTGRES_HOST_AUTH_METHOD=trust`.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên nâng cấp toàn bộ actions lên `@v4`, cấu hình healthcheck Postgres với lệnh `pg_isready -U postgres`, chỉ định phiên bản SDK .NET 10 và Node 22 LTS, bổ sung caching cho npm dependencies và NuGet packages.
* **Commit đối chiếu:** [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372)

---

#### 🟢 NHÓM CHỨC NĂNG CỦA NGUYỄN KHỞI NGUYÊN (`24TX810011` — Room & RoomType Catalog)

##### 📌 Chức năng 7: Thiết kế thực thể và cấu hình CSDL Hạng phòng & Phòng vật lý
* **Tệp mã nguồn:** [`RoomType.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RoomType.cs), [`Room.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Room.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Tôi phụ trách phân hệ Quản lý Phòng của Hotel SaaS. Hãy viết 2 Domain Entities RoomType.cs và Room.cs kế thừa BaseEntity. RoomType gồm: Name, Code, BasePrice, MaxOccupancy, TotalRooms, Description, AmenitiesJson. Room gồm: RoomNumber, FloorNumber, RoomTypeId, CurrentStatus (enum Clean, Dirty, Occupied, etc.), Notes. Viết thêm EF Core Fluent API Configuration trong Infrastructure đảm bảo số phòng RoomNumber là duy nhất trong cùng một chi nhánh PropertyId."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh entity và cấu hình `builder.HasIndex(r => r.RoomNumber).IsUnique();`. Lỗi nghiêm trọng: Index duy nhất không kèm `PropertyId` và `TenantId`, dẫn đến việc Khách sạn A có phòng 101 thì Khách sạn B không thể tạo phòng 101 được!
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên nhận diện lỗi vi phạm mô hình Multi-tenant, sửa cấu hình index thành composite unique index: `builder.HasIndex(r => new { r.TenantId, r.PropertyId, r.RoomNumber }).IsUnique();`.
* **Commit đối chiếu:** [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e)

##### 📌 Chức năng 8: Nghiệp vụ Quản lý Hạng phòng (Create & Update RoomType Command + Validator)
* **Tệp mã nguồn:** [`CreateRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommand.cs), [`CreateRoomTypeCommandValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommandValidator.cs), [`UpdateRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/UpdateRoomType/UpdateRoomTypeCommand.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Hãy viết CreateRoomTypeCommand, UpdateRoomTypeCommand, CommandHandler và FluentValidation validator sử dụng MediatR trong C# .NET 10. Yêu cầu kiểm tra: Code không được rỗng và không quá 10 ký tự, BasePrice phải > 0, MaxOccupancy từ 1 đến 10 người. Trong Handler, kiểm tra mã Hạng phòng không được trùng lặp trong chi nhánh hiện tại trước khi lưu vào CSDL."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh Command và Validator đầy đủ. Tuy nhiên, trong Handler, AI truy vấn kiểm tra trùng mã bằng `context.RoomTypes.Where(rt => rt.Code == request.Code)` mà không lọc theo `TenantId`/`PropertyId` hiện tại, và không kiểm tra trạng thái kích hoạt `IsActive`.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên bổ sung bộ lọc chi nhánh và chuẩn hóa mã `Code.Trim().ToUpperInvariant()`. Tách DTO trả về `RoomTypeDto` loại bỏ các thông tin nhạy cảm của hệ thống.
* **Commit đối chiếu:** [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e)

##### 📌 Chức năng 9: Nghiệp vụ Bảng giá Hạng phòng & Lịch sử Audit Rate
* **Tệp mã nguồn:** [`CreateRoomTypeRateCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomTypeRate/CreateRoomTypeRateCommand.cs), [`GetRoomTypeRateHistoryQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Queries/GetRoomTypeRateHistory/GetRoomTypeRateHistoryQuery.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Hãy viết tính năng cập nhật bảng giá theo mùa/ngày cho Hạng phòng (CreateRoomTypeRateCommand.cs và GetRoomTypeRateHistoryQuery.cs). Bảng giá có EffectiveFromUtc, EffectiveToUtc, PriceAdjustmentRate, Currency. Khi giá thay đổi, hệ thống phải tự động ghi một bản ghi vào bảng Audit log để ban giám đốc đối chiếu lịch sử thay đổi giá."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh command và query handler. Nhưng AI cho phép khoảng thời gian `EffectiveFromUtc` lớn hơn `EffectiveToUtc` và không kiểm tra sự chồng lấn thời gian (overlapping date ranges) giữa các bảng giá của cùng một hạng phòng.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên viết thêm validator kiểm tra `EffectiveFromUtc < EffectiveToUtc` và câu truy vấn EF Core kiểm tra không cho phép các khoảng ngày áp dụng giá bị giao nhau (`r.EffectiveFromUtc <= request.EffectiveToUtc && r.EffectiveToUtc >= request.EffectiveFromUtc`). Bổ sung class `RoomTypeRateAuditDto`.
* **Commit đối chiếu:** [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e)

##### 📌 Chức năng 10: Nghiệp vụ Xóa Phòng an toàn & Ràng buộc Đơn đặt phòng
* **Tệp mã nguồn:** [`DeleteRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/DeleteRoom/DeleteRoomCommand.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Viết DeleteRoomCommand.cs và Handler. Trong khách sạn, phòng không được phép xóa tùy tiện nếu đang có khách ở hoặc có đơn đặt phòng (Reservation) tương lai. Hãy viết logic kiểm tra: nếu phòng đang ở trạng thái Occupied hoặc có liên kết khóa ngoại với đơn đặt phòng chưa hoàn thành thì từ chối xóa và trả về lỗi nghiệp vụ rõ ràng, ngược lại mới cho phép xóa hoặc đánh dấu IsDeleted."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh code gọi thẳng `context.Rooms.Remove(room); await context.SaveChangesAsync();` và chỉ kiểm tra đơn giản `room == null`. Đây là ảo giác bỏ qua toàn bộ yêu cầu bảo vệ toàn vẹn dữ liệu đặt phòng đã nêu trong prompt.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên tự tay viết lại Handler: ném ngoại lệ `ValidationException` nếu `room.CurrentStatus == RoomStatus.Occupied`, truy vấn kiểm tra bảng đơn phòng `context.Reservations.AnyAsync(...)`. Nếu có lịch sử đặt phòng, chuyển sang cơ chế Soft Delete hoặc hủy kích hoạt phòng thay vì xóa vật lý.
* **Commit đối chiếu:** [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e)

##### 📌 Chức năng 11: Query Lọc danh sách Phòng, WebApi Controllers & UI Angular
* **Tệp mã nguồn:** [`GetRoomsQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Queries/GetRooms/GetRoomsQuery.cs), [`RoomTypesController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs), [`RoomsController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs), [`room-types-filter.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/room-types-filter.util.ts), [`rooms-validation.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/rooms-validation.util.ts)
* **Prompt thực tế sử dụng:**
  ```text
  "Hãy viết GetRoomsQuery.cs với bộ lọc linh hoạt: lọc theo Tầng (FloorNumber), lọc theo Hạng phòng (RoomTypeId), lọc theo Trạng thái (RoomStatus), hỗ trợ phân trang (PageNumber, PageSize). Viết RoomsController.cs và RoomTypesController.cs với đầy đủ Swagger documentation. Phía Frontend Angular 22, viết room-types-filter.util.ts và rooms-validation.util.ts để format tiền tệ VNĐ và validate định dạng số phòng."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh controller và query. Tuy nhiên ở câu truy vấn LINQ, AI thực hiện `.ToList()` trước khi phân trang (`.Skip().Take()`), làm nạp toàn bộ danh sách phòng trong CSDL vào bộ nhớ RAM gây suy giảm hiệu năng nghiêm trọng (In-memory evaluation).
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên đưa các mệnh đề `.Where()`, `.OrderBy()`, `.Skip()`, `.Take()` lên trước `.ToListAsync()` để EF Core biên dịch thành câu lệnh SQL `OFFSET ... FETCH NEXT` trực tiếp trên PostgreSQL. Viết tiện ích Angular thuần sử dụng TypeScript regex `^[0-9]{3,4}[A-Z]?$` để kiểm tra số phòng hợp lệ.
* **Commit đối chiếu:** [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e)

---

#### 🟣 NHÓM CHỨC NĂNG CỦA TRẦN TRỌNG TÂN (`24TX810025` — Housekeeping Management & FSM)

##### 📌 Chức năng 12: Thiết kế mô hình dữ liệu Buồng phòng & Hệ thống 5 Trạng thái Phòng
* **Tệp mã nguồn:** [`HousekeepingTask.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/HousekeepingTask.cs), [`RoomStatus.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/RoomStatus.cs), [`HousekeepingPriority.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/HousekeepingPriority.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Tôi phụ trách phân hệ Housekeeping. Hãy thiết kế thực thể HousekeepingTask.cs gồm: RoomId, AssignedToUserId, TaskStatus (Pending, InProgress, Completed, Cancelled), Priority (Low, Medium, High, Urgent), StartedAtUtc, CompletedAtUtc, Notes, CleanlinessScore. Thiết kế Enum RoomStatus.cs gồm 5 trạng thái chuẩn khách sạn quốc tế: Clean (Sạch sẵn sàng đón khách), Dirty (Bẩn cần dọn), Inspecting (Đang kiểm tra chất lượng sau dọn), Occupied (Có khách đang lưu trú), OutOfService (Hỏng hóc, bảo trì)."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh các class Entity và Enum. Tuy nhiên AI để các trường thời gian là `DateTime` địa phương (Local Time) mà không dùng `DateTimeOffset` hoặc UTC, gây sai lệch múi giờ khi khách sạn vận hành ở các khu vực khác nhau.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên chuẩn hóa toàn bộ thuộc tính thời gian thành `DateTime` dạng UTC (`DateTimeKind.Utc`). Khởi tạo các quan hệ khóa ngoại giữa `HousekeepingTask` với `Room` và `User` (nhân viên buồng phòng) trong CSDL.
* **Commit đối chiếu:** [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97)

##### 📌 Chức năng 13: Máy trạng thái hữu hạn Buồng phòng FSM (`RoomStatusTransitionValidator`)
* **Tệp mã nguồn:** [`RoomStatusTransitionValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Viết một service C# RoomStatusTransitionValidator.cs hiện thực máy trạng thái hữu hạn (Finite State Machine - FSM) kiểm tra tính hợp lệ của việc chuyển đổi giữa 5 trạng thái phòng: Clean, Dirty, Inspecting, Occupied, OutOfService. Ví dụ: Phòng Dirty chỉ được chuyển sang Inspecting hoặc OutOfService, không thể nhảy cóc thẳng sang Clean khi chưa qua kiểm tra. Phương thức IsValidTransition(RoomStatus from, RoomStatus to) trả về boolean kèm danh sách các trạng thái kế tiếp được phép (GetAllowedTransitions)."
  ```
* **Kết quả do AI sinh ra:**
  AI thiết kế từ điển chuyển đổi `Dictionary<RoomStatus, HashSet<RoomStatus>>`. Tuy nhiên, AI bỏ sót đường dẫn: khi phòng bảo trì xong (`OutOfService`), khách sạn cần chuyển phòng về `Dirty` hoặc `Inspecting` để vệ sinh trước khi cho thuê, nhưng AI lại chặn không cho `OutOfService` chuyển đi đâu ngoại trừ chính nó!
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên bổ sung ma trận chuyển đổi đầy đủ cho tất cả các kịch bản thực tế của khách sạn: `OutOfService` được chuyển sang `Dirty` hoặc `Inspecting`; `Occupied` sau khi khách check-out tự động chuyển sang `Dirty`.
* **Commit đối chiếu:** [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97)

##### 📌 Chức năng 14: Cơ chế Khóa Lạc Quan Chống Xung Đột Đồng Thời (Concurrency Control Lock 409 Conflict)
* **Tệp mã nguồn:** [`UpdateRoomStatusCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommand.cs), [`housekeeping-concurrency.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-concurrency.util.ts)
* **Prompt thực tế sử dụng:**
  ```text
  "Trong khách sạn, có thể xảy ra trường hợp hai nhân viên dọn phòng cùng mở ứng dụng và ấn đổi trạng thái của cùng một phòng cùng lúc (Race Condition). Hãy viết UpdateRoomStatusCommand.cs có cơ chế Khóa lạc quan (Optimistic Concurrency Control): Client phải gửi kèm ExpectedOldStatus. Trong Handler, truy vấn trạng thái hiện tại từ DB; nếu CurrentStatus != request.ExpectedOldStatus, lập tức hủy thao tác và ném lỗi 409 Conflict ProblemDetails với thông báo rõ ràng để giao diện thông báo cho người dùng và tự động làm mới dữ liệu."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh Handler nhưng lại đọc trạng thái từ entity đã cached trong DbContext mà không dùng câu lệnh cập nhật nguyên tử hoặc không reload dữ liệu mới nhất từ CSDL, khiến cơ chế kiểm tra concurrency lock không hiệu quả nếu DbContext đã theo dõi entity đó từ trước.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên bổ sung phương thức `await context.Entry(room).ReloadAsync()` để đảm bảo dữ liệu mới nhất từ Postgres, cấu hình HTTP 409 Conflict ProblemDetails trong middleware. Viết tiện ích phía Angular `housekeeping-concurrency.util.ts` để bắt mã 409, tự động hiển thị thông báo Toast cảnh báo xung đột và reload lại danh sách phòng.
* **Commit đối chiếu:** [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97)

##### 📌 Chức năng 15: WebApi Buồng phòng & Thuật toán KPI Thời gian thực
* **Tệp mã nguồn:** [`HousekeepingController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/HousekeepingController.cs), [`UpdateRoomStatusRequest.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Models/UpdateRoomStatusRequest.cs), [`housekeeping-kpi.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-kpi.util.ts)
* **Prompt thực tế sử dụng:**
  ```text
  "Viết HousekeepingController.cs với endpoint PATCH /api/housekeeping/rooms/{id}/status nhận UpdateRoomStatusRequest (gồm NewStatus, ExpectedOldStatus, Notes). Viết tiện ích housekeeping-kpi.util.ts tính toán các chỉ số vận hành buồng phòng theo thời gian thực: Tỷ lệ phòng sẵn sàng đón khách (Clean Ratio = Clean Rooms / Total Rooms * 100%), Tỷ lệ phòng cần dọn khẩn cấp (Dirty/Urgent Ratio), và Thời gian dọn phòng trung bình (Average Turnover Duration)."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh Controller và file tiện ích TypeScript. Nhưng ở hàm tính KPI, AI chia trực tiếp cho `totalRooms` mà không kiểm tra mẫu số bằng 0 (khi khách sạn mới tạo chưa có phòng nào), dẫn đến kết quả trả về `NaN%` hoặc `Infinity` làm sập giao diện hiển thị.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên bổ sung bảo vệ `if (totalRooms === 0) return 0;` trong `housekeeping-kpi.util.ts`, viết các hàm format phần trăm tròn 1 chữ số thập phân (`toFixed(1)`), gán nhãn cảnh báo màu sắc tương ứng (Xanh: Clean > 70%, Vàng: 40-70%, Đỏ: < 40%).
* **Commit đối chiếu:** [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97)

##### 📌 Chức năng 16: Giao diện Bảng điều phối Buồng phòng (Housekeeping Board) bằng Angular Signals
* **Tệp mã nguồn:** [`housekeeping.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/housekeeping/housekeeping.page.ts)
* **Prompt thực tế sử dụng:**
  ```text
  "Hãy viết component Angular 22 housekeeping.page.ts (Standalone Component) xây dựng màn hình Housekeeping Board cho quản lý buồng phòng. Màn hình nhóm danh sách phòng theo từng Tầng (Floor), mỗi thẻ phòng hiển thị: Số phòng, Hạng phòng, Huy hiệu trạng thái đổi màu linh hoạt (Clean: xanh lục, Dirty: đỏ, Inspecting: vàng cam, Occupied: xanh lam, OutOfService: xám), nút thao tác đổi trạng thái nhanh. Sử dụng Angular Signals (signal, computed) để quản lý state không dùng RxJS Subject rườm rà. Áp dụng Optimistic UI Update và vô hiệu hóa nút bấm khi đang gửi request."
  ```
* **Kết quả do AI sinh ra:**
  AI viết component nhưng dùng RxJS BehaviorSubject và `async` pipe theo phong cách Angular cũ, không dùng `computed()` signal cho việc nhóm theo tầng. Khi bấm nút đổi trạng thái, giao diện không có cờ `isUpdating` khiến người dùng click liên tiếp nhiều lần gây duplicate requests.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên tự tay viết lại toàn bộ file `housekeeping.page.ts` dài 686 dòng bằng chuẩn Angular 22 Signals hiện đại: sử dụng `computed(() => groupRoomsByFloor(this.rooms()))`, signal `updatingRoomIds = signal<Set<string>>(new Set())` để khóa từng thẻ phòng cụ thể khi đang gửi request, và xử lý hoàn tác lạc quan (Rollback Optimistic Update) nếu server trả về lỗi.
* **Commit đối chiếu:** [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97)

##### 📌 Chức năng 17: Bộ kiểm thử tự động xUnit cho FSM Buồng phòng & Validation
* **Tệp mã nguồn:** [`RoomStatusTransitionValidatorTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Rooms/RoomStatusTransitionValidatorTests.cs), [`UpdateRoomStatusCommandValidatorTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Rooms/UpdateRoomStatusCommandValidatorTests.cs)
* **Prompt thực tế sử dụng:**
  ```text
  "Hãy viết bộ Unit Tests hoàn chỉnh bằng xUnit và FluentAssertions để kiểm thử toàn diện máy trạng thái RoomStatusTransitionValidator và UpdateRoomStatusCommandValidator. Viết các test case kiểm tra: (1) Tất cả các chuyển đổi trạng thái hợp lệ theo ma trận nghiệp vụ đều trả về True; (2) Các chuyển đổi trạng thái vi phạm (như Clean sang Clean, Clean nhảy cóc sang Inspecting, Dirty nhảy cóc sang Occupied) đều trả về False; (3) Validator bắt lỗi khi ExpectedOldStatus rỗng hoặc NewStatus không hợp lệ."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh file test nhưng chỉ viết 3 test cases chung chung, dùng `Assert.True` cơ bản, không bao quát hết các cặp trạng thái và thiếu kiểm tra dữ liệu biên.
* **Sinh viên phản biện, kiểm thử & sửa chữa:**
  Sinh viên viết 2 file kiểm thử `RoomStatusTransitionValidatorTests.cs` và `UpdateRoomStatusCommandValidatorTests.cs` sử dụng `[Theory]` và `[InlineData]` bao phủ toàn bộ 25 cặp trạng thái (5x5 matrix). Kết quả chạy `dotnet test` đạt 100% pass với 0 lỗi.
* **Commit đối chiếu:** [`5e39c97`](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97)

---

## PHẦN V. KẾ HOẠCH PHỐI HỢP THỰC HIỆN TUẦN 02 CỦA 3 THÀNH VIÊN

Tuần 2 tập trung vào việc hiện thực phân hệ cốt lõi: **Động cơ Đặt phòng (Reservation Engine) & Quản lý Lưu trú (Front Desk PMS)**:

| STT | Thành Viên | Mã Số SV | Nhiệm Vụ Trọng Tâm Tuần 02 | Kết Quả Đầu Ra Kỹ Thuật Dự Kiến |
|:---:|:---|:---:|:---|:---|
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | **Chủ trì Động cơ Đặt phòng (Reservation Engine Backend):**<br>- Thiết kế Entity Reservation, ReservationGuest, Folio, Invoice.<br>- Hiện thực FSM vòng đời đặt phòng: `PendingPayment` $\to$ `Confirmed` $\to$ `CheckedIn` $\to$ `CheckedOut` $\to$ `Cancelled`.<br>- Xây dựng thuật toán kiểm tra phòng trống (Room Availability Engine) chống Overbooking.<br>- Viết API Check-in / Check-out và tính phí phát sinh (Mini-bar, Dịch vụ). | - `Reservation.cs`, `Folio.cs`, `ReservationStatus.cs`.<br>- `CreateReservationCommand`, `CheckInCommand`, `CheckOutCommand`.<br>- Bộ Unit Tests kiểm thử FSM Reservation và Availability. |
| 2 | **Nguyễn Khởi Nguyên** | `24TX810011` | **Phân hệ Tiện nghi Phòng, Thư viện Ảnh & Đặt phòng Client:**<br>- Bổ sung quản lý danh mục Tiện nghi phòng (Amenities CRUD).<br>- Tích hợp dịch vụ tải ảnh phòng (Gallery Service lưu trữ đa chi nhánh).<br>- Xây dựng giao diện Đặt phòng công khai dành cho Khách lưu trú (Guest Booking Portal) bằng Angular Signals.<br>- Viết form tìm kiếm phòng theo khoảng ngày lưu trú và số lượng khách. | - `RoomAmenity.cs`, `RoomImage.cs`.<br>- `guest-booking.page.ts`, `room-details-modal.component.ts`.<br>- Tích hợp API Availability Engine từ Backend của Tuấn An. |
| 3 | **Trần Trọng Tân** | `24TX810025` | **Tự động hóa Phân công Buồng phòng & Liên thông Front Desk:**<br>- Xây dựng cơ chế tự động tạo nhiệm vụ dọn phòng khi khách Check-out (`Auto Housekeeping Trigger`).<br>- Thuật toán tự động phân công phòng cần dọn cho nhân viên dựa trên tải công việc hiện tại (Workload Balancing).<br>- Bổ sung danh sách kiểm tra vệ sinh (Housekeeping Inspection Checklist).<br>- Tích hợp thông báo thời gian thực (SignalR hoặc Polling) cập nhật trạng thái phòng lên Front Desk Board. | - `AutoAssignHousekeepingCommandHandler.cs`.<br>- `InspectionChecklistDto.cs`.<br>- SignalR Hub `/hubs/housekeeping` đẩy cập nhật trạng thái thời gian thực sang giao diện Lễ tân. |

---

## PHẦN VI. VĂN BẢN NỘP BÁO CÁO CHO GIẢNG VIÊN HƯỚNG DẪN

```text
Kính gửi ThS. Phùng Hữu Xuân,

Nhóm sinh viên thực hiện đề tài Topic 578: "Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh Theo Mô Hình SaaS (Hotel SaaS Platform v2)" xin gửi Thầy Báo cáo tiến độ Tuần 01 của nhóm:

1. Báo cáo kết quả thực hiện được của cả 3 thành viên:
   - Ngô Võ Tuấn An: Kiến trúc nền tảng Clean Architecture .NET 10, Multi-tenant Isolation, Auth JWT/Refresh Token Rotation, RBAC Bitmask, Seeder và CI/CD (26 files mã nguồn).
   - Nguyễn Khởi Nguyên: Danh mục Hạng phòng & Phòng vật lý CQRS MediatR, Bảng giá, FluentValidation, WebApi Controllers và UI Catalog (23 files mã nguồn).
   - Trần Trọng Tân: Quản lý Buồng phòng FSM 5 trạng thái, Concurrency Lock 409 Conflict, Thuật toán KPI, Angular Signals Board và xUnit Tests (13 files mã nguồn).

2. Minh chứng mã nguồn đầy đủ 62 link GitHub blob trên nhánh develop:
   https://github.com/GinNgo/hotel-saas-v2/blob/develop/...

3. Bảng đối chiếu commit message khớp 100% nguyên văn lịch sử git log hiện tại trên nhánh develop:
   - 6895fc4: Merge pull request #4 from GinNgo/feature/tan-housekeeping
   - 5e39c97: feat(housekeeping): Trần Trọng Tân - implement housekeeping board and state machine (Fullstack BE FSM + FE Angular)
   - 5a9e65f: Merge pull request #3 from GinNgo/feature/nguyen/room-roomtype
   - cafb63e: [feat] full CRUD manage Room and RomType
   - c756904: docs: clean up redundant documentation and establish comprehensive agent rulebook
   - 4acf372: feat(arch): initial core architecture foundation - Clean Architecture .NET 10, Multi-tenant, Auth + RBAC, Seed Data, CI/CD

4. Khai báo sử dụng trí tuệ nhân tạo (AI Disclosure) chi tiết cho từng chức năng:
   - Bảng tổng hợp 8 cột theo quy chuẩn của Khoa CNTT.
   - Chi tiết 17 câu lệnh Prompt thực tế ứng với 17 chức năng đã xây dựng trong tuần.
   - Phân tích kết quả AI, hoạt động phản biện/sửa lỗi của sinh viên và các lỗi ảo giác (hallucination) đã khắc phục.

Các liên kết đối chiếu trên nhánh develop:
- Báo cáo chính thức nộp Tuần 1: https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-NOP-TUAN-1-VA-KHAI-BAO-AI-CHINH-THUC.md
- Báo cáo cá nhân Ngô Võ Tuấn An: https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TUAN-1-NGO-VO-TUAN-AN-24TX810001.md
- Lịch sử Git Repository: https://github.com/GinNgo/hotel-saas-v2/commits/develop

Kính nhờ Thầy xem xét và đánh giá tiến độ Tuần 01 của nhóm chúng em.

Kính chúc Thầy nhiều sức khỏe và công tác tốt!

Kính thư,
Ngô Võ Tuấn An (Nhóm trưởng)
Mã số sinh viên: 24TX810001
Email: 24tx810001@student.hcmute.edu.vn / ngovotuananh@gmail.com
```

***
*TP. Hồ Chí Minh, ngày 14 tháng 10 năm 2026*  
**XÁC NHẬN CỦA NHÓM TRƯỞNG**  
*(Đã ký)*  
**Ngô Võ Tuấn An**
