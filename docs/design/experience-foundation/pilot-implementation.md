# Form foundation pilot — 18/10/2026

## Đã triển khai

- FormFieldComponent và FormControlDirective trong shared/components/form-field: label/hint/error IDs rõ, error association và aria-invalid cho native control, không giữ value hoặc gọi HTTP. Dùng được cùng ngModel và reactive form qua integration hiện có.
- Styles control dùng token màu hiện có, chiều cao tối thiểu 44px, input 16px, focus/invalid/disabled states; chỉ thêm aliases cần cho pilot, chưa migrate toàn bộ Tailwind/theme.
- SearchableSelect giữ API items/selectionChange/CVA: options reactive khi tải lại, clear button độc lập, keyboard Arrow/Enter/Escape, return focus, blur touched, không emit writeValue, chặn mutation khi disabled/loading, id/listbox/option semantics. Không tạo control thứ hai.
- Login dùng field shell cho email/password; inputId và PrimeNG pass-through áp error association vào input thật, autocomplete, pending guard chặn submit lặp. Không đổi auth API/roles/redirect hoặc social verification.
- Hold dùng field shell, lỗi gần từng trường sau touched/submit, focus trường sai đầu tiên, trạng thái aria-busy; giữ tên/phone/email và quote/hold payload/idempotency logic hiện hữu. Chưa thêm quy tắc phone mới ngoài contract hiện tại.

## Evidence thực tế

- Trước sửa select: 4 failed / 7 passed: tái hiện stale options, nested interactive clear, keyboard không chọn, disabled vẫn emit.
- Sau cùng: 33/33 tests, 4 files (form-field, searchable-select, login.page, public-booking.page). Lệnh: npm --prefix frontend test -- --watch=false với --include từng file trên.
- Build frontend cuối: exit 0, 33.617 giây; chỉ còn cảnh báo CommonJS sweetalert2 có sẵn. Warning InputText không dùng từ lượt build trước đã được sửa bằng bỏ import.
- git diff --check giới hạn Login/Hold/shared/index/styles: exit 0 sau dọn blank EOF ở file đã sửa.
- Browser preview chỉ phục vụ static build tại 127.0.0.1:4319; /api bị chặn bằng HTTP 503, không proxy/backend/DB. Login vì dialog membership hiện hữu có phát request dù ẩn, preview hiện thông báo lỗi hệ thống: đây là limitation của isolated preview và behavior có sẵn, không evidence auth integration. Không nhập credential/đăng nhập thật.
- Login mobile 375px: screenshot thấy label và lỗi từng field; DOM input email/password có aria-invalid=true và describedby đúng error ID; cao lần lượt khoảng 45.6px/44px. scrollWidth 367 không vượt viewport 375. Login desktop DOM 1440px có scrollWidth 1432; screenshot đầu khi resize không dùng làm evidence visual desktop đầy đủ.
- Hold desktop 1440px: screenshot/AX thấy field/error/focus ring, blur tên whitespace báo lỗi gắn hold-name-error; scrollWidth 1432 không tràn viewport. Route không có lựa chọn phòng hiển thị đúng yêu cầu chọn lại và CTA disabled, không tạo hold.
- Detector chạy một lượt: 5 warnings gray-on-color ở khối tài khoản kiểm thử Login đã có sẵn, ngoài field pilot; không tự sửa nội dung/logic auth khác. Không phải chứng nhận WCAG.
- Preview server đã dừng, tab đã đóng, viewport đã reset.

## Giới hạn và việc tiếp

- Chưa keyboard browser-QA SearchableSelect trong Partner, chưa screen-reader/zoom audit đầy đủ, chưa visual Hold mobile; không tính unit DOM thành end-to-end.
- Các claims/membership/điểm và tài khoản dev/social login trên Login có sẵn chưa được chứng nhận an toàn/production-ready bởi pilot. Không coi việc có UI là đã xác minh provider.
- Home data fallback, Brand reviews, URL/sidebar state, dialog focus, Profile API và PMS rollout vẫn theo backlog, chưa sửa trong lát cắt này.
- Chưa làm file Canva vì connector chưa có. Không thêm dependency, đổi API/schema, chạm DB, payment, migration, commit/push hoặc deploy.
