# Review P7-EVIDENCE-01 — ChangesRequested (round 1)

- taskId: P7-EVIDENCE-01
- round: 1
- submissionId: sub-p7-evidence-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings chặn nghiệm thu evidence

1. HIGH — Mapping không tái lập đúng source. docs/p7-evidence-traceability-matrix.md:49 dùng RateOverlappingTests, dòng51 dùng HousekeepingStateMachineTests, dòng59 dùng PricingCalculatorTests không có trong backend/tests (rg không tìm thấy). Filter không match có thể không chạy test nào, không chứng minh PASS. Dòng80 ghi GET /api/payments/folio/{reservationId}, nhưng ReservationsController.cs:202 khai báo GET /api/reservations/{id}/folio; PaymentsController không có route folio. Dùng đúng class/method hiện có và route controller; mỗi assertion phải có test/file thật, không chỉ label PASS. Contract sdd/06-api-design:12/15/... là số dòng không tương ứng nội dung (12 là API conventions), SDD còn /api/v1 khác implementation /api. Ghi source authority và mismatch rõ, không bịa reference contract. Housekeeping Maintenance phải đối chiếu enum OutOfService/Cleaning thực tế.

2. HIGH — Provenance và tổng kết vượt evidence. Dòng 5/20–24 gọi báo cáo độc lập, 429 tests/33 files/100% PASS; nguồn thực tế hiện chỉ submission tự báo và review targeted các vòng. Header phải là writer synthesis; mỗi kết quả có actor, thời điểm, command đầy đủ/cwd, artifact log hoặc review task/round/submission đã đối chiếu. Build exit0 không chứng minh 0 lint defects (dòng23); bỏ claim này nếu không lint evidence. Đếm file từ checkout không khớp 13 Application/9 WebApi; không suy count files từ test totals. Bảng lịch sử reviewer phải dẫn record thật, không tự đặt số Fact/scenario hoặc trạng thái Approved cũ. Bỏ tuyên bố hoàn tất 100% mọi yêu cầu kỹ thuật ở mục6: P7 còn gaps, P5 NeedsPO, P6 chưa mở. Tổng PASS writer chỉ được ghi claimed/unverified nếu thiếu log; không cần chạy lại toàn suite để tô xanh bảng.

3. MEDIUM — CI/DR/runtime assertions thiếu chứng cứ. Mục5 suy GitHub Actions chưa chạy vì thiếu remote/GITHUB_TOKEN trong khi remote origin đã có; không có run evidence thì ghi unknown, không đoán nguyên nhân (GITHUB_TOKEN được Actions cấp). Workflow source có PostgreSQL service nhưng không cấu hình TEST_DB_CONNECTION; frontend lint/test scripts --if-present không chứng minh test được chạy. Local targeted tests không phải full CI rehearsal. DROP SCHEMA là test cleanup, không phải backup/restore rehearsal; ghi chưa có evidence pg_dump/restore/verification. Screenshot chỉ tồn tại file chưa chứng minh đúng nội dung/current checkout: thêm path chính xác và provenance/unknown, không tự tuyên bố audit100%. Submission daemon/cron hoạt động và 0 defects không được reviewer xác minh; bỏ hoặc ghi unverified. Không sửa CI/backend/module team trong task docs này; ghi gaps để PO/task riêng xử lý.

## Validation / limitation

Review tài liệu bằng source: controllers/enum, test class inventory và rg filters, frontend/package.json, .github/workflows/ci.yml, SDD, screenshot path inventory, git branch/remote (read-only). Không chạy tests/build/DB vì submission chỉ sửa evidence docs; không dùng writer PASS làm independent validation. Không inspect nội dung ảnh hay GitHub run/live daemon; các claim tương ứng chưa xác minh. Không commit/deploy/migration hoặc DB dev/staging/prod.

## Next action

Antigravity sửa P7 evidence trong scope assignment, không làm lại P5 technical fixes, không mở P6 hoặc chạm Nguyên/Tân. D21/quote-hold vẫn NeedsPO ở decisions.md; không cần PO cho việc sửa mapping/provenance ít rủi ro. Archive review/submission trước thay đổi, reviewedSubmissionId cập nhật và writer none; resubmit round2 với ID mới.

---

# Review P5-GUEST-BOOKING-01 — NeedsPO (round 4)

- taskId: P5-GUEST-BOOKING-01
- round: 4
- submissionId: sub-p5-guest-booking-01-r4-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings / PO gates

Không có technical blocker mới trong bản sửa round4. Full P5 vẫn NeedsPO: D21 cần chốt TTL theo checkout dự kiến/thực tế và revoke/reissue; quote5min/hold15min cần chốt price pinning/stale-quote acknowledgement. CreateGuestHoldCommand.cs:395 vẫn dùng effectiveEndUtc.AddDays(7), không coi lựa chọn này là approval của PO. Giữ decisions.md; chưa mở P6 public search gate.

## Finding đã đóng

Round3 regression đã đóng: CreatePaymentCommandHandler.cs:268 và CheckInReservationCommandHandler.cs:172 giới hạn hold TTL vào PendingPayment online dưới room lock. Confirmed được check-in; CheckedIn thu dư nợ dù deadline cũ đã qua. Snapshot audit giữ nguyên. ConfirmGuestBookingCommand.cs fail-closed missing hold TTL trước xác nhận ban đầu; replay Confirmed/CheckedIn đi trước guard này.

## Validation độc lập

- dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~P5_GuestBookingHttpPipelineTests --verbosity quiet: 1/1 Fact PASS, exit 0. Scenario 6.5 kiểm tra confirm trước hạn → deadline quá khứ → check-in 200 → checkout còn nợ 409 → thu dư nợ 201 → checkout 200/Dirty. Pipeline giữ expired Pending rejection, insufficient deposit, authorization matrix, token fail-closed và online/internal race.
- dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter FullyQualifiedName~P5_GuestBookingTests --verbosity quiet: 16/16 PASS, exit 0.
- Explicit TEST_DB_CONNECTION localhost/hotel_saas_p1b01a_test; fixtures GUID schema riêng, HTTP Testing/SkipStartupDatabaseInit. Chỉ migration/cleanup schema test cô lập; không DB dev/staging/prod, commit/deploy.
- Chưa độc lập chạy full-suite/frontend/build round4; báo cáo của writer không thay evidence. Chưa xác minh daemon/resume nền; không tuyên bố kết nối hai chiều tức thì. Chưa red/green bằng revert source.

## Bàn giao

P5 NeedsPO được giữ riêng; chuyển P7-EVIDENCE-01 ApprovedNext theo assignment đã được PO giao, không bỏ hàng đợi và không làm trùng Nguyên/Tân. P7 chỉ mapping source/tests/evidence thực và limitations, không thay delivery hoặc tự tuyên bố điểm/coverage/SUS/deploy. Review/submission trước thay đổi đã lưu history; writer được giải phóng sau cập nhật mailbox.

---

# Review P5-GUEST-BOOKING-01 — ChangesRequested (round 3)

- taskId: P5-GUEST-BOOKING-01
- round: 3
- submissionId: sub-p5-guest-booking-01-r3-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Finding chặn còn lại

HIGH — Hold TTL đang áp dụng cả booking đã Confirmed/CheckedIn. CreatePaymentCommandHandler.cs:265–279 kiểm tra IsOnlineHold rồi reject khi HoldExpiresAtUtc <= now trước khi phân biệt PendingPayment. CheckInReservationCommandHandler.cs:169–184 tương tự. Snapshot IsOnlineHold và HoldExpiresAtUtc vẫn giữ sau confirm. Kết quả: khách đã nộp cọc/Confirmed đúng hạn, 15 phút sau không thể nhận phòng; khách đã CheckedIn không thể thu 70% còn lại trước checkout, và checkout bị balance guard chặn. Hold TTL chỉ chi phối PendingPayment chưa chuyển thành booking, không phải deadline nhận phòng/thanh toán của Confirmed. Sửa phân biệt lifecycle dưới room lock: reject missing/expired hold TTL chỉ khi đang PendingPayment online; online Pending không được check-in; online Confirmed được nhận phòng và Confirmed/CheckedIn được thu dư nợ bất kể deadline hold cũ. Không xóa metadata audit để che lỗi. Test HTTP create hold→confirm trước hạn→đẩy hold deadline vào quá khứ→check-in thành công→thu phần còn lại→checkout thành công; cùng test vẫn reject Pending expired và giữ internal FSM. Finding source-verified, chưa chạy reproducer regression.

## Findings đã đóng

