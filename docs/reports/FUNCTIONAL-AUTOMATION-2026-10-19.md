# Báo cáo automation chức năng — 19/10/2026

## Kết luận / findings

Chưa đạt regression gate: **347 tests pass, 1 fail / 348 tests**, 34 files pass và 1 file fail. Build thành công nhưng không đồng nghĩa các tính năng đã hoạt động end-to-end. Không sửa source ứng dụng trong vòng này.

### F01 — P1: Ưu đãi trên Home chưa nối luồng áp dụng vào đặt phòng

- Evidence UI: Home hiển thị WELCOME15, WEEKEND200, HOURLY99K, số lượt còn lại và đồng hồ đếm ngược như chương trình thật.
- Evidence source: `frontend/src/app/features/public-booking/components/flash-deals-banner/flash-deals-banner.component.ts:127` khai báo voucher tĩnh; `copyCode` chỉ chép clipboard và emit. Countdown khởi tạo lại từ 05:42:19 mỗi lần tạo component.
- `frontend/src/app/features/public-booking/booking.page.ts:1365`: `onApplyPromoCode` không có triển khai; không lưu hoặc chuyển mã sang checkout. Tìm trong Hold/public service/Public Application không thấy các trường coupon/promoCode/voucher tương ứng ở phạm vi đã khảo sát.
- Tác động: lấy mã không chứng minh mã được áp dụng; số lượng và thời hạn không lấy từ server. Không chạy giao dịch thật để kiểm giảm giá.
- Hướng sửa: ẩn chương trình chưa được hỗ trợ hoặc nối contract chương trình/quote đã duyệt; không giảm tiền chỉ ở frontend. Chưa tự mở scope API mới.

### F02 — P1: Modal phòng tự gán tiện nghi, khóa thông minh và cam kết còn phòng

- Bước tái hiện: mở Home fixture → “Xem chi tiết & chính sách phụ thu”. Fixture có `amenities: []`, không có bed/area/smart-lock/policy.
- Actual: modal vẫn hiện Smart Lock 24/7, giường tiêu chuẩn, điều hòa/nước nóng/wifi/máy sấy; nói cấp mã khóa sau cọc và đảm bảo 100% có phòng.
- Expected: chỉ hiển thị dữ liệu cơ sở cung cấp; thiếu dữ liệu phải thông báo chưa công bố. Discovery không bảo đảm availability.
- Source: `frontend/src/app/shared/components/room-detail-modal/room-detail-modal.component.ts:64`, `:111`, `:131`, `:160`, `:173`.
- Screenshot: `docs/design/experience-foundation/evidence/automation-room-claims-2026-10-19.png`.
- Unit modal hiện pass nhưng tập assertion không chặn các claim này. Đây là khoảng trống kiểm thử, không phải bằng chứng tính năng Smart Lock hoạt động.

### F03 — P1: Cam kết Home không được ràng buộc theo từng cơ sở

- Browser thấy khối “Cam kết dịch vụ” quảng bá cấp PIN/QR ngay sau đặt, miễn phí hủy trước 24 giờ, hoàn tiền ngân hàng tự động và không phụ thu bất ngờ.
- Source: `frontend/src/app/features/public-booking/components/trust-pillars/trust-pillars.component.ts:74`, `:83`, `:91`: nội dung tĩnh, không lấy chính sách cơ sở/quote/khả năng tích hợp.
- Khối bento cũng gắn giá khởi điểm và tiện nghi tĩnh; không phải kết quả truy vấn giá.
- Tác động: khách có thể hiểu chính sách áp dụng toàn sàn. Chưa kiểm hoặc xác nhận backend có hỗ trợ các cam kết này; lỗi được xác nhận là cách hiển thị không gắn dữ liệu thật.

### F04 — P2: “Homestay Gia Đình & Nhóm Bạn” lọc nhầm Guesthouse

- Bước: tại Home click đúng tile tiêu đề trên.
- Actual browser URL: `propertyTypes=Guesthouse`, `rentalType=Daily`.
- Expected: Homestay hoặc nhãn phản ánh chính xác Nhà nghỉ; không gắn sai loại hình.
- Root cause: `frontend/src/app/features/public-booking/components/curated-bento-grid/curated-bento-grid.component.ts:129` có tiêu đề Homestay nhưng `filterType: 'Guesthouse'` tại dòng 135.

### F05 — P2: Tile “Thuê Theo Giờ” không chuyển chế độ thuê

- Bước: đang Daily → click “Khách Sạn Trung Tâm & Thuê Theo Giờ”.
- Actual URL: vẫn `rentalType=Daily`, chỉ đổi `propertyTypes=Hotel`; giữ cả keyword Đà Lạt từ lần tìm trước dù tile quảng bá TP.HCM/Hà Nội.
- Root cause: tile chỉ emit filterType; handler `booking.page.ts:1369` gọi `selectStayTheme`, chỉ cập nhật propertyTypes.
- Expected: nhãn chỉ hứa lọc loại hình hoặc hành vi đổi đúng chế độ/ngữ cảnh mà tile mô tả.

### F06 — P2: Các tile bento không thao tác được bằng bàn phím

