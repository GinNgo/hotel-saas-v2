# TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH
## KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM

---

# BÁO CÁO TIẾN ĐỘ CÁ NHÂN TUẦN 1
### ĐỀ TÀI: XÂY DỰNG HỆ THỐNG QUẢN LÝ KHÁCH SẠN (HOTEL SAAS PLATFORM)
- **Họ và tên:** [Họ và tên của Tân]
- **Mã số sinh viên (MSSV):** *[Điền MSSV của Tân]*
- **Vai trò trong nhóm:** Thành viên / Lập trình viên Frontend (Angular 22)
- **Phân hệ phụ trách:** Module Quản lý Buồng phòng & Trạng thái phòng (`Housekeeping Board`)
- **Đề tài hệ thống:** Topic 578 ([projects-fit.hcmute.edu.vn](https://projects-fit.hcmute.edu.vn/?view=student-mytopic&topic=578))
- **Giảng viên hướng dẫn (GVHD):** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
- **Kho lưu trữ GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
- **Nhánh làm việc chính:** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop)
- **Nhánh tính năng cá nhân:** `feature/tan-housekeeping` (chuẩn bị Pull Request vào `develop`)
- **Tuần báo cáo:** Tuần 1 (Từ 03/10/2026 đến 10/10/2026)

---

## 1. MỤC TIÊU VÀ NHIỆM VỤ ĐƯỢC GIAO TRONG TUẦN 1
1. **Nghiên cứu quy trình buồng phòng khách sạn thực tế:** Tìm hiểu vòng đời trạng thái buồng phòng từ khi khách trả phòng (`Dirty` - Bẩn), nhân viên bắt đầu dọn (`Cleaning` - Đang dọn) đến khi hoàn tất kiểm tra sạch sẽ (`Clean` - Sẵn sàng đón khách mới).
2. **Xây dựng mô hình trạng thái (State Machine):** Khai báo các Enum và cấu trúc màu sắc tương ứng (`Clean`, `Dirty`, `Cleaning`, `Occupied`, `Out of Service`) trong `enums.ts` để hiển thị trực quan cho nhân viên dọn phòng.
3. **Hiện thực hóa giao diện Bảng Buồng phòng (`housekeeping.page.ts`):**
   - Thiết kế bảng quản lý theo thời gian thực hiển thị danh sách phòng, số phòng, tầng lầu và trạng thái hiện tại.
   - Thống kê trực quan các thẻ KPI (số lượng phòng Bẩn, phòng Đang dọn, phòng Sạch) ngay trên đầu trang.
   - Tích hợp bộ lọc theo tầng lầu và bộ lọc trạng thái buồng phòng.
4. **Tích hợp API cập nhật trạng thái phòng một chạm:** Gọi `PATCH /api/rooms/{id}/status` kèm tham số `expectedOldStatus` để bảo đảm tính toàn vẹn trạng thái và xử lý chống xung đột đồng thời 409 (`ERR_STALE_STATE`) khi nhiều nhân viên cùng thao tác.
5. **Xây dựng các component dùng chung:** Hiện thực hóa component phân trang `pagination.component.ts` và hiệu ứng tải bảng dạng khung xương `skeleton-table` chống nhấp nháy giao diện.
6. **Kế thừa quy trình buồng phòng từ đề tài cũ:** Rà soát vòng đời buồng phòng từ kho lưu trữ cũ [He-thong-quan-ly-khach-san](https://github.com/GinNgo/He-thong-quan-ly-khach-san) (Commit `7e7ed12c`), nâng cấp máy trạng thái (State Machine) lên cơ chế kiểm soát đồng thời chống xung đột 409 (chi tiết tại [`docs/legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md)).

---

## 2. MINH CHỨNG COMMIT TRÊN GITHUB CỦA TÂN

| STT | Nhánh / Mã Commit | Thông Điệp Commit (Commit Message) | Nội Dung Chi Tiết Đã Commit Lên GitHub | Link Trực Tiếp Trên GitHub |
|:---:|---|---|---|:---:|
| 1 | `feature/tan-housekeeping`<br>*(Sẵn sàng tạo PR)* | `feat(housekeeping): scaffold housekeeping board with state machine and pagination` | Xây dựng trang giao diện `housekeeping.page.ts`; định nghĩa Enum trạng thái `RoomStatus`; tích hợp hàm `updateRoomStatus` trong `room.service.ts`; xây dựng component `pagination` và `skeleton-table`. | [Xem nhánh feature](https://github.com/GinNgo/hotel-saas-v2/tree/develop/frontend/src/app/features/housekeeping) |
| 2 | Đóng góp vào `develop` (`677cd99`) | `feat: Phase 0 complete - docs, scaffold, entities, rules` | Cùng nhóm thảo luận nghiệp vụ máy trạng thái buồng phòng và thiết lập cấu trúc mã nguồn ban đầu của thư mục `frontend/src/app/features/housekeeping`. | [677cd99](https://github.com/GinNgo/hotel-saas-v2/commit/677cd99adee6f861886c521699fdc4dd8a1629db) |

---

## 3. BẢNG DANH MỤC FILE KẾT QUẢ ĐÃ ĐẨY LÊN GITHUB CỦA TÂN

| Hạng Mục | Đường Dẫn File Cụ Thể Trong Repository | Mô Tả Chức Năng Của File | Link Trực Tiếp Tới File Trên GitHub |
|---|---|---|:---:|
| **Giao diện Buồng phòng** | `frontend/src/app/features/housekeeping/housekeeping.page.ts` | Component bảng điều hành buồng phòng: hiển thị bảng trạng thái phòng theo tầng, thanh thống kê KPI trên trang, các nút bấm thao tác một chạm (Bắt đầu dọn, Hoàn tất dọn). | [housekeeping.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/housekeeping/housekeeping.page.ts) |
| **Máy trạng thái (Enum)** | `frontend/src/app/core/models/enums.ts` | Khai báo Enum `RoomStatus` (`Clean = 1`, `Dirty = 2`, `Cleaning = 3`, `Occupied = 4`, `OutofService = 5`) và mapping màu sắc / nhãn tiếng Việt `ROOM_STATUS_LABELS`. | [enums.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/models/enums.ts) |
| **API Cập nhật Trạng thái** | `frontend/src/app/core/services/room.service.ts#L48` | Phương thức `updateRoomStatus(id, newStatus, expectedOldStatus)` gửi yêu cầu PATCH lên backend kèm trạng thái cũ kỳ vọng để kiểm soát concurrency. | [room.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/room.service.ts) |
| **Component Phân trang** | `frontend/src/app/shared/components/pagination/pagination.component.ts` | Component phân trang dùng chung cho giao diện, hỗ trợ chuyển trang, hiển thị tổng số bản ghi và số lượng bản ghi mỗi trang. | [pagination.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/shared/components/pagination/pagination.component.ts) |
| **Component Khung xương** | `frontend/src/app/shared/components/skeleton-table/skeleton-table.component.ts` | Component hiển thị hiệu ứng skeleton mượt mà trong lúc chờ nạp dữ liệu từ backend, nâng cao trải nghiệm người dùng (UX). | [skeleton-table](https://github.com/GinNgo/hotel-saas-v2/tree/develop/frontend/src/app/shared/components/skeleton-table) |

---

## 4. TỰ ĐÁNH GIÁ VÀ KẾ HOẠCH TUẦN 2 CỦA TÂN
- **Mức độ hoàn thành Tuần 1:** Hoàn thành khung bảng buồng phòng, tích hợp gọi API cập nhật trạng thái phòng kèm máy trạng thái và các component tái sử dụng (Phân trang, Skeleton Table).
- **Kế hoạch Tuần 2:**
  - Hoàn thiện xử lý lỗi xung đột 409 `ERR_STALE_STATE`: Khi người khác đã đổi trạng thái phòng trước, tự động hiện Toast thông báo và nạp lại bảng dữ liệu mới nhất.
  - Thêm hiệu ứng khóa nút bấm (disable) khi request đang xử lý để chống nhân viên click đúp liên tục.
  - Tối ưu giao diện buồng phòng trên màn hình điện thoại di động (Mobile 375px) để nhân viên dọn phòng thao tác tiện lợi trên điện thoại.
  - Đẩy nhánh `feature/tan-housekeeping` lên GitHub, tạo Pull Request vào `develop` để nhóm trưởng Tuấn Anh duyệt và merge tạo vết lịch sử đóng góp.
