# Review P3-BOOKING-CORE-01 — ChangesRequested (round 2)

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
