# Gallery hardening — 2026-10-18

## Phạm vi T010

- Giữ component dùng chung ở Home và Detail, không thêm dependency/API.
- Input photos cập nhật signal, computed currentPhoto không còn giữ ảnh cũ khi dữ liệu async thay đổi mà index vẫn bằng 0.
- Index được giới hạn theo danh sách hiện tại; chặn index âm/NaN/ngoài danh sách và thao tác navigation/close khi modal đóng.
- Keyboard chỉ xử lý trong dialog đang mở thay vì document listener; ArrowLeft/Right wrap, Escape đóng, chặn propagation cho phím đã xử lý. Không bắt modifier shortcuts.
- Dùng CDK A11y focus trap/auto capture giống room modal; initial focus ở nút đóng, target 44px. Thumbnail có accessible name/current state và focus outline.
- Empty state không còn “Ảnh 1 / 0”; URL trống bị bỏ. Ảnh tải lỗi có thông báo và vẫn chuyển ảnh khác được; không lấy ảnh stock bù vào. Counter aria-live, reduced-motion cho animation của component.

## Evidence

- Trước sửa: 4/4 regression fail (stale computed, index khi list co lại, event khi đóng, empty/selected semantics).
- Sau sửa: `npm --prefix frontend test -- --watch=false --include=src/app/shared/components/photo-gallery-modal/photo-gallery-modal.component.spec.ts --include=src/app/shared/components/room-detail-modal/room-detail-modal.component.spec.ts --include=src/app/features/public-booking/public-booking.page.spec.ts --include=src/app/features/public-booking/property-detail.page.spec.ts`: exit 0, 38/38 tests trong 4 files.
- Hai test bổ sung kiểm dialog-local arrows/Escape và error image → ảnh kế tiếp.
- `npm --prefix frontend run build`: exit 0, còn warning CommonJS sweetalert2 có sẵn. Scoped `git diff --check`: exit 0.

## Limitations

Chưa browser-QA focus cycling/restore, mobile/desktop, zoom hoặc đo contrast. CDK configuration + unit DOM không phải bằng chứng browser accessibility hoàn chỉnh; T010 giữ mở tới lượt kiểm browser. Photo-error state kiểm ảnh chính, thumbnail lỗi chưa có placeholder riêng. Không backend/DB/payment/migration/deploy/commit/push; không Canva artifact.
