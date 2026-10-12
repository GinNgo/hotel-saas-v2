# 🏨 Hướng Dẫn Nghiệp Vụ: Quản Lý Phòng (Rooms Module)
> **Mã module:** `CAT-ROOMS` | **Màn hình mẫu chuẩn (Reference Screen):** `/rooms`  
> **Kỹ sư tham chiếu:** Toàn team (Mẫu kiến trúc cho Nguyên & Tân) | **Trạng thái:** **`In Review`**

---

## 1. MỤC ĐÍCH & PHÂN QUYỀN (ACTORS & PERMISSIONS)
- **Mục đích:** Quản lý danh mục các phòng vật lý tại từng chi nhánh khách sạn, tầng lầu, loại phòng liên kết và trạng thái buồng phòng thời gian thực.
- **Đối tượng sử dụng (Actors):**
  - **Property Manager (Quản lý chi nhánh):** Tạo phòng, sửa phòng, xóa phòng, đổi trạng thái.
  - **Receptionist / Front Desk (Lễ tân):** Xem danh sách phòng, lọc tìm phòng trống theo loại/tầng.
  - **Housekeeping Staff (Nhân viên buồng phòng):** Xem trạng thái và cập nhật nhanh trạng thái buồng phòng.
- **Ranh giới Tenant & Property (Scoping):**
  - Bắt buộc kiểm tra ngữ cảnh chi nhánh: Mọi thao tác đều gắn chặt với `PropertyId` hiện hành.
  - Mã quyền RBAC yêu cầu:
    - Xem danh sách: `ROOMS` hành động `Read`.
    - Thêm phòng: `ROOMS` hành động `Create`.
    - Sửa / Đổi trạng thái: `ROOMS` hành động `Update`.
    - Xóa phòng: `ROOMS` hành động `Delete`.

---

## 2. TRƯỜNG DỮ LIỆU & QUY TẮC RÀNG BUỘC (DATA DICTIONARY)

| Trường dữ liệu | Kiểu dữ liệu | Bắt buộc | Ràng buộc & Validation | Ý nghĩa nghiệp vụ |
| :--- | :---: | :---: | :--- | :--- |
| `Id` | GUID | Tự sinh | Primary Key | Định danh duy nhất của phòng |
| `RoomNumber` | String | **Có** | Tối đa 20 ký tự, không rỗng, duy nhất trong cùng chi nhánh | Số phòng hiển thị (VD: 101, 201) |
| `Floor` | Integer | **Có** | Số nguyên từ 1 đến 150 | Tầng lầu của phòng |
| `RoomTypeId` | GUID | **Có** | Phải tồn tại trong `RoomTypes` của cùng chi nhánh | Khóa ngoại loại phòng |
| `Status` | Integer (Enum) | **Có** | Giá trị: 0 (`Clean`), 1 (`Dirty`), 2 (`Cleaning`), 3 (`Occupied`), 4 (`OutOfService`) | Trạng thái buồng phòng & cư trú |
| `Notes` | String | Không | Tối đa 500 ký tự | Ghi chú nội bộ về phòng |
| `IsActive` | Boolean | **Có** | Mặc định `true` | Cờ hoạt động phục vụ kinh doanh |
| `CreatedAtUtc` | DateTime (UTC)| Tự sinh | ISO 8601 UTC | Thời điểm tạo phòng trong hệ thống |

---

## 3. Ý NGHĨA BỘ LỌC, TÌM KIẾM, SẮP XẾP & PHÂN TRANG

1. **Tìm kiếm (Search):**
   - Lọc theo số phòng (`RoomNumber`). Có `debounceTime(250ms)` và `switchMap` tự hủy request cũ để tránh race condition.
2. **Bộ lọc trạng thái (Status Filter):**
   - Lọc theo từng trạng thái: `Clean` (Sạch), `Dirty` (Cần dọn), `Cleaning` (Đang dọn), `Occupied` (Đang có khách), `OutOfService` (Bảo trì).
3. **Bộ lọc loại phòng & Tầng:**
   - Dropdown chọn loại phòng thuộc chi nhánh.
   - Dropdown chọn tầng lầu.
