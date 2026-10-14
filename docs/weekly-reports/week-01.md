# 📋 Sổ theo dõi tiến độ hằng tuần — Tuần 01

> **Rubric mapping:** Quy trình Bước 3 (báo cáo ≥1 lần/tuần), TC2.4 Mức 5 (Quản lý dự án, Git Workflow chuẩn mực).  
> **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)  
> **Nhánh tích hợp:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop) & [`main`](https://github.com/GinNgo/hotel-saas-v2/tree/main)

---

```
╔══════════════════════════════════════════════════════════════╗
║              BÁO CÁO TIẾN ĐỘ TUẦN 01 (PHASE 0 & 1)           ║
╠══════════════════════════════════════════════════════════════╣
║ Đề tài: Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh (Hotel SaaS) ║
║ Nhóm:   Nhóm Đồ Án 578 — Khoa CNTT — HCMUTE                  ║
║ Tuần:   03/10/2026 → 10/10/2026 (Tích hợp: 12/10/2026)      ║
║ GVHD:   ThS. Phùng Hữu Xuân (phunghx@hcmute.edu.vn)          ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 1. Công việc đã hoàn thành trong Tuần 1

| # | Hạng Mục / Nhiệm Vụ | Người Thực Hiện | Trạng Thái | Minh Chứng Commit Git (Verbatim) | Minh Chứng File Mã Nguồn (GitHub Blob Link) |
|:---:|:---|:---|:---:|:---|:---|
| 1 | Lập kế hoạch kiến trúc Clean Architecture .NET 10 | Ngô Võ Tuấn An | ✅ Done | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) - `feat: Phase 0 complete - docs, scaffold, entities, rules` | [`Domain/`](https://github.com/GinNgo/hotel-saas-v2/tree/develop/backend/src/HotelSaas.Domain), [`Application/`](https://github.com/GinNgo/hotel-saas-v2/tree/develop/backend/src/HotelSaas.Application) |
| 2 | Soạn thảo 8 tài liệu SRS (Market Research, Personas, Stories, BPMN...) | Ngô Võ Tuấn An | ✅ Done | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) - `feat: Phase 0 complete - docs, scaffold, entities, rules` | [`docs/srs/`](https://github.com/GinNgo/hotel-saas-v2/tree/develop/docs/srs) |
| 3 | Soạn thảo 10 tài liệu SDD (ERD, C4, Sequence, RBAC, API, Docker...) | Ngô Võ Tuấn An | ✅ Done | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) - `feat: Phase 0 complete - docs, scaffold, entities, rules` | [`docs/sdd/`](https://github.com/GinNgo/hotel-saas-v2/tree/develop/docs/sdd) |
| 4 | Cấu hình Docker Compose (PostgreSQL 17, Redis, pgAdmin) | Ngô Võ Tuấn An | ✅ Done | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) - `feat: Phase 0 complete - docs, scaffold, entities, rules` | [`docker-compose.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docker-compose.yml) |
| 5 | Thiết lập GitHub Actions CI/CD Pipeline 6 giai đoạn | Ngô Võ Tuấn An | ✅ Done | [`a06ac31`](https://github.com/GinNgo/hotel-saas-v2/commit/a06ac31) - `ci: add GitHub Actions 6-stage pipeline` | [`.github/workflows/ci.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml) |
| 6 | Định nghĩa Entity lõi: Tenant, Property, User, Staff | Ngô Võ Tuấn An | ✅ Done | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) & [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) | [`Tenant.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Tenant.cs), [`Property.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Property.cs) |
| 7 | Hiện thực Auth JWT & Refresh Token xoay vòng (Token Rotation) | Ngô Võ Tuấn An | ✅ Done | [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) - `feat(auth): implement Auth + RBAC - Phase 1A complete` | [`AuthController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs), [`JwtService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/JwtService.cs) |
| 8 | Interceptor kiểm soát Multi-tenant cách ly dữ liệu | Ngô Võ Tuấn An | ✅ Done | [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) - `feat(auth): implement Auth + RBAC - Phase 1A complete` | [`TenantPropertySaveChangesInterceptor.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/TenantPropertySaveChangesInterceptor.cs) |
| 9 | Phân quyền Bitmask RBAC & Middleware phân giải chi nhánh | Ngô Võ Tuấn An | ✅ Done | [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) - `feat(auth): implement Auth + RBAC - Phase 1A complete` | [`TenantPropertyContextMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs) |
| 10 | Bộ nạp dữ liệu mẫu Idempotent (LocalDevDataSeeder) | Ngô Võ Tuấn An | ✅ Done | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) - `feat: Phase 1 complete...` | [`LocalDevDataSeeder.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs) |
| 11 | Giao diện Đăng nhập đa chi nhánh & Quick Fill tài khoản | Ngô Võ Tuấn An | ✅ Done | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) - `feat: Phase 1 complete...` | [`login.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/auth/login/login.page.ts) |
| 12 | Dashboard KPI & Thanh trạng thái buồng phòng | Ngô Võ Tuấn An | ✅ Done | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) - `feat: Phase 1 complete...` | [`dashboard.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/dashboard/dashboard.page.ts) |
| 13 | Thực thể nghiệp vụ Room & RoomType | Nguyễn Khởi Nguyên | ✅ Done | [`cf80854`](https://github.com/GinNgo/hotel-saas-v2/commit/cf80854) - `[feat] add entity Room` & [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) | [`Room.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Room.cs), [`RoomType.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RoomType.cs) |
| 14 | CQRS Commands & Handlers thêm/sửa/xóa RoomType | Nguyễn Khởi Nguyên | ✅ Done | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) - `feat: Phase 1 complete...` | [`CreateRoomTypeCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommand.cs) |
| 15 | CQRS Commands & Handlers thêm/sửa/xóa Room vật lý | Nguyễn Khởi Nguyên | ✅ Done | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) - `feat: Phase 1 complete...` | [`CreateRoomCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommand.cs) |
| 16 | Bộ lọc nâng cao & phân trang danh sách phòng theo tầng | Nguyễn Khởi Nguyên | ✅ Done | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) - `feat: Phase 1 complete...` | [`GetRoomsQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Queries/GetRooms/GetRoomsQuery.cs) |
| 17 | RESTful API Controllers cho Room và RoomType | Nguyễn Khởi Nguyên | ✅ Done | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) - `feat: Phase 1 complete...` | [`RoomsController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs) |
| 18 | Frontend UI quản trị Hạng phòng & Phòng vật lý | Nguyễn Khởi Nguyên | ✅ Done | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) & [`a6aca5d`](https://github.com/GinNgo/hotel-saas-v2/commit/a6aca5d) | [`room-types.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/room-types/room-types.page.ts), [`rooms.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/rooms/rooms.page.ts) |
| 19 | Tiện ích kiểm tra hợp lệ phòng & bộ lọc phân loại phòng | Nguyễn Khởi Nguyên | ✅ Done | [`7ae0136`](https://github.com/GinNgo/hotel-saas-v2/commit/7ae0136) - `[feat] add core room utils` & [`9bb9fdd`](https://github.com/GinNgo/hotel-saas-v2/commit/9bb9fdd) | [`rooms-validation.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/rooms-validation.util.ts), [`room-types-filter.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/room-types-filter.util.ts) |
| 20 | Máy trạng thái FSM buồng phòng (RoomStatus State Machine) | Trần Trọng Tân | ✅ Done | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) - `feat(housekeeping): Trần Trọng Tân...` | [`RoomStatusTransitionValidator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs) |
| 21 | Command cập nhật trạng thái phòng kèm Concurrency Lock | Trần Trọng Tân | ✅ Done | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) - `feat(housekeeping): Trần Trọng Tân...` | [`UpdateRoomStatusCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommand.cs) |
| 22 | Endpoint PATCH `/api/rooms/{id}/status` | Trần Trọng Tân | ✅ Done | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) - `feat(housekeeping): Trần Trọng Tân...` | [`RoomsController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs) |
| 23 | Tiện ích xử lý lỗi HTTP 409 Concurrency phía Client | Trần Trọng Tân | ✅ Done | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) & [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43) | [`housekeeping-concurrency.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-concurrency.util.ts) |
| 24 | Tiện ích tính toán chỉ số KPI Buồng phòng (% Clean) | Trần Trọng Tân | ✅ Done | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) & [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43) | [`housekeeping-kpi.util.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/utils/housekeeping-kpi.util.ts) |
| 25 | Giao diện Bảng Buồng phòng Angular Signals (Housekeeping Board) | Trần Trọng Tân | ✅ Done | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) & [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43) | [`housekeeping.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/housekeeping/housekeeping.page.ts) |
| 26 | Unit Tests kiểm thử FSM Buồng phòng | Trần Trọng Tân | ✅ Done | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) - `feat(housekeeping): Trần Trọng Tân...` | [`RoomStatusTransitionValidatorTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Rooms/RoomStatusTransitionValidatorTests.cs) |

