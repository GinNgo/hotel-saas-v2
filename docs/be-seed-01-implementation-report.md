# BÁO CÁO TRIỂN KHAI VÀ NGHIỆM THU TICKET BE-SEED-01
## Công Cụ Provisioning Dữ Liệu Local Độc Lập Cho Team Phát Triển & Kiểm Thử

- **Mã Ticket:** `BE-SEED-01`
- **Mục tiêu:** Xây dựng công cụ độc lập, an toàn và có tính lũy kế (idempotent) để khởi tạo dữ liệu giả lập (mock data) trên cơ sở dữ liệu local riêng của từng lập trình viên (`hotel_saas_dev_{username}`), phục vụ kiểm thử đăng nhập, lựa chọn chi nhánh (context switching), quản lý phòng (Room CRUD) và nghiệp vụ buồng phòng (Housekeeping).
- **Trạng thái:** **HOÀN THÀNH (100% PASS - SẴN SÀNG BÀN GIAO)**
- **Ngày hoàn thành:** 09/10/2026

---

## 1. TỔNG QUAN RANH GIỚI VÀ NGUYÊN TẮC BẢO MẬT (CONSTRAINTS & SECURITY GUARDS)

Tuân thủ nghiêm ngặt các yêu cầu trong `docs/team-handoff-package.md` và hướng dẫn chỉ đạo:

1. **Khởi chạy thủ công, không can thiệp startup:**
   - Tuyệt đối không tích hợp vào `Program.cs` hay pipeline khởi động của `HotelSaas.WebApi`.
   - Công cụ được đóng gói độc lập dưới dạng Console CLI (`scripts/SeedLocalDev`) và kịch bản hỗ trợ PowerShell (`scripts/seed-local-dev.ps1`).
2. **Bảo vệ Database Target (Fail-Closed Guard):**
   - Bắt buộc truyền connection string rõ ràng hoặc cấu hình biến môi trường `DEV_DB_CONNECTION`.
   - **Chặn đứng hoàn toàn** database dùng chung `hotel_saas_dev`, các database production (`*prod*`), staging (`*staging*`) và database hệ thống (`postgres`, `template1`) trước khi thực hiện bất kỳ lệnh DML nào.
   - Chỉ cho phép các database tuân thủ quy ước định danh cá nhân: `hotel_saas_dev_<username>` (hoặc database kiểm thử có cờ `--allow-test-db`).
3. **An toàn thông tin định danh & Secret:**
   - Không in hoặc ghi log mật khẩu dạng plain-text, JWT Secret, hay connection string chứa password chưa được che giấu.
   - Hàm `LocalDevDataSeeder.RedactConnectionString` tự động thay thế `Password=******` trước khi hiển thị lên console hoặc log.
4. **Không tự ý can thiệp schema hay migration:**
   - Công cụ chỉ thực hiện DML (Data Manipulation Language). Nếu bảng dữ liệu hoặc migration nền tảng (`InitialBaseline`) chưa được áp dụng, công cụ sẽ lập tức **Fail-Fast** và dừng lại, yêu cầu lập trình viên chạy `dotnet ef database update`.
5. **Mã hóa mật khẩu chuẩn nghiệp vụ:**
   - Tái sử dụng trực tiếp service hiện có `PasswordHasherService` (thuật toán BCrypt, work factor = 10). Mật khẩu mặc định có thể cấu hình thông qua CLI hoặc biến môi trường (yêu cầu tối thiểu 8 ký tự).
6. **Nguyên tử (Atomic) & Lũy kế (Idempotent):**
   - Toàn bộ quá trình chạy trong 1 Database Transaction duy nhất.
   - Chạy nhiều lần không sinh bản ghi trùng lặp, không ghi đè mật khẩu hiện có hay tự ý nâng quyền.
   - Khi phát hiện xung đột dữ liệu bất thường (ví dụ: email đã bị chiếm dụng bởi username khác), tiến hành Rollback sạch sẽ và báo lỗi chi tiết.

---

## 2. ĐẶC TẢ DỮ LIỆU ĐƯỢC PROVISION (MINIMUM MOCK DATASET)