- Round2 hai endpoints confirm có cả RESERVATIONS.Update và PAYMENTS.Create; HTTP matrix một quyền riêng bị chặn.
- Pending online thu cọc nhỏ/expired và check-in chưa confirmed đã có guards (cần sửa phạm vi TTL như trên), chưa đổi pending nội bộ.
- Lookup missing TokenExpiresAtUtc đã fail-closed, revoked check giữ nguyên. Không mở lại null-TTL finding.

## Validation độc lập

- P5_GuestBookingHttpPipelineTests: 1/1 Fact PASS, exit 0; dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~P5_GuestBookingHttpPipelineTests --verbosity quiet.
- Explicit localhost/hotel_saas_p1b01a_test + GUID schema/Testing/SkipStartupDatabaseInit; không DB dev/staging/prod, commit/deploy.
- Pipeline cases hiện tại không bao phủ Confirmed sau TTL15min rồi nhận phòng/thu dư nợ. Chưa independently Application/full-suite/frontend/build round3, không dùng report làm reviewer evidence.

## PO gate và bàn giao

ChangesRequested round3 chỉ sửa regression scope TTL trên; không làm lại authorization/idempotency/lookup fixes đã đóng. Token anchor hiện chuyển effectiveEndUtc+7days là implementation dự kiến, chưa có PO quyết định projected/actual checkout/revoke/reissue; quote/hold pinning cũng vẫn open ở decisions.md. Sau regression fix, review kỹ thuật và ghi NeedsPO cho full P5 nếu PO chưa chốt; chuyển ngay P7-EVIDENCE-01 độc lập theo assignment, không bỏ hàng đợi và không tự mở P6 khi public search gate chưa duyệt. Writer none, review/submission history đã lưu.

---

# Review P5-GUEST-BOOKING-01 — ChangesRequested (round 2)

- taskId: P5-GUEST-BOOKING-01
- round: 2
- submissionId: sub-p5-guest-booking-01-r2-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings chặn

1. CRITICAL — Invariant online hold chưa enforce ở mọi writer. CreatePaymentCommandHandler.cs:283–286 vẫn tự chuyển mọi PendingPayment→Confirmed sau bất kỳ khoản >0, không đọc IsOnlineHold/HoldExpiresAtUtc/DepositRequired. Online cọc 30% có thể bypass bằng POST /api/payments khoản 1 đồng; hold đã expired và được bán lại vẫn có thể hồi sinh Confirmed gây overlap. CheckInReservationCommandHandler.cs:160 cũng cho PendingPayment→CheckedIn mà không kiểm tra hold/cọc/expiry, có thể check-in expired hold khi room Clean. Sửa tại shared invariant/các existing writers, dưới cùng room lock: phân biệt online hold với pending nội bộ; online chỉ confirm khi còn hạn + mức cọc đúng D08/D15, không nhận/check-in hold chưa confirmed. Late receipt D22 không tự phục hồi; nếu workflow xử lý tiền muộn cần contract PO thì fail-closed phần hồi sinh và ghi limitation/decision, không bỏ mất khoản tiền đã nhận hoặc phát minh refund. HTTP tests online hold→small manual payment, expired hold→internal booking→manual payment/check-in cũ; giữ invariant không overlap/no revived, pending nội bộ không bị đổi rule ngoài scope.

2. HIGH — Staff confirm mở quyền ghi Payment.Completed ngoài PAYMENTS.Create. PublicController.cs:185–186 và ReservationsController confirm chỉ yêu cầu RESERVATIONS.Update nhưng command tạo payment. docs/sdd/06-api-design.md:110 quy định ghi payment PAYMENTS.Create; D08 đúng quyền/scope không phải cấp thêm quyền tài chính cho mọi người sửa booking. HTTP fixture round2 chỉ seed RESERVATIONS role nên test đang xác nhận permission widening. Giữ RESERVATIONS.Update cho confirm và PAYMENTS.Create cho receipt mutation (hoặc confirm dựa receipt đã được cashier đúng quyền ghi nhận); không invent permission mới. Test user chỉ RESERVATIONS.Update bị chặn ghi tiền, chỉ PAYMENTS.Create không tự confirm nếu thiếu quyền, cả hai đúng scope thành công. Nếu PO muốn OR khác, cần decision riêng.

3. HIGH / NeedsPO phần policy — TTL vẫn fail-open khi thiếu và tự chốt anchor chưa được PO duyệt. GetGuestBookingByTokenQuery.cs:52 và ConfirmGuestBooking chỉ reject nếu TokenExpiresAtUtc.HasValue && expired; snapshot cũ null vẫn lookup vô hạn. CreateGuestHold.cs:395 tự dùng checkout-date cuối ngày UTC +7 ngày, không phải instant EndAtUtc checkout và decisions.md vẫn mở dự kiến/thực tế. Missing TTL phải deny lookup, giữ staff-by-id workflow riêng không cấp lookup vô hạn; TTL anchor/revoke/reissue behavior chưa được duyệt cần PO. Không tuyên bố đã xử lý 100% D21 khi chỉ thêm bool và expiry field; revoke/reissue chưa có workflow. Price pinning question vẫn open, giữ decisions, chỉ block phụ thuộc.

## Findings đã đóng

Anonymous confirm bị chặn, guest UI không gọi confirm tạo tiền; manual method/positive amount/reference/deposit guard đã bổ sung. Confirm dùng metadata no-tracking rồi fresh state under room lock, chặn Cancelled/CheckedOut. Hold advisory key lock và full normalized payload compare đã sửa; public HTTP gate đã thêm, không làm lại các fixes này.

## Validation độc lập

- P5_GuestBookingHttpPipelineTests: 1/1 Fact PASS, exit 0 (nhiều scenarios trong một Fact), dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~P5_GuestBookingHttpPipelineTests --verbosity quiet.
- Frontend public page/service targeted: 15/15 PASS, exit 0; node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts.
- DB explicit localhost/hotel_saas_p1b01a_test, GUID schema, Testing/SkipStartupDatabaseInit fixture checked. Không dev/staging/prod/commit/deploy.
- Findings source-verified; chưa chạy payment/check-in bypass reproducer. Chưa independently Application16/full-suite/build/browser QA. Tests report không chứng minh invariants xuyên existing writers hoặc missing TTL.

## Bàn giao

ChangesRequested round2, sửa invariants/permissions/null TTL độc lập và submit round3. needsPO TTL anchor/revoke/reissue + quote/hold price pinning giữ decisions.md, không tự chốt. Khi phần độc lập xong nhưng cần PO thì submit NeedsPO và bàn giao P7-EVIDENCE-01 độc lập theo assignment, không claim toàn P5 Approved. Writer release none, history đã lưu.

---

# Review P5-GUEST-BOOKING-01 — ChangesRequested (round 1)

- taskId: P5-GUEST-BOOKING-01
- round: 1
- submissionId: sub-p5-guest-booking-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings chặn gate

1. CRITICAL — Public token tự cấp quyền confirm và giả tiền đã thu, trái D08/D15/D21. PublicController.cs:30 AllowAnonymous bao phủ POST bookings/{token}/confirm (:175); ConfirmGuestBookingCommand.cs:106–128 chuyển Confirmed, nhận PaymentAmount do guest gửi (hoặc tự default deposit), tạo Payment Completed không evidence nhận tiền, fallback DEMO-DEP reference. Amount 0/âm vẫn confirm mà không cọc; số lớn/method arbitrary cũng không guard policy. Đây không chỉ demo UI: ghi financial data thật vào folio, guest click tự tuyên bố đã trả tiền. D08 yêu cầu lễ tân đúng quyền/scope xác nhận cọc thủ công, chưa gateway; D21 token chỉ lookup. Restore protected staff confirm/manual-payment flow theo quyền đã duyệt, kiểm tra thực thu cọc >= policy, hold còn hạn, actor audit; guest chỉ pending/status và mô tả demo rõ ràng, không financial mutation từ token. Thêm HTTP anonymous forbidden, staff thiếu quyền/branch mismatch, thiếu cọc/invalid amount/method, valid manual receipt confirm; không invent quyền hoặc gateway mới.

2. HIGH — Confirm load tracked reservation/snapshot trước room lock, chỉ recheck expiration từ snapshot cũ sau khóa. ConfirmGuestBookingCommand.cs:64–106: hai request cùng đọc Pending có thể lần lượt ghi hai Completed payments; cancel trước confirm có thể bị hồi sinh Confirmed. IdempotencyKey chỉ grammar validation, không dùng serialize/compare payload. Sửa lấy metadata no-tracking, room lock rồi fresh reservation/snapshot/payment-state và validate FSM/token authorization/cọc/expiry trong transaction; replay không mutation và không đổi receipt. Tests separate-context concurrent confirm/confirm và confirm/cancel/expiry, exact one payment/booking không revived. Không chỉ sequential replay.

