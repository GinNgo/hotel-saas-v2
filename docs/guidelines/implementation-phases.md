# Lộ trình thực hiện Hotel SaaS

> Cập nhật 2026-10-05. Đây là kế hoạch, không phải báo cáo hoàn thành.
> Đồ án/demo chạy thật, có AI, thiết kế hướng sản phẩm; ưu tiên nội bộ, theo giờ/theo đêm, một hoặc nhiều chi nhánh.

## Contract nền tảng

- Tenant là doanh nghiệp; Property là chi nhánh. Khách sạn độc lập có một Property. Migration bảo toàn dữ liệu cũ.
- Tài khoản cá nhân có membership và quyền theo doanh nghiệp/chi nhánh; không tài khoản chung. Platform SuperAdmin tách Admin doanh nghiệp/quản lý chi nhánh/lễ tân. Backend enforce scope cả read/write, thiếu scope fail-closed; platform access tường minh.
- Giờ/đêm dùng chung lịch phòng [StartAt, EndAt), timezone cơ sở và buffer dọn phòng, khác chính sách giá; snapshot booking bất biến. Channel khác stay type.
- Đã duyệt D01: nội bộ chọn phòng cụ thể; online chọn loại phòng, server phân phòng cụ thể khi hold. Không quota phòng riêng theo kênh mặc định.
- Shared availability/hold/booking, expiry trả tồn, retry idempotent; chống overlap dưới concurrency ở transaction/database, không chỉ check rồi insert.
- Modular monolith, giữ stack; không cache/broker/partition/microservice khi chưa đo nhu cầu.
- AI tìm phòng tiếng Việt qua search thật; không tự quyết giá/tồn, trực tiếp SQL hoặc booking trước xác nhận.

## Quyết định P0 đã duyệt

Chi tiết và acceptance criteria: [p0-decisions.md](p0-decisions.md). Người dùng đã chọn 1A/2A/3A/4A/5B/6A/7A/8A/9A/10A: guest checkout; hold 15 phút; gói giờ đầu + giờ phát sinh làm tròn lên 60 phút; mặc định theo đêm 12:00–12:00 ngày kế tiếp; buffer tối thiểu 30 phút và xác nhận đã dọn; lễ tân xác nhận/cọc thủ công; chính sách hủy cấu hình theo chi nhánh, snapshot/refund audit; AI cho online và nội bộ. Giờ nhận/trả cấu hình theo chi nhánh; buffer cấu hình tối thiểu 30 phút. Giá, mức cọc, hạn/phí hủy và các tham số còn mở không được tự gán.

## Quy trình và DoD

- P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7; tất cả chưa nghiệm thu. Task code: test lỗi → tái hiện → implement tối thiểu → validation → evidence/docs.
- Không commit/deploy/production migration mặc định. Bảo toàn thay đổi chưa commit, đọc AGENTS.md/source mới nhất.
- DoD: quyền backend, test hành vi, UI loading/empty/error/keyboard, migration/recovery phù hợp, docs/evidence; không secret/PII trong log.
- Chưa xác nhận nhân lực/deadline/SLA/ngân sách AI: không hứa thời lượng hoặc số đo. Paths dưới đây là write scope dự kiến; feature mới theo convention hiện có.

## P0 — Chốt contract, đồng bộ SRS/SDD

**Dependency:** không có. **Files:** docs/srs actors/user-stories/business-processes/business-rules/data-dictionary; docs/sdd ERD/architecture/C4/API.

- [x] Ghi nhận 10 lựa chọn sản phẩm trong p0-decisions.md; không đồng nghĩa đã implement hoặc hoàn thành P0.
- [ ] Đồng bộ Tenant/Property/quyền, phân phòng online/guest checkout/hold 15 phút và buffer đã duyệt vào SRS/SDD; chốt quote TTL/timezone.
- [ ] Đồng bộ gói giờ + rounding 60 phút, giờ đêm mặc định 12:00–12:00 ngày kế tiếp, cọc thủ công và hủy cấu hình; chốt giá/mức cọc/phụ thu/no-show/refund.
- [ ] State machine booking/hold/payment/readiness; timestamps/snapshot giờ/đêm; đồng bộ ERD/API/story.
- [ ] Decision log, open questions, requirement → rule → contract → test → evidence.

**Gate:** không blocker P1–P3; tài liệu cũ tenant=cơ sở/DateOnly/catalog-first được đồng bộ trước implement.

