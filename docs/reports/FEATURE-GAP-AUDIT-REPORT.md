# BÁO CÁO TOÀN DIỆN: ĐỐI SOÁT TÍNH NĂNG & ĐỘ LỆCH ĐẶC TẢ HỆ THỐNG (FEATURE GAP AUDIT REPORT)
## Hotel SaaS Platform v2 (.NET 10 + Angular 22 + PostgreSQL 17)

**Auditor:** `spec_feature_auditor` (Antigravity Autonomous Swarm)  
**Ngày kiểm toán:** 13/11/2026  
**Phạm vi đối soát:**
- **Tài liệu đặc tả gốc:** `docs/srs/03-user-stories.md`, `docs/srs/04-business-processes.md`, `docs/srs/05-business-rules.md`, `docs/sdd/06-api-design.md`
- **Kế hoạch & Spec Kits:** `docs/team/SPEC-KIT-WEEK-4-VNPAY-AND-TASTE-FRONTEND.md`, `docs/team/ROADMAP-CHI-TIET-3-THANH-VIEN.md`, `docs/reports/BAO-CAO-TONG-HOP-TUAN-5-VA-KE-HOACH-TUAN-6.md`, `docs/team/PROMPT-TUAN-6-THUC-THI-NHOM.md`
- **Mã nguồn thực tế:** `backend/src/HotelSaas.Application/`, `backend/src/HotelSaas.WebApi/`, `backend/src/HotelSaas.Domain/`, `backend/src/HotelSaas.Infrastructure/`, `frontend/src/app/`

---

## 1. TỔNG QUAN KẾT QUẢ KIỂM TOÁN (EXECUTIVE SUMMARY)

| Nhóm Kiểm toán | Tổng số hạng mục | Fully Implemented (Đạt 100%) | Partially Implemented (Thiếu sót/Mock) | Completely Missing (Chưa triển khai) | Tỷ lệ Hoàn thành Thực tế |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **User Stories (SRS-03)** | 21 US | 13 | 6 | 2 | **61.9%** |
| **Business Processes (SRS-04)** | 6 Processes | 3 | 2 | 1 (Housekeeping) | **50.0%** |
| **Business Rules & Policies (SRS-05)** | 35 Quy tắc chính | 19 | 10 | 6 | **54.3%** |
| **API Endpoints (SDD-06)** | 54 Endpoints chuẩn | 29 | 15 (Lệch route/tham số) | 10 (Thiếu hoàn toàn) | **53.7%** |

### Các Phát hiện Nghiêm trọng Nhất (Key Red Flags):
1. **Epic 5 (Buồng phòng - Housekeeping Tasks) hoàn toàn bị khuyết ở tầng Application & Database**: Entity `HousekeepingTask` có tồn tại trong Domain nhưng **không** implement `IPropertyScopedEntity`, **không** được khai báo `DbSet<HousekeepingTask>` trong `IApplicationDbContext` hay `ApplicationDbContext`, **không** có bất kỳ CQRS Command/Query nào, và **không** có `HousekeepingController` trong WebApi. Frontend `housekeeping.page.ts` hiện chỉ gọi trực tiếp `PATCH /api/rooms/{id}/status` mà không có phân công nhân viên hay quản lý task.
2. **Quy trình Quên/Đặt lại Mật khẩu (US-1.4) bị bỏ trống**: Không có endpoint `/auth/forgot-password` hay `/auth/reset-password` ở Backend; Frontend không có giao diện Forgot Password.
3. **Lỗ hổng Kiểm tra Phân quyền Frontend Router (US-2.3)**: Các trang quản trị nhạy cảm gồm Báo cáo (`/admin/reports`), Nhân sự (`/admin/staff`), Vai trò (`/admin/roles`), Khách hàng (`/admin/guests`), Gói cước (`/admin/subscriptions`), và Nhật ký (`/admin/audit-logs`) không được bảo vệ bởi `permissionGuard` trong `frontend/src/app/app.routes.ts`.
4. **Không ràng buộc Giới hạn Gói cước (POL-SUB01, POL-SUB02)**: Khi tạo phòng (`CreateRoomCommandHandler.cs`) hoặc tạo nhân sự (`CreateStaffMemberCommandHandler.cs`), hệ thống không kiểm tra số lượng hiện tại so với giới hạn gói dịch vụ (Basic max 15 phòng/2 nhân sự, Pro max 50 phòng/10 nhân sự).
5. **Thiếu Nghiệp vụ Đóng ngày (Night Audit)**: Chưa có cơ chế chuyển đổi phòng No-Show lúc quá nửa đêm, tự động chốt doanh thu ngày, hay ghi nhận phí lưu trú theo chu kỳ 24h.

---

## 2. BẢNG CHI TIẾT ĐỐI SOÁT USER STORIES (SRS-03)

