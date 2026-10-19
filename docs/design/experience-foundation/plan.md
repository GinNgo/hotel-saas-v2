# Implementation plan — chờ duyệt design

## Technical context / constraints

Branch khảo sát: develop. Angular 22 standalone + signals/OnPush, TypeScript strict, Tailwind 3, PrimeNG 22, Angular Material/CDK có sẵn; backend .NET 10/PostgreSQL không thay ở UI phase. Source hiện nhiều thay đổi chưa commit; recheck diff và owner trước mỗi task. Không tạo nhánh/commit trong vòng phân tích.

Không có .specify, constitution hoặc setup scripts. Áp dụng workflow research → spec → contracts → tasks và traceability trong thư mục hiện tại; không gọi lệnh Spec Kit không tồn tại. Kế hoạch này không phải bằng chứng hoàn tất pipeline.

## Gates trước thực thi

G0: user xác nhận guest-first/PMS-first và phương án A. G1: chốt field/control/screen concept. G2: xác nhận owner các shared component mới và form pilot. G3: API/profile/bulk-search/security thay đổi có review riêng trước mở code backend. Canva không chặn audit nhưng chặn tuyên bố đã bàn giao file Canva.

## Phases

### Phase 0 — Inventory và design review (vòng hiện tại)

Audit mẫu đại diện, phân biệt lỗi hiện tại/historical fixes, dữ liệu/API thật và placeholders. Xuất spec, design contract, screen concept, backlog. Không runtime changes. Câu hỏi mở không được chuyển thành business assumption đã duyệt.

### Phase 1 — Form foundation pilot (sau G0–G2)

Viết regression tests trước cho reactive options, accessible label/error và keyboard. Harden SearchableSelect hiện có, không tạo bản khác. Thêm field shell và native directive chỉ sau kiểm tra registry không có tương đương. Token alias không đổi toàn bộ palette. Pilot Login và Hold giữ nguyên contract/request/form logic.

Files dự kiến: shared/components/searchable-select; shared/components/form-field; shared/directives/form-control; styles.css; shared/index.ts; auth/login và public-booking/booking-hold cùng specs. Đây là đường dẫn mục tiêu, chưa phải file đã tạo/đổi.

### Phase 2 — Search/detail correctness và layout

Chuẩn hóa nullable mapping, xóa social proof/giá/stock/ảnh giả. Shared render missing data, property identity ổn định, không gộp brand fallback. URL round-trip cho facet đã hỗ trợ; không bịa server pagination. Reuse stay helper, quote, request cancellation/generation hiện có. Harden dialogs qua focus/keyboard; một lượt desktop/mobile, sửa batch và xác nhận tối đa một lượt.

Không trộn đổi layout với contract bulk availability: nếu cần search theo lịch trên toàn sàn, mở design/API review độc lập; UI vẫn discovery trung thực cho tới khi backend sẵn sàng.

### Phase 3 — Account integration (G3)

Theo ../booking-marketplace/guest-account-api.md: /me trước, ownership history sau. CQRS/FluentValidation, service Angular riêng, không nhận tenant/customer authority từ input. Test account A/B, tenant A/B, staff role, 401/403/404, logout và response muộn. Schema/ownership/concurrency chưa được chứng minh là blocker, không tự chạy migration.

### Phase 4 — PMS rollout nhỏ

Một form Properties được owner xác nhận, rồi lập danh sách rollout theo nhóm có cùng field behavior. Không tìm/thay toàn repo. Payment/housekeeping logic ngoài scope và không trùng task Tân/Nguyên. Thêm tính năng nghiệp vụ mới chỉ sau spec/API contract riêng.

## Validation strategy / quickstart

1. Đọc test script frontend/package.json, giữ runner hiện tại; mỗi task thêm/chạy file spec liên quan bằng `npm --prefix frontend test -- --watch=false --include='<đường dẫn spec thực sự có>'`.
2. Integration control trong form host: label/IDs, disabled/touched, không emit writeValue, async options, invalid submit, retry state và không đổi payload.
3. `npm --prefix frontend run build`. Không có lint script thì không bịa lệnh lint.
4. Browser local fixture cô lập, không proxy backend/DB: desktop/mobile, keyboard Tab/Escape/Arrows, zoom, tên dài, empty/error/pending. Test fixtures không tính là booking end-to-end thật.
5. Backend nếu được mở scope: chọn tests cô lập đã đọc setup; không chạy toàn solution tests khi chưa loại fixture truy cập DB thật. Không payment call/deploy/migration.
6. Ghi exact commands/exit/count, warnings và chưa kiểm tra; không reuse 51/51 của vòng trước để chứng nhận component mới.

## Rollback / Definition of Done

Mỗi lát cắt giới hạn file và API compatibility; giữ consumer contract trong thời gian migrate, không remove CSS/global component khi còn consumer. Nếu pilot fail, revert chỉ diff của lát cắt, không reset dirty worktree. Không feature flag backend/cache/service mới chỉ để rollout styling.

Ready/Done theo spec.md. Quyết định chưa chốt: thứ tự actor, Canva capability, owner shared changes, backend ownership/concurrency, loyalty/receipt policy. Không có ước lượng capacity/deadline/coverage khi chưa đo.
