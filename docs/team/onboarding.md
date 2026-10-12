# 🚀 Hướng Dẫn Khởi Đầu Nhanh Dành Cho Kỹ Sư Phát Triển (Developer Onboarding Guide)
## Dự Án: Hotel SaaS Platform v2 (.NET 10 + PostgreSQL 17 + Angular 22)

> **Mã tài liệu:** `TEAM-DOC-ONBOARDING` | **Phiên bản:** 1.1 (Hiệu chỉnh an toàn thông tin & credentials)  
> **Áp dụng cho:** Kỹ sư Nguyên (FE/BE), Kỹ sư Tân (FE/BE), các thành viên mới gia nhập dự án.  
> **Nguyên tắc cốt lõi:**  
> 1. Mỗi kỹ sư sở hữu một **Cơ sở dữ liệu Local độc lập** (`hotel_saas_dev_{username}`).  
> 2. Bắt buộc bật cờ `"SkipStartupDatabaseInit": true` để tránh tự động chạy DDL/EnsureCreated phá hỏng schema.  
> 3. Cài đặt Frontend tái lập 100% bằng lệnh `npm ci` và sử dụng hoàn toàn **Local CLI** từ `node_modules` (không yêu cầu cài đặt global CLI tùy tiện).  
> 4. Không hardcode mật khẩu trong tài liệu hoặc câu lệnh terminal.

---

## 1. YÊU CẦU MÔI TRƯỜNG PHÁT TRIỂN (PREREQUISITES & BASELINE VERSIONS)

Tất cả các công cụ và phiên bản runtime được kiểm tra và khóa chính xác theo file cấu hình trong repository:

| Thành Phần | Phiên Bản Chuẩn | Kiểm Tra Phiên Bản | Nguồn Căn Cứ Trong Repo |
| :--- | :--- | :--- | :--- |
| **Hệ Điều Hành** | Windows 10/11 (khuyến nghị WSL2), macOS hoặc Ubuntu Linux | `uname -a` hoặc `systeminfo` | Quy chuẩn công ty |
| **.NET SDK** | **.NET 10.0** (`>= 10.0.100`) | `dotnet --version` | `backend/HotelSaas.slnx`, `*.csproj` |
| **PostgreSQL** | **PostgreSQL 17** | `psql --version` | Yêu cầu extension `btree_gist` và composite exclusion |
| **Node.js** | **v22.22.3** *(Dải hỗ trợ: `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0`)* | `node -v` | Khóa tại `frontend/package-lock.json:83, 103, 130` |
| **Package Manager** | **npm 11.13.0** | `npm -v` | Khóa tại `frontend/package.json:12` (`"packageManager": "npm@11.13.0"`) |
| **Angular** | **Angular v22.2.0** (`@angular/cli: ^22.2.1`) | `npx ng version` | `frontend/package.json:15, 34` |

> [!IMPORTANT]
> **Quy Tắc CLI Bắt Buộc:**  
> Không cài đặt `@angular/cli` hay `typescript` toàn cục (global) với các phiên bản không tương thích.  
> Luôn khởi chạy lệnh qua npm scripts (`npm start`, `npm run build`, `npm test`) hoặc thông qua trình thực thi cục bộ `npx ng`.

---

## 2. QUY TRÌNH THIẾT LẬP MÔI TRƯỜNG LOCAL TỪNG BƯỚC (STEP-BY-STEP SETUP)

### Bước 1: Lấy Mã Nguồn & Cài Đặt Dependencies

```bash
# 1. Clone repository (nếu chưa clone)
git clone <REPO_URL> hotel-saas-v2
cd hotel-saas-v2

# 2. Khôi phục dependencies cho Backend (.NET 10)
cd backend
dotnet restore HotelSaas.slnx
cd ..

# 3. Cài đặt sạch dependencies cho Frontend theo đúng lockfile
cd frontend
npm ci
cd ..
```

---

### Bước 2: Thiết Lập Database Local Riêng Biệt (Controlled Database Setup)

> [!CAUTION]
> **CẢNH BÁO AN TOÀN DỮ LIỆU:**  
> Tuyệt đối KHÔNG trỏ chuỗi kết nối vào cơ sở dữ liệu `hotel_saas_dev` dùng chung, staging `hotel_saas_staging` hoặc production.  
> Tên database local bắt buộc tuân theo định dạng: `hotel_saas_dev_<username_cua_ban>` (ví dụ: `hotel_saas_dev_nguyen`, `hotel_saas_dev_tan`).

Mở công cụ dòng lệnh PostgreSQL (`psql`) hoặc giao diện quản lý (DBeaver, pgAdmin):