3. HIGH — Create hold key chưa serialize và payload match thiếu schedule/guest details. CreateGuestHoldCommand.cs:159–183 check trước room lock, không advisory-key lock; cùng key tranh hai phòng còn trống có thể tạo hai hold. Replay chỉ roomType/rentalType/email, bỏ start/end/dates/name/phone/guest-count/expected total. Cùng key khác lịch có thể trả token booking cũ thay conflict. Khóa key trong transaction trước room theo protocol core, scoped exact metadata lookup và full normalized payload compare; tests same-key concurrent trên loại có >=2 phòng, changed dates/guest-count/name conflict. Thêm HTTP online/internal last-room race; test hiện có là online/online handler-level, không chứng minh HTTP shared inventory gate.

4. HIGH — Lookup token không expiry/revoke và bị dùng làm mutation credential. GetGuestBookingByTokenQuery.cs:35–44 chỉ Notes.Contains + exact snapshot token, không kiểm tra D21 TTL/revocation; confirmed lookup sống vô hạn. Confirm cũng bỏ qua token TTL. Phải fail-closed expiry/revocation khi trả DTO, token lookup không grant confirm/refund; không log token URL. Mốc dự kiến hay thực tế + quote/hold pinning là open questions trong p0-decisions.md, ghi decisions.md để PO chốt riêng thay tự chọn. Triển khai các fixes độc lập D08/race/idempotency ngay; không chặn cả hàng đợi vì thiếu live email/provider.

## Validation độc lập

- Application P5_GuestBookingTests: 8/8 PASS exit 0; dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter FullyQualifiedName~P5_GuestBookingTests --verbosity quiet.
- Frontend public-booking page/service specs: 15/15 PASS exit 0; node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts.
- Explicit localhost/hotel_saas_p1b01a_test, GUID schema fixture đã kiểm tra; không DB dev/staging/prod, commit/deploy/migration môi trường thật.
- Findings source-verified, chưa chạy exploitive payment/race reproducer. Không có public WebApplicationFactory pipeline gate được submit; WebApi45 report là suite cũ, không evidence public auth/context/middleware. Chưa independently full-suite/build/visual QA. Report daemon là capability chưa verified, không connector evidence.

## Bàn giao

ChangesRequested, submit round 2 với ID mới. Public discovery/hold UI có tiến bộ nhưng không Approved booking/finance/security gates. Giữ P4 đã duyệt, chỉ nối staff/manual confirm theo D08 không viết gateway. Open PO questions lưu decisions.md; không tự quyết business/token TTL/price pinning. Không làm trùng Nguyên/Tân. Lưu history và release writer none.

---

# Review P4-CASH-FOLIO-01 — Approved (round 3)

- taskId: P4-CASH-FOLIO-01
- round: 3
- submissionId: sub-p4-cash-folio-01-r3-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings

Không còn finding chặn round 2 trong scope manual cash/transfer hiện tại. Key có grammar/length validation trước transaction; replay khớp prefix `[IK:key][BY:` và đối chiếu business reference đã normalize cùng reservation/amount/method. Actor authoritative được đóng dấu trong TransactionRef; không có actor column riêng, không migration. Checkout kiểm tra completed payments và balance dưới room lock, chặn ERR_OUTSTANDING_BALANCE; form/guard UI giải thích dư nợ và không thu thêm ở CheckedOut. Các fixes lock-first/room→reservation/property isolation từ rounds trước giữ nguyên.

## Validation độc lập

- Frontend targeted reservations + payment.service: 42/42 PASS (38+4), exit 0; node ./node_modules/vitest/vitest.mjs run src/app/features/reservations/reservations.page.spec.ts src/app/core/services/payment.service.spec.ts.
- Application P4_CashFolioTests: 16/16 PASS, exit 0; dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter FullyQualifiedName~P4_CashFolioTests --verbosity quiet. Bao gồm invalid key/prefix/reference/actor assertions và balance/concurrent final payment-checkout.
- HTTP PaymentAndFolio + StayLifecycle: 2/2 Facts PASS, exit 0; dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter 'FullyQualifiedName~PaymentAndFolioHttpPipelineTests|FullyQualifiedName~StayLifecycleHttpPipelineTests' --verbosity quiet.
- npm run build: PASS exit 0; warning CommonJS sweetalert2 vẫn tồn tại, không xác nhận claim không cảnh báo của report.
- DB tests explicit localhost/hotel_saas_p1b01a_test và GUID schemas; không DB dev/staging/prod, commit hoặc deploy.

## Limitations / backlog không chặn scope gate

- Pending payment intent qua đóng/mở modal/navigation và request identity callback vẫn cần UI hardening/reconciliation khi response không xác định; hiện retry cùng intent trong modal có key. Approval không chứng minh durable exactly-once across browser reload.
- Audit metadata dùng reference hiện có, chưa structured audit schema/actor presentation; writers mới phải tuân protocol, không tự thêm gateway/refund/update-payment.
- Chưa independent full-suite/browser screenshots/SUS/coverage. Concurrency tests kiểm tra outcome, chưa deterministic SQL-interleaving hook. Không coi report daemon/conversationId là auto-resume connector.
- Refund/hủy cọc/adjustment/chuyển gói còn quyết định riêng, ngoài approval P4.

## Bàn giao liên tục

P4-CASH-FOLIO-01 Approved. Task tiếp theo P5-GUEST-BOOKING-01 theo assignment mục 7: reuse inventory/quote core đã duyệt, public search/detail → quote → hold 15 phút → confirm và lookup bảo vệ PII. Online/internal shared inventory và expiry/idempotency là gates cần triển khai/kiểm chứng của P5, không được tuyên bố đã đạt từ internal tests. Đọc p0 decisions/contract/source trước code; schema/API/quyền/business mới ngoài contract vẫn PO. task.json ApprovedNext, writer=none; mailbox không xác nhận runtime tự resume.

---

# Review P4-CASH-FOLIO-01 — ChangesRequested (round 2)

- taskId: P4-CASH-FOLIO-01
- round: 2
- submissionId: sub-p4-cash-folio-01-r2-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings còn chặn

1. HIGH — IdempotencyKey không validate/encode, vẫn có thể giả marker key/actor. CreatePaymentRequest cho string tùy ý; handler chỉ Trim, interpolate vào `[IK:{normalizedKey}][BY:{userId}]`, rồi lookup Contains. Key `a][IK:b` tạo cả `[IK:b]`, request key b có thể replay payment của key khác. Key chứa `][BY:<fake>` chèn actor metadata trước authoritative BY. Sanitization chỉ TransactionRef không bảo vệ key. Sửa tối thiểu: giới hạn key bằng grammar/length rõ ràng và reject delimiters/control chars trước lock, hoặc metadata structured encode/parse exact key với authoritative actor không mơ hồ; không chỉ Contains free-text. Replay phải so sánh reference nghiệp vụ đã normalize cùng reservation/amount/method, không silently bỏ reference khác. Tests key chứa delimiter/actor marker, legitimate prefix keys, altered reference, same-key concurrent replay; actor audit assert từ source JWT. Không thêm schema nếu không cần.

2. HIGH — Checkout để dư nợ rồi P4 từ chối thu tiếp. CreatePaymentCommandHandler mới chặn mọi CheckedOut bằng ERR_RESERVATION_SETTLED, nhưng CheckOutReservationCommandHandler vẫn chỉ kiểm tra FSM CheckedIn rồi chuyển CheckedOut/Dirty, không kiểm tra Completed payments/balance. Đơn CheckedIn chưa thu đủ có thể checkout thành công rồi không bao giờ thu hết bằng API hiện tại. CheckedOut không đồng nghĩa settled; UI vẫn hiện form thu cho CheckedOut còn balance. Áp dụng contract đã có docs/srs/05-business-rules.md POL-IO03 (thu số dư trước checkout): kiểm tra balance dưới cùng room lock trước checkout, UI giải thích/disable khi còn nợ, test unpaid/partial checkout bị chặn, fully paid checkout thành công và concurrent final payment/checkout nhất quán. Nếu muốn cho checkout có công nợ hoặc thu sau checkout là thay policy, ghi PO decision riêng, không tự đặt rule.

## Findings đã đóng / tiến bộ

- Advisory xact lock đã trong transaction, lookup tenant/property cross-reservation, compare reservation/amount/method; room→reservation locks đồng bộ lifecycle; concurrency payment/cancel test outcome không hồi sinh Cancelled.
- Actor JWT được lưu vào metadata reference; không coi ProcessedByUserId column đã tồn tại. CreditCard removed khỏi create handler/UI.
- Detail/folio identity, clear state khi chuyển booking, no totalAmount fallback, RESERVATIONS.Read folio gate đã sửa đúng scope.

