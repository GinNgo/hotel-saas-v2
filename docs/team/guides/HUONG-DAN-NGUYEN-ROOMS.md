# TÀI LIỆU HƯỚNG DẪN DÀNH CHO NGUYÊN
### MODULE: QUẢN LÝ DANH MỤC PHÒNG & HẠNG PHÒNG (ROOMS & ROOM TYPES)
- **Người thực hiện:** Nguyên (Frontend Developer)
- **Hỗ trợ Backend & Kiến trúc:** Ngô Võ Tuấn Anh (Nhóm trưởng)
- **Kho lưu trữ:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
- **Nhánh làm việc đề xuất:** `feature/nguyen-rooms-crud` (tách từ `develop`)

---

## 1. CÁC TỆP NGUỒN THUỘC PHẠM VI QUẢN LÝ CỦA NGUYÊN

Nguyên chịu trách nhiệm chính trên các tệp sau (tuyệt đối không bị xung đột với các bạn khác):

| STT | Đường Dẫn File Trong Project | Vai Trò & Chức Năng | Link Trực Tiếp Trên GitHub |
|:---:|---|---|:---:|
| 1 | `frontend/src/app/features/rooms/rooms.page.ts` | Giao diện Quản lý Danh sách phòng, bộ lọc chi nhánh/tầng/trạng thái, modal Thêm/Sửa phòng | [rooms.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/rooms/rooms.page.ts) |
| 2 | `frontend/src/app/features/room-types/room-types.page.ts` | Giao diện Quản lý Hạng phòng (Deluxe, Suite...), cấu hình giá gốc, sức chứa, tiện ích | [room-types.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/room-types/room-types.page.ts) |
| 3 | `frontend/src/app/core/services/room.service.ts` | Dịch vụ gọi API Backend cho Phòng (`getRooms`, `createRoom`, `updateRoom`, `deleteRoom`) | [room.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/room.service.ts) |
| 4 | `frontend/src/app/core/services/room-type.service.ts` | Dịch vụ gọi API Backend cho Hạng phòng (`getRoomTypes`, `createRoomType`, `updateRoomType`, `deleteRoomType`) | [room-type.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/room-type.service.ts) |
| 5 | `frontend/src/app/core/models/room.model.ts` | Định nghĩa Interface kiểu dữ liệu cho Phòng: `RoomDto`, `CreateRoomRequest`, `UpdateRoomRequest` | [room.model.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/models/room.model.ts) |
| 6 | `frontend/src/app/core/models/room-type.model.ts` | Định nghĩa Interface kiểu dữ liệu cho Hạng phòng: `RoomTypeDto`, `CreateRoomTypeRequest` | [room-type.model.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/models/room-type.model.ts) |

---

## 2. DANH SÁCH API BACKEND ĐÃ SẴN SÀNG CHO NGUYÊN KẾT NỐI

Backend .NET 10 đã cung cấp đầy đủ các API chuẩn RESTful cho Nguyên gọi:

### 2.1. API Quản lý Phòng (`/api/rooms`)
*(Header bắt buộc: `Authorization: Bearer <token>` và `X-Property-Id: <id-chi-nhánh>` — do AuthInterceptor tự động gắn)*

1. **Lấy danh sách phòng có phân trang & lọc:**
   - `GET /api/rooms?page=1&pageSize=10&floor=2&status=1&searchTerm=101`
   - *Trả về:* `{ items: RoomDto[], totalCount: number, page: number, pageSize: number }`
2. **Tạo mới phòng:**
   - `POST /api/rooms`
   - *Body JSON:*
     ```json
     {
       "roomNumber": "205",
       "floor": 2,
       "roomTypeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
     }
     ```
   - *Lưu ý mã lỗi:* Nếu số phòng đã tồn tại trong chi nhánh, backend sẽ trả về mã `409 Conflict` kèm thông báo: *"Số phòng 205 đã tồn tại trong chi nhánh này"*. Nguyên bắt lỗi này và hiển thị thông báo đỏ trên form nhé!
3. **Cập nhật thông tin phòng:**
   - `PUT /api/rooms/{id}`
   - *Body JSON:*
     ```json
     {
       "roomNumber": "205A",
       "floor": 2,
       "roomTypeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
     }
     ```
4. **Xóa phòng (Soft Delete):**
   - `DELETE /api/rooms/{id}`
   - *Lưu ý mã lỗi:* Nếu phòng đang có khách ở (`Occupied`) hoặc có lịch đặt trong tương lai, backend trả về `409 Conflict` từ chối xóa.

---

### 2.2. API Quản lý Hạng phòng (`/api/room-types`)
1. **Lấy danh sách loại phòng:**
   - `GET /api/room-types`
   - *Trả về:* `RoomTypeDto[]`
2. **Thêm loại phòng mới:**
   - `POST /api/room-types`
   - *Body JSON:*
     ```json
     {
       "code": "DLX-01",
       "name": "Deluxe Double",
       "description": "Phòng đôi cao cấp có ban công",
       "basePrice": 1200000,
       "maxOccupancy": 2,
       "bedType": "King Bed",
       "squareMeters": 35.5
     }
     ```
3. **Sửa loại phòng:**
   - `PUT /api/room-types/{id}`

---

## 3. CHECKLIST CÔNG VIỆC CỦA NGUYÊN TRONG TUẦN 2 & TUẦN 3

- [ ] **Modal Thêm & Sửa phòng:**
  - Dùng component `<p-dialog>` của PrimeNG đã có trong dự án.
  - Form gồm: Ô nhập Số phòng (bắt buộc), Ô chọn Tầng lầu (1–20), Dropdown chọn Loại phòng (load từ `RoomTypeService`).
  - Validation: Không cho submit khi để trống số phòng hoặc chưa chọn loại phòng.
- [ ] **Xử lý Thông báo & Xác nhận:**
  - Sử dụng `AlertService` có sẵn trong `frontend/src/app/core/services/alert.service.ts`:
    - Thành công: `this.alertService.toastSuccess('Thêm phòng thành công!');`
    - Báo lỗi: `this.alertService.toastError(err.error?.message || 'Có lỗi xảy ra');`
    - Xác nhận xóa: `this.alertService.confirm('Bạn có chắc chắn muốn xóa phòng này?')`.
- [ ] **Tối ưu Responsive & Trải nghiệm:**
  - Kiểm tra bảng phòng hiển thị tốt trên màn hình hẹp (375px trên mobile): bảng có thanh cuộn ngang mượt mà, không bị tràn khung.
  - Các nút hành động (Sửa, Xóa) có khoảng cách bấm thoải mái, có tooltip mô tả rõ ràng.

---

## 4. HƯỚNG DẪN CHẠY THỬ VÀ KIỂM TRA MÃ NGUỒN CỤC BỘ

Nguyên mở terminal tại thư mục `frontend` và dùng các lệnh sau:

```bash
# 1. Chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt thư viện (nếu chưa cài)
npm install

# 3. Khởi chạy ứng dụng chạy thử
npm start
# -> Truy cập trình duyệt tại: http://localhost:4200/rooms

# 4. Kiểm tra mã nguồn có lỗi build không
npm run build
```

*Nếu gặp khó khăn về API hoặc cần hỗ trợ về giao diện, Nguyên cứ nhắn nhóm trưởng Tuấn Anh hỗ trợ ngay nhé!*