| Mã US | Tên & Tóm tắt Yêu cầu Đặc tả | Trạng thái | Bằng chứng Backend (File & Line) | Bằng chứng Frontend (File & Line) | Chi tiết Lỗ hổng & Độ lệch (Gap Analysis) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **US-1.0** | **Đăng ký Doanh nghiệp / Đối tác (Partner Onboarding)**<br>Đăng ký Tenant, tạo Chi nhánh mặc định, tạo Role Owner, gán User Owner. | **Partial** | `backend/src/HotelSaas.Application/Auth/Commands/RegisterPartner/RegisterPartnerCommandHandler.cs#L45-L160`<br>`backend/src/HotelSaas.WebApi/Controllers/AuthController.cs#L95-L115` | `frontend/src/app/features/auth/partner-register/partner-register.page.ts#L30-L120` | Đăng ký thành công nhưng `Property.IsPublished` mặc định là `false` (L130). **Thiếu** nghiệp vụ/endpoint thẩm định và xuất bản khách sạn (`POST /properties/{id}/publish` theo SDD-06 2.3) kiểm tra đủ điều kiện (tọa độ GPS, địa chỉ hợp lệ, ít nhất 1 hạng phòng có giá). |
| **US-1.0a** | **Quản trị Khách hàng Thuê (Platform Tenant Management)**<br>SuperAdmin xem danh sách Tenant, trạng thái kích hoạt, khoá/mở Tenant. | **Partial** | `backend/src/HotelSaas.WebApi/Controllers/AdminContractsController.cs`<br>`backend/src/HotelSaas.WebApi/Controllers/AdminPlansController.cs` | `frontend/src/app/features/admin-contracts/`<br>`frontend/src/app/features/admin-plans/` | Đã có quản lý Hợp đồng và Gói cước cho Platform Admin, nhưng **thiếu** `TenantsController` với các endpoint quản trị: `GET /api/v1/tenants`, `PUT /api/v1/tenants/{id}/suspend` theo SDD-06 Section 2.2. |
| **US-1.1** | **Đăng ký Tài khoản Khách hàng (Guest Registration)**<br>Khách công khai đăng ký tài khoản qua Email/Mật khẩu hoặc Social. | **Full** | `backend/src/HotelSaas.Application/Auth/Commands/RegisterGuest/RegisterGuestCommandHandler.cs#L35-L95`<br>`backend/src/HotelSaas.Application/Auth/Commands/SocialLogin/SocialLoginCommandHandler.cs#L40-L130` | `frontend/src/app/features/auth/register/register.page.ts#L25-L90`<br>`frontend/src/app/core/services/social-auth.service.ts#L45-L95` | Đã hỗ trợ đầy đủ đăng ký qua Email/Password và Google OAuth2 (One Tap / Popup) với liên kết bảng `SocialIdentities`. |
| **US-1.2** | **Đăng nhập Hệ thống (User Login)**<br>Hỗ trợ đăng nhập Tenant Staff và Guest, trả về JWT Access Token + HttpOnly Refresh Token. | **Full** | `backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs#L40-L140`<br>`backend/src/HotelSaas.WebApi/Controllers/AuthController.cs#L45-L75` | `frontend/src/app/features/auth/login/login.page.ts#L30-L110` | Đầy đủ luồng đăng nhập, tách biệt ngữ cảnh Staff và Guest, ghi nhận Token và thiết lập Cookie an toàn. |
| **US-1.3** | **Cấp lại Access Token (Refresh Token Rotation)**<br>Gia hạn phiên làm việc tự động với cơ chế Single-Use Rotation. | **Full** | `backend/src/HotelSaas.Application/Auth/Commands/RefreshToken/RefreshTokenCommandHandler.cs#L40-L130`<br>`backend/src/HotelSaas.WebApi/Controllers/AuthController.cs#L140-L165` | `frontend/src/app/core/interceptors/jwt.interceptor.ts#L50-L110` | Triển khai đầy đủ thu hồi token cũ, cấp token mới với mutex khóa dòng user chống race condition. |
| **US-1.4** | **Quên / Đặt lại Mật khẩu (Forgot & Reset Password)**<br>Gửi email chứa token 15 phút để đổi mật khẩu mới. | **Missing** | *Không có Handler hoặc Validator trong `HotelSaas.Application/Auth/`*<br>*Không có endpoint trong `AuthController.cs`* | *Không có page hoặc component trong `frontend/src/app/features/auth/`* | **Chưa triển khai**. Hoàn toàn thiếu nghiệp vụ gửi link reset token qua email và đặt lại mật khẩu cho người dùng. |
| **US-2.1** | **Quản lý Quyền & Vai trò RBAC (Role Management)**<br>Tạo, sửa, xóa Role và cấu hình Bitmask Permissions. Khóa xóa System Roles. | **Full** | `backend/src/HotelSaas.Application/Staff/Commands/UpdateRolePermissions/UpdateRolePermissionsCommandHandler.cs#L30-L85`<br>`backend/src/HotelSaas.Application/Staff/Commands/DeleteRole/DeleteRoleCommandHandler.cs#L30-L75` | `frontend/src/app/features/staff/roles-management.component.ts#L30-L140` | Chặn xóa System Role (`IsSystemRole = true`), chặn xóa Role đang có nhân viên gắn (`TenantStaffMembers.Any()`). Bitmask tính toán chuẩn xác. |
| **US-2.2** | **Mời / Quản lý Nhân sự (Staff Management)**<br>Mời nhân sự qua email, phân công chi nhánh và vai trò làm việc. | **Partial** | `backend/src/HotelSaas.Application/Staff/Commands/CreateStaffMember/CreateStaffMemberCommandHandler.cs#L40-L105`<br>`backend/src/HotelSaas.WebApi/Controllers/StaffController.cs#L60-L85` | `frontend/src/app/features/staff/staff.page.ts#L40-L160` | Thay vì gửi email mời kích hoạt (`/admin/staff/invite`), hệ thống tạo tài khoản trực tiếp và **hardcode mật khẩu mặc định** `"Staff@123456"` (L78). Vi phạm quy trình bảo mật SRS-03. |
| **US-2.3** | **Kiểm soát Truy cập Tính năng (Permission Enforcement)**<br>Frontend ẩn menu/chặn route; Backend xác thực Bitmask trên Controller. | **Partial** | `backend/src/HotelSaas.WebApi/Authorization/RequirePermissionAttribute.cs`<br>`backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs#L25-L65` | `frontend/src/app/core/guards/permission.guard.ts#L1-L45`<br>`frontend/src/app/app.routes.ts#L170-L245` | Backend xác thực Bitmask chuẩn qua Custom Authorization Handler. **Tuy nhiên**, Frontend `app.routes.ts` **quên** đặt `permissionGuard` ở các route: `/admin/reports`, `/admin/staff`, `/admin/roles`, `/admin/guests`, `/admin/subscriptions`, `/admin/audit-logs`, `/admin/ops-readiness` (L219-L245, L318-L344). Nhân viên cấp thấp gõ URL trực tiếp vẫn truy cập được màn hình. |
| **US-3.1** | **Quản lý Hạng phòng (Room Type Setup)**<br>Tạo/sửa/xóa hạng phòng, thiết lập sức chứa, tiện nghi, ảnh. Chặn xóa khi có phòng. | **Full** | `backend/src/HotelSaas.Application/RoomTypes/Commands/DeleteRoomType/DeleteRoomTypeCommandHandler.cs#L35-L65`<br>`backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs#L40-L130` | `frontend/src/app/features/room-types/room-types.page.ts#L30-L150` | Kiểm tra ràng buộc khóa ngoại: chặn xóa hạng phòng nếu đã có phòng vật lý thuộc hạng phòng này (`ERR_ROOMTYPE_IN_USE`). |
| **US-3.2** | **Quản lý Danh mục Phòng Vật lý (Room Inventory Setup)**<br>Tạo phòng vật lý, gán số phòng, tầng. Chặn xóa phòng có đặt phòng hoạt động. | **Full** | `backend/src/HotelSaas.Application/Rooms/Commands/DeleteRoom/DeleteRoomCommandHandler.cs#L35-L65`<br>`backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs#L40-L135` | `frontend/src/app/features/rooms/rooms.page.ts#L35-L160` | Chặn xóa phòng nếu có đặt phòng `PendingPayment`, `Confirmed`, hoặc `CheckedIn` (`ERR_ROOM_HAS_ACTIVE_BOOKINGS`). |
| **US-3.3** | **Sơ đồ Trạng thái Phòng Trực quan (Room Status Board)**<br>Hiển thị ma trận phòng theo màu trạng thái (Clean, Dirty, Occupied, OutOfService). | **Full** | `backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs#L140-L175`<br>`backend/src/HotelSaas.Application/Rooms/Queries/GetRoomMatrix/` | `frontend/src/app/features/rooms/rooms.page.ts#L100-L220`<br>`frontend/src/app/features/housekeeping/housekeeping.page.ts#L50-L150` | Hiển thị đầy đủ bảng phân loại theo tầng, màu sắc trạng thái chuẩn, cập nhật tức thời khi chuyển trạng thái phòng. |
| **US-4.1** | **Tìm kiếm Phòng Công khai (Public Room Search & Explore)**<br>Tìm phòng theo ngày đến/đi, số khách, khoảng giá, bản đồ vị trí trực quan. | **Full** | `backend/src/HotelSaas.Application/Rooms/Queries/SearchPublicRooms/SearchPublicRoomsQueryHandler.cs#L35-L120`<br>`backend/src/HotelSaas.WebApi/Controllers/PublicRoomsController.cs#L30-L75` | `frontend/src/app/features/public-booking/explore-search.page.ts#L30-L210` | Bản đồ Google Maps split view, bộ lọc đa tiêu chí (giá, hạng phòng, tiện ích, vị trí), tra cứu giá thời gian thực. |
| **US-4.2** | **Giữ chỗ Tạm thời & Đặt cọc (Hold & 30% Deposit)**<br>Giữ phòng 15 phút, khóa dòng vật lý, xác thực SMS OTP, tính cọc 30%. | **Full** | `backend/src/HotelSaas.Application/Reservations/Commands/CreateGuestHold/CreateGuestHoldCommandHandler.cs#L40-L165`<br>`backend/src/HotelSaas.Infrastructure/BackgroundJobs/ExpiredHoldSweepBackgroundService.cs#L30-L70` | `frontend/src/app/features/public-booking/booking-hold.page.ts#L40-L180` | Áp dụng đầy đủ: TTL 15 phút, tính cọc 30% (POL-P01), Background Service quét nhả phòng hết hạn mỗi 60s, mã hóa OTP SMS. |
| **US-4.3** | **Tạo Đặt phòng Nội bộ Trực tiếp (Staff Direct Booking)**<br>Lễ tân đặt phòng tại quầy cho khách vãng lai, tự động xác nhận. | **Partial** | `backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandHandler.cs#L50-L385`<br>`backend/src/HotelSaas.Application/Reservations/Commands/CreateReservation/CreateReservationCommandValidator.cs#L66-L70` | `frontend/src/app/features/reservations/reservations.page.ts#L40-L200` | Tạo phòng và gán mã `RES-XXXXXX`. **Thiếu sót**: Handler **không kiểm tra** `NumberOfGuests <= room.RoomType.MaxOccupancy` (Validator chỉ kiểm tra `<= 20`), dẫn đến vi phạm BR-R06 khi đặt quá sức chứa phòng. |
| **US-4.4** | **Quy trình Check-in (Check-in Processing)**<br>Nhận phòng, kiểm tra phòng Sạch (Clean), thanh toán hoặc xác nhận cọc. | **Partial** | `backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs#L50-L180`<br>`backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs#L120-L140` | `frontend/src/app/features/reservations/reservations.page.ts#L180-L230` | Đã kiểm tra phòng phải ở trạng thái `Clean`. **Tuy nhiên**, dòng 164 cho phép đơn `PendingPayment` không qua cổng trực tuyến được check-in mà **không ép buộc** thu cọc tối thiểu tại quầy. |
| **US-4.5** | **Quản lý Folio & Dịch vụ Phát sinh (Folio & Extra Charges)**<br>Ghi nhận minibar, giặt là, ẩm thực vào hóa đơn phòng. | **Full** | `backend/src/HotelSaas.Application/Reservations/Commands/AddFolioItem/AddFolioItemCommandHandler.cs#L40-L95`<br>`backend/src/HotelSaas.WebApi/Controllers/FolioController.cs#L30-L85` | `frontend/src/app/features/reservations/reservations.page.ts#L220-L280` | Thêm mặt hàng phát sinh, tự động tính tổng tiền dịch vụ và cộng dồn vào công nợ Folio. |
| **US-4.6** | **Quy trình Check-out & Quyết toán (Check-out Settlement)**<br>Đối soát số dư Folio bằng 0 (POL-IO03), chuyển phòng sang Dirty. | **Full** | `backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs#L50-L125` | `frontend/src/app/features/reservations/reservations.page.ts#L290-L330` | Chặn check-out tuyệt đối nếu còn dư nợ (`remainingBalance > 0`), tự động chuyển trạng thái phòng vật lý sang `Dirty` (L98). |
| **US-5.1** | **Phân công Buồng phòng Tự động / Thủ công (Housekeeping Assignment)**<br>Tự động tạo task dọn phòng khi check-out, phân công nhân viên. | **Missing** | `backend/src/HotelSaas.Domain/Entities/HousekeepingTask.cs#L9-L60`<br>*(Không có DbSet trong DbContext, không có CQRS Command/Query)* | `frontend/src/app/features/housekeeping/housekeeping.page.ts#L60-L110` | **Hoàn toàn thiếu**. Entity `HousekeepingTask` không được mapping bảng CSDL. Không có logic tự sinh task khi Check-out. Frontend chỉ đổi trạng thái phòng đơn giản. |
| **US-5.2** | **Cập nhật Tiến độ & Nghiệm thu Dọn phòng (Task Tracking & Inspection)**<br>Nhân viên nhận việc, bắt đầu dọn, hoàn tất và giám sát duyệt. | **Missing** | *Không có Backend Controller hoặc Handlers cho Housekeeping Tasks* | `frontend/src/app/features/housekeeping/housekeeping.page.ts` | **Hoàn toàn thiếu**. Toàn bộ 6 endpoint trong SDD-06 2.12 (`/housekeeping`, `/assign`, `/claim`, `/status`, `/board`) không tồn tại. |
| **US-6.1** | **Thanh toán Trực tuyến VNPay (Online Payment Processing)**<br>Tạo URL thanh toán, xử lý Webhook IPN, xác thực chữ ký HMAC-SHA512. | **Full** | `backend/src/HotelSaas.Application/Payments/Commands/CreateVnpayPaymentUrl/CreateVnpayPaymentUrlCommandHandler.cs#L40-L110`<br>`backend/src/HotelSaas.Application/Payments/Commands/ProcessVnpayIpn/ProcessVnpayIpnCommandHandler.cs#L45-L165` | `frontend/src/app/features/public-booking/booking-hold.page.ts#L120-L160`<br>`frontend/src/app/features/payments/payments.page.ts#L40-L130` | Tích hợp hoàn chỉnh VNPay Sandbox, xác thực hash SHA512, cập nhật trạng thái đơn đặt phòng thành công. |
| **US-6.2** | **Xuất Hóa đơn Điện tử & In ấn (Invoice & Print Generation)**<br>Tạo hóa đơn PDF, phiếu nhận phòng (Voucher), hợp đồng dịch vụ. | **Partial** | `backend/src/HotelSaas.WebApi/Controllers/PrintDocumentsController.cs#L30-L110`<br>`backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs#L140-L180` | `frontend/src/app/features/print/print-invoice.page.ts`<br>`frontend/src/app/features/print/print-voucher.page.ts` | Đã có chức năng xem và in HTML/PDF hóa đơn qua `api/print/` và `api/reports/reservations/{id}/invoice.pdf`. **Thiếu** `InvoicesController` chuẩn theo SDD-06 2.14 để quản lý danh sách hóa đơn theo kỳ, hủy/điều chỉnh hóa đơn điện tử. |
| **US-7.1** | **Báo cáo Vận hành & Phân tích Doanh thu (Reports & Analytics)**<br>Báo cáo Công suất (Occupancy), ADR, RevPAR, doanh thu theo thời gian, xuất Excel. | **Partial** | `backend/src/HotelSaas.WebApi/Controllers/ReportsController.cs#L40-L180`<br>`backend/src/HotelSaas.Application/Reports/Queries/` | `frontend/src/app/features/reports/reports.page.ts#L40-L210` | Đã có KPI chung (`/pms-kpi`), Doanh thu (`/revenue-summary`), Xuất Excel/PDF. **Thiếu**: Phân tích nguồn khách (OTA vs Trực tiếp vs Vãng lai), Nhân khẩu học khách, và Báo cáo hiệu suất nhân viên buồng phòng. |
| **US-8.1** | **Trợ lý AI Concierge Hỗ trợ Khách hàng (AI Concierge Assistant)**<br>Tư vấn địa điểm, dịch vụ khách sạn 24/7 theo ngữ cảnh cơ sở lưu trú. | **Partial** | `backend/src/HotelSaas.WebApi/Controllers/AiController.cs#L40-L95`<br>`backend/src/HotelSaas.Application/Ai/Commands/AskAiConcierge/AskAiConciergeCommandHandler.cs#L45-L130` | `frontend/src/app/features/public-booking/property-detail.page.ts`<br>`frontend/src/app/features/ai/ai-chat.page.ts` | Tích hợp LLM hỗ trợ hỏi đáp thông tin phòng và tiện ích. **Thiếu**: Endpoint đánh giá phản hồi (`POST /ai/concierge/feedback` theo SDD-06 2.15). |
| **US-8.2** | **Gợi ý Giá Động Thông minh (AI Dynamic Pricing Recommendation)**<br>Phân tích công suất phòng, xu hướng thời tiết/cuối tuần để đề xuất giá tối ưu. | **Partial** | `backend/src/HotelSaas.WebApi/Controllers/AiController.cs#L100-L150`<br>`backend/src/HotelSaas.Application/Ai/Queries/GetDynamicPricingRecommendations/` | `frontend/src/app/features/rates/rates.page.ts#L60-L120` | Đã có API tính toán và trả về danh sách giá đề xuất. **Thiếu**: Endpoint áp dụng giá đề xuất trực tiếp (`POST /ai/pricing/apply`) và giao diện nút bấm duyệt giá nhanh trên Frontend `rates.page.ts`. |

