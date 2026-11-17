# BÁO CÁO TIẾN ĐỘ TUẦN 06 (P7B) VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)
## NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS (HOTEL SAAS PLATFORM V2)

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**  
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

---

## THÔNG TIN CHUNG

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Sinh viên thực hiện:** Trần Trọng Tân — MSSV: `24TX810025`
* **Email sinh viên:** `24tx810025@student.hcmute.edu.vn`
* **Tài khoản GitHub:** [`trantrongtan096`](https://github.com/trantrongtan096)
* **Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 06:** 10/11/2026 – 18/11/2026
* **Kho mã nguồn chính thức:** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh tích hợp:** `fix/week6-ux-rbac-stabilization` $\to$ `develop` $\to$ `main`
* **Kế hoạch quy chiếu:** [`docs/team/PROMPT-TUAN-6-THUC-THI-NHOM.md`](../team/PROMPT-TUAN-6-THUC-THI-NHOM.md) (Tasks T01–T02)

---

## PHẦN I. TỔNG QUAN KẾT QUẢ THỰC HIỆN TUẦN 06

Trong Tuần 06, em tập trung giải quyết dứt điểm yêu cầu nâng cao của Giảng viên hướng dẫn về **kiểm thử tự động E2E chứng minh cô lập dữ liệu chéo chi nhánh ở tầng HTTP API**, làm mới bộ kiểm thử **Bruno API Collection** theo môi trường Staging với ngày động, và ổn định bộ test nghiệp vụ **hoàn tiền D23** tránh lỗi lệch múi giờ.

| Mã Task | Hạng Mục Công Việc | Kết Quả Triển Khai Thực Tế | Kiểm Thử Tự Động | Trạng Thái |
| :---: | :--- | :--- | :---: | :---: |
| **T01** | **Bộ test HTTP E2E cô lập chéo chi nhánh (`CrossBranchSecurityE2ETests.cs`)** | Xây dựng `backend/tests/HotelSaas.WebApi.Tests/Security/CrossBranchSecurityE2ETests.cs` đi qua **100% pipeline HTTP thực tế** (`WebApplicationFactory<Program>` + `JwtService` thật + `TenantPropertyContextMiddleware` + PostgreSQL, **không mock** `ICurrentTenantService`/`ICurrentPropertyService`). | **7/7 `[Fact]` PASS** trên CI PostgreSQL | **100% (ĐẠT)** |
| **T02** | **Làm mới Bruno Collection (`tests/bruno/hotel-saas/`)** | Bổ sung `environments/Staging.bru` trỏ `https://luxustay.duckdns.org` (không dùng `dev-mock-token:`); thay toàn bộ ngày quá khứ cố định (`2026-11-20`) bằng `script:pre-request` tự động tính ngày tương lai (`+7`/`+8` ngày). | Kiểm tra 0 ngày cố định cũ còn sót trong `tests/bruno/` | **100% (ĐẠT)** |
| **Fix** | **Ổn định test ca thu ngân D23 (`RefundApprovalManagementTests.cs`)** | Sửa lỗi flaky xảy ra khi chạy test vào khung giờ chuyển ca **22:00 UTC+7** tại `RefundApprovalManagementTests.cs` (commit `48184cc`, PR #26). | **15/15 test methods PASS** trên CI | **100% (ĐẠT)** |

---

## PHẦN II. NỘI DUNG KỸ THUẬT CHI TIẾT

### 1. Bộ Test HTTP E2E Cô Lập Chéo Chi Nhánh (`CrossBranchSecurityE2ETests.cs`)

* **Kiến trúc kiểm thử:** Khởi tạo `WebApplicationFactory<Program>` gắn với schema PostgreSQL test cô lập (`[Collection("RealDatabaseTests")]`), seed 2 Tenant độc lập (`Tenant A` có 2 chi nhánh `BranchA` & `BranchB`; `Tenant B` có chi nhánh riêng), ký JWT Token **thật** qua `JwtService` với đầy đủ `TenantId`, `PropertyId`, `Permissions` claims.
* **7 kịch bản Fail-Closed được chứng minh qua HTTP thực tế:**
  1. `CrossBranch_GetRooms_HeaderTamper_Returns403_And_ScopedQueryOnlyReturnsOwnBranch`: Nhân viên `BranchA` gửi `GET /api/rooms` giả mạo header `X-Property-Id: {BranchB}` $\to$ `403 Forbidden`; truy vấn đúng chi nhánh chỉ trả phòng của `BranchA`.
  2. `CrossBranch_CheckInOtherBranchReservation_Returns403Or404_NeverMutates`: Nhân viên `BranchA` gọi `POST /api/reservations/{ReservationOfBranchB}/check-in` $\to$ `403/404`, dữ liệu đặt phòng `BranchB` không bị thay đổi.
  3. `CrossBranch_PaymentsAndFolio_BlocksOtherBranchAccess`: Chặn truy cập chéo `/api/payments` và folio của chi nhánh khác (`403 Forbidden`).
  4. `CrossBranch_Reports_BlocksBranchStaffFromOtherBranchAndGroupAnalytics`: Chặn nhân viên cấp chi nhánh truy cập `GET /api/reports/revenue-summary` của chi nhánh khác và chặn truy cập báo cáo toàn tập đoàn (`403 Forbidden`).
  5. `CrossBranch_SwitchContext_BlocksBranchStaffEscalatingToHqOrOtherBranch`: Ngăn chặn leo thang quyền khi nhân viên chi nhánh cố đổi ngữ cảnh sang HQ hoặc chi nhánh khác.
  6. `CrossTenant_HeaderAndResourceIsolation_BlocksTenantAFromTenantB`: Chặn tuyệt đối truy cập chéo giữa `Tenant A` và `Tenant B`.
  7. `Reports_UncollectedReservations_DoNotSimulateFakePaymentDistribution`: Xác minh báo cáo doanh thu không tự bịa số liệu phương thức thanh toán khi chưa phát sinh giao dịch thu tiền thật.

### 2. Làm Mới Bruno API Collection (`tests/bruno/hotel-saas/`)

* Tạo mới [`tests/bruno/hotel-saas/environments/Staging.bru`](../../tests/bruno/hotel-saas/environments/Staging.bru) trỏ tới `https://luxustay.duckdns.org` với các biến mẫu cho kiểm thử Staging (loại bỏ `dev-mock-token:` vì backend Staging đã khóa token giả).
* Cập nhật các file `02_Calculate_Quote.bru`, `03_Hold_Anonymous_Without_Token_Rejected.bru`, `04_Hold_Anonymous_Mismatched_Token_Rejected.bru`, và `05_Hold_Anonymous_Valid_Token_Success.bru` sử dụng `script:pre-request` tính toán động `checkInDate` (`+7 ngày`), `checkOutDate` (`+8 ngày`), `startAtUtc`, `endAtUtc` qua `bru.setVar(...)`, loại bỏ hoàn toàn ngày cố định quá khứ `2026-11-20`.

### 3. Sửa Lỗi Ranh Giới Ca 22:00 UTC+7 (`RefundApprovalManagementTests.cs`)

* Khi chạy kiểm thử vào thời điểm chuyển giao ngày/ca tại Việt Nam (sau 22:00 VN / 15:00 UTC), hàm tạo ngày trong `RefundApprovalManagementTests.cs` bị lệch biên ca giao dịch.
* Đã chuẩn hóa mốc thời gian test trong commit [`48184cc`](https://github.com/GinNgo/hotel-saas-v2/commit/48184cc) ([PR #26](https://github.com/GinNgo/hotel-saas-v2/pull/26)), giúp toàn bộ 15/15 test hoàn tiền D23 chạy ổn định 24/24 giờ.

---

## PHẦN III. MINH CHỨNG MÃ NGUỒN, KIỂM THỬ & KHAI BÁO AI

### 1. Kết Quả Kiểm Thử Xác Thực

* **GitHub Actions CI (`CI Pipeline` Run `44152640902`, PostgreSQL 17 thật):**
  * **633 / 633** Backend tests **PASS** (`541` Application + `1` Domain + `91` WebApi, bao gồm đủ `7/7` tests trong `CrossBranchSecurityE2ETests.cs` và `15/15` tests trong `RefundApprovalManagementTests.cs`).
  * **640 / 640** Frontend Vitest tests **PASS** (`52` test files trên `fix/week6-ux-rbac-stabilization`, sau lượt CI Run `44152640902` ghi nhận `632/632` ở `51` files).
* *Ghi nhận trung thực về môi trường local:* Trên máy local khi container PostgreSQL `5435` chưa khởi động, chỉ các unit test non-DB (`303/303`) chạy trực tiếp; toàn bộ các integration/E2E test dùng database thật đều đã được xác minh pass 100% trên CI PostgreSQL của GitHub Actions.

### 2. Bảng Khai Báo Sử Dụng AI (AI Disclosure)

| Lần | Công Cụ AI | Nhiệm Vụ | Sai Sót Thực Tế của AI & Sinh Viên Chỉnh Sửa | Commit / PR |
| :---: | :--- | :--- | :--- | :---: |
| **#01** | Google Antigravity IDE / OpenAI Codex | Viết `CrossBranchSecurityE2ETests.cs` | AI ban đầu viết URL sai dạng `/api/v1/properties/.../rooms` (WebApi dùng `/api/rooms`) và gợi ý mock `ICurrentTenantService` thay vì test HTTP thật $\to$ Em yêu cầu sửa lại đúng route `/api/rooms`, `/api/reservations`, `/api/payments`, `/api/reports` và dùng `JwtService` + `TenantPropertyContextMiddleware` thật. | `a634207` / PR #23 |
| **#02** | Google Antigravity IDE / OpenAI Codex | Bruno API Collection | AI sinh collection ban đầu giữ ngày tĩnh `2026-11-20` và chưa tạo environment Staging $\to$ Em chuyển sang `script:pre-request` tính ngày động (`+7`/`+8` ngày) và tạo `Staging.bru` không dùng `dev-mock-token:`. | `fix/week6-ux-rbac-stabilization` |
| **#03** | Google Antigravity IDE / OpenAI Codex | Ổn định D23 `RefundApprovalManagementTests` | Test ban đầu bị phụ thuộc mốc giờ chạy thực tế lúc 22:00 UTC+7 gây flaky $\to$ Em cố định mốc ca hợp lệ trong test fixture để pass ổn định trên mọi múi giờ CI và local. | `48184cc` / PR #26 |

---

## PHẦN IV. KẾ HOẠCH TUẦN 07 (P8)
1. Đối chiếu toàn diện phân quyền `HOUSEKEEPING:ReadUpdate` cho vai trò `HOUSEKEEPER` giữa `RoomsController.cs` và `SeedData.cs`.
2. Refactor các Fat Operations Controller sang thuần MediatR CQRS và bổ sung FluentValidation cho Reservation/Payment.
3. Mở rộng ma trận kiểm thử E2E phủ âm tính RBAC đầy đủ cho 18 `PermissionFunction`.
