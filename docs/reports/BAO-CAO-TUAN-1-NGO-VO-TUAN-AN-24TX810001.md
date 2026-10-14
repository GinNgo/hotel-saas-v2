# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM
---

# BÁO CÁO CÁ NHÂN TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN — TUẦN 01

* **Họ và tên sinh viên:** Ngô Võ Tuấn An
* **Mã số sinh viên:** `24TX810001`
* **Vai trò trong nhóm:** Nhóm trưởng (Team Leader), Kỹ sư Thiết kế Kiến trúc (Solution Architect)
* **Đề tài / Topic:** 578 — Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh Theo Mô Hình SaaS (Hotel SaaS Platform v2)
* **Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 1:** 03/10/2026 – 10/10/2026 (Nghiệm thu tích hợp: 14/10/2026)
* **Email liên hệ:** `ngovotuananh@gmail.com` / `24tx810001@student.hcmute.edu.vn`
* **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2) (Nhánh làm việc chính: `develop` & `main`)

---

## I. MỤC TIÊU VÀ NHIỆM VỤ ĐƯỢC PHÂN CÔNG TRONG TUẦN 1

1. **Thiết lập kiến trúc cốt lõi của toàn hệ thống (Foundation Architecture):**
   - Lựa chọn stack công nghệ: .NET 10 cho Backend, Angular 22 Standalone Signals cho Frontend, PostgreSQL 17 làm CSDL, Docker Compose cho môi trường phát triển cục bộ.
   - Tổ chức cấu trúc Clean Architecture theo chuẩn công nghiệp: 4 tầng riêng biệt (`Domain`, `Application`, `Infrastructure`, `WebApi`).
2. **Triển khai kiến trúc Multi-tenant SaaS & Bảo mật cách ly dữ liệu:**
   - Xây dựng cơ chế lọc tự động theo ngữ cảnh khách thuê (`TenantId`) và chi nhánh (`PropertyId`) bằng EF Core Global Query Filters.
   - Xây dựng Interceptor `TenantPropertySaveChangesInterceptor` chặn tuyệt đối việc ghi/sửa dữ liệu xuyên tenant.
3. **Hiện thực hệ thống Xác thực & Phân quyền RBAC nâng cao:**
   - Cấp phát JWT Access Token kết hợp cơ chế Refresh Token Rotation (xoay vòng token chống rò rỉ session).
   - Mã hóa mật khẩu một chiều với thuật toán BCrypt.
   - Thiết kế hệ thống quyền dạng Bitmask (`Read`, `Create`, `Update`, `Delete`, `Admin`) cho phép phân quyền chi tiết tới từng chức năng.
4. **Xây dựng bộ tạo dữ liệu mẫu tự động (LocalDevDataSeeder):**
   - Đảm bảo tính Idempotent (chạy nhiều lần không bị duplicate dữ liệu).
   - Khởi tạo đầy đủ Tenant, Property, Role, User, RoomType, Room, sẵn sàng để nhóm test ngay sau khi clone project.
5. **Thiết kế tài liệu chuẩn học thuật:**
   - Chủ trì soạn thảo bộ tài liệu SRS (01-08) và SDD (01-10) cùng Test Plan tổng thể.
6. **Điều phối nhóm & Quản lý Git Workflow:**
   - Xây dựng quy trình làm việc trên Git (Trunk-based branching: `feature/*` -> `develop` -> `main`), viết quy tắc Coding Conventions và hỗ trợ tích hợp mã nguồn các thành viên.

---

## II. KẾT QUẢ ĐẠT ĐƯỢC VÀ MINH CHỨNG MÃ NGUỒN CỤ THỂ (GITHUB BLOB LINKS)

### 1. Bảng danh mục liên kết mã nguồn chi tiết (GitHub Blob Links) do Ngô Võ Tuấn An trực tiếp xây dựng:

