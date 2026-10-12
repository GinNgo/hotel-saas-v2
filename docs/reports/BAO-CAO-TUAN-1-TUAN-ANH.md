# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM

---

# BÁO CÁO TIẾN ĐỘ CÁ NHÂN TUẦN 1
### ĐỀ TÀI: XÂY DỰNG HỆ THỐNG QUẢN LÝ KHÁCH SẠN (HOTEL SAAS PLATFORM)
- **Họ và tên:** Ngô Võ Tuấn Anh
- **Mã số sinh viên (MSSV):** *[Điền MSSV của Tuấn Anh]*
- **Vai trò trong nhóm:** Nhóm trưởng / Kiến trúc sư hệ thống & Lập trình viên Backend (.NET 10)
- **Đề tài hệ thống:** Topic 578 ([projects-fit.hcmute.edu.vn](https://projects-fit.hcmute.edu.vn/?view=student-mytopic&topic=578))
- **Giảng viên hướng dẫn (GVHD):** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
- **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
- **Nhánh làm việc chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop)
- **Tuần báo cáo:** Tuần 1 (Từ 03/10/2026 đến 10/10/2026)

---

## 1. MỤC TIÊU VÀ NHIỆM VỤ ĐƯỢC GIAO TRONG TUẦN 1
1. **Thiết lập hạ tầng dự án & quy trình kỹ thuật:** Khởi tạo cấu trúc Clean Architecture cho Backend (.NET 10, C# 13, Entity Framework Core, PostgreSQL 17) và Single Page Application cho Frontend (Angular 22).
2. **Thiết lập quy trình CI/CD tự động hóa:** Xây dựng GitHub Actions workflow gồm 6 giai đoạn nhằm bảo đảm chất lượng mã nguồn tự động theo tiêu chí Rubric TC2.6.
3. **Phân tích thiết kế hệ thống:** Soạn thảo tài liệu đặc tả yêu cầu phần mềm SRS, SDD, ERD mô hình dữ liệu đa chi nhánh (Multi-tenancy), cam kết 13 KPI nghiệp vụ và 10 quyết định thiết kế kiến trúc (`p0-decisions.md`).
4. **Hiện thực hóa phân hệ Bảo mật & Phân quyền (Auth & RBAC):** Xây dựng API Đăng ký, Đăng nhập, cấp phát JWT Token, Refresh Token, cơ chế chuyển đổi ngữ cảnh chi nhánh (`TenantPropertyContextMiddleware`), kiểm soát quyền hạn theo vai trò (Role-Based Access Control) theo nguyên tắc fail-closed.
5. **Khởi tạo dữ liệu mẫu cục bộ (Data Seeder):** Viết bộ nạp dữ liệu mẫu `LocalDevDataSeeder` tự động sinh 2 chi nhánh khách sạn mẫu, các hạng phòng và tài khoản demo phục vụ các thành viên phát triển giao diện.
6. **Khảo sát & Kế thừa quy trình từ đề tài cũ:** Rà soát kho lưu trữ cũ [He-thong-quan-ly-khach-san](https://github.com/GinNgo/He-thong-quan-ly-khach-san) (Commit `7e7ed12c`), nâng cấp kiến trúc từ Monolith đơn cơ sở sang SaaS đa chi nhánh (xem tài liệu đối chiếu [`docs/legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md)).

---

## 2. MINH CHỨNG COMMIT TRÊN GITHUB CỦA TUẤN ANH

| STT | Mã Commit (Commit Hash) | Thông Điệp Commit (Commit Message) | Nội Dung Chi Tiết Đã Commit Lên GitHub | Link Commit Trực Tiếp |
|:---:|---|---|---|:---:|
| 1 | `677cd99` | `feat: Phase 0 complete - docs, scaffold, entities, rules` | Khởi tạo cấu trúc thư mục backend/frontend; định nghĩa 7 thực thể miền cốt lõi (`Tenant`, `Property`, `Room`, `RoomType`, `Reservation`, `Payment`, `User`); viết tài liệu SRS, SDD, ERD và quy tắc nghiệp vụ. | [677cd99](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99adee6f861886c521699fdc4dd8a1629db) |
| 2 | `a06ac31` | `ci: add GitHub Actions 6-stage pipeline` | Xây dựng pipeline CI/CD GitHub Actions: Build .NET 10 $\to$ Kiểm tra Lint $\to$ Chạy Unit Test trên container PostgreSQL 17 $\to$ Quét an toàn bảo mật (Security scan) $\to$ Build Angular 22. | [a06ac31](https://github.com/GinNgo/hotel-saas-v2/commit/a06ac31f084606db8de915ddad171091b448f8c3) |
| 3 | `3f95339` | `feat(auth): implement Auth + RBAC - Phase 1A complete` | Triển khai hoàn chỉnh phân hệ Auth & RBAC: `AuthController`, Middleware cách ly chi nhánh `TenantPropertyContextMiddleware`, phân quyền `PermissionAuthorizationHandler`, và bộ seeder dữ liệu mẫu `LocalDevDataSeeder`. | [3f95339](https://github.com/GinNgo/hotel-saas-v2/commit/3f95339b4f4477ac5d421551d372dfdd5ed31e30) |

---

## 3. BẢNG DANH MỤC FILE KẾT QUẢ ĐÃ ĐẨY LÊN GITHUB CỦA TUẤN ANH

| Hạng Mục | Đường Dẫn File Cụ Thể Trong Repository | Mô Tả Chức Năng Của File | Link Trực Tiếp Tới File Trên GitHub |
|---|---|---|:---:|
| **Pipeline CI/CD** | `.github/workflows/ci.yml` | Tệp cấu hình GitHub Actions tự động hóa kiểm thử và kiểm tra chất lượng mã nguồn trên mỗi commit/PR. | [ci.yml](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml) |
| **Thực thể Dữ liệu** | `backend/src/HotelSaas.Domain/Entities/Tenant.cs`<br>`backend/src/HotelSaas.Domain/Entities/Property.cs`<br>`backend/src/HotelSaas.Domain/Entities/Room.cs`<br>`backend/src/HotelSaas.Domain/Entities/RoomType.cs`<br>`backend/src/HotelSaas.Domain/Entities/User.cs` | Các thực thể doanh nghiệp: Doanh nghiệp (`Tenant`), Chi nhánh khách sạn (`Property`), Phòng vật lý (`Room`), Hạng phòng (`RoomType`), Người dùng (`User`). | [Thư mục Entities](https://github.com/GinNgo/hotel-saas-v2/tree/develop/backend/src/HotelSaas.Domain/Entities) |
| **API Xác thực** | `backend/src/HotelSaas.WebApi/Controllers/AuthController.cs` | Controller xử lý Đăng ký tài khoản, Đăng nhập hệ thống, Cấp lại token (Refresh token), Chuyển đổi chi nhánh làm việc (`switch-context`). | [AuthController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs) |
| **Bảo mật Chi nhánh** | `backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs` | Middleware bắt buộc header `X-Property-Id`, xác thực quyền làm việc của nhân viên tại từng chi nhánh cụ thể theo cơ chế fail-closed. | [Middleware](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/TenantPropertyContextMiddleware.cs) |
| **Xử lý Quyền hạn** | `backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs` | Bộ xử lý phân quyền động (RBAC), kiểm tra user có đủ quyền (ví dụ: `ROOMS.Read`, `HOUSEKEEPING.Update`) trước khi cho phép gọi API. | [PermissionHandler](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs) |
| **Dữ liệu Mẫu** | `backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs` | Script tạo sẵn 2 khách sạn (Grand Hotel Sài Gòn & Phú Nhuận), 4 loại phòng mẫu và 3 tài khoản demo (Admin, Manager, Lễ tân). | [LocalDevDataSeeder.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs) |
| **Tài liệu Kỹ thuật** | `docs/srs/08-kpi-commitment.md`<br>`docs/implementation-phases.md`<br>`docs/p0-decisions.md` | Cam kết 13 KPI nghiệp vụ, tài liệu phân kỳ 8 giai đoạn (P0–P7) và 10 quyết định thiết kế kiến trúc chuẩn. | [implementation-phases.md](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/implementation-phases.md) |

---

## 4. TỰ ĐÁNH GIÁ VÀ KẾ HOẠCH TUẦN 2 CỦA TUẤN ANH
- **Mức độ hoàn thành Tuần 1:** 100% nhiệm vụ đề ra. Hệ thống backend đã chạy ổn định, vượt qua pipeline CI/CD, sẵn sàng cung cấp API cho 2 thành viên Frontend.
- **Kế hoạch Tuần 2:**
  - Xây dựng Pricing Engine tính tiền phòng theo giờ và theo đêm kèm phụ thu check-in sớm / check-out muộn.
  - Viết API Quản lý chính sách chi nhánh (`/api/properties/{id}/policies`) và Bảng giá (`/api/room-types/{id}/rates`).
  - Hỗ trợ review và merge Pull Request của Nguyên (`feature/nguyen-rooms`) và Tân (`feature/tan-housekeeping`).