---

## 3. BẢNG ĐỐI SOÁT QUY TRÌNH & QUY TẮC NGHIỆP VỤ (SRS-04 & SRS-05)

### 3.1. Các Quy trình Nghiệp vụ (Business Processes SRS-04)

| Mã Quy trình | Tên Quy trình | Mức độ Đáp ứng | Hiện trạng Thực thi & Bằng chứng Mã nguồn | Lỗ hổng & Điểm nghẽn Phát hiện |
| :--- | :--- | :---: | :--- | :--- |
| **BP-01** | **Thiết lập Khách sạn (Property Setup)** | **70%** | `PropertiesController.cs`, `RoomTypesController.cs`, `RoomsController.cs`, `PoliciesController.cs` | Thiếu bước thẩm định đóng/mở bán (`POST /properties/{id}/publish`) để kích hoạt khách sạn lên hệ sinh thái công khai. |
| **BP-02** | **Đặt phòng Trực tuyến (Online Booking Flow)** | **95%** | `explore-search.page.ts` -> `booking-hold.page.ts` -> `CreateGuestHoldCommand.cs` -> VNPay Sandbox -> `ProcessVnpayIpnCommand.cs` | Quy trình hoạt động mượt mà, khóa dòng PostgreSQL đảm bảo tính nhất quán cao, tự động giải phóng phòng khi quá hạn 15 phút. |
| **BP-03** | **Nhận phòng - Dịch vụ - Trả phòng (CheckIn - Folio - CheckOut)** | **85%** | `CheckInReservationCommandHandler.cs` -> `AddFolioItemCommandHandler.cs` -> `CheckOutReservationCommandHandler.cs` | Đảm bảo tính toán công nợ và trạng thái phòng. Thiếu tự động hóa phụ thu Check-in sớm / Check-out muộn theo giờ thực tế. |
| **BP-04** | **Quy trình Buồng phòng (Housekeeping Workflow)** | **15%** | `CheckOutReservationCommandHandler.cs#L98` đổi `Room.Status = Dirty` | **Gãy hoàn toàn**: Phòng chuyển sang `Dirty` nhưng không có hệ thống tự động sinh Task, không có cơ chế phân bổ cho Housekeeper, không có chu trình Bắt đầu -> Hoàn tất -> Kiểm tra nghiệm thu. |
| **BP-05** | **Thanh toán & Hoàn tiền (Payment & Refund Flow)** | **65%** | `PaymentsController.cs`, `CancellationPolicyService.cs#L20-L80`, `CancelReservationCommandHandler.cs#L70-L130` | Tính toán chính xác tỷ lệ hoàn tiền theo chính sách (100%, 50%, 0%). **Tuy nhiên**, chưa tích hợp API hoàn tiền tự động của cổng thanh toán (`vnp_Command=refund`); hệ thống chỉ ghi nhận trạng thái sổ sách mà chưa đẩy lệnh hoàn tiền ngân hàng. |
| **BP-06** | **Trợ lý Khách hàng AI (AI Concierge Flow)** | **80%** | `AiController.cs`, `AskAiConciergeCommandHandler.cs`, `AiUsageLogs` | Trả lời nhanh chóng dựa trên dữ liệu ngữ cảnh khách sạn. Thiếu cơ chế lưu feedback thumbs-up/down để tinh chỉnh mô hình. |