| STT | Tên File Mã Nguồn | Đường Dẫn Link GitHub Blob Cụ Thể | Chức Năng & Nghiệp Vụ Hiện Thực |
|:---:|:---|:---|:---|
| **1** | `Tenant.cs` | [`Domain/Entities/Tenant.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Tenant.cs) | Thực thể khách thuê (Tenant SaaS), lưu trữ thông tin chuỗi khách sạn, mã code, trạng thái hoạt động. |
| **2** | `Property.cs` | [`Domain/Entities/Property.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Property.cs) | Thực thể chi nhánh khách sạn, liên kết trực thuộc Tenant, địa chỉ và mã chi nhánh. |
| **3** | `User.cs` | [`Domain/Entities/User.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/User.cs) | Thực thể người dùng toàn hệ thống, mã hóa mật khẩu, vai trò toàn cục `GlobalUserRole`. |
| **4** | `RolePermission.cs` | [`Domain/Entities/RolePermission.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RolePermission.cs) | Thực thể quyền hạn Bitmask gắn với từng phân hệ tài nguyên (`BitmaskValue`). |
| **5** | `RefreshToken.cs` | [`Domain/Entities/RefreshToken.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RefreshToken.cs) | Thực thể lưu trữ Refresh Token, hỗ trợ thu hồi (`RevokedAtUtc`) và xoay vòng token. |
| **6** | `BaseEntity.cs` | [`Domain/Common/BaseEntity.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Common/BaseEntity.cs) | Lớp thực thể cơ sở chứa `TenantId`, `PropertyId`, `CreatedAtUtc`, `UpdatedAtUtc`. |
| **7** | `ICurrentTenantService.cs` | [`Application/Common/Interfaces/ICurrentTenantService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Common/Interfaces/ICurrentTenantService.cs) | Interface trừu tượng hóa việc trích xuất `TenantId` từ request context. |
| **8** | `ICurrentPropertyService.cs` | [`Application/Common/Interfaces/ICurrentPropertyService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Common/Interfaces/ICurrentPropertyService.cs) | Interface trừu tượng hóa việc trích xuất `PropertyId` từ header `X-Property-Id`. |
| **9** | `IApplicationDbContext.cs` | [`Application/Common/Interfaces/IApplicationDbContext.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs) | Interface DbContext cho tầng Application, đảm bảo tính phụ thuộc nghịch đảo (DIP). |
| **10** | `ApplicationDbContext.cs` | [`Infrastructure/Persistence/ApplicationDbContext.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs) | Triển khai EF Core DbContext, cấu hình Global Query Filters cách ly Tenant và Property. |
| **11** | `TenantPropertySaveChangesInterceptor.cs` | [`Infrastructure/Persistence/Interceptors/TenantPropertySaveChangesInterceptor.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/TenantPropertySaveChangesInterceptor.cs) | Interceptor tự động gán và kiểm tra TenantId/PropertyId khi `SaveChanges` để chống ghi đè chéo. |
| **12** | `LocalDevDataSeeder.cs` | [`Infrastructure/Persistence/LocalDevDataSeeder.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs) | Bộ nạp dữ liệu mẫu Idempotent tạo sẵn Tenant, Chi nhánh, Tài khoản, Phòng và Bảng giá. |
| **13** | `JwtService.cs` | [`Infrastructure/Services/JwtService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/JwtService.cs) | Service sinh Access Token JWT, Claims, Roles và cơ chế xoay vòng Refresh Token. |
| **14** | `PasswordHasher.cs` | [`Infrastructure/Services/PasswordHasher.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/PasswordHasher.cs) | Service băm và kiểm tra mật khẩu bằng thuật toán BCrypt bảo mật cao. |
| **15** | `AuthController.cs` | [`WebApi/Controllers/AuthController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs) | Controller tiếp nhận các endpoint xác thực, login, refresh token, revoke token. |
| **16** | `ExceptionHandlingMiddleware.cs` | [`WebApi/Middleware/ExceptionHandlingMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs) | Middleware xử lý lỗi toàn cục theo chuẩn RFC 7807 (ProblemDetails: 400, 401, 403, 404, 409, 500). |
| **17** | `ci.yml` | [`.github/workflows/ci.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml) | GitHub Actions CI/CD Pipeline 6 giai đoạn (Postgres container, build .NET 10, build Angular, scan gitleaks). |
| **18** | `docker-compose.yml` | [`docker-compose.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docker-compose.yml) | Cấu hình Docker khởi chạy PostgreSQL 17 và Redis cho môi trường phát triển cục bộ. |
| **19** | `auth.service.ts` | [`frontend/src/app/core/services/auth.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/auth.service.ts) | Service quản lý đăng nhập, lưu trữ token, phân quyền người dùng và chuyển đổi chi nhánh. |
| **20** | `token-storage.service.ts` | [`frontend/src/app/core/services/token-storage.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/token-storage.service.ts) | Quản lý lưu trữ Access Token, Refresh Token an toàn, giải mã token và kiểm tra Bitmask. |
| **21** | `jwt.interceptor.ts` | [`frontend/src/app/core/interceptors/jwt.interceptor.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/interceptors/jwt.interceptor.ts) | HTTP Interceptor tự động đính kèm `Bearer Token` và header `X-Property-Id` vào mọi request. |
| **22** | `auth.guard.ts` | [`frontend/src/app/core/guards/auth.guard.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/guards/auth.guard.ts) | Guard bảo vệ định tuyến kiểm tra token và quyền truy cập RBAC. |
| **23** | `login.page.ts` | [`frontend/src/app/features/auth/login/login.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/auth/login/login.page.ts) | Giao diện Đăng nhập đa chi nhánh, tích hợp các nút Quick Fill tài khoản mẫu. |
| **24** | `login.page.html` | [`frontend/src/app/features/auth/login/login.page.html`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/auth/login/login.page.html) | Template HTML giao diện đăng nhập với Reactive Forms. |
| **25** | `dashboard.page.ts` | [`frontend/src/app/features/dashboard/dashboard.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/dashboard/dashboard.page.ts) | Trung tâm chỉ huy vận hành khách sạn, hiển thị các chỉ số KPI vận hành. |
| **26** | `dashboard.page.html` | [`frontend/src/app/features/dashboard/dashboard.page.html`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/dashboard/dashboard.page.html) | Template HTML bảng điều khiển tổng quan. |