---

## 2. Bảng Khai Báo Sử Dụng Trí Tuệ Nhân Tạo (AI Usage Log Tuần 1)

| Lần | Thành Viên Thực Hiện | Công Cụ AI | Phạm Vi Công Việc | Prompt Chính Đã Sử Dụng | Kết Quả AI Đã Sinh Ra | Sinh Viên Kiểm Tra, Phản Biện & Sửa Chữa | Lỗi Ảo Giác (Hallucination) Đã Khắc Phục | Commit Đối Chiếu |
|:---:|:---|:---|:---|:---|:---|:---|:---|:---:|
| **#001** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity / Claude 3.5 | Khởi tạo Solution Clean Architecture .NET 10, Docker Postgres/Redis, dàn bài SRS/SDD | *"Tôi đang dựng backend .NET 10 theo Clean Architecture cho đồ án SaaS quản lý khách sạn đa chi nhánh. Nhờ bạn gợi ý cấu trúc solution 4 tầng Domain, Application, Infrastructure, WebApi. Tích hợp EF Core với PostgreSQL 17, MediatR, FluentValidation và viết file docker-compose chạy Postgres với Redis. Sau đó gợi ý mục lục SRS, SDD chuẩn học thuật."* | AI sinh khung thư mục `.sln`, `.csproj`, `docker-compose.yml` và dàn bài tài liệu. Cú pháp MediatR bị dùng theo phiên bản cũ. | Sinh viên kiểm tra, sửa cú pháp đăng ký MediatR sang chuẩn .NET 10 mới `AddMediatR(cfg => cfg.RegisterServicesFromAssembly(...))`. Chỉnh connection string Docker trên Windows. Build đạt 0 lỗi. | AI sinh cú pháp MediatR cũ lỗi thời $\to$ Sinh viên tra cứu tài liệu mới và sửa lại. | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) |
| **#002** | Ngô Võ Tuấn An (`24TX810001`) | Google Antigravity | Module Auth JWT, Refresh Token xoay vòng, SaveChangesInterceptor Multi-tenant | *"Hãy viết giúp tôi module Authentication bằng JWT có cơ chế Refresh Token xoay vòng (Token Rotation) để chống Replay Attack trong .NET 10. Đồng thời tạo giúp tôi EF Core Interceptor tự động lấy TenantId và PropertyId từ request header gắn vào entity khi thêm mới, ngăn không cho người dùng sửa hoặc đọc chéo dữ liệu của khách sạn khác."* | AI sinh controller login, cấp token và Interceptor. Code cơ bản chạy được nhưng thiếu kiểm tra tenant bị khóa và thiếu unit tests. | Sinh viên phát hiện AI bỏ sót điều kiện kiểm tra Tenant đang hoạt động (`IsActive == true`). Sinh viên tự viết logic kiểm tra kích hoạt tài khoản và viết 45 unit tests kiểm thử hành vi xoay vòng token. | AI quên gán `TenantId` trong một số trường hợp tạo entity mới $\to$ Sinh viên bổ sung logic inject `ICurrentTenantService`. | [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) |
| **#003** | Nguyễn Khởi Nguyên (`24TX810011`) | GitHub Copilot & ChatGPT Plus | CRUD RoomType và Room theo CQRS, xây dựng UI Angular Catalog | *"Mình đang làm tính năng quản lý danh mục Loại phòng (RoomType) và Phòng (Room) cho khách sạn bằng C# .NET 10. Bạn viết giúp mình các Command và Query MediatR để thêm, sửa, xóa, lấy danh sách có phân trang và lọc theo tầng. Lưu ý số phòng không được trùng nhau trong cùng một khách sạn và không cho xóa loại phòng nếu đang có phòng trực thuộc."* | AI sinh đầy đủ Command, Query, Handler, Validator và service Angular. Nhưng phần xóa AI viết xóa cứng (hard delete) trực tiếp vào DB, không kiểm tra đơn đặt phòng. | Sinh viên kiểm tra nghiệp vụ và sửa lại: thay vì xóa cứng, phải kiểm tra ràng buộc với lịch sử đặt phòng (Reservation). Ở Frontend, sinh viên tự tay viết lại toàn bộ sang Angular Standalone Component dùng Signals. | AI sinh logic xóa cứng (Hard Delete) làm mất lịch sử đặt phòng $\to$ Sinh viên sửa thành kiểm tra ràng buộc khóa ngoại trước khi xóa. | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) |
| **#004** | Trần Trọng Tân (`24TX810025`) | Google Antigravity & Claude 3.5 | Máy trạng thái FSM buồng phòng, Concurrency Lock `expectedOldStatus`, Housekeeping Board | *"Mình cần làm màn hình quản lý buồng phòng (Housekeeping) cho khách sạn. Khách sạn có 5 trạng thái phòng: Sạch, Bẩn, Đang dọn, Có khách và Hỏng/Bảo trì. Bạn viết giúp mình API đổi trạng thái phòng có kiểm tra luồng chuyển đổi hợp lệ và tránh trường hợp 2 nhân viên cùng bấm đổi trạng thái một lúc. Phía giao diện Angular hiển thị các thẻ phòng theo từng tầng và đổi màu theo trạng thái."* | AI đề xuất `RoomStatusTransitionValidator` và gợi ý gửi kèm `expectedOldStatus` lên API PATCH. Phía Angular AI sinh giao diện danh sách có nút bấm đổi trạng thái nhưng dùng thư viện bên ngoài. | Khi dò lại ma trận trạng thái, sinh viên thấy AI bỏ sót trường hợp: phòng bảo dưỡng xong (`OutOfService`) chuyển về lại phòng sạch (`Clean`), nên sinh viên tự thêm rule này vào validator. Ở Angular, sinh viên viết lại bằng Angular Signals thuần và thêm cơ chế khóa nút bấm khi đang gọi API. | AI bỏ sót bước chuyển trạng thái từ Bảo trì (`OutOfService`) về Phòng sạch (`Clean`) $\to$ Sinh viên bổ sung đầy đủ luật chuyển đổi. | [`58c29ba`](https://github.com/GinNgo/hotel-saas-v2/commit/58c29ba) / [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43) |