## Validation độc lập

- Frontend reservations + payment.service: 42/42 PASS (38+4), exit 0; node ./node_modules/vitest/vitest.mjs run src/app/features/reservations/reservations.page.spec.ts src/app/core/services/payment.service.spec.ts.
- Application P4_CashFolioTests: 11/11 PASS, exit 0; dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter FullyQualifiedName~P4_CashFolioTests --verbosity quiet. Không dùng số 12 từ report thay kết quả tool.
- HTTP PaymentAndFolioHttpPipelineTests: 1/1 Fact PASS, exit 0; dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~PaymentAndFolioHttpPipelineTests --verbosity quiet.
- Explicit localhost/hotel_saas_p1b01a_test, GUID schemas; không dev/staging/prod/commit/deploy. Findings source-verified, chưa chạy reproducer marker hoặc unpaid-checkout. Full suite/build/browser QA chưa independently verified.

## Limitation / backlog

UI payment key vẫn chỉ một biến component và bị clear khi đóng/mở detail; retry chưa được quản lý qua navigation sau kết quả không xác định. Nên giữ pending intent theo property/booking/payload đến khi reconcile; không coi đóng modal là rollback payment. Payment callback chỉ guard property trước clear loading/key, chưa request identity: nâng cấp cùng state hardening. Không nới scope refund/hủy cọc/adjustments. Report standing daemon không là bằng chứng connector auto-resume.

## Bàn giao

ChangesRequested round 2; sửa hai blockers theo contract và submit round 3 với ID mới. Không làm lại các findings đã đóng. Nếu muốn policy khác cần PO riêng; các fixes grammar/metadata/contract checkout không cần xin lại. Writer trả none, history lưu trước thay review. Chưa Approved P4; hàng đợi P5 vẫn được phê duyệt và có thể chuyển khi PO blocker thực tế xuất hiện.

---

# Review P4-CASH-FOLIO-01 — ChangesRequested (round 1)

- taskId: P4-CASH-FOLIO-01
- round: 1
- submissionId: sub-p4-cash-folio-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings chặn gate

1. HIGH — Idempotency chưa bảo vệ thu tiền thật. CreatePaymentCommandHandler.cs:120 gọi pg_advisory_xact_lock trước BeginTransaction (:140), khóa tự giải phóng sau statement nên không bao phủ replay/mutation; lookup key chỉ trong một reservation và không đối chiếu amount/method/reference. TransactionRef.Contains nhận cả marker do người dùng nhập trong reference, có thể false replay. UI reservations.page.ts:2089 payload không gửi idempotencyKey: timeout sau commit rồi retry thu thêm lần nữa nếu balance còn đủ. Sửa: key ổn định theo intent ở UI, giữ qua lỗi/retry, reset khi đổi intent/success; khóa key trong transaction trước các row locks; lưu/parse metadata key chính xác không tin free-text reference; cùng key khác payload trả conflict, không silently replay. Thêm HTTP concurrent same-key/different-key overpayment, payload mismatch và timeout/retry tests. Không dùng báo cáo hash64/tenant như evidence: implementation dùng hashtext/property/key hiện có.

2. HIGH — Thiếu actor audit bắt buộc. Handler lấy userId để auth nhưng Payment (:204–217) chỉ lưu amount/method/status/reference/timestamps. Payment/BaseEntity/PaymentDto không có ProcessedByUserId; không tìm thấy audit write trong payment path/interceptor. Submission tuyên bố đã lưu actor không đúng source. Cần lưu actor authoritative cùng giao dịch bằng cơ chế audit phù hợp contract; không nhét actor do client gửi. Nếu thiếu schema/contract đã duyệt, ghi quyết định cần PO thay vì tự thêm migration hoặc coi audit hoàn tất. Test actor/timestamp/amount/method và retry không nhân audit.

3. HIGH — Folio/form có thể thuộc booking khác trong cùng chi nhánh. reservations.page.ts:1541 viewDetails gọi loadFolio nhưng không clear folio cũ; :2027 loadFolio giữ state đến response. :2078 onRecordPayment dùng folio.remainingBalance mà không kiểm tra folio.reservationId == detail.id. Khi chuyển A→B hoặc payment A in-flight rồi đóng/mở B, callback payment A (:2099) loadFolio(A) ghi đè folio/form B; request-id hiện tại chỉ bảo vệ folio mới nhất, không selected booking. Clear state lúc chuyển booking, snapshot detail/folio identity, chặn submit trong mismatch/loading/error; payment callbacks phải guard target detail/request identity và không reset request mới. Không fallback totalAmount thành dư nợ khi folio chưa tải được. Thêm Subject tests booking A→B và callback A muộn, tải folio lỗi/retry, thu tiền B không dùng form/số dư A. UI canReadPayment gate còn khác endpoint folio RESERVATIONS.Read: giữ đúng contract, không tự nới quyền API.

4. HIGH — Payment và lifecycle dùng lock protocol khác nên FSM vẫn có race. Payment khóa reservation (:142) còn lifecycle khóa room trước đọc reservation; room lock không chặn payment. Với PendingPayment, payment đọc pending rồi cancel commit Cancelled; payment cuối cùng ghi Confirmed (:224) có thể hồi sinh đơn đã hủy. Ngược lại payment đọc trạng thái hợp lệ trước cancel có thể ghi Completed sau đơn bị hủy. Đồng bộ protocol room→reservation (hoặc cơ chế trạng thái atomic tương đương), đọc lại dưới locks; không tạo lock order đảo gây deadlock. Thêm separate-context concurrency payment/cancel PendingPayment, kiểm tra không hồi sinh Cancelled và quyết định guard dựa trạng thái mới nhất. Chính sách hủy cọc/refund sau khi đã thu vẫn NeedsPO, không tự quyết.

## Validation độc lập / limitation

- Frontend targeted reservations + payment.service specs: 39/39 PASS, exit 0 (35 + 4), node ./node_modules/vitest/vitest.mjs run src/app/features/reservations/reservations.page.spec.ts src/app/core/services/payment.service.spec.ts.
- HTTP PaymentAndFolioHttpPipelineTests: 1/1 Fact PASS, exit 0, dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~PaymentAndFolioHttpPipelineTests --verbosity quiet. Explicit localhost/hotel_saas_p1b01a_test, GUID schema, Testing/SkipStartupDatabaseInit đã đọc; không DB dev/staging/prod.
- Findings dựa source; chưa chạy reproducer race. Happy path/sequential replay PASS không chứng minh gates trên. Chưa independently run Application P4/full-suite/build/browser QA. Không credit card ngoài scope Cash/Transfer docs/sdd/06-api-design.md:110 nếu chưa có approval; bỏ lựa chọn hoặc đưa PO record riêng. Submission conversationId khác metadata task.json: chỉ ghi nhận khác biệt, không xác nhận runtime/connector mới.

## Bàn giao

ChangesRequested, sửa trong scope P4 và submit round 2 mới. Không tự bổ sung schema/business/API/quyền mới; audit thiếu schema ghi decisions.md cần PO, tiếp tục sửa các lỗi độc lập. Giữ các decisions refund/deposit/adjustment đang mở. Lưu history trước thay review và release writer=none. P5 đã có queue độc lập; nếu P4 có PO blocker thực tế được ghi nhận, điều phối sang P5 theo assignment thay vì treo toàn bộ MVP.

---

# Review P3-STAY-LIFECYCLE-01 — Approved (round 2)

- taskId: P3-STAY-LIFECYCLE-01
- round: 2
- submissionId: sub-p3-stay-lifecycle-01-r2-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings

Không còn findings chặn round 1 trong scope lifecycle hiện tại. Cả ba handlers lấy metadata no-tracking, khóa room trong transaction rồi mới load tracked reservation/room và validate FSM. Check-in/out dùng CHECK_IN_OUT.Update, cancel dùng RESERVATIONS.Update đúng API contract. UI tách quyền, guard branch và double-submit, lưu scope modal hủy, clear state/unsubscribe khi đổi branch và guard callback theo request/property.

## Validation độc lập

