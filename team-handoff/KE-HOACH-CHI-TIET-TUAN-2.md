# KẾ HOẠCH CHI TIẾT TUẦN 2 (PHASE 1B – PHASE 2)
### ĐỀ TÀI: HỆ THỐNG QUẢN LÝ KHÁCH SẠN (HOTEL SAAS PLATFORM V2)
- **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
- **Nhánh tích hợp chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop)
- **Thời gian thực hiện:** Tuần 2 (13/10/2026 – 19/10/2026)
- **Mục tiêu cốt lõi:** Hoàn thiện Pricing Engine tính giá giờ/đêm & chính sách phụ thu; hoàn thiện giao diện thêm/sửa phòng và xử lý lỗi 409; hoàn thiện thao tác chuyển trạng thái buồng phòng 1 chạm; tích hợp Pull Request của cả 3 thành viên vào `develop`.

---

## 1. MA TRẬN PHÂN CÔNG CÔNG VIỆC TUẦN 2

| Thành viên | Vai trò | Nhánh Git | Nhiệm vụ trọng tâm Tuần 2 | Sản phẩm bàn giao (Deliverables) |
|---|---|---|---|---|
| 👤 **Ngô Võ Tuấn An** *(24TX810001)* | Leader / Backend | `develop` | - Xây dựng Pricing Engine tính giá giờ/đêm.<br>- API Policies chi nhánh & Rates loại phòng.<br>- Bắt lỗi xung đột giá 409 Overlap.<br>- Review và merge Pull Request của 2 bạn. | `PricingCalculator.cs`, `PoliciesController.cs`, `RoomTypeRatesController.cs`, Unit Tests giá (100% pass). |
| 👤 **Nguyễn Khôi Nguyên** *(24TX810011)* | Frontend Catalog | `feature/nguyen-rooms` | - Hoàn thiện Modal Form Thêm/Sửa phòng.<br>- Bắt lỗi 409 Conflict số phòng trùng trong chi nhánh.<br>- Xây dựng giao diện cấu hình Bảng giá (`rates.page.ts`).<br>- Mở Pull Request vào `develop`. | `rooms.page.ts`, `rates.page.ts`, `rooms-validation.util.ts`, PR trên GitHub. |
| 👤 **Trần Trọng Tân** *(24TX810025)* | Frontend Ops | `feature/tan-housekeeping` | - Hoàn thiện nút bấm đổi trạng thái phòng 1 chạm.<br>- Xử lý xung đột đồng thời 409 `ERR_STALE_STATE` với Toast cảnh báo.<br>- Chống click đúp và hoàn thiện lọc theo tầng.<br>- Mở Pull Request vào `develop`. | `housekeeping.page.ts`, `housekeeping-concurrency.util.ts`, PR trên GitHub. |

---

## 2. CHI TIẾT NHIỆM VỤ TỪNG THÀNH VIÊN TRONG TUẦN 2

---

### PHẦN I: NHIỆM VỤ CỦA BẠN NGÔ VÕ TUẤN AN (LEADER / BACKEND)
- **Nhánh làm việc:** `develop`

#### 1. Xây dựng Pricing Engine (.NET 10 / C# 13):
- **Tệp nguồn:** `backend/src/HotelSaas.Application/Pricing/`
- **Logic tính giá phòng:**
  - **Theo đêm (Overnight):** Từ 12:00 hoặc 14:00 hôm trước đến 12:00 hôm sau.
  - **Theo giờ (Hourly):** Áp dụng đơn giá giờ đầu tiên + phụ thu các giờ tiếp theo (làm tròn lên mỗi 60 phút).
  - **Phụ thu sớm/trễ (Early check-in / Late check-out):** Tự động tính phụ phí dựa theo giờ cài đặt trong chính sách chi nhánh.
- **Unit Tests:** Viết bộ kiểm thử tự động tại `backend/tests/HotelSaas.Application.Tests/Pricing/` bao phủ 100% kịch bản tính giá.