## P1 — Tenant, chi nhánh, bảo mật và migration

**Dependency:** P0. **Files:** backend Domain/Entities, Application/Auth/Common, Infrastructure/Persistence/Services, WebApi/Authorization/Middleware/Program.cs; frontend core/layouts; .github/workflows/ci.yml; backend/tests.

- [ ] Test thiếu/sai tenant/branch, revoke membership, quyền A không dùng B, platform access.
- [ ] Property/membership, phân loại tenant-wide/property-scoped/public; fail-closed read/write, không dùng tenant null mở dữ liệu.
- [ ] Migration backfill branch tenant cũ, pre-check FK/unique, fixture dữ liệu cũ, verification/rollback/restore; thay EnsureCreated, seed demo riêng.
- [ ] Branch selector nối backend; CI test thật thay test rỗng, không skip thiếu script; security required gate.

**Gate:** fixture hai tenant, một tenant hai branch; scope tests pass; upgrade/recovery có evidence.

## P2 — Phòng và giá giờ/đêm

**Dependency:** P1. **Files:** Application/Rooms/RoomTypes, Domain Room/RoomType, persistence; frontend app.routes.ts/features/shared; tests.

- [ ] Test uniqueness branch/cross-scope, giá hiệu lực, tính giờ/đêm/boundary.
- [ ] CRUD phòng/loại phòng theo Property + UI/API/route rooms; readiness khác lịch booking.
- [ ] Version giá/audit/quote breakdown, decimal/rounding theo rule; thiếu giá không tự trả 0.

**Gate:** UI đúng quyền, giá fixture xác định, lịch sử không bị ghi đè.

## P3 — Booking nội bộ end-to-end

**Dependency:** P2. **Files:** Domain/Entities/Reservation.cs/enums, availability/booking Application/WebApi, persistence, frontend features, tests.

- [ ] Test overlap giờ/đêm/cross-mode/buffer, hủy/bảo trì, transition sai, concurrency.
- [ ] Migrate DateOnly sang StartAt/EndAt với timezone chốt; shared availability, quote/snapshot, channel Internal.
- [ ] ADR chống overlap transaction/database; update/kéo dài/đổi phòng kiểm tra lại lịch nếu thuộc scope.
- [ ] Check-in/out/hủy/no-show, audit, UI lịch; checkout cần dọn, xác nhận dọn mới sẵn sàng.

**Gate:** giờ/đêm chạy thật; tranh phòng một bên thành công; sửa giá không đổi booking cũ.

## P4 — Thu tiền và báo cáo

**Dependency:** P3. **Files:** Domain Payment/Invoice/InvoiceItem, payment/report features; frontend dashboard.page.ts/booking; tests.

- [ ] Test cọc/thu nhiều lần/công nợ/điều chỉnh/refund thủ công và retry.
- [ ] Payment trạng thái/currency/actor/audit/idempotency; không xóa lịch sử hoặc giả record thủ công là gateway verified.
- [ ] Dashboard API thật, tách giá trị booking/tiền thực thu/công nợ; công suất giờ/đêm có mẫu số/timezone rõ.

**Gate:** đối chiếu fixture được, retry không thu trùng, filter branch/time đúng quyền.

## P5 — Online tối giản và hold chung hai kênh

**Dependency:** P3/P4. **Files:** public search/booking Application/WebApi, cleanup worker Infrastructure, persistence, frontend features/routes; integration/concurrency tests.

- [ ] Public page cơ sở xuất bản, tìm loại phòng giờ/đêm theo thời điểm/số khách; chỉ expose trường public.
- [ ] Server phân phòng cụ thể khi hold, TTL 15 phút, cơ chế concurrency chung; guest checkout và lookup token bảo mật.
- [ ] Confirm/expire/cancel atomically/idempotently; availability bỏ hold hết hạn dù worker chưa cleanup; cleanup không giải phóng booking confirmed.
- [ ] Quote hết hạn/giá đổi yêu cầu xác nhận lại; booking/payment tách trạng thái; lễ tân xác nhận và ghi nhận cọc thủ công trước expiry theo chính sách. Tiền nhận sau expiry chuyển xử lý có audit, không ép đặt trùng.
- [ ] Validation/rate-limit/tra cứu bảo vệ PII, không dùng mã ngắn làm quyền truy cập; lễ tân thấy hold/channel Online. Gateway không bắt buộc.

