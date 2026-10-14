# 🌐 API Design & Endpoint Catalog

> **Tài liệu:** SDD-06 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 (thiết kế giải pháp)
> **Bao gồm:** Real-time pricing, Notifications, Invoice, Reports

---

## 1. API Convention

| Quy tắc | Chi tiết |
|---------|---------|
| Base URL | `/api/v1/` |
| URL format | `kebab-case` (ví dụ: `/room-types`, `/switch-context`) |
| JSON format | `camelCase` |
| Auth header | `Authorization: Bearer <JWT>` |
| Tenant header | Tự động từ JWT claim `tid` hoặc header `X-Tenant-Id` |
| Property header | Tự động từ JWT claim `pid` hoặc header `X-Property-Id` (BẮT BUỘC cho Property-scoped API; fail-closed nếu thiếu) |
| Support Grant | Header `X-Support-Grant-Id` khi Platform Staff truy cập hỗ trợ theo grant |
| Pagination | `?page=1&pageSize=20` |
| Sort | `?sortBy=createdAt&sortDir=desc` |
| Filter | `?status=confirmed&search=keyword` |
| Date format | ISO 8601 (`2026-10-06T14:00:00Z`) |
| Error format | `{ "success": false, "errorCode": "ERR_...", "message": "...", "errors": {} }` |

---

## 2. Endpoint Catalog

### 2.1 Authentication & Context (`/api/v1/auth`)

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| POST | `/auth/register` | Public | Đăng ký tài khoản cá nhân mới |
| POST | `/auth/login` | Public | Đăng nhập → JWT + Danh sách Tenant & Chi nhánh được phép |
| POST | `/auth/switch-context` | Authenticated | Đổi ngữ cảnh Tenant/Property đang làm việc → cấp JWT mới |
| POST | `/auth/refresh-token` | Public | Làm mới Access token theo refresh token |
| POST | `/auth/logout` | Authenticated | Thu hồi refresh token / Đăng xuất |
| POST | `/auth/forgot-password` | Public | Gửi email yêu cầu đặt lại mật khẩu |
| POST | `/auth/reset-password` | Public | Đặt lại mật khẩu bằng mã bảo mật |
| GET | `/auth/me` | Authenticated | Thông tin cá nhân, membership & quyền hạn hiện tại |
| PUT | `/auth/me` | Authenticated | Cập nhật hồ sơ cá nhân |

### 2.2 Quản trị Doanh nghiệp (`/api/v1/tenants`)

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/tenants/current` | TENANTS:Read | Lấy thông tin doanh nghiệp hiện tại |
| PUT | `/tenants/current` | TENANTS:Update | Cập nhật thông tin pháp nhân doanh nghiệp |
| GET | `/tenants/current/members` | STAFF:Read | Danh sách thành viên / nhân sự thuộc doanh nghiệp |
| POST | `/tenants/current/members` | STAFF:Create | Mời / tạo thành viên mới vào doanh nghiệp |
| PUT | `/tenants/current/members/{id}` | STAFF:Update | Phân vai trò, gán chi nhánh hoặc thu hồi thành viên |
| POST | `/tenants/current/support-grants` | SUPPORT_GRANTS:Create | Cấp quyền hỗ trợ kỹ thuật cho Platform Staff |
| GET | `/tenants/current/support-grants` | SUPPORT_GRANTS:Read | Xem lịch sử và các quyền hỗ trợ đang còn hiệu lực |
| POST | `/tenants/current/support-grants/{id}/revoke` | SUPPORT_GRANTS:Delete | Thu hồi quyền hỗ trợ kỹ thuật ngay lập tức |

### 2.3 Quản trị Chi nhánh (`/api/v1/properties`)

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/properties` | PROPERTIES:Read | Danh sách các chi nhánh thuộc Tenant hiện tại |
| POST | `/properties` | PROPERTIES:Create | Tạo mới một chi nhánh khách sạn thuộc Tenant |
| GET | `/properties/{id}` | PROPERTIES:Read | Chi tiết cấu hình chi nhánh (giờ nhận/trả, buffer dọn) |
| PUT | `/properties/{id}` | PROPERTIES:Update | Cập nhật thông tin chi nhánh |
| PUT | `/properties/{id}/policies` | PROPERTIES:Update | Cập nhật chính sách check-in/out, buffer dọn phòng (min 30m) |
| POST | `/properties/{id}/publish` | PROPERTIES:Approve | Xuất bản / ẩn chi nhánh trên cổng tra cứu công khai |

