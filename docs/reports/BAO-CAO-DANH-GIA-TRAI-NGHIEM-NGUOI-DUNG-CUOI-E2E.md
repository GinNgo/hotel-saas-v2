# BÁO CÁO ĐÁNH GIÁ TRẢI NGHIỆM NGƯỜI DÙNG CUỐI (E2E UX & MULTI-TENANT SAAS RBAC)

**Hệ thống:** Hotel SaaS Platform v2 (`.NET 10` + `Angular 22` + `PostgreSQL 17`)  
**Môi trường kiểm thử thực tế:** Docker PostgreSQL 17 (`localhost:5435/hotel_saas_dev_ngoc`), Backend API (`http://localhost:5283`), Frontend Proxy (`http://localhost:3000`)  
**Phạm vi:** Trải nghiệm B2C Guest/Traveler, Partner Owner Onboarding & Chain HQ, Branch Staff RBAC & Cô lập đa thuê bao (Multi-Tenant Isolation)

---

## 1. TỔNG QUAN & ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG

| Nhóm trải nghiệm | Điểm UX / Kỹ thuật | Trạng thái | Tóm tắt thực tế |
| :--- | :---: | :---: | :--- |
| **1. B2C Marketplace & Booking Flow** (`/booking`, chi tiết, báo giá, giữ phòng 15 phút, tra cứu) | **8.5 / 10** | Đạt (Live Browser Part 1 + Live API) | Hiển thị **48** cơ sở lưu trú khởi tạo (**50** sau onboarding E2E) thuộc **6** chuỗi (`GHG`, `SCR`, `VEH`, `MBV`, `VHG`, `UEM`) và **8** loại hình (`Hotel`, `Resort`, `Hostel`, `BedAndBreakfast`, `Villa`, `Apartment`, `Motel`, `Homestay`). Giá, báo giá theo ngày/giờ, giữ phòng 15 phút (`900s`) và che PII hoạt động chính xác. |
| **2. Partner Self-Onboarding & Chain HQ** (`/auth/partner-register`, `/login`, `/properties`, Switch Context) | **8.5 / 10** | Đạt (Live API + Code Fix) | Đăng ký đối tác (`201 Created`, `2.32 s`) lên sàn B2C ngay lập tức và đăng nhập PMS (`200 OK`, không còn lỗi Dual-Verification `401`). Tạo chi nhánh 2 và chuyển ngữ cảnh `Chain HQ` / Chi nhánh hoạt động mượt; đã sửa lỗi `canViewChainHq()` ẩn nút chuyển HQ khi chuỗi mới có 1 chi nhánh. |
| **3. Multi-Tenant & Branch RBAC Isolation** (`Receptionist`, `Housekeeper`, Cross-Tenant) | **9.0 / 10** | Đạt (Sau khi vá 2 lỗi P0) | Chặn triệt để truy cập chéo chi nhánh (`403 ERR_PROPERTY_FORBIDDEN`), giả mạo `X-Tenant-Id` / `?propertyId` (`400 ERR_CONTEXT_MISMATCH`), và truy cập chéo tenant (`403`/`404`). Đã vá lỗi P0 lộ `SubscriptionsController` cho nhân viên và lỗi P0 `Housekeeper` bị chặn `403` khi cập nhật trạng thái phòng. |
| **4. Production Build & Background Services** (`prod-server.js`, `ExpiredHoldSweep`, `Seeder`) | **9.0 / 10** | Đạt (Sau khi vá lỗi P0) | Đã khắc phục lỗi màn hình trắng tinh trên `:3000` (do junction path khi `ng build`), lỗi `ForbiddenException` trong `ExpiredHoldSweepBackgroundService` và `RealData34ProvincesSeeder`. |

> **Ghi nhận phạm vi kiểm thử trình duyệt (Browser):** Phần 1 (`/booking`) đã được xác minh trực tiếp trên trình duyệt live (`http://localhost:3000/booking` với `0` request lỗi `>= 400`, `0` ảnh vỡ). Các phần 2–4 trên trình duyệt tương tác (`d92cde03`) gặp sự cố đóng băng IPC của `AUIT webview` (`timed out after 1m0s waiting for AUIT webview to fulfill browser action "script"`, `visited_origins: none`), nên được xác minh chuyên sâu qua Live HTTP API (`http://localhost:5283`) kết hợp Unit/Integration Test suite của Frontend và Backend.

---

## 2. CHI TIẾT CÁC LUỒNG ĐÃ KIỂM THỬ THỰC TẾ

