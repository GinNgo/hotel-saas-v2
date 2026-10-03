# 📝 User Stories & Acceptance Criteria

> **Tài liệu:** SRS-03 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 Mức 5 (100% user story có Acceptance Criteria)
> **Format:** As a [role], I want [goal], so that [benefit]
> **AC format:** Given [context] / When [action] / Then [expected result]

---

## Epic 1: Authentication & Account Management

### US-1.1 Đăng ký tài khoản Guest

> **As a** Guest, **I want to** đăng ký tài khoản bằng email,
> **so that** tôi có thể đặt phòng và theo dõi booking.

**Acceptance Criteria:**
- **Given** trang đăng ký, **When** nhập email/password hợp lệ, **Then** tài khoản được tạo + email xác nhận được gửi
- **Given** email đã tồn tại, **When** đăng ký lại, **Then** hiển thị lỗi "Email đã được sử dụng"
- **Given** password yếu (<8 ký tự, không có số/ký tự đặc biệt), **When** submit, **Then** hiển thị yêu cầu password
- **Priority:** P0 | **Estimate:** 3 SP | **Phase:** 1

### US-1.2 Đăng nhập

> **As a** User (Guest/Staff/Owner), **I want to** đăng nhập bằng email + password,
> **so that** tôi truy cập được hệ thống với quyền phù hợp.

**Acceptance Criteria:**
- **Given** credentials đúng, **When** login, **Then** nhận JWT access token (30 min) + refresh token (7 ngày)
- **Given** credentials sai, **When** login, **Then** hiển thị "Email hoặc mật khẩu không đúng" (không tiết lộ cụ thể)
- **Given** tài khoản bị khóa, **When** login, **Then** hiển thị "Tài khoản đã bị khóa"
- **Given** token hết hạn, **When** gọi API, **Then** tự động refresh token hoặc redirect login
- **Priority:** P0 | **Estimate:** 5 SP | **Phase:** 1

### US-1.3 Đăng ký Property (Owner)

> **As an** Owner, **I want to** đăng ký cơ sở lưu trú của tôi lên hệ thống,
> **so that** tôi bắt đầu quản lý và nhận đặt phòng.

**Acceptance Criteria:**
- **Given** đã đăng nhập, **When** điền form property (tên, địa chỉ, loại hình, sao), **Then** property được tạo với trạng thái Active
- **Given** property tạo xong, **When** xem dashboard, **Then** thấy property trên danh sách với các tab quản lý
- **Given** property mới, **Then** Owner tự động có role Owner + full permissions
- **Priority:** P0 | **Estimate:** 5 SP | **Phase:** 1

### US-1.4 Quên mật khẩu

> **As a** User, **I want to** reset mật khẩu qua email,
> **so that** tôi khôi phục truy cập khi quên password.

**Acceptance Criteria:**
- **Given** email tồn tại, **When** request reset, **Then** gửi link reset (hết hạn sau 1h)
- **Given** link reset hợp lệ, **When** đặt password mới, **Then** password được cập nhật + các session cũ bị invalidate
- **Priority:** P1 | **Estimate:** 3 SP | **Phase:** 1

---

## Epic 2: RBAC — Phân quyền

### US-2.1 Tạo vai trò tùy chỉnh

> **As an** Owner, **I want to** tạo vai trò (role) tùy chỉnh cho nhân viên,
> **so that** tôi kiểm soát chính xác ai được làm gì.

**Acceptance Criteria:**
- **Given** trang Role Management, **When** tạo role mới (tên + chọn permissions), **Then** role được lưu và có thể gán cho staff
- **Given** Permission matrix (14 functions × 7 actions), **When** tick từng checkbox, **Then** bitmask được tính đúng
- **Given** role hệ thống (Owner), **When** cố xóa, **Then** hiển thị "Không thể xóa role hệ thống"
- **Priority:** P0 | **Estimate:** 5 SP | **Phase:** 1

### US-2.2 Mời nhân viên

