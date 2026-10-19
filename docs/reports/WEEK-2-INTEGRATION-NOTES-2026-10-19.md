# Ghi chú tích hợp tuần 2 — 19/10/2026

## Phạm vi được xác nhận

Chủ dự án yêu cầu đẩy local lên develop trước, hợp nhất nhánh thành viên, sửa CI và cập nhật main. Đồng ý tạm khóa social-login chưa xác minh provider token và bỏ secret VNPay ghi cứng. Không yêu cầu deploy hoặc migration môi trường thật.

- Local được lưu ở commit c062cbe; không reset/stash hoặc bỏ thay đổi.
- PR #6 của Nguyên đã nằm trong develop; các nhánh Room/Housekeeping lịch sử cũng đã được merge, không merge lặp.
- Commit e8fbb33 của Tân được nhận qua merge 5e40505; giữ lịch sử tác giả.
- PR phát hành: https://github.com/GinNgo/hotel-saas-v2/pull/7.

## Gate tích hợp bên ngoài

- `POST /api/auth/social-login` trả 503 `SOCIAL_LOGIN_DISABLED`, không dispatch dữ liệu identity chưa xác minh. Không bật lại chỉ bằng cách thêm client ID; cần triển khai/xác minh provider token và test security trước.
- VNPay không còn merchant/secret fallback trong service. Cấu hình `Payment__Vnpay__TmnCode`, `Payment__Vnpay__HashSecret` qua môi trường hoặc secret store; không commit giá trị. Có thể cấu hình `Payment__Vnpay__Url` và `Payment__Vnpay__ReturnUrl` theo môi trường sandbox đã duyệt.
- Khi thiếu cấu hình, tạo URL bị từ chối và callback không được công nhận. Test dùng khóa giả riêng, không phải thông số merchant.
- Mã nguồn migration được lưu trong Git nhưng không thực thi trên DB thật. Các tests có DB chạy trong service PostgreSQL cô lập của GitHub Actions.

## Các lỗi được sửa để CI kiểm tra thực chất

- Local loại import/field RoomService trùng tại reservations gây TS2300 trên develop cũ.
- CI gọi `npm test -- --watch=false` thay script không tồn tại kèm `--if-present`.
- CI dùng `npm ci` thay `npm install --legacy-peer-deps` làm thiếu peer Vite cần cho Vitest.
- Đồng bộ EF Core Relational với EF Core 10.0.12 hiện có để hết warning xung đột assembly.
- Regression category test instantiate component con thực; tile dùng button native, sửa Homestay → Guesthouse bị gắn sai và bỏ một claim Smart Lock tĩnh. Không tuyên bố đã sửa toàn bộ findings audit.
- Test nhận diện brand cập nhật theo brand LuxeStay hiện có, không đổi branding ứng dụng chỉ để chiều test cũ.

## Kết quả và giới hạn

Local sau merge: 360 frontend tests pass, backend build 0 warning/0 error. CI backend sau merge: 417 pass (366 Application + 1 Domain + 50 WebApi); CI frontend sau clean install: 360 pass. Các con số này không phải coverage hoặc E2E thanh toán thật.

Còn warning sweetalert2, audit dependency 7 mục (5 high/2 moderate), gitleaks advisory và lint optional. Không tự major-upgrade Tailwind. Báo cáo functional audit ngày 19/10 là snapshot trước tích hợp; các findings chưa có test/commit sửa xác nhận vẫn mở.

Báo cáo học thuật: BAO-CAO-NOP-TUAN-2-VA-KHAI-BAO-AI-CHINH-THUC.md; giảng viên HUỲNH XUÂN PHỤNG, không ghi chức danh. Đối chiếu kết quả cuối trên PR và GitHub Actions trước khi nộp.
