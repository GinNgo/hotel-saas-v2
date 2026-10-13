# KẾ HOẠCH CHI TIẾT TUẦN 2 (PHASE 1B – PHASE 2)
### ĐỀ TÀI: HỆ THỐNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH (HOTEL SAAS PLATFORM V2)
- **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
- **Nhánh tích hợp chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop)
- **Thời gian thực hiện:** Tuần 2 (13/10/2026 – 19/10/2026)
- **Mục tiêu cốt lõi:** Xây dựng Multi-tier Pricing Engine (theo giờ, theo đêm, ngày, phụ thu lũy tiến, anti-overlap 409); Quản lý kho phòng chuyên sâu (Batch Room Generator, Modal CRUD, validation số phòng theo tầng); Bảng điều hành buồng phòng trực quan (Floor Grid, State Machine 1 chạm, chống xung đột 409 `ERR_STALE_STATE`, Live KPI Bar); Chuẩn hóa quy trình Git độc lập cho từng thành viên.

---

## 1. MA TRẬN PHÂN CÔNG CÔNG VIỆC TUẦN 2 (QUY CHUẨN ENTERPRISE)

| Thành viên | Vai trò | Nhánh Git cá nhân | Trọng tâm nhiệm vụ Tuần 2 | Sản phẩm bàn giao (Deliverables) |
|---|---|---|---|---|
| 👤 **Ngô Võ Tuấn An**<br>*(24TX810001)* | Leader / Backend & System Architect | `develop` | - **Multi-tier Pricing Engine:** Tính giá theo giờ (block đầu + lũy tiến), theo đêm, theo ngày (day-use), phụ thu check-in sớm / check-out trễ theo bậc thang, phụ thu vượt người.<br>- **Reservation Lifecycle & State Machine:** Draft $\to$ Hold (TTL 15p) $\to$ Confirmed $\to$ CheckedIn $\to$ CheckedOut.<br>- **Anti-Collision & Concurrency Lock:** Thuật toán chống trùng bảng giá (409 Overlap) & Chống Double-booking (`xmin` / Optimistic Lock).<br>- **Automated Room Allocation:** Thuật toán tự động gán phòng trống tối ưu chi phí dọn dẹp.<br>- **Review PR:** Đánh giá và merge Pull Request của 2 thành viên. | - `PricingCalculator.cs`<br>- `ReservationStateMachine.cs`<br>- `PoliciesController.cs`<br>- `RoomTypeRatesController.cs`<br>- 50+ Unit/Integration Tests mới (100% Pass). |
| 👤 **Nguyễn Khôi Nguyên**<br>*(24TX810011)* | Frontend Developer (Catalog & Inventory) | `feature/nguyen-rooms` | - **Full Room Inventory Management:** Modal CRUD phòng hoàn chỉnh, kiểm tra hợp lệ số phòng theo tầng, bắt 409 Conflict số phòng trùng.<br>- **Batch Room Generator:** Modal tạo nhanh dải phòng hàng loạt theo tầng (vd: 201-215).<br>- **Room Type Rates Matrix (`rates.page.ts`):** Màn hình ma trận giá linh hoạt (giá đêm, giá giờ, giá cuối tuần, giá lễ hội), Date overlap client-side preview.<br>- **Enterprise UX:** Phân trang server-side, bộ lọc đa tiêu chí, Debounce 300ms, Skeleton loading, Empty state.<br>- **Unit Tests:** Viết test Vitest cho component và validation utility. | - `rooms.page.ts`<br>- `rates.page.ts`<br>- `rooms-validation.util.ts`<br>- Vitest specs cho Rooms<br>- PR trên GitHub trỏ vào `develop`. |
| 👤 **Trần Trọng Tân**<br>*(24TX810025)* | Frontend Developer (Housekeeping Ops) | `feature/tan-housekeeping` | - **Housekeeping Live Operations Board:** Chế độ xem theo Tầng (Floor Grid) & Kanban, mã màu nhận diện quốc tế (Dirty, Cleaning, Clean, Inspected, OOO).<br>- **One-click State Machine:** Nút chuyển trạng thái phòng 1 chạm, chống click đúp (Button lock).<br>- **Concurrency Conflict Handling:** Bắt 409 `ERR_STALE_STATE`, Toast cảnh báo xung đột, tự động đồng bộ ngầm không reload trang.<br>- **Live Housekeeping KPI Bar:** Đo lường tỷ lệ phòng sẵn sàng (% Ready Rate), số phòng cần dọn gấp, cảnh báo phòng sắp check-in.<br>- **Unit Tests:** Viết test Vitest cho dashboard, KPI và concurrency utility. | - `housekeeping.page.ts`<br>- `housekeeping-kpi.util.ts`<br>- `housekeeping-concurrency.util.ts`<br>- Vitest specs cho Housekeeping<br>- PR trên GitHub trỏ vào `develop`. |