---

## 3. Khó khăn vướng mắc & Giải pháp khắc phục

| # | Vấn Đề Gặp Phải | Nguyên Nhân | Biện Pháp Khắc Phục Đã Triển Khai |
|:---:|:---|:---|:---|
| 1 | Lỗi quyền truy cập file trên thư mục OneDrive Windows | OneDrive tự động lock file khi đang đồng bộ | Di chuyển thư mục mã nguồn độc lập sang `C:\Dev\hotel-saas-v2` để chạy mượt mà. |
| 2 | Xung đột đồng thời khi cập nhật trạng thái buồng phòng | Nhiều nhân viên buồng phòng thao tác cùng 1 phòng trên trình duyệt | Áp dụng cơ chế Concurrency Token (`expectedOldStatus`) trả về mã HTTP 409 Conflict yêu cầu làm mới. |
| 3 | Lỗi xUnit parallel runner trên PostgreSQL khi chạy CI | Các test chạy đồng thời tranh chấp kết nối | Thêm `[assembly: CollectionBehavior(DisableTestParallelization = true)]` và tắt Pooling. |

---

## 4. Kế hoạch Tuần 2 (Phase 2 & Phase 3)

| # | Hạng Mục / Nhiệm Vụ | Người Thực Hiện | Thời Gian Dự Kiến | Kết Quả Đầu Ra (Deliverables) |
|:---:|:---|:---|:---:|:---|
| 1 | **Core Reservation Engine:** API đặt phòng, kiểm tra phòng trống, khóa chống overbooking | Ngô Võ Tuấn An | 13/10 – 16/10 | `POST /api/reservations`, `ReservationConfiguration.cs` |
| 2 | **Multi-tier Pricing Engine:** Tính giá theo giờ/đêm/ngày lễ, phụ thu sớm/trễ | Ngô Võ Tuấn An | 14/10 – 17/10 | `PricingCalculator.cs`, 50+ Unit tests |
| 3 | **Stay Lifecycle API:** Check-in (`Occupied`) & Check-out (`Dirty`) | Ngô Võ Tuấn An | 16/10 – 19/10 | `CheckInCommand.cs`, `CheckOutCommand.cs` |
| 4 | **Giao diện Đặt phòng Lễ tân tại quầy:** Form đặt phòng nhanh, chọn Tỉnh/Xã 2 cấp | Nguyễn Khởi Nguyên | 14/10 – 18/10 | `frontend/src/app/features/reservations/` |
| 5 | **Sơ đồ Phòng theo Thời gian (Timeline Grid):** Gantt calendar phòng trống / có khách | Nguyễn Khởi Nguyên | 16/10 – 19/10 | `room-timeline.component.ts` |
| 6 | **Quy trình Check-in / Check-out tại quầy:** Modals thao tác, liên thông đổi màu buồng phòng | Trần Trọng Tân | 14/10 – 18/10 | Check-in/out Modals, đồng bộ Signals |
| 7 | **Bảng kê Hóa đơn Folio & Thu Ngân:** Chi tiết công nợ, thu tiền tại quầy, chốt ca | Trần Trọng Tân | 16/10 – 19/10 | `frontend/src/app/features/payments/` |

