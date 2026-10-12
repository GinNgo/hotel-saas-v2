# TỔNG HỢP ĐẶC TẢ NGHIỆP VỤ & TÀI LIỆU KẾ THỪA TỪ DỰ ÁN CŨ
### DỰ ÁN THAM CHIẾU: HỆ THỐNG QUẢN LÝ KHÁCH SẠN (HOTEL MANAGEMENT SYSTEM)
- **Kho lưu trữ cũ (Legacy Repo):** [https://github.com/GinNgo/He-thong-quan-ly-khach-san](https://github.com/GinNgo/He-thong-quan-ly-khach-san)
- **Commit SHA tham chiếu:** `7e7ed12c0f4149527d46c78aa764b4c2ec88bab9`
- **Kho lưu trữ mới (Target Repo):** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2) (`develop`)
- **Mục đích:** Rà soát toàn bộ tài liệu, quy trình nghiệp vụ, lược đồ dữ liệu và chức năng của dự án cũ để kế thừa sang dự án mới, nâng cấp từ kiến trúc đơn lẻ sang nền tảng SaaS đa chi nhánh (.NET 10 + Angular 22 + PostgreSQL 17).

---

## 1. TỔNG QUAN KIẾN TRÚC DỰ ÁN CŨ VÀ ĐỊNH HƯỚNG NÂNG CẤP

| Tiêu Chí So Sánh | Dự Án Cũ (`He-thong-quan-ly-khach-san`) | Dự Án Mới (`hotel-saas-v2`) | Giá Trị Kế Thừa & Nâng Cấp |
|---|---|---|---|
| **Mô hình kiến trúc** | Monolith nguyên khối (Spring Boot + Vue/Angular) | Clean Architecture 4 tầng (.NET 10 + CQRS MediatR) | Tách biệt rành mạch Domain, Application, Infrastructure và WebApi. |
| **Cơ chế tổ chức** | Quản lý khách sạn đơn lẻ (`hotelId` truyền thủ công) | SaaS Đa doanh nghiệp (`Tenant`) & Đa chi nhánh (`Property`) | Tự động hóa cách ly dữ liệu chi nhánh qua `TenantPropertyContextMiddleware`. |
| **Phân quyền** | Ma trận quyền tĩnh: FunctionCode $\times$ ActionCode | Role-Based Access Control (RBAC) động fail-closed | Bảo vệ chặt chẽ cả 2 chiều đọc (Read) và ghi (Write) theo từng chi nhánh. |
| **Định giá phòng** | Giá cố định theo ngày (`basePrice` $\times$ số ngày) | Động cơ định giá linh hoạt: Theo giờ & Theo đêm | Tự động tính phụ thu check-in sớm, check-out muộn và phụ thu thêm người. |
| **Quy trình đặt phòng** | Đặt phòng trước theo loại phòng, gán phòng vật lý sau | Khóa phòng vật lý tức thì (Anti-overlap Concurrency) | Loại bỏ 100% nguy cơ đặt trùng phòng (Overbooking) dưới tải cao. |
| **Quy trình buồng phòng** | Check-out đổi thành Dirty; đổi trạng thái không khóa | State Machine: Dirty $\to$ Cleaning $\to$ Clean có concurrency lock | Ngăn chặn nhân viên dọn phòng ghi đè trạng thái của nhau qua `expectedOldStatus` (409 Conflict). |
| **Đặt phòng online** | Tìm kiếm phòng cơ bản + cổng VNPay sandbox | Cổng OTA hiện đại: Giữ chỗ 15 phút (Hold) + Tích hợp AI | Chia sẻ kho phòng thời gian thực, có trợ lý AI tiếng Việt hỗ trợ tìm phòng. |

---

## 2. MA TRẬN 7 LUỒNG NGHIỆP VỤ CỐT LÕI KẾ THỪA TỪ DỰ ÁN CŨ

### 2.1. Luồng 1: Xác Thực & Phân Quyền Người Dùng (Auth & RBAC)
- **Nghiệp vụ từ bản cũ (`AuthController`, `RoleController`):**
  - Quản lý 4 nhóm vai trò chính: Quản trị viên hệ thống (Admin), Quản lý chi nhánh (Manager), Nhân viên lễ tân (Receptionist), Nhân viên buồng phòng (Housekeeping).
  - Phân quyền theo ma trận hành động: Xem (Read - Action 1), Tạo mới (Create - Action 2), Cập nhật (Update - Action 3), Xóa (Delete - Action 4).
