# 🔄 Business Process Diagrams

> **Tài liệu:** SRS-04 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 Mức 5 (mô hình quy trình nghiệp vụ)
> **Công cụ:** Mermaid flowcharts

---

## Flow 1: Đăng ký Property → Cấu hình → Hoạt động

```mermaid
flowchart TD
    Start(["👤 Owner đăng ký tài khoản"]) --> Register["Nhập email, password"]
    Register --> Verify{"Email verified?"}
    Verify -->|Chưa| SendEmail["Gửi email xác nhận"]
    SendEmail --> ClickLink["Owner click link"]
    ClickLink --> Verify
    Verify -->|Rồi| CreateProp["Tạo Property<br/>(tên, địa chỉ, loại hình)"]
    CreateProp --> Config["Cấu hình Property"]

    Config --> C1["Tạo Room Types<br/>(Standard, Deluxe, Suite)"]
    Config --> C2["Tạo Rooms<br/>(số phòng, tầng, loại)"]
    Config --> C3["Cấu hình policies<br/>(check-in/out time, hủy, trẻ em)"]
    Config --> C4["Thiết lập RBAC<br/>(tạo roles, mời staff)"]

    C1 --> Ready(["✅ Property sẵn sàng<br/>nhận đặt phòng"])
    C2 --> Ready
    C3 --> Ready
    C4 --> Ready
```

---

## Flow 2: Khách đặt phòng Online

```mermaid
flowchart TD
    Start(["🧑 Guest truy cập trang booking"]) --> Search["Tìm kiếm<br/>(location, dates, guests)"]
    Search --> Results["Hiển thị danh sách<br/>phòng khả dụng"]
    Results --> Select["Chọn phòng + loại phòng"]
    Select --> GuestInfo["Nhập thông tin khách<br/>(tên, email, SĐT)"]
    GuestInfo --> PayMethod{"Phương thức<br/>thanh toán?"}

    PayMethod -->|VNPay| VNPay["Redirect VNPay Gateway"]
    PayMethod -->|Thanh toán tại quầy| PayLater["Tạo booking<br/>PendingPayment"]

    VNPay --> VNResult{"VNPay callback?"}
    VNResult -->|Success| Confirmed["✅ Booking Confirmed"]
    VNResult -->|Fail| Failed["❌ Payment Failed<br/>→ Retry hoặc hủy"]

    Confirmed --> SendConfirm["📧 Gửi email xác nhận<br/>+ Confirmation Code"]
    PayLater --> Hold["⏰ Giữ phòng 30 phút"]
    Hold --> HoldCheck{"Thanh toán<br/>trong 30 phút?"}
    HoldCheck -->|Có| Confirmed
    HoldCheck -->|Không| AutoCancel["🗑️ Tự động hủy booking<br/>(BookingHoldCleanup Worker)"]

    Failed --> Retry{"Thử lại?"}
    Retry -->|Có| PayMethod
    Retry -->|Không| Cancel["Hủy booking"]
```

---

## Flow 3: Check-in → Lưu trú → Folio → Check-out

```mermaid
flowchart TD
    Start(["👷 Lễ tân nhận khách"]) --> FindBooking{"Có booking<br/>trước?"}

    FindBooking -->|Có| SearchBooking["Tìm booking<br/>(tên / SĐT / mã)"]
    FindBooking -->|Không (walk-in)| WalkIn["Tạo booking mới<br/>+ chọn phòng trống"]

    SearchBooking --> VerifyGuest["Xác minh thông tin khách"]
    WalkIn --> VerifyGuest

    VerifyGuest --> PayCheck{"Đã thanh toán<br/>deposit?"}
    PayCheck -->|Chưa| CollectPayment["Thu deposit<br/>(Cash/VNPay/Transfer)"]
    PayCheck -->|Rồi| CheckIn["✅ CHECK-IN<br/>Reservation → CheckedIn<br/>Room → Occupied"]
    CollectPayment --> CheckIn

    CheckIn --> SignalR["📡 SignalR broadcast<br/>room status change"]
    CheckIn --> Stay["🏨 Khách lưu trú"]

    Stay --> AddFolio["Thêm Folio items<br/>(minibar, laundry, extras)"]
    AddFolio --> Stay
    Stay --> CheckOutReq["Khách yêu cầu check-out"]

    CheckOutReq --> ReviewFolio["📋 Review Folio<br/>(room charge + extras + tax)"]
    ReviewFolio --> BalanceCheck{"Balance = 0?"}
    BalanceCheck -->|Chưa| FinalPayment["Thu thanh toán cuối"]
    BalanceCheck -->|Rồi| CheckOut["✅ CHECK-OUT<br/>Reservation → CheckedOut<br/>Room → Dirty"]
    FinalPayment --> CheckOut

    CheckOut --> AutoTask["🧹 Auto tạo<br/>Housekeeping Task"]
    CheckOut --> Invoice["🧾 Tạo Invoice"]
    CheckOut --> SignalR2["📡 SignalR broadcast"]
```

---

## Flow 4: Housekeeping Lifecycle