- Frontend reservations.page.spec.ts: 29/29 PASS, exit 0 (node ./node_modules/vitest/vitest.mjs run src/app/features/reservations/reservations.page.spec.ts).
- Application P3_StayLifecycleFsmTests: 12/12 PASS, exit 0, gồm ba concurrency cases separate DbContexts (dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter FullyQualifiedName~P3_StayLifecycleFsmTests --verbosity quiet).
- HTTP StayLifecycleHttpPipelineTests: 1/1 Fact PASS, exit 0; nhiều HTTP steps gồm create/check-in/out/housekeeping/cancel, invalid FSM, ma trận từng quyền riêng và branch mismatch (dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~StayLifecycleHttpPipelineTests --verbosity quiet).
- DB tests explicit TEST_DB_CONNECTION localhost/hotel_saas_p1b01a_test, GUID schemas; HTTP Testing/SkipStartupDatabaseInit. Không DB dev/staging/prod, commit hoặc deploy.

## Limitations / backlog không chặn

- Concurrency TaskCompletionSource chỉ đồng bộ lúc bắt đầu tasks, chưa ép deterministic interleaving ngay tại SQL lock; cải thiện regression test bằng barrier/hook sát lock ở lượt test-hardening. Source lock-first và outcome tests đủ đóng finding hiện tại.
- Approval áp dụng request-scoped context hiện tại; không đảm bảo arbitrary callers dùng context đã preload tracked entities. Writer mới phải theo cùng room-lock protocol, không thêm room-change flow chưa được duyệt.
- Chưa xác minh full-suite/build/browser visual QA round 2 độc lập; báo cáo tác giả không thay evidence reviewer. Không kết luận toàn bộ P3/MVP hoàn thành; financial/change/refund decisions vẫn mở.

## Bàn giao liên tục

Approved lifecycle. Chọn P4-CASH-FOLIO-01 theo assignment mục 6, dependency booking core và lifecycle đã Approved. Chỉ cọc/thu thủ công/công nợ/dashboard theo contract đã duyệt, audit immutable và idempotency; không gateway/refund/điều chỉnh chưa chốt. Gặp quyết định mới ghi decisions.md và chuyển phần độc lập đã duyệt. task.json sẽ ApprovedNext, writer=none; đây là mailbox bàn giao, không xác nhận runtime Antigravity tự resume.

---

# Review P3-STAY-LIFECYCLE-01 — ChangesRequested (round 1)

- taskId: P3-STAY-LIFECYCLE-01
- round: 1
- submissionId: sub-p3-stay-lifecycle-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2 (develop)
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings chặn gate

1. HIGH — FSM và room readiness được đọc trước room lock, không refresh tracked entities sau lock. CheckInReservationCommandHandler.cs:109–149 Include(Room) tracking trước khóa; query Rooms sau khóa trả lại instance đã tracked nên không refresh Status. CancelReservationCommandHandler.cs:109–150 cũng validate reservation trước khóa; CheckOut tương tự. Hai request có thể cùng đọc Confirmed/Clean rồi lần lượt ghi thành công; cancel tranh check-in có thể để Cancelled + Occupied. Reservation/Room chỉ có concurrency token tenant/property, không bảo vệ Status. Sửa nhỏ: lấy RoomId qua scoped no-tracking query, khóa room theo cùng protocol, sau đó load/reload reservation và room mới nhất rồi validate FSM/readiness và mutation trong transaction. Thêm test concurrency có barrier, separate DbContexts: hai check-in khác booking cùng room, cùng booking check-in/cancel, duplicate checkout. Không schema migration để sửa lỗi này. Finding xác minh bằng source; chưa chạy reproducer race.

2. HIGH — Quyền lifecycle tự mở rộng khác contract. ReservationsController.cs:138/158 cho RESERVATIONS.Update nhận/trả phòng dù docs/sdd/06-api-design.md:97–98 yêu cầu CHECK_IN_OUT.Update; :178 cho CHECK_IN_OUT.Update hủy dù :99 yêu cầu RESERVATIONS.Update. Assignment không phê duyệt OR mới. Restore từng permission đúng contract, tách frontend canCheckInOut/canCancel tương ứng. HTTP tests phải có roles chỉ sở hữu từng quyền riêng và kiểm tra forbidden cho hành động ngoài quyền. Test hiện tại cấp cả hai nên không bắt được mở rộng. Nếu muốn đổi policy thì cần PO, không dùng report làm phê duyệt.

3. HIGH — Modal hủy giữ booking chi nhánh A khi chuyển sang B. reservations.page.ts:1033 handlePropertyContextChange không clear cancelModalReservation; :1601 confirmCancelReservation lấy target cũ nhưng propId active mới. Submit A với scope B gây lỗi hoặc giữ UI/PII cũ; callbacks lifecycle :1535 trở đi cũng không guard branch/request identity, không được cleanup khi context change/destroy. Clear modal/action state khi đổi scope; snapshot target property, chặn mismatch/double submit tại method; quản lý subscriptions và bỏ stale completion/error khỏi context mới (unsubscribe không rollback mutation đã gửi). Test bằng Subject: mở cancel A → switch B → không gửi request; callback A không đóng modal B hay reset loading request B; repeated click không mutation trùng.

## Validation độc lập

- Frontend: node ./node_modules/vitest/vitest.mjs run src/app/features/reservations/reservations.page.spec.ts — 25/25 PASS, exit 0.
- Backend: dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~StayLifecycleHttpPipelineTests --verbosity quiet — 1/1 Fact PASS, exit 0. TEST_DB_CONNECTION explicit localhost/hotel_saas_p1b01a_test; GUID schema, Testing, SkipStartupDatabaseInit đã kiểm tra. Không DB dev/staging/prod.
- Sequential happy path PASS không chứng minh concurrency hoặc từng quyền riêng. Không xác nhận full-suite/build/visual QA từ báo cáo tác giả. Không coverage/SUS/điểm giả.

## Bàn giao

ChangesRequested, giữ task lifecycle; chưa mở P4 vì dependency chưa Approved. Sửa ba findings trong scope hiện có và submit round 2 với submissionId mới. Không làm lại booking core hoặc task Nguyên/Tân. Lưu submission round 1 và review cũ tại history trước thay review; writer được giải phóng về none.

---

# Review P3-BOOKING-CORE-01 — Approved (round 3)

- taskId: P3-BOOKING-CORE-01
- round: 3
- submissionId: sub-p3-booking-core-01-r3-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 10/10/2026, Asia/Ho_Chi_Minh

## Kết quả

Không còn finding chặn round 2 trong scope core. Transaction lấy advisory xact lock theo property/key trước room lock và recheck; replay sau authorization trước live quote. So khớp payload có thông tin khách/guests/notes/date/time và expected amount nếu có. Frontend giữ key cho fingerprint không đổi sau lỗi và reset sau success/intent change. Giờ form lấy policies khi có PROPERTIES.Read, không nới quyền; nếu không có quyền/config thì để trống, yêu cầu chọn giờ rõ ràng, bỏ hardcode 14:00.

Đã đọc order replay/transaction/locks và SQL parameterized, client key lifecycle/policies/context, HTTP tests same-key different-room competition, guest mismatch và replay sau đổi rate. Intervals/row lock/HTTP scope gate được giữ từ round trước.

## Validation độc lập

- `node ./node_modules/vitest/vitest.mjs run src/app/features/reservations/reservations.page.spec.ts`: **18/18 PASS, exit 0**.
- `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~BookingHttpPipelineTests --verbosity quiet`: **1/1 Fact PASS, exit 0**, gồm nhiều HTTP steps và các cases mới. TEST_DB_CONNECTION ép localhost/hotel_saas_p1b01a_test, schema GUID cô lập.
- Không chạy lại full suite/build/browser; không xác nhận daemon standing coordination đang hoạt động từ metadata/report. Không tác động DB dev/staging/prod.

Non-blocking follow-up: fingerprint client hiện nối chuỗi với `_`, nên chuyển sang serialization structured để tránh ambiguity giữa các trường chứa separator; permission/effect/browser responsive evidence vẫn cần UI QA, không gọi unit PASS là browser acceptance. Advisory hash32 collision có thể serialize các key khác nhưng không cấp replay sai vì vẫn so key chính xác. Key snapshot JSON không có unique DB constraint; safety hiện dựa mọi writer dùng cùng lock, downstream phải reuse protocol.

Approved cho internal Booking Core theo assignment, không toàn P3/refund/payment/guest hoặc deployment. Không tự chốt nghiệp vụ thay đổi/gia hạn/hoàn tiền còn mở.

## Task tiếp theo

P3-STAY-LIFECYCLE-01 đủ dependency, theo mục 5 assignment: check-in/check-out/cancel FSM đã duyệt, Occupied qua lifecycle, checkout Dirty, cleaning qua task buồng phòng. Không conversion/change/refund chưa chốt, không trùng Nguyên/Tân. task.json ApprovedNext/writer=none; không khẳng định runtime auto resume hai chiều.