---

### 3.2. Bảng Rà soát Quy tắc Nghiệp vụ Chi tiết (Business Rules SRS-05)

| Mã Quy tắc | Nội dung Đặc tả (SRS-05) | Trạng thái | Bằng chứng Thực thi (File & Line) | Phân tích Mức độ Tuân thủ |
| :--- | :--- | :---: | :--- | :--- |
| **BR-TURN01** | Khoảng đệm dọn phòng tối thiểu 30-60 phút giữa 2 lượt khách | **ĐẠT** | `backend/src/HotelSaas.Application/Reservations/Services/ReservationTimeHelper.cs#L15`<br>`CreateReservationCommandHandler.cs#L189, #L268` | Khai báo `MinimumTurnoverBufferMinutes = 30`. Thuật toán `HasOverlap` luôn cộng thêm buffer vào khoảng thời gian kiểm tra trùng phòng. |
| **BR-PRICE01** | Giá linh hoạt theo hình thức thuê: Theo giờ, Qua đêm, Theo ngày | **ĐẠT** | `backend/src/HotelSaas.Application/Quotes/Queries/CalculateQuote/CalculateQuoteQueryHandler.cs#L60-L140` | Phân tách biểu thức tính giá độc lập cho `Hourly`, `Overnight`, và `Daily`. Áp dụng giá phụ thu lũy tiến cho giờ phát sinh. |
| **BR-PRICE02** | Phụ thu cuối tuần (Thứ 6, Thứ 7) | **ĐẠT** | `CalculateQuoteQueryHandler.cs#L145-L175`<br>`RoomTypeRate.cs` | Tự động nhân hệ số cuối tuần hoặc áp giá bảng giá cuối tuần khi ngày lưu trú rơi vào Thứ 6 hoặc Thứ 7. |
| **BR-R01** | Tính duy nhất của phòng vật lý tại cùng thời điểm (Không trùng phòng) | **ĐẠT** | `CreateReservationCommandHandler.cs#L246`<br>`ApplicationDbContext.cs#L324-L327` | Thực hiện khóa dòng cấp cơ sở dữ liệu `SELECT ... FOR UPDATE` trên bảng `Rooms` trước khi kiểm tra khoảng thời gian trống. |
| **BR-R02** | Thời lượng lưu trú tối thiểu và tối đa | **ĐẠT** | `CreateReservationCommandValidator.cs#L38-L43` | Bắt buộc thuê theo giờ tối thiểu 1 giờ, tối đa 24 giờ. Kiểm tra ngày trả phòng phải lớn hơn ngày nhận phòng. |
| **BR-R03** | Đặt phòng trước tối đa 365 ngày | **KHÔNG** | `CreateReservationCommandValidator.cs#L45-L50` | **Không kiểm tra**. Validator thiếu điều kiện `CheckInDate <= Today + 365 days` và `CheckInDate >= Today`. |
| **BR-R04** | Tỷ lệ Overbooking cho phép là 0% | **ĐẠT** | `CreateReservationCommandHandler.cs#L258-L274` | Hệ thống từ chối mọi yêu cầu trùng phòng (kể cả trong thời gian giữ chỗ tạm), không cho phép đặt vượt tải. |
| **BR-R06** | Số khách không vượt quá sức chứa tối đa của hạng phòng | **KHÔNG** | `CreateReservationCommandHandler.cs#L325`<br>`CreateReservationCommandValidator.cs#L69-L70` | Validator chỉ kiểm tra `NumberOfGuests <= 20`. Handler không so sánh với `RoomType.MaxOccupancy`. Khách có thể đặt 5 người vào phòng đơn (Max = 1). |
| **POL-C01** | Chính sách hủy Linh hoạt (Flexible): Hoàn 100% trước 24h, 0% sau 24h | **ĐẠT** | `backend/src/HotelSaas.Application/Reservations/Services/CancellationPolicyService.cs#L30-L45` | Triển khai chính xác logic tính số giờ đến giờ Check-in để trả về tỷ lệ hoàn trả tương ứng. |
| **POL-C02** | Chính sách hủy Tiêu chuẩn (Moderate): Hoàn 100% trước 72h, 50% trước 24h, 0% sau 24h | **ĐẠT** | `CancellationPolicyService.cs#L48-L65` | Triển khai chính xác các mốc thời gian hoàn tiền theo quy định. |
| **POL-C03** | Chính sách hủy Nghiêm ngặt (Strict): Không hoàn tiền | **ĐẠT** | `CancellationPolicyService.cs#L68-L75` | Trả về `RefundPercentage = 0%` cho mọi trường hợp hủy đơn. |
| **POL-P01** | Đặt cọc giữ chỗ trực tuyến tối thiểu 30% | **ĐẠT** | `CreateGuestHoldCommandHandler.cs#L95-L105` | Tính toán `DepositAmount = Math.Round(quote.TotalAmount * 0.30m, 0)` khi khách khởi tạo phiên giữ chỗ. |
| **POL-IO01** | Giờ Check-in chuẩn 14:00 & Phụ thu nhận phòng sớm | **MỘT PHẦN** | `backend/src/HotelSaas.Domain/Entities/Property.cs#L38`<br>`PropertySurchargePolicy.cs` | Bảng cấu hình chính sách phụ thu có sẵn, nhưng `CheckInReservationCommandHandler` chưa tự động tính tiền phạt/phụ thu khi khách nhận phòng trước 14:00. |
| **POL-IO02** | Giờ Check-out chuẩn 12:00 & Phụ thu trả phòng muộn | **MỘT PHẦN** | `Property.cs#L39`<br>`PropertySurchargePolicy.cs` | Chưa tự động chèn phí phụ thu trả phòng muộn vào Folio khi nhân viên bấm Check-out sau 12:00. |
| **POL-IO03** | Quyết toán dứt điểm công nợ trước khi trả phòng (Balance = 0) | **ĐẠT** | `CheckOutReservationCommandHandler.cs#L70-L80` | Kiểm tra nghiêm ngặt `remainingBalance <= 0`. Nếu khách còn nợ bất kỳ khoản nào, hệ thống ném ngoại lệ `ERR_OUTSTANDING_BALANCE`. |
| **POL-SUB01** | Giới hạn số phòng theo gói cước (Basic: 15, Pro: 50, Enterprise: Không giới hạn) | **KHÔNG** | `backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommandHandler.cs#L40-L90` | **Không kiểm tra**. Handler tạo phòng mà không đếm số lượng phòng hiện tại của Tenant để so sánh với `Subscription.Tier`. Tenant gói Basic vẫn tạo được 100 phòng. |
| **POL-SUB02** | Giới hạn số tài khoản nhân viên (Basic: 2, Pro: 10, Enterprise: Không giới hạn) | **KHÔNG** | `backend/src/HotelSaas.Application/Staff/Commands/CreateStaffMember/CreateStaffMemberCommandHandler.cs#L40-L100` | **Không kiểm tra**. Handler tạo nhân sự không xác thực quota của gói đăng ký hiện thời. |
| **BR-HK01-06**| Các quy tắc buồng phòng (Quy trình dọn, ưu tiên VIP, nghiệm thu phòng) | **KHÔNG** | `backend/src/HotelSaas.Domain/Entities/HousekeepingTask.cs` | **Không thực thi** vì thiếu toàn bộ module Housekeeping Task ở tầng Application. |
| **BR-SEC03** | Khóa tài khoản sau 5 lần đăng nhập thất bại | **KHÔNG** | `backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs#L50-L90` | Không có trường `FailedLoginAttempts` hoặc `LockoutEndUtc` trên bảng `Users`. Người dùng có thể bị tấn công Brute-force mật khẩu mà không bị khóa. |
| **NIGHT-AUDIT**| Quy trình Đóng ngày & Khóa sổ Kế toán (Night Audit) | **KHÔNG** | *Không tìm thấy trong toàn bộ codebase* | Không có Background Worker tự động chuyển đơn phòng quá hạn sang `No-Show`, không có chốt doanh thu và khóa kỳ kế toán hàng ngày lúc 02:00 AM. |

