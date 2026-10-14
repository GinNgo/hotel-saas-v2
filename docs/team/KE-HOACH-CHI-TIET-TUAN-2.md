# KẾ HOẠCH CHI TIẾT TUẦN 2 (PHASE 2 – PHASE 3)
## ĐỀ TÀI: HỆ THỐNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH (HOTEL SAAS PLATFORM V2)
---

* **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh tích hợp chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop)
* **Thời gian thực hiện:** Tuần 2 (13/10/2026 – 19/10/2026)
* **Nguồn tham chiếu cũ:** `C:\Projects\He-thong-quan-ly-khach-san` (LuxeStay)
* **Tuyên bố ranh giới tiến độ:**
  - **Tuần 1 đã hoàn tất 100%:** Khởi tạo kiến trúc Clean Architecture, Auth/RBAC JWT, Multi-tenant Interceptor, Danh mục Phòng & Hạng phòng (Nguyên) và Sơ đồ Buồng phòng FSM cơ bản (Tân).
  - **Tuần 2 tiến lên các phân hệ HOÀN TOÀN MỚI:** **Động cơ Đặt phòng tại quầy (Reservation Engine), Vòng đời lưu trú (Check-in / Check-out), Thu ngân & Hóa đơn Folio (Billing & Cashier), Sơ đồ Timeline phòng và Tích hợp Danh mục 2 cấp.**

---

## 0. PHÂN TÍCH TÁI SỬ DỤNG DỰ ÁN CŨ & KHẮC PHỤC TRIỆT ĐỂ LỖI

### 1. Kế thừa nghiệp vụ & UI hợp lý từ `He-thong-quan-ly-khach-san`:
- Dự án cũ đã có luồng nghiệp vụ lễ tân và thu ngân tương đối chuẩn thực tế:
  + Tiếp nhận đặt phòng tại quầy (Walk-in booking) và đặt trước qua điện thoại.
  + Quy trình Check-in (giao phòng) và Check-out (thanh toán công nợ).
  + Bảng kê hóa đơn thanh toán Folio (tiền phòng + phụ thu sớm/trễ - tiền cọc).
- **Khắc phục 5 lỗi nghiêm trọng của dự án cũ trên hệ thống mới `hotel-saas-v2`:**
  1. *Lỗi Overbooking (Bán trùng phòng):* Bản cũ không có cơ chế khóa phòng, 2 người cùng đặt 1 phòng trong cùng khoảng giờ bị đè dữ liệu. Bản mới dùng **Btree_gist exclusion constraint** trên PostgreSQL 17 kết hợp thuật toán kiểm tra giao thoa khoảng thời gian $[Start, End)$ cộng thêm **30 phút thời gian đệm dọn phòng** (`cleaningBufferMinutes`).
  2. *Lỗi lẫn lộn chi nhánh:* Bản cũ truyền `hotelId` thủ công khắp API. Bản mới dùng `TenantPropertyContextMiddleware` và EF Core Global Query Filter tự động cách ly 100%.
  3. *Lỗi phụ thuộc vòng (Circular Dependencies):* Bản cũ các service gọi trực tiếp lẫn nhau. Bản mới dùng MediatR CQRS (Command/Query độc lập hoàn toàn).
  4. *Lỗi lệch state giữa Lễ tân và Buồng phòng:* Bản mới khi Lễ tân bấm Check-out thì thẻ phòng lập tức chuyển sang `Dirty` tự động bắn sang màn hình Buồng phòng qua Angular Signals, không cần F5 tải lại trang.
  5. *Tích hợp Danh mục hành chính 2 cấp:* Sử dụng `docs/DMTinhThanh_2Cap.csv` (63 tỉnh thành) và `docs/DMXaPhuong_2Cap.csv` (10.051 xã phường) để lưu trữ địa chỉ khách hàng đặt phòng và cấu hình chi nhánh.

---

## 1. MA TRẬN PHÂN CÔNG NHIỆM VỤ MỚI TUẦN 2 (TIẾN ĐỘ THỰC TẾ)

