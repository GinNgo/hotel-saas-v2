# 🏷️ Hướng Dẫn Nghiệp Vụ: Quản Lý Loại Phòng (Room Types Module)
> **Mã module:** `CAT-ROOMTYPES` | **Đường dẫn:** `/room-types`  
> **Kỹ sư tham chiếu:** Toàn team | **Trạng thái:** **`In Review`**

---

## 1. MỤC ĐÍCH & PHÂN QUYỀN
- **Mục đích:** Thiết lập cấu trúc các hạng phòng (Tiêu chuẩn, Cao cấp, Suite), diện tích, sức chứa tối đa và mức giá niêm yết cơ bản phục vụ tính giá và đặt phòng.
- **Đối tượng sử dụng:**
  - **Property Manager / Owner:** Toàn quyền tạo, sửa, xóa loại phòng.
  - **Lễ tân / Nhân viên:** Xem thông tin loại phòng và sức chứa để tư vấn khách.
- **Quyền hạn RBAC:**
  - Xem: `ROOM_TYPES:Read`
  - Thêm mới: `ROOM_TYPES:Create`
  - Cập nhật: `ROOM_TYPES:Update`
  - Xóa: `ROOM_TYPES:Delete`

---

## 2. TRƯỜNG DỮ LIỆU & RÀNG BUỘC

| Trường dữ liệu | Bắt buộc | Ràng buộc | Mô tả |
| :--- | :---: | :--- | :--- |
| `Code` | **Có** | Tối đa 10 ký tự, chữ hoa, duy nhất theo từng chi nhánh | Mã loại phòng (VD: STD, DLX, SUI) |
| `Name` | **Có** | Tối đa 100 ký tự | Tên hiển thị loại phòng |
| `BasePrice` | **Có** | Số thực $\ge 0$ | Giá cơ bản mỗi đêm (VNĐ) |
| `MaxOccupancy` | **Có** | Số nguyên $\ge 1$ (1 đến 20) | Số lượng khách tối đa |
| `BedType` | Không | Tối đa 50 ký tự | Cấu hình giường (King, Twin, Single) |
| `SquareMeters` | Không | Số thực $> 0$ | Diện tích phòng ($m^2$) |
| `Description` | Không | Văn bản | Mô tả tiện ích loại phòng |
| `RoomCount` | Tự tính | Số nguyên | Số phòng vật lý đang thuộc loại phòng này |

---

## 3. QUY TẮC NGHIỆP VỤ & MÃ LỖI
- **Trùng mã loại phòng:** Bắt lỗi HTTP `409 Conflict` nếu mã `Code` đã tồn tại trên chi nhánh.
- **Xóa loại phòng có phòng trực thuộc:** Nếu `RoomCount > 0`, backend từ chối xóa và trả về HTTP `409 Conflict`. Giao diện SweetAlert2 thông báo: *"Không thể xóa loại phòng vì đang có phòng vật lý trực thuộc"*.

---

## 4. HỢP ĐỒNG API
- `GET /api/room-types?search=&page=1&pageSize=20`
- `POST /api/room-types` (Body: `{ "code": "DLX", "name": "Deluxe", "basePrice": 1200000, "maxOccupancy": 2 }`)
- `PUT /api/room-types/{id}`
- `DELETE /api/room-types/{id}`
