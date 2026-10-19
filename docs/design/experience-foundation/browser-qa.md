# Browser QA — 2026-10-18

## Cô lập môi trường

`node frontend/tools/ui-fixture-server.cjs` phục vụ production bundle sau `npm --prefix frontend run build`, bind riêng 127.0.0.1:4319. API discovery/detail dùng fixture đánh dấu rõ; endpoint khác trả 503, mutations trả 405, không proxy upstream. Đã kiểm POST /api/public/quotes → 405, GET /api/unconfigured → 503. CSP chỉ cho ảnh/font/connect cùng origin và data images; inline script chỉ phục vụ stylesheet loader của Angular production. Đây là server test local, không dùng cấu hình này để deploy.

Không đăng nhập, không submit đặt phòng, thanh toán hoặc gọi DB. Các ảnh có sẵn trong public/images chỉ là dữ liệu QA, không chứng nhận ảnh cơ sở thật.

## Đã quan sát qua browser

- 375×812: gallery initial focus ở nút đóng; Shift+Tab về thumbnail cuối, Tab từ thumbnail cuối về nút đóng. ArrowLeft từ ảnh đầu về ảnh 3 lỗi fixture, error state hiện đúng. Escape đóng và focus trở lại nút Xem ảnh.
- 375×812: room modal initial focus ở nút đóng; cả hai CTA footer nằm trong viewport, target cao 44px, không horizontal overflow ở fixture.
- 1440×900: gallery không horizontal overflow; kiểm wrap focus và Escape. Room modal Shift+Tab từ nút đóng tới Tiếp tục đặt phòng. Sau đóng hoàn toàn, focus trở lại trigger Xem chi tiết.
- Sort đổi price_desc → price_asc → Back khôi phục price_desc; reload vẫn price_desc trong native select và URL. Chỉ một fixture nên đây là kiểm URL/UI state, không chứng minh thứ tự nhiều kết quả hoặc server filter.
- 667×375: tái hiện thumbnail nằm ngoài panel vì min-height 440px. Sửa panel có chiều cao viewport xác định, stage được co và ảnh nằm trong vùng stage thay vì tăng intrinsic height.

## Validation và limitation

Suite gallery/room modal/Home/Detail: 38/38 tests, 4 files, exit 0. Unit tests không phát hiện lỗi CSS chiều cao; browser là evidence riêng cho lỗi này. `node --check frontend/tools/ui-fixture-server.cjs` và scoped `git diff --check`: exit 0.

Build cuối `npm --prefix frontend run build`: exit 0, warning CommonJS sweetalert2 có sẵn. Xác nhận cuối 667×375: panel y=30..345, mọi button nằm trong panel, ảnh chính cao 105px (stage 137px). 375×812 và 1440×900: ảnh chính cao tương ứng 455px/490px, không horizontal overflow. Evidence screenshot: evidence/gallery-landscape.png. Preview đã dừng, tab đã đóng, viewport override đã reset.

Chưa kiểm zoom 200%, screen reader, contrast toàn trang, mọi kích thước/browsers, full booking E2E hoặc GPS. Không coi đây là đạt WCAG toàn bộ. External marketing images bị CSP test chặn có chủ đích; lỗi CSS ở lượt preview đầu do CSP chặn stylesheet onload đã sửa trong fixture server, không phải regression production.

Các claim Home “500+”, smart-lock tức thì, footer ví điểm/hóa đơn vẫn cần audit nội dung ở task tiếp; chưa sửa scope này. Không migration/deploy/commit/push hoặc Canva file.
