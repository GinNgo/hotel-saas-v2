# Review P2-RATES-UI-01 — Approved (round 2)

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