---

## 2. KẾ HOẠCH CHI TIẾT TỪNG THÀNH VIÊN TRONG TUẦN 2

---

### PHẦN I: NHIỆM VỤ CỦA BẠN NGÔ VÕ TUẤN AN (LEADER / BACKEND ARCHITECT)
- **Nhánh làm việc:** `develop`
- **Mục tiêu:** Cung cấp hạ tầng Backend mạnh mẽ, xử lý tính toán giá phức hợp, máy trạng thái đặt phòng và cơ chế khóa đồng thời chống xung đột dữ liệu.

#### 1. Xây dựng Multi-tier Pricing Engine (.NET 10 / C# 13):
- **Vị trí mã nguồn:** `backend/src/HotelSaas.Application/Pricing/`
- **Các mô hình định giá được hỗ trợ:**
  1. **Theo đêm (Standard Overnight):** Khung giờ check-in mặc định 14:00 $\to$ check-out 12:00 hôm sau. Hỗ trợ hệ số phụ thu ngày cuối tuần (Thứ 6, Thứ 7).
  2. **Theo giờ (Hourly Stay):** Đơn giá cố định cho Block đầu (ví dụ: 2 giờ đầu = 150.000đ) + đơn giá lũy tiến cho mỗi giờ tiếp theo (50.000đ/giờ, làm tròn lên mỗi 60 phút). Đặt trần giá giờ (Hourly Ceiling Cap) không vượt quá giá theo đêm.
  3. **Theo ngày (Day-use):** Sử dụng trong ngày từ 08:00 đến 18:00 cùng ngày (áp dụng đơn giá Day-use riêng).
  4. **Phụ thu sớm/trễ theo bậc thang (Tiered Early Check-in / Late Check-out):**
     - Check-in sớm trước 06:00: Tính 100% giá đêm.
     - Check-in sớm từ 06:00 đến 09:00: Tính 50% giá đêm.
     - Check-in sớm từ 09:00 đến 14:00: Tính 30% giá đêm.
     - Check-out trễ từ 12:00 đến 15:00: Phụ thu 30% giá đêm.
     - Check-out trễ từ 15:00 đến 18:00: Phụ thu 50% giá đêm.
     - Check-out trễ sau 18:00: Tính trọn 100% giá đêm tiếp theo.
  5. **Phụ thu vượt số lượng khách (Occupancy Surcharge):** Tự động cộng phụ thu khi số lượng người lớn/trẻ em vượt quá sức chứa tiêu chuẩn (`StandardOccupancy`) của hạng phòng.

#### 2. Reservation Lifecycle & State Machine:
- **Vị trí mã nguồn:** `backend/src/HotelSaas.Application/Reservations/`
- **Máy trạng thái nghiêm ngặt:**
  $$\text{Draft} \xrightarrow{\text{Create Hold}} \text{Hold (TTL 15m)} \xrightarrow{\text{Deposit/Confirm}} \text{Confirmed} \xrightarrow{\text{Check-in}} \text{CheckedIn} \xrightarrow{\text{Check-out}} \text{CheckedOut}$$
  - Hỗ trợ hủy: `Cancelled` (từ `Hold` hoặc `Confirmed`), `NoShow` (khi khách không đến quá giờ quy định).
- **Thuật toán tự động phân bổ phòng (Automated Room Allocation Engine):**
  - Tự động quét phòng trống có trạng thái `Clean` hoặc `Inspected` phù hợp hạng phòng.
  - Tối ưu hóa gom cụm phòng cùng tầng để giảm thiểu quãng đường di chuyển của nhân viên phục vụ.

