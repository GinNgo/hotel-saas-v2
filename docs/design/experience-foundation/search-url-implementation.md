# Home search URL — 2026-10-18

## Scope

Lát cắt T009, không hoàn tất T008/T010/T011. Giữ API hiện có, không đổi tenant authority: `selectedTenantId` chỉ lọc kết quả discovery tại UI, không dùng làm authenticated tenant context.

## Acceptance và implementation

- Khôi phục thương hiệu, khoảng cách, ngân sách và sort từ query params; reset khi Back tới URL không có facet.
- Sidebar và smart chips đi chung đường serialize với search bar; reset ghi giá trị rỗng vào URL thay vì chỉ đổi signals.
- Khoảng cách/giá phải hữu hạn, không âm; ngân sách đảo min/max được bỏ; sort không hợp lệ về recommended.
- Khi stay URL không hợp lệ, tăng request generation, xóa kết quả/chips và kết thúc loading; response đang chờ không được ghi đè lỗi.
- Regression trong `frontend/src/app/features/public-booking/public-booking.page.spec.ts`: restore, serialize/reset, Back/invalid numeric values, late response sau invalid stay.

## Limitations

Chưa browser-QA Back/reload thực tế, GPS range/pair validation và same-URL resubmit chưa bổ sung. Không tuyên bố search toàn sàn theo availability hoặc server pagination. Fallback dữ liệu giả, gallery/dialog accessibility và layout vẫn ở các task tiếp theo. Không chạm DB, auth, payment, backend, commit hoặc deploy.

## Validation

- `npm --prefix frontend test -- --watch=false --include=src/app/features/public-booking/public-booking.page.spec.ts`: exit 0, 20/20 tests; chạy lại sau edits vẫn 20/20. Không có evidence red trước sửa vì lượt đầu build chậm và đã nhận source mới.
- `npm --prefix frontend run build`: exit 0; warning CommonJS `sweetalert2` có sẵn, không phải zero-warning build.
- Scoped `git diff --check` cho hai file source/test: exit 0.