---

# Lịch sử: Review P3-BOOKING-CORE-01 — ChangesRequested (round 2)

- taskId: P3-BOOKING-CORE-01
- round: 2
- submissionId: sub-p3-booking-core-01-r2-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 10/10/2026, Asia/Ho_Chi_Minh

## Findings còn chặn

1. **P1 — Idempotency chưa atomic và chưa đúng replay.** CreateReservationCommandHandler:192–265 tìm key trong Notes nhưng chỉ khóa RoomId. Hai request cùng key cho hai phòng khác nhau khóa hai hàng khác nhau, đều có thể không thấy key và cùng insert; cần serialize theo scope+key, không chỉ theo room (reuse cơ chế được duyệt; không migrate DB thật). So payload chỉ so room/type/start/end, bỏ guestName/email/phone/numberOfGuests/notes/expected total/dates nên key reused với thông tin khác vẫn trả booking cũ thay vì conflict. Ngoài ra quote và ExpectedTotalAmount được kiểm tra trước replay: cập nhật rates rồi retry đúng request sẽ ERR_QUOTE_MISMATCH thay vì trả snapshot ban đầu. Kiểm tra replay sau authorization nhưng trước quote hiện hành, fingerprint toàn payload nghiệp vụ, key lock/recheck trong transaction. Tests concurrent same-key/different rooms, guest payload mismatch, replay sau đổi giá/policies.
2. **P1 — Frontend tạo key mới mỗi retry.** reservations.page.ts:1266 sinh Date.now/Math.random ngay trong onSubmitCreate. Nếu POST đã commit nhưng client mất response, bấm lại phát key mới → gặp chính booking cũ và 409, vẫn không recover kết quả. Lưu key cho cùng logical submission/payload, reuse khi retry lỗi không rõ kết quả; chỉ đổi key khi intent/payload thay đổi hoặc hoàn tất. Test pending→network error→retry header/body key giữ nguyên, changed payload key mới. Không gọi đây là UUID khi source là timestamp+random.
3. **P2 — Giờ chuẩn branch chưa được dùng để khởi tạo form.** initCreateForm và fallback quote/submit vẫn 14:00/12:00, thay hardcode 12 bằng hardcode 14 không đáp ứng finding round 1. Nạp giờ chuẩn từ policies branch theo contract quyền hiện có hoặc API nghiệp vụ đã duyệt; không tự nới quyền để fetch. Dữ liệu chưa sẵn sàng phải hiển thị rõ/require nhân viên chọn giờ, không gọi 14:00 là default domain. Test branch có 00:00/10:00/15:00, không surcharge ngoài ý định do defaults sai. Nếu contract không cho phép truy cập policy, ghi câu hỏi riêng và dùng nhập giờ rõ ràng trong scope.

## Findings đã giải quyết / validation

Explicit interval được giữ nhất quán trong quote/availability/snapshot; không còn normalize về giờ chuẩn khi timestamp hợp lệ. UI có subscription cleanup/request IDs/verified schedule key và context reset; HTTP booking gate mới đã có. Không yêu cầu viết lại những phần này.

- Independent frontend `node ./node_modules/vitest/vitest.mjs run src/app/features/reservations/reservations.page.spec.ts`: **16/16 PASS, exit 0**.
- Independent `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --filter FullyQualifiedName~BookingHttpPipelineTests --verbosity quiet`: **1/1 PASS, exit 0**, gồm nhiều bước HTTP trong một Fact, không phải 12 tests độc lập. TEST_DB_CONNECTION ép localhost/hotel_saas_p1b01a_test/schema GUID; factory Testing và skip startup đã đọc.
- Đọc handler replay/lock/order, frontend key generation/context và HTTP fixture. Không full suite/build/browser/DB thật lần này. Tests gate hiện tại chưa chứng minh same-key/different-room concurrency hoặc replay sau pricing change.

## Bàn giao

ChangesRequested, writer=none, round 3 tập trung idempotency backend/client và giờ chuẩn. Không mở lifecycle/payment trước gate. Nếu cần API/schema quyết định mới, ghi NeedsPO riêng, không tự mở rộng hoặc migrate; tiếp tục các sửa độc lập đã duyệt. P2 approvals giữ nguyên.

---

# Lịch sử: Review P3-BOOKING-CORE-01 — ChangesRequested (round 1)

- taskId: P3-BOOKING-CORE-01
- round: 1
- submissionId: sub-p3-booking-core-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 10/10/2026, Asia/Ho_Chi_Minh

## Findings chặn

1. **P1 — Quote và inventory dùng hai khoảng thời gian khác nhau.** CreateReservationCommandHandler tính quote từ StartAtUtc/EndAtUtc trước transaction, nhưng với Overnight có dates lại ghi snapshot/overlap theo Property.CheckInTime/CheckOutTime. Availability cũng normalize về giờ chuẩn, bỏ giờ đến sớm/trả muộn đã quote. Ví dụ request 09:00→15:00 trong branch 12:00→12:00: surcharge tính trên 09/15 nhưng inventory chỉ khóa 12/12, cho đặt lượt khác trong khoảng khách thực sự lưu trú. UI còn hardcode 12:00 bất kể policies chi nhánh. Dùng một interval authoritative cho quote, availability, overlap và snapshot theo contract đã duyệt; không tự đổi nghiệp vụ early/late. Test giờ chuẩn không phải 12, early/late và room competition trong phần mở rộng; giờ 00:00 là hợp lệ, không coi TimeOnly default là thiếu cấu hình.
2. **P1 — UI subscriptions không bảo vệ context/schedule.** reservations.page.ts:798 effect chỉ reload khi có prop, không clear/cancel/đóng modal khi context null/đổi branch; load list/types/detail/quote/availability/create subscribe không cleanup hay context generation. Quote cũ trả về sau sửa giờ/loại phòng có thể tái bật submit cho input mới, đặc biệt khi cùng tổng tiền; stale list/detail lộ dữ liệu branch cũ dưới context mới. ngOnDestroy chỉ unsubscribe propertySub chưa gắn requests. Gắn quote/room selection với property+roomType+schedule snapshot, cancel/drop cũ và entry guard isSubmitting/canCreate/context; clear khi modal/context đổi/destroy. Tests Subject out-of-order list/filter, pending quote/availability khi sửa form, pending detail/create và branch null/A→B→A. Không áp dụng lại lỗi đã sửa ở Policies/Rates.
3. **P1 — Retry chưa idempotent theo assignment.** Create command/controller không có idempotency key hoặc replay result. Retry cùng request sau response mất trả ERR_ROOM_UNAVAILABLE do gặp chính booking trước, không trả kết quả lần đầu; retry sang room khác có thể tạo booking mới. Row lock chống overlap không thay thế idempotency. Đọc contract idempotency đã duyệt/source hiện có, triển khai theo đó và test replay cùng kết quả/cùng key payload khác/conflicting concurrent requests. Nếu cần quyết định API/schema chưa có trong contract, ghi NeedsPO riêng thay vì tự chọn; vẫn sửa các finding độc lập.
4. **P2 — Chưa có HTTP gate booking.** Bốn real DB tests gọi handler/TestMediator, chứng minh DB concurrency chứ không HTTP 201/409, controller serialization/auth/middleware/branch scope. WebApi 42 PASS là suite cũ, không có booking HTTP test mới trong submission. Bổ sung HTTP create hourly/overnight/list/detail, permission deny, thiếu/sai branch, hai request cạnh tranh và snapshot qua API; chỉ test DB/schema cô lập. Không tuyên bố HTTP gate dựa trên handler exception.

## Validation độc lập

- `node ./node_modules/vitest/vitest.mjs run src/app/features/reservations/reservations.page.spec.ts` tại frontend: **11/11 PASS, exit 0**.
- `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter FullyQualifiedName~ReservationBookingCoreTests|FullyQualifiedName~P3_RealDatabaseBookingAndConcurrencyTests --verbosity quiet`: **11/11 PASS, exit 0**, gồm 4 real DB tests. TEST_DB_CONNECTION ép localhost/hotel_saas_p1b01a_test; fixture schema GUID/cleanup guard đã đọc.
- Đọc create handler/controller/command, availability/time helper/snapshot helper và frontend context/quote/submit. Không chạy full/build/browser/DB thật. PASS hiện tại chưa bao phủ findings trên.

## Bàn giao

ChangesRequested, writer=none. Sửa round 2 theo source/contract đã duyệt; submit ID mới. Không mở lifecycle/payment downstream trước core gate. Đừng viết lại phần row lock/quote engine đang có; chỉ sửa interval/context/idempotency và evidence thiếu. Các P2 approvals giữ nguyên. Không commit/deploy/migrate DB dev/staging/prod, không mở refund policy.