#### 3. Chống trùng khoảng giá (Anti-Overlap) & Kiểm soát đồng thời (Concurrency Control):
- **Thuật toán Anti-Overlap Rates:**
  - Khi thêm hoặc cập nhật bảng giá loại phòng qua `POST/PUT /api/room-types/{id}/rates`:
  - Thuật toán kiểm tra giao thoa khoảng ngày:
    $$\text{Overlap} \iff (\text{NewStart} \le \text{ExistingEnd}) \land (\text{NewEnd} \ge \text{ExistingStart})$$
  - Nếu phát hiện trùng lặp, trả về `HTTP 409 Conflict` kèm danh sách ID và khoảng ngày của bản ghi bị xung đột.
- **Cơ chế chống Double-Booking:**
  - Áp dụng Optimistic Concurrency Control với trường `xmin` (PostgreSQL system column) hoặc `RowVersion`.
  - Database Transaction với mức cô lập phù hợp đảm bảo không thể có 2 luồng đồng thời giữ chỗ cùng 1 phòng vật lý trong cùng khung giờ.

#### 4. Chính sách chi nhánh (Property Policies API):
- `GET /api/properties/{id}/policies`: Lấy thông số check-in/check-out tiêu chuẩn, thời gian đệm dọn phòng (`cleaningBufferMinutes` $\ge$ 30), chính sách hủy phòng.
- `PUT /api/properties/{id}/policies`: Cập nhật cấu hình chính sách chi nhánh (yêu cầu quyền Manager/Admin).

#### 5. Kiểm thử tự động (Unit & Integration Tests):
- Bổ sung tối thiểu 50 test cases mới tại `backend/tests/HotelSaas.Application.Tests/`:
  - `PricingCalculatorTests.cs`: Kiểm thử toàn diện 10 kịch bản tính giá giờ, giá đêm, day-use, phụ thu bậc thang và phụ thu khách vượt chuẩn.
  - `ReservationStateMachineTests.cs`: Kiểm thử tính hợp lệ của mọi bước chuyển trạng thái và chặn các bước chuyển trái phép.
  - `RoomTypeRatesAntiOverlapTests.cs`: Kiểm thử bắt 409 Conflict khi khoảng ngày trùng lặp.
  - `ConcurrencyDoubleBookingTests.cs`: Giả lập 10 requests đồng thời đặt cùng 1 phòng để chứng minh chỉ duy nhất 1 request thành công.

---

### PHẦN II: NHIỆM VỤ CỦA BẠN NGUYỄN KHÔI NGUYÊN (FRONTEND INVENTORY & CATALOG)
- **Nhánh làm việc:** `feature/nguyen-rooms`
- **Mục tiêu:** Xây dựng module Quản lý phòng và Bảng giá loại phòng đạt chuẩn giao diện SaaS chuyên nghiệp, thân thiện, xử lý dữ liệu lớn và validation chặt chẽ.

#### 1. Màn hình Quản lý Danh mục Phòng Toàn diện (`rooms.page.ts`):
- **Modal CRUD Phòng (Thêm / Sửa / Chi tiết):**
  - Nhập số phòng (mã định danh vật lý, vd: `101`, `102`, `205`).
  - Chọn tầng lầu (Tầng 1, Tầng 2, Tầng 3, Tầng 4, Tầng 5...).
  - Chọn loại phòng từ danh sách động (`RoomTypeService`).
  - Chọn trạng thái vận hành ban đầu (`Clean`, `Dirty`, `Out of Service`).
  - Danh mục tiện ích đi kèm (View biển, Ban công, Bồn tắm nằm, Giường đôi...).
- **Quy tắc Kiểm tra Hợp lệ (Client-side Validation):**
  - Không cho phép để trống số phòng hoặc tầng.
  - Ràng buộc quy tắc số phòng theo tầng: Số phòng phải bắt đầu bằng chữ số của tầng (ví dụ: Tầng 3 thì số phòng phải là `3xx`).
- **Trình tạo phòng hàng loạt (Batch Room Generator Modal):**
  - Cung cấp tính năng "Tạo nhanh danh sách phòng": Người dùng chọn Tầng (ví dụ Tầng 3), nhập số phòng bắt đầu (`301`), số lượng phòng (`10`), chọn Loại phòng (`Deluxe Double`).
  - Ứng dụng tự động sinh danh sách phòng từ `301` đến `310` và gửi batch request về Backend.