### 2.4 Room Types (`/api/v1/room-types`) [Property-Scoped: Cần X-Property-Id hoặc JWT pid]

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/room-types` | ROOM_TYPES:Read | Danh sách loại phòng thuộc chi nhánh hiện tại |
| POST | `/room-types` | ROOM_TYPES:Create | Tạo loại phòng mới cho chi nhánh |
| PUT | `/room-types/{id}` | ROOM_TYPES:Update | Cập nhật thông tin loại phòng |
| DELETE | `/room-types/{id}` | ROOM_TYPES:Delete | Xóa loại phòng (nếu chưa có phòng vật lý) |

### 2.5 Rooms (`/api/v1/rooms`) [Property-Scoped: Cần X-Property-Id hoặc JWT pid]

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/rooms` | ROOMS:Read | Danh sách phòng + status |
| GET | `/rooms/{id}` | ROOMS:Read | Chi tiết phòng |
| POST | `/rooms` | ROOMS:Create | Tạo phòng mới |
| PUT | `/rooms/{id}` | ROOMS:Update | Cập nhật thông tin phòng |
| PUT | `/rooms/{id}/status` | ROOMS:Update | Đổi status (Clean/Dirty/OutOfService) |
| DELETE | `/rooms/{id}` | ROOMS:Delete | Disable / vô hiệu hóa phòng |
| GET | `/rooms/availability` | ROOMS:Read | Phòng trống theo date range |

### 2.6 Reservations (`/api/v1/reservations`) [Property-Scoped: Cần X-Property-Id hoặc JWT pid]

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/reservations` | RESERVATIONS:Read | Danh sách booking (filter by status, date) |
| GET | `/reservations/{id}` | RESERVATIONS:Read | Chi tiết booking |
| POST | `/reservations` | RESERVATIONS:Create | Tạo booking (staff) |
| PUT | `/reservations/{id}` | RESERVATIONS:Update | Cập nhật booking |
| POST | `/reservations/{id}/check-in` | CHECK_IN_OUT:Update | Check-in (chuyển trạng thái sang CheckedIn) |
| POST | `/reservations/{id}/check-out` | CHECK_IN_OUT:Update | Check-out (chuyển trạng thái sang CheckedOut) |
| POST | `/reservations/{id}/cancel` | RESERVATIONS:Update | Hủy booking (áp dụng cancellation policy) |
| GET | `/reservations/{id}/folio` | RESERVATIONS:Read | Xem folio (chi tiết bill) |
| POST | `/reservations/{id}/folio/items` | RESERVATIONS:Update | Thêm folio item (minibar, laundry...) |
| GET | `/reservations/calendar` | RESERVATIONS:Read | Calendar view (room × date grid) |
| GET | `/reservations/today` | RESERVATIONS:Read | Arrivals + Departures hôm nay |

### 2.7 💳 Payments (`/api/v1/payments`) [Property-Scoped: Cần X-Property-Id hoặc JWT pid]

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/payments` | PAYMENTS:Read | Lịch sử thanh toán |
| POST | `/payments` | PAYMENTS:Create | Tạo payment (Cash / Transfer) |
| POST | `/payments/vnpay/create` | PAYMENTS:Create | Tạo VNPay payment URL |
| GET | `/payments/vnpay/callback` | Public | VNPay callback (IPN) |
| POST | `/payments/{id}/refund` | PAYMENTS:Approve | **Duyệt hoàn tiền** (Chỉ Property Manager hoặc Tenant Owner / Admin theo D23; Accountant không có quyền) |
| GET | `/payments/summary` | PAYMENTS:Read | Tổng hợp thu/chi hôm nay |

