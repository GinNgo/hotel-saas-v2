# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM

---

# BÁO CÁO TIẾN ĐỘ CÁ NHÂN TUẦN 1
### ĐỀ TÀI: XÂY DỰNG HỆ THỐNG QUẢN LÝ KHÁCH SẠN (HOTEL SAAS PLATFORM)
- **Họ và tên:** [Họ và tên của Nguyên]
- **Mã số sinh viên (MSSV):** *[Điền MSSV của Nguyên]*
- **Vai trò trong nhóm:** Thành viên / Lập trình viên Frontend (Angular 22)
- **Phân hệ phụ trách:** Module Quản lý Danh mục Phòng (`Rooms`) & Hạng phòng (`Room Types`)
- **Đề tài hệ thống:** Topic 578 ([projects-fit.hcmute.edu.vn](https://projects-fit.hcmute.edu.vn/?view=student-mytopic&topic=578))
- **Giảng viên hướng dẫn (GVHD):** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
- **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
- **Nhánh làm việc chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop)
- **Nhánh tính năng cá nhân:** `feature/nguyen-rooms` (chuẩn bị Pull Request vào `develop`)
- **Tuần báo cáo:** Tuần 1 (Từ 03/10/2026 đến 10/10/2026)

---

## 1. MỤC TIÊU VÀ NHIỆM VỤ ĐƯỢC GIAO TRONG TUẦN 1
1. **Khảo sát đặc tả nghiệp vụ quản lý phòng:** Nghiên cứu tài liệu SRS và nghiệp vụ khách sạn thực tế về việc phân loại phòng theo tầng lầu, trạng thái phòng và thuộc tính loại phòng (sức chứa, giá cơ sở, diện tích).
2. **Xây dựng cấu trúc Models và Services TypeScript:** Khai báo đầy đủ các interface dữ liệu (`RoomDto`, `RoomTypeDto`) và viết dịch vụ HTTP Client gọi các endpoint backend (`/api/rooms`, `/api/room-types`).
3. **Hiện thực hóa giao diện Danh mục Phòng (`rooms.page.ts`):**
   - Thiết kế bảng dữ liệu hiển thị danh sách phòng vật lý theo chi nhánh đang chọn.
   - Tích hợp bộ lọc tầng lầu, bộ lọc trạng thái phòng và ô tìm kiếm số phòng với cơ chế debounce 300ms + `switchMap` chống nghẽn mạng và chống phản hồi muộn.
   - Thiết kế khung Modal Form thêm mới và chỉnh sửa phòng bằng `<p-dialog>`.
4. **Hiện thực hóa giao diện Hạng phòng (`room-types.page.ts`):** Xây dựng trang quản lý loại phòng (Standard, Deluxe, Suite...), hiển thị giá gốc và sức chứa tối đa.
5. **Đảm bảo khả năng tương thích Responsive:** Kiểm tra hiển thị giao diện co giãn tốt từ màn hình di động 360px đến màn hình máy tính 1440px.
6. **Kế thừa danh mục phòng từ đề tài cũ:** Rà soát và kế thừa 5 hạng phòng chuẩn (Single, Double, Twin, Family, Suite) từ kho lưu trữ cũ [He-thong-quan-ly-khach-san](https://github.com/GinNgo/He-thong-quan-ly-khach-san) (Commit `7e7ed12c`), đưa vào cấu trúc DTO mới của Angular 22 (chi tiết tại [`docs/legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md)).

---

## 2. MINH CHỨNG COMMIT TRÊN GITHUB CỦA NGUYÊN

| STT | Nhánh / Mã Commit | Thông Điệp Commit (Commit Message) | Nội Dung Chi Tiết Đã Commit Lên GitHub | Link Trực Tiếp Trên GitHub |
|:---:|---|---|---|:---:|
| 1 | `feature/nguyen-rooms`<br>*(Sẵn sàng tạo PR)* | `feat(rooms): scaffold room and room-type pages with services and models` | Xây dựng 2 trang giao diện `rooms.page.ts` và `room-types.page.ts`; tạo dịch vụ `room.service.ts` và `room-type.service.ts`; định nghĩa các interface `RoomDto`, `RoomTypeDto`, xử lý tìm kiếm debounce và modal thêm phòng. | [Xem nhánh feature](https://github.com/GinNgo/hotel-saas-v2/tree/develop/frontend/src/app/features/rooms) |
| 2 | Đóng góp vào `develop` (`677cd99`) | `feat: Phase 0 complete - docs, scaffold, entities, rules` | Cùng nhóm thiết lập cấu trúc mã nguồn ban đầu của thư mục `frontend/src/app/features/rooms` và tham gia thảo luận quy tắc phân loại phòng. | [677cd99](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99adee6f861886c521699fdc4dd8a1629db) |

---

## 3. BẢNG DANH MỤC FILE KẾT QUẢ ĐÃ ĐẨY LÊN GITHUB CỦA NGUYÊN

| Hạng Mục | Đường Dẫn File Cụ Thể Trong Repository | Mô Tả Chức Năng Của File | Link Trực Tiếp Tới File Trên GitHub |
|---|---|---|:---:|
| **Giao diện Quản lý Phòng** | `frontend/src/app/features/rooms/rooms.page.ts` | Component trang Quản lý danh sách phòng vật lý: hiển thị bảng danh sách phòng, cột trạng thái, tầng lầu, modal Thêm/Sửa phòng, xử lý phân trang và debounce tìm kiếm. | [rooms.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/rooms/rooms.page.ts) |
| **Giao diện Hạng phòng** | `frontend/src/app/features/room-types/room-types.page.ts` | Component trang Quản lý danh mục hạng phòng (Deluxe, Suite...): hiển thị bảng loại phòng, giá gốc niêm yết, sức chứa tối đa, diện tích và mô tả. | [room-types.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/room-types/room-types.page.ts) |
| **Dịch vụ API Phòng** | `frontend/src/app/core/services/room.service.ts` | Service Angular gọi API Backend cho Phòng: `getRooms(filter)` (lấy danh sách có phân trang và lọc), `createRoom()`, `updateRoom()`, `deleteRoom()`. | [room.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/room.service.ts) |
| **Dịch vụ API Hạng phòng** | `frontend/src/app/core/services/room-type.service.ts` | Service Angular gọi API Backend cho Loại phòng: `getRoomTypes()`, `createRoomType()`, `updateRoomType()`, `deleteRoomType()`. | [room-type.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/room-type.service.ts) |
| **Định nghĩa Kiểu Phòng** | `frontend/src/app/core/models/room.model.ts` | Khai báo các interface TypeScript: `RoomDto` (thông tin phòng), `CreateRoomRequest` (yêu cầu tạo phòng), `UpdateRoomRequest` (cập nhật phòng). | [room.model.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/models/room.model.ts) |
| **Định nghĩa Kiểu Hạng phòng** | `frontend/src/app/core/models/room-type.model.ts` | Khai báo các interface TypeScript: `RoomTypeDto` (mã phòng, tên hạng, giá gốc, sức chứa, tiện ích đi kèm). | [room-type.model.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/models/room-type.model.ts) |

---

## 4. TỰ ĐÁNH GIÁ VÀ KẾ HOẠCH TUẦN 2 CỦA NGUYÊN
- **Mức độ hoàn thành Tuần 1:** Hoàn thành khung giao diện, mô hình dữ liệu và dịch vụ API kết nối Backend cho 2 phân hệ `Rooms` và `Room Types`.
- **Kế hoạch Tuần 2:**
  - Hoàn thiện xử lý Validation form Thêm phòng: bắt buộc nhập số phòng, kiểm tra trùng số phòng trong cùng chi nhánh và hiển thị lỗi thân thiện (bắt mã 409 Conflict).
  - Tích hợp thông báo Toast thành công hoặc lỗi qua `AlertService`.
  - Đẩy nhánh `feature/nguyen-rooms` lên GitHub, tạo Pull Request vào `develop` để nhóm trưởng Tuấn Anh duyệt và merge tạo vết lịch sử đóng góp.