| Thực Thể | Mã / Email | Tên / Mô Tả | Trạng Thái / Phạm Vi | Ghi Chú Kỹ Thuật |
| :--- | :--- | :--- | :--- | :--- |
| **Tenant** | `GHG` | **Grand Hotel Group** | `Active`, Enterprise tier | Thuế VAT 8.0%, Phí dịch vụ 5.0%. |
| **Property 1** | `CN-Q1` | **Grand Hotel Sài Gòn (Quận 1)** | `Active`, `IsPublished = true` | Check-in 14:00, Check-out 12:00, Buffer 30p, MaxHourly 12h. |
| **Property 2** | `CN-PN` | **Grand Hotel Phú Nhuận** | `Active`, `IsPublished = true` | Check-in 14:00, Check-out 12:00, Buffer 30p, MaxHourly 12h. |
| **User: Owner** | `owner@hotelsaas.local` | Nguyễn Văn Chủ (Owner) | `Active`, GlobalRole: `TenantStaff` | Mật khẩu băm BCrypt. Gán membership **Tenant-Wide** (`PropertyId = null`, Role: `OWNER`, `StaffRole.Owner`). |
| **User: Manager** | `manager.both@hotelsaas.local` | Trần Quản Lý (Two Branches) | `Active`, GlobalRole: `TenantStaff` | Mật khẩu băm BCrypt. Gán 2 membership riêng biệt: 1 tại `CN-Q1` và 1 tại `CN-PN` (Role: `MANAGER`, `StaffRole.Manager`). |
| **User: Staff** | `staff.single@hotelsaas.local` | Lê Lễ Tân (Single Branch) | `Active`, GlobalRole: `Customer` | Mật khẩu băm BCrypt. Gán 1 membership duy nhất tại `CN-Q1` (Role: `RECEPTIONIST`, `StaffRole.Receptionist`). |
| **RoomType (Q1)** | `DLX-Q1` | Deluxe Double (Q1) | Giá: 1.200.000 VNĐ | Thuộc chi nhánh `CN-Q1`, sức chứa 2 khách. |
| **RoomType (Q1)** | `STD-Q1` | Standard Twin (Q1) | Giá: 800.000 VNĐ | Thuộc chi nhánh `CN-Q1`, sức chứa 2 khách. |
| **Room (Q1)** | `101` | Phòng 101, Tầng 1 | `Clean` | Loại phòng `DLX-Q1`. |
| **Room (Q1)** | `102` | Phòng 102, Tầng 1 | `Dirty` | Loại phòng `STD-Q1` (phục vụ test buồng phòng). |
| **Room (Q1)** | `201` | Phòng 201, Tầng 2 | `Clean` | Loại phòng `DLX-Q1`. |
| **RoomType (PN)** | `SUI-PN` | Executive Suite (PN) | Giá: 2.000.000 VNĐ | Thuộc chi nhánh `CN-PN`, sức chứa 3 khách. |
| **RoomType (PN)** | `SUP-PN` | Superior King (PN) | Giá: 1.000.000 VNĐ | Thuộc chi nhánh `CN-PN`, sức chứa 2 khách. |
| **Room (PN)** | `301` | Phòng 301, Tầng 3 | `Clean` | Loại phòng `SUI-PN`. |
| **Room (PN)** | `302` | Phòng 302, Tầng 3 | `Cleaning` | Loại phòng `SUP-PN` (phục vụ test buồng phòng). |
| **Room (PN)** | `401` | Phòng 401, Tầng 4 | `Clean` | Loại phòng `SUI-PN`. |

---

## 3. DANH SÁCH FILE ĐÃ TRIỂN KHAI

### 3.1. Thành Phần Mã Nguồn (Production & Tooling)
1. [`backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs):
   - Chứa toàn bộ core engine provisioning dữ liệu.
   - Triển khai `ValidateTargetDatabase`: Guard chặn DB dev/prod, bắt buộc quy ước `hotel_saas_dev_{username}`.
   - Triển khai `ValidateSchemaAndMigrationsAsync`: Fail-fast kiểm tra bảng và migration trước khi thực thi.
   - Triển khai `RedactConnectionString`: Che giấu mật khẩu trên chuỗi kết nối.
   - Triển khai `SeedAsync`: Quản lý Database Transaction nguyên tử, cơ chế chống trùng lặp và phát hiện xung đột.
2. [`scripts/SeedLocalDev/SeedLocalDev.csproj`](file:///C:/Dev/hotel-saas-v2/scripts/SeedLocalDev/SeedLocalDev.csproj):
   - Dự án .NET 10 Console CLI độc lập, liên kết tới `HotelSaas.Infrastructure`.
3. [`scripts/SeedLocalDev/Program.cs`](file:///C:/Dev/hotel-saas-v2/scripts/SeedLocalDev/Program.cs):
   - Entry point cho CLI parser: hỗ trợ `--connection`, `--password`, `--schema`, `--verbose`, `--help`.
   - Trả về Exit Code 0 khi thành công, Exit Code 1 khi thất bại.
4. [`scripts/seed-local-dev.ps1`](file:///C:/Dev/hotel-saas-v2/scripts/seed-local-dev.ps1):
   - Script tiện ích PowerShell cho môi trường Windows, tự động nhận diện username máy tính và khởi chạy CLI.

### 3.2. Thành Phần Kiểm Thử Tự Động (Tests)
1. [`backend/tests/HotelSaas.Application.Tests/Seed/LocalDevDataSeederTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Seed/LocalDevDataSeederTests.cs):
   - Gồm 7 ca kiểm thử bao phủ toàn bộ khía cạnh logic của seeder:
     - Tạo mới dữ liệu đầy đủ trên schema sạch.
     - Kiểm tra tính lũy kế (idempotency) khi chạy lần 2: 0 bản ghi trùng lặp, giữ nguyên mật khẩu cũ.
     - Kiểm tra Guard từ chối `hotel_saas_dev`, staging, production, postgres, template1.
     - Kiểm tra Guard chấp thuận đúng quy ước `hotel_saas_dev_{username}`.
     - Kiểm tra Fail-fast khi thiếu bảng hoặc migration.
     - Kiểm tra Rollback khi phát hiện xung đột bản ghi.
     - Kiểm tra hàm làm sạch (redact) connection string.