```sql
-- 1. Tạo database riêng cho bạn
CREATE DATABASE hotel_saas_dev_nguyen;

-- 2. Kết nối vào database mới tạo
\c hotel_saas_dev_nguyen;

-- 3. Kích hoạt extension btree_gist tại schema public (yêu cầu cho GiST exclusion index)
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

---

### Bước 3: Cấu Hình File `appsettings.Development.json`

Mở file `backend/src/HotelSaas.WebApi/appsettings.Development.json` và cấu hình như sau:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=hotel_saas_dev_nguyen;Username=postgres;Password=postgres"
  },
  "JwtSettings": {
    "SecretKey": "DevOnly_SuperSecretKey_ChangeInProduction_AtLeast32Chars!",
    "Issuer": "HotelSaas",
    "Audience": "HotelSaasClient",
    "AccessTokenExpirationMinutes": 60,
    "RefreshTokenExpirationDays": 7
  },
  "SkipStartupDatabaseInit": true,
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.EntityFrameworkCore": "Information"
      }
    }
  }
}
```

> [!WARNING]
> **Hai quy chuẩn cấu hình bắt buộc:**
> 1. `"SkipStartupDatabaseInit": true`: Chặn đứng lệnh `EnsureCreatedAsync()` ngầm định trong `Program.cs` để bảo vệ lịch sử migrations.
> 2. `"SecretKey"`: Bắt buộc dài **tối thiểu 32 ký tự (256 bits)**. Nếu ngắn hơn, `JwtKeyValidator` sẽ ném ngoại lệ dừng ứng dụng ngay khi khởi động (`fail-fast`).

---

### Bước 4: Chạy Migration Bằng EF Core CLI (Có Kiểm Soát)

```bash
cd backend
# Áp dụng migrations chính thức vào DB riêng
dotnet ef database update --project src/HotelSaas.Infrastructure --startup-project src/HotelSaas.WebApi
cd ..
```

---

### Bước 5: Khởi Tạo Dữ Liệu Giả Local (Provisioning Bằng `BE-SEED-01`)

Repository cung cấp sẵn công cụ Seeding độc lập, an toàn và có tính lũy kế (idempotent) theo Ticket `BE-SEED-01`.

> [!TIP]
> **Quy Tắc Nhập Mật Khẩu An Toàn (Secure Credential Input):**  
> 1. **Mật khẩu do người chạy tự cung cấp:** Công cụ KHÔNG hardcode mật khẩu mặc định cố định. Bạn tự chọn mật khẩu khởi tạo (yêu cầu tối thiểu 8 ký tự).  
> 2. **Tránh lưu mật khẩu vào lịch sử lệnh (Shell History):** Không nên gõ trực tiếp mật khẩu dạng plain text vào dòng lệnh terminal để tránh bị lưu vào `Get-History` (PowerShell) hoặc `~/.bash_history`. Khuyến khích sử dụng prompt tương tác an toàn hoặc biến môi trường tạm thời.  
> 3. **Bảo toàn mật khẩu khi chạy lại (Idempotency):** Nếu chạy lại lệnh seed nhiều lần, công cụ sẽ **giữ nguyên mật khẩu hiện có** của các tài khoản đã tồn tại, không bị ghi đè.

#### Cách 5.1: Chạy bằng PowerShell Script với Prompt Bảo Mật (Khuyến nghị cho Windows)
```powershell
# Nhập mật khẩu CSDL an toàn qua prompt (ẩn ký tự):
$dbPass = Read-Host -Prompt "Nhập mật khẩu PostgreSQL local" -AsSecureString
$dbPassBSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPass)
$dbPassPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($dbPassBSTR)

# Nhập mật khẩu mong muốn cho các tài khoản test:
$seedPass = Read-Host -Prompt "Nhập mật khẩu cho các tài khoản test (>= 8 ký tự)"

# Thực thi script seed (tự động nhận diện username máy tính):
.\scripts\seed-local-dev.ps1 -DbPassword $dbPassPlain -DefaultPassword $seedPass
```

#### Cách 5.2: Chạy bằng .NET CLI thông qua Biến Môi Trường (Đa nền tảng Windows / macOS / Linux)
```bash
# Thiết lập biến môi trường tạm thời trong session hiện tại:
export DEV_DB_CONNECTION="Host=localhost;Port=5432;Database=hotel_saas_dev_nguyen;Username=postgres;Password=postgres"
export SEED_DEFAULT_PASSWORD="<MatKhauTuChon_ToiThieu8KyTu>"

# Thực thi công cụ seeding:
dotnet run --project scripts/SeedLocalDev

# Xóa biến môi trường sau khi chạy:
unset SEED_DEFAULT_PASSWORD
```

---

## 3. THÔNG TIN TÀI KHOẢN VÀ DỮ LIỆU ĐÃ ĐƯỢC VERIFIED

> [!IMPORTANT]
> **Phân Tách Rõ Ràng Môi Trường:**  
> - Bảng dưới đây là **Tài khoản Local** được khởi tạo trên máy cá nhân của bạn thông qua lệnh seed ở Bước 5. Mật khẩu đăng nhập chính là **mật khẩu bạn đã truyền khi chạy seed**.  
> - Các tài khoản cho môi trường Staging **CHƯA ĐƯỢC PROVISION** và sẽ được cấp phát riêng qua Enterprise Vault khi hạ tầng Staging được thiết lập.

