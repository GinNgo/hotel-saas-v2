# BÁO CÁO KIỂM CHỨNG T05 — ĐỐI CHIẾU ĐƠN GUEST VỚI PMS VÀ PHÂN QUYỀN ĐA CƠ SỞ

**Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)**  
**Phân hệ:** Cổng Đặt phòng Công khai (Public Booking Portal) & Quản lý Đặt phòng Nội bộ (PMS Reservations)  
**Nhánh thực hiện:** `feature/tan-week3-hold-lookup`  
**Thành viên thực hiện:** Trần Trọng Tân (24TX810025)  
**Thời điểm thực hiện & cập nhật:** 22/10/2026  
**Baseline Git Commit:** `562f34a` (docs(reports): tone down AI section intro to reflect realistic testing)  
**Tài liệu quy chiếu:** `docs/team/KE-HOACH-CHI-TIET-TUAN-3.md` (Mục T05, C01, C02, C03, Mục 10) & `AGENTS.md`  

---

## I. XÁC ĐỊNH HIỆN TRẠNG MÔI TRƯỜNG KIỂM THỬ & ĐIỀU KIỆN CLOUD DÙNG CHUNG

### 1. Hiện trạng tra soát cấu hình và môi trường Cloud chung
Đã tiến hành rà soát các nguồn thông tin sẵn có trong kho mã nguồn:
* `backend/src/HotelSaas.WebApi/appsettings.json` và `appsettings.Development.json`: Chỉ chứa cấu hình kết nối PostgreSQL cục bộ (`Host=localhost;Port=5435;Database=hotel_saas_dev_ngoc;...`). Không chứa chuỗi kết nối hay thông số cấu hình Cloud nào được thiết lập.
* Biến môi trường (`.env`): Không tồn tại file cấu hình môi trường riêng ngoài file mẫu `.env.example`.
* Lịch sử Git commit & nhánh: Chưa có commit nào cấu hình endpoint Cloud, TLS CA certificate hoặc cập nhật credential trên môi trường tích hợp.
* Kế hoạch phối hợp nhóm (`docs/team/KE-HOACH-CHI-TIET-TUAN-3.md`, Mục 10): Ghi nhận các gate C01 (Startup Guard), C02 (Kiểm tra kết nối read-only Cloud) và C03 (Chốt dataset demo và kịch bản ghi) đang là các đầu việc được lên kế hoạch của An.

**Kết luận xác minh hiện trạng:**
* **Chưa có bằng chứng xác nhận trong các nguồn đã kiểm tra** về việc dịch vụ PostgreSQL Cloud dùng chung đã được provision, cấu hình kết nối, hay tài khoản/dataset demo đa cơ sở đã được bàn giao.
* Trạng thái kiểm chứng T05 trên Cloud chung: **BLOCKED** (Thiếu môi trường và quyền thực hiện được cấp).
* **Tuyên bố minh bạch kỹ thuật:** Báo cáo này **KHÔNG** sử dụng kết quả kiểm thử trên môi trường local/fixture để công bố là tích hợp Cloud thành công. Hai phạm vi kiểm chứng được tách bạch rõ ràng:
  1. *Kiểm chứng tự động trên local:* Đã thực hiện đầy đủ trên DB test cô lập được phép (`hotel_saas_p1b01a_test`).
  2. *Kiểm chứng trên Cloud chung:* Đang ở trạng thái **BLOCKED**, chờ đủ điều kiện hạ tầng và dataset từ chủ môi trường.
  3. **Không ghi nhận T05 hoàn thành 100%** khi tiêu chí đối chiếu thực tế trên môi trường Cloud dùng chung chưa có bằng chứng xác nhận.
* **Bảo mật:** Báo cáo che toàn bộ chuỗi kết nối, mật khẩu, JWT token, mã PIN khóa cửa hoặc thông tin định danh khách hàng thật.

---

## II. ÁNH XẠ ROUTE VÀ ENDPOINT THỰC TẾ GIỮA GUEST VÀ PMS

