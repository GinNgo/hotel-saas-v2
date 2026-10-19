# Kết quả vòng UI đầu — 2026-10-18

## Thay đổi

- Guest header giữ logo nền tảng, tra cứu, tài khoản, menu Khám phá; điểm đến/thương hiệu/ưu đãi/PMS/đối tác vẫn truy cập được. Mobile không nhồi hai cổng đăng nhập ngang cấp.
- Menu có aria-expanded, Escape trả focus; thêm skip link/focus-visible. Tài khoản dùng toSignal từ currentUser$ thay cho computed trên getter không reactive.
- Home nền sáng, thông điệp tìm nhiều chỗ nghỉ, tái sử dụng bộ lọc. Sidebar chỉ sticky ở desktop. Giữ API và luồng chọn/giữ phòng.
- Không tự gán điểm 4.8/128 đánh giá/hạng sao hoặc tạo hạng phòng mẫu khi thiếu dữ liệu. API rỗng giữ kết quả rỗng, API lỗi có Thử lại, không chèn khách sạn demo. Xóa helper demo mất người gọi.
- Bỏ giá hardcode trên điểm đến và cam kết toàn sàn miễn phí 10 phút/giá đã gồm thuế phí chưa được kiểm chứng.

## File của task

- frontend/src/app/layouts/guest-layout/guest-layout.ts và guest-layout.spec.ts
- frontend/src/app/features/public-booking/booking.page.ts và public-booking.page.spec.ts
- frontend/src/app/features/public-booking/components/popular-destinations/popular-destinations.component.ts
- docs/design/booking-marketplace/spec.md và implementation.md

Không sửa backend/API/schema/DB/payment/OAuth hoặc phần vận hành. Giữ thay đổi có sẵn của người khác; không commit/push.

## Kiểm chứng

- npm --prefix frontend test -- --watch=false --include='src/app/layouts/guest-layout/guest-layout.spec.ts' --include='src/app/features/public-booking/public-booking.page.spec.ts' --include='src/app/app.routes.spec.ts': 29/29 test, 3 file đạt. Là unit/router tests, không phải end-to-end đặt phòng thật.
- npm --prefix frontend run build: exit 0 sau dọn helper, 24.267 giây; còn cảnh báo CommonJS sweetalert2 hiện có.
- git diff --check giới hạn guest-layout và public-booking: đạt. Toàn repo có blank line EOF tại ReservationsController.cs ngoài task, không sửa.
- Detector chạy một lần: hai cảnh báo gray-on-color tại hover menu mới và badge cũ; không phải chứng nhận WCAG toàn trang.
- Preview static loopback 127.0.0.1:4319, /api trả mảng rỗng tổng hợp, không proxy/backend/DB. Screenshot desktop 1440px và mobile 375px; scrollWidth tại 375/768/1024px không vượt viewport. Sau sửa quan sát kết quả 0, không dữ liệu demo. Menu mobile có đủ liên kết.

## Giới hạn

- Chưa kiểm tra booking/quote/payment với dữ liệu thật hoặc visual card nhiều cơ sở bằng browser; test fixture kiểm tra logic lọc nhiều cơ sở không thay thế visual QA.
- Bộ lọc tái sử dụng vẫn có mô tả giờ mặc định; adapter phòng còn fallback giá/tiện nghi/ảnh. Cần rà soát public data mapping riêng trước phát hành, không coi fallback là contract nghiệp vụ.
- Danh mục điểm đến/ảnh hiện có là nội dung biên tập, không phải thống kê toàn sàn; chưa thêm CMS hoặc white-label.
- Không chỉnh Canva vì chưa có design ID/connector.