#### 2. Xây dựng API Chính Sách Chi Nhánh (Policies API):
- **Tệp nguồn:** `backend/src/HotelSaas.WebApi/Controllers/PropertiesController.cs`
- **Endpoints:**
  - `GET /api/properties/{id}/policies`: Lấy cấu hình check-in mặc định, check-out mặc định, thời gian đệm dọn phòng (buffer $\ge$ 30 phút).
  - `PUT /api/properties/{id}/policies`: Cập nhật chính sách chi nhánh (chỉ tài khoản Manager/Admin có quyền).

#### 3. Xây dựng API Bảng Giá Loại Phòng (Rates API):
- **Tệp nguồn:** `backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs`
- **Endpoints:**
  - `GET /api/room-types/{id}/rates`: Lấy danh sách khoảng giá theo ngày của loại phòng.
  - `POST /api/room-types/{id}/rates`: Thêm khoảng giá mới.
  - **Kiểm tra chống trùng lặp khoảng thời gian (Anti-overlap):** Nếu khoảng ngày `[FromDate, ToDate]` bị đè lên khoảng ngày đã có, trả về ngay mã lỗi HTTP `409 Conflict` kèm thông điệp: `"Khoảng thời gian áp dụng bảng giá bị trùng lặp"`.

#### 4. Phối hợp Nhóm & Duyệt Code:
- Kiểm tra Pull Request `feature/nguyen-rooms` của bạn Nguyên và `feature/tan-housekeeping` của bạn Tân trên GitHub.
- Đảm bảo CI/CD GitHub Actions chạy pass 6 công đoạn kiểm thử tự động trước khi bấm **Merge Pull Request**.

---

### PHẦN II: NHIỆM VỤ CỦA BẠN NGUYỄN KHÔI NGUYÊN (FRONTEND CATALOG)
- **Nhánh làm việc:** `feature/nguyen-rooms`
- **Thư mục mã nguồn:** `frontend/src/app/features/rooms/`, `frontend/src/app/features/rates/`

#### 1. Hoàn Thiện Modal Form Thêm và Sửa Phòng:
- Xây dựng hộp thoại Modal nhập liệu trên `rooms.page.ts`:
  - Số phòng (ví dụ: `101`, `102`, `201`).
  - Chọn tầng lầu (Tầng 1, Tầng 2, Tầng 3, Tầng 4).
  - Chọn loại phòng (Dropdown lấy danh sách từ `RoomTypeService`).
  - Ghi chú tiện ích hoặc vị trí phòng.
- **Form Validation:**
  - Bắt buộc nhập số phòng, không cho phép để trống.
  - Kiểm tra số phòng hợp lệ với tầng (ví dụ phòng tầng 2 phải bắt đầu bằng số 2).

#### 2. Xử Lý Bắt Mã Lỗi 409 Conflict:
- Khi người dùng bấm lưu mà số phòng đã tồn tại trong chi nhánh, Backend sẽ trả về `HTTP 409 Conflict`.
- Component phải bắt lỗi này qua `catchError`, không làm crash ứng dụng, và hiển thị thông báo Toast cảnh báo màu đỏ: `"Số phòng này đã tồn tại trong chi nhánh, vui lòng chọn số khác!"`.

#### 3. Xây Dựng Giao Diện Cấu Hình Bảng Giá (`rates.page.ts`):
- Hiển thị bảng danh sách mức giá theo từng loại phòng.
- Form thêm khoảng giá mới: Chọn ngày bắt đầu, ngày kết thúc, giá theo đêm và giá theo giờ.
- Hiển thị cảnh báo trực quan nếu người dùng chọn ngày kết thúc trước ngày bắt đầu.

#### 4. Quy Trình Git Cuối Tuần:
- Chạy kiểm thử cục bộ: `npm run build` đảm bảo không có lỗi TypeScript.
- Commit mã nguồn bằng tài khoản cá nhân:
  ```bash
  git add .
  git commit -m "feat(rooms): complete room crud modal, 409 conflict handling and rates management"
  git push -u origin feature/nguyen-rooms
  ```