- **Kế thừa & nâng cấp sang bản mới:**
  - Chuyển đổi sang `RequirePermissionAttribute` và `RequireAnyPermissionAttribute` trong .NET 10.
  - Mỗi nhân viên đăng nhập được cấp Access Token JWT (thời hạn ngắn) và Refresh Token lưu trữ an toàn trong DB.
  - Bổ sung cơ chế **Chuyển đổi chi nhánh làm việc (`POST /api/auth/switch-context`)**: Quản lý có thể chuyển đổi giữa Cơ sở Quận 1 và Cơ sở Phú Nhuận mà không cần đăng nhập lại.

---

### 2.2. Luồng 2: Quản Lý Cơ Sở Khách Sạn & Chính Sách Vận Hành (Properties & Policies)
- **Nghiệp vụ từ bản cũ (`HotelController`, `LocationController`):**
  - Quản lý thông tin hồ sơ khách sạn: Tên khách sạn, mã cơ sở, địa chỉ, số điện thoại liên hệ, email lễ tân, xếp hạng sao (1–5 sao).
- **Kế thừa & nâng cấp sang bản mới:**
  - Bổ sung thực thể `PropertySurchargePolicy`: Cấu hình chính sách vận hành linh hoạt cho từng chi nhánh:
    - Giờ tiêu chuẩn Check-in (mặc định: 14:00) và Check-out (mặc định: 12:00 hôm sau).
    - Thời gian đệm dọn phòng (`BufferMinutes` $\ge$ 30 phút): Sau khi khách trả phòng, hệ thống tự động khóa 30 phút để buồng phòng dọn dẹp trước khi khách tiếp theo được nhận phòng.
    - Đơn giá phụ thu nhận phòng sớm theo từng khung giờ (`EarlyCheckInFeePerHour`).
    - Đơn giá phụ thu trả phòng trễ theo từng khung giờ (`LateCheckOutFeePerHour`).

---

### 2.3. Luồng 3: Danh Mục Hạng Phòng & Bảng Giá (Room Types & Dynamic Pricing)
- **Nghiệp vụ từ bản cũ (`RoomController`, `RoomTypeController`):**
  - Kế thừa 5 hạng phòng chuẩn thực tế của khách sạn:
    1. **Single Room (Phòng đơn):** 1 Giường đơn, sức chứa 1 người lớn, diện tích ~18m².
    2. **Double Room (Phòng đôi tiêu chuẩn):** 1 Giường đôi lớn, sức chứa 2 người lớn, diện tích ~25m².
    3. **Twin Room (Phòng 2 giường đơn):** 2 Giường đơn tách biệt, sức chứa 2 người lớn, diện tích ~28m².
    4. **Superior / Family Room (Phòng gia đình):** 1 Giường đôi + 1 Giường đơn, sức chứa 3–4 người, diện tích ~35m².
    5. **Executive Suite (Phòng Suite cao cấp):** Không gian phòng khách + phòng ngủ riêng biệt, bồn tắm nằm, ban công ngắm cảnh, diện tích ~50m².
- **Kế thừa & nâng cấp sang bản mới:**
  - Nâng cấp cơ chế định giá: Không dùng 1 giá cố định đơn giản nữa mà hỗ trợ **Định giá đa hình thức**:
    - **Giá theo đêm (Overnight Rate):** Áp dụng từ 14:00 hôm nay đến 12:00 trưa hôm sau.
    - **Giá theo giờ (Hourly Rate):** Áp dụng cho khách thuê nghỉ ngắn: tính giá trọn gói cho $X$ giờ đầu tiên (ví dụ: 2 giờ đầu = 200.000đ), các giờ tiếp theo tính phụ thu làm tròn lên 60 phút.
    - Lưu trữ lịch sử thay đổi bảng giá (`RoomTypeRateAudit`) để phục vụ kiểm toán tài chính.

---