> **As an** Owner, **I want to** mời nhân viên vào hệ thống và gán role,
> **so that** họ truy cập được các chức năng được phân quyền.

**Acceptance Criteria:**
- **Given** email nhân viên, **When** mời, **Then** gửi email invitation với link tham gia
- **Given** nhân viên accept invitation, **When** đăng nhập, **Then** thấy dashboard của property với quyền tương ứng
- **Given** lễ tân (chỉ có RESERVATION:Read,Create + CHECKIN:Execute), **When** cố truy cập Revenue Report, **Then** bị denied (403)
- **Priority:** P0 | **Estimate:** 5 SP | **Phase:** 1

### US-2.3 Permission Guard (Frontend)

> **As a** Developer, **I want** route guards kiểm tra permission,
> **so that** UI chỉ hiển thị menu/buttons mà user có quyền.

**Acceptance Criteria:**
- **Given** user có RESERVATION:Read, **When** vào /reservations, **Then** cho phép
- **Given** user KHÔNG có RESERVATION:Read, **When** vào /reservations, **Then** redirect trang 403
- **Given** user không có PAYMENT:Create, **Then** nút "Tạo thanh toán" bị ẩn
- **Priority:** P0 | **Estimate:** 3 SP | **Phase:** 1

---

## Epic 3: Room Management

### US-3.1 CRUD Room Types

> **As an** Owner/Manager, **I want to** quản lý loại phòng (Standard, Deluxe, Suite...),
> **so that** tôi cấu hình giá và đặc điểm từng loại.

**Acceptance Criteria:**
- **Given** trang Room Types, **When** tạo mới (tên, giá cơ bản, max occupancy, ảnh), **Then** room type được lưu
- **Given** room type đã có rooms, **When** cố xóa, **Then** hiển thị cảnh báo "Có X phòng thuộc loại này"
- **Given** sửa giá room type, **Then** giá mới áp dụng cho booking mới (không ảnh hưởng booking cũ)
- **Priority:** P0 | **Estimate:** 3 SP | **Phase:** 2

### US-3.2 CRUD Rooms

> **As an** Owner/Manager, **I want to** quản lý danh sách phòng,
> **so that** hệ thống biết inventory thực tế.

**Acceptance Criteria:**
- **Given** room type đã tồn tại, **When** tạo phòng (số phòng, tầng, loại phòng), **Then** phòng được tạo với status Clean
- **Given** số phòng trùng trong cùng property, **When** tạo, **Then** lỗi "Số phòng đã tồn tại"
- **Given** phòng đang Occupied, **When** cố disable, **Then** lỗi "Không thể disable phòng đang có khách"
- **Priority:** P0 | **Estimate:** 3 SP | **Phase:** 2

### US-3.3 Room Status Board

> **As a** Receptionist, **I want to** xem trạng thái tất cả phòng real-time,
> **so that** tôi biết phòng nào trống/bận/cần dọn.

**Acceptance Criteria:**
- **Given** dashboard, **When** xem Room Board, **Then** thấy grid phòng với màu theo status (Clean=xanh, Dirty=đỏ, Occupied=cam, OutOfService=xám)
- **Given** housekeeping đổi status phòng, **When** xem board, **Then** status cập nhật realtime (SignalR ≤ 2s)
- **Given** click vào phòng, **Then** hiện side-panel chi tiết (guest, booking, timeline)
- **Priority:** P0 | **Estimate:** 5 SP | **Phase:** 2

---

## Epic 4: Reservation & Booking

### US-4.1 Tạo đặt phòng (Staff)

> **As a** Receptionist, **I want to** tạo đặt phòng cho khách walk-in hoặc gọi điện,
> **so that** phòng được giữ cho khách.

**Acceptance Criteria:**
- **Given** chọn phòng + ngày check-in/out + thông tin khách, **When** tạo booking, **Then** reservation được tạo với status PendingPayment
- **Given** phòng đã có booking chồng ngày, **When** tạo, **Then** lỗi "Phòng không khả dụng trong khoảng thời gian này"
- **Given** check-out ≤ check-in, **When** submit, **Then** validation error
- **Given** booking thành công, **Then** hệ thống generate ConfirmationCode (6 ký tự uppercase)
- **Priority:** P0 | **Estimate:** 5 SP | **Phase:** 2