| Thành viên | Vai trò | Nhánh Git cá nhân | Nhiệm vụ phân hệ MỚI Tuần 2 | Sản phẩm bàn giao (Deliverables) |
|---|---|---|---|---|
| 👤 **Ngô Võ Tuấn An**<br>*(24TX810001)* | Leader / Backend & System Architect | `develop` | - **Core Reservation Engine:** API Đặt phòng `POST /api/reservations` với thuật toán khóa phòng đồng thời chống Overbooking (Anti-overlap Concurrency).<br>- **Multi-tier Pricing Engine:** Tự động tính giá theo giờ, theo đêm, day-use, phụ thu bậc thang sớm/trễ và tiền cọc.<br>- **Stay Lifecycle API:** `POST /api/reservations/{id}/check-in` (kích hoạt phòng sang `Occupied`) & `POST /api/reservations/{id}/check-out` (kích hoạt phòng sang `Dirty`).<br>- **Tích hợp Danh mục 2 cấp:** Cung cấp API / Seeder địa giới hành chính Tỉnh/Xã.<br>- **Review PR:** Đánh giá và merge code của 2 thành viên. | - `backend/src/HotelSaas.Application/Reservations/`<br>- `backend/src/HotelSaas.Application/Quotes/`<br>- `backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs`<br>- 50+ Unit Tests mới (100% Pass). |
| 👤 **Nguyễn Khởi Nguyên**<br>*(24TX810011)* | Frontend Developer (Lễ tân & Đặt phòng) | `feature/nguyen-reservations` | - **Màn hình Đặt phòng Lễ tân (`reservations.page.ts`):** Form tạo đơn đặt phòng nhanh tại quầy (Walk-in), chọn khách hàng hoặc nhập mới (kèm chọn Tỉnh/Xã từ danh mục 2 cấp), chọn ngày nhận/trả, chọn phòng trống trực quan theo tầng.<br>- **Bảng Tính Giá Tức Thì (Live Quote Preview):** Tự động hiển thị tiền phòng tạm tính, phụ thu dự kiến và tiền cọc yêu cầu.<br>- **Sơ đồ Phòng theo Thời gian (Room Timeline / Availability Calendar):** Trục thời gian hiển thị phòng trống, phòng có khách, phòng sắp nhận. | - `frontend/src/app/features/reservations/`<br>- `reservation.service.ts`<br>- PR trên GitHub trỏ vào `develop`. |
| 👤 **Trần Trọng Tân**<br>*(24TX810025)* | Frontend Developer (Vận hành & Thu ngân) | `feature/tan-operations` | - **Quy trình Lễ tân Check-in & Check-out:** Modal Check-in (xác nhận khách đến, chụp/nhập CCCD, giao phòng) và Modal Check-out (kiểm tra tiền, hoàn tất trả phòng).<br>- **Liên thông Buồng phòng:** Khi bấm Check-out, phòng tự động chuyển sang màu cam `Dirty` trên Bảng buồng phòng của Tân.<br>- **Bảng Kê Hóa Đơn Folio & Thu Ngân (`payments.page.ts`):** Quản lý chi tiết công nợ (Tiền phòng + Phụ thu - Tiền cọc $\to$ Số dư cần thu), form thu tiền tại quầy (tiền mặt / chuyển khoản), Báo cáo ca thu ngân trong ngày. | - `frontend/src/app/features/payments/`<br>- `payment.service.ts`<br>- Modal Check-in/Check-out<br>- PR trên GitHub trỏ vào `develop`. |

---

## 2. CHI TIẾT NHIỆM VỤ TỪNG THÀNH VIÊN TRONG TUẦN 2

---

### PHẦN I: NHIỆM VỤ CỦA BẠN NGÔ VÕ TUẤN AN (LEADER / BACKEND ARCHITECT)
- **Nhánh làm việc:** `develop`
- **Mục tiêu:** Cung cấp toàn bộ API Đặt phòng, Động cơ tính giá, Máy trạng thái lưu trú và cơ chế chống Overbooking.