### 2.4. Luồng 4: Đặt Phòng & Kiểm Soát Tồn Phòng (Reservations & Availability)
- **Nghiệp vụ từ bản cũ (`ReservationController`):**
  - Ghi nhận thông tin khách đặt phòng: Họ tên, Số điện thoại, CCCD/Passport, Ngày giờ nhận phòng, Ngày giờ trả phòng, Số lượng khách.
  - Tính tổng giá trị đơn phòng bao gồm tiền phòng và tiền cọc yêu cầu.
- **Kế thừa & nâng cấp sang bản mới:**
  - Bản cũ cho phép đặt phòng chung rồi gán số phòng sau $\to$ Dễ dẫn đến tình trạng hết phòng giờ chót.
  - Bản mới: **Gán phòng cụ thể ngay khi tạo đơn đặt phòng tại quầy**.
  - Kiểm tra tồn phòng thời gian thực qua thuật toán giao thoa khoảng thời gian `[StartAt, EndAt)`: Một phòng chỉ được phép đặt nếu không có bất kỳ đơn đặt phòng nào khác trùng giờ cộng thêm thời gian đệm dọn phòng 30 phút.

---

### 2.5. Luồng 5: Vòng Đời Lưu Trú & Máy Trạng Thái Buồng Phòng (Stay Lifecycle & Housekeeping)
- **Nghiệp vụ từ bản cũ (`ReservationController`, `RoomStatus`):**
  - Quy trình vận hành thực tế tại khách sạn:
    1. Khách đến: Lễ tân bấm **Check-in** $\to$ Đơn chuyển sang `CheckedIn`, phòng tự động chuyển sang màu đỏ `Occupied` (Đang có khách).
    2. Khách đi: Lễ tân bấm **Check-out** $\to$ Đơn chuyển sang `CheckedOut`, phòng tự động chuyển sang màu cam `Dirty` (Bẩn, cần dọn).
    3. Nhân viên dọn phòng: Nhìn thấy phòng `Dirty` $\to$ Bấm "Bắt đầu dọn" $\to$ Phòng chuyển sang màu vàng `Cleaning`.
    4. Dọn xong: Bấm "Hoàn tất" $\to$ Phòng chuyển sang màu xanh lá `Clean` (Sạch sẽ, sẵn sàng đón khách tiếp theo).
- **Kế thừa & nâng cấp sang bản mới:**
  - Bổ sung cơ chế **Concurrency Safety** cho Buồng phòng: Khi gọi `PATCH /api/rooms/{id}/status`, client phải gửi kèm `expectedOldStatus`. Nếu có 2 nhân viên cùng thao tác, server phát hiện xung đột và trả về mã `409 ERR_STALE_STATE` để tránh sai lệch dữ liệu ca trực.

---

### 2.6. Luồng 6: Thu Ngân, Quản Lý Hóa Đơn Folio & Báo Cáo Ca Trực (Cashier & Payments)
- **Nghiệp vụ từ bản cũ (`PaymentController`, `FolioController`):**
  - Ghi nhận phiếu thu tiền mặt, chuyển khoản ngân hàng.
  - Theo dõi công nợ: Khách đã cọc bao nhiêu, còn thiếu bao nhiêu tiền khi trả phòng.
- **Kế thừa & nâng cấp sang bản mới:**
  - Chuẩn hóa cấu trúc hóa đơn `FolioDto`:
    - `totalAmount`: Tổng tiền phòng + phụ phí nhận sớm/trả trễ.
    - `paidAmount`: Tổng tiền khách đã thanh toán.
    - `remainingBalance`: Số dư còn nợ (khi bằng 0 thì `isFullyPaid = true`).
  - Xây dựng báo cáo **Tổng kết ca thu ngân (`PaymentSummaryDto`)**:
    - Thống kê chi tiết: Tiền mặt thực thu, Chuyển khoản thực thu, Thẻ tín dụng thực thu.
    - Tính toán theo đúng ngày địa phương Việt Nam (UTC+7) dựa trên mốc thời gian hoàn tất thanh toán `PaidAtUtc`.

---

### 2.7. Luồng 7: Cổng Đặt Phòng Trực Tuyến Dành Cho Khách (Guest OTA Discovery)
- **Nghiệp vụ từ bản cũ (`PublicDiscoveryController`, `PropertySearchController`):**
  - Khách vãng lai xem danh sách khách sạn theo thành phố (TP.HCM, Đà Nẵng, Hà Nội).
  - Khách chọn ngày nhận/trả phòng và xem các loại phòng còn trống.
