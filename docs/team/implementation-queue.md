# Hàng đợi triển khai — 10/10/2026

PO đã giao tiếp tục implementation và tách task đơn giản cho Nguyên/Tân. Agent không làm trùng task team. Backend policy/quote/rates do Antigravity phụ trách trước để hoàn thành P2. Giao module đang có source, không giao lại việc từ đầu.

| ID | Owner | Trạng thái | Review | Phạm vi |
|---|---|---|---|---|
| P2-PRICING-HARDEN-01 | Antigravity | Ready | Codex | Quote permission/default-deny và kiểm chứng rules hiện có |
| P2-POLICY-UI-01 | Antigravity | Blocked task trên | Codex | Policies UI/API thật |
| P2-RATES-UI-01 | Antigravity | Blocked task harden | Codex | Rates/history UI/API thật |
| TEAM-NGUYEN-01 | Nguyên | Ready | Tân, Codex | Rooms/RoomTypes accessibility/responsive |
| TEAM-TAN-01 | Tân | Ready | Nguyên, Codex | Housekeeping states và pagination UX |

## Nguyên — hướng dẫn module danh mục

Source: frontend/src/app/features/rooms và room-types. API Rooms/RoomTypes hiện có là thẩm quyền nghiệp vụ; không tự đổi hard/soft delete. Bảo toàn filter server, date boundaries và paging. RoomNumber/Code uniqueness theo chi nhánh; lỗi 409 phải giữ thông tin người dùng và giải thích.

Task: labels/keyboard/focus, modal form responsive 360–1440, icon-only accessible names, table scroll trong container, nội dung dài/zoom. Thông báo save/delete sau API success; không nâng quyền hoặc hiện action khi user thiếu quyền. Giữ PrimeNG/SweetAlert shared patterns hiện có, không thêm thư viện.

DoD: sửa phần thực sự lỗi, build, targeted tests khi thay hành vi, browser desktop/mobile screenshots. Không chỉ sửa screenshot để che lỗi. Files mặc định giới hạn hai feature này; shared files phải phối hợp trước. Báo routes, diff/commit nếu có, commands/exit codes và limitations.

## Tân — hướng dẫn buồng phòng

Source: frontend/src/app/features/housekeeping. GET /api/rooms server paging/filter; PATCH /api/rooms/{id}/status gửi status và expectedOldStatus. Occupied thuộc check-in/out, không đổi trực tiếp. Dirty→Cleaning→Clean theo backend validator; backend là thẩm quyền, không nới FSM.

Task: empty/error/retry/loading hiển thị nhất quán; pagination mobile, disable actions khi request mutation, xử lý page hết dữ liệu sau đổi status với filter hiện tại. KPI trên trang. Không làm lại stream switchMap đã Approved. knownFloors chưa toàn bộ: đề xuất field nhập tầng hợp lệ thay vì tạo API summary; không cần migration.

DoD: browser thử trang 2/filter/reset/error và status 409, đúng quyền/branch; targeted tests nếu thay hành vi, screenshots desktop/mobile. Files mặc định chỉ feature housekeeping. Không sửa policies/rates/auth/shared layout.

## Bàn giao và nghiệm thu

Team dùng task ID riêng, ghi In Review, reviewer chéo rồi Codex nghiệm thu; không tự Done. Lưu evidence vào repo bằng link tương đối. Không chạy destructive tests/DDL trên staging, không migrate/deploy. Task quan trọng chờ PO không chặn task độc lập đã duyệt.

Mỗi submission: ID, owner, files, PR/commit nếu có, tests/result, ảnh, blocker. Backend thiếu API hoặc nghiệp vụ chưa chốt thì ghi rõ, không tạo CRUD giả.