4. **Bộ lọc ngày dùng chung (`DateRangeFilterComponent`):**
   - Áp dụng trên trường `CreatedAtUtc`.
   - Một ngày: `[00:00:00 ngày chọn, 00:00:00 ngày kế tiếp)` UTC.
   - Khoảng ngày: `[00:00:00 từ ngày, 00:00:00 ngày tiếp theo sau đến ngày)` UTC.
5. **Quy tắc chuyển trang (Pagination):**
   - Thay đổi bất kỳ bộ lọc nào $\rightarrow$ Tự động reset về trang 1.
   - Phân trang server-side với `page` (1-based) và `pageSize` (10, 20, 50).
6. **Sắp xếp ổn định (Stable Sorting):**
   - Sắp xếp theo Số phòng, Tầng, Loại phòng, Giá, Trạng thái, Ngày tạo.
   - Tie-breaker bắt buộc: `Id` để đảm bảo kết quả phân trang nhất quán.

---

## 4. QUY TẮC THAO TÁC & XỬ LÝ MÃ LỖI (CRUD & ERROR HANDLING)

- **Thêm mới phòng (`POST /api/rooms`):**
  - Trùng số phòng trên cùng chi nhánh $\rightarrow$ Backend trả về HTTP `409 Conflict` kèm thông báo: *"Số phòng 'X' đã tồn tại trên chi nhánh này"*. Giao diện hiển thị cảnh báo đỏ trực tiếp trên form.
- **Sửa thông tin phòng (`PUT /api/rooms/{id}`):**
  - Đổi số phòng sang số đã có ở phòng khác $\rightarrow$ HTTP `409 Conflict`.
- **Đổi nhanh trạng thái buồng phòng (`PATCH /api/rooms/{id}/status`):**
  - Bắt buộc truyền `expectedOldStatus`.
  - Nếu trạng thái trong CSDL bị người khác sửa trước $\rightarrow$ HTTP `409 Conflict` (`ERR_STALE_STATE`). Giao diện rollback dropdown và cảnh báo người dùng làm mới trang.
- **Xóa phòng (`DELETE /api/rooms/{id}`):**
  - Bắt buộc hiển thị popup SweetAlert2 xác nhận trước khi xóa.
  - Nếu phòng đang có đặt phòng hoạt động $\rightarrow$ Backend trả về HTTP `409 Conflict` (`ERR_ROOM_HAS_ACTIVE_RESERVATIONS`). Giao diện thông báo từ chối xóa an toàn, không gây crash ứng dụng.

---

## 5. HỢP ĐỒNG API THỰC TẾ (API CONTRACTS)

### 5.1. Lấy danh sách phòng phân trang
```http
GET /api/rooms?search=101&status=Clean&floor=1&page=1&pageSize=20 HTTP/1.1
Authorization: Bearer <token>
X-Property-Id: <guid>
```
**Response 200 OK:**
```json
{
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "propertyId": "22222222-2222-2222-2222-222222222221",
      "roomNumber": "101",
      "floor": 1,
      "status": "Clean",
      "notes": "Phòng góc nhìn đẹp",
      "isActive": true,
      "roomTypeId": "e5b8a12f-6825-4c07-9382-3d5f30e9d102",
      "roomTypeName": "Deluxe Double",
      "roomTypeCode": "DLX-D",
      "basePrice": 1200000.00,
      "createdAtUtc": "2026-10-09T14:30:00Z"
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 20
}
```

### 5.2. Đổi trạng thái buồng phòng
```http
PATCH /api/rooms/3fa85f64-5717-4562-b3fc-2c963f66afa6/status HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>
X-Property-Id: <guid>

{
  "status": "Dirty",
  "expectedOldStatus": "Clean"
}
```

---

## 6. CHECKLIST KIỂM THỬ & TIÊU CHUẨN ĐẠT (DEFINITION OF DONE)
- [x] Lọc và hiển thị dữ liệu chính xác theo chi nhánh đang chọn.
- [x] Đổi chi nhánh trên Header $\rightarrow$ Dữ liệu phòng tự động reload đúng chi nhánh mới.
- [x] Debounce tìm kiếm mượt mà, không giật lag, hủy request cũ khi gõ nhanh.
- [x] SweetAlert2 xác nhận trước khi xóa, chống double-click.
- [x] Bắt lỗi 409 khi tạo trùng số phòng hiển thị thông báo rõ ràng.
- [x] Đạt 100% responsive trên Desktop (1920x1080) và Mobile (375x812).
