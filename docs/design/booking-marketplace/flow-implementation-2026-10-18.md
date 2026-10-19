# Search → Detail → Hold → Profile: kết quả triển khai

## Phạm vi đã thay đổi

- Bộ lọc: đóng dropdown khi click/focus ra ngoài, Escape, điều hướng gợi ý bằng phím; xóa GPS cũ khi đổi điểm đến, chặn ngày/số khách không hợp lệ. Không cam kết giờ nhận/trả cố định cho mọi khách sạn.
- Home giữ lịch/số khách trong link chi tiết và URL tìm kiếm; gợi ý điểm đến không giữ GPS/slug cũ. Request cũ không ghi đè kết quả mới. Nút chọn phòng từ modal dùng property ID thay vì tên dễ trùng.
- Detail tải cơ sở thật, kiểm tra availability theo lịch và sức chứa; báo giá từ server. Đổi lịch làm mất hiệu lực quote và bỏ response cũ. Chỉ chuyển tiếp khi có quote chưa hết hạn; gallery dùng ảnh của cơ sở.
- Hold không tạo token/giá giả, không tự xác nhận booking. Payload dùng số khách, ngày đã chọn, enum Daily=3 và giờ theo cấu hình cơ sở/múi giờ Việt Nam. Retry giữ idempotency key; lỗi không điều hướng như thành công. Token/expiry lấy từ server.
- Profile hiển thị identity session thật, xử lý anonymous/staff riêng và không giữ danh tính tài khoản trước khi logout. Không hiển thị hóa đơn, điểm hay thông tin khách mẫu. Lịch sử/edit/loyalty chưa có API nên mô tả rõ chưa hỗ trợ.
- Service availability chuẩn hóa tên trường backend thực tế; quote chỉ gọi POST /public/quotes, không fallback sang route không có contract. Không trả review/chính sách phí giả.
- Contract API tài khoản mới nằm ở guest-account-api.md; là thiết kế, chưa có endpoint chạy được.

## Kiểm chứng

- Angular unit tests: 51/51 đạt, 6 file: public-booking.page.spec.ts, property-detail.page.spec.ts, guest-profile.page.spec.ts, booking-filter-bar.component.spec.ts, public-stay-context.spec.ts, public-booking.service.spec.ts.
- Các hành vi được kiểm gồm khoảng lưu trú qua đêm, sức chứa, quote từ server/quote lỗi hoặc hết hạn, response quote muộn, retry hold, identity A/logout/B, dropdown ngoài vùng và keyboard, payload availability thực tế.
- npm --prefix frontend run build sau thay đổi cuối: exit 0, 16.061 giây; còn warning CommonJS sweetalert2 có sẵn.
- git diff --check giới hạn public-booking và public-booking service: exit 0, có thông báo chuẩn hóa LF/CRLF, không lỗi whitespace.
- Không chạy backend/DB, payment, migration, commit/push/deploy. Không tính test doubles thành evidence end-to-end hoặc coverage. Chưa visual QA lại toàn bộ Detail/Hold/Profile bằng browser sau vòng này.

## Giới hạn và backlog cần giữ

- GET discovery properties chưa nhận ngày/số khách để kiểm tra tồn phòng toàn sàn; UI đã nói rõ kiểm tra tại Detail. Không dùng N+1 request toàn sàn để che thiếu contract. Nếu cần lọc availability trực tiếp trong kết quả, thiết kế bulk API riêng.
- Adapter card/room legacy trên Home còn fallback metadata, ảnh, giá và một số tiện nghi khi DTO thiếu; chưa được coi là nguồn dữ liệu đáng tin để phát hành. Detail/Hold không dùng các fallback đó để tính tiền. Cần chuẩn hóa nullable DTO và render trạng thái thiếu ở card/modal, không lấy giá demo làm quote.
- Sort/sidebar là bộ lọc cục bộ trên tập cơ sở tải về; chưa có server pagination/sort contract đầy đủ. Chưa bảo toàn toàn bộ trạng thái sidebar qua reload/Back.
- Profile mới hoàn thiện tính trung thực của dữ liệu/session, chưa hoàn thiện lịch sử, đổi email/phone, hóa đơn hoặc loyalty. Cần review ownership cross-tenant trong thiết kế trước triển khai.
- Social login/payment có thay đổi có sẵn ngoài phạm vi: kết quả vòng này không chứng nhận chúng an toàn hay hoạt động. Không gọi thanh toán thực hoặc lấy token bằng ID/email tự khai để làm bằng chứng.
- Không crawl/copy dữ liệu khách hàng từ website bên ngoài, không sửa Canva vì chưa có design ID. Không có báo cáo SUS/user testing hay số liệu conversion.