### 2.8 🧾 Invoices (`/api/v1/invoices`) [Property-Scoped: Cần X-Property-Id hoặc JWT pid]

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/invoices` | INVOICES:Read | Danh sách hóa đơn |
| GET | `/invoices/{id}` | INVOICES:Read | Chi tiết hóa đơn |
| GET | `/invoices/{id}/pdf` | INVOICES:Export | **Xuất PDF hóa đơn** (bản in) |
| GET | `/invoices/{id}/print` | INVOICES:Export | **HTML print-friendly** (in trực tiếp) |
| POST | `/invoices/generate` | INVOICES:Create | Tạo hóa đơn từ reservation |
| GET | `/invoices/monthly-summary` | INVOICES:Export | Tổng hợp hóa đơn tháng |

**Cấu trúc hóa đơn (Invoice):**

```json
{
  "invoiceNumber": "INV-2026-100315-001",
  "issuedAt": "2026-10-03T15:30:00Z",
  "property": {
    "name": "Nhà Nghỉ Hoa Đào",
    "address": "12 Trần Phú, Phường 3, TP. Đà Lạt",
    "phone": "0263-123-4567",
    "taxCode": "1234567890"
  },
  "guest": {
    "name": "Lê Thùy Linh",
    "idNumber": "012345678901",
    "phone": "0912-345-678"
  },
  "items": [
    { "description": "Phòng Deluxe 205 (2 đêm × 500,000đ)", "amount": 1000000 },
    { "description": "Minibar", "amount": 150000 },
    { "description": "Giặt ủi", "amount": 80000 }
  ],
  "subtotal": 1230000,
  "taxRate": 10,
  "taxAmount": 123000,
  "serviceFeeRate": 5,
  "serviceFeeAmount": 61500,
  "totalAmount": 1414500,
  "payments": [
    { "method": "VNPay", "amount": 500000, "paidAt": "2026-10-01T10:00:00Z" },
    { "method": "Cash", "amount": 914500, "paidAt": "2026-10-03T15:25:00Z" }
  ],
  "balance": 0,
  "notes": "Cảm ơn quý khách!"
}
```

### 2.9 💰 Pricing (`/api/v1/pricing`) [Property-Scoped: Cần X-Property-Id hoặc JWT pid]

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/pricing/room-types` | ROOM_TYPES:Read | Giá hiện tại tất cả room types |
| GET | `/pricing/room-types/{id}/calendar` | ROOM_TYPES:Read | **Giá theo ngày** (30 ngày tới) — calendar view |
| PUT | `/pricing/room-types/{id}/base` | ROOM_TYPES:Update | Tạo phiên bản giá cơ bản mới, không ghi đè lịch sử |
| POST | `/pricing/room-types/{id}/overrides` | ROOM_TYPES:Update | Tạo phiên bản giá theo khoảng ngày hiệu lực; chặn overlap |
| GET | `/pricing/room-types/{id}/history` | ROOM_TYPES:Read | Lịch sử giá, người sửa và thời điểm |
| DELETE | `/pricing/overrides/{id}` | ROOM_TYPES:Update | Hủy phiên bản tương lai chưa được booking tham chiếu |
| GET | `/pricing/room-types/{id}/ai-suggest` | AI_FEATURES:Read | **AI gợi ý giá** (occupancy, demand, season) |
| POST | `/pricing/room-types/{id}/ai-apply` | ROOM_TYPES:Approve | **Áp dụng giá AI đề xuất** |
| GET | `/pricing/seasons` | ROOM_TYPES:Read | Danh sách mùa (cao/thấp/lễ) |
| POST | `/pricing/seasons` | ROOM_TYPES:Create | Tạo mùa mới + bảng giá |
| PUT | `/pricing/seasons/{id}` | ROOM_TYPES:Update | Cập nhật mùa + giá |