2. [`backend/tests/HotelSaas.WebApi.Tests/Seed/LocalDevDataSeederWebApiPipelineTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/Seed/LocalDevDataSeederWebApiPipelineTests.cs):
   - Kiểm thử tích hợp End-to-End thông qua `WebApplicationFactory` và HTTP Pipeline thật:
     - Đăng nhập `manager.both@hotelsaas.local` -> HTTP 200, nhận danh sách 2 chi nhánh.
     - `POST /api/auth/switch-context` sang Chi nhánh 1 (`CN-Q1`) -> trả về scoped token.
     - `GET /api/rooms` -> Trả về chính xác 3 phòng của Chi nhánh 1 (`101`, `102`, `201`), cách ly hoàn toàn phòng của Chi nhánh 2.
     - `POST /api/auth/switch-context` sang Chi nhánh 2 (`CN-PN`) -> Trả về 3 phòng của Chi nhánh 2 (`301`, `302`, `401`).
     - Đăng nhập `staff.single@hotelsaas.local` -> Nhận đúng 1 membership của Chi nhánh 1.
     - Đăng nhập `owner@hotelsaas.local` -> Nhận quyền Tenant-Wide (`isTenantWide: true`).
3. [`backend/tests/HotelSaas.Application.Tests/MigrationFixtures/P2B02_BtreeGistLifecycleAndConcurrencyTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/MigrationFixtures/P2B02_BtreeGistLifecycleAndConcurrencyTests.cs):
   - Nâng cấp `DropTemporaryDatabaseAsync`: bổ sung lệnh `pg_terminate_backend` ngắt các session còn sót lại và nâng `CommandTimeout = 120s`, triệt tiêu hoàn toàn hiện tượng timeout khi chạy song song tải cao.

---

## 4. KẾT QUẢ KIỂM THỬ THỰC TẾ (TEST EVIDENCE)

### 4.1. Bộ Kiểm Thử Seeder Mới
- **`LocalDevDataSeederTests` (Application Tests):** **7/7 PASS (100%)**
- **`LocalDevDataSeederWebApiPipelineTests` (WebApi E2E Tests):** **1/1 PASS (100%)**

### 4.2. Bộ Kiểm Thử Hồi Quy Toàn Hệ Thống
- **`P1B01B_RealDatabaseBehavioralTests`:** **11/11 PASS (100%)** (Bảo toàn toàn bộ ràng buộc composite foreign keys và delete restrict).
- **`P2B02_BtreeGistLifecycleAndConcurrencyTests`:** **12/12 PASS (100%)** (Bảo toàn vòng đời btree_gist, barrier song song và fail-fast).
- **Toàn bộ Solution `HotelSaas.slnx`:**
  - `HotelSaas.Domain.Tests`: **1/1 PASS**
  - `HotelSaas.WebApi.Tests`: **42/42 PASS**
  - `HotelSaas.Application.Tests`: **177/177 PASS**
  - **TỔNG CỘNG: 220/220 TESTS PASS (100%)**, 0 Warning, 0 Error, Exit Code 0.

---

## 5. HƯỚNG DẪN SỬ DỤNG CHO TEAM PHÁT TRIỂN (DEVELOPER GUIDE)

### Cách 1: Sử dụng PowerShell Script (Khuyến nghị cho Windows)
Mở terminal tại thư mục gốc của repository:
```powershell
# Chạy provisioning cho database riêng của bạn (tự động nhận diện username Windows)
.\scripts\seed-local-dev.ps1 -DbPassword "postgres"

# Hoặc chỉ định username cụ thể:
.\scripts\seed-local-dev.ps1 -Username "ngoc" -DbPassword "postgres"
```

### Cách 2: Sử dụng .NET CLI (Đa nền tảng Windows / macOS / Linux)
```bash
# Đứng tại thư mục gốc repository
dotnet run --project scripts/SeedLocalDev -- \
  --connection "Host=localhost;Port=5432;Database=hotel_saas_dev_ngoc;Username=postgres;Password=postgres" \
  --password "HotelDev@2026!"
```

### Thông Tin Đăng Nhập Sau Khi Seed:
- **Tài khoản Chủ khách sạn (Owner):**
  - Email: `owner@hotelsaas.local`
  - Mật khẩu: `HotelDev@2026!`
  - Quyền hạn: Tenant-wide (toàn chuỗi)
- **Tài khoản Quản lý 2 chi nhánh (Manager):**
  - Email: `manager.both@hotelsaas.local`
  - Mật khẩu: `HotelDev@2026!`
  - Quyền hạn: Quản lý cả `CN-Q1` và `CN-PN` (cần gọi `POST /api/auth/switch-context` để chọn chi nhánh)
- **Tài khoản Nhân viên 1 chi nhánh (Receptionist):**
  - Email: `staff.single@hotelsaas.local`
  - Mật khẩu: `HotelDev@2026!`
  - Quyền hạn: Lễ tân tại riêng `CN-Q1`