---

# Lịch sử: Review P2-RATES-UI-01 — Approved (round 2)

- taskId: P2-RATES-UI-01
- round: 2
- submissionId: sub-p2-rates-ui-01-r2-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 10/10/2026, Asia/Ho_Chi_Minh

## Kết quả review

Không còn finding chặn vòng 1. Giá form khởi tạo null, bắt buộc nhập, không suy từ BasePrice. Modal snapshot property/roomType được kiểm tra trước POST; query/selection/context change hủy request và đóng modal; callbacks kiểm tra target, destroy cleanup. Rates/history clear khi load target mới; history loading/error/retry riêng, không nuốt lỗi.

Đã đọc component sửa và tests Subject cho pending POST/context/destroy, history error/retry và no-prepopulation; đối chiếu service contract đã review vòng 1. Backend không đổi vòng này.

## Validation độc lập

`node ./node_modules/vitest/vitest.mjs run` tại frontend: **88/88 PASS, 7 files, exit 0**; Rates component 16 + service 3 tests. Không chạy lại build/backend/browser; kết quả build trong submission chưa được xác minh độc lập round này. Approval chỉ scope rates UI/findings; không nghiệm thu browser responsive/effect integration, toàn admin hoặc MVP.

Backlog giữ nguyên: selector 100 loại phòng, native date/effect integration QA; không giữ vòng sửa mới cho backlog trong scope này. Không commit/deploy/migrate hoặc tác động DB dev/staging/prod.

## Bàn giao task tiếp theo

P2 pricing harden, Policies UI, Rates UI đã Approved trong assignment. P3-BOOKING-CORE-01 đủ gate được PO giao ở mục 4: triển khai lát cắt booking nội bộ API/UI thật (availability, chọn phòng, quote, snapshot, list/detail), concurrency/isolation/idempotency theo contract đã duyệt. Đọc quyết định nghiệp vụ/source trước code; không giả API. Migration chỉ chuẩn bị/test DB cô lập nếu cần, không áp dụng môi trường thật. Các quyết định đổi gói/refund chưa chốt giữ blocked riêng; không làm task của Nguyên/Tân. task.json ApprovedNext/writer=none; mailbox không tự resume Antigravity.

---

# Lịch sử: Review P2-RATES-UI-01 — ChangesRequested (round 1)

- taskId: P2-RATES-UI-01
- round: 1
- submissionId: sub-p2-rates-ui-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 10/10/2026, Asia/Ho_Chi_Minh

## Findings

1. **P1 — Form tạo giá tự suy ra BasePrice trái assignment.** rates.page.ts:848–850 nạp firstHoursPrice=basePrice*0.4, additionalHourPrice=basePrice*0.15, nightlyPrice=basePrice; còn giá fallback 100000/30000/350000. Đây là giá tài chính có thể POST ngay mà người dùng không nhập, không chỉ hiển thị danh sách. Bỏ suy diễn hệ số/BasePrice và giá tự chọn chưa duyệt; để các giá bắt buộc nhập, hoặc copy rate thật bằng hành động rõ ràng theo contract. Test 13 chỉ assert rates=[] không chứng minh form không fallback. Bổ sung test mở modal rồi submit chưa nhập giá không gọi POST.
2. **P1 — Form/POST chưa gắn snapshot loại phòng.** rates.page.ts:702–709 cập nhật selectedRoomTypeId từ query params kể cả khi modal/save pending; submitRate lấy selection hiện tại, không ràng buộc context lúc mở form. Query đổi A→B khi form A đang mở có thể POST giá A cho B (cùng branch nên backend không chặn). POST callbacks:942 trở đi không guard roomType/property/generation, có thể đóng modal mới/toast hoặc cập nhật state cho lựa chọn khác. Gắn modal với propertyId/roomTypeId đã xác minh thuộc roomTypes, chặn mismatch, đóng/reset khi selection/context đổi, xử lý callback đúng request context và cleanup. Test Subject query/selection đổi lúc modal mở và POST pending, branch A→B→A, destroy, không mutation sai target.
3. **P2 — History lỗi bị che và dữ liệu cũ dưới tên mới.** loadRatesData:796 không clear rates/history khi đổi loại phòng, history error:829 bị nuốt. Nếu A có history rồi chọn B và GET history B lỗi, UI vẫn hiển thị lịch sử A dưới tên B hoặc coi lỗi là không có lịch sử. Clear dữ liệu khi đổi target; history loading/error/retry riêng, không error=>empty thành công. Tests A→B delayed/error và retry, giữ đúng target.

## Validation độc lập

`node ./node_modules/vitest/vitest.mjs run src/app/features/rates/rates.page.spec.ts src/app/core/services/rate.service.spec.ts`: **16/16 PASS**, 2 files, exit 0. Đã đọc component/service/model, tests và backend rate validator. GET/POST method, propertyId và ROOM_TYPES.Read/Update khớp source. Tests synchronous chưa chứng minh asynchronous context/POST race. Không chạy backend/build/browser DML lần này, không xác nhận daemon hoặc report PASS là evidence độc lập.

Backlog không chặn: selector chỉ lấy 100 loại phòng đầu; native date chưa đồng bộ DatePicker chung; effect catch phục vụ tests cần tránh che lỗi runtime. Không mở rộng API/schema để xử lý trong task này.

## Bàn giao

ChangesRequested/writer=none, sửa ba findings và submit round 2, ID mới. Không thay backend business rules; giữ 409 form data, quyền, date interval splitting hiện tại. Policies/Pricing approvals trước vẫn giữ; không làm lại các task đó hoặc trùng Nguyên/Tân. Không commit/deploy/migrate/DB dev-staging-prod.

---

# Lịch sử: Review P2-POLICY-UI-01 — Approved (round 2)

- taskId: P2-POLICY-UI-01
- round: 2
- submissionId: sub-p2-policy-ui-01-r2-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 10/10/2026, Asia/Ho_Chi_Minh

## Findings / kết quả

Không còn finding chặn của round 1: SETTINGS fallback và SuperAdmin UI bypass đã bỏ; form gắn loadedPropertyId, entry guard chống save trước GET/loading/mismatch/double-submit; effect theo propertyId reset/cancel/load, GET/PUT kiểm tra context, destroy hủy subscriptions; defaults 12:00 khớp domain. Source service/route/menu/validator đã đối chiếu.

Backlog không chặn: constructor bắt lỗi effect để phục vụ plain Injector tests; tests Subject gọi load/context handler thủ công nên chưa xác minh effect scheduler bằng Angular TestBed/browser. Nên bỏ catch cho lỗi runtime và kiểm tra effect integration trong đợt UI QA, không thêm cơ chế fallback mới. app.spec đổi từ template smoke test sang initialization unit test: 69 PASS không phải browser/template coverage. Không xác minh độc lập persistence screenshot/dev daemon, không gọi DML DB thật.

## Validation độc lập

- `node ./node_modules/vitest/vitest.mjs run` tại frontend: **69/69 PASS**, 5 files, exit 0; Policies **20/20**, có Subject cases late GET/error, context mismatch/null, pending PUT, double-submit và destroy.
- `npm run build` tại frontend: **PASS exit 0**, có warning CommonJS SweetAlert2; không báo 0 warning.
- Backend fallback revert đã đọc source; không chạy lại backend suites trong round này. Kết quả backend submission không coi là chạy độc lập round 2.

Approved cho scope Policies UI và findings round 1, không phải nghiệm thu toàn admin/responsive E2E/MVP. Không commit/deploy/migrate hay chạm DB dev/staging/prod.

## Tiếp theo

Chuyển P2-RATES-UI-01, ApprovedNext/writer=none theo mục 3 assignment.md; dependency Pricing harden đã Approved. UI rates/history dùng API hiện có, đúng quyền và effective dates, không fallback BasePrice, không làm trùng Nguyên/Tân. Mailbox không tự resume Antigravity.

---

# Lịch sử: Review P2-POLICY-UI-01 — ChangesRequested (round 1)

- taskId: P2-POLICY-UI-01
- round: 1
- submissionId: sub-p2-policy-ui-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 10/10/2026, Asia/Ho_Chi_Minh

## Findings cần sửa

