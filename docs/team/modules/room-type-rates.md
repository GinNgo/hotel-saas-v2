# 💰 Hướng Dẫn Nghiệp Vụ: Bảng Giá Theo Mùa & Lịch Sử Biến Động (Room Type Rates)
> **Mã task:** `CAT-RATE-01` | **Đường dẫn đề xuất:** `/room-types/:id/rates`  
> **Kỹ sư phụ trách:** **Tân** (Full-Stack) | **Reviewer:** **Nguyên** (Full-Stack) | **Trạng thái:** **`Ready`**

---

## 1. MỤC ĐÍCH & PHÂN QUYỀN
- **Mục đích:** Thiết lập biểu giá phòng linh hoạt theo mùa cao điểm/thấp điểm, theo ngày trong tuần, và lưu vết toàn bộ lịch sử phân tách khoảng giá (Interval Splitting & Audit Trail).
- **Đối tượng sử dụng:**
  - **Revenue Manager / Quản lý:** Tạo bảng giá, điều chỉnh giá phòng theo mùa lễ hội/cuối tuần.
  - **Lễ tân:** Xem giá áp dụng chính xác cho ngày khách lưu trú.
- **Phân quyền RBAC:**
  - Xem bảng giá: `ROOM_TYPES:Read`
  - Thêm / Sửa bảng giá: `ROOM_TYPES:Update`

---

## 2. NGUYÊN TẮC PHÂN TÁCH KHOẢNG GIÁ (INTERVAL SPLITTING)
- **Quy tắc toán học & CSDL:**
  - Mỗi biểu giá áp dụng trong một khoảng thời gian nửa đóng nửa mở: `[EffectiveDate, ExpirationDate)`.
  - Không được phép có hai biểu giá cùng loại chồng lấn thời gian trên cùng một loại phòng.
  - Khi người dùng thêm một biểu giá mới chen vào giữa một khoảng giá đang có:
    - Khoảng giá cũ sẽ tự động được hệ thống phân tách (split) làm 2 nửa: trước khoảng mới và sau khoảng mới.
    - Hệ thống tự động ghi nhật ký vào bảng `RoomTypeRateAudits` để phục vụ thanh tra tài chính.

---

## 3. TÍCH HỢP BỘ LỌC NGÀY DÙNG CHUNG
- Sử dụng component `DateRangeFilterComponent`:
  - Lọc các biểu giá có hiệu lực trong khoảng ngày người dùng quan sát:
    `EffectiveDate < filterEndExclusive AND (ExpirationDate IS NULL OR ExpirationDate > filterStart)`.
  - Giúp quản lý dễ dàng kiểm tra các đợt giá lễ tết, mùa hè sắp tới.

---

## 4. HỢP ĐỒNG API
- **Lấy danh sách bảng giá đang hoạt động:**
  ```http
  GET /api/room-types/{id}/rates?propertyId=<guid> HTTP/1.1
  Authorization: Bearer <token>
  ```
- **Lấy lịch sử kiểm toán biến động giá:**
  ```http
  GET /api/room-types/{id}/rates/history?propertyId=<guid> HTTP/1.1
  Authorization: Bearer <token>
  ```
- **Tạo hoặc phân tách khoảng giá mới:**
  ```http
  POST /api/room-types/{id}/rates HTTP/1.1
  Content-Type: application/json
  Authorization: Bearer <token>

  {
    "rentalType": "Overnight",
    "basePrice": 1500000,
    "effectiveDate": "2026-11-01T00:00:00Z",
    "expirationDate": "2026-11-15T00:00:00Z",
    "reason": "Mùa du lịch lễ hội hoa"
  }
  ```

---

## 5. CHECKLIST TRIỂN KHAI CHO TÂN (DEFINITION OF DONE)
- [ ] Giao diện hiển thị bảng giá rõ ràng: Loại thuê, Giá áp dụng, Từ ngày - Đến ngày.
- [ ] Tích hợp `DateRangeFilterComponent` lọc theo thời gian hiệu lực.
- [ ] Tab hiển thị Audit History với lý do thay đổi và người thực hiện.
- [ ] Tích hợp `AlertService` cho thông báo và xác nhận.
- [ ] Unit & Integration tests cho logic interval splitting.
