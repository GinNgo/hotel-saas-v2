# 🔀 Sequence Diagrams

> **Tài liệu:** SDD-04 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 Mức 5 (≥4 loại sơ đồ — Sequence là loại thứ 4)

---

## SEQ-01: User Registration

```mermaid
sequenceDiagram
    actor G as Guest
    participant SPA as Angular SPA
    participant API as .NET API
    participant DB as PostgreSQL
    participant Email as Email Service

    G->>SPA: Nhập email, password, fullName
    SPA->>SPA: Client-side validation
    SPA->>API: POST /api/auth/register
    API->>API: FluentValidation (email format, password strength)
    API->>DB: Check email exists?
    alt Email đã tồn tại
        DB-->>API: User found
        API-->>SPA: 409 Conflict "Email đã được sử dụng"
        SPA-->>G: Hiển thị lỗi
    else Email mới
        DB-->>API: Not found
        API->>API: Hash password (bcrypt 10 rounds)
        API->>DB: INSERT User (GlobalRole=Customer)
        API->>API: Generate verification token
        API->>Email: Send verification email
        API-->>SPA: 201 Created { userId }
        SPA-->>G: "Đăng ký thành công! Kiểm tra email"
    end
```

---

## SEQ-02: Login + JWT Flow

```mermaid
sequenceDiagram
    actor U as User
    participant SPA as Angular SPA
    participant API as .NET API
    participant DB as PostgreSQL

    U->>SPA: Nhập email, password
    SPA->>API: POST /api/auth/login
    API->>DB: Find user by email
    alt User not found or inactive
        API-->>SPA: 401 "Email hoặc mật khẩu không đúng"
    else User found
        API->>API: Verify bcrypt hash
        alt Password sai
            API->>DB: Increment failedLoginCount
            API-->>SPA: 401 "Email hoặc mật khẩu không đúng"
        else Password đúng
            API->>DB: Load TenantStaff + Roles + Permissions
            API->>API: Generate JWT (userId, tenantId, permissions[])
            API->>API: Generate Refresh Token
            API->>DB: Save RefreshToken
            API-->>SPA: 200 { accessToken, refreshToken, user }
            SPA->>SPA: Store tokens (memory + localStorage)
            SPA-->>U: Redirect to Dashboard
        end
    end
```

---

## SEQ-03: RBAC Permission Check

```mermaid
sequenceDiagram
    participant SPA as Angular SPA
    participant API as .NET API
    participant MW as TenantMiddleware
    participant Auth as JwtBearerAuth
    participant RBAC as PermissionHandler
    participant Handler as CommandHandler
    participant DB as PostgreSQL

    SPA->>API: GET /api/reservations (Authorization: Bearer <token>)
    API->>Auth: Validate JWT signature + expiry
    alt Token invalid / expired
        Auth-->>SPA: 401 Unauthorized
    end
    Auth->>MW: Extract TenantId from claims
    MW->>MW: Set CurrentTenantService.TenantId
    Auth->>RBAC: Check [RequirePermission("RESERVATION", Read)]
    RBAC->>RBAC: Extract claims: "RESERVATION:7"
    RBAC->>RBAC: Check: (7 & 1) == 1 → ✅ has Read
    RBAC-->>Handler: Authorized
    Handler->>DB: SELECT * FROM Reservations WHERE TenantId = @current
    Note over DB: Global Query Filter auto-appends<br/>WHERE TenantId = @tenantId
    DB-->>Handler: Results (tenant-scoped)
    Handler-->>SPA: 200 [reservations]
```

---

## SEQ-04: Guest Booking Flow (Online)