---

### 2.10 📊 Reports & Statistics (`/api/v1/reports`)

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/reports/dashboard` | REPORTS:Read | **Dashboard tổng quan** (KPIs hôm nay) |
| GET | `/reports/revenue` | REPORTS:Read | **Doanh thu** theo ngày/tuần/tháng/năm |
| GET | `/reports/occupancy` | REPORTS:Read | **Tỷ lệ lấp đầy** theo ngày/tuần/tháng |
| GET | `/reports/adr` | REPORTS:Read | **ADR** (Average Daily Rate) |
| GET | `/reports/revpar` | REPORTS:Read | **RevPAR** (Revenue Per Available Room) |
| GET | `/reports/room-revenue` | REPORTS:Read | Doanh thu **theo loại phòng** |
| GET | `/reports/source-analysis` | REPORTS:Read | Phân tích nguồn booking (online/walk-in/OTA) |
| GET | `/reports/guest-demographics` | REPORTS:Read | Thống kê khách (quốc tịch, loại khách) |
| GET | `/reports/housekeeping-performance` | REPORTS:Read | **Hiệu suất housekeeping** (avg turnaround) |
| GET | `/reports/cancellation-rate` | REPORTS:Read | **Tỷ lệ hủy** booking |
| GET | `/reports/payment-summary` | REPORTS:Read | **Thu chi tổng hợp** (method breakdown) |
| GET | `/reports/ai-narrative` | AI_FEATURES:Read | **AI tự viết báo cáo** tự nhiên (narrative) |
| GET | `/reports/export/excel` | REPORTS:Export | **Xuất Excel** báo cáo tổng hợp |
| GET | `/reports/export/pdf` | REPORTS:Export | **Xuất PDF** báo cáo tổng hợp |

---

### 2.11 🔔 Real-time Notifications (`/api/v1/notifications`)

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/notifications` | Authenticated | Danh sách notification (paginated) |
| GET | `/notifications/unread-count` | Authenticated | Số notification chưa đọc |
| PUT | `/notifications/{id}/read` | Authenticated | Đánh dấu đã đọc |
| PUT | `/notifications/read-all` | Authenticated | Đánh dấu tất cả đã đọc |
| DELETE | `/notifications/{id}` | Authenticated | Xóa notification |

---

### 2.12 Housekeeping (`/api/v1/housekeeping`) [Property-Scoped: Cần X-Property-Id hoặc JWT pid]

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/housekeeping` | HOUSEKEEPING:Read | Danh sách tasks buồng phòng |
| POST | `/housekeeping` | HOUSEKEEPING:Create | Tạo task dọn phòng thủ công |
| PUT | `/housekeeping/{id}/assign` | HOUSEKEEPING:Update | Gán task cho nhân viên buồng phòng |
| PUT | `/housekeeping/{id}/claim` | HOUSEKEEPING:Update | Housekeeper tự nhận task |
| PUT | `/housekeeping/{id}/status` | HOUSEKEEPING:Update | Cập nhật status (Clean, Cleaning, Dirty) |
| GET | `/housekeeping/board` | HOUSEKEEPING:Read | Kanban board trạng thái dọn dẹp |

---

### 2.13 Roles & Staff (`/api/v1/admin`)

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/admin/roles` | ROLES:Read | Danh sách vai trò RBAC |
| POST | `/admin/roles` | ROLES:Create | Tạo vai trò tùy chỉnh |
| PUT | `/admin/roles/{id}` | ROLES:Update | Cập nhật vai trò & bitmask |
| DELETE | `/admin/roles/{id}` | ROLES:Delete | Xóa vai trò tùy chỉnh |
| GET | `/admin/staff` | STAFF:Read | Danh sách nhân sự & chi nhánh được gán |
| POST | `/admin/staff/invite` | STAFF:Create | Mời nhân viên qua email / gán vai trò & chi nhánh |
| PUT | `/admin/staff/{id}` | STAFF:Update | Đổi vai trò, đổi chi nhánh hoặc kích hoạt/vô hiệu |
| DELETE | `/admin/staff/{id}` | STAFF:Delete | Thu hồi quyền nhân viên |

