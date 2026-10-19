# TAN-OPS-FIX-01 — Sửa lỗi đồng bộ vận hành và an toàn thu ngân

- Người thực hiện: Trần Trọng Tân — GitHub `trantrongtan096`.
- Trạng thái giao việc: Ready, theo yêu cầu trực tiếp của Tuấn An ngày17/10/2026; chưa xác nhận Tân nhận việc.
- Source review: commit `efb6f81` trên `feature/tan-operations` (implementation `f711156`). Đã fast-forward develop local; chưa push develop tại lúc review. Kiểm tra remote trước khi chọn base; không giả định origin/develop đã chứa merge.
- Tiếp tục nhánh `feature/tan-operations` hoặc nhánh fix theo quy trình nhóm, PR đích `develop`; không push thẳng develop.

## 1. P1 — Chặn response poll buồng phòng cũ

Source: `frontend/src/app/features/housekeeping/housekeeping.page.ts`, `pollServerSync()` khoảng dòng599 và callback ghi rooms khoảng652.

Poll hiện subscribe riêng, thiếu subscription lifecycle/property/generation guard. Request A có thể hoàn thành sau khi chuyển B và ghi lại bảng phòng A; tương tự khi đổi filter/page hoặc destroy.

Acceptance:
- [ ] Hủy/invalidate poll khi đổi property, filter/page và destroy; reject mọi late callback sai context, kể cả error.
- [ ] Response cũ không ghi đè danh sách mới hoặc trạng thái sau mutation. Không tăng tần suất poll/đổi kiến trúc realtime.
- [ ] Regression bằng Subject: A pending → B success → A late success/error; đổi filter/page; destroy trước response. Assert rooms/total/loading/sync state không bị response cũ tác động.

## 2. P1 — Giữ idempotency cho retry cùng ý định thu tiền

Source: `frontend/src/app/features/payments/payments.page.ts`, `submitPayment()` khoảng1775.

Mỗi click hiện tạo UUID mới. Nếu server đã ghi nhận thanh toán một phần nhưng response mất, retry có thể ghi thêm một payment vì vẫn còn dư nợ.

Acceptance:
- [ ] Cùng ý định thu và payload giữ cùng key qua lỗi mạng/retry; không tự tạo payment mới khi kết quả cũ chưa rõ.
- [ ] Payload snapshot phải nhất quán với key. Reset khi thành công hoặc bắt đầu ý định mới; đổi reservation/property phải cô lập context, không replay sang nơi khác.
- [ ] Test response mất/ambiguous error → retry cùng key/payload; success → giao dịch mới key mới; đổi payload/context không tái dùng key sai; chống double click.
- [ ] Không sửa chính sách số tiền/cọc, API hoặc quyền để né lỗi.

## 3. P2 — Đồng bộ báo cáo ca và403

Source: `payments.page.ts`, success thu tiền khoảng1815 và error shift-report khoảng1423.

Acceptance:
- [ ] Thu thành công refresh cả folio, daily summary, history và shift report, giữ ngày/ca đang chọn.
- [ ]403 từ shift report áp dụng cơ chế access-denied/latch/xóa dữ liệu tài chính hiện hữu, reject stale response; không để báo cáo ca trở thành ngoại lệ của guard.
- [ ] Tests tổng ca cập nhật sau thu; shift403 xóa dữ liệu, chặn retry đến khi recovery hợp lệ; refresh lỗi độc lập không bịa số0.

## 4. P2 — Không nhận token trong user reference làm metadata hệ thống

Source: `backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs`, lookup `TransactionRef.Contains(ikTag)` khoảng173/232/297; `cleanRef` khoảng325. Đối chiếu manual `CreatePaymentCommandHandler` và folio parser.

Public reference chỉ Trim trong khi lookup mới tìm token toàn chuỗi; user reference có thể chứa `[IK:...]` và bị hiểu nhầm là key hệ thống.

Acceptance:
- [ ] Match idempotency trên metadata prefix server tạo, không trên user reference tự do; đồng bộ sanitize/parser public/manual/folio, giữ tương thích dữ liệu hợp lệ cũ.
- [ ] Test user reference chứa `[IK:...]`/`[PURPOSE:DEPOSIT]` không làm collision giữa reservation hoặc sai phân loại cọc; replay và payload mismatch hiện hữu vẫn đúng.
- [ ] Fix BE tối thiểu trong các handler liên quan được giao ở mục này; không thêm schema/migration/dependency hoặc thay API/quyền/nghiệp vụ. Nếu cần thay contract, báo Tuấn An trước.

## Validation và giới hạn

Kết quả reviewer trên checkout lúc review, không phải cam kết branch sạch:
- Installed targeted Vitest5 files:96 pass/6 fail; file payments mounted tests lỗi empty-state NG0303 (`iconClass`, `description`). Shared component có signal inputs và production build pass: kiểm tra test/JIT setup trước khi kết luận production template sai, không tắt assertion hoặc dùng schema để che lỗi. Chưa có baseline test riêng để quy lỗi cho Tân.
- `npm --prefix frontend run build`: exit0, warning sweetalert2 CommonJS có sẵn.
- `dotnet build backend/HotelSaas.slnx --no-restore --verbosity minimal`: exit1 do test double thiếu TenantContracts/PrintTemplateConfigs từ thay đổi LOCAL của leader; có warning EFCore.Relational10.0.4 vs10.0.12. Không giao Tân sửa hợp đồng/print/admin của leader hoặc tự nâng package. Kiểm tra lại trên base sạch và báo blocker riêng.
- Backend Payment tests dùng PostgreSQL thực. Không chạy suite toàn bộ trên DB ambient; chỉ test DB cô lập đã xác minh an toàn, tuyệt đối không DB dev/prod/staging. Không migrate/deploy.

Lệnh frontend đã tồn tại, chạy từ frontend:
```text
node node_modules/vitest/vitest.mjs run src/app/features/payments/payments.page.spec.ts src/app/features/reservations/reservations.page.spec.ts src/app/features/housekeeping/housekeeping.page.spec.ts src/app/core/services/payment.service.spec.ts src/app/core/services/reservation.service.spec.ts
npm run build
```

## Definition of Done / Bàn giao

- [ ] Reproduce trước fix, thêm regression tests thực cho4 mục trên; source change tối thiểu, không xâm phạm module Nguyên/admin/contracts/print đang làm.
- [ ] Chạy targeted tests/build; ghi command, commit, exit, count, warning và limitation đúng thực tế. Backend test chưa chạy phải ghi NOT RUN + lý do, không coi build là test nghiệp vụ.
- [ ] Cập nhật báo cáo tuần2 bằng commit/PR thực; không tự dựng manual test/AI log/coverage hoặc tuyên bố origin/develop đã merge khi chưa có evidence.
- [ ] PR vào develop, mô tả fix/test theo từng finding, ghi Ready for Review. Chỉ reviewer/PO nghiệm thu Done.
- [ ] Không commit các file local của người khác; không thêm dependency, API/schema/quyền mới, push trực tiếp develop, migration/deploy. Việc mới ngoài scope trao đổi Tuấn An.
