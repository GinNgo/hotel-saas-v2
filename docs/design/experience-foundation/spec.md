# Đặc tả experience foundation — Draft

## Actors và outcome

- Khách anonymous: khám phá nhiều khách sạn, xác định cơ sở/lịch/phòng/giá, giữ phòng và tra cứu mà không bị ép đăng nhập.
- Khách đăng nhập: xem identity thật; quản lý hồ sơ và history chỉ khi backend hỗ trợ, không lộ dữ liệu người khác.
- Chủ cơ sở/nhân viên: form thao tác rõ, lỗi có thể sửa, ngữ cảnh tenant/property luôn thấy được; không nhập lại dữ liệu vô ích.
- Platform admin: shell/quyền riêng; không dùng public filter làm authority tenant.

Thành công đánh giá bằng scenario và test, không tự đặt tỷ lệ conversion hoặc số người dùng.

## User stories / acceptance

### US1 — Form nhất quán, có thể thao tác (P1)

- FR01: Given field text/select/date/password, when đọc bằng AT hoặc click label, then control thật có accessible name và nhận focus phù hợp.
- FR02: Given submit invalid, then lỗi từng field liên kết qua aria-describedby, aria-invalid=true; focus lỗi đầu và giữ nguyên dữ liệu. Lỗi hiện sau touched hoặc submit, không đỏ form ngay khi mở.
- FR03: Given pending request, then CTA biểu thị đang gửi và chặn submit lặp; khi lỗi có retry và giữ input. Không xóa form hoặc báo thành công trước server.
- FR04: Given hai instance control trên trang, then ID label/hint/error không trùng; disabled/readonly có semantic đúng, không chỉ màu.
- FR05: Given options thay đổi bất đồng bộ, then searchable select cập nhật options/nhãn mà không cần gõ lại; thao tác hoàn toàn được bằng keyboard, không có nested interactive controls.

### US2 — Tìm/chọn phòng trung thực và khôi phục được (P1)

- FR06: Given thiếu giá/ảnh/reviews/brand, then UI dùng trạng thái thiếu; không tạo claim, stock photo thay ảnh cơ sở, hoặc gộp brand suy đoán.
- FR07: Given đổi query rồi Back/reload, then URL khôi phục đầy đủ filter trong scope, không giữ GPS/slug điểm đến cũ; response muộn không ghi đè ý định mới.
- FR08: Given discovery chưa hỗ trợ availability bulk, then thông báo giới hạn gần kết quả, không tuyên bố còn phòng theo ngày trên toàn sàn. Không N+1 vô hạn.
- FR09: Given chọn phòng, then Detail kiểm tra capacity/lịch và quote server; đổi lịch vô hiệu quote; Hold giữ đúng context và chỉ hiện mã server thật. Giữ contract rental type, thời gian, giá và idempotency hiện có.

### US3 — Tài khoản thật, không tính năng giả (P2, có API gate)

- FR10: Given API chưa sẵn sàng, then account có capability/unavailable state và đường tra cứu hiện có; không invoice/điểm hoặc local-save giả.
- FR11: Given API được duyệt và triển khai, then /me và history chỉ truy cập subject thật; logout/account switch xóa dữ liệu cũ, late response không lộ identity trước.
- FR12: Đổi email/phone, loyalty, nhận booking cũ, hóa đơn pháp lý chưa được phép suy đoán. Theo guest-account-api.md và PO decision.

### US4 — Nhân rộng sang PMS không phá nghiệp vụ (P2)

- FR13: Pilot một form identity/auth và một form booking trước; sau đó một form quản lý được owner đồng ý, không mass replace.
- FR14: Form tạo/sửa entity giữ validator, permission và payload contract thật. Không đưa TenantId/PropertyId vào field có thể chỉnh để vượt quyền.
- FR15: Mọi mutation nhạy cảm có status pending/error/success rõ; không sửa payment FSM/concurrency hay housekeeping của Tân trong task design-system.

## Non-functional và rules

- NFR01: 375/768/1024/1440px, zoom 200%, tiếng Việt/tên dài: không mất field/CTA, không horizontal scroll ngoài vùng bảng có nhãn.
- NFR02: Target tương tác ít nhất 44px, focus visible, body text ưu tiên 16px, contrast thường mục tiêu 4.5:1; phải đo trên màu thực trước tuyên bố đạt.
- NFR03: Respect reduced motion; không glass blur/morphing trên control quan trọng; không thêm remote fonts/assets không rõ quyền.
- NFR04: Angular standalone/OnPush, typed state, core services gọi HTTP; không thêm any/dependency, framework form hoặc schema builder.
- NFR05: Múi giờ nghiệp vụ/currency/enum theo contract thật. Không log PII/token vào query, analytics, screenshot hoặc tài liệu.

## Ready / Done

Ready: scope ưu tiên được xác nhận; design/control contract duyệt; mỗi task có owner, dependency, test và change boundary; API gate chưa chốt không mở backend implementation.

Done mỗi lát cắt: behavior tests + frontend build thực tế, review keyboard/focus/desktop-mobile, không đổi payload/quyền, có rollback bằng thay đổi nhỏ, docs phản ánh đúng phần chưa hỗ trợ. Không commit/deploy/migrate hoặc khởi động DB để làm UI QA.