---

### 2.14 AI Features (`/api/v1/ai`)

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| POST | `/ai/concierge` | Public (guest) | Chatbot tư vấn tìm phòng |
| POST | `/ai/concierge/feedback` | Public | Đánh giá phản hồi chatbot |
| GET | `/ai/pricing/suggest/{roomTypeId}` | AI_FEATURES:Read | Gợi ý giá thông minh cho loại phòng |
| POST | `/ai/pricing/apply` | ROOM_TYPES:Approve | Áp dụng mức giá do AI đề xuất |
| GET | `/ai/report-narrative` | AI_FEATURES:Read | Tự động tổng hợp báo cáo bằng lời |
| GET | `/ai/usage-log` | AI_FEATURES:Read | Lịch sử hạn ngạch sử dụng AI |

---

### 2.15 Public APIs (Guest-facing, no auth)

| Method | Endpoint | Permission | Mô tả |
|--------|----------|-----------|-------|
| GET | `/public/search` | Public | Tìm cơ sở/chi nhánh đã xuất bản |
| GET | `/public/properties/{slug}` | Public | Trang giới thiệu chi nhánh |
| GET | `/public/properties/{slug}/rooms` | Public | Phòng khả dụng & giá theo thời gian thực |
| POST | `/public/bookings` | Public/Guest | Đặt phòng trực tuyến |
| GET | `/public/bookings/{code}` | Public | Tra cứu booking bằng ConfirmationCode |
| POST | `/public/reviews` | Authenticated Guest | Viết đánh giá sau khi check-out |
| GET | `/public/properties/{slug}/reviews` | Public | Danh sách đánh giá của chi nhánh |

---

## 3. Contracts Chi tiết cho Context Switching & Support Grant

### 3.1. Contract Chuyển đổi Ngữ cảnh (`POST /api/v1/auth/switch-context`)

- **Mục đích:** Người dùng (đặc biệt là Owner quản lý chuỗi hoặc nhân viên làm việc tại nhiều chi nhánh) chuyển đổi môi trường làm việc sang một Chi nhánh/Doanh nghiệp cụ thể, nhận JWT mới chứa claims tương ứng.
- **Headers:** `Authorization: Bearer <JWT>`
- **Request Body:**
  ```json
  {
    "tenantId": "e0b9a674-3259-4d2b-a3d8-3a216b5a3401",
    "propertyId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
  }
  ```
- **Validation Rules:**
  1. `tenantId` bắt buộc, phải là GUID hợp lệ.
  2. `propertyId` tùy chọn (null nếu là Tenant Owner muốn làm việc ở cấp Tenant-wide).
  3. Người dùng phải có liên kết `TenantStaff` hợp lệ và đang hoạt động (`IsActive = true`) tại `tenantId`.
  4. Nếu `propertyId != null`, `propertyId` bắt buộc phải thuộc về `tenantId` và người dùng phải có quyền truy cập (hoặc là Tenant Owner/Admin, hoặc có bản ghi `TenantStaff.PropertyId == propertyId`).
