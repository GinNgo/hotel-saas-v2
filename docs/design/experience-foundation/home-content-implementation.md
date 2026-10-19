# Home content — 18/10/2026

## Phạm vi đã sửa

- Hero không còn số lượng 500+, cam kết Smart Lock hoặc nhãn thịnh hành không có evidence.
- Thay các tile ảnh minh họa gắn sai tiện nghi bằng nút loại hình Hotel, Resort, Homestay, Guesthouse. Nút native hỗ trợ keyboard, focus-visible, aria-pressed và áp dụng propertyTypes qua luồng filter hiện có; giữ điểm đến hiện tại.
- Footer dùng nhãn Tài khoản khách hàng, không quảng bá ví điểm, hóa đơn hoặc tồn kho thời gian thực.
- Không đổi API, schema, quyền hoặc tích hợp; không chạy backend, DB, thanh toán, migration hay deploy.

## Validation thực tế

- Regression nội dung mới từng RED: 3 fail, 4 pass theo vòng trước sửa.
- `npm --prefix frontend test -- --watch=false --include=src/app/features/public-booking/booking-content.spec.ts --include=src/app/features/public-booking/public-booking.page.spec.ts --include=src/app/features/public-booking/property-detail.page.spec.ts --include=src/app/layouts/guest-layout/guest-layout.spec.ts`: 34 tests / 4 files pass.
- `npm --prefix frontend run build`: exit 0; còn warning CommonJS sweetalert2 hiện có.
- `git diff --check -- frontend/src/app/features/public-booking/booking.page.ts frontend/src/app/layouts/guest-layout/guest-layout.ts`: exit 0.

## Giới hạn / tiếp theo

Chưa browser-QA hàng nút mới, chưa kiểm zoom 200%, contrast hoặc screen reader. Native semantics không tương đương chứng nhận accessibility. Còn audit các route ưu đãi, nội dung điểm đến và trợ lý AI; T008 vẫn mở. Không có file thiết kế Canva được tạo ở vòng này.
