# Discovery modal và nội dung Home — 2026-10-18

## Thay đổi

- Room modal không tự tạo ảnh stock, giường King/Queen, diện tích 32m², hướng nhìn, mô tả cao cấp, giờ nhận/trả, thời hạn giữ 15 phút hoặc chính sách hủy 24 giờ.
- Discovery không xác nhận còn/hết phòng theo lịch: dùng copy kiểm tra ở bước đặt phòng. Chọn phòng chỉ tiếp tục tới luồng kiểm tra/quote hiện có, không phải giữ chỗ thành công. Thiếu roomTypeId hoặc modal đóng thì không emit selection.
- Giá tham khảo truyền từ Home theo mode đã chọn, không đọc estimatedPrice khác ngữ cảnh; thiếu giá hiển thị chưa công bố. Hiển thị ảnh/tiện nghi thật trong DTO khi có.
- Dùng CDK A11y có sẵn để trap focus/auto capture và restore khi dialog bị hủy; Escape đóng và không bubble ra ngoài. Accessible name có fallback tên phòng; close target 44px; footer xếp dọc trên màn nhỏ. OnPush, không dependency mới.
- Xóa section Flash Sale/voucher/timer tĩnh, Rewards Club với claim điểm/hoàn tiền/smart lock/bảo đảm có phòng, và testimonials cố định. Xóa clipboard handler/state/AlertService injection mồ côi. Không thay chúng bằng claim hoặc khách hàng mẫu khác.

## Verification

- Regression trước sửa: 2/3 modal tests fail vì ảnh Unsplash fallback và emit selection khi đóng/thiếu ID.
- Sau sửa: `npm --prefix frontend test -- --watch=false --include=src/app/shared/components/room-detail-modal/room-detail-modal.component.spec.ts --include=src/app/features/public-booking/public-booking.page.spec.ts --include=src/app/features/public-booking/property-detail.page.spec.ts`: exit 0, 32/32 tests, 3 files.
- Tests kiểm missing content, ảnh/amenities thật, Escape và event guards; chưa chứng minh browser focus cycling/restore chỉ bằng test Escape.
- `npm --prefix frontend run build`: exit 0; còn warning CommonJS sweetalert2 có sẵn. Scoped `git diff --check` cho source và test thay đổi: exit 0.

## Limitations và bước tiếp

Chưa browser-QA mobile/desktop/focus restore hoặc đo contrast vòng này. Photo-gallery modal chưa harden; T010 chưa hoàn tất. Các khối theme/destination và promotion route/service khác chưa được chứng nhận bằng audit vòng này. T008 chưa đóng toàn bộ site. Giữ guest-account API ở gate riêng; không backend/DB/payment/migration/deploy/commit/push, không file Canva.