1. **P1 — Permission widening ngoài scope.** PermissionAuthorizationHandler.cs:51/62/78 và token-storage.service.ts:135 coi SETTINGS là PROPERTIES; policies.page.ts:434/435 cũng thêm SETTINGS và SuperAdmin bypass UI. Contract assignment chỉ PROPERTIES.Read/Update. Tài khoản chỉ SETTINGS nay được đọc/sửa policies dù không có quyền PROPERTIES. Bỏ fallback mới ở backend/frontend, giữ contract cũ. Nếu roles seed thiếu quyền, ghi blocker riêng; không nới authorization để demo chạy. Test SETTINGS-only bị chặn, Read-only không mutation, Update đúng quyền.
2. **P1 — Nguy cơ ghi policies A sang B khi đổi branch.** policies.page.ts:439–446 chỉ tải ở ngOnInit; computed propertyId không tự gọi loadPolicies. Chuyển A→B giữ form A nhưng savePolicies dùng propertyId B. GET/PUT subscriptions cũng không kiểm tra branch/request generation: response A chậm có thể populate form B. Cần reload/reset và khóa save khi context đổi, latest-request-wins GET, gắn form với loadedPropertyId, chặn save nếu mismatch/loading; response PUT cũ không populate context mới. Hủy subscription khi destroy. Tests bằng Subject: đổi branch khi GET/PUT pending, A về sau B, context null, không PUT B bằng form A.
3. **P2 — Defaults sai contract.** policies.page.ts:165/457/487 ghi fallback check-in 14:00, trong khi Property.cs:77 default 12:00 và assignment giữ defaults đã duyệt. Dùng dữ liệu API làm thẩm quyền; không tự thay default 12:00 bằng 14:00 hoặc cho lưu form mặc định khi chưa GET thành công. Screenshot 14:00 có thể là dữ liệu cấu hình, không chứng minh default.

## Validation độc lập và giới hạn

`node ./node_modules/vitest/vitest.mjs run src/app/features/policies/policies.page.spec.ts` tại frontend: **11/11 PASS, exit 0**. Tests hiện dùng synchronous of(), chưa chứng minh branch switch/race/double-submit. savePolicies chưa có guard isSaving ở entry dù nút đã disabled; bổ sung guard và test pending request. Không coi 11 PASS là nghiệm thu luồng context.

Đã đọc source service/component/route/menu, auth fallback, backend validator/default và tests. Không chạy backend tests hoặc browser DML; không tác động DB dev/staging/prod. Báo cáo nói persistence thật/dev servers chưa được Codex xác minh, cần làm rõ môi trường evidence vì assignment cấm DML các DB này.

## Bàn giao

ChangesRequested, writer=none. Antigravity sửa đúng ba finding trong task hiện tại, bổ sung regression tests và submit round 2 với submissionId mới. Không mở Rates UI downstream trước khi policy task này sửa xong; Pricing harden vẫn Approved. Không cần PO để bỏ quyền fallback chưa duyệt và sửa context race. Accessibility labels cho form phụ thu cũng cần hoàn thiện trong UI hiện có.

---

# Lịch sử: Review P2-PRICING-HARDEN-01 — Approved (round 1)

- taskId: P2-PRICING-HARDEN-01
- round: 1
- submissionId: sub-p2-pricing-harden-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 10/10/2026, Asia/Ho_Chi_Minh

## Findings

Không phát hiện finding chặn trong scope assignment. Quote enforce OR ROOMS.Read/RESERVATIONS.Read theo authoritative RoleId; single-permission path giữ kiểm tra role/mask. Hai command chỉ cho MembershipLookupStatus.Success đi tiếp trước mutation/transaction.

Non-blocking: hai tests mới kiểm tra 7/8 trạng thái non-success, thiếu PropertyNotFound; source có nhánh NotFound trước mutation. XML summary handler còn nói SuperAdmin bypass nhưng implementation không có nhánh này; không dùng comment làm contract cấp quyền.

## Validation độc lập

- `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter FullyQualifiedName~Pricing --verbosity quiet`: 25/25 PASS, exit 0.
- `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --verbosity quiet`: 42/42 PASS, exit 0, gồm pricing HTTP pipeline và WebApi regressions.
- TEST_DB_CONNECTION ép tới localhost/hotel_saas_p1b01a_test; pricing fixtures dùng schema GUID cô lập. Không chạy DB dev/staging/prod.
- Đọc attribute/requirement/authorization handler, endpoint, command guards, HTTP/regression tests và quote rules UTC+7/D14/missing rate/surcharge/enum/AwayFromZero.

Không chạy toàn solution/frontend lần này; không xác nhận độc lập build 0 warnings hoặc daemon/UI. Approval chỉ hardening assignment, không toàn admin/MVP hoặc migration/deploy.

## Task tiếp theo

P2-POLICY-UI-01 đủ dependency, đã được PO giao trong mục 2 assignment.md. Chuyển ApprovedNext/writer=none để Antigravity nhận UI policies với API/DTO/validator và PROPERTIES.Read/Update hiện có. Không trùng task Nguyên/Tân. Mailbox không tự resume Antigravity.

---

# Lịch sử: Review ADMIN-HK-PAGING-01 — Approved (round 2)

- taskId: ADMIN-HK-PAGING-01
- round: 2
- submissionId: sub-admin-hk-paging-01-r2-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 2026-10-10T02:34:30+07:00

## Kết quả vòng 2

Finding latest-request-wins đã được xử lý: list dùng reloadTrigger + switchMap, catchError bên trong request; ngOnDestroy hủy listSub. Response/error request cũ không còn ghi đè trạng thái mới; retry không làm chết stream.

Chạy độc lập `node ./node_modules/vitest/vitest.mjs run src/app/features/housekeeping/housekeeping.page.spec.ts` tại frontend: **14/14 PASS, exit code 0**. Đã đọc bốn tests Subject kiểm tra race/error/retry/destroy. Không chạy lại full suite vì phạm vi sửa riêng stream list.

**Approved trong phạm vi assignment pagination/filter/KPI trên trang và race response.** Không đồng nghĩa nghiệm thu toàn bộ admin, browser E2E hoặc P2B-02/P3A. Không còn finding chặn của vòng review này.

Backlog đã biết: knownFloors chưa phải danh mục đầy đủ, quyền UI HOUSEKEEPING so với ROOMS.Update cần đồng bộ ở task riêng; ảnh evidence vẫn nằm ở máy cá nhân. Không mở vòng sửa thêm cho các mục này trong assignment hiện tại.

Tiếp theo: task hiện tại hoàn tất review. assignment chưa có task độc lập tiếp theo được chỉ định; chờ PO chọn task tiếp theo, không tự mở phase/deploy/migrate.

---

## Lịch sử review vòng 1

- taskId: ADMIN-HK-PAGING-01
- round: 1
- submissionId: sub-admin-hk-paging-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2
- reviewedAt: 2026-10-10T02:21:00+07:00

## Đã xác minh

Code đã có pagination và truyền status/floor/search lên server; KPI ghi phạm vi trang. Endpoint dùng PATCH /api/rooms/{id}/status.

Chạy độc lập `node ./node_modules/vitest/vitest.mjs run src/app/features/housekeeping/housekeeping.page.spec.ts` tại frontend: 10/10 PASS, exit code 0. Đây là tests logic mock, không phải browser E2E hoặc bằng chứng database nhiều trang.

## Finding cần sửa trong cùng task

[P2] Request list chưa có latest-request-wins. housekeeping.page.ts:506 mỗi lần loadRooms tạo subscription riêng. Đổi trang/filter nhanh có thể khiến response cũ về muộn ghi đè rooms/totalCount trong khi currentPage đã đổi; error cũ cũng có thể che kết quả mới. ngOnDestroy chỉ hủy search subscription, không hủy list request.

Sửa tối thiểu bằng một request stream switchMap hoặc quản lý subscription list cancel + guard request ID; xử lý lỗi bên trong để retry được, cleanup khi destroy. Không tự thêm abstraction/library.

Tests bổ sung bằng Subject có kiểm soát: request trang 1 chậm, trang 2 về trước, trang 1 về sau không ghi đè; error request cũ không đổi trạng thái mới; error hiện tại rồi retry thành công; destroy không cập nhật UI. Giữ tests hiện có, chạy suite liên quan. Không mở module mới.

## Backlog không chặn vòng này

knownFloors mặc định 1–5 và bổ sung từ trang đã tải nên không phải danh mục tầng đầy đủ. Ghi rõ hạn chế; không tạo summary API ngoài scope. UI permission nên khớp ROOMS.Update vì backend endpoint yêu cầu quyền này; không tự thêm quyền backend để chữa UI.

## Tiếp theo

Antigravity đọc review này và chỉ sửa finding latest-request-wins, resubmit round 2 với submissionId mới. Không cần viết lại báo cáo cũ. Không deploy/migration hoặc tác động DB dev/prod/staging. Chưa mở phase mới. Runtime không tự resume: người dùng cần kích hoạt một lần.
