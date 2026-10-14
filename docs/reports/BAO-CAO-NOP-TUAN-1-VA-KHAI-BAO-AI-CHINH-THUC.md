# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM
***

# BÁO CÁO TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN — TUẦN 01 (CẬP NHẬT THEO YÊU CẦU GVHD)
### ĐỀ TÀI: NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS (HOTEL SAAS PLATFORM V2)

* **Mã đề tài (Topic):** 578
* **Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 1:** 03/10/2026 – 10/10/2026 (Nghiệm thu tích hợp: 12/10/2026 - 14/10/2026)
* **Kho mã nguồn GitHub chính thức:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh kiểm tra:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop) & [`main`](https://github.com/GinNgo/hotel-saas-v2/tree/main)

---

## DANH SÁCH THÀNH VIÊN NHÓM THỰC HIỆN

| STT | Họ và Tên | Mã số sinh viên | Email sinh viên | Vai trò & Phân hệ đảm nhiệm Tuần 1 |
|:---:|:---|:---:|:---|:---|
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | `24tx810001@student.hcmute.edu.vn` | Nhóm trưởng: Kiến trúc nền tảng, Multi-tenant Isolation, Auth JWT + RBAC Bitmask, Seed Data, Exception Handler, CI/CD |
| 2 | **Nguyễn Khởi Nguyên** | `24TX810011` | `24tx810011@student.hcmute.edu.vn` | Thành viên: Trưởng phân hệ Danh mục Phòng & Hạng phòng (Room & RoomType Catalog CQRS, Tiện nghi phòng, Gallery Service, FluentValidation, Bộ lọc phân trang & UI Angular Catalog) |
| 3 | **Trần Trọng Tân** | `24TX810025` | `24tx810025@student.hcmute.edu.vn` | Thành viên: Trưởng phân hệ Điều phối Buồng phòng (Housekeeping FSM State Machine 5 trạng thái, Concurrency Lock chống xung đột 409, KPI buồng phòng, UI Angular Signals Board & Unit Tests FSM) |

---

## PHẦN I. NỘI DUNG CẬP NHẬT THEO 3 YÊU CẦU CỦA GIẢNG VIÊN HƯỚNG DẪN

Báo cáo này được cập nhật nhằm đáp ứng đầy đủ 3 nội dung yêu cầu của ThS. Phùng Hữu Xuân:

| STT | Yêu cầu của Giảng viên hướng dẫn | Nội dung cập nhật trong báo cáo | Vị trí đối chiếu |
|:---:|:---|:---|:---|
| **1** | Bổ sung link file (blob) cụ thể thể hiện code đã viết | Cung cấp đầy đủ **62 liên kết trực tiếp (blob)** dẫn đến từng file mã nguồn cụ thể của 3 thành viên trên nhánh `develop`. | **Phần II** của tài liệu này |
| **2** | Commit message khớp đúng nội dung mô tả trong báo cáo | Cung cấp bảng đối chiếu khớp **100% từng ký tự** theo chuẩn `git log --pretty=format:"%h - %s"` của kho lưu trữ. | **Phần III** của tài liệu này |
| **3** | Khai báo sử dụng trí tuệ nhân tạo (AI Disclosure) rõ ràng | Trình bày đầy đủ **Bảng khai báo AI 8 cột** cùng **toàn bộ 4 câu lệnh Prompt thực tế**, kết quả AI sinh ra, hành động phản biện/sửa lỗi của sinh viên và phân tích lỗi ảo giác (hallucination). | **Phần IV** của tài liệu này |

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
21. HTTP Interceptor đính kèm Token & TenantId: [`auth.interceptor.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/interceptors/jwt.interceptor.ts)
22. Guard bảo vệ định tuyến RBAC: [`auth.guard.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/guards/auth.guard.ts)
23. Trang Giao diện Đăng nhập: [`login.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/auth/login/login.page.ts)
24. Template HTML Đăng nhập với Quick Fill: [`login.page.html`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/auth/login/login.page.html)
25. Trang Bảng điều khiển Quản trị: [`dashboard.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/dashboard/dashboard.page.ts)
26. Template HTML Bảng điều khiển: [`dashboard.page.html`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/dashboard/dashboard.page.html)

---

### 2. Nguyễn Khởi Nguyên (MSSV: `24TX810011` — Phân hệ Danh mục Phòng & Hạng phòng)
*Phân hệ đảm nhiệm: Quản lý danh mục Hạng phòng (RoomType) và Phòng vật lý (Room) theo mẫu thiết kế CQRS + MediatR, bộ lọc phòng nâng cao, giao diện Angular Catalog.*

1. Domain Hạng phòng: [`RoomType.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RoomType.cs)
2. Domain Phòng vật lý: [`Room.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Room.cs)
3. Command Tạo Hạng phòng: [`CreateRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommand.cs)
4. Validator Tạo Hạng phòng: [`CreateRoomTypeCommandValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommandValidator.cs)
5. Command Cập nhật Hạng phòng: [`UpdateRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/UpdateRoomType/UpdateRoomTypeCommand.cs)
6. Command Xóa Hạng phòng: [`DeleteRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/DeleteRoomType/DeleteRoomTypeCommand.cs)
7. Query Lấy danh sách Hạng phòng: [`GetRoomTypesQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Queries/GetRoomTypes/GetRoomTypesQuery.cs)
8. Query Lấy chi tiết Hạng phòng: [`GetRoomTypeByIdQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Queries/GetRoomTypeById/GetRoomTypeByIdQuery.cs)
9. DTO Hạng phòng: [`RoomTypeDto.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Common/RoomTypeDto.cs)
10. Command Tạo Phòng: [`CreateRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommand.cs)
11. Validator Tạo Phòng (chống trùng số phòng): [`CreateRoomCommandValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommandValidator.cs)
12. Command Cập nhật Phòng: [`UpdateRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoom/UpdateRoomCommand.cs)
13. Command Xóa Phòng (kiểm tra đơn đặt phòng): [`DeleteRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/DeleteRoom/DeleteRoomCommand.cs)
14. Query Lấy danh sách Phòng theo tầng/trạng thái: [`GetRoomsQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Queries/GetRooms/GetRoomsQuery.cs)
15. DTO Phòng: [`RoomDto.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Common/RoomDto.cs)
16. WebApi Hạng phòng: [`RoomTypesController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs)
17. WebApi Phòng vật lý: [`RoomsController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs)
18. Angular Service Quản lý Hạng phòng: [`room-type.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/room-type.service.ts)
19. Angular Service Quản lý Phòng: [`room.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/room.service.ts)
20. Component Giao diện Danh mục Hạng phòng: [`room-types.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/room-types/room-types.page.ts)
21. Component Giao diện Danh sách Phòng: [`rooms.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/rooms/rooms.page.ts)
22. Tiện ích Lọc Hạng phòng: [`room-types-filter.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/room-types-filter.util.ts)
23. Tiện ích Kiểm tra Số phòng: [`rooms-validation.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/rooms-validation.util.ts)

---

### 3. Trần Trọng Tân (MSSV: `24TX810025` — Phân hệ Điều phối Buồng phòng)
*Phân hệ đảm nhiệm: Máy trạng thái hữu hạn buồng phòng (FSM), Concurrency Lock `expectedOldStatus` chống lỗi 409 xung đột đa nhân viên, giao diện Housekeeping Board bằng Angular Signals, KPI buồng phòng.*

1. Domain Nhiệm vụ Buồng phòng: [`HousekeepingTask.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/HousekeepingTask.cs)
2. Domain Enum Trạng thái Phòng: [`RoomStatus.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/RoomStatus.cs)
3. Domain Enum Mức độ ưu tiên dọn dẹp: [`HousekeepingPriority.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/HousekeepingPriority.cs)
4. Domain Enum Trạng thái nhiệm vụ dọn: [`HousekeepingTaskStatus.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/HousekeepingTaskStatus.cs)
5. Bộ thẩm định Máy trạng thái FSM: [`RoomStatusTransitionValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs)
6. Command Cập nhật Trạng thái Phòng kèm Concurrency Lock: [`UpdateRoomStatusCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommand.cs)
7. Request Model WebApi Cập nhật Trạng thái: [`UpdateRoomStatusRequest.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Models/UpdateRoomStatusRequest.cs)
8. WebApi Buồng phòng: [`HousekeepingController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/HousekeepingController.cs)
9. Xử lý Concurrency Phía Client: [`housekeeping-concurrency.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-concurrency.util.ts)
10. Tiện ích Tính toán KPI Buồng phòng: [`housekeeping-kpi.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-kpi.util.ts)
11. Angular Service Buồng phòng: [`housekeeping.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/housekeeping.service.ts)
12. Giao diện Housekeeping Board (Angular Signals): [`housekeeping.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/housekeeping/housekeeping.page.ts)
13. Bộ Unit Tests Kiểm thử FSM Buồng phòng: [`RoomStatusTransitionValidatorTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Rooms/RoomStatusTransitionValidatorTests.cs)

---

## PHẦN III. BẢNG ĐỐI CHIẾU COMMIT MESSAGE NGUYÊN VĂN THEO GIT LOG (VERBATIM)

Bảng trích xuất nguyên văn 100% từ lệnh `git log --pretty=format:"%h | %an | %ad | %s"` trên kho GitHub của dự án:

| Commit Hash | Tác Giả | Ngày Thực Hiện | Commit Message Khớp Nguyên Văn Git Log | Nội Dung Nghiệp Vụ Bàn Giao Cụ Thể |
|:---:|:---|:---:|:---|:---|
| [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) | Tuan An | 03/10/2026 | `feat: Phase 0 complete - docs, scaffold, entities, rules` | Khởi tạo cấu trúc Clean Architecture 4 tầng .NET 10, cấu hình Docker Compose Postgres/Redis, viết bộ tài liệu SRS 01-08 và SDD 01-10. |
| [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) | Tuan An | 04/10/2026 | `feat(auth): implement Auth + RBAC - Phase 1A complete` | Triển khai Auth JWT, Refresh Token xoay vòng (Token Rotation), Interceptor Multi-tenant và bộ 45 unit tests. |
| [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) | Tuan An | 12/10/2026 | `feat: Phase 1 complete - architecture foundation, auth & RBAC, team roadmaps, week 1 reports, and feature scaffolds` | Tích hợp hoàn thiện Phase 1, bộ nạp dữ liệu mẫu `LocalDevDataSeeder`, tích hợp mã nguồn CRUD Room/RoomType của Khởi Nguyên. |
| [`a6aca5d`](https://github.com/GinNgo/hotel-saas-v2/commit/a6aca5d) | nguyencd | 13/10/2026 | `[feat] update dependency package json` | Cập nhật cấu hình phụ thuộc thư viện cho nhánh cá nhân `feature/nguyen-rooms` của Nguyễn Khởi Nguyên. |
| [`cf80854`](https://github.com/GinNgo/hotel-saas-v2/commit/cf80854) | nguyencd | 13/10/2026 | `[feat] add entity Room` | Bổ sung thực thể Phòng và Hạng phòng, các trường số phòng, tầng và ràng buộc. |
| [`7ae0136`](https://github.com/GinNgo/hotel-saas-v2/commit/7ae0136) | nguyencd | 13/10/2026 | `[feat] add core room utils` | Bổ sung các bộ tiện ích lọc phòng, định dạng giá và kiểm tra hợp lệ số phòng. |
| [`519b46a`](https://github.com/GinNgo/hotel-saas-v2/commit/519b46a) | nguyencd | 13/10/2026 | `[feat] add doc weak 1` | Đẩy tài liệu tổng kết tiến độ tuần 1 của cá nhân lên nhánh `feature/nguyen-rooms`. |
| [`9bb9fdd`](https://github.com/GinNgo/hotel-saas-v2/commit/9bb9fdd) | Tuan An | 14/10/2026 | `merge(rooms): integrate origin/feature/nguyen-rooms into develop with 0 build errors` | Hợp nhất toàn bộ nhánh cá nhân của Nguyễn Khởi Nguyên vào `develop` và `main` sau khi kiểm tra biên dịch 0 lỗi. |
| [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) | Tan | 12/10/2026 | `feat(housekeeping): Trần Trọng Tân - implement housekeeping board and state machine (Fullstack BE FSM + FE Angular)` | Hiện thực FSM buồng phòng Backend, Concurrency Lock `expectedOldStatus`, và trang `housekeeping.page.ts` trên nhánh `feature/tan-housekeeping`. |
| [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43) | Tuan An | 14/10/2026 | `merge(housekeeping): integrate feature/tan-housekeeping into develop with 0 build errors` | Hợp nhất phân hệ buồng phòng của Trần Trọng Tân vào `develop` và `main`, kiểm thử tích hợp liên thông 0 lỗi. |
| [`34e3f31`](https://github.com/GinNgo/hotel-saas-v2/commit/34e3f31) | Tuan An | 13/10/2026 | `chore(docs): clean up redundant docs and update official week 1 reports and ai usage log` | Tinh gọn tài liệu trùng lặp, chuẩn hóa định dạng báo cáo và nhật ký AI Log. |
| [`1811985`](https://github.com/GinNgo/hotel-saas-v2/commit/1811985) | Tuan An | 14/10/2026 | `docs(reports): comprehensive update of week 1 individual and group reports with blob links and ai disclosure` | Cập nhật toàn bộ link blob mã nguồn, bảng đối chiếu commit verbatim và khai báo AI 8 cột theo yêu cầu của Thầy Phùng Hữu Xuân. |

---

## PHẦN IV. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE & AUDIT LOG)

Bảng khai báo chi tiết việc sử dụng AI trong quá trình thực hiện Tuần 1 theo 8 cột chuẩn mực:

### 1. Bảng Tổng Hợp Khai Báo Sử Dụng AI (Chuẩn 8 Cột)

| Lần | Thành Viên & MSSV | Công Cụ AI | Phạm Vi Công Việc | Prompt Chính Đã Sử Dụng | Kết Quả AI Đã Sinh Ra | Sinh Viên Kiểm Tra, Phản Biện & Sửa Chữa | Lỗi Ảo Giác (Hallucination) Đã Khắc Phục | Commit Đối Chiếu |
|:---:|:---|:---|:---|:---|:---|:---|:---|:---:|
| **#001** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity / Claude 3.5 | Khởi tạo Solution Clean Architecture .NET 10, Docker Postgres/Redis, dàn bài SRS/SDD | *"Tôi đang dựng backend .NET 10 theo Clean Architecture cho đồ án SaaS quản lý khách sạn đa chi nhánh. Nhờ bạn gợi ý cấu trúc solution 4 tầng Domain, Application, Infrastructure, WebApi. Tích hợp EF Core với PostgreSQL 17, MediatR, FluentValidation và viết file docker-compose chạy Postgres với Redis. Sau đó gợi ý mục lục SRS, SDD chuẩn học thuật."* | AI sinh khung thư mục `.sln`, `.csproj`, `docker-compose.yml` và dàn bài tài liệu. Cú pháp MediatR bị dùng theo phiên bản cũ. | Sinh viên kiểm tra, sửa cú pháp đăng ký MediatR sang chuẩn .NET 10 mới `AddMediatR(cfg => cfg.RegisterServicesFromAssembly(...))`. Chỉnh connection string Docker trên Windows. Build đạt 0 lỗi. | AI sinh cú pháp MediatR cũ lỗi thời $\to$ Sinh viên tra cứu tài liệu mới và sửa lại. | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) |
| **#002** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity | Module Auth JWT, Refresh Token xoay vòng, SaveChangesInterceptor Multi-tenant | *"Hãy viết giúp tôi module Authentication bằng JWT có cơ chế Refresh Token xoay vòng (Token Rotation) để chống Replay Attack trong .NET 10. Đồng thời tạo giúp tôi EF Core Interceptor tự động lấy TenantId và PropertyId từ request header gắn vào entity khi thêm mới, ngăn không cho người dùng sửa hoặc đọc chéo dữ liệu của khách sạn khác."* | AI sinh controller login, cấp token và Interceptor. Code cơ bản chạy được nhưng thiếu kiểm tra tenant bị khóa và thiếu unit tests. | Sinh viên phát hiện AI bỏ sót điều kiện kiểm tra Tenant đang hoạt động (`IsActive == true`). Sinh viên tự viết logic kiểm tra kích hoạt tài khoản và viết 45 unit tests kiểm thử hành vi xoay vòng token. | AI quên gán `TenantId` trong một số trường hợp tạo entity mới $\to$ Sinh viên bổ sung logic inject `ICurrentTenantService`. | [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) |
| **#003** | Nguyễn Khởi Nguyên (`24TX810011`) | GitHub Copilot & ChatGPT Plus | CRUD RoomType và Room theo CQRS, xây dựng UI Angular Catalog | *"Mình đang làm tính năng quản lý danh mục Loại phòng (RoomType) và Phòng (Room) cho khách sạn bằng C# .NET 10. Bạn viết giúp mình các Command và Query MediatR để thêm, sửa, xóa, lấy danh sách có phân trang và lọc theo tầng. Lưu ý số phòng không được trùng nhau trong cùng một khách sạn và không cho xóa loại phòng nếu đang có phòng trực thuộc."* | AI sinh đầy đủ Command, Query, Handler, Validator và service Angular. Nhưng phần xóa AI viết xóa cứng (hard delete) trực tiếp vào DB, không kiểm tra đơn đặt phòng. | Sinh viên kiểm tra nghiệp vụ và sửa lại: thay vì xóa cứng, phải kiểm tra ràng buộc với lịch sử đặt phòng (Reservation). Ở Frontend, sinh viên tự tay viết lại toàn bộ sang Angular Standalone Component dùng Signals. | AI sinh logic xóa cứng (Hard Delete) làm mất lịch sử đặt phòng $\to$ Sinh viên sửa thành kiểm tra ràng buộc khóa ngoại trước khi xóa. | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) |
| **#004** | Trần Trọng Tân (`24TX810025`) | Google Antigravity & Claude 3.5 | Máy trạng thái FSM buồng phòng, Concurrency Lock `expectedOldStatus`, Housekeeping Board | *"Mình cần làm màn hình quản lý buồng phòng (Housekeeping) cho khách sạn. Khách sạn có 5 trạng thái phòng: Sạch, Bẩn, Đang dọn, Có khách và Hỏng/Bảo trì. Bạn viết giúp mình API đổi trạng thái phòng có kiểm tra luồng chuyển đổi hợp lệ và tránh trường hợp 2 nhân viên cùng bấm đổi trạng thái một lúc. Phía giao diện Angular hiển thị các thẻ phòng theo từng tầng và đổi màu theo trạng thái."* | AI đề xuất `RoomStatusTransitionValidator` và gợi ý gửi kèm `expectedOldStatus` lên API PATCH. Phía Angular AI sinh giao diện danh sách có nút bấm đổi trạng thái nhưng dùng thư viện bên ngoài. | Khi dò lại ma trận trạng thái, sinh viên thấy AI bỏ sót trường hợp: phòng bảo dưỡng xong (`OutOfService`) chuyển về lại phòng sạch (`Clean`), nên sinh viên tự thêm rule này vào validator. Ở Angular, sinh viên viết lại bằng Angular Signals thuần và thêm cơ chế khóa nút bấm khi đang gọi API. | AI bỏ sót bước chuyển trạng thái từ Bảo trì (`OutOfService`) về Phòng sạch (`Clean`) $\to$ Sinh viên bổ sung đầy đủ luật chuyển đổi. | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) / [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43) |

---

### 2. Chi Tiết Từng Lượt Sử Dụng AI & Phân Tích Kỹ Thuật

#### 📌 LƯỢT 1 (ENTRY #001) — Ngô Võ Tuấn An (`24TX810001`)
* **Ngày thực hiện:** 03/10/2026
* **Công cụ sử dụng:** Google Antigravity / Claude 3.5 Sonnet & GPT-4o
* **Phạm vi công việc:** Scaffold đồ án Clean Architecture .NET 10, Docker Postgres 17, Redis 7, tài liệu SRS/SDD.
* **Câu Prompt thực tế:**
  ```text
  "Tôi đang dựng backend .NET 10 theo Clean Architecture cho đồ án SaaS quản lý khách sạn đa chi nhánh. Nhờ bạn gợi ý cấu trúc solution 4 tầng Domain, Application, Infrastructure, WebApi. Tích hợp EF Core với PostgreSQL 17, MediatR, FluentValidation và viết giúp file docker-compose chạy Postgres với Redis. Sau đó gợi ý cấu trúc thư mục tài liệu SRS, SDD chuẩn học thuật."
  ```
* **Kết quả do AI sinh ra:**
  AI đề xuất sơ đồ 4 project trong solution, cấu hình port `5432:5432` cho PostgreSQL, và tạo code đăng ký MediatR dạng cũ `services.AddMediatR(typeof(Program));`.
* **Phản biện, đánh giá và khắc phục lỗi ảo giác (Hallucination):**
  1. *Lỗi cú pháp thư viện:* Trên .NET 10 và MediatR v12+, hàm `AddMediatR` kiểu cũ gây lỗi build. Sinh viên đã tự tra cứu tài liệu mới và sửa lại thành:
     ```csharp
     services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));
     ```
  2. *Docker xung đột cổng trên Windows:* Cổng mặc định 5432 dễ đụng độ với service Postgres cài sẵn trên máy. Sinh viên đã sửa thành ánh xạ cổng linh hoạt và viết hướng dẫn chạy môi trường.
* **Minh chứng Commit:** [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99)

---

#### 📌 LƯỢT 2 (ENTRY #002) — Ngô Võ Tuấn An (`24TX810001`)
* **Ngày thực hiện:** 04/10/2026
* **Công cụ sử dụng:** Google Antigravity
* **Phạm vi công việc:** Authentication JWT, Refresh Token xoay vòng (Token Rotation), Interceptor bảo mật dữ liệu khách thuê (Multi-tenant).
* **Câu Prompt thực tế:**
  ```text
  "Hãy viết giúp tôi module Authentication bằng JWT có cơ chế Refresh Token xoay vòng (Token Rotation) để chống Replay Attack trong .NET 10. Đồng thời tạo giúp tôi EF Core Interceptor tự động lấy TenantId và PropertyId từ request header gắn vào entity khi thêm mới, ngăn không cho người dùng sửa hoặc đọc chéo dữ liệu của khách sạn khác."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh ra `AuthController.cs`, class `JwtService.cs` và `TenantPropertySaveChangesInterceptor.cs`. Logic cấp mới refresh token cơ bản đã xoay vòng được mã hash trong DB.
* **Phản biện, đánh giá và khắc phục lỗi ảo giác (Hallucination):**
  1. *Lỗ hổng nghiệp vụ SaaS:* AI không kiểm tra điều kiện Tenant hoặc Chi nhánh có đang bị khóa (`IsActive == false`) hay không khi người dùng gọi endpoint refresh token. Sinh viên đã phát hiện và bổ sung điều kiện kiểm tra tài khoản hoạt động trước khi cấp phát token mới.
  2. *Lỗi thiếu gán TenantId tự động:* Trong trường hợp entity mới không được gán thủ công, AI để mặc định khiến phát sinh ngoại lệ cơ sở dữ liệu. Sinh viên đã viết interceptor tự động inject `ICurrentTenantService` vào tất cả các thực thể kế thừa `BaseEntity`.
  3. *Kiểm thử độc lập:* Sinh viên tự tay viết 45 unit tests kiểm thử chuỗi hành vi xoay vòng token, xác nhận chặn đứng các token giả mạo hoặc đã bị thu hồi.
* **Minh chứng Commit:** [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339)

---

#### 📌 LƯỢT 3 (ENTRY #003) — Nguyễn Khởi Nguyên (`24TX810011`)
* **Ngày thực hiện:** 06/10/2026 – 08/10/2026
* **Công cụ sử dụng:** GitHub Copilot & ChatGPT Plus
* **Phạm vi công việc:** Phân hệ Danh mục Phòng & Hạng phòng (Room & RoomType CRUD CQRS), UI Catalog.
* **Câu Prompt thực tế:**
  ```text
  "Mình đang làm tính năng quản lý danh mục Loại phòng (RoomType) và Phòng (Room) cho khách sạn bằng C# .NET 10. Bạn viết giúp mình các Command và Query MediatR để thêm, sửa, xóa, lấy danh sách có phân trang và lọc theo tầng. Lưu ý số phòng không được trùng nhau trong cùng một khách sạn và không cho xóa loại phòng nếu đang có phòng trực thuộc."
  ```
* **Kết quả do AI sinh ra:**
  AI sinh ra các lớp `CreateRoomCommand`, `DeleteRoomCommand`, FluentValidation validators và Angular service. Tuy nhiên ở lệnh xóa, AI viết code xóa cứng (`context.Rooms.Remove(room)`).
* **Phản biện, đánh giá và khắc phục lỗi ảo giác (Hallucination):**
  1. *Lỗi xóa cứng (Hard Delete):* Trong quản lý khách sạn, xóa cứng phòng sẽ phá vỡ toàn vẹn dữ liệu của các đơn đặt phòng (Reservation) trong quá khứ hoặc tương lai. Sinh viên đã sửa lại thành: kiểm tra ràng buộc khóa ngoại với đơn đặt phòng, nếu phòng đã có lịch sử thì không cho phép xóa và trả về thông báo lỗi rõ ràng.
  2. *Tái cấu trúc Frontend:* AI đề xuất dùng NgModule kiểu cũ. Sinh viên đã tự tay viết lại toàn bộ sang Angular 22 Standalone Components sử dụng Signal (`signal()`, `computed()`) giúp tăng hiệu năng render danh sách phòng theo tầng.
* **Minh chứng Commit:** [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd)

---

#### 📌 LƯỢT 4 (ENTRY #004) — Trần Trọng Tân (`24TX810025`)
* **Ngày thực hiện:** 09/10/2026 – 12/10/2026
* **Công cụ sử dụng:** Google Antigravity & Claude 3.5 Sonnet
* **Phạm vi công việc:** Máy trạng thái hữu hạn buồng phòng (FSM), Khóa lạc quan chống xung đột (Concurrency Lock), Giao diện Housekeeping Board.
* **Câu Prompt thực tế:**
  ```text
  "Mình cần làm màn hình quản lý buồng phòng (Housekeeping) cho khách sạn. Khách sạn có 5 trạng thái phòng: Sạch, Bẩn, Đang dọn, Có khách và Hỏng/Bảo trì. Bạn viết giúp mình API đổi trạng thái phòng có kiểm tra luồng chuyển đổi hợp lệ và tránh trường hợp 2 nhân viên cùng bấm đổi trạng thái một lúc. Phía giao diện Angular hiển thị các thẻ phòng theo từng tầng và đổi màu theo trạng thái."
  ```
* **Kết quả do AI sinh ra:**
  AI gợi ý viết lớp `RoomStatusTransitionValidator` và cơ chế gửi `expectedOldStatus` lên server để so khớp trạng thái cũ. Phía Angular AI sinh giao diện danh sách dùng thư viện state bên ngoài.
* **Phản biện, đánh giá và khắc phục lỗi ảo giác (Hallucination):**
  1. *Bỏ sót luồng chuyển đổi trạng thái quan trọng:* Trong ma trận chuyển đổi, AI bỏ sót trường hợp phòng sau khi kết thúc bảo trì (`OutOfService`) được chuyển về phòng sạch (`Clean`) để tiếp tục đón khách. Sinh viên đã tự tay bổ sung luật này vào validator.
  2. *Tối ưu hóa UI:* Sinh viên loại bỏ thư viện ngoài, tự viết trang `housekeeping.page.ts` bằng Angular Signals thuần túy, bổ sung cơ chế khóa nút bấm khi request đang xử lý để tránh nhân viên click đúp làm phát sinh lỗi xung đột. Sinh viên cũng viết thêm file `housekeeping-kpi.util.ts` để tính tỷ lệ phòng sạch thời gian thực.
* **Minh chứng Commit:** [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) / [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43)

---

## PHẦN V. TỔNG HỢP LIÊN KẾT CÁC BÁO CÁO TRÊN GITHUB REPOSITORY

Các liên kết xem chi tiết trên nhánh `develop`:

1. 📄 [**Báo Cáo Tổng Hợp Tuần 1 — Toàn Nhóm HCMUTE**](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TONG-HOP-TUAN-1-NHOM-HCMUTE.md)
2. 👤 [**Báo Cáo Cá Nhân Tuần 1 — Ngô Võ Tuấn An (`24TX810001`)**](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TUAN-1-NGO-VO-TUAN-AN-24TX810001.md)
3. 👤 [**Báo Cáo Cá Nhân Tuần 1 — Nguyễn Khởi Nguyên (`24TX810011`)**](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TUAN-1-NGUYEN-KHOI-NGUYEN-24TX810011.md)
4. 👤 [**Báo Cáo Cá Nhân Tuần 1 — Trần Trọng Tân (`24TX810025`)**](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TUAN-1-TRAN-TRONG-TAN-24TX810025.md)
5. 📋 [**Sổ Theo Dõi Tiến Độ Hằng Tuần — Week 01**](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/weekly-reports/week-01.md)
6. 🤖 [**Nhật Ký Sử Dụng AI Toàn Diện — AI Usage Log**](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/ai-usage-log/ai-usage-log.md)

---

## PHẦN VI. NỘI DUNG NỘP BÁO CÁO CHO GIẢNG VIÊN HƯỚNG DẪN

```text
Kính gửi ThS. Phùng Hữu Xuân,

Nhóm sinh viên thực hiện đề tài Topic 578: "Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh Theo Mô Hình SaaS" xin gửi Thầy Báo cáo tiến độ Tuần 01 đã được cập nhật đầy đủ theo 3 yêu cầu của Thầy:

1. Bổ sung đầy đủ 62 link file blob cụ thể thể hiện mã nguồn đã viết trên GitHub nhánh develop (26 file của Ngô Võ Tuấn An, 23 file của Nguyễn Khởi Nguyên, 13 file của Trần Trọng Tân).
2. Chuẩn hóa bảng đối chiếu commit message khớp 100% nguyên văn theo lịch sử git log của kho lưu trữ.
3. Bổ sung mục Khai báo sử dụng trí tuệ nhân tạo (AI Disclosure) chi tiết gồm nguyên văn 4 câu lệnh prompt thực tế, kết quả do AI sinh ra, quá trình sinh viên kiểm tra, phản biện, sửa chữa và phân tích các lỗi ảo giác (hallucination) đã được khắc phục.

Các liên kết đối chiếu trên nhánh develop:
- Báo cáo tổng hợp nhóm: https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TONG-HOP-TUAN-1-NHOM-HCMUTE.md
- Báo cáo cá nhân Ngô Võ Tuấn An: https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TUAN-1-NGO-VO-TUAN-AN-24TX810001.md
- Báo cáo cá nhân Nguyễn Khởi Nguyên: https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TUAN-1-NGUYEN-KHOI-NGUYEN-24TX810011.md
- Báo cáo cá nhân Trần Trọng Tân: https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/reports/BAO-CAO-TUAN-1-TRAN-TRONG-TAN-24TX810025.md
- Sổ theo dõi tiến độ tuần 1: https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/weekly-reports/week-01.md
- Nhật ký sử dụng AI chi tiết: https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/ai-usage-log/ai-usage-log.md

Kính nhờ Thầy xem xét và xét duyệt Báo cáo Tuần 01 của nhóm.

Kính thư,
Ngô Võ Tuấn An (Nhóm trưởng)
Mã số sinh viên: 24TX810001
Email: ngovotuananh@gmail.com
```

***
*TP. Hồ Chí Minh, ngày 14 tháng 10 năm 2026*  
**XÁC NHẬN CỦA NHÓM TRƯỞNG**  
*(Đã ký)*  
**Ngô Võ Tuấn An**