### 2.1. Luồng B2C Guest / Traveler (Marketplace, Báo giá, Giữ phòng, Tra cứu)
- **Giao diện `/booking` trên trình duyệt thực tế (`http://localhost:3000/booking`):**
  - Ảnh chụp trước khi sửa bị màn hình trắng tinh; sau khi sửa và build lại từ đường dẫn gốc, `/booking` hiển thị đầy đủ giao diện Marketplace:
  - **8 tab loại hình lưu trú:** `Tất cả 50`, `Khách sạn (Hotel) 13`, `Resort 23`, `Homestay 5`, `Biệt thự (Villa) 4`, `Căn hộ (Apartment) 2`, `Nhà nghỉ / Motel 1`, `Hostel / B&B 2`.
  - **7 bộ lọc chuỗi:** `GHG 8`, `SCR 18`, `MBV 4`, `VEH 10`, `VHG 4`, `UEM 4`, `UX Hospitality Group 20261114161450 2`.
  - **Phân trang & media:** Nút `Xem thêm cơ sở lưu trú (còn 38 cơ sở)`, `0` request lỗi (`>= 400`), `0` ảnh vỡ (`naturalWidth !== 0`).
- **Hiệu năng & Dữ liệu API (`/api/public/*`):**
  - Thời gian phản hồi ấm (warm): `53–73 ms` (cold start: `5.2–7.1 s`).
  - `0` cơ sở thiếu thumbnail, `0` cơ sở rỗng gallery, `0` cơ sở giá `0 VND`.
- **Báo giá, Giữ phòng 15 phút & Tra cứu:**
  - Daily quote (2 đêm `la-do-pho-co-homestay`): `1,360,000 VND`; Hourly quote (3 giờ): `290,000 VND`; `an-lam-retreats-saigon-river` (3 giờ): `1,130,000 VND`.
  - `POST /api/public/bookings/hold`: Bắt buộc OTP (`400 ERR_PHONE_VERIFICATION_REQUIRED` nếu thiếu); khi hợp lệ trả về `201 Created` (`secondsRemaining = 900`, `depositRequired` 30%, ví dụ `RES-UT55SE` `1,360,000`, `RES-RZPSW7` `1,130,000`).
  - Che thông tin nhạy cảm (PII Masking) khi tra cứu: `N*** Traveler`, `b***0@hotelsaas.test`, `+84****567`.
  - Hủy sai thông tin liên hệ -> `403 ERR_VERIFICATION_FAILED`; gia hạn giữ phòng sớm (`> 180s`) -> `400 ERR_HOLD_EXTENSION_TOO_EARLY`.

### 2.2. Luồng Partner Owner Onboarding & Chain HQ
- **Tự đăng ký đối tác (`POST /api/auth/partner-register`):** Trả về `201 Created` (`2.32 s`), cơ sở mới xuất hiện ngay trên sàn B2C (`startingPrice: 750000`, `hourlyStartingPrice: 220000`, 3 phòng trống).
- **Đăng nhập PMS (`POST /api/auth/login`):** Thành công `200 OK` ngay lập tức (không gặp lỗi Dual-Verification `401`).
- **Mở rộng đa chi nhánh (`POST /api/properties`):** Tạo thành công Chi nhánh 2 (`201 Created`) kèm hạng phòng `STD`, 3 phòng `Clean` (`101..103`), và bảng giá hoạt động.
- **Chuyển ngữ cảnh (`GET /api/auth/me/memberships` & `POST /api/auth/switch-context`):** Chủ chuỗi thấy đủ 3 ngữ cảnh (`Chain HQ`, Chi nhánh 1, Chi nhánh 2) và chuyển đổi qua lại (`propertyId: null` cho `TenantWide` với 18 quyền `*:127`) thành công `200 OK`.

### 2.3. Luồng Branch Staff RBAC & Cô lập Đa Thuê Bao (Multi-Tenant Isolation)
- Tạo nhân viên Chi nhánh 2 (`RECEPTIONIST` & `HOUSEKEEPER` qua `POST /api/staff` `201 Created`) -> Đăng nhập ngay `200 OK` (`scope = PropertyScoped`, `propertyId = B2`).
- **Kiểm tra chặn leo thang đặc quyền & cô lập chi nhánh:**
  - Nhân viên gọi `POST /api/auth/switch-context` sang Chi nhánh 1 hoặc `Chain HQ` (`null`) -> `403 ERR_PROPERTY_FORBIDDEN`.
  - Giả mạo header `X-Property-Id: B1` -> `403 ERR_PROPERTY_FORBIDDEN`.
  - Truyền query param `?propertyId=B1` -> `400 ERR_CONTEXT_MISMATCH`.
  - Nhân viên truy cập `/api/reports/*` hoặc `POST /api/staff` -> `403 Forbidden`.
  - Nhân viên truy cập `GET /api/subscriptions/current` -> `403 Forbidden` (sau khi sửa), trong khi Owner -> `200 OK` (`currentRoomCount: 30, currentPropertyCount: 8`).
  - Housekeeper cập nhật trạng thái buồng phòng `PATCH /api/rooms/{id}/status` -> `200 OK` (`Clean -> Dirty -> Cleaning -> Clean`).