```mermaid
sequenceDiagram
    actor G as Guest
    participant SPA as Angular SPA
    participant API as .NET API
    participant DB as PostgreSQL
    participant VNPay as VNPay Gateway
    participant Email as Email Service
    participant Worker as BookingHoldCleanup

    G->>SPA: Search (location, dates, guests)
    SPA->>API: GET /api/public/search?city=...&checkIn=...&checkOut=...
    API->>DB: Query available rooms (no overlap, status != OutOfService)
    DB-->>API: Available rooms + types + prices
    API-->>SPA: Room list with pricing

    G->>SPA: Select room, fill guest info
    SPA->>API: POST /api/public/bookings
    API->>API: Validate (dates, overlap, capacity)
    API->>DB: INSERT Reservation (PendingPayment)
    API->>API: Generate ConfirmationCode (6 chars)
    API-->>SPA: 201 { reservationId, confirmationCode }

    G->>SPA: Chọn thanh toán VNPay
    SPA->>API: POST /api/payments/vnpay/create { reservationId }
    API->>API: Generate VNPay URL + idempotencyKey
    API->>DB: INSERT Payment (Pending)
    API-->>SPA: { vnpayRedirectUrl }
    SPA->>VNPay: Redirect to VNPay
    G->>VNPay: Xác nhận thanh toán

    VNPay->>API: GET /api/payments/vnpay/callback?vnp_ResponseCode=00
    API->>API: Verify HMAC signature
    API->>DB: Check idempotencyKey (chống duplicate)
    API->>DB: UPDATE Payment → Completed
    API->>DB: UPDATE Reservation → Confirmed
    API->>Email: Send confirmation email
    API-->>VNPay: 302 Redirect to frontend/booking/success

    Note over Worker: Chạy mỗi 5 phút
    Worker->>DB: SELECT bookings WHERE status=PendingPayment AND age > 30min
    Worker->>DB: UPDATE → Cancelled (auto)
```

---

## SEQ-05: Check-in Flow

```mermaid
sequenceDiagram
    actor R as Receptionist
    participant SPA as Angular SPA
    participant API as .NET API
    participant DB as PostgreSQL
    participant Hub as RoomStatusHub

    R->>SPA: Tìm booking (tên/SĐT/mã xác nhận)
    SPA->>API: GET /api/reservations?search=HK7B2M
    API->>DB: Query reservation by confirmationCode
    DB-->>API: Reservation details
    API-->>SPA: Reservation + Room + Guest info

    R->>SPA: Click "Check-in"
    SPA->>API: POST /api/reservations/{id}/check-in

    API->>DB: Verify reservation.Status == Confirmed
    alt Status != Confirmed
        API-->>SPA: 400 "Booking chưa xác nhận thanh toán"
    end
    API->>DB: UPDATE Reservation.Status → CheckedIn
    API->>DB: UPDATE Room.Status → Occupied
    API->>Hub: Broadcast("RoomStatusChanged", { roomId, status: "Occupied" })
    Hub-->>SPA: SignalR push to all connected clients
    API-->>SPA: 200 { reservation (updated) }
    SPA-->>R: ✅ "Check-in thành công — Phòng 205"
```

---

## SEQ-06: Check-out + Invoice

```mermaid
sequenceDiagram
    actor R as Receptionist
    participant SPA as Angular SPA
    participant API as .NET API
    participant DB as PostgreSQL
    participant Hub as RoomStatusHub
    participant PDF as PDF Generator

    R->>SPA: Tìm reservation đang CheckedIn
    SPA->>API: GET /api/reservations/{id}/folio
    API->>DB: Load folio items (room charge, minibar, tax, service fee)
    API-->>SPA: Folio summary { items[], balance }

    alt Balance > 0
        R->>SPA: Thu thanh toán (Cash)
        SPA->>API: POST /api/payments { method: "Cash", amount: balance }
        API->>DB: INSERT Payment (Completed)
    end

    R->>SPA: Click "Check-out"
    SPA->>API: POST /api/reservations/{id}/check-out
    API->>DB: Verify balance == 0
    API->>DB: UPDATE Reservation.Status → CheckedOut
    API->>DB: UPDATE Room.Status → Dirty
    API->>DB: INSERT HousekeepingTask (Priority: Normal, Status: Pending)
    API->>Hub: Broadcast("RoomStatusChanged", { roomId, status: "Dirty" })
    API-->>SPA: 200 { reservation, housekeepingTaskId }

    R->>SPA: Click "Xuất Invoice"
    SPA->>API: GET /api/invoices/{reservationId}/pdf
    API->>PDF: Generate PDF (property info, guest, items, tax, total)
    API-->>SPA: application/pdf
    SPA-->>R: Download PDF
```

