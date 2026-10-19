# Tasks — chưa mở implementation

Các checkbox phản ánh phạm vi đã kiểm chứng. Chi tiết pilot và limitations tại pilot-implementation.md; không coi pilot là hoàn tất toàn bộ design system.

## Approval / foundations

- [x] T001 User xác nhận khách đặt phòng + form chung trước và đồng ý bắt đầu pilot; chỉ sửa diff có giới hạn, giữ các thay đổi worktree có sẵn.
- [ ] T002 Duyệt contracts/forms.md và screen-design.md; xác nhận Canva capability nếu cần file Canva, không chia sẻ credential.
- [x] T003 [US1] Thêm regression async options/label/keyboard trong shared/components/searchable-select/searchable-select.component.spec.ts; tái hiện 4 test lỗi trước sửa.
- [x] T004 [US1] Sửa reactive input dependencies và CVA trong searchable-select.component.ts, semantics/focus/clear; giữ items setter tương thích consumer hiện tại. Keyboard/CVA được kiểm bằng unit DOM; chưa browser-QA select ở Partner.
- [x] T005 [US1] Thêm form-field/native directive và tests tại shared, IDs/error associations, không logic nghiệp vụ; cập nhật shared/index.ts.
- [ ] T006 [US1] Alias token control/state ở styles.css và Tailwind, giữ palette incumbent; kiểm contrast thật trước tuyên bố accessibility pass.

## Pilot và trải nghiệm booking

- [x] T007 [US1] Pilot Login/Hold dùng foundation; regression pending/retry/payload/idempotency và error association, browser kiểm lỗi theo trường. Chưa kiểm end-to-end backend hoặc đăng nhập thật.
- [ ] T008 [US2] Card Home + brand service đã bỏ fallback; room modal đã bỏ claim giả, Home bỏ flash sale/rewards/testimonials tĩnh. Hero/footer bỏ claim không có evidence; theme chuyển nút lọc loại hình native. Evidence tại missing-data-implementation.md, modal-content-implementation.md và home-content-implementation.md (34 scoped tests pass). Còn audit route promotion, điểm đến, AI và browser-QA hàng nút mới, chưa chứng nhận toàn site.
- [ ] T009 [US2] URL serialize/restore sidebar + smart chips đã triển khai; unit restore/reset/Back/invalid numeric/late response pass. Browser sort Back/reload đã kiểm trên fixture; còn GPS, destination/facets toàn luồng và same-URL resubmit. Xem search-url-implementation.md và browser-qa.md.
- [ ] T010 [US2] Room modal/gallery có CDK focus + keyboard/event/error tests, 38/38 scoped tests pass. Browser mobile/desktop đã kiểm focus trap/restore; sửa lỗi gallery landscape thấp. Còn zoom 200% và matrix accessibility mở rộng; xem browser-qa.md, modal-content-implementation.md và gallery-implementation.md.
- [ ] T011 [US2] Áp dụng layout Home/Detail/Hold theo concept đã duyệt; missing/loading/error/quote-expired state. Không tạo bulk-search API ở task này.

## Tính năng cần contract riêng

- [ ] T012 [US3] Review guest-account-api.md với ownership/tenant filters/concurrency source; PO chốt API và schema cần thiết trước implementation.
- [ ] T013 [US3] Sau T012: implement /me + allowed profile edit qua CQRS và core service, tests 401/403/validation/conflict, không sửa email/phone tự do.
- [ ] T014 [US3] Sau T012: history/detail chỉ theo authenticated subject; tests tenant/account khác, pagination, missing record; không log token/PII.
- [ ] T015 [US3] Sau T013–T014: nối Profile, state empty/error/retry, clear cache/session A→B; không invoices/loyalty demo.
- [ ] T016 [US4] Sau pilot: cùng owner chọn một form Properties để áp dụng shell/validation, không sửa logic tạo reservation của Nguyên hoặc ops/payment của Tân.

## Verification và bàn giao

- [ ] T017 Chạy unit tests đúng scope và build; browser keyboard/desktop/mobile/zoom bằng fixture cô lập; ghi actual evidence và limitations.
- [ ] T018 Review traceability bên dưới, cập nhật docs trạng thái thật; bàn giao design/prototype nếu tool hỗ trợ. Không commit/push/deploy/DB mutation.

## Dependency graph

T001 → T002 → T003 → T004; T002 → T005 → T006; T004–T006 → T007. T002 → T008/T009/T010 → T011. T007/T011 → T017. T012 là gate riêng của T013/T014 → T015. T007 → T016. T017 → T018. Không để T012 chặn lát cắt UI độc lập đã duyệt.

Parallel chỉ khi file/owner độc lập: test dialog và test account contract có thể tách sau approval; không đồng thời sửa shared/index.ts/styles.css từ nhiều writer. Hiện chưa dispatch agent hoặc tự giao task cho Tân.

## Traceability

| Requirement | Design | Code dự kiến | Evidence cần đạt | Status |
| --- | --- | --- | --- | --- |
| FR01–FR05 | contracts/forms.md | shared controls, auth/Hold | T003/T007 control-host và browser keyboard tests | Chưa triển khai |
| FR06 | missing data states | booking adapter/service/modal | T008 fixture từng trường thiếu | Chưa triển khai |
| FR07–FR09 | search/detail/hold screens | booking/detail/hold + stay helper | T009/T011 payload/URL/expiry/race tests | Một số logic có sẵn; phải regression lại |
| FR10–FR12 | account capabilities + API proposal | Profile + backend guest contract | T012–T015 security/session tests | API gate chưa mở |
| FR13–FR15 | PMS pilot | Properties sau owner confirmation | T016 giữ validators/payload/permissions | Chưa triển khai |
| NFR01–NFR05 | tokens + state matrix | scoped UI files | T017 build, viewport/zoom/focus/privacy review | Chưa kiểm chứng vòng mới |
