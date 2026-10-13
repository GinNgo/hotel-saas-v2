# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM
---

# BÁO CÁO CÁ NHÂN TIẾN ĐỘ THỰC HIỆN ĐỒ ÁN — TUẦN 01

* **Họ và tên sinh viên:** Ngô Võ Tuấn An
* **Mã số sinh viên:** `24TX810001`
* **Vai trò trong nhóm:** Nhóm trưởng (Team Leader), Kỹ sư Thiết kế Kiến trúc (Solution Architect)
* **Đề tài / Topic:** 578 — Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh Theo Mô Hình SaaS (Hotel SaaS Platform v2)
* **Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 1:** 03/10/2026 – 10/10/2026
* **Email liên hệ:** `ngovotuananh@gmail.com`
* **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2) (Nhánh làm việc chính: `develop`)

---

## I. MỤC TIÊU VÀ NHIỆM VỤ ĐƯỢC PHÂN CÔNG TRONG TUẦN 1

1. **Thiết lập kiến trúc cốt lõi của toàn hệ thống (Foundation Architecture):**
   - Lựa chọn stack công nghệ: .NET 10 cho Backend, Angular 22 Standalone cho Frontend, PostgreSQL 17 làm CSDL, Docker Compose cho môi trường phát triển cục bộ.
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

## II. KẾT QUẢ ĐẠT ĐƯỢC VÀ MINH CHỨNG MÃ NGUỒN

### 1. Bảng tóm tắt các file mã nguồn chính đã xây dựng

| Tầng kiến trúc / Module | Các file mã nguồn tiêu biểu | Vai trò và chức năng |
|:---|:---|:---|
| **Domain Layer** | `Tenant.cs`, `Property.cs`, `User.cs`, `AccessRole.cs`, `RolePermission.cs`, `TenantStaff.cs`, `RefreshToken.cs` | Định nghĩa thực thể nghiệp vụ cốt lõi, ràng buộc dữ liệu, interface `ITenantScopedEntity`, `IPropertyScopedEntity` |
| **Application Layer** | `ICurrentTenantService.cs`, `ICurrentPropertyService.cs`, `ICurrentUserContext.cs`, `ValidationException.cs`, `ForbiddenAccessException.cs` | Định nghĩa interface trừu tượng và các ngoại lệ chuẩn |
| **Infrastructure Layer** | `ApplicationDbContext.cs`, `TenantPropertySaveChangesInterceptor.cs`, `LocalDevDataSeeder.cs` | Cấu hình EF Core, tự động gắn TenantId khi lưu, bộ nạp dữ liệu mẫu 500+ dòng code |
| **WebApi Layer** | `AuthController.cs`, `ExceptionHandlingMiddleware.cs`, `TenantPropertyContextMiddleware.cs` | API đăng nhập/lấy token, middleware xử lý lỗi chuẩn RFC 7807 (400, 401, 403, 404, 409, 500) |
| **DevOps & CI/CD** | `.github/workflows/ci.yml`, `docker-compose.yml`, `.gitignore` | Quy trình tự động hóa kiểm tra build, lint, test và môi trường container |

### 2. Các chỉ số kỹ thuật đạt được
- **Chất lượng mã nguồn:** Biên dịch Release mode `Build succeeded. 0 Warning(s) 0 Error(s)`.
- **Độ bao phủ kiểm thử:** Xây dựng bộ Integration Tests và Unit Tests xác thực chặt chẽ cơ chế bảo mật (Context Mismatch, Bitmask Permission Check, Tenant Isolation).
- **Mã commit trên Git:** Các commit tiêu biểu từ `677cd99` đến `0498559` trên nhánh `develop`.

---

## III. MỨC ĐỘ ĐÁNH GIÁ VÀ CAM KẾT THEO RUBRIC MÔN HỌC

* **Tính chủ động & Trách nhiệm:** Xây dựng khung kiến trúc đúng hẹn, hỗ trợ kịp thời 2 bạn trong nhóm tích hợp mã nguồn.
* **Chất lượng sản phẩm:** Mã nguồn viết theo chuẩn SOLID, áp dụng triệt để CQRS pattern với MediatR, tài liệu dự án đầy đủ và rõ ràng.
* **Tự đánh giá điểm cá nhân Tuần 1:** **10.0 / 10**

---

## IV. KẾ HOẠCH TUẦN 02 CỦA CÁ NHÂN

1. Thiết kế và hiện thực Module Đặt phòng (Reservation Engine):
   - Command tạo đặt phòng mới (`CreateReservationCommand`) với kiểm tra phòng trống (Room Availability Check).
   - Máy trạng thái vòng đời đặt phòng (`PendingPayment` -> `Confirmed` -> `CheckedIn` -> `CheckedOut` -> `Cancelled`).
2. Tích hợp tính toán hóa đơn và thanh toán tạm ứng (Folio & Down Payment).
3. Hỗ trợ bạn Nguyên và bạn Tân kết nối giao diện với API Reservation.

---

*TP. Hồ Chí Minh, ngày 13 tháng 10 năm 2026*

**Người làm báo cáo**  
*(Ký và ghi rõ họ tên)*  

  
**Ngô Võ Tuấn An**
