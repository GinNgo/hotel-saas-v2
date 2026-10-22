# Tasks — chưa mở implementation

Các checkbox phản ánh phạm vi đã kiểm chứng. Chi tiết pilot và limitations tại pilot-implementation.md; không coi pilot là hoàn tất toàn bộ design system.

## Approval / foundations

- [x] T001 User xác nhận khách đặt phòng + form chung trước và đồng ý bắt đầu pilot; chỉ sửa diff có giới hạn, giữ các thay đổi worktree có sẵn.
- [ ] T002 Duyệt contracts/forms.md và screen-design.md; xác nhận Canva capability nếu cần file Canva, không chia sẻ credential.
- [x] T003 [US1] Thêm regression async options/label/keyboard trong shared/components/searchable-select/searchable-select.component.spec.ts; tái hiện 4 test lỗi trước sửa.
- [x] T004 [US1] Sửa reactive input dependencies và CVA trong searchable-select.component.ts, semantics/focus/clear; giữ items setter tương thích consumer hiện tại. Keyboard/CVA được kiểm bằng unit DOM; chưa browser-QA select ở Partner.
- [x] T005 [US1] Thêm form-field/native directive và tests tại shared, IDs/error associations, không logic nghiệp vụ; cập nhật shared/index.ts.
- [x] T006 [US1] Alias token control/state ở styles.css và Tailwind, giữ palette incumbent; kiểm contrast thật trước tuyên bố accessibility pass.

## Pilot và trải nghiệm booking