- DOM browser: cả bốn tile là DIV có click; không role, tabindex, button/link hoặc keyboard handler. Trong toàn `app-curated-bento-grid` có 0 button và 0 phần tử focusable chuẩn.
- Source: `frontend/src/app/features/public-booking/components/curated-bento-grid/curated-bento-grid.component.ts:39`.
- Regression test `booking-content.spec.ts:37` fail vì không còn native button `aria-label="Khám phá Homestay"`.
- Lưu ý: test cũ override bỏ child components, nên cần cập nhật test tích hợp khi component hóa; lỗi accessibility được xác nhận độc lập bằng DOM thật, không chỉ dựa selector test cũ.

### F07 — P2: Link quay lại từ Detail làm mất bộ lọc khám phá

- Home trước khi mở Detail có keyword Đà Lạt, sort price_desc và propertyTypes Hotel.
- Browser href “Quay lại tìm chỗ nghỉ” chỉ còn rentalType/ngày/giờ/duration/guests, mất keyword, propertyTypes và sort.
- Root cause: `frontend/src/app/features/public-booking/property-detail.page.ts:19` dùng `[queryParams]="stay()"` chỉ chứa lịch lưu trú.
- Expected: link quay lại khôi phục ngữ cảnh tìm kiếm. Finding này là link trong UI, không kết luận nút Back của trình duyệt cũng lỗi.

## Kết quả lệnh thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| `npm --prefix frontend test -- --watch=false` | exit 1; 347 pass, 1 fail / 348; 35 files |
| `npm --prefix frontend test -- --watch=false --include=src/app/features/public-booking/booking-content.spec.ts` | exit 1; 1 pass, 1 fail; tái hiện cùng lỗi native category button |
| `npm --prefix frontend run build` | exit 0; còn warning CommonJS sweetalert2 |

Ngày báo cáo theo Asia/Saigon: 19/10/2026. Timestamp runner xuất UTC hoặc timezone host có thể khác. Checkout develop, HEAD quan sát `5d0bfd6`, worktree có nhiều thay đổi chưa commit; kết quả bao gồm trạng thái worktree hiện tại, không chỉ HEAD. Không dùng lại kết quả 34 tests từ vòng trước thay cho kết quả mới.

## Browser automation đã kiểm

Dùng `node frontend/tools/ui-fixture-server.cjs`, chỉ bind 127.0.0.1:4319, phục vụ production build mới. Có fixture danh sách và chi tiết một cơ sở; API GET khác trả 503, mutations trả 405, không upstream. CSP chặn ảnh/font/connect bên ngoài; ảnh remote bị chặn trong fixture không được tính là lỗi production.

| Luồng | Quan sát |
| --- | --- |
| Home anonymous | Mở không ép đăng nhập; card hiển thị dữ liệu fixture |
| Tìm kiếm Đà Lạt | Nhập combobox, đóng gợi ý, bấm Tìm phòng; URL cập nhật destinationKeyword |
| Sort/reload | Chọn price_desc, reload; select vẫn price_desc |
| Bento | Tái hiện F04–F06; URL/DOM xác nhận |
| Modal phòng | Mở được, Escape đóng được; nội dung sai theo F02 |
| Detail | Điều hướng đúng cơ sở; availability không có API fixture, không kiểm happy path; link Back mất filter theo F07 |
| Profile anonymous | Hiện yêu cầu đăng nhập, đúng link portal=guest và returnUrl; không đăng nhập thật |
| Lookup | Form mở, nút tra cứu disabled khi token rỗng; không dùng token đặt phòng thật |
| AI failure path | Mở widget, gửi câu hỏi giả tới fixture; nhận thông báo kết nối gián đoạn, input được mở lại. 405 là do fixture chủ động chặn, không kết luận AI production hỏng |

Có một lần locator exact “Tìm phòng” không match vì accessible name chứa icon; đổi locator theo DOM snapshot và thao tác thành công. Không ghi lỗi automation locator thành lỗi sản phẩm.

## Tính năng chưa hoàn thiện / chưa chứng minh hoạt động

- **Chưa nối UI theo source:** Profile chỉnh sửa hồ sơ, lịch sử đặt phòng/hóa đơn tự động, hội viên/điểm thưởng. `member/guest-profile.page.ts` hiện thông báo chưa kết nối và chỉ đọc identity từ session. Không gọi đây là test failed vì chưa mở API contract và chưa đăng nhập thật trong browser.
- **Chưa kiểm end-to-end:** Google/Facebook xác minh token, đăng ký/đăng nhập thật; availability/quote thành công; giữ phòng, xác nhận/hủy, expiry và chống đặt trùng; VNPay/IPN/refund; cấp khóa/PIN thật; tenant isolation và phân quyền PMS/admin trên backend.
- Chưa chạy backend test toàn solution vì có các fixture real-database; không chạm DB dev/prod/staging. Không khẳng định backend test fail hay pass.
- Chưa kiểm mobile/zoom 200%/screen reader/đa trình duyệt hoặc các CRUD PMS. Unit tests mock HTTP không thay thế kiểm tích hợp dịch vụ thật.

## Ưu tiên xử lý

1. F01–F03: ngừng hiển thị ưu đãi/chính sách/tiện nghi chưa có evidence trước khi cho khách sử dụng.
2. F04–F06: sửa contract tile/semantics và thêm test tích hợp child components để tránh false green.
3. F07: giữ search context khi từ Detail trở về.
4. Bổ sung môi trường test cô lập có API/DB dùng một lần được duyệt để chạy happy path booking/payment sandbox/auth; không dùng dữ liệu thật.

Không commit, push, deploy, migrate hoặc khởi động lại automation định kỳ. Đây là phiên kiểm thử một lần theo yêu cầu.