### 1. Tuyến đường giao diện (Frontend Routes) theo `app.routes.ts`
Đối chiếu trực tiếp với file cấu hình định tuyến Angular thực tế [app.routes.ts](file:///d:/hotel-saas-v2/frontend/src/app/app.routes.ts):
* **Cổng khách (Guest Booking Portal - Tiền tố `/booking`):**
  * Trang Khám phá & Trang chủ: Route `/booking` → [BookingPageComponent](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts)
  * Trang Giữ chỗ trực tuyến: Route `/booking/hold` và `/booking/hold/:token` → [BookingHoldPageComponent](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/booking-hold.page.ts) (Gọi API `POST /api/public/bookings/hold`)
  * Trang Tra cứu đơn đặt phòng: Route `/booking/lookup` → [BookingLookupPageComponent](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/booking-lookup.page.ts)
  * Trang Theo dõi trạng thái & thông tin đơn: Route `/booking/status/:token` → [BookingStatusPageComponent](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/booking-status.page.ts) (Gọi API `GET /api/public/bookings/{lookupToken}`)
  * Trang Chi tiết cơ sở lưu trú: Route `/booking/properties/:slug` → [PropertyDetailPageComponent](file:///d:/hotel-saas-v2/frontend/src/app/features/public-booking/property-detail.page.ts)
* **Quản lý Đặt phòng & Tài chính PMS (Lễ tân/Thu ngân):**
  * Trang Quản lý Đặt phòng: Route `/reservations` (hoặc `/admin/reservations`) → [ReservationsPage](file:///d:/hotel-saas-v2/frontend/src/app/features/reservations/reservations.page.ts) (Gọi API `GET /api/reservations?propertyId={propertyId}` và `GET /api/reservations/{id}?propertyId={propertyId}`)
  * Modal Folio Tài chính trong PMS: Tích hợp trong `/reservations` và `/payments` → Gọi API `GET /api/reservations/{id}/folio?propertyId={propertyId}`
  * Trang Quản lý Thu chi / Thanh toán: Route `/payments` (hoặc `/admin/payments`) → [PaymentsPage](file:///d:/hotel-saas-v2/frontend/src/app/features/payments/payments.page.ts) (Gọi API `GET /api/payments?propertyId={propertyId}` và `POST /api/payments`)
  * Xác nhận nộp cọc / duyệt đơn: Gọi API `POST /api/public/bookings/{lookupToken}/confirm` (yêu cầu nhân viên có quyền kép `RESERVATIONS.Update` và `PAYMENTS.Create`) hoặc `POST /api/reservations/{id}/confirm?propertyId={propertyId}`.

---

## III. CHECKLIST ĐỐI CHIẾU CÙNG MỘT BOOKING GIỮA GUEST VÀ PMS (OBSERVED VS EXPECTED)

Kiểm chứng được thực hiện tự động qua test [HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac](file:///d:/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/P5_GuestBookingHttpPipelineTests.cs#L1148) trên cùng một đơn đặt phòng thực tế (`RES-T05-RECONCILE`) tại DB test cô lập `hotel_saas_p1b01a_test`:

| Tiêu chí đối chiếu | Thao tác | Giá trị Dự kiến (Expected) | Giá trị Quan sát — Guest (`GET /api/public/bookings/{token}`) | Giá trị Quan sát — PMS Detail (`GET /api/reservations/{id}`) | Giá trị Quan sát — PMS Folio (`GET /api/reservations/{id}/folio`) | Kết quả đối chiếu |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **1. Mã đơn đặt phòng** | Đọc | `"RES-T05-RECONCILE"` | `"RES-T05-RECONCILE"` | `"RES-T05-RECONCILE"` | `"RES-T05-RECONCILE"` | **KHỚP 1:1** |
| **2. Chi nhánh / Cơ sở** | Đọc | Chi nhánh Non Nước T05 (`prop1Id`) | `propertyId: prop1Id`<br>`propertyName: "Chi nhánh Non Nước T05"` | `propertyId: prop1Id` | Thuộc ngữ cảnh `prop1Id` của đơn | **KHỚP 1:1** |
| **3. Hạng phòng** | Đọc | Deluxe Ocean View | `"Deluxe Ocean View"` | `"Deluxe Ocean View"`<br>(Kèm `RoomNumber: "101"`) | `"Deluxe Ocean View"`<br>(Kèm `RoomNumber: "101"`) | **KHỚP 1:1**<br>*(PMS hiển thị thêm số phòng vật lý)* |
| **4. Thời gian lưu trú** | Đọc | Từ `CheckIn` (+2 ngày) đến `CheckOut` (+3 ngày) | `checkInDate`, `checkOutDate`<br>`startAtUtc`, `endAtUtc` | `checkInDate`, `checkOutDate`<br>`startAtUtc`, `endAtUtc` | `checkInDate`, `checkOutDate`<br>`startAtUtc`, `endAtUtc` | **KHỚP 1:1**<br>*(Chuẩn ISO 8601 UTC)* |
| **5. Trạng thái đơn ban đầu** | Đọc | `PendingPayment` | `"PendingPayment"` | `ReservationStatus.PendingPayment` | `ReservationStatus.PendingPayment` | **KHỚP 1:1** |
| **6. Trạng thái đơn sau duyệt cọc** | Ghi & Đọc | `Confirmed` | `"Confirmed"` | `ReservationStatus.Confirmed` | `ReservationStatus.Confirmed` | **KHỚP 1:1** |
| **7. Tổng tiền đơn đặt** | Đọc | `1.300.000 ₫`<br>(Phòng: 1.000.000 ₫ + Phụ thu: 200.000 ₫ + Dịch vụ: 100.000 ₫) | `1.300.000 ₫` | `1.300.000 ₫` | `1.300.000 ₫`<br>(Base: 1.000.000 ₫, Surcharge: 200.000 ₫, Service: 100.000 ₫) | **KHỚP 1:1** |
| **8. Tiền đã thu / nộp cọc ban đầu** | Đọc | `PaidAmount = 0 ₫`<br>`DepositRequired = 390.000 ₫` (30%) | `paidAmount: 0 ₫`<br>`depositRequired: 390.000 ₫` | Trong lịch sử Folio | `paidAmount: 0 ₫`<br>`depositRequired: 390.000 ₫` | **KHỚP 1:1** |
| **9. Tiền đã thu sau khi nộp cọc** | Ghi & Đọc | Thu cọc `390.000 ₫`<br>→ `PaidAmount = 390.000 ₫` | `paidAmount: 390.000 ₫` | Trong Folio | `paidAmount: 390.000 ₫`<br>(1 giao dịch `PaymentStatus.Completed`) | **KHỚP 1:1** |
| **10. Số còn phải thu ban đầu** | Đọc | `1.300.000 ₫` | `remainingBalance: 1.300.000 ₫` | Trong Folio | `remainingBalance: 1.300.000 ₫` | **KHỚP 1:1** |
| **11. Số còn phải thu sau nộp cọc** | Ghi & Đọc | `910.000 ₫`<br>(1.300.000 ₫ - 390.000 ₫) | `remainingBalance: 910.000 ₫` | Trong Folio | `remainingBalance: 910.000 ₫` | **KHỚP 1:1** |
| **12. Thông tin khách (PII)** | Đọc | Guest che PII; PMS hiển thị PII | **ĐÃ CHE (Masked):**<br>`N*** A*`, `n***@gmail.com`, `090***567` | **ĐẦY ĐỦ (Unmasked):**<br>`Nguyen Van A`, `nguyenvana@gmail.com`, `0901234567` | **ĐẦY ĐỦ (Unmasked):**<br>`Nguyen Van A`, `nguyenvana@gmail.com`, `0901234567` | **Hợp lệ theo Contract (D02/D21)** |
| **13. Mã PIN mở khóa cửa** | Đọc | Pending: che PIN;<br>Confirmed + Active: trả PIN | Khi Pending: `null`<br>Khi Confirmed: `"123***"` | Lễ tân xem PIN trong chi tiết đặt phòng | Không hiển thị trên chứng từ Folio | **Hợp lệ theo Quy định T04** |

---

## IV. BẢO VỆ PHÂN QUYỀN ĐA CƠ SỞ (CROSS-BRANCH RBAC) VÀ CONTRACT LỖI

Toàn bộ các luồng truy cập chéo chi nhánh và sai lệch ngữ cảnh đã được kiểm chứng qua ASP.NET Core Middleware Pipeline thật (`WebApplicationFactory`), với các assertion chính xác theo mã lỗi và HTTP status của contract:

### 1. Tấn công giả mạo Header chéo cơ sở (Header Tampering)
* **Kịch bản:** Nhân viên Chi nhánh B có token của Chi nhánh B (`prop2Id`), cố tình gửi header `X-Property-Id: prop1Id` để đọc danh sách đơn của Chi nhánh A (`GET /api/reservations?propertyId=prop1Id`).
* **Contract thực tế:** `TenantPropertyContextMiddleware` phát hiện `tokenPropertyId != headerPropertyId` đối với nhân viên không có thẩm quyền toàn hệ thống (TenantWide), lập tức từ chối yêu cầu.
* **Assertion kỹ thuật:**
  * `Assert.Equal(HttpStatusCode.Forbidden, staffBHeaderResp.StatusCode);`
  * `Assert.Equal("ERR_PROPERTY_FORBIDDEN", headerErrJson.GetProperty("errorCode").GetString());`
* **Kết quả:** **ĐẠT (Local)** — HTTP 403 Forbidden với mã lỗi `ERR_PROPERTY_FORBIDDEN`.

### 2. Bất đồng bộ giữa Header và Query Parameter (Context Mismatch)
* **Kịch bản:** Nhân viên Chi nhánh B gửi Header hợp lệ của B (`X-Property-Id: prop2Id`), nhưng tham số query lại trỏ vào Chi nhánh A (`?propertyId=prop1Id`).
* **Contract thực tế:** `GetReservationsQueryHandler` phát hiện `_propertyService.HeaderPropertyId != request.PropertyId`, ném `BadRequestException("ERR_CONTEXT_MISMATCH")`.
* **Assertion kỹ thuật:**
  * `Assert.Equal(HttpStatusCode.BadRequest, staffBQueryResp.StatusCode);`
  * `Assert.Equal("ERR_CONTEXT_MISMATCH", queryErrJson.GetProperty("errorCode").GetString());`
* **Kết quả:** **ĐẠT (Local)** — HTTP 400 Bad Request với mã lỗi `ERR_CONTEXT_MISMATCH`.

### 3. Nhân viên Chi nhánh B đăng nhập đúng ngữ cảnh B nhưng truy cập ID Đơn của Chi nhánh A
* **Kịch bản:** Nhân viên B đăng nhập đúng Chi nhánh B, gửi token B, `X-Property-Id: prop2Id`, và `?propertyId=prop2Id`. Ngữ cảnh hoàn toàn hợp lệ cho Cơ sở B.
  * **3a. Danh sách đơn (`GET /api/reservations?propertyId=prop2Id`):**
    * Request trả về `200 OK`.
    * Bộ lọc EF Core `res.PropertyId == request.PropertyId` đảm bảo danh sách **KHÔNG CHỨA** đơn của Chi nhánh A (`reservationId` hay mã đơn `"RES-T05-RECONCILE"`).
    * `Assert.DoesNotContain(pagedListB.Items, r => r.Id == reservationId || r.ConfirmationCode == "RES-T05-RECONCILE");`
  * **3b. Chi tiết đơn của A (`GET /api/reservations/{reservationA_Id}?propertyId=prop2Id`):**
    * Query lọc `res.Id == id && res.PropertyId == prop2Id`. Đơn của A thuộc `prop1Id` nên entity trả về null.
    * Handler ném `NotFoundException("Không tìm thấy đơn đặt phòng.")`.
    * Contract trả về: **HTTP 404 NotFound**, mã lỗi `"ERR_NOT_FOUND"`.
    * **Kiểm tra rò rỉ dữ liệu:** Response body tuyệt đối **KHÔNG CHỨA** tên khách, email, số điện thoại, lookup token hay mã PIN của A:
      * `Assert.DoesNotContain("Nguyen Van A", detailErrRaw);`
      * `Assert.DoesNotContain("nguyenvana@gmail.com", detailErrRaw);`
      * `Assert.DoesNotContain("0901234567", detailErrRaw);`
      * `Assert.DoesNotContain(lookupToken, detailErrRaw);`
      * `Assert.DoesNotContain("123456", detailErrRaw);`
  * **3c. Folio của đơn A (`GET /api/reservations/{reservationA_Id}/folio?propertyId=prop2Id`):**
    * Query lọc `r.Id == id && r.PropertyId == prop2Id`. Trả về null, ném `NotFoundException("Đơn đặt phòng không tồn tại.")`.
    * Contract trả về: **HTTP 404 NotFound**, mã lỗi `"ERR_NOT_FOUND"`.
    * **Kiểm tra rò rỉ dữ liệu:** Response body tuyệt đối không chứa PII, token hay PIN của A:
      * `Assert.DoesNotContain("Nguyen Van A", folioErrRaw);`
      * `Assert.DoesNotContain("nguyenvana@gmail.com", folioErrRaw);`
      * `Assert.DoesNotContain("0901234567", folioErrRaw);`
      * `Assert.DoesNotContain(lookupToken, folioErrRaw);`
      * `Assert.DoesNotContain("123456", folioErrRaw);`
* **Kết quả:** **ĐẠT (Local)** — Cách ly dữ liệu đa chi nhánh triệt để, fail-closed an toàn, không rò rỉ bất kỳ thông tin nhạy cảm nào.

### 4. Chặn nhân viên xác nhận đơn đặt phòng chéo chi nhánh (Writer RBAC Guard)
* **Kịch bản:** Nhân viên Chi nhánh 2 cố tình gọi `POST /api/public/bookings/{token}/confirm` cho đơn giữ chỗ thuộc Chi nhánh 1.
* **Minh chứng tái sử dụng:** Được kiểm chứng tại test hiện hữu [HttpPipeline_P5_GuestBooking_FullLifecycle_And_Security_Guards (Scenario 4)](file:///d:/hotel-saas-v2/backend/tests/HotelSaas.WebApi.Tests/P5_GuestBookingHttpPipelineTests.cs#L717-L737):
  * `Assert.Equal(HttpStatusCode.BadRequest, respBranchMismatch.StatusCode);`
  * `Assert.Equal("ERR_BRANCH_MISMATCH", mismatchJson.GetProperty("errorCode").GetString());`
* **Kết quả:** **ĐẠT (Local)** — HTTP 400 Bad Request với mã lỗi `ERR_BRANCH_MISMATCH`. Tái sử dụng minh chứng, không tạo test trùng lặp.

### 5. Chặn khách vãng lai (Anonymous) gọi endpoint PMS
* `GET /api/reservations?propertyId={prop1Id}` → **HTTP 401 Unauthorized**
* `GET /api/reservations/{reservationId}?propertyId={prop1Id}` → **HTTP 401 Unauthorized**
* `GET /api/reservations/{reservationId}/folio?propertyId={prop1Id}` → **HTTP 401 Unauthorized**
* `POST /api/public/bookings/{token}/confirm` (nặc danh không Bearer Token) → **HTTP 401 Unauthorized**
* **Kết quả:** **ĐẠT (Local)** — Chặn fail-closed 100% người dùng nặc danh.

---

## V. BẢNG MINH CHỨNG THỰC TẾ (TEST EVIDENCE TABLE)

Toàn bộ các kịch bản đều gắn liền với các assertions kỹ thuật cụ thể, chạy trên DB test cô lập `hotel_saas_p1b01a_test` hoặc Frontend Testbed, thực hiện vào ngày 22/10/2026:

| STT | Kịch bản kiểm thử | Thao tác | Môi trường | Quyền truy cập | Kết quả mong đợi (Expected) | Kết quả thực tế (Actual) | Trạng thái | Minh chứng kỹ thuật & Test Reference |
| :---: | :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **01** | Tạo giữ chỗ online (Hold), nhận mã tra cứu và kiểm tra thông tin | Ghi & Đọc | Local DB Test (`hotel_saas_p1b01a_test`) | Khách vãng lai (Anonymous) | Trả về `201 Created`, sinh `LookupToken`, trạng thái `PendingPayment`, PII được che | HTTP 201 Created, `LookupToken` hợp lệ, `PendingPayment`, PII đã che | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_P5_GuestBooking_FullLifecycle_And_Security_Guards`, Scn 1.7 & 1.8) |
| **02** | Khách tra cứu đơn qua Token (`GET /api/public/bookings/{token}`) | Đọc | Local DB Test cô lập | Khách vãng lai (qua token) | Trả về `200 OK`, số tiền khớp 1:1, PII đã che, không lộ PIN khi `PendingPayment` | HTTP 200 OK, `totalAmount: 1.300.000₫`, `depositRequired: 390.000₫`, `smartLockPin: null` | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 1) |
| **03** | Khách gọi endpoint danh sách PMS (`GET /api/reservations`) | Đọc | Local WebApi Pipeline | Khách vãng lai (Không token) | Bị chặn `401 Unauthorized` | HTTP 401 Unauthorized | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 6a) |
| **04** | Khách gọi endpoint chi tiết PMS (`GET /api/reservations/{id}`) | Đọc | Local WebApi Pipeline | Khách vãng lai (Không token) | Bị chặn `401 Unauthorized` | HTTP 401 Unauthorized | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 6b) |
| **05** | Khách gọi endpoint Folio PMS (`GET /api/reservations/{id}/folio`) | Đọc | Local WebApi Pipeline | Khách vãng lai (Không token) | Bị chặn `401 Unauthorized` | HTTP 401 Unauthorized | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 6c) |
| **06** | Khách tự gửi yêu cầu duyệt nộp cọc (`POST .../confirm`) | Ghi | Local WebApi Pipeline | Khách vãng lai (Không token) | Bị chặn `401 Unauthorized` | HTTP 401 Unauthorized | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_P5_GuestBooking_FullLifecycle_And_Security_Guards`, Scn 2) |
| **07** | Nhân viên thiếu quyền kép duyệt đơn (chỉ có `RESERVATIONS.Update`) | Ghi | Local WebApi Pipeline | Nhân viên có 1 quyền | Bị chặn `403 Forbidden` | HTTP 403 Forbidden | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_P5_GuestBooking_FullLifecycle_And_Security_Guards`, Scn 3.1) |
| **08** | Nhân viên Cơ sở 2 cố tình giả mạo header của Cơ sở 1 (`X-Property-Id: prop1Id`) | Đọc | Local WebApi Pipeline | Nhân viên Cơ sở 2 (`staff_b@hotel.com`) | Bị chặn `403 Forbidden` (`ERR_PROPERTY_FORBIDDEN`) | HTTP 403 Forbidden (`ERR_PROPERTY_FORBIDDEN`) | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 5a) |
| **09** | Nhân viên Cơ sở 2 gửi header B nhưng query param trỏ vào Cơ sở 1 (`?propertyId=prop1Id`) | Đọc | Local WebApi Pipeline | Nhân viên Cơ sở 2 (`staff_b@hotel.com`) | Bị chặn `400 Bad Request` (`ERR_CONTEXT_MISMATCH`) | HTTP 400 Bad Request (`ERR_CONTEXT_MISMATCH`) | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 5b) |
| **10** | Nhân viên Cơ sở 2 trong ngữ cảnh B xem danh sách đơn | Đọc | Local WebApi Pipeline | Nhân viên Cơ sở 2 (`staff_b@hotel.com`) | Trả về `200 OK`, danh sách **KHÔNG CHỨA** đơn của Cơ sở 1 | HTTP 200 OK, danh sách không có `RES-T05-RECONCILE` | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 5c) |
| **11** | Nhân viên Cơ sở 2 trong ngữ cảnh B gọi chi tiết đơn của Cơ sở 1 | Đọc | Local WebApi Pipeline | Nhân viên Cơ sở 2 (`staff_b@hotel.com`) | Bị từ chối `404 NotFound` (`ERR_NOT_FOUND`), không lộ PII/token/PIN của A | HTTP 404 NotFound (`ERR_NOT_FOUND`), không rò rỉ PII/token/PIN | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 5d) |
| **12** | Nhân viên Cơ sở 2 trong ngữ cảnh B gọi Folio đơn của Cơ sở 1 | Đọc | Local WebApi Pipeline | Nhân viên Cơ sở 2 (`staff_b@hotel.com`) | Bị từ chối `404 NotFound` (`ERR_NOT_FOUND`), không lộ PII/token/PIN của A | HTTP 404 NotFound (`ERR_NOT_FOUND`), không rò rỉ PII/token/PIN | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 5e) |
| **13** | Nhân viên Cơ sở 2 cố duyệt cọc đơn của Cơ sở 1 chéo chi nhánh | Ghi | Local WebApi Pipeline | Nhân viên Cơ sở 2 (`staff_p5_prop2@hotel.com`) | Bị chặn `400 Bad Request` (`ERR_BRANCH_MISMATCH`) | HTTP 400 Bad Request (`ERR_BRANCH_MISMATCH`) | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_P5_GuestBooking_FullLifecycle_And_Security_Guards`, Scn 4) |
| **14** | Đối chiếu chi tiết đơn cùng một booking giữa Guest và PMS Detail | Đọc | Local DB Test cô lập | Staff Chi nhánh A & Guest Token | Mã đơn, cơ sở, hạng phòng, số khách, tổng tiền khớp 1:1; PII được che phía guest, đầy đủ phía lễ tân | Dữ liệu khớp 1:1; Guest che PII, PMS hiển thị PII thật | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 2) |
| **15** | Đối chiếu số dư tài chính cùng một booking giữa Guest và Folio | Ghi & Đọc | Local DB Test cô lập | Staff Chi nhánh A & Guest Token | Tổng tiền (1.300.000₫), đã trả (390.000₫), số dư (910.000₫) khớp 1:1 khi có phụ thu/dịch vụ | `Total: 1.300.000₫`, `Paid: 390.000₫`, `Balance: 910.000₫` khớp tuyệt đối | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 3 & 4) |
| **16** | Hiển thị mã PIN sau khi đơn Confirmed và khóa Active | Đọc | Local DB Test cô lập | Khách vãng lai (qua token) | Cấp mã PIN `"123***"` cho khách khi trạng thái là `Confirmed` và khóa `Active` | `smartLockPin: "123***"`, `smartLockStatus: "Active"` | **ĐẠT (Local)** | `P5_GuestBookingHttpPipelineTests.cs`<br>(Test: `HttpPipeline_T05_Guest_PMS_Reconciliation_And_Cross_Branch_Rbac`, Step 4) |
| **17** | Đơn bị Hủy hoặc Thu hồi không được phép lộ PIN | Đọc | Local DB Test cô lập | Khách vãng lai (qua token) | Trả về `smartLockPin: null`, giữ nguyên trạng thái khóa `Revoked` | `smartLockPin: null`, `smartLockStatus: "Revoked"` | **ĐẠT (Local)** | `P5_GuestBookingTests.cs`<br>(Test: `GetGuestBookingByToken_T04_SmartLockPin_PermittedOnlyForConfirmedOrCheckedIn_WithActiveLock`, 11 kịch bản) |
| **18** | Giữ chỗ hết hạn hiển thị `Expired` nhưng không làm mất quyền tra cứu | Đọc | Local DB Test cô lập | Khách vãng lai (qua token) | Hiển thị trạng thái `Expired`, countdown dừng, giữ giao diện tra cứu lịch sử | `Status: "Expired"`, `SecondsRemaining: 0`, token tra cứu vẫn hoạt động | **ĐẠT (Local)** | `P5_GuestBookingTests.cs` (Test: `GetGuestBookingByToken_T04_PendingPayment_ExpiredHold_ReflectedAsExpired_WithoutLosingLookupRights`) |
| **19** | Đổi query param trên trình duyệt (`?vnp_ResponseCode=00`) | Đọc | Frontend Testbed | Khách vãng lai | Không tự chuyển `Confirmed`, luôn gọi API kiểm tra trạng thái thật từ server | Giao diện giữ nguyên trạng thái server trả về, không xác nhận thanh toán giả | **ĐẠT (Local)** | `booking-status.page.spec.ts`<br>(Suite: `T03/T05 Payment Verification & Reload Real Server State`) |
| **20** | **Kiểm chứng liên thông trên PostgreSQL Cloud dùng chung** | Đọc & Ghi | **Cloud dùng chung** | **Tài khoản demo An cấp** | **Đối chiếu cùng một đơn trên DB Cloud chung với dữ liệu demo đa cơ sở** | **Chưa thực hiện do chưa có thông tin xác nhận môi trường/quyền** | **BLOCKED** | **Chờ An hoàn thành C01, C02, C03** |

---

## VI. KẾT QUẢ GATES VÀ KIỂM TRA CHẤT LƯỢNG MÃ NGUỒN

### 1. Backend (.NET 10)
* **Lệnh biên dịch:** `dotnet build backend/HotelSaas.slnx --verbosity minimal`
  * **Kết quả:** `Build succeeded. 0 Warning(s), 0 Error(s).` (Thời gian: 8.00s)
* **Lệnh kiểm thử tự động:**
  * `dotnet test backend/tests/HotelSaas.WebApi.Tests/ --filter "FullyQualifiedName~P5_GuestBookingHttpPipelineTests" --no-build`
    * **Kết quả:** **2/2 multi-scenario pipeline tests passed** (0 Failed, 0 Skipped, thời gian: 14s). Bao gồm đầy đủ test đối chiếu Guest–PMS–Folio và 5 tình huống phân quyền cách ly đa chi nhánh.
  * `dotnet test backend/tests/HotelSaas.Application.Tests/ --filter "FullyQualifiedName~P5_GuestBookingTests" --no-build`
    * **Kết quả:** **34/34 tests passed** (0 Failed, 0 Skipped, thời gian: 28s). Bao gồm 11 kịch bản PIN và quyền tra cứu hold quá hạn.
  * `dotnet test backend/tests/HotelSaas.WebApi.Tests/ --filter "FullyQualifiedName~TenantPropertyContextMiddlewareTests" --no-build`
    * **Kết quả:** **13/13 tests passed** (100% đạt).
  * `dotnet test backend/tests/HotelSaas.WebApi.Tests/ --filter "FullyQualifiedName~PaymentAndFolioHttpPipelineTests" --no-build`
    * **Kết quả:** **1/1 test passed** (100% đạt).

### 2. Frontend (Angular 22)
* **Lệnh kiểm thử các trang liên quan:**
  * `booking-hold.page.spec.ts`: **31/31 passed**
  * `booking-lookup.page.spec.ts`: **32/32 passed**
  * `booking-status.page.spec.ts`: **42/42 passed**
  * `public-booking.page.spec.ts`: **23/23 passed**
  * `reservations.page.spec.ts`: **59/59 passed**
  * **Tổng cộng Frontend:** **187/187 tests passed** (0 Failed, 0 Skipped).
* **Lệnh kiểm tra bản dựng:** `npm --prefix frontend run build`
  * **Kết quả:** `Application bundle generation complete. 0 Errors.`
* **Kiểm tra định dạng và khoảng trắng Git:** `git diff --check`
  * **Kết quả:** Sạch sẽ, không có lỗi whitespace hay conflict marker.

---

## VII. HIỆN TRẠNG HOÀN THÀNH NHIỆM VỤ T05 VÀ KẾ HOẠCH BÀN GIAO

### 1. Phân định rõ ràng hiện trạng hoàn thành T05
* **Phần cục bộ (Local Testbed):** **ĐÃ ĐẠT 100%**
  * Toàn bộ 19 kịch bản kiểm thử đọc và ghi trên môi trường local đã pass 100%.
  * Đối chiếu dữ liệu giữa Guest Portal, PMS Reservation Detail và PMS Folio trên cùng 1 booking khớp tuyệt đối (mã đơn, chi nhánh, hạng phòng, thời gian, trạng thái, tổng tiền, tiền đã thu, số còn phải thu).
  * Xử lý chính xác các trường hợp sai ngữ cảnh: Header tampering trả HTTP 403 `ERR_PROPERTY_FORBIDDEN`; Query mismatch trả HTTP 400 `ERR_CONTEXT_MISMATCH`; Truy cập ID đơn của cơ sở khác trả HTTP 404 `ERR_NOT_FOUND` và tuyệt đối không lộ PII, token hay PIN của khách.
  * Tái sử dụng kiểm chứng chặn xác nhận đơn chéo cơ sở HTTP 400 `ERR_BRANCH_MISMATCH`.
* **Phần môi trường Cloud dùng chung:** **BLOCKED**
  * Hiện tại chưa có bằng chứng xác nhận trong các nguồn đã kiểm tra về endpoint kết nối, TLS CA certificate, tài khoản và kịch bản demo trên Cloud chung.
  * **Tuyên bố:** Nhiệm vụ T05 **CHƯA THỂ COI LÀ HOÀN THÀNH 100%** cho đến khi phần đối chiếu trên môi trường chung được xác nhận thực tế.

### 2. Findings còn mở & Ranh giới kỹ thuật
* **Phần cứng IoT Smart Lock:** Việc hiển thị hoặc che `SmartLockPin` trên API hiện chỉ là kiểm soát logic phần mềm theo trạng thái lưu trong cơ sở dữ liệu. Dự án **chưa tích hợp hoặc nghiệm thu với thiết bị phần cứng khóa thông minh vật lý thật**.
* **Độ lệch xử lý số dư âm (Overpayment):** `GetGuestBookingByTokenQuery` chặn dưới bằng `Math.Max(0m, TotalAmount - PaidAmount)` nên không bao giờ hiển thị số âm cho khách. `GetFolioQueryHandler` tính trực tiếp `TotalAmount - PaidAmount` (có thể âm để biểu thị khách nộp thừa cần hoàn lại tiền). Đây là chủ đích thiết kế nghiệp vụ phù hợp, không phải lỗi tính toán.

### 3. Điều kiện tiên quyết để kích hoạt kiểm chứng Cloud chung
Khi chủ môi trường (An) hoàn thành các gate chuẩn bị hạ tầng:
1. **Gate C01:** Hoàn thành startup guard bảo vệ schema Cloud khỏi auto-migration/seeding.
2. **Gate C02:** Cung cấp thông số kết nối chỉ đọc (Read-only) thành công tới PostgreSQL Cloud chung.
3. **Gate C03:** Cung cấp tài khoản demo (Nhân viên Chi nhánh A, Nhân viên Chi nhánh B) và dataset mẫu đa cơ sở kèm kịch bản ghi dữ liệu được phép.
Ngay khi nhận bàn giao C01–C03, sẽ tiến hành đăng nhập với tài khoản được cấp, đối chiếu màn hình Guest Status và PMS Reservations trên môi trường Cloud chung và bổ sung biên bản đối chiếu vào báo cáo.