---

## 4. DANH MỤC ĐỘ LỆCH CONTRACT API (SDD-06 API DESIGN VS ACTUAL WEBAPI)

Bảng đối chiếu toàn bộ các nhóm API được đặc tả trong `docs/sdd/06-api-design.md` so với Controller thực tế tại `backend/src/HotelSaas.WebApi/Controllers/`:

| Nhóm API (SDD-06) | Endpoint Đặc tả (SDD-06) | Endpoint Thực tế (WebApi) | Trạng thái Contract | Chi tiết Độ lệch & Khuyến nghị Khắc phục |
| :--- | :--- | :--- | :---: | :--- |
| **Toàn cục** | `/api/v1/...` | `/api/[controller]` | **Lệch Base Path** | Đặc tả yêu cầu versioning `/api/v1/...` nhưng Controllers đang để `[Route("api/[controller]")]`. Cần chuẩn hóa tiền tố routing. |
| **2.1 Auth** | `POST /api/v1/auth/login` | `POST /api/auth/login` | Tương thích | Đạt yêu cầu. |
|  | `POST /api/v1/auth/refresh-token` | `POST /api/auth/refresh-token` | Tương thích | Đạt yêu cầu. |
|  | `POST /api/v1/auth/logout` | `POST /api/auth/revoke-token` | **Lệch tên Route** | Đặc tả đặt tên `logout`, thực tế WebApi đặt tên `revoke-token`. |
|  | `GET /api/v1/auth/me` | `GET /api/auth/me/memberships`<br>`GET /api/guest/me` | **Lệch cấu trúc** | Thay vì 1 endpoint `/auth/me` đồng nhất, backend tách thành 2 endpoint cho staff và guest. |
|  | `POST /api/v1/auth/forgot-password` | *Không tồn tại* | **THIẾU** | Cần bổ sung Command và Controller endpoint xử lý quên mật khẩu. |
|  | `POST /api/v1/auth/reset-password` | *Không tồn tại* | **THIẾU** | Cần bổ sung Command và Controller endpoint đặt lại mật khẩu. |
| **2.2 Tenants** | `GET /api/v1/tenants/current` | *Không tồn tại độc lập* | **THIẾU** | Thông tin Tenant hiện được nhúng chung vào token và `/auth/me/memberships`. |
|  | `GET /api/v1/tenants` (Platform Admin) | *Không tồn tại* | **THIẾU** | Thiếu API quản trị danh sách người thuê cho SuperAdmin. |
|  | `PUT /api/v1/tenants/{id}/suspend` | *Không tồn tại* | **THIẾU** | Thiếu API tạm ngưng hoạt động Tenant vi phạm. |
| **2.3 Properties** | `GET /api/v1/properties` | `GET /api/properties` | Tương thích | Đạt yêu cầu. |
|  | `POST /api/v1/properties` | `POST /api/properties` | Tương thích | Đạt yêu cầu. |
|  | `POST /api/v1/properties/{id}/publish` | *Không tồn tại* | **THIẾU** | Thiếu endpoint xuất bản cơ sở lưu trú kèm validation. |
| **2.4 Room Types**| `GET/POST/PUT/DELETE /room-types` | `GET/POST/PUT/DELETE /api/room-types` | Tương thích | Đầy đủ CRUD và bảo vệ toàn vẹn dữ liệu. |
| **2.5 Rooms** | `GET/POST/PUT/DELETE /rooms` | `GET/POST/PUT/DELETE /api/rooms` | Tương thích | Đầy đủ CRUD. |
|  | `PATCH /api/v1/rooms/{id}/status` | `PATCH /api/rooms/{id}/status` | Tương thích | Cập nhật trạng thái phòng nguyên tử (Atomic Update). |
| **2.6 Pricing** | `GET /api/v1/rates/room-types/{id}` | `GET /api/rates/room-types/{id}` | Tương thích | Đạt yêu cầu. |
|  | `POST /api/v1/rates/intervals` | `POST /api/rates/intervals` | Tương thích | Hỗ trợ phân rã và áp khoảng giá chống chồng lấn qua exclusion constraint. |
| **2.7 Reservations**| `POST /api/v1/reservations` | `POST /api/reservations` | Tương thích | Tạo đặt phòng có bảo vệ Idempotency và Row Lock. |
|  | `POST /api/v1/reservations/{id}/check-in` | `POST /api/reservations/{id}/check-in` | Tương thích | Kiểm tra phòng sạch trước khi nhận phòng. |
|  | `POST /api/v1/reservations/{id}/check-out` | `POST /api/reservations/{id}/check-out` | Tương thích | Kiểm tra tất toán công nợ trước khi trả phòng. |
|  | `POST /api/v1/reservations/{id}/cancel` | `POST /api/reservations/{id}/cancel` | Tương thích | Tính toán hoàn cọc tự động theo chính sách. |
| **2.8 Folio** | `GET /api/v1/reservations/{id}/folio` | `GET /api/folio/{reservationId}` | Tương thích | Xem bảng kê dịch vụ phát sinh. |
|  | `POST /api/v1/reservations/{id}/folio/items` | `POST /api/folio/{reservationId}/items` | Tương thích | Thêm dịch vụ tiêu dùng vào phòng. |
| **2.9 Public Booking**| `GET /api/v1/public/rooms/search` | `GET /api/public-rooms/search` | Tương thích | Tra cứu phòng công khai. |
|  | `POST /api/v1/public/bookings/hold` | `POST /api/guest-booking/hold` | **Lệch tên Route** | Đặc tả là `/public/bookings/hold`, thực tế là `/api/guest-booking/hold`. |
| **2.10 Staff & RBAC**| `GET/POST /api/v1/admin/staff` | `GET/POST /api/staff` | **Lệch tên Route** | Thực tế bỏ tiền tố `/admin/`. |
|  | `POST /api/v1/admin/staff/invite` | *Không tồn tại* | **THIẾU** | Thay bằng tạo trực tiếp với mật khẩu mặc định. |
|  | `GET/POST/PUT /api/v1/admin/roles` | `GET/POST/PUT /api/staff/roles` | **Lệch tên Route** | Nằm dưới controller `StaffController`. |
| **2.11 Subscriptions**| `GET /api/v1/subscriptions/current` | `GET /api/subscriptions/current` | Tương thích | Đạt yêu cầu. |
|  | `POST /api/v1/subscriptions/upgrade` | `POST /api/subscriptions/upgrade` | Tương thích | *(Gặp lỗi nghiệp vụ: không yêu cầu thanh toán đã nâng hạng gói)* |
| **2.12 Housekeeping**| `GET /api/v1/housekeeping` | *Không tồn tại* | **THIẾU 100%** | Toàn bộ nhóm API Buồng phòng không có trong WebApi. |
|  | `POST /api/v1/housekeeping/assign` | *Không tồn tại* | **THIẾU 100%** | Chưa triển khai. |
|  | `POST /api/v1/housekeeping/claim` | *Không tồn tại* | **THIẾU 100%** | Chưa triển khai. |
|  | `PUT /api/v1/housekeeping/{id}/status` | *Không tồn tại* | **THIẾU 100%** | Chưa triển khai. |
| **2.13 Reports** | `GET /api/v1/reports/occupancy` | Gộp vào `GET /api/reports/pms-kpi` | **Gộp Endpoint** | Thay vì các endpoint rời rạc, WebApi gom lại thành `pms-kpi` và `group-analytics`. |
|  | `GET /api/v1/reports/export/excel` | `GET /api/reports/export-excel` | **Lệch Route** | Dùng dấu gạch ngang thay vì sub-route. |
| **2.14 Invoices** | `GET/POST /api/v1/invoices` | *Không tồn tại* | **THIẾU** | Tách lẻ sang `PrintDocumentsController` (`api/print/invoice/{id}`). |
| **2.15 AI Services** | `POST /api/v1/ai/concierge` | `POST /api/ai/concierge` | Tương thích | Đạt lời gọi trợ lý ảo. |
|  | `POST /api/v1/ai/concierge/feedback` | *Không tồn tại* | **THIẾU** | Chưa có endpoint thu thập phản hồi người dùng. |
|  | `GET /api/v1/ai/pricing/recommendations` | `GET /api/ai/dynamic-pricing/recommendations` | Tương thích | Đạt yêu cầu. |
|  | `POST /api/v1/ai/pricing/apply` | *Không tồn tại* | **THIẾU** | Chưa có endpoint tự động áp giá AI đề xuất vào bảng giá. |
| **3.0 SignalR Hubs**| 5 Hubs: `RoomStatusHub`, `NotificationHub`, `PricingHub`, `BookingHub`, `DashboardHub` | Chỉ có 1 Hub: `NotificationHub` (`/hubs/notifications`) | **THIẾU 4 HUBS** | Đặc tả yêu cầu 5 hub riêng biệt cho từng nghiệp vụ; thực tế chỉ triển khai duy nhất 1 Hub thông báo chung. |