- **Kiểm tra cô lập liên thuê bao (Cross-Tenant):**
  - Giả mạo `X-Tenant-Id` giữa tenant mới và `GHG` -> `400 ERR_CONTEXT_MISMATCH`; `switch-context` -> `403 ERR_PROPERTY_FORBIDDEN`; `X-Property-Id` ngoại lai -> `404 ERR_PROPERTY_NOT_FOUND`.

---

## 3. CÁC LỖI P0 / P1 ĐÃ PHÁT HIỆN, KHẮC PHỤC & XÁC MINH

| Mức độ | Vấn đề phát hiện | File đã sửa | Kết quả xác minh sau sửa |
| :---: | :--- | :--- | :--- |
| **P0** | **Màn hình trắng tinh trên Production Frontend (`:3000`)** — `index.html` thiếu `<script>`/`<link>` do build qua Windows Junction (`C:\Projects\hotel-sass-rbac` -> `C:\Dev\hotel-saas-v2`) và thiếu cấu hình `optimization`. | `frontend/angular.json` | Build từ `C:\Dev\hotel-saas-v2\frontend` sinh đủ `main-QD6DTWYO.js (578.91 kB)`, `styles-3IOGRJGI.css (152.48 kB)`, `polyfills-LVNOU2XZ.js (35.88 kB)`; `HasScript: True`, `HasStylesheet: True`; `/booking` hiển thị hoàn chỉnh. |
| **P0** | **Background Hold Sweep (`ExpiredHoldSweepBackgroundService`) văng `ForbiddenException`** mỗi 15s khi lưu thay đổi vì thiếu `TenantId`/`PropertyId` trong `ICurrentTenantService`. | `backend/src/HotelSaas.Application/Public/Commands/CheckExpiredHolds/CheckExpiredHoldsCommand.cs` | Quét sạch 3 đơn hết hạn (`RES-78KF4X`, `RES-W7B83D`, `RES-E7GGSP`) trên log live với `0` lỗi ở các chu kỳ tiếp theo. |
| **P0** | **`RealData34ProvincesSeeder` lỗi khởi động** khi upsert `Property`, `RoomType`, `Room`, `RoomTypeRate` mà không nạp scope tenant/property. | `backend/src/HotelSaas.Infrastructure/Persistence/RealData34ProvincesSeeder.cs`, `backend/src/HotelSaas.WebApi/Program.cs` | `RealData34ProvincesSeeder executed successfully.` trên log live. |
| **P0** | **`SubscriptionsController` thiếu RBAC & Global Query Filter đếm thiếu phòng toàn chuỗi**: Receptionist/Housekeeper đọc được `GET /api/subscriptions/current` (`200 OK`), còn Owner chỉ đếm được phòng chi nhánh hiện tại. | `backend/src/HotelSaas.WebApi/Controllers/SubscriptionsController.cs` | Re-check live API: Receptionist & Housekeeper bị chặn `403`; Owner nhận `200 OK` với `currentRoomCount: 30, currentPropertyCount: 8`. |
| **P0** | **`Housekeeper` bị chặn `403` tại `PATCH /api/rooms/{id}/status`** do endpoint chỉ kiểm tra quyền `ROOMS:Update` thay vì cho phép `HOUSEKEEPING:Update`. | `backend/src/HotelSaas.WebApi/Authorization/RequirePermissionAttribute.cs`, `backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs` | Re-check live API: Housekeeper chuyển trạng thái `Clean -> Dirty -> Cleaning -> Clean` thành công `200 OK`. |
| **P1** | **Khoảng cách tới địa danh hiển thị sai định dạng** (`Cách 0.1km` cứng thay vì số thực) trong kết quả tìm kiếm B2C. | `backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs` | Re-check live API: `distanceFormatted` trả về `'Cách 3,5km'`, `'Cách 1,2km'`. |
| **P1** | **`LocationLookupService` không khớp mã tỉnh `"1"` vs `"01"`**, khiến bộ lọc địa danh & khu du lịch Hà Nội trả về rỗng. | `backend/src/HotelSaas.Infrastructure/Services/LocationLookupService.cs` | Re-check live API: `GET /api/public/landmarks?provinceCode=1` trả về 6 địa danh Hà Nội; `tourist-zones?provinceCode=1` trả về `ha-noi-pho-co`. |
| **P1** | **Nút chuyển `Chain HQ` bị ẩn trên `ContextSelectorDialog`** nếu chủ chuỗi mới chỉ có 1 chi nhánh (`branchMemberships().length > 1`). | `frontend/src/app/features/auth/context-selector/context-selector.dialog.ts` | Đã gỡ điều kiện `branchMemberships().length > 1`, đồng bộ với hành vi `canViewChainHq()` theo quyền `TenantWide`. |