#### 2. Xử lý bắt lỗi 409 Conflict chuyên sâu:
- Khi người dùng tạo hoặc sửa phòng trùng với số phòng đã có trong chi nhánh, Backend trả về `HTTP 409 Conflict`.
- Component phải:
  - Bắt lỗi qua RxJS `catchError`.
  - Không đóng Modal để người dùng không bị mất dữ liệu đã nhập.
  - Đánh dấu viền đỏ trường "Số phòng" và hiển thị Toast thông báo: `"Số phòng [xxx] đã tồn tại trong chi nhánh này. Vui lòng nhập số khác!"`.

#### 3. Màn hình Ma trận Bảng giá Loại phòng (`rates.page.ts`):
- Hiển thị danh sách mức giá cấu hình cho từng hạng phòng:
  - Giá cơ sở theo đêm (Standard Night Rate).
  - Giá theo giờ (Base 2h Rate & Extra Hourly Rate).
  - Giá phụ thu cuối tuần / ngày lễ.
- **Modal cấu hình khoảng giá đặc biệt:**
  - Nhập ngày bắt đầu (`FromDate`) và ngày kết thúc (`ToDate`).
  - Kiểm tra phía Client: Báo lỗi nếu `ToDate < FromDate`.
  - Bắt lỗi 409 từ Backend nếu khoảng ngày bị đè lên bảng giá đã tồn tại, hiển thị cảnh báo đỏ trên giao diện.

#### 4. Tối ưu UX & Hiệu năng:
- Phân trang server-side kết hợp bộ lọc: Lọc theo Tầng, Hạng phòng, Trạng thái vận hành.
- Debounce 300ms cho ô tìm kiếm số phòng.
- Trạng thái Skeleton Loading khi đang fetch dữ liệu.
- Màn hình Empty State đẹp mắt khi chi nhánh chưa có phòng nào.

#### 5. Kiểm thử & Quy trình Git:
- Viết Unit Tests Vitest cho `rooms-validation.util.ts` và `rooms.page.ts`.
- Chạy `npm run build` đảm bảo không có lỗi TypeScript.
- Commit mã nguồn bằng tài khoản cá nhân:
  ```bash
  git checkout -b feature/nguyen-rooms
  git add .
  git commit -m "feat(rooms): implement full room CRUD, batch generator, 409 conflict handling and rates matrix"
  git push -u origin feature/nguyen-rooms
  ```
- Mở Pull Request vào `develop` trên GitHub và thông báo cho Tuấn An.

---

### PHẦN III: NHIỆM VỤ CỦA BẠN TRẦN TRỌNG TÂN (FRONTEND HOUSEKEEPING OPERATIONS)
- **Nhánh làm việc:** `feature/tan-housekeeping`
- **Mục tiêu:** Xây dựng bảng điều hành buồng phòng trực quan thời gian thực, hỗ trợ chuyển trạng thái 1 chạm mượt mà, đo lường KPI buồng phòng và xử lý xung đột đồng thời.

#### 1. Bảng Điều Hành Buồng Phòng Trực Quan (Live Operations Board):
- **Đa chế độ xem:**
  - **Chế độ xem theo Tầng (Floor Grid View):** Gom nhóm danh sách phòng theo từng tầng lầu (Tầng 1, Tầng 2...), giúp nhân viên buồng phòng dễ dàng bao quát khu vực phụ trách.
  - **Chế độ bảng truyền thống (Table View):** Hiển thị chi tiết số phòng, hạng phòng, nhân viên phụ trách, thời gian cập nhật gần nhất.
- **Mã màu trạng thái chuẩn quốc tế:**
  - 🟥 `Dirty` (Phòng bẩn - cần dọn ngay)
  - 🟨 `Cleaning` (Đang tiến hành dọn dẹp)
  - 🟦 `Clean` (Đã dọn xong - chờ giám sát kiểm tra)
  - 🟩 `Inspected` (Đã kiểm tra đạt chuẩn - sẵn sàng đón khách)
  - 🟪 `Occupied` (Đang có khách lưu trú)
  - ⬛ `Out of Service` (Phòng hỏng hóc / đang sửa chữa)

#### 2. Thao Tác Chuyển Trạng Thái 1 Chạm & Chống Click Đúp:
- Trên từng thẻ phòng hoặc dòng bảng buồng phòng:
  - Nếu phòng `Dirty`: Hiển thị nút "Bắt đầu dọn" (Icon chổi) $\to$ Chuyển sang `Cleaning`.
  - Nếu phòng `Cleaning`: Hiển thị nút "Hoàn tất dọn" (Icon tích xanh) $\to$ Chuyển sang `Clean`.
  - Nếu phòng `Clean` (tài khoản Trưởng buồng): Hiển thị nút "Nghiệm thu đạt" $\to$ Chuyển sang `Inspected`.