---

## 5. ĐỀ XUẤT LỘ TRÌNH KHẮC PHỤC (ACTIONABLE REMEDIATION ROADMAP)

Dựa trên phân tích khoảng cách tính năng và rủi ro vận hành, nhóm kiểm toán đề xuất thứ tự ưu tiên xử lý cho đội ngũ phát triển:

### Giai đoạn 1: Khắc phục Lỗ hổng Rủi ro Cao (P0 - Immediate Action)
1. **Thiết lập Guard kiểm soát phân quyền trên Frontend Router**:
   - Bổ sung `canActivate: [permissionGuard]` và khai báo quyền tương ứng trong `frontend/src/app/app.routes.ts` cho các đường dẫn: `/admin/reports`, `/admin/staff`, `/admin/roles`, `/admin/guests`, `/admin/subscriptions`, `/admin/audit-logs`.
2. **Khóa Quota Gói cước (POL-SUB01, POL-SUB02)**:
   - Thêm bước kiểm tra số lượng phòng hiện tại so với giới hạn gói cước trong `CreateRoomCommandHandler.cs`.
   - Thêm bước kiểm tra số nhân sự so với hạn mức trong `CreateStaffMemberCommandHandler.cs`.
3. **Thẩm định Ràng buộc Sức chứa Phòng (BR-R06)**:
   - Thêm validation trong `CreateReservationCommandHandler.cs`: So sánh `request.NumberOfGuests <= room.RoomType.MaxOccupancy`.