---

### 2. Danh Sách Commit Hiện Tại Trên Nhánh Develop (Git Log Verbatim)

Bảng trích xuất nguyên văn 100% từ lệnh `git log --pretty=format:"%h | %an <%ae> | %ad | %s"` trên nhánh `develop`:

| Commit Hash | Tác Giả (Author) | Ngày | Commit Message Khớp 100% Nguyên Văn Git Log | Nội Dung Nghiệp Vụ Bàn Giao |
|:---:|:---|:---:|:---|:---|
| [`c756904`](https://github.com/GinNgo/hotel-saas-v2/commit/c756904) | Tuan An <br>`ngovotuananh@gmail.com` | 2026-10-14 | `docs: clean up redundant documentation and establish comprehensive agent rulebook` | Tinh gọn tài liệu dự án, thiết lập sổ tay quy chuẩn kỹ thuật cho hệ sinh thái AI Agent. |
| [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) | Tuan An <br>`ngovotuananh@gmail.com` | 2026-10-14 | `feat(arch): initial core architecture foundation - Clean Architecture .NET 10, Multi-tenant, Auth + RBAC, Seed Data, CI/CD` | Khởi tạo cấu trúc solution Clean Architecture 4 tầng .NET 10, Multi-tenant Isolation, Auth JWT + Refresh Token Rotation, RBAC Bitmask, Seeder và CI/CD. |

---

## III. ĐÁNH GIÁ CHẤT LƯỢNG MÃ NGUỒN VÀ TIẾN ĐỘ THỰC HIỆN

* **Kiến trúc & Tiêu chuẩn:** Dự án tuân thủ nghiêm ngặt nguyên lý SOLID, Clean Architecture và CQRS pattern qua MediatR.
* **Bảo mật & Cách ly dữ liệu:** Hoàn thiện cơ chế bảo vệ multi-tenant ở cả hai tầng (Global Query Filter cho tầng đọc, SaveChangesInterceptor cho tầng ghi).
* **Kiểm thử tự động:** Toàn bộ solution biên dịch 0 lỗi, các unit tests cho tầng Auth và Multi-tenant đều vượt qua thành công.

---

## IV. KẾ HOẠCH TUẦN 02 CỦA CÁ NHÂN

1. **Thiết kế và hiện thực Động cơ Đặt phòng (Reservation Engine):**
   - Thiết kế thực thể `Reservation`, `ReservationGuest`, `Folio`, `Invoice`.
   - Xây dựng thuật toán kiểm tra phòng trống (Room Availability Engine) chống tình trạng Overbooking.
   - Hiện thực FSM vòng đời đặt phòng (`PendingPayment` $\to$ `Confirmed` $\to$ `CheckedIn` $\to$ `CheckedOut` $\to$ `Cancelled`).
2. **Quản lý Hóa đơn & Thu ngân (Folio & Billing):**
   - Tích hợp tính toán hóa đơn phòng và chi phí phát sinh (dịch vụ, mini-bar).
3. **Phối hợp tích hợp:**
   - Cung cấp API Availability cho phân hệ Đặt phòng của Nguyễn Khởi Nguyên và kết nối luồng Check-out với phân hệ Buồng phòng của Trần Trọng Tân.

---

## V. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO CHO CÁC CHỨC NĂNG ĐẢM NHIỆM

### Bảng Khai Báo Sử Dụng AI (Chuẩn 8 Cột):

| Lần | Công Cụ AI | Chức Năng Cụ Thể | Tóm Tắt Prompt Đã Dùng | Kết Quả AI Đã Sinh Ra | Sinh Viên Phản Biện & Sửa Chữa | Lỗi Ảo Giác Đã Khắc Phục | Commit Đối Chiếu |
|:---:|:---|:---|:---|:---|:---|:---|:---:|
| **#01** | Google Antigravity / Claude 3.5 | Clean Architecture .NET 10 & Docker Compose | Yêu cầu dựng 4 tầng Clean Architecture, Docker Compose Postgres 17 + Redis 7 | Cấu trúc solution `.sln`, `.csproj`, `docker-compose.yml` | Sửa đăng ký MediatR sang chuẩn .NET 10, sửa port mapping Docker trên Windows | AI sinh cú pháp MediatR cũ bị deprecated $\to$ Sinh viên sửa sang API chuẩn mới | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#02** | Google Antigravity | Multi-tenant Data Isolation (Filter & Interceptor) | Yêu cầu tạo Global Query Filter và SaveChangesInterceptor tự động gán và lọc TenantId | Class Interceptor và cấu hình DbContext | Thêm điều kiện an toàn khi không có HTTP context (Background Job), ngăn chặn ghi đè cross-tenant | AI không xử lý trường hợp TenantId rỗng $\to$ Sinh viên bổ sung exception handling an toàn | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#03** | Google Antigravity | Auth JWT & Refresh Token Rotation | Yêu cầu module xác thực JWT có cơ chế xoay vòng Refresh Token chống Replay Attack | `JwtService.cs`, `AuthController.cs` | Thay SHA256 thô bằng BCrypt work factor 12, bổ sung thu hồi toàn bộ token family khi bị replay | AI sinh mã hóa mật khẩu không muối (unsalted) $\to$ Sinh viên thay bằng BCrypt chuẩn an toàn | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#04** | Google Antigravity | Phân quyền RBAC Bitmask & Middleware RFC 7807 | Yêu cầu phân quyền bitmask bitwise và middleware bắt lỗi trả về ProblemDetails RFC 7807 | Enum Bitmask và Middleware tập trung | Chuyển sang dùng `ProblemDetails` native của .NET 10, cấu hình traceId chuẩn RFC | AI tự sinh JSON string thủ công không chuẩn RFC 7807 $\to$ Sinh viên refactor theo chuẩn Microsoft | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#05** | Google Antigravity | LocalDevDataSeeder Môi Trường Cục Bộ | Yêu cầu tạo dữ liệu mẫu Idempotent gồm Tenant, Khách sạn, User, Role, Phòng | Class Seeder dùng `EnsureCreated` | Bỏ `EnsureCreated`, chuyển sang kiểm tra `AnyAsync()` và Deterministic GUID chống lỗi trùng khóa | AI gọi AddRange gây lỗi Primary Key khi chạy lại $\to$ Sinh viên chuyển sang logic Idempotent | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |
| **#06** | Google Antigravity | GitHub Actions CI/CD Pipeline 6 Stages | Yêu cầu pipeline CI kiểm thử tự động, container Postgres 17, build .NET 10 và Angular | File YAML `.github/workflows/ci.yml` | Nâng cấp action lên `@v4`, sửa healthcheck Postgres container với `pg_isready` | AI dùng action cũ v3 không hỗ trợ .NET 10 $\to$ Sinh viên nâng cấp v4 và thêm cache npm/nuget | [`4acf372`](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) |

***
*TP. Hồ Chí Minh, ngày 14 tháng 10 năm 2026*

**Người làm báo cáo**  
*(Ký và ghi rõ họ tên)*  


**Ngô Võ Tuấn An**
