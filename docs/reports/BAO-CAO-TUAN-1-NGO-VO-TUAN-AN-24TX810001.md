# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM
---

# BÁO CÁO CÁ NHÂN TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN — TUẦN 01 (CẬP NHẬT THEO GÓP Ý CỦA GVHD)

* **Họ và tên sinh viên:** Ngô Võ Tuấn An
* **Mã số sinh viên:** `24TX810001`
* **Vai trò trong nhóm:** Nhóm trưởng (Team Leader), Kỹ sư Thiết kế Kiến trúc (Solution Architect)
* **Đề tài / Topic:** 578 — Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh Theo Mô Hình SaaS (Hotel SaaS Platform v2)
* **Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 1:** 03/10/2026 – 10/10/2026 (Nghiệm thu tích hợp: 12/10/2026)
* **Email liên hệ:** `ngovotuananh@gmail.com`
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
   - Xây dựng quy trình làm việc trên Git (Trunk-based branching: `feature/*` -> `develop` -> `main`), viết quy tắc Coding Conventions và hướng dẫn thành viên.

---

## II. KẾT QUẢ ĐẠT ĐƯỢC VÀ MINH CHỨNG MÃ NGUỒN CỤ THỂ (GITHUB BLOB LINKS)

### 1. Bảng danh mục liên kết mã nguồn chi tiết (GitHub Blob Links) do Ngô Võ Tuấn An trực tiếp xây dựng:

| STT | Tên File Mã Nguồn | Đường Dẫn Link GitHub Blob Cụ Thể | Chức Năng & Nghiệp Vụ Hiện Thực |
|:---:|:---|:---|:---|
| **1** | `Tenant.cs` | [`Domain/Entities/Tenant.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Tenant.cs) | Thực thể khách thuê (Tenant SaaS), lưu trữ thông tin chuỗi khách sạn, mã code, trạng thái hoạt động. |
| **2** | `Property.cs` | [`Domain/Entities/Property.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Property.cs) | Thực thể chi nhánh khách sạn, liên kết trực thuộc Tenant, địa chỉ và mã chi nhánh. |
| **3** | `User.cs` | [`Domain/Entities/User.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/User.cs) | Thực thể người dùng toàn hệ thống, mã hóa mật khẩu, vai trò toàn cục `GlobalUserRole`. |
| **4** | `AccessRole.cs` | [`Domain/Entities/AccessRole.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/AccessRole.cs) | Thực thể vai trò truy cập theo chi nhánh (Admin, Manager, Staff, Housekeeper). |
| **5** | `RolePermission.cs` | [`Domain/Entities/RolePermission.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RolePermission.cs) | Thực thể quyền hạn Bitmask gắn với từng phân hệ tài nguyên (`BitmaskValue`). |
| **6** | `TenantStaff.cs` | [`Domain/Entities/TenantStaff.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/TenantStaff.cs) | Thực thể phân công nhân sự vào chi nhánh cụ thể với vai trò và quyền tương ứng. |
| **7** | `RefreshToken.cs` | [`Domain/Entities/RefreshToken.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/RefreshToken.cs) | Thực thể lưu trữ Refresh Token, hỗ trợ thu hồi (`RevokedAtUtc`) và xoay vòng token. |
| **8** | `GlobalUserRole.cs` | [`Domain/Enums/GlobalUserRole.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Enums/GlobalUserRole.cs) | Enum định nghĩa các vai trò hệ thống: `SystemAdmin`, `TenantOwner`, `Staff`, `Customer`. |
| **9** | `ICurrentTenantService.cs` | [`Application/Common/Interfaces/ICurrentTenantService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Common/Interfaces/ICurrentTenantService.cs) | Interface trừu tượng hóa việc trích xuất `TenantId` từ request context. |
| **10** | `ICurrentPropertyService.cs` | [`Application/Common/Interfaces/ICurrentPropertyService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Common/Interfaces/ICurrentPropertyService.cs) | Interface trừu tượng hóa việc trích xuất `PropertyId` từ header `X-Property-Id`. |
| **11** | `IApplicationDbContext.cs` | [`Application/Common/Interfaces/IApplicationDbContext.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Common/Interfaces/IApplicationDbContext.cs) | Interface DbContext cho tầng Application, đảm bảo tính phụ thuộc nghịch đảo (DIP). |
| **12** | `ApplicationDbContext.cs` | [`Infrastructure/Persistence/ApplicationDbContext.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/ApplicationDbContext.cs) | Triển khai EF Core DbContext, cấu hình Global Query Filters cách ly Tenant và Property. |
| **13** | `TenantPropertySaveChangesInterceptor.cs` | [`Infrastructure/Persistence/Interceptors/TenantPropertySaveChangesInterceptor.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/TenantPropertySaveChangesInterceptor.cs) | Interceptor tự động gán và kiểm tra TenantId/PropertyId khi `SaveChanges` để chống ghi đè chéo. |
| **14** | `LocalDevDataSeeder.cs` | [`Infrastructure/Persistence/LocalDevDataSeeder.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs) | Bộ nạp dữ liệu mẫu 500+ dòng code tạo sẵn Tenant, Chi nhánh, Tài khoản, Phòng và Bảng giá. |
| **15** | `JwtService.cs` | [`Infrastructure/Services/JwtService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/JwtService.cs) | Service sinh Access Token JWT, Claims, Roles và cấu hình thời hạn an toàn. |
| **16** | `PasswordHasherService.cs` | [`Infrastructure/Services/PasswordHasherService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/PasswordHasherService.cs) | Service băm và kiểm tra mật khẩu bằng thuật toán BCrypt bảo mật cao. |
| **17** | `AuthController.cs` | [`WebApi/Controllers/AuthController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs) | Controller tiếp nhận `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh-token`, `/api/auth/switch-context`. |
| **18** | `ExceptionHandlingMiddleware.cs` | [`WebApi/Middleware/ExceptionHandlingMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs) | Middleware xử lý lỗi toàn cục theo chuẩn RFC 7807 (ProblemDetails: 400, 401, 403, 404, 409, 500). |
| **19** | `TenantPropertyContextMiddleware.cs` | [`WebApi/Middleware/TenantPropertyContextMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs) | Middleware phân giải ngữ cảnh tenant và chi nhánh từ token JWT và request header. |
| **20** | `ci.yml` | [`.github/workflows/ci.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml) | GitHub Actions CI/CD Pipeline 6 giai đoạn (Postgres container, build .NET 10, build Angular, scan gitleaks). |
| **21** | `docker-compose.yml` | [`docker-compose.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docker-compose.yml) | Cấu hình Docker khởi chạy PostgreSQL 17 và Redis cho môi trường phát triển cục bộ. |
| **22** | `auth.service.ts` | [`frontend/src/app/core/services/auth.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/auth.service.ts) | Service quản lý đăng nhập, lưu trữ token, phân quyền người dùng và chuyển đổi chi nhánh. |
| **23** | `token-storage.service.ts` | [`frontend/src/app/core/services/token-storage.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/token-storage.service.ts) | Quản lý lưu trữ Access Token, Refresh Token an toàn, giải mã token và kiểm tra Bitmask. |
| **24** | `auth.interceptor.ts` | [`frontend/src/app/core/interceptors/auth.interceptor.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/interceptors/auth.interceptor.ts) | HTTP Interceptor tự động đính kèm `Bearer Token` và header `X-Property-Id` vào mọi request. |
| **25** | `login.page.ts` | [`frontend/src/app/features/auth/login/login.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/auth/login/login.page.ts) | Giao diện Đăng nhập đa chi nhánh, tích hợp 4 nút Quick Fill tài khoản mẫu (Admin, Owner, Manager, Staff). |
| **26** | `dashboard.page.ts` | [`frontend/src/app/features/dashboard/dashboard.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/dashboard/dashboard.page.ts) | Trung tâm chỉ huy vận hành khách sạn, 4 thẻ KPI, thanh trạng thái buồng phòng (Room Readiness Bar). |

---

### 2. Danh Sách Commit Khớp Chính Xác Lịch Sử Git (Git Log Verbatim)

Dưới đây là bảng đối chiếu từng commit trên kho GitHub chính thức, khớp **100% nguyên văn Commit Hash, Tác Giả, Thời Gian và Commit Message**:

| STT | Commit Hash (Ngắn) | Tác Giả (Author) | Ngày (Date) | Commit Message Khớp Chính Xác (Git Log) | Chi Tiết Nội Dung Đóng Góp Thực Tế |
|:---:|:---|:---|:---:|:---|:---|
| **1** | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) | Tuan An | 2026-10-03 | `feat: Phase 0 complete - docs, scaffold, entities, rules` | Khởi tạo cấu trúc solution Clean Architecture 4 tầng .NET 10, bộ tài liệu phân tích thiết kế SRS (01-08) và SDD (01-10), cấu hình Docker Compose Postgres/Redis. |
| **2** | [`e0b8a88`](https://github.com/GinNgo/hotel-saas-v2/commit/e0b8a88) | Tuan An | 2026-10-04 | `chore: temporarily remove ci.yml for push (will add via GitHub UI)` | Tinh chỉnh cấu hình đẩy mã nguồn lên kho GitHub. |
| **3** | [`a06ac31`](https://github.com/GinNgo/hotel-saas-v2/commit/a06ac31) | Tuan An | 2026-10-04 | `ci: add GitHub Actions 6-stage pipeline` | Thiết lập file pipeline `.github/workflows/ci.yml` gồm 6 stages kiểm thử tự động, container Postgres 17 và secret scanning. |
| **4** | [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) | Tuan An | 2026-10-04 | `feat(auth): implement Auth + RBAC - Phase 1A complete` | Hiện thực module Auth (JWT, Refresh Token Rotation, BCrypt), Interceptor kiểm soát Multi-tenant, Bitmask Permissions và 45 Unit Tests. |
| **5** | [`94c93fd`](https://github.com/GinNgo/hotel-saas-v2/commit/94c93fd) | Tuan An | 2026-10-12 | `feat: Phase 1 complete - architecture foundation, auth & RBAC, team roadmaps, week 1 reports, and feature scaffolds` | Hoàn thiện toàn bộ Phase 1, LocalDevDataSeeder nạp 2 chi nhánh mẫu, tích hợp mã nguồn của các thành viên, hoàn tất báo cáo tuần 1. |
| **6** | [`34e3f31`](https://github.com/GinNgo/hotel-saas-v2/commit/34e3f31) | Tuan An | 2026-10-13 | `chore(docs): clean up redundant docs and update official week 1 reports and ai usage log` | Dọn dẹp tài liệu dư thừa, chuẩn hóa định dạng báo cáo tuần 1 và nhật ký AI log theo quy cách khoa CNTT. |
| **7** | [`69eef43`](https://github.com/GinNgo/hotel-saas-v2/commit/69eef43) | Tuan An | 2026-10-14 | `merge(housekeeping): integrate feature/tan-housekeeping into develop with 0 build errors` | Giải quyết xung đột merge, chuẩn hóa utils buồng phòng, kiểm thử biên dịch 0 lỗi Backend và Frontend, đồng bộ lên `develop` và `main`. |

---

## III. ĐÁNH GIÁ CHẤT LƯỢNG MÃ NGUỒN THEO YÊU CẦU

* **Tính chủ động & Trách nhiệm:** Xây dựng khung kiến trúc theo kế hoạch, hỗ trợ tích hợp mã nguồn các phân hệ.
* **Chất lượng sản phẩm:** Mã nguồn viết theo chuẩn SOLID, áp dụng CQRS pattern với MediatR, tài liệu kỹ thuật đầy đủ và rõ ràng.
* **Tình trạng kiểm thử:** Toàn bộ solution biên dịch 0 lỗi, 45 unit tests tầng Auth & Multi-tenant vượt qua thành công.

---

## IV. KẾ HOẠCH TUẦN 02 CỦA CÁ NHÂN

1. Thiết kế và hiện thực Module Đặt phòng (Reservation Engine):
   - Command tạo đặt phòng mới (`CreateReservationCommand`) với kiểm tra phòng trống (Room Availability Check).
   - Máy trạng thái vòng đời đặt phòng (`PendingPayment` -> `Confirmed` -> `CheckedIn` -> `CheckedOut` -> `Cancelled`).
2. Tích hợp tính toán hóa đơn và thanh toán tạm ứng (Folio & Down Payment).
3. Hỗ trợ bạn Nguyên và bạn Tân kết nối giao diện với API Reservation.

---

## V. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE & AUDIT LOG)

> Nhóm và cá nhân sinh viên cam kết tuân thủ quy định học thuật của Trường ĐH Sư phạm Kỹ thuật TP.HCM (Khoa CNTT). Mọi sự hỗ trợ từ công cụ AI đều được khai báo minh bạch, có kiểm chứng, có phản biện và chịu trách nhiệm 100% về mã nguồn.

### 1. Bảng Khai Báo Sử Dụng AI Của Ngô Võ Tuấn An (Tuần 1):

| Lần (Entry) | Thời Gian & Công Cụ | Phạm Vi Công Việc | Prompt Chính Đã Sử Dụng | Kết Quả AI Đã Sinh Ra | Sinh Viên Kiểm Tra, Phản Biện & Sửa Chữa | Lỗi Ảo Giác (Hallucination) Đã Khắc Phục | Commit Git Đối Chiếu |
|:---:|:---|:---|:---|:---|:---|:---|:---|
| **#001** | **03/10/2026**<br>Google Antigravity / Claude 3.5 Sonnet | Khởi tạo Solution Clean Architecture .NET 10, Docker Postgres/Redis, dàn ý SRS & SDD | *"Tôi đang dựng backend .NET 10 theo Clean Architecture cho đồ án SaaS quản lý khách sạn đa chi nhánh. Nhờ bạn gợi ý cấu trúc solution 4 tầng Domain, Application, Infrastructure, WebApi. Tích hợp EF Core với PostgreSQL 17, MediatR, FluentValidation và viết giúp file docker-compose chạy Postgres với Redis. Sau đó gợi ý cấu trúc thư mục tài liệu SRS, SDD chuẩn học thuật."* | AI sinh ra khung thư mục solution `.sln`, các file `.csproj`, file cấu hình `docker-compose.yml` và dàn bài 8 file SRS, 10 file SDD. Tuy nhiên cú pháp MediatR bị dùng theo phiên bản cũ. | Sinh viên kiểm tra, sửa cú pháp đăng ký MediatR sang chuẩn .NET 10 mới `AddMediatR(cfg => cfg.RegisterServicesFromAssembly(...))`. Cấu hình lại connection string Postgres tương thích Windows Docker. Chạy `dotnet build` đạt 0 lỗi. | AI sinh cú pháp thư viện cũ lỗi thời không tương thích .NET 10 $\to$ Sinh viên tự tay tra cứu tài liệu mới nhất và viết lại chuẩn xác. | [`677cd99`](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99) |
| **#002** | **04/10/2026**<br>Google Antigravity | Module Xác thực JWT, Refresh Token xoay vòng, SaveChangesInterceptor Multi-tenant | *"Hãy viết giúp tôi module Authentication bằng JWT có cơ chế Refresh Token xoay vòng (Token Rotation) để chống Replay Attack trong .NET 10. Đồng thời tạo giúp tôi EF Core Interceptor tự động lấy TenantId và PropertyId từ request header gắn vào entity khi thêm mới, ngăn không cho người dùng sửa hoặc đọc chéo dữ liệu của khách sạn khác."* | AI sinh ra controller xử lý login, cấp phát token và class Interceptor. Code chạy được ở mức cơ bản nhưng thiếu logic kiểm tra tenant bị khóa và thiếu unit tests. | Sinh viên phát hiện AI bỏ sót điều kiện kiểm tra Tenant đang hoạt động (`IsActive == true`). Sinh viên tự viết thêm logic kiểm tra trạng thái kích hoạt tài khoản và viết bộ 45 unit tests kiểm thử hành vi xoay vòng token, xác nhận chặn đứng token giả mạo. | AI quên gán `TenantId` trong một số trường hợp tạo entity mới $\to$ Sinh viên bổ sung logic tự động inject `ICurrentTenantService` vào BaseEntity Handler. | [`3f95339`](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339) |

---

*TP. Hồ Chí Minh, ngày 14 tháng 10 năm 2026*

**Người làm báo cáo**  
*(Ký và ghi rõ họ tên)*  


**Ngô Võ Tuấn An**