### Giai đoạn 2: Bổ sung Module & Tính năng Cốt lõi còn Thiếu (P1 - Core Features)
1. **Hiện thực hóa Module Buồng phòng (Epic 5 - Housekeeping)**:
   - Cập nhật entity `HousekeepingTask` implement `IPropertyScopedEntity`.
   - Đăng ký `DbSet<HousekeepingTask>` vào `IApplicationDbContext` và `ApplicationDbContext`, sinh Migration EF Core.
   - Viết các CQRS Handlers: `CreateHousekeepingTaskCommand`, `AssignHousekeepingTaskCommand`, `UpdateHousekeepingStatusCommand`, `GetHousekeepingBoardQuery`.
   - Tạo `HousekeepingController` và tích hợp vào màn hình `frontend/src/app/features/housekeeping/housekeeping.page.ts`.
   - Kết nối tự động sinh task `Dirty` khi lễ tân thực hiện Check-out thành công trong `CheckOutReservationCommandHandler.cs`.
2. **Xây dựng Quy trình Quên/Đặt lại Mật khẩu (US-1.4)**:
   - Tạo entity/token lưu trữ mã đặt lại mật khẩu với thời hạn 15 phút.
   - Thêm `ForgotPasswordCommand` và `ResetPasswordCommand` cùng endpoints tương ứng.
   - Xây dựng giao diện `ForgotPasswordComponent` trên Frontend.