**Gate:** race online/internal một bên thắng; expiry trả tồn; confirm retry không nhân booking; public không lộ PII/nội bộ.

## P6 — AI tìm phòng tiếng Việt trong MVP

**Dependency:** P5/search ổn định. **Files:** AI adapter Infrastructure, orchestration/validated DTO Application, endpoint WebApi, secrets/quota, UI trợ lý; mock tests.

- [ ] Sinh filter property/stay type/start/end/số khách; hỏi lại thiếu/mơ hồ, timezone cơ sở.
- [ ] Backend validate output/scope, search thật; chỉ trả phòng/giá từ response, prompt injection không tăng quyền/gọi mutation.
- [ ] Người dùng xác nhận qua booking chuẩn; secrets server-side, timeout/quota/cost budget, dữ liệu gửi tối thiểu không PII khách nếu chưa được phép.
- [ ] Form thủ công fallback; deterministic mock tests, live call chỉ khi cấu hình và được phép gửi dữ liệu demo.
- [ ] Bộ câu/tiêu chí chốt trước đo: filter/hỏi lại/không bịa/cross-scope; báo số thực.

**Gate:** demo giờ/đêm/thiếu thông tin; output truy vết search; AI outage không gián đoạn booking.

## P7 — Kiểm chứng và nghiệm thu đồ án

**Dependency:** P1–P6. **Files:** CI, docker, tests, tài liệu test/deploy/backup/evidence, docs/rubric-self-assessment.md.

- [ ] E2E hai tenant/nhiều branch/vai trò, giờ/đêm/nội bộ/online/hold/payment/AI fallback.
- [ ] Keyboard/accessibility/responsive; đo task success/latency trên dataset/hardware ghi rõ.
- [ ] Secrets/health/readiness/log redaction/request tracing; Compose dev không coi production-ready.
- [ ] Backup/restore database demo, migration recovery, smoke sau restore; staging chỉ khi được yêu cầu.
- [ ] Evidence command/exit code/time/environment; rubric chỉ ghi đạt khi xác minh.

**Gate:** demo tái lập, scope/concurrency pass, CI required gates chạy thật, restore được và công khai hạn chế.

## Traceability

| Requirement | Actor/rule | Phase | Evidence | Status |
|---|---|---|---|---|
| Đa chi nhánh | Admin/manager/staff, membership | P0/P1 | Scope/revoke tests | Chưa xác minh |
| Giờ/đêm | Staff/guest, pricing/overlap | P2/P3 | Boundary/cross-mode/concurrency | Chưa xác minh |
| Nội bộ ưu tiên | Staff, lifecycle/quyền | P3/P4 | E2E đặt/ở/thu/trả | Chưa xác minh |
| Online bảo vệ tồn | Guest/staff, hold/retry | P5 | Race/expiry/retry tests | Chưa xác minh |
| AI | Guest/staff, scope/data minimization | P6 | Bộ câu/injection/fallback | Chưa xác minh |
| Hướng sản phẩm | Team, recovery/audit/CI | Xuyên suốt/P7 | Migration/restore/test report | Chưa xác minh |

## Câu hỏi mở và sau MVP

- Đã duyệt toàn bộ D01–D25 trong p0-decisions.md (D14 đã được PO duyệt theo Phương án C: cấu hình riêng theo cơ sở 1–24h, mặc định 12h, vượt giới hạn từ chối với ERR_HOURLY_LIMIT_EXCEEDED, không tự chuyển sang đêm). Quote 5 phút, hold 15 phút; timezone Việt Nam/VND; gói 2 giờ; fixture Standard 150.000đ/gói, 50.000đ/giờ thêm, 400.000đ/đêm; online cọc 30%, nội bộ không bắt buộc; hủy miễn phí trước 2 giờ/24 giờ, muộn phí 30%; email lookup tới 7 ngày sau checkout; refund manager/admin duyệt; support platform cấp có hạn. Còn biểu phụ thu, midpoint rule, no-show/token mốc thời gian và quote/hold pin giá cần chốt contract.
- Đối chiếu rubric có bắt buộc catalog/bản đồ/VNPay trước cam kết nộp.
- Sau MVP: catalog/bản đồ toàn nền tảng, gateway/refund/hóa đơn điện tử, housekeeping phân công, subscription, OTA, phân phòng muộn; dynamic pricing cần dữ liệu và Owner duyệt.