### US-4.2 Đặt phòng Online (Guest)

> **As a** Guest, **I want to** tìm kiếm và đặt phòng online,
> **so that** tôi đặt phòng bất kỳ lúc nào không cần gọi.

**Acceptance Criteria:**
- **Given** trang Public, **When** search (location, dates, guests), **Then** hiển thị danh sách phòng khả dụng
- **Given** chọn phòng, **When** điền info + chọn thanh toán, **Then** redirect VNPay (nếu chọn VNPay) hoặc tạo booking PendingPayment
- **Given** thanh toán VNPay thành công, **Then** booking chuyển Confirmed + gửi email confirmation
- **Given** không thanh toán trong 30 phút, **Then** booking tự hủy (BookingHoldCleanup worker)
- **Priority:** P1 | **Estimate:** 8 SP | **Phase:** 2

### US-4.3 Check-in

> **As a** Receptionist, **I want to** check-in khách nhanh chóng,
> **so that** khách không phải chờ lâu.

**Acceptance Criteria:**
- **Given** booking Confirmed, **When** click Check-in, **Then** reservation → CheckedIn, room → Occupied
- **Given** booking PendingPayment, **When** cố check-in, **Then** yêu cầu xác nhận thanh toán trước
- **Given** check-in xong, **Then** SignalR broadcast room status change
- **Given** khách walk-in (không có booking), **Then** tạo booking + check-in cùng lúc
- **Priority:** P0 | **Estimate:** 5 SP | **Phase:** 2

### US-4.4 Check-out

> **As a** Receptionist, **I want to** check-out khách và tạo hóa đơn,
> **so that** kết thúc lưu trú và thanh toán.

**Acceptance Criteria:**
- **Given** reservation CheckedIn, **When** click Check-out, **Then** hiển thị folio summary (room charge + extras)
- **Given** folio còn balance > 0, **When** check-out, **Then** yêu cầu thanh toán trước
- **Given** folio cleared (balance = 0), **When** confirm check-out, **Then** reservation → CheckedOut, room → Dirty
- **Given** check-out xong, **Then** housekeeping task tự động tạo cho phòng đó
- **Priority:** P0 | **Estimate:** 5 SP | **Phase:** 2

---

## Epic 5: Housekeeping

### US-5.1 Task assignment

> **As a** Manager, **I want to** gán task dọn phòng cho nhân viên,
> **so that** mỗi người biết phòng nào cần dọn.

**Acceptance Criteria:**
- **Given** phòng status Dirty, **When** tạo task (assign housekeeper), **Then** task Pending + notification cho housekeeper
- **Given** check-out tự động tạo task, **Then** task unassigned, manager có thể gán sau
- **Priority:** P0 | **Estimate:** 3 SP | **Phase:** 3

### US-5.2 Update task status

> **As a** Housekeeper, **I want to** cập nhật trạng thái dọn phòng,
> **so that** lễ tân biết phòng nào sẵn sàng.

**Acceptance Criteria:**
- **Given** task Pending/InProgress, **When** cập nhật Completed, **Then** room → Clean, SignalR broadcast
- **Given** task Completed, **Then** timestamp completed lưu lại
- **Priority:** P0 | **Estimate:** 3 SP | **Phase:** 3

---

## Epic 6: Payment & Invoice

### US-6.1 Thanh toán VNPay

> **As a** Guest/Receptionist, **I want to** thanh toán qua VNPay,
> **so that** giao dịch an toàn và tự động.