---

## SEQ-07: Housekeeping Task Lifecycle

```mermaid
sequenceDiagram
    actor M as Manager
    actor H as Housekeeper
    participant SPA as Angular SPA
    participant API as .NET API
    participant DB as PostgreSQL
    participant Hub as RoomStatusHub
    participant Notif as NotificationHub

    Note over API: Auto-triggered by Check-out
    API->>DB: INSERT HousekeepingTask (Pending, unassigned)
    API->>Notif: Push to Manager "Phòng 205 cần dọn"

    M->>SPA: Assign task cho Housekeeper
    SPA->>API: PUT /api/housekeeping/{id}/assign { staffId }
    API->>DB: UPDATE task.AssignedToId
    API->>Notif: Push to Housekeeper "Bạn được giao dọn phòng 205"
    API-->>SPA: 200

    H->>SPA: Bắt đầu dọn → "Start"
    SPA->>API: PUT /api/housekeeping/{id}/status { status: "InProgress" }
    API->>DB: UPDATE task.Status → InProgress
    API-->>SPA: 200

    H->>SPA: Hoàn thành → "Complete"
    SPA->>API: PUT /api/housekeeping/{id}/status { status: "Completed" }
    API->>DB: UPDATE task.Status → Completed, CompletedAtUtc = now
    API->>DB: UPDATE Room.Status → Clean
    API->>Hub: Broadcast("RoomStatusChanged", { roomId, status: "Clean" })
    API-->>SPA: 200
    SPA-->>H: ✅ "Hoàn thành — Phòng 205 sẵn sàng"
```

---

## SEQ-08: AI Concierge Query

```mermaid
sequenceDiagram
    actor G as Guest
    participant SPA as Angular SPA
    participant API as .NET API
    participant DB as PostgreSQL
    participant Gemini as Gemini AI API

    G->>SPA: Mở chatbot, hỏi "Khách sạn có chỗ đỗ xe không?"
    SPA->>API: POST /api/ai/concierge { query, propertyId }
    API->>DB: Load property info (amenities, policies, address)
    API->>API: Build system prompt + property context

    API->>Gemini: generateContent({ systemPrompt, userQuery })
    Gemini-->>API: AI response

    API->>DB: INSERT AiUsageLog { tool, scope, prompt, response, tokens }
    API-->>SPA: { response, disclaimer: "Kết quả từ AI" }
    SPA-->>G: 💬 "Có ạ! Khách sạn có bãi đỗ xe miễn phí..."

    G->>SPA: 👍 Feedback "Hữu ích"
    SPA->>API: POST /api/ai/feedback { logId, positive: true }
    API->>DB: UPDATE AiUsageLog.Feedback = positive
```

---

## Tổng hợp Sequence Diagrams

| # | Flow | Actors | Hệ thống tương tác |
|---|------|--------|-------------------|
| SEQ-01 | Registration | Guest | SPA → API → DB → Email |
| SEQ-02 | Login + JWT | User | SPA → API → DB |
| SEQ-03 | RBAC Check | Any | SPA → API (Middleware pipeline) → DB |
| SEQ-04 | Guest Booking | Guest | SPA → API → DB → VNPay → Email |
| SEQ-05 | Check-in | Receptionist | SPA → API → DB → SignalR |
| SEQ-06 | Check-out + Invoice | Receptionist | SPA → API → DB → SignalR → PDF |
| SEQ-07 | Housekeeping | Manager, Housekeeper | SPA → API → DB → SignalR → Notification |
| SEQ-08 | AI Concierge | Guest | SPA → API → DB → Gemini AI |

> ✅ **8 sequence diagrams** bao phủ tất cả core flows

---

*Tài liệu này phục vụ TC2.1 Mức 5 (sequence diagram — loại sơ đồ thứ 4+).*