#### 1. Động cơ Đặt phòng (Reservation Engine):
- Hiện thực `CreateReservationCommand`:
  - Kiểm tra phòng trống theo thuật toán giao thoa khoảng thời gian $[StartAt, EndAt)$ kết hợp thời gian đệm dọn phòng 30 phút.
  - Tự động gọi `PricingCalculator` để tính tổng tiền phòng, phụ phí nhận sớm/trả trễ và số tiền cọc yêu cầu.
  - Tạo snapshot thông tin đặt phòng bất biến (`ReservationSnapshot`) lưu vào cơ sở dữ liệu.

#### 2. Vòng đời lưu trú (Stay Lifecycle):
- `CheckInReservationCommand`: Kiểm tra giờ check-in thực tế, ghi nhận `CheckedInAtUtc`, chuyển trạng thái đặt phòng sang `CheckedIn`, tự động cập nhật trạng thái phòng vật lý sang `Occupied`.
- `CheckOutReservationCommand`: Kiểm tra số dư công nợ (phải thanh toán đủ 100%), ghi nhận `CheckedOutAtUtc`, chuyển trạng thái đặt phòng sang `CheckedOut`, tự động cập nhật trạng thái phòng vật lý sang `Dirty` để buồng phòng dọn dẹp.
- `CancelReservationCommand`: Hủy đặt phòng, tự động giải phóng phòng vật lý để bán cho khách khác.

#### 3. Tích hợp Danh mục Hành chính 2 cấp (`DMTinhThanh_2Cap` & `DMXaPhuong_2Cap`):
- Nạp dữ liệu 63 Tỉnh thành và 10.051 Xã phường vào hệ thống để phục vụ lưu trữ thông tin quê quán/địa chỉ khách hàng khi làm thủ tục lưu trú tại quầy.

#### 4. Kiểm thử tự động:
- Viết tối thiểu 50 test cases mới kiểm thử: Chống đặt trùng phòng dưới tải đồng thời, tính đúng giá giờ/đêm/phụ thu bậc thang, và tính toàn vẹn của máy trạng thái lưu trú.

---

### PHẦN II: NHIỆM VỤ CỦA BẠN NGUYỄN KHỞI NGUYÊN (FRONTEND / LỄ TÂN & ĐẶT PHÒNG)
- **Nhánh làm việc:** `feature/nguyen-reservations`
- **Mục tiêu:** Xây dựng màn hình tiếp nhận và tạo đơn đặt phòng trực quan cho nhân viên lễ tân.

#### 1. Màn hình Tạo Đơn Đặt Phòng Tại Quầy:
- **Form Tiếp Nhận Khách Hàng:**
  - Nhập thông tin khách: Họ tên, Số điện thoại, CCCD/Passport, Quốc tịch, chọn Tỉnh/Thành - Phường/Xã từ danh mục 2 cấp.
  - Chọn hình thức thuê: Thuê theo đêm (Overnight), Thuê theo giờ (Hourly), hoặc Thuê trong ngày (Day-use).
  - Chọn ngày/giờ nhận phòng và ngày/giờ trả phòng dự kiến.
- **Chọn Phòng Trực Quan:**
  - Gọi API `GetRoomAvailability` để hiển thị danh sách các phòng còn trống trong khoảng thời gian đã chọn, gom nhóm theo tầng lầu.
  - Lễ tân nhấp chọn số phòng cụ thể (vd: Phòng 203 - Tầng 2).
- **Bảng Tính Giá Tức Thì (Live Quote Preview):**
  - Tự động hiển thị tiền phòng tạm tính, phụ thu nhận sớm / trả trễ dự kiến, và tiền cọc yêu cầu ngay khi lễ tân thay đổi ngày/giờ.

#### 2. Sơ Đồ Lịch Đặt Phòng Theo Thời Gian (Room Timeline / Gantt Grid):
- Hiển thị trực quan toàn bộ các phòng theo chiều dọc và các ngày trong tuần/tháng theo chiều ngang.
- Các thanh màu thể hiện khoảng thời gian phòng đã có khách đặt, giúp lễ tân không bị gán nhầm phòng.

