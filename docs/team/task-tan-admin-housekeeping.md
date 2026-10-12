# Tân — Đặc tả nghiệp vụ Admin: Vận hành buồng phòng

Ngày giao: 10/10/2026 | Ticket: TEAM-TAN-01 | Trạng thái: Ready, chưa nghiệm thu
Owner: Tân | Review chéo: Nguyên | Review cuối: Codex

## 1. Mục tiêu và phạm vi

Hoàn thiện màn hình Housekeeping để nhân viên theo dõi và cập nhật trạng thái dọn phòng an toàn, kể cả nhiều trang dữ liệu/mobile/mạng lỗi. Module đã có server paging và latest-request-wins được review; không viết lại phần đó. Tân kiểm tra cả luồng API/backend, nhưng sửa mặc định trong feature Housekeeping.

Actor: nhân viên chi nhánh có ROOMS.Read để xem và ROOMS.Update để đổi trạng thái theo endpoint hiện tại. Không tự tạo quyền HOUSEKEEPING thay thế backend contract. Thiếu context Tenant/Property phải fail-closed.

## 2. Use case và quy tắc nghiệp vụ

| ID | Use case | Yêu cầu |
|---|---|---|
| TA-01 | Xem/lọc danh sách | GET /api/rooms, paging và filter search/status/floor phía server; reset page khi đổi filter theo logic hiện có. |
| TA-02 | Xem KPI | Ghi rõ số liệu trên trang hiện tại, không trình bày như tổng toàn khách sạn khi chưa có aggregate API. |
| TA-03 | Dọn phòng | PATCH /api/rooms/{id}/status gửi status và expectedOldStatus theo DTO thật. Backend validator/state machine quyết định transition hợp lệ. |
| TA-04 | Xử lý tranh chấp | 409: không ghi đè trạng thái mới của người khác; giải thích và tải lại dữ liệu, không retry mutation mù. |
| TA-05 | Lỗi/tải/rỗng | Loading, empty, error, retry phân biệt rõ; thất bại không giả thành danh sách rỗng hoặc thành công. |
| TA-06 | Dùng mobile | Bảng, nút trạng thái, phân trang thao tác được ở 360–1440px; không tràn toàn trang. |

Dirty → Cleaning → Clean chỉ theo transition backend cho phép, không tự nới FSM. Occupied thuộc check-in/out, không cho đổi trực tiếp qua dọn phòng. Không giả checkout thành Clean. Khi đang mutation, khóa thao tác lặp trên phòng đó và giải phóng khóa ở cả success/error.

Danh sách tầng hiện tại chưa chứng minh bao phủ toàn bộ chi nhánh. Không ghi dropdown là danh sách đầy đủ. Nếu cần, dùng ô nhập tầng với validation theo contract hiện có; không thêm endpoint summary/schema cho task này.

## 3. Luồng xử lý cần hoàn thiện

1. Vào màn hình với context hợp lệ: hiện loading rồi danh sách hoặc lỗi có nút thử lại.
2. Chọn filter/page: giữ cơ chế switchMap hiện có; response cũ không được ghi đè response mới.
3. Chọn hành động hợp lệ: gửi expectedOldStatus từ bản ghi đang xem, disable thao tác lặp.
4. Thành công: refresh dữ liệu theo filter hiện tại, cập nhật KPI của trang; nếu trang cuối hết dữ liệu thì về trang hợp lệ bằng truy vấn mới, không lặp vô hạn.
5. Thất bại: giữ thông tin đủ để thao tác lại; 403 báo thiếu quyền, 409 báo dữ liệu thay đổi, lỗi mạng cho retry tải danh sách; không tự gửi lại PATCH.
6. Đổi chi nhánh: không giữ dữ liệu chi nhánh cũ như dữ liệu mới; không gửi mutation sang context mới bằng bản ghi cũ.

## 4. Checklist triển khai

- [ ] TA-01/02: kiểm tra trang 2, filter/reset, page size và nhãn KPI trên trang.
- [ ] TA-03: actions theo quyền/transition, disable mutation và unlock khi lỗi.
- [ ] TA-04: kiểm tra stale status 409 và refresh không ghi đè.
- [ ] TA-05: loading/empty/error/retry; trang cuối rỗng sau mutation với filter.
- [ ] TA-06: pagination wrap, spacing, text dài, icons/aria-label, keyboard và zoom 200%.
- [ ] Bổ sung tests hành vi cần thiết; không làm lại luồng request đã Approved.

Source: `frontend/src/app/features/housekeeping/housekeeping.page.ts` và `housekeeping.page.spec.ts`; đối chiếu `backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs` cùng status command/validator/handler hiện tại. Không sửa Rooms/RoomTypes UI của Nguyên, Pricing của Antigravity hoặc shared auth/layout khi chưa phối hợp.

## 5. Tiêu chí nghiệm thu

| ID | Given / When / Then | Evidence cần nộp |
|---|---|---|
| AC-TA-01 | Có nhiều trang; chuyển trang/lọc → API nhận paging/filter đúng, KPI ghi phạm vi trang | Test và screenshot |
| AC-TA-02 | Request đang tải → có loading; API lỗi → error/retry, không empty giả | Tests state và retry |
| AC-TA-03 | Bấm đổi trạng thái liên tiếp → không phát mutation trùng; lỗi → nút hoạt động lại | Test mutation locking |
| AC-TA-04 | Trạng thái bị đổi trước → 409 được xử lý; không overwrite hoặc toast thành công | Test conflict |
| AC-TA-05 | Trang cuối mất bản ghi cuối sau đổi status → trở về trang hợp lệ, không loop | Test empty-page recovery |
| AC-TA-06 | User chỉ có Read → xem được, không đổi status; Occupied không đổi trực tiếp | Test quyền/transition |
| AC-TA-07 | Mobile 360px/zoom 200% → không overflow toàn trang; buttons có tên và dùng keyboard được | Screenshots/checklist |

## 6. Bàn giao để báo cáo

Lưu báo cáo tại `docs/team/reports/TEAM-TAN-01.md`; ảnh tại `docs/team/assets/screenshots/` với prefix `tan-`. Nội dung: mục tiêu; hiện trạng; use case và state flow; phần cá nhân thực hiện; files/diff; mapping TA-ID → file → test/ảnh; commands thực tế/exit code; kết quả; hạn chế; hướng dẫn nhân viên lọc phòng/đổi trạng thái/xử lý lỗi. Phân biệt phần paging/switchMap kế thừa và phần cá nhân sửa.

Ready khi đọc API/FSM và xác nhận không trùng owner. Hoàn tất chuyển In Review, Nguyên review chéo rồi Codex nghiệm thu; không tự Done. Test backend chỉ môi trường cô lập đã kiểm tra an toàn. Không commit/deploy/migrate hoặc chạm DB dev/staging/prod; không ghi secrets vào tài liệu. Transition/quyền/API chưa rõ phải ghi blocker, không tự mở rộng nghiệp vụ.