- **Cơ chế chống click đúp (Button Lock & Optimistic State):**
  - Ngay khi người dùng bấm nút, lập tức `disable` nút bấm và hiển thị spinner xoay nhẹ, ngăn chặn gửi nhiều request liên tục làm nghẽn server.

#### 3. Xử lý Xung Đột Đồng Thời 409 (`ERR_STALE_STATE`):
- Trong môi trường thực tế nhiều nhân viên cùng mở bảng điều hành: Nếu nhân viên A bấm hoàn tất dọn trước, khi nhân viên B bấm nút sẽ gặp lỗi `HTTP 409 Conflict`.
- Component của Tân phải:
  - Bắt mã lỗi 409 `ERR_STALE_STATE` qua service interceptor / RxJS.
  - Hiển thị Toast cảnh báo màu vàng nổi bật: `"Trạng thái phòng đã được cập nhật bởi nhân viên khác trước đó!"`.
  - Tự động nạp lại dữ liệu ngầm (Silent Auto-refresh) để cập nhật màu sắc và trạng thái mới nhất cho phòng mà không làm giật hay reload lại toàn bộ trang web.

#### 4. Thanh Đo Lường Hiệu Suất Buồng Phòng Trực Tiếp (Live KPI Metric Bar):
- Đặt ngay đầu trang `housekeeping.page.ts`:
  - **Tỷ lệ phòng sẵn sàng đón khách (% Ready Rate):** $\frac{\text{Số phòng Clean} + \text{Inspected}}{\text{Tổng số phòng}} \times 100\%$.
  - **Số phòng bẩn cần xử lý ngay:** Cảnh báo số lượng phòng `Dirty`.
  - **Cảnh báo phòng ưu tiên cao (Priority Urgent Rooms):** Đánh dấu biểu tượng ngôi sao màu đỏ cho các phòng có khách đặt sắp Check-in trong vòng 2 giờ nhưng vẫn đang ở trạng thái `Dirty`.

#### 5. Kiểm thử & Quy trình Git:
- Viết Unit Tests Vitest cho `housekeeping-kpi.util.ts`, `housekeeping-concurrency.util.ts` và `housekeeping.page.ts`.
- Chạy `npm run build` đảm bảo không có lỗi TypeScript.
- Commit mã nguồn bằng tài khoản cá nhân:
  ```bash
  git checkout -b feature/tan-housekeeping
  git add .
  git commit -m "feat(housekeeping): implement floor grid board, 1-touch status transition, 409 stale handling and live KPI bar"
  git push -u origin feature/tan-housekeeping
  ```
- Mở Pull Request vào `develop` trên GitHub và thông báo cho Tuấn An.

---

## 3. TIÊU CHÍ NGHIỆM THU TUẦN 2 (DEFINITION OF DONE - DOD)

1. **Backend Quality Gates:**
   - Hoàn thành đầy đủ API Pricing Engine (Overnight, Hourly, Day-use, Tiered Surcharges) và Policies.
   - Thuật toán Anti-overlap trả về 409 chính xác khi trùng dải ngày.
   - Máy trạng thái Reservation và Room Allocation hoạt động ổn định.
   - Vượt qua 100% kiểm thử tự động với tối thiểu 50 test cases mới.
2. **Frontend Quality Gates:**
   - Module `Rooms` có đầy đủ Modal CRUD, Batch Generator và xử lý 409 Conflict.
   - Module `Housekeeping` hỗ trợ Floor Grid, thao tác 1 chạm, chống click đúp, bắt 409 `ERR_STALE_STATE` và Live KPI Bar.
   - Toàn bộ code TypeScript pass `npm run build` 100% không cảnh báo lỗi type.
3. **CI/CD & Git Collaboration:**
   - Cả 2 Pull Request `feature/nguyen-rooms` và `feature/tan-housekeeping` đều chạy pass 6 stages trên GitHub Actions.
   - Git Network Graph trên GitHub thể hiện rõ ràng các commit độc lập của từng thành viên trước khi được Tuấn An review và merge vào `develop`.
