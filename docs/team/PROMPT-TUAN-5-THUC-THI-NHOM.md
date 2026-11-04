# BỘ PROMPT THỰC THI & PHÂN CÔNG NHIỆM VỤ TUẦN 05 — DỰ ÁN HOTEL SAAS PLATFORM V2
## Dành cho 3 thành viên: Ngô Võ Tuấn An (Lead), Nguyễn Khôi Nguyên, Trần Trọng Tân
**Nền tảng công nghệ:** .NET 10 WebAPI + Angular 22 Standalone Signals + PostgreSQL 17 + Docker Caddy
**Môi trường Staging:** `https://luxustay.duckdns.org/` | **Nhánh Git cơ sở:** `develop`

---

## 1. Hướng Dẫn Chung Cho Cả 3 Thành Viên Khi Sử Dụng AI (AI Prompting Standard)

Mỗi thành viên khi sử dụng AI Coding Assistant (Antigravity, Claude, ChatGPT, Cursor...) **BẮT BUỘC** tuân thủ các quy tắc bất biến trong [AGENTS.md](file:///c:/Projects/hotel-sass-rbac/AGENTS.md):

1. **Quy tắc Git-First (Check & Pull trước khi code):**
   ```bash
   git status
   git checkout develop
   git fetch origin
   git pull origin develop
   git checkout -b feature/<ten-nhanh-tuan-5>
   ```
2. **Quy tắc Zero-Secrets (Bảo vệ bí mật an toàn tuyệt đối):**
   * Tuyệt đối không đưa mật khẩu thật, JWT Secret thật, Database Connection String thật, Firebase Private Key thật vào code commit lên Git.
   * Dùng biến môi trường (`.env.local`, `appsettings.Local.json`, user-secrets).
3. **Quy tắc Kiến trúc Clean Architecture & Angular 22:**
   * Backend: Domain $\rightarrow$ Application $\rightarrow$ Infrastructure $\rightarrow$ WebApi. Không phụ thuộc ngược.
   * Frontend: 100% Standalone Component, `ChangeDetectionStrategy.OnPush`, Signal (`signal()`, `computed()`, `effect()`), không dùng `any`.
4. **Cổng kiểm thử trước khi nộp PR (Quality Gates):**
   ```bash
   # Backend
   dotnet build backend/HotelSaas.slnx --verbosity minimal
   dotnet test backend/HotelSaas.slnx --no-build

   # Frontend
   npm --prefix frontend run build
   npm --prefix frontend test -- --watch=false
   ```
5. **Ghi nhật ký sử dụng AI (AI Usage Log):**
   * Lưu lại: Mã Prompt, Mục đích, Hạn chế của AI (AI limitation / code sinh ra bị lỗi gì), Quá trình sinh viên kiểm chứng & chỉnh sửa, Link commit GitHub.

---

## 2. PROMPT DÀNH CHO NGÔ VÕ TUẤN AN (MSSV: 24TX810001 — Nhóm Trưởng)
* **Nhánh làm việc:** `feature/an-week5-firebase-auth-hardening`
* **Phạm vi file:**
  * `backend/src/HotelSaas.Infrastructure/Services/FirebaseAuthService.cs`
  * `backend/src/HotelSaas.Application/Auth/`
  * `frontend/src/app/core/services/auth.service.ts`
  * `frontend/src/app/features/auth/`
  * `deploy/`, `docker-compose.staging.yml`, `Caddyfile`

---

### Prompt A01 — Tích hợp Xác thực SĐT qua SMS OTP bằng Firebase Phone Auth
```text
Bạn là Senior Full-Stack Security Engineer đóng vai trò lập trình viên chính của dự án Hotel SaaS Platform v2 (.NET 10 + Angular 22 Standalone Signals + PostgreSQL 17).
Dự án tuân thủ nghiêm ngặt Clean Architecture, DDD và chuẩn AGENTS.md.

MỤC TIÊU:
Triển khai chức năng xác thực số điện thoại bằng OTP SMS sử dụng Firebase Phone Authentication (Google Identity Platform) kết hợp reCAPTCHA Invisible/Enterprise nhằm ngăn chặn Spam/SMS Toll Fraud và tối ưu chi phí (tận dụng hạn mức miễn phí 10.000 SMS/tháng của Firebase).

YÊU CẦU KỸ THUẬT:
1. Frontend (Angular 22 Signals):
   - Cài đặt/Tích hợp Firebase JS SDK (modular firebase/auth) vào AuthService.
   - Tạo hàm sendPhoneOtp(phoneNumber: string, appVerifier: ApplicationVerifier) và verifyPhoneOtp(confirmationResult, otpCode: string).
   - Luồng UI: Khách nhập SĐT (chuẩn hóa +84), giải reCAPTCHA ngầm, nhận mã OTP 6 số, nhập OTP xác nhận.
   - Khi xác nhận thành công, Firebase cấp idToken. Frontend gửi idToken này về WebApi backend qua endpoint POST /api/v1/auth/verify-phone-firebase.
2. Backend (.NET 10 WebApi & Clean Architecture):
   - Trong HotelSaas.Infrastructure: Dùng FirebaseAdmin SDK (nạp qua Environment Variable hoặc Service Account JSON an toàn, không commit secret).
   - Kiểm tra tính hợp lệ của idToken bằng FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(idToken).
   - Lấy claim phone_number từ token, đối soát với tài khoản User trong cơ sở dữ liệu (IApplicationDbContext).
   - Cập nhật cờ IsPhoneVerified = true và PhoneNumber = verifiedPhone.
   - Trả về ApiResponse<AuthResponseDto> chuẩn của hệ thống.
3. Ràng buộc an toàn:
   - Áp dụng Rate Limiting chống spam gửi OTP liên tục (tối đa 3 lần/phút/IP).
   - Đảm bảo Zero-Secrets Policy: Không commit file credentials json vào Git.

HÃY SINH MÃ NGUỒN HOÀN CHỈNH, CHUẨN TYPESCRIPT/C#, ĐÃ XỬ LÝ LỖI VÀ KÈM THEO UNIT TEST.
```

---

### Prompt A02 — Chính sách Kích hoạt Tài khoản Kép (Dual-Verification) & Google OAuth
```text
Bạn là Software Architect của dự án Hotel SaaS Platform v2 (.NET 10 + Angular 22).

MỤC TIÊU:
Hoàn thiện cơ chế kích hoạt tài khoản kép (Dual-Verification Policy) phân tầng giữa Khách hàng vãng lai (B2C Guest) và Nhân sự nội bộ khách sạn (Hotel Staff), đồng thời hỗ trợ liên kết đăng nhập một chạm bằng Google Social Login.

YÊU CẦU NGHIỆP VỤ & KỸ THUẬT:
1. Quy tắc kích hoạt tài khoản kép:
   - Đối với Khách vãng lai (Role Guest): Áp dụng Soft-Gating. Khách sau khi đăng ký có thể đặt phòng và giữ chỗ ngay. Nếu đăng nhập bằng Google OAuth, hệ thống tự động đánh dấu IsEmailVerified = true mà không cần xác nhận email thêm.
   - Đối với Nhân viên/Quản lý khách sạn (Role Staff, Manager, TenantAdmin): Áp dụng Hard-Gating. Bắt buộc kích hoạt thành công Email (hoặc SĐT quản trị) mới được cấp JWT Token đăng nhập vào PMS Dashboard.
2. Google OAuth Linking:
   - Backend tiếp nhận Google ID Token từ Frontend (POST /api/v1/auth/google-login).
   - Dùng GoogleJsonWebSignature.ValidateAsync(token) để xác minh token chuẩn Google.
   - Nếu email đã tồn tại: Liên kết GoogleId vào user hiện tại, kích hoạt IsEmailVerified = true.
   - Nếu email chưa tồn tại: Tạo mới user với Role Guest, tự động kích hoạt.
3. Bảo mật:
   - Khắc phục lỗ hổng rò rỉ token qua link: Token kích hoạt email là JWT HMAC-SHA256 stateless có thời hạn 30 phút, claim purpose: email_verification.

HÃY VIẾT COMMAND HANDLER (MediatR), DTO, VÀ SERVICE INTEGRATION ĐẢM BẢO CQRS VÀ 0 BUILD WARNING.
```

---

### Prompt A03 — Đóng gói Docker Caddy Staging & Hardening trên VPS
```text
Bạn là Senior DevOps & Site Reliability Engineer (SRE).

MỤC TIÊU:
Rà soát và tối ưu hóa quy trình triển khai Docker Compose + Caddy Reverse Proxy trên máy chủ Staging VPS tại domain https://luxustay.duckdns.org/ cho Hotel SaaS Platform v2.

YÊU CẦU:
1. Đảm bảo file docker-compose.staging.yml và Caddyfile chuẩn hóa:
   - Caddy tự động quản lý SSL/TLS Let's Encrypt cho luxustay.duckdns.org.
   - Reverse proxy routing:
     * /api/* và /hub/* -> backend container (port 5000) với WebSocket support cho SignalR (websocket directive).
     * /* -> frontend container (Angular Nginx / static dist) hỗ trợ SPA routing (try_files {path} /index.html).
2. Tối ưu Header bảo mật:
   - HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: SAMEORIGIN, Content-Security-Policy phù hợp với PrimeNG và Firebase.
3. Không làm lộ mật khẩu cơ sở dữ liệu hoặc thông tin nhạy cảm trong Git.

HÃY CUNG CẤP CẤU HÌNH CADDYFILE, DOCKER COMPOSE VÀ SCRIPT BASH TỰ ĐỘNG HEALTH-CHECK SAU DEPLOY.
```

---

## 3. PROMPT DÀNH CHO NGUYỄN KHÔI NGUYÊN (MSSV: 24TX810011)
* **Nhánh làm việc:** `feature/nguyen-week5-invoice-reporting-pref`
* **Phạm vi file:**
  * `backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs`
  * `backend/src/HotelSaas.Application/Reports/`
  * `backend/src/HotelSaas.Domain/Entities/Booking.cs`
  * `frontend/src/app/features/reports/`
  * `frontend/src/app/features/public-booking/`

---

### Prompt N01 — Nhúng Mã QR Động Tra Cứu Vào Hóa Đơn PDF Xuất Ra
```text
Bạn là Senior .NET Developer chuyên về xuất tài liệu và tối ưu hiệu năng trong hệ thống Hotel SaaS Platform v2 (.NET 10 + QuestPDF / SkiaSharp).

MỤC TIÊU:
Bổ sung mã QR Code tra cứu động nhúng trực tiếp vào Hóa đơn thanh toán / Phiếu thu PDF khi khách hàng hoặc nhân viên bấm xuất hóa đơn, tuân thủ nguyên tắc không gọi dịch vụ bên thứ ba (Local Offline SVG Generation).

YÊU CẦU:
1. Thư viện sinh mã QR:
   - Sử dụng thư viện C# chạy hoàn toàn nội bộ (QRCoder hoặc Net.Codecrete.QrCodeGenerator), KHÔNG sử dụng các API bên ngoài như Google Charts API vì lý do bảo mật và độ trễ mạng.
2. Nội dung mã QR:
   - Mã hóa đường dẫn tra cứu trạng thái đơn đặt phòng bảo mật:
     https://luxustay.duckdns.org/booking/lookup?token={BookingAccessToken}
3. Bố cục trên Hóa đơn PDF (QuestPDF):
   - Đặt mã QR ở góc phải bên dưới phần chi tiết thanh toán, kích thước chuẩn 80x80px rõ nét.
   - Bên dưới có dòng chữ chú thích: "Quét mã để tra cứu hóa đơn & trạng thái phòng điện tử".
4. Viết Unit Test kiểm thử:
   - Đảm bảo hàm ExportInvoicePdfAsync trả về mảng byte[] hợp lệ (> 1000 bytes) và không gây rò rỉ bộ nhớ (Memory Leak) khi xuất hàng loạt.

HÃY XUẤT CODE C# CHO SERVICE, CẬP NHẬT GIAO DIỆN HÓA ĐƠN VÀ VIẾT TEST XUNIT TƯƠNG ỨNG.
```

---

### Prompt N02 — Bổ sung Trường PaymentMethodPreference Vào Cơ Sở Dữ Liệu
```text
Bạn là Backend Specialist phụ trách Domain & Entity Framework Core trong dự án Hotel SaaS Platform v2 (.NET 10 + EF Core 10 + PostgreSQL 17).

MỤC TIÊU:
Lưu vết sự lựa chọn phương thức thanh toán của khách hàng (Cash / VietQR / VNPay / BankTransfer) ngay từ bước đặt phòng B2C vào cơ sở dữ liệu để phục vụ đối soát thu ngân và thống kê phương thức ưa chuộng.

YÊU CẦU:
1. Domain Entity (HotelSaas.Domain):
   - Thêm thuộc tính PaymentMethodPreference (enum hoặc string mã hóa: Cash, VietQR, Vnpay, BankTransfer) vào Entity Booking.cs.
   - Giá trị mặc định là Vnpay hoặc Cash.
2. EF Core Migration:
   - Viết hoặc sinh Migration EF Core an toàn trên PostgreSQL: AddPaymentMethodPreferenceToBooking.
   - Đảm bảo không làm mất mát hoặc gián đoạn dữ liệu hiện có trong bảng bookings.
3. Application Layer:
   - Cập nhật Command CreatePublicHoldCommand và DTO liên quan để tiếp nhận giá trị từ payload frontend.
   - Cập nhật Handler để lưu đúng giá trị vào cơ sở dữ liệu.
4. Tuân thủ Clean Architecture:
   - Không phá vỡ các Unit Test hiện có của BookingFsmTests.

HÃY CUNG CẤP CODE MÃ NGUỒN C#, MIGRATION SCRIPT VÀ UNIT TEST CẬP NHẬT.
```

---

### Prompt N03 — Tối Ưu Hiệu Năng Báo Cáo Quản Trị & Bộ Lọc Nâng Cao
```text
Bạn là Full-Stack Performance Engineer (.NET 10 + Angular 22 Signals).

MỤC TIÊU:
Tối ưu hóa hiệu năng trích xuất báo cáo doanh thu và công suất phòng tại trang Quản trị Báo cáo (reports.page.ts) khi lượng bản ghi vượt trên 10.000 dòng.

YÊU CẦU:
1. Backend (.NET 10 + EF Core):
   - Tối ưu truy vấn LINQ: Sử dụng .AsNoTracking(), gom nhóm dữ liệu (Aggregation) trực tiếp tại Database thay vì tải toàn bộ bản ghi lên RAM server.
   - Thêm bộ lọc linh hoạt: Theo tuần, tháng, quý, năm và theo loại phòng.
   - Giới hạn thời gian truy vấn dưới 500ms cho 10.000 giao dịch.
2. Frontend (Angular 22 Standalone Signals):
   - Sử dụng PrimeNG Table với Virtual Scrolling ([virtualScroll]="true") hoặc phân trang Server-side để giao diện mượt mà 60 FPS, không bị giật lag khi tải bảng dữ liệu lớn.
   - Đồng bộ PrimeNG DatePicker lọc từ ngày đến ngày theo chuẩn UTC+7 date-time.util.ts.

HÃY CUNG CẤP QUERY LINQ ĐÃ TỐI ƯU, COMPONENT ANGULAR TƯƠNG ỨNG VÀ TEST CASE KIỂM THỬ TẢI.
```

---

## 4. PROMPT DÀNH CHO TRẦN TRỌNG TÂN (MSSV: 24TX810025)
* **Nhánh làm việc:** `feature/tan-week5-refund-realtime-demo`
* **Phạm vi file:**
  * `frontend/src/app/features/cashier/`
  * `frontend/src/app/features/reservations/`
  * `frontend/src/app/shared/components/notification-bell/`
  * `backend/src/HotelSaas.Infrastructure/Hubs/NotificationHub.cs`
  * `backend/src/HotelSaas.Application/Payments/`

---

### Prompt T01 — Giao diện Quản lý và Phê duyệt Hoàn tiền D23 tại Quầy Thu ngân
```text
Bạn là Senior Frontend Developer (Angular 22 Standalone Signals + PrimeNG + Tailwind CSS) am hiểu nghiệp vụ Quản lý Khách sạn (PMS Cashier).

MỤC TIÊU:
Xây dựng màn hình "Duyệt yêu cầu hoàn tiền" (Refund Approval / D23 Policy) dành cho Kế toán và Thu ngân tại chi nhánh khách sạn.

NGHIỆP VỤ HOÀN TIỀN:
- Khách hàng đã hủy phòng hợp lệ (trước giờ Check-in theo chính sách) sẽ có trạng thái PendingRefund.
- Thu ngân/Quản lý chi nhánh truy cập màn hình Hoàn tiền để xem danh sách: Mã đặt phòng, Tên khách, SĐT, Số tiền gốc, Phí hủy (nếu có), Số tiền thực hoàn, và Thông tin tài khoản nhận tiền (Ngân hàng, Số tài khoản, Tên chủ thẻ).
- Thu ngân thực hiện hoàn tiền (qua chuyển khoản hoặc trả tiền mặt), đính kèm mã tham chiếu giao dịch (Bank Transaction Ref) và bấm "Xác nhận đã hoàn tiền".

YÊU CẦU KỸ THUẬT:
1. Angular 22 Signals & OnPush:
   - Sử dụng Signal (signal(), computed()) quản lý danh sách yêu cầu hoàn tiền.
   - Tích hợp component tái sử dụng: <app-page-header>, <app-status-badge>, <app-pagination>, <app-empty-state>.
   - Dialog xác nhận hoàn tiền sử dụng PrimeNG Dialog hoặc Tailwind Modal mượt mà, có validate bắt buộc nhập mã tham chiếu giao dịch.
2. Fail-Closed & Multi-Tenancy:
   - Không cho phép thao tác nếu người dùng không có quyền Thu ngân/Quản lý chi nhánh.
3. Đồng bộ Date & Tiền tệ:
   - Hiển thị ngày giờ theo múi giờ kinh doanh {{ item.createdAt | businessDate }} và số tiền {{ item.amount | currency:'VND' }}.

HÃY SINH COMPONENT TYPESCRIPT HOÀN CHỈNH, TEMPLATE HTML VÀ FILE SPEC TEST ĐẦY ĐỦ.
```

---

### Prompt T02 — Mở rộng Thông báo Thời Gian Thực Real-time SignalR Toàn Hệ Thống
```text
Bạn là Full-Stack Real-time Engineer (.NET 10 SignalR + Angular 22 Signals).

MỤC TIÊU:
Mở rộng trung tâm thông báo thời gian thực (NotificationHub.cs và NotificationBellComponent) để tự động đẩy sự kiện đến đúng chi nhánh (Property Group) ngay lập tức khi phát sinh các sự kiện kinh doanh quan trọng.

CÁC SỰ KIỆN CẦN PHÁT TÍN HIỆU (REAL-TIME EVENTS):
1. BookingPaymentConfirmed: Khách hàng hoàn tất thanh toán VNPay/VietQR trên mạng -> Đẩy thông báo nổi (Toast) và cập nhật số badge chuông cho Lễ tân chi nhánh đó.
2. BookingCancellationRequested: Khách gửi yêu cầu hủy phòng -> Thông báo cho Quản lý chi nhánh.
3. HoldExpired: Đơn giữ phòng hết hạn 15 phút mà không trả tiền -> Thông báo nhả phòng trống cho Lễ tân.

YÊU CẦU:
- Phân nhóm kết nối SignalR theo Tenant và Property: Groups.AddToGroupAsync(Context.ConnectionId, $"Property_{propertyId}").
- Âm thanh thông báo nhẹ nhàng (Web Audio API / local chime sound, có nút bật/tắt âm thanh trong settings).
- Frontend tự động re-connect với exponential backoff khi rớt mạng.
- Xử lý dọn dẹp subscription (OnDestroy) tránh rò rỉ kết nối bộ nhớ.

HÃY CUNG CẤP MÃ NGUỒN BACKEND HUB, INTEGRATION SERVICE Ở FRONTEND VÀ TEST SPEC.
```

---

### Prompt T03 — Xây dựng Kịch bản & Dữ liệu Trình diễn Nghiệp vụ (Live Demo Playbook)
```text
Bạn là Lead QA & Solutions Architect của dự án Hotel SaaS Platform v2.

MỤC TIÊU:
Soạn thảo Kịch bản Trình diễn Nghiệp vụ (Live Demo Playbook) xuyên suốt giữa 2 màn hình đồng thời phục vụ buổi Báo cáo Tiến độ Tuần 05 với Giảng viên hướng dẫn.

YÊU CẦU KỊCH BẢN:
1. Màn hình 1 (Khách hàng B2C trên Mobile/Browser Khách):
   - Khách duyệt danh sách khách sạn Sài Gòn Lex trên https://luxustay.duckdns.org/.
   - Chọn ngày nhận phòng (thử nghiệm DatePicker chuẩn), chọn phòng Suite.
   - Điền thông tin đặt phòng, hệ thống giữ phòng đếm ngược 15 phút an toàn.
   - Thanh toán thử nghiệm qua cổng VNPay Sandbox (hoặc VietQR giả lập).
2. Màn hình 2 (Nhân viên PMS Lễ tân/Thu ngân trên Desktop):
   - Ngay khoảnh khắc khách thanh toán thành công, chuông thông báo PMS reo và nhảy badge số 1.
   - Sơ đồ phòng (rooms.page.ts) tự động đổi màu phòng từ Trống sang Đã Đặt/Có Khách.
   - Lễ tân mở hồ sơ đặt phòng, xuất Hóa đơn PDF có mã QR tra cứu.
   - Khách dùng điện thoại quét mã QR trên hóa đơn để kiểm tra trạng thái vé điện tử.
3. Chuẩn bị Checklist dữ liệu mẫu (Seed Data) chuẩn bị sẵn: Tài khoản test, mã thẻ test VNPay, phòng mẫu sạch sẽ.

HÃY TRÌNH BÀY DƯỚI DẠNG BẢNG TỪNG BƯỚC (STEP-BY-STEP PLAYBOOK), THỜI LƯỢNG DỰ KIẾN (5 PHÚT) VÀ CÁC ĐIỂM CHÚ Ý ĐỂ TRÁNH SỰ CỐ DEMO TRỰC TIẾP.
```

---

## 5. Mẫu Khai Báo Sử Dụng AI Cho Báo Cáo Tuần 5 (AI Usage Log Template)

Khi thực hiện xong mỗi task, sinh viên ghi lại theo mẫu sau vào file báo cáo cá nhân:

```markdown
### Bảng Khai Báo Sử Dụng AI — Tuần 05 (Sinh viên: [Tên thành viên] - [MSSV])

| Mã Prompt | Công cụ & Model AI | Phần việc áp dụng AI | Lỗi / Thiếu sót của AI (AI Limitation) | Quá trình phát hiện, tinh chỉnh prompt và kiểm chứng của sinh viên | Link File GitHub & Commit Minh Chứng |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **#01** | Google Antigravity / Claude 3.5 Sonnet | [Tên task] | [AI thiếu validate multi-tenant / lỗi type Angular / ...] | [Sinh viên viết test case phát hiện, prompt chỉnh sửa và chạy build pass] | [Link File] (Commit `abcdef1`) |
```

---
*Tài liệu này được biên soạn bởi Ban Điều phối Kỹ thuật Hotel SaaS Platform v2 để đảm bảo tính đồng bộ, tuân thủ nguyên tắc kiến trúc và phục vụ báo cáo tiến độ và nghiệm thu công việc.*
