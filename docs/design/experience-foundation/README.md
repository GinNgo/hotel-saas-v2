# UX/UI và form foundation — 18/10/2026

Trạng thái: **bản phân tích và phương án để duyệt, chưa phải thiết kế đã triển khai**.

## Kết luận

Vấn đề không chỉ là giao diện đơn sơ: hệ thống thiếu contract chung cho form, trạng thái tương tác và dữ liệu thiếu. Thêm nhiều khối giao diện trước khi xử lý các nền tảng này sẽ nhân rộng lỗi. Khuyến nghị cải tiến từng lát cắt: form foundation → tìm/chọn/giữ phòng → tài khoản khách → PMS.

## Đọc theo thứ tự

1. `audit.md`: findings có evidence source và giới hạn khảo sát.
2. `spec.md`: actor, user stories, business rules và acceptance criteria.
3. `research.md`: lựa chọn thiết kế, trade-off và câu hỏi chưa chốt.
4. `contracts/forms.md`: contract component/input dùng chung.
5. `screen-design.md`: sơ đồ màn hình và handoff thiết kế.
6. `plan.md`: phạm vi, kiến trúc, dependency và quality gates.
7. `tasks.md`: backlog tuần tự có điều kiện mở triển khai.

## Phương pháp và giới hạn

- Áp dụng requirements-analysis, karpathy, Angular, UI/UX Pro Max, Impeccable và design-system; cấu trúc đặc tả/kế hoạch/task theo Spec Kit.
- Repo hiện không có `.specify/`, script setup-plan/setup-tasks hoặc constitution tương ứng. Không chạy lệnh không tồn tại, không khởi tạo framework hoặc tuyên bố đã chạy pipeline Spec Kit. AGENTS.md là guard hiện hành.
- Kế thừa `../booking-marketplace/spec.md`, `flow-implementation-2026-10-18.md`, `guest-account-api.md`; audit cũ là snapshot lịch sử, không mặc định mọi finding vẫn còn.
- Khảo sát source trên develop có nhiều thay đổi chưa commit, gồm component địa chỉ/bản đồ mới. Không nhận quyền sở hữu hoặc sửa đè các thay đổi đó. Không có mailbox task.json tại đường dẫn lịch sử; không lấy writer hoặc khởi động automation.
- Chưa có Canva MCP trong phiên, chưa có design ID. Người dùng yêu cầu thiết kế từ đầu; có thể chuẩn bị bố cục/component ngay, nhưng không khẳng định có file Canva. User tự kết nối/đăng nhập provider; không gửi credential.
- Đây là source audit có mẫu đại diện, không phải visual QA mọi route, usability test, chứng nhận WCAG, coverage hay báo cáo conversion. Chưa thực thi thay đổi ứng dụng ở vòng này.

## Phạm vi cần xác nhận

Khuyến nghị ưu tiên khách đặt phòng và form chung, rồi PMS. Giữ Home là marketplace đa cơ sở; cùng một design system, khác shell/mật độ theo actor. Chỉ mở triển khai sau khi người dùng duyệt phương án; API/schema/quyền mới cần review contract riêng.