- Lên GitHub tạo Pull Request trỏ vào nhánh `develop` và thông báo cho Tuấn An review.

---

### PHẦN III: NHIỆM VỤ CỦA BẠN TRẦN TRỌNG TÂN (FRONTEND HOUSEKEEPING)
- **Nhánh làm việc:** `feature/tan-housekeeping`
- **Thư mục mã nguồn:** `frontend/src/app/features/housekeeping/`

#### 1. Hoàn Thiện Thao Tác Chuyển Trạng Thái Phòng 1 Chạm:
- Trên từng dòng của bảng buồng phòng `housekeeping.page.ts`:
  - Nếu phòng `Dirty`: Hiển thị nút "Bắt đầu dọn" (Icon chổi / màu cam) $\to$ Bấm vào gọi API chuyển sang `Cleaning`.
  - Nếu phòng `Cleaning`: Hiển thị nút "Hoàn tất dọn" (Icon tích xanh / màu xanh lá) $\to$ Bấm vào gọi API chuyển sang `Clean`.
- **Chống click đúp (Double-click Prevention):** Khi bấm nút, lập tức `disable` nút bấm và hiển thị spinner nhỏ cho đến khi API phản hồi xong.

#### 2. Xử Lý Xung Đột Đồng Thời 409 (`ERR_STALE_STATE`):
- Trong môi trường thực tế, nếu nhân viên A và nhân viên B cùng mở màn hình, A bấm hoàn tất dọn trước, khi B bấm nút sẽ gặp lỗi `HTTP 409 Conflict` do trạng thái phòng đã bị thay đổi trước đó.
- Component của Tân phải:
  - Bắt mã lỗi 409.
  - Hiển thị thông báo Toast cảnh báo màu vàng: `"Trạng thái phòng đã được người khác cập nhật trước đó!"`.
  - Tự động gọi lại hàm nạp dữ liệu để cập nhật bảng sang trạng thái mới nhất mà người dùng không cần F5 trình duyệt.

#### 3. Hoàn Thiện Bộ Lọc Theo Tầng Lầu:
- Thêm thanh Dropdown hoặc nút bấm chọn tầng: `Tất cả các tầng`, `Tầng 1`, `Tầng 2`, `Tầng 3`, `Tầng 4`.
- Khi chọn tầng, bảng lập tức lọc các phòng thuộc tầng tương ứng và tự động reset trang về Trang 1 (`page = 1`).

#### 4. Quy Trình Git Cuối Tuần:
- Chạy kiểm thử cục bộ: `npm run build` đảm bảo không có lỗi TypeScript.
- Commit mã nguồn bằng tài khoản cá nhân:
  ```bash
  git add .
  git commit -m "feat(housekeeping): complete one-click status transition, 409 stale state handling and floor filter"
  git push -u origin feature/tan-housekeeping
  ```
- Lên GitHub tạo Pull Request trỏ vào nhánh `develop` và thông báo cho Tuấn An review.

---

## 3. TIÊU CHÍ NGHIỆM THU TUẦN 2 (DEFINITION OF DONE - DOD)

1. **Backend:** Toàn bộ API tính giá, chính sách chi nhánh và bảng giá trả về đúng dữ liệu, vượt qua 100% Unit Tests.
2. **Frontend:** Cả 2 module Quản lý phòng (`rooms`) và Buồng phòng (`housekeeping`) không còn lỗi console, giao diện mượt mà và bắt mã lỗi 409 chuẩn xác.
3. **CI/CD:** Pipeline GitHub Actions trên repo [hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2) tự động chạy pass cả 6 stages sau khi merge Pull Request.
4. **Git Network Graph:** Thể hiện rõ ràng commit cá nhân của cả 3 thành viên trên GitHub phục vụ nộp báo cáo tiến độ Tuần 2 cho ThS. Phùng Hữu Xuân.