```mermaid
flowchart TD
    Start(["🔔 Trigger"]) --> Trigger{"Nguồn?"}

    Trigger -->|"Check-out<br/>(tự động)"| Auto["Auto tạo task<br/>Priority: Normal<br/>Status: Pending"]
    Trigger -->|"Manager tạo<br/>(thủ công)"| Manual["Manager tạo task<br/>Chọn phòng + priority"]

    Auto --> Assign{"Có assign<br/>housekeeper?"}
    Manual --> Assign

    Assign -->|Chưa| Unassigned["Task unassigned<br/>Hiển thị trên board"]
    Assign -->|Rồi| Assigned["📱 Notification<br/>cho housekeeper"]

    Unassigned --> ManagerAssign["Manager assign"]
    ManagerAssign --> Assigned
    Unassigned --> SelfClaim["Housekeeper tự claim"]
    SelfClaim --> Assigned

    Assigned --> InProgress["Housekeeper bắt đầu<br/>Task → InProgress"]
    InProgress --> Complete["Hoàn thành<br/>Task → Completed"]
    Complete --> RoomClean["Room → Clean<br/>📡 SignalR broadcast"]

    RoomClean --> ReadyNext(["✅ Phòng sẵn sàng<br/>cho khách tiếp theo"])
```

---

## Flow 5: Payment Lifecycle

```mermaid
flowchart TD
    Start(["💳 Yêu cầu thanh toán"]) --> Method{"Phương thức?"}

    Method -->|VNPay| CreatePayment["Tạo Payment record<br/>Status: Pending<br/>Generate idempotency key"]
    Method -->|Cash| CashPayment["Thu tiền mặt"]
    Method -->|Bank Transfer| TransferPayment["Xác nhận chuyển khoản"]

    CreatePayment --> RedirectVNPay["Redirect sang VNPay"]
    RedirectVNPay --> WaitCallback["⏳ Chờ VNPay callback"]

    WaitCallback --> CallbackResult{"Callback result?"}
    CallbackResult -->|"00 (Success)"| CheckIdempotent{"Idempotent check<br/>(đã xử lý chưa?)"}
    CallbackResult -->|"Other (Fail)"| PayFailed["Payment → Failed"]

    CheckIdempotent -->|Chưa| PaySuccess["Payment → Completed<br/>Booking → Confirmed"]
    CheckIdempotent -->|Rồi| Skip["Skip (đã xử lý)"]

    CashPayment --> PaySuccess
    TransferPayment --> PaySuccess

    PaySuccess --> Notify["📧 Email xác nhận<br/>📱 In-app notification"]

    PayFailed --> RetryOption{"Cho phép<br/>thử lại?"}
    RetryOption -->|Có| Method
    RetryOption -->|Không| Expired["Payment → Expired"]

    subgraph Refund["🔄 Refund Flow"]
        RefundReq["Yêu cầu hoàn tiền"] --> ApproveRefund{"Manager approve?"}
        ApproveRefund -->|Có| ProcessRefund["Xử lý hoàn tiền<br/>Payment → Refunded"]
        ApproveRefund -->|Không| DenyRefund["Từ chối<br/>Thông báo lý do"]
    end
```

---

## Flow 6: AI Concierge Query

```mermaid
flowchart TD
    Start(["🧑 Guest mở chatbot"]) --> Input["Nhập câu hỏi<br/>(tiếng Việt / English)"]
    Input --> Preprocess["Tiền xử lý<br/>- Detect language<br/>- Extract intent"]

    Preprocess --> Intent{"Intent?"}

    Intent -->|"Hỏi thông tin<br/>property"| PropertyContext["Lấy property info<br/>(amenities, policies, nearby)"]
    Intent -->|"Hỏi booking<br/>availability"| BookingContext["Kiểm tra phòng trống<br/>(dates, room types)"]
    Intent -->|"Hỏi về<br/>địa phương"| LocalContext["Thông tin<br/>du lịch địa phương"]
    Intent -->|"Không rõ"| Fallback["Gợi ý liên hệ<br/>lễ tân"]

    PropertyContext --> GeminiCall["🤖 Gemini API Call<br/>+ System prompt<br/>+ Property context"]
    BookingContext --> GeminiCall
    LocalContext --> GeminiCall

    GeminiCall --> LogAI["📝 Log AI Usage<br/>(timestamp, prompt,<br/>response, tokens)"]
    LogAI --> Response["💬 Hiển thị response"]
    Fallback --> Response

    Response --> Feedback{"Hữu ích?"}
    Feedback -->|"👍"| LogPositive["Log positive feedback"]
    Feedback -->|"👎"| LogNegative["Log negative feedback<br/>+ Suggest contact staff"]
    Feedback -->|Bỏ qua| End(["Kết thúc"])
    LogPositive --> End
    LogNegative --> End
```

---

## Tổng hợp

| # | Flow | Actors | Trigger | Kết quả |
|---|------|--------|---------|---------|
| 1 | Đăng ký Property | Owner | User action | Property hoạt động |
| 2 | Đặt phòng Online | Guest | User action | Booking Confirmed |
| 3 | Check-in → Check-out | Receptionist, Guest | Booking arrival | Invoice created |
| 4 | Housekeeping | Manager, Housekeeper | Check-out / Manual | Room Clean |
| 5 | Payment | Guest, Receptionist, VNPay | Booking / Folio | Payment Completed |
| 6 | AI Concierge | Guest, Gemini AI | User query | AI Response |

---

*Tài liệu này chứa 6 business process diagrams, phục vụ TC2.1 Mức 5 (mô hình quy trình nghiệp vụ).*
