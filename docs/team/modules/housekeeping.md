# 🧹 Hướng Dẫn Nghiệp Vụ: Bảng Trạng Thái Buồng Phòng (Housekeeping Module)
> **Mã task:** `CAT-HK-01` | **Đường dẫn đề xuất:** `/housekeeping`  
> **Kỹ sư phụ trách:** **Nguyên** (Full-Stack) | **Reviewer:** **Tân** (Full-Stack) | **Trạng thái:** **`Ready`**

---

## 1. MỤC ĐÍCH & PHÂN QUYỀN
- **Mục đích:** Cung cấp giao diện trực quan dạng bảng thẻ phòng (Room Grid Board) theo tầng giúp đội ngũ buồng phòng và lễ tân giám sát tức thời tình trạng vệ sinh và sẵn sàng của toàn bộ phòng trong chi nhánh.
- **Đối tượng sử dụng (Actors):**
  - **Housekeeping Staff (Nhân viên dọn phòng):** Xem danh sách phòng cần dọn, nhận dọn (`Cleaning`), hoàn tất dọn (`Clean`).
  - **Housekeeping Manager (Giám sát buồng phòng):** Kiểm tra phòng (`Inspecting`), đưa phòng vào bảo trì (`OutOfService`).
  - **Front Desk (Lễ tân):** Theo dõi phòng sạch để cấp cho khách check-in.
- **Phân quyền RBAC:**
  - `ROOMS:Read`, `ROOMS:Update`.

---

## 2. STATE MACHINE TRẠNG THÁI BUỒNG PHÒNG

```
[Dirty] ──(Bắt đầu dọn)──> [Cleaning] ──(Hoàn tất dọn)──> [Clean]
  ▲                                                          │
  │                                                          │ (Khách check-in/out)
  └────────────────────────[Occupied]◄───────────────────────┘
```
- **Quy tắc bắt buộc:**
  - **Phòng `Occupied` (Đang có khách):** Khóa hoàn toàn nút đổi trạng thái thủ công trên UI. Trạng thái này chỉ được tự động kích hoạt bởi nghiệp vụ Check-in của Lễ tân.
  - **Phòng `OutOfService` (Bảo trì):** Chỉ cho phép quản lý chuyển đổi khi cần sửa chữa trang thiết bị.

---

## 3. QUY TẮC BẢO VỆ ĐỒNG THỜI (CONCURRENCY GUARD)
- Khi gọi `PATCH /api/rooms/{id}/status`, client **bắt buộc** truyền cả `status` mới và `expectedOldStatus` (trạng thái hiện tại đang thấy trên UI).
- Nếu nhân viên khác đã cập nhật trước đó:
  - Backend trả về mã lỗi HTTP `409 Conflict` (`ERR_STALE_STATE`).
  - Client bắt lỗi qua `AlertService.toastWarning('Trạng thái phòng đã bị thay đổi bởi người khác. Hệ thống tự động làm mới.')`.
  - Tự động hoàn tác trạng thái trên giao diện và tải lại dữ liệu mới nhất.

---

## 4. BỘ LỌC & GIAO DIỆN YÊU CẦU
1. **Lọc nhanh trạng thái:** Nút lọc `Tất cả`, `Cần dọn (Dirty)`, `Đang dọn (Cleaning)`, `Sẵn sàng (Clean)`, `Bảo trì (OutOfService)`.
2. **Lọc theo tầng:** Tabs hoặc dropdown chọn tầng lầu.
3. **Thẻ phòng (Room Card):**
   - Số phòng to rõ (font monospace đậm).
   - Tên loại phòng và tầng.
   - Nút hành động nhanh: Nút "Bắt đầu dọn" (nếu Dirty), nút "Đã dọn xong" (nếu Cleaning).

---

## 5. HỢP ĐỒNG API
- `GET /api/rooms?floor=&status=&page=1&pageSize=100` (Lấy danh sách phòng theo tầng để vẽ thẻ).
- `PATCH /api/rooms/{id}/status`
  ```json
  {
    "status": "Cleaning",
    "expectedOldStatus": "Dirty"
  }
  ```

---

## 6. CHECKLIST TRIỂN KHAI CHO NGUYÊN (DEFINITION OF DONE)
- [ ] Giao diện lưới thẻ responsive, màu sắc chuẩn PMS: Xanh lá (Clean), Đỏ (Dirty), Vàng cam (Cleaning), Xám (OutOfService).
- [ ] Nút đổi trạng thái nhanh mượt mà, có loader chống bấm liên tục.
- [ ] Tích hợp `AlertService` cho thông báo và xác nhận.
- [ ] Kiểm thử kịch bản xung đột đồng thời 409 thành công.
- [ ] Viết Unit test cho component và service buồng phòng.
