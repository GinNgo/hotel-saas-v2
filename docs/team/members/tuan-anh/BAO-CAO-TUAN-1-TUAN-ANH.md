# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM

---

# BÁO CÁO TIẾN ĐỘ CÁ NHÂN TUẦN 1
### ĐỀ TÀI: XÂY DỰNG HỆ THỐNG QUẢN LÝ KHÁCH SẠN (HOTEL SAAS PLATFORM)
- **Họ và tên:** Ngô Võ Tuấn Anh
- **Mã số sinh viên (MSSV):** *[Điền MSSV của Tuấn Anh]*
- **Email:** `ngovotuananh@gmail.com`
- **Vai trò trong nhóm:** Nhóm trưởng / Kiến trúc sư hệ thống & Backend (.NET 10)
- **Đề tài hệ thống:** Topic 578 ([projects-fit.hcmute.edu.vn](https://projects-fit.hcmute.edu.vn/?view=student-mytopic&topic=578))
- **Giảng viên hướng dẫn (GVHD):** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
- **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
- **Nhánh làm việc chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop)
- **Tuần báo cáo:** Tuần 1 (Từ 03/10/2026 đến 10/10/2026)

---

## 1. MỤC TIÊU VÀ NHIỆM VỤ ĐƯỢC GIAO TRONG TUẦN 1
1. **Thiết lập kiến trúc Clean Architecture:** Xây dựng dự án Backend gồm 4 tầng phân tách rành mạch: `Domain`, `Application`, `Infrastructure`, `WebApi` (.NET 10, C# 13, EF Core, PostgreSQL 17).
2. **Xây dựng đường ống CI/CD tự động hóa:** Thiết lập GitHub Actions workflow 6 giai đoạn đảm bảo mã nguồn tự động vượt qua build, lint, unit test trên container PostgreSQL 17 và quét bảo mật.
3. **Phân tích thiết kế hệ thống:** Soạn thảo tài liệu SRS, SDD, ERD mô hình doanh nghiệp đa chi nhánh (`Tenant` $\to$ `Property`), cam kết 13 KPI nghiệp vụ và 10 quyết định thiết kế kiến trúc (`p0-decisions.md`).
4. **Hiện thực hóa phân hệ Bảo mật & Phân quyền (Auth & RBAC):** API Đăng ký, Đăng nhập, cấp phát JWT, Refresh Token, Middleware kiểm soát ngữ cảnh chi nhánh `TenantPropertyContextMiddleware` theo nguyên tắc fail-closed.
5. **Khởi tạo dữ liệu mẫu cục bộ (Data Seeder):** Nạp sẵn 2 chi nhánh khách sạn mẫu (Quận 1, Phú Nhuận), các loại phòng và tài khoản demo phục vụ nhóm phát triển giao diện.
6. **Khảo sát & Kế thừa quy trình từ đề tài cũ:** Rà soát kho lưu trữ cũ [He-thong-quan-ly-khach-san](https://github.com/GinNgo/He-thong-quan-ly-khach-san) (Commit `7e7ed12c`), kế thừa các đặc tả nghiệp vụ và nâng cấp sang nền tảng SaaS đa chi nhánh hiện đại.

---

## 2. MINH CHỨNG COMMIT TRÊN GITHUB CỦA TUẤN ANH

| STT | Commit Hash | Thông Điệp Commit (Commit Message) | Nội Dung Chi Tiết Đã Commit Lên GitHub | Link Trực Tiếp |
|:---:|---|---|---|:---:|
| 1 | `677cd99` | `feat: Phase 0 complete - docs, scaffold, entities, rules` | Khởi tạo cấu trúc dự án; định nghĩa 7 thực thể miền cốt lõi (`Tenant`, `Property`, `Room`, `RoomType`, `Reservation`, `Payment`, `User`); viết tài liệu SRS, SDD, ERD. | [Commit 677cd99](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99adee6f861886c521699fdc4dd8a1629db) |
| 2 | `a06ac31` | `ci: add GitHub Actions 6-stage pipeline` | Thiết lập pipeline CI/CD GitHub Actions: Build .NET 10 $\to$ Lint $\to$ Chạy Unit Test trên PostgreSQL 17 container $\to$ Quét bảo mật $\to$ Build Angular 22. | [Commit a06ac31](https://github.com/GinNgo/hotel-saas-v2/commit/a06ac31f084606db8de915ddad171091b448f8c3) |
| 3 | `3f95339` | `feat(auth): implement Auth + RBAC - Phase 1A complete` | Triển khai phân hệ Auth & RBAC: `AuthController`, Middleware cách ly chi nhánh `TenantPropertyContextMiddleware`, phân quyền `PermissionAuthorizationHandler`, và bộ seeder dữ liệu `LocalDevDataSeeder`. | [Commit 3f95339](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339b4f4477ac5d421551d372dfdd5ed31e30) |

---

## 3. BẢNG DANH MỤC FILE KẾT QUẢ ĐÃ ĐẨY LÊN GITHUB CỦA TUẤN ANH

| Hạng Mục | Đường Dẫn File Cụ Thể Trong Repository | Mô Tả Chức Năng Của File | Link Trực Tiếp Tới File Trên GitHub |
|---|---|---|:---:|
| **Pipeline CI/CD** | `.github/workflows/ci.yml` | Tệp cấu hình GitHub Actions tự động hóa kiểm thử và build ứng dụng. | [ci.yml](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml) |
| **Thực thể Dữ liệu** | `backend/src/HotelSaas.Domain/Entities/Tenant.cs`<br>`backend/src/HotelSaas.Domain/Entities/Property.cs`<br>`backend/src/HotelSaas.Domain/Entities/Room.cs`<br>`backend/src/HotelSaas.Domain/Entities/RoomType.cs`<br>`backend/src/HotelSaas.Domain/Entities/User.cs` | Các thực thể doanh nghiệp: Doanh nghiệp (`Tenant`), Chi nhánh (`Property`), Phòng (`Room`), Hạng phòng (`RoomType`), Người dùng (`User`). | [Thư mục Entities](https://github.com/GinNgo/hotel-saas-v2/tree/develop/backend/src/HotelSaas.Domain/Entities) |
| **API Xác thực** | `backend/src/HotelSaas.WebApi/Controllers/AuthController.cs` | Controller xử lý Đăng ký, Đăng nhập, Cấp lại token, Đổi chi nhánh làm việc (`switch-context`). | [AuthController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs) |
| **Bảo mật Chi nhánh** | `backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs` | Middleware bắt buộc header `X-Property-Id`, xác thực quyền làm việc của nhân viên tại từng chi nhánh theo cơ chế fail-closed. | [Middleware](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs) |
| **Xử lý Quyền hạn** | `backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs` | Bộ xử lý phân quyền động (RBAC), kiểm tra quyền theo vai trò trước khi cho phép gọi API. | [PermissionHandler](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs) |
| **Dữ liệu Mẫu** | `backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs` | Script tạo sẵn 2 khách sạn, 4 loại phòng mẫu và các tài khoản demo (Admin, Manager, Lễ tân). | [LocalDevDataSeeder.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs) |
| **Tài liệu Kỹ thuật** | `docs/srs/08-kpi-commitment.md`<br>`docs/implementation-phases.md`<br>`docs/legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md` | Cam kết 13 KPI nghiệp vụ, tài liệu phân kỳ 8 giai đoạn (P0–P7) và tổng hợp kế thừa từ đề tài cũ. | [TONG-HOP-NGHIEP-VU](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md) |

---

## 4. TỰ ĐÁNH GIÁ VÀ KẾ HOẠCH TUẦN 2
- **Mức độ hoàn thành Tuần 1:** 100% nhiệm vụ đề ra.
- **Kế hoạch Tuần 2:**
  - Phát triển Pricing Engine tính giá giờ/đêm và phụ thu check-in sớm / check-out muộn.
  - Viết API Policies (`/api/properties/{id}/policies`) và Bảng giá (`/api/room-types/{id}/rates`).
  - Hỗ trợ review và merge Pull Request của Nguyên và Tân vào nhánh `develop`.