---

## 4. KẾT QUẢ CHẠY BỘ KIỂM THỬ TỰ ĐỘNG (SAU CÁC CHỈNH SỬA CUỐI CÙNG)

| Bộ kiểm thử | Lệnh thực thi | Kết quả |
| :--- | :--- | :--- |
| **Backend Build** | `dotnet build backend/src/HotelSaas.WebApi/HotelSaas.WebApi.csproj --verbosity minimal` | `0 Warning(s), 0 Error(s)` |
| **WebApi Integration Tests** | `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --verbosity minimal` | **67/67 Passed** (`0 Failed, 0 Skipped`) |
| **Application Targeted Tests** | `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~MultiTenantSaaSRbacFlowTests\|FullyQualifiedName~PublicMarketplaceDiscoveryTests\|FullyQualifiedName~LocationLookup"` | **6/6 Passed** (`0 Failed, 0 Skipped`) |
| **Frontend Unit Tests (Vitest)** | `npx --prefix frontend ng test --watch=false --progress=false` | **51 test files / 632 tests Passed** (`0 Failed`) |

---

## 5. CÁC VẤN ĐỀ CÒN MỞ & KIẾN NGHỊ CHO CÁC TUẦN TIẾP THEO

1. **`[P0 Security/Privacy]` Tra cứu & Hủy đặt phòng không cần xác thực liên hệ khi biết mã xác nhận:**
   - `GetGuestBookingByTokenQuery.cs` trả về `LookupToken` khi tra cứu chỉ bằng `ConfirmationCode`, và `CancelGuestBookingCommandHandler.cs` bỏ qua kiểm tra `VerificationEmailOrPhone` nếu trường này bị bỏ trống.
   - *Lưu ý:* Chưa sửa trực tiếp vì `P5_GuestBookingTests.cs` (`line 2259`) và `P5_GuestCancellationTests.cs` đang assert hành vi hiện tại; cần cập nhật đồng thời spec test và handler ở Sprint tiếp theo.
2. **`[P1 Security]` `FirebaseAuthService.cs` (`line 122`):** Chấp nhận `dev-mock-token:` chưa được bọc kiểm tra `IsDevelopment()`. Cần chặn tuyệt đối ở môi trường Staging/Production.
3. **`[P1 Geo]` `GeoProximityHelper.cs` Layer 3 fallback:** Chuỗi địa chỉ như `"123 Pho Co"` có thể khớp nhầm sang `"hoi-an"` khi tỉnh đó chưa có dữ liệu landmark; nên giới hạn tìm kiếm theo `provinceCode`.
4. **`[P1 Onboarding/Billing]` Hạn mức gói Starter & Chính sách phụ thu mặc định:**
   - `CreatePropertyCommand.cs` chưa chặn `MaxPropertiesAllowed = 1` đối với gói Starter.
   - Cơ sở lưu trú vừa đăng ký chưa có bản ghi `PropertySurchargePolicy` mặc định, gây lỗi `422 ERR_SURCHARGE_NOT_CONFIGURED` nếu khách trả phòng ngoài khung `12:00`.
5. **`[P1/P2 Frontend UX]`:**
   - `property-detail.page.ts` (`lines 609-654, 760`) hiển thị điểm đánh giá phụ `4.9/5` mặc định khi cơ sở chưa có review nào và hiển thị thông điệp VAT cứng.
   - `booking-lookup.page.ts` (`lines 354-377`) có thông báo hướng dẫn đánh giá chưa gắn luồng xử lý thực tế.
   - `booking-filter-bar.component.ts` (`lines 503-509`) & `explore-search.page.ts` (`line 804`) có chip lọc `Guesthouse` không khớp hoàn toàn với enum `PropertyType (1..8)`.