**Acceptance Criteria:**
- **Given** booking cần thanh toán, **When** chọn VNPay, **Then** redirect trang VNPay sandbox
- **Given** VNPay callback success, **Then** payment → Completed, booking → Confirmed
- **Given** VNPay callback fail, **Then** payment → Failed, booking giữ PendingPayment
- **Given** idempotency key, **When** callback gửi 2 lần, **Then** chỉ xử lý 1 lần
- **Priority:** P0 | **Estimate:** 5 SP | **Phase:** 3

### US-6.2 Invoice PDF

> **As an** Owner/Manager, **I want to** xuất hóa đơn PDF,
> **so that** gửi cho khách hoặc lưu sổ sách.

**Acceptance Criteria:**
- **Given** reservation CheckedOut, **When** click "Xuất hóa đơn", **Then** generate PDF + download
- **Given** invoice, **Then** bao gồm: thông tin property, thông tin khách, chi tiết phòng + extras, thuế, tổng tiền
- **Priority:** P1 | **Estimate:** 3 SP | **Phase:** 3

---

## Epic 7: Reports & Analytics

### US-7.1 Revenue Dashboard

> **As an** Owner/Manager, **I want to** xem dashboard doanh thu,
> **so that** tôi nắm tình hình kinh doanh.

**Acceptance Criteria:**
- **Given** dashboard, **When** xem Reports, **Then** hiển thị: Revenue (today, week, month), Occupancy Rate, ADR, RevPAR
- **Given** date range filter, **When** thay đổi, **Then** charts cập nhật tương ứng
- **Given** Chart.js charts, **Then** responsive, exportable
- **Priority:** P1 | **Estimate:** 5 SP | **Phase:** 3

---

## Epic 8: AI Features

### US-8.1 AI Concierge Chatbot

> **As a** Guest, **I want to** hỏi chatbot về dịch vụ và thông tin,
> **so that** tôi được trả lời ngay mà không cần gọi lễ tân.

**Acceptance Criteria:**
- **Given** trang booking, **When** mở chatbot widget, **Then** có thể hỏi bằng tiếng Việt / English
- **Given** hỏi về dịch vụ property (parking, wifi, restaurant), **Then** AI trả lời dựa trên property info
- **Given** AI không biết, **Then** suggest liên hệ lễ tân + log conversation
- **Given** mỗi AI call, **Then** log vào AI Usage table (timestamp, prompt, response, token count)
- **Priority:** P1 | **Estimate:** 5 SP | **Phase:** 3

### US-8.2 AI Dynamic Pricing Suggestion

> **As an** Owner/Manager, **I want** AI gợi ý giá phòng tối ưu,
> **so that** tôi tối đa doanh thu theo demand.

**Acceptance Criteria:**
- **Given** trang Pricing, **When** click "AI Suggest", **Then** hiển thị giá đề xuất + lý do (occupancy, season, competitor)
- **Given** đề xuất, **When** accept, **Then** giá được cập nhật
- **Given** đề xuất, **When** reject, **Then** giữ nguyên giá cũ, log rejection reason
- **Priority:** P2 | **Estimate:** 5 SP | **Phase:** 4

---

## Tổng hợp User Stories

| Epic | Số stories | Tổng SP | Phase |
|------|-----------|---------|-------|
| Epic 1: Auth | 4 | 16 SP | Phase 1 |
| Epic 2: RBAC | 3 | 13 SP | Phase 1 |
| Epic 3: Room | 3 | 11 SP | Phase 2 |
| Epic 4: Reservation | 4 | 23 SP | Phase 2 |
| Epic 5: Housekeeping | 2 | 6 SP | Phase 3 |
| Epic 6: Payment | 2 | 8 SP | Phase 3 |
| Epic 7: Reports | 1 | 5 SP | Phase 3 |
| Epic 8: AI | 2 | 10 SP | Phase 3-4 |
| **TOTAL** | **21 stories** | **92 SP** | |

> ✅ 100% stories có Acceptance Criteria (TC2.1 Mức 5)

---

*Tài liệu này là phần của bộ SRS, phục vụ tiêu chí TC2.1 Mức 5.*
*Danh sách này chưa đầy đủ — sẽ bổ sung thêm stories khi implement từng phase.*