- **Kế thừa & nâng cấp sang bản mới:**
  - Thiết kế giao diện đặt phòng hiện đại dạng thẻ nổi (Floating Search Card) giống các nền tảng OTA lớn (Booking.com, Agoda).
  - Cơ chế **Giữ phòng 15 phút (Room Hold)**: Khách chọn phòng sẽ được hệ thống tạm giữ trong 15 phút và cấp một mã bí mật `lookupToken`. Sau 15 phút nếu khách không chuyển khoản cọc, hệ thống tự động nhả phòng lại cho khách khác.
  - **Tích hợp Trợ lý AI (Phase 6):** Cho phép khách tìm phòng bằng tiếng Việt (ví dụ: *"Tìm phòng đôi giá dưới 1 triệu ở Quận 1 tối nay"*), AI tự phân tích và gợi ý phòng thực tế trong hệ thống.

---

## 3. PHÂN CÔNG ÁP DỤNG KIẾN THỨC CŨ CHO 3 THÀNH VIÊN TRONG NHÓM

### 👤 1. Bạn Ngô Võ Tuấn Anh (Nhóm trưởng / Backend & Kiến trúc)
- **Áp dụng:**
  - Chuyển đổi mô hình dữ liệu quan hệ từ PostgreSQL cũ sang Entity Framework Core 10.
  - Kế thừa các câu lệnh SQL migration từ `V7` và `V8` của bản cũ để hiểu rõ cấu trúc dữ liệu loại phòng và tiện ích.
  - Hiện thực hóa máy trạng thái buồng phòng, thuật toán chống overbooking và động cơ tính giá giờ/đêm.

### 👤 2. Bạn Nguyên (Frontend — Module Phòng & Hạng phòng)
- **Áp dụng:**
  - Kế thừa danh mục 5 loại phòng chuẩn từ bản cũ (Single, Double, Twin, Family, Suite) đưa vào giao diện `room-types.page.ts`.
  - Thiết kế bảng danh mục phòng vật lý `rooms.page.ts` với đầy đủ các thuộc tính: Số phòng, Tầng, Loại phòng, Trạng thái.
  - Xây dựng Sơ đồ phòng dạng lưới (Room Matrix) kế thừa trực quan màu sắc từ bản cũ: Xanh (Clean), Đỏ (Occupied), Vàng (Cleaning), Cam (Dirty).

### 👤 3. Bạn Tân (Frontend — Buồng phòng & Đặt phòng)
- **Áp dụng:**
  - Kế thừa toàn bộ quy trình State Machine buồng phòng từ bản cũ vào giao diện `housekeeping.page.ts`.
  - Tích hợp 4 nút hành động nhanh: Bắt đầu dọn, Hoàn tất dọn phòng, Báo hỏng/bảo trì.
  - Kế thừa giao diện danh sách đặt phòng và luồng Check-in / Check-out từ `ReservationController` cũ đưa vào `reservations.page.ts`.

---

## 4. KẾT LUẬN & GIÁ TRỊ CỦA VIỆC KẾ THỪA
Việc rà soát và kế thừa có chọn lọc từ dự án cũ mang lại 3 lợi thế vượt trội cho nhóm:
1. **Tiết kiệm thời gian phân tích nghiệp vụ:** Nhóm không cần phải tự nghĩ ra quy trình vận hành khách sạn từ đầu mà đã có sẵn một khung nghiệp vụ hoàn chỉnh, thực tế và đã được kiểm nghiệm.
2. **Nâng cấp công nghệ hiện đại:** Đưa toàn bộ quy trình cũ lên nền tảng công nghệ mới nhất hiện nay (.NET 10, Angular 22, SaaS đa chi nhánh, Trợ lý AI Gemini), tạo điểm nhấn nổi bật cho đề tài tốt nghiệp.
3. **Minh chứng học thuật vững chắc:** Cung cấp tài liệu đối chiếu (Parity Matrix) khoa học, rõ ràng để báo cáo với GVHD ThS. Phùng Hữu Xuân và Hội đồng chấm điểm đồ án.