- **Response Success (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "d83j...base64...",
      "expiresAtUtc": "2026-10-06T12:00:00Z",
      "currentTenant": {
        "id": "e0b9a674-3259-4d2b-a3d8-3a216b5a3401",
        "name": "Chuỗi Khách Sạn Hoa Sen"
      },
      "currentProperty": {
        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "name": "Khách Sạn Hoa Sen - Chi nhánh Đà Nẵng",
        "code": "HS-DN"
      },
      "permissions": ["ROOMS:15", "RESERVATIONS:7", "PAYMENTS:3"]
    }
  }
  ```

---

### 3.2. Contract Cấp quyền Hỗ trợ Kỹ thuật (`POST /api/v1/tenants/current/support-grants`)

- **Mục đích:** Tenant Owner ủy quyền cho nhân viên kỹ thuật của Platform truy cập dữ liệu để điều tra/sửa lỗi trong thời gian giới hạn.
- **Thẩm quyền:** Chỉ `Tenant Owner` (Role `OWNER`).
- **Request Body:**
  ```json
  {
    "grantedToUserId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "propertyId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "reason": "Điều tra lỗi sai lệch tiền đối soát cổng thanh toán VNPay ca tối ngày 05/10",
    "durationMinutes": 240,
    "scope": "READ_ONLY"
  }
  ```
- **Validation Rules:**
  1. `reason`: Bắt buộc, độ dài tối thiểu 20 ký tự.
  2. `durationMinutes`: Bắt buộc, giá trị từ 15 đến 480 phút (tối đa 8 giờ).
  3. `scope`: Bắt buộc, giá trị trong enum `["READ_ONLY", "DIAGNOSTIC"]`.
  4. `grantedToUserId`: Phải là tài khoản nhân viên Platform hợp lệ nằm trong **Support Recipient Allowlist (`PlatformSupportRecipientAllowlist`)** được phê duyệt an ninh.
- **Response Success (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "b1b11111-2222-3333-4444-555555555555",
      "tenantId": "e0b9a674-3259-4d2b-a3d8-3a216b5a3401",
      "propertyId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "grantedToUserId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "reason": "Điều tra lỗi sai lệch tiền đối soát cổng thanh toán VNPay...",
      "scope": "READ_ONLY",
      "expiresAtUtc": "2026-10-06T16:00:00Z",
      "createdAtUtc": "2026-10-06T12:00:00Z",
      "isActive": true
    }
  }
  ```

---

### 3.3. Contract Thu hồi Quyền Hỗ trợ Tức thì (`POST /api/v1/tenants/current/support-grants/{id}/revoke`)

- **Mục đích:** Tenant Owner hoặc Platform SuperAdmin thu hồi quyền hỗ trợ ngay lập tức trước khi hết hạn.
- **Request Body:**
  ```json
  {
    "revocationReason": "Kỹ thuật viên đã hỗ trợ xong cấu hình cổng thanh toán"
  }
  ```
- **Validation Rules:**
  1. `id` phải tồn tại và thuộc về Tenant hiện tại.
  2. Bản ghi grant chưa bị thu hồi trước đó (`RevokedAtUtc == null`).
- **Response Success (200 OK):**
  ```json
  {
    "success": true,
    "message": "Thu hồi quyền hỗ trợ kỹ thuật thành công. Phiên làm việc đã bị hủy hiệu lực ngay lập tức."
  }
  ```

---

## 4. Danh mục Mã lỗi Chuẩn hóa & Kịch bản Kiểm thử Âm tính (Negative Cases)

Mọi phản hồi lỗi 4xx/5xx đều tuân thủ cấu trúc chuẩn, **tuyệt đối không trả text cứng** để hỗ trợ i18n:
```json
{
  "success": false,
  "errorCode": "ERR_CONTEXT_MISMATCH",
  "message": "Mã ngữ cảnh chi nhánh không khớp giữa token và header yêu cầu.",
  "errors": {}
}
```

