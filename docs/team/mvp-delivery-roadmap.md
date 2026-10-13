# MVP delivery và evidence môn học

PO giao thực hiện liên tục ngày 10/10/2026. Nguồn: implementation-phases.md, p0-decisions.md, SRS/SDD và code. docs/rubric-self-assessment.md là snapshot cũ, chưa có bản yêu cầu môn học gốc trong repo để xác minh mức điểm.

| Thứ tự | Sản phẩm nhìn thấy | Gate bàn giao | Evidence môn học |
|---|---|---|---|
| P2 | Admin phòng, buồng phòng, policy/rates | CRUD/quyền/quote đúng | Thiết kế↔code, test behavior, UX |
| P3 core | Tìm phòng trống và đặt nội bộ | Race không double-book, snapshot | Transaction/concurrency, traceability |
| P3 lifecycle | Nhận/trả phòng, phòng cần dọn | HTTP flow hoàn chỉnh | Business state machine, demo |
| P4 | Thu tiền/công nợ/dashboard | Đối soát/retry/scope | Tính thực tiễn, báo cáo thật |
| P5 | Guest tìm/hold/đặt | Chung tồn, expiry/idempotency | Hoàn thiện sản phẩm, public security |
| P6 | AI tìm phòng tiếng Việt | Search thật, hỏi lại/fallback | AI integration và đánh giá lỗi |
| P7 song song | Demo tái lập, tests/CI/recovery | Chỉ ghi số đã đo | Coverage, CI thực, user testing, luận văn |

Không tính entity/docs/test count là phần trăm chức năng. Trạng thái: Backlog/Blocked/Ready/In Progress/In Review/Approved. Hoàn thành sản phẩm theo lát cắt chạy được với evidence, không theo số dòng code.

## Phần đơn giản dành team trước

Nguyên/Tân tiếp tục task đã giao tại implementation-queue.md. Sau khi hoàn thành, dùng API booking thật để chia Nguyên danh sách/filter/detail booking, Tân form khách cơ bản trong booking và check-in/out UI; chỉ Ready sau contract/core API Approved. Không tạo module CRM khách hàng hoặc Staff/RBAC API mới cho mục tiêu này. Cả hai làm FE/BE khi cần trong scope có contract; review chéo. Không giao lại module đã agent làm.

## Việc tăng điểm sau core MVP

Ưu tiên chi phí nhỏ, evidence rõ: đánh giá AI với bộ câu cố định; performance P95 trên dữ liệu/hardware ghi rõ; usability có người thật và đồng thuận; backup/restore rehearsal; mapping lỗi AI đã phát hiện với cách sửa. Không tự triển khai OTA/gateway/subscription/mobile app khi core chưa hoàn thiện. Yêu cầu chấm điểm gốc, deadline và thời lượng nhóm còn thiếu nên không hứa phần trăm/điểm/ngày hoàn thành.

## Báo cáo

Mỗi task bổ sung tối đa một mục ngắn vào evidence log: chức năng, source, command/result, ảnh, hạn chế, rubric liên quan. Luận văn viết từ bằng chứng này; không bịa khảo sát, phỏng vấn, coverage, deploy hoặc production users. Báo cáo tổng hợp là công việc song song, không làm chặn triển khai.