| Tài Khoản / Email | Mật Khẩu Đăng Nhập | Họ Tên | Phạm Vi Quyền Hạn (Membership) | Mục Đích Kiểm Thử |
| :--- | :--- | :--- | :--- | :--- |
| `owner@hotelsaas.local` | *(Mật khẩu bạn truyền khi seed)* | Nguyễn Văn Chủ | **Tenant-Wide** (`PropertyId = null`, Role: `OWNER`) | Kiểm thử quyền sở hữu toàn bộ tập đoàn khách sạn `GHG`. |
| `manager.both@hotelsaas.local` | *(Mật khẩu bạn truyền khi seed)* | Trần Quản Lý | **2 Chi Nhánh:**<br/>• `CN-Q1` (Quận 1)<br/>• `CN-PN` (Phú Nhuận) | **Trọng tâm `FE-AUTH-01`**: Kiểm thử luồng login nhận 2 chi nhánh và gọi `POST /api/auth/switch-context`. |
| `staff.single@hotelsaas.local` | *(Mật khẩu bạn truyền khi seed)* | Lê Lễ Tân | **1 Chi Nhánh duy nhất:**<br/>• `CN-Q1` (Quận 1) | Kiểm thử đăng nhập chuyển thẳng vào Dashboard chi nhánh, không cần chọn. |

### Dữ Liệu Phòng Đã Tạo Mẫu:
- **Chi nhánh Quận 1 (`CN-Q1`):**
  - Loại phòng: `DLX-Q1` (Deluxe Double - 1.200.000đ), `STD-Q1` (Standard Twin - 800.000đ).
  - Phòng: `101` (Clean), `102` (Dirty - phục vụ test buồng phòng), `201` (Clean).
- **Chi nhánh Phú Nhuận (`CN-PN`):**
  - Loại phòng: `SUI-PN` (Executive Suite - 2.000.000đ), `SUP-PN` (Superior King - 1.000.000đ).
  - Phòng: `301` (Clean), `302` (Cleaning - phục vụ test buồng phòng), `401` (Clean).

---

## 4. KHỞI CHẠY ỨNG DỤNG VÀ CHẠY KIỂM THỬ

### 4.1. Khởi Chạy Backend API
```bash
cd backend
dotnet run --project src/HotelSaas.WebApi
```
- **Backend API URL:** `http://localhost:5283`
- **Swagger Documentation UI:** `http://localhost:5283/swagger`

### 4.2. Khởi Chạy Frontend Web
Mở một cửa sổ Terminal khác:
```bash
cd frontend
npm start
```
- **Frontend App URL:** `http://localhost:4200`
- Cấu hình API endpoint trong frontend trỏ mặc định tới: `http://localhost:5283/api` (tại `src/environments/environment.development.ts`).

### 4.3. Chạy Toàn Bộ Bộ Kiểm Thử Tự Động (Regression Test Suite)
```bash
cd backend
dotnet test HotelSaas.slnx
```
*Tiêu chí thành công:* Toàn bộ 220 bài test phải đạt **PASS 100% (0 errors, 0 warnings)**.

---

## 5. XỬ LÝ CÁC VẤN ĐỀ THƯỜNG GẶP (TROUBLESHOOTING GUIDE)

1. **Lỗi `InvalidOperationException: JWT SecretKey is not configured or is empty / too short`:**
   - *Nguyên nhân:* Chuỗi bí mật `JwtSettings:SecretKey` trong file cấu hình ngắn hơn 32 ký tự.
   - *Khắc phục:* Đổi giá trị `SecretKey` thành chuỗi ký tự bất kỳ có độ dài $\ge 32$ ký tự.

2. **Lỗi `403 Forbidden` hoặc `ERR_PROPERTY_REQUIRED` khi gọi `/api/rooms`:**
   - *Nguyên nhân:* Bạn đang sử dụng token chưa được gắn ngữ cảnh chi nhánh (Bootstrap Token sau khi login tài khoản có $\ge 2$ chi nhánh).
   - *Khắc phục:* Gọi API `POST /api/auth/switch-context` với body `{"propertyId": "<guid>"}` để nhận Scoped Token có chứa claim `property_id`.

3. **Lỗi `409 Conflict: Target database is NOT an authorized dev database` khi chạy Seeder:**
   - *Nguyên nhân:* Tên database bạn truyền vào vi phạm quy tắc an toàn (ví dụ: gõ nhầm `hotel_saas_dev`, chứa từ `staging`, `prod` hoặc database hệ thống).
   - *Khắc phục:* Đảm bảo tên database bắt đầu bằng `hotel_saas_dev_` kèm theo tên bạn (ví dụ: `hotel_saas_dev_nguyen`).

4. **Lỗi CORS (`Cross-Origin Request Blocked`):**
   - *Nguyên nhân:* Frontend đang khởi chạy ở port khác `4200` (ví dụ `4201` do trùng port).
   - *Khắc phục:* Kiểm tra tiến trình đang chiếm port 4200 và tắt đi, sau đó chạy lại `npm start` để frontend luôn chạy đúng port 4200 (đã được whitelist trong CORS policy của backend).