| Mã lỗi (`errorCode`) | HTTP Status | Điều kiện kích hoạt (Negative Trigger) | Biện pháp xử lý của Backend |
|---|:---:|---|---|
| `ERR_CONTEXT_MISMATCH` | 400 | Header `X-Property-Id` khác với claim `propertyId` trong JWT | Chặn ngay tại `TenantMiddleware`, không xử lý request |
| `ERR_MISSING_PROPERTY_CONTEXT` | 400 | Gọi API Property-scoped nhưng JWT không có `pid` và request không có `X-Property-Id` | Chặn fail-closed, yêu cầu client chọn chi nhánh |
| `ERR_PROPERTY_NOT_IN_TENANT` | 403 | `X-Property-Id` được truyền không thuộc quyền sở hữu của `TenantId` trong token | Chặn tại `PropertyScopeValidationBehavior` |
| `ERR_FORBIDDEN_PROPERTY_SCOPE` | 403 | Nhân viên chỉ có quyền ở Chi nhánh A cố tình gửi request truy cập Chi nhánh B | Chặn tại `PermissionAuthorizationHandler` |
| `ERR_MEMBERSHIP_INACTIVE` | 403 | Tài khoản nhân viên tại chi nhánh đã bị vô hiệu hóa (`IsActive = false`) | Chặn đăng nhập và chặn gọi API |
| `ERR_MEMBERSHIP_DUPLICATE_BRANCH` | 409 | Gán trùng lặp nhân viên vào cùng một chi nhánh | Bắt vi phạm `uq_tenant_staff_property_scoped` |
| `ERR_SUPPORT_USER_NOT_IN_ALLOWLIST`| 400 | Chỉ định nhân viên kỹ thuật không nằm trong Support Recipient Allowlist | Chặn tại command validator của support grant |
| `ERR_SUPPORT_GRANT_REQUIRED` | 403 | Platform Staff cố tình gọi API khách hàng mà không truyền `X-Support-Grant-Id` | Chặn tại `SupportAuthorizationMiddleware` |
| `ERR_SUPPORT_GRANT_EXPIRED` | 403 | `X-Support-Grant-Id` đã quá thời gian `ExpiresAtUtc` | Chặn truy cập, yêu cầu cấp mới |
| `ERR_SUPPORT_GRANT_REVOKED` | 403 | `X-Support-Grant-Id` đã bị Tenant Owner thu hồi (`RevokedAtUtc != null`) | Chặn tức thì tại middleware |
| `ERR_SUPPORT_ACTION_NOT_PERMITTED` | 403 | Thao tác ngoài Action Allowlist hoặc thuộc danh mục cấm (Bulk Export, Mutation, PII/Security) | Chặn tại `SupportAuthorizationMiddleware` |
| `ERR_SUPPORT_GRANT_READ_ONLY` | 403 | Platform Staff thực hiện thao tác ghi khi grant chỉ là `READ_ONLY` | Chặn ghi, chỉ cho phép GET |
| `ERR_FORBIDDEN_INSUFFICIENT_PERMISSIONS` | 403 | Thiếu bitmask hành động yêu cầu (Ví dụ: Lễ tân hoặc Accountant gọi duyệt hoàn tiền) | Chặn tại `RequirePermissionAttribute` |

---

## 5. SignalR Hubs (Real-time)

| Hub | URL | Events | Mô tả |
|-----|-----|--------|-------|
| **RoomStatusHub** | `/hubs/room-status` | `RoomStatusChanged`, `RoomCreated` | Real-time room board |
| **NotificationHub** | `/hubs/notifications` | `NewNotification`, `NotificationRead` | Push notifications |
| **PricingHub** | `/hubs/pricing` | `PriceChanged`, `AiPricingSuggestion` | Real-time price updates |
| **BookingHub** | `/hubs/bookings` | `NewBooking`, `BookingCancelled`, `BookingStatusChanged` | Real-time booking updates |
| **DashboardHub** | `/hubs/dashboard` | `RevenueUpdated`, `OccupancyChanged` | Live dashboard KPIs |