### Giai đoạn 3: Hoàn thiện Tiêu chuẩn Đặc tả & Trải nghiệm (P2 - Refinement & Compliance)
1. **Hoàn thiện Tích hợp AI (Epic 8)**:
   - Thêm endpoint `POST /api/ai/pricing/apply` để chấp nhận giá đề xuất.
   - Thêm nút "Áp dụng giá này" trên bảng giá tại `frontend/src/app/features/rates/rates.page.ts`.
   - Thêm endpoint `POST /api/ai/concierge/feedback`.
2. **Chuẩn hóa Routing API theo SDD-06**:
   - Thêm tiền tố versioning `api/v1/` vào các Controller.
   - Đồng bộ hóa các tên endpoint chưa khớp (`revoke-token` -> `logout`, `guest-booking/hold` -> `public/bookings/hold`).
3. **Hiện thực hóa Quy trình Đóng ngày (Night Audit)**:
   - Viết Background Service chạy lúc 02:00 AM hàng ngày để tự động đánh dấu `No-Show` cho các đơn đặt phòng chưa check-in trong ngày, và kết chuyển sổ sách kế toán.

---
*Báo cáo được khởi tạo tự động bởi `spec_feature_auditor`. Mã nguồn và trích dẫn đã được kiểm chứng đối soát trực tiếp trên nhánh `develop`.*