---

### PHẦN III: NHIỆM VỤ CỦA BẠN TRẦN TRỌNG TÂN (FRONTEND / VẬN HÀNH & THU NGÂN)
- **Nhánh làm việc:** `feature/tan-operations`
- **Mục tiêu:** Xây dựng quy trình làm thủ tục Check-in/Check-out tại quầy và quản lý hóa đơn thu ngân Folio.

#### 1. Quy Trình Thao Tác Check-in & Check-out Thực Tế:
- **Modal Check-in (Khách Đến Nhận Phòng):**
  - Đối chiếu CCCD của khách với thông tin trên phiếu đặt phòng.
  - Bấm nút "Xác nhận nhận phòng" $\to$ Gọi API Check-in $\to$ Phòng tự động đổi sang màu đỏ `Occupied`.
- **Modal Check-out (Khách Trả Phòng):**
  - Kiểm tra tình trạng phòng và phụ phí phát sinh (nếu có trả phòng muộn).
  - Đối chiếu số dư công nợ còn lại trên hóa đơn Folio.
  - Bấm nút "Hoàn tất trả phòng" $\to$ Gọi API Check-out $\to$ Phòng tự động đổi sang màu cam `Dirty` (bắn tín hiệu sang Bảng buồng phòng để nhân viên đi dọn).

#### 2. Bảng Kê Hóa Đơn Folio & Thu Ngân (`payments.page.ts`):
- **Bảng Kê Hóa Đơn Chi Tiết (Folio Card):**
  - Tổng tiền phòng + Phụ thu nhận sớm/trả trễ + Dịch vụ phát sinh.
  - Trừ đi số tiền cọc khách đã trả trước.
  - Hiển thị số dư còn phải thu (`RemainingBalance`).
- **Form Thu Tiền Tại Quầy:**
  - Chọn phương thức: Tiền mặt hoặc Chuyển khoản ngân hàng (hiển thị mã QR ngân hàng).
  - Xuất phiếu thu / Hóa đơn thanh toán.
- **Báo Cáo Tổng Thu Ca Trực (Shift Closing):**
  - Thống kê tổng tiền thực thu theo ca trong ngày (giờ Việt Nam UTC+7) phục vụ bàn giao ca cho nhân viên tiếp theo.

---

## 3. QUY TRÌNH PHỐI HỢP GIT ĐỘC LẬP (KHÔNG ĐÈ CODE)

```mermaid
gitGraph
    commit id: "Week 1 Foundation (Auth, Catalog, HK FSM)"
    branch feature/nguyen-reservations
    branch feature/tan-operations
    checkout develop
    commit id: "feat(an): Reservation Engine & Stay Lifecycle API"
    checkout feature/nguyen-reservations
    commit id: "feat(nguyen): Front-desk Booking Form & Room Timeline"
    checkout feature/tan-operations
    commit id: "feat(tan): Check-in/Out Modals & Cashier Folio"
    checkout develop
    merge feature/nguyen-reservations id: "Merge PR #3 (Nguyen Booking)"
    merge feature/tan-operations id: "Merge PR #4 (Tan Operations)"
    commit id: "Release Week 2 Milestone"
```

1. **Trên nhánh `develop`:** Tuấn An đẩy 100% mã nguồn thực thi Backend Core Engine, API, Seeder và Unit Tests. Trên `develop`, các màn hình của Nguyên và Tân giữ scaffold placeholder để nhánh chung luôn biên dịch sạch sẽ.
2. **Trên nhánh riêng:**
   - Khởi Nguyên làm việc trên `feature/nguyen-reservations`.
   - Trọng Tân làm việc trên `feature/tan-operations`.
3. **Đồng bộ hóa:** Khi các bạn hoàn thành trên nhánh riêng, Tuấn An sẽ pull code về kiểm tra, merge vào `develop` và push lên GitHub hoàn tất cột mốc Tuần 2.