---

## 5. Các giai đoạn phát triển của đề tài

* **Phase 0 (Phân tích & Thiết kế):** Đã hoàn tất (SRS 01-08, SDD 01-10, Docker, CI/CD).
* **Phase 1 (Nền tảng, Auth, Multi-tenant & Catalog):** Đã hoàn tất (Domain Entities, JWT Auth, Room & RoomType CRUD, Housekeeping FSM).
* **Phase 2 (Pricing & Policies):** Đang thực hiện trong Tuần 2 (Bảng giá theo giờ/đêm/lễ, phụ thu sớm/trễ).
* **Phase 3 (Reservation & Lifecycle):** Đang thực hiện trong Tuần 2 (Quy trình nhận phòng, trả phòng, công nợ).
* **Phase 4 (Cashier, Folio & Reports):** Kế hoạch Tuần 3 (Thu ngân, chốt ca, báo cáo doanh thu).
* **Phase 5 (Public OTA & Hold 15m):** Kế hoạch Tuần 3 (Cổng đặt phòng công khai, giữ phòng tạm thời).

---

## 6. Xác nhận tiến độ

```
Đại diện Nhóm sinh viên:                       Giảng viên hướng dẫn:
Ngô Võ Tuấn An (Nhóm trưởng)                   ThS. Phùng Hữu Xuân

(Ký và ghi rõ họ tên)                          (Ký và ghi rõ họ tên)
Ngày: 14/10/2026                               Ngày: ___/___/2026
```