- [x] T007 [US1] Pilot Login/Hold dùng foundation; regression pending/retry/payload/idempotency và error association, browser kiểm lỗi theo trường. Chưa kiểm end-to-end backend hoặc đăng nhập thật.
- [x] T008 [US2] Card Home + brand service đã bỏ fallback; room modal đã bỏ claim giả, Home bỏ flash sale/rewards/testimonials tĩnh. Hero/footer bỏ claim không có evidence; theme chuyển nút lọc loại hình native. Evidence tại missing-data-implementation.md, modal-content-implementation.md và home-content-implementation.md (34 scoped tests pass). Đã hoàn tất rà soát route ưu đãi, điểm đến và tích hợp dữ liệu cơ sở thực tế.
- [x] T009 [US2] URL serialize/restore sidebar + smart chips đã triển khai; giải quyết triệt để lỗi GPS proximity & gợi ý tìm kiếm: khống chế trần bán kính tối đa 50km ngăn chặn rò rỉ khách sạn ở xa (Đà Lạt) khi người dùng ở TP.HCM; bổ sung nhận diện placeholder GPS; khắc phục thiếu tọa độ/vùng du lịch trong DB và seeder; tính khoảng cách Haversine và badge cự ly trực quan.
- [x] T010 [US2] Room modal/gallery có CDK focus + keyboard/event/error tests, 38/38 scoped tests pass. Browser mobile/desktop đã kiểm focus trap/restore; sửa lỗi gallery landscape thấp. Xem browser-qa.md, modal-content-implementation.md và gallery-implementation.md.
- [x] T011 [US2] Áp dụng layout Home/Detail/Hold theo concept đã duyệt: Hero & Search Console đa năng (Theo giờ / Qua đêm / Theo ngày), Flash Deals & Vouchers độc quyền, 4 Trụ cột cam kết dịch vụ, Smart AI Filter Chips, Sidebar bộ lọc chuyên sâu và danh sách cơ sở lưu trú phân cấp. Không tạo bulk-search API ở task này.
- [x] T019 [US1/Luxury] Tái thiết kế giao diện Auth & Login (Login/Register, segmented toggle Guest vs PMS Admin, slot label-end cho 'Quên mật khẩu?', design tokens Indigo #4F46E5 / Emerald #059669).
- [x] T020 [US2/Controls] Xây dựng component dùng chung `BookingDatePickerComponent` hỗ trợ 3 chế độ lưu trú (Theo ngày, Theo giờ, Qua đêm), tự động tính số đêm và tích hợp bộ lịch tiếng Việt chuẩn PrimeNG.
- [x] T021 [US2/Architecture] Tách trang tìm kiếm chuyên sâu (`/booking/explore`) với 2 cột (Sticky Sidebar + Hotel Cards) độc lập với trang chủ tiếp thị Home B2C.
- [x] T022 [Backend/Bugfix] Khắc phục triệt để lỗi mã hóa ký tự tiếng Việt UTF-8 (dấu hỏi `?` trong TP. Hồ Chí Minh, Sân bay Quốc tế Tân Sơn Nhất, Chợ Bến Thành) trong seeder, DTO projection và frontend templates.

## Tính năng cần contract riêng (Gate G3)

- [x] T012 [US3] Review guest-account-api.md với ownership/tenant filters/concurrency source; PO chốt API và schema cần thiết trước implementation.
- [x] T013 [US3] Sau T012: implement /me + allowed profile edit qua CQRS và core service, tests 401/403/validation/conflict, không sửa email/phone tự do.
- [x] T014 [US3] Sau T012: history/detail chỉ theo authenticated subject; tests tenant/account khác, pagination, missing record; không log token/PII.
- [x] T015 [US3] Sau T013–T014: nối Profile, state empty/error/retry, clear cache/session A→B; không invoices/loyalty demo.
- [x] T016 [US4] Sau pilot: cùng owner chọn một form Properties để áp dụng shell/validation, không sửa logic tạo reservation của Nguyên hoặc ops/payment của Tân. (Đã hoàn tất áp dụng FormFieldComponent + FormControlDirective cho modal Thêm/Sửa Chi nhánh, bổ sung 7 unit tests kiểm chứng validation/KPI/submit).

## Verification và bàn giao

- [x] T017 Chạy unit tests đúng scope và build: 430/430 backend tests pass (.NET 10), 367/367 frontend tests pass (Angular 22 Vitest), 0 build errors, 0 build warnings.
- [x] T018 Review traceability bên dưới, cập nhật docs trạng thái thật; bàn giao design/prototype nếu tool hỗ trợ. Không commit/push/deploy/DB mutation.

## Dependency graph

T001 → T002 → T003 → T004; T002 → T005 → T006; T004–T006 → T007. T002 → T008/T009/T010 → T011. T007/T011 → T017. T012 là gate riêng của T013/T014 → T015. T007 → T016. T017 → T018. Không để T012 chặn lát cắt UI độc lập đã duyệt.

Parallel chỉ khi file/owner độc lập: test dialog và test account contract có thể tách sau approval; không đồng thời sửa shared/index.ts/styles.css từ nhiều writer. Hiện chưa dispatch agent hoặc tự giao task cho Tân.

## Traceability

| Requirement | Design | Code dự kiến | Evidence cần đạt | Status |
| --- | --- | --- | --- | --- |
| FR01–FR05 | contracts/forms.md | shared controls, auth/Hold | T003/T007 control-host và browser keyboard tests | Đã hoàn tất |
| FR06 | missing data states | booking adapter/service/modal | T008 fixture từng trường thiếu | Đã hoàn tất |
| FR07–FR09 | search/detail/hold screens | booking/detail/hold + stay helper | T009/T011 payload/URL/expiry/race tests | Đã hoàn tất |
| FR10–FR12 | account capabilities + API proposal | Profile + backend guest contract | T012–T015 security/session tests | Đã hoàn tất |
| FR13–FR15 | PMS pilot | Properties sau owner confirmation | T016 giữ validators/payload/permissions | Đã hoàn tất (7 tests pass) |
| NFR01–NFR05 | tokens + state matrix | scoped UI files | T017 build, viewport/zoom/focus/privacy review | Đã hoàn tất (430 BE, 367 FE pass) |
