# Nguyên — Đặc tả nghiệp vụ Admin: Phòng và Loại phòng

Ngày giao: 10/10/2026 | Ticket: TEAM-NGUYEN-01 | Trạng thái: Ready, chưa nghiệm thu
Owner: Nguyên | Review chéo: Tân | Review cuối: Codex

## 1. Mục tiêu và phạm vi

Hoàn thiện trải nghiệm quản lý Phòng/Loại phòng trên admin bằng API thật hiện có. Đây là phần cải tiến module đã có code, không phải xây lại CRUD và không phải tuyên bố toàn bộ admin hoàn thành. Nguyên kiểm tra luồng frontend đến backend; ưu tiên sửa lỗi thực tế ở hai feature, không mở thêm API/schema.

Actor: nhân viên có quyền tương ứng tại chi nhánh đang chọn. Không có Tenant/Property context phải từ chối; không dùng dữ liệu chi nhánh trước làm dữ liệu chi nhánh mới.

## 2. Use case và quy tắc nghiệp vụ

| ID | Use case | Yêu cầu |
|---|---|---|
| NG-01 | Xem danh sách | Giữ phân trang/lọc phía server của Rooms; tìm kiếm, loại phòng, tầng, trạng thái và ngày dùng contract hiện có. Không tải hết để lọc tại client. RoomTypes chỉ dùng khả năng API đang hỗ trợ. |
| NG-02 | Thêm phòng/loại phòng | Form theo DTO/validator hiện tại; báo lỗi cạnh trường, không mất dữ liệu nhập khi API lỗi. Không tự đổi ràng buộc số phòng/mã hoặc giá. |
| NG-03 | Sửa | Nạp đúng bản ghi; giữ input khi 409/validation error; không gửi nhiều lần khi đang lưu. |
| NG-04 | Xóa | Xác nhận rõ tên đối tượng, Hủy không gọi API; chỉ báo thành công sau response thành công. Không đổi hard/soft delete hoặc bỏ kiểm tra liên kết. |
| NG-05 | Dùng trên mobile | Form, bảng và phân trang dùng được ở 360/390/768/1024/1440px; bảng rộng cuộn trong container, không tràn toàn trang. |
| NG-06 | Trợ năng | Label liên kết input; icon có accessible name; keyboard mở/đóng form, focus hợp lý và quay về nút mở khi đóng. |

Ngày hiển thị theo Việt Nam; giữ util/date filter hiện có và biên ngày UTC+7. Không tự thêm lọc giờ vào bộ lọc chỉ ngày. Không dùng BasePrice làm fallback cho quote hoặc xây rates trong task này.

## 3. API và quyền đã đối chiếu source

| Endpoint | Quyền |
|---|---|
| GET /api/rooms và /api/rooms/{id} | ROOMS.Read |
| POST /api/rooms | ROOMS.Create |
| PUT /api/rooms/{id} | ROOMS.Update |
| DELETE /api/rooms/{id} | ROOMS.Delete |
| GET /api/room-types và /api/room-types/{id} | ROOM_TYPES.Read |
| POST /api/room-types | ROOM_TYPES.Create |
| PUT /api/room-types/{id} | ROOM_TYPES.Update |
| DELETE /api/room-types/{id} | ROOM_TYPES.Delete |

Ẩn/disable hành động theo quyền; backend vẫn là lớp kiểm tra quyết định. Khi 403 không báo lỗi mạng; khi 409 giải thích xung đột theo mã lỗi thật, không tự suy đoán mọi 409 là trùng mã.

## 4. Checklist triển khai

- [ ] NG-01: xác minh danh sách, filter/reset/paging và đổi chi nhánh không hiển thị dữ liệu cũ.
- [ ] NG-02/03: sửa lỗi form, validation, trạng thái saving và thông báo theo response.
- [ ] NG-04: xác minh xác nhận xóa, Hủy, lỗi liên kết/xung đột và refresh danh sách.
- [ ] NG-05: kiểm tra padding/margin, text dài, modal scroll/footer, zoom 200%.
- [ ] NG-06: kiểm tra keyboard, focus, label, icons; không thêm thư viện.
- [ ] Thêm test hành vi nếu sửa hành vi; lưu screenshots thật desktop/mobile và lỗi đã sửa.

Source chính: `frontend/src/app/features/rooms/rooms.page.ts`, `frontend/src/app/features/room-types/room-types.page.ts`. Đối chiếu `backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs` và `RoomTypesController.cs`, DTO/validator/handler tương ứng trước sửa. Shared components/auth/layout và backend ngoài scope phải phối hợp owner trước; không làm trùng Pricing của Antigravity.

## 5. Tiêu chí nghiệm thu

| ID | Given / When / Then | Evidence cần nộp |
|---|---|---|
| AC-NG-01 | Có dữ liệu nhiều trang; đổi filter → page reset hợp lệ, kết quả theo API | Test hoặc thao tác trình duyệt ghi rõ dữ liệu test |
| AC-NG-02 | Form hợp lệ; lưu → chỉ một request và dữ liệu được refresh sau thành công | Test chống double-submit và kết quả API |
| AC-NG-03 | API trả validation/409 → input được giữ, lỗi rõ; không toast thành công | Test hoặc evidence lỗi thật |
| AC-NG-04 | Xác nhận xóa; chọn Hủy → không có DELETE | Test hoặc network evidence |
| AC-NG-05 | Thiếu quyền → không có thao tác trái quyền; backend từ chối nếu gọi trực tiếp | Test quyền an toàn |
| AC-NG-06 | Viewport 360px/zoom 200% → không overflow toàn trang; thao tác được bằng keyboard | Screenshots và checklist thủ công |

## 6. Bàn giao để báo cáo

Lưu báo cáo tại `docs/team/reports/TEAM-NGUYEN-01.md`; ảnh tại `docs/team/assets/screenshots/` với prefix `nguyen-`. Báo cáo gồm: mục tiêu; hiện trạng trước sửa; phần cá nhân thực hiện; files/diff; mapping NG-ID → file → test/ảnh; command kiểm tra có thật và exit code; kết quả; hạn chế; hướng dẫn sử dụng ngắn. Ghi chính xác phần kế thừa, không nhận toàn bộ CRUD có sẵn là code cá nhân.

Ready khi đọc contract và xác nhận không trùng owner. Hoàn tất chuyển In Review, Tân review chéo rồi Codex xác nhận; không tự đánh Done. Không commit/deploy/migrate hoặc thử phá dữ liệu DB dev/staging/prod. Thiếu tài khoản/quyền/test data thì ghi blocker; không đưa mật khẩu/token vào báo cáo.
