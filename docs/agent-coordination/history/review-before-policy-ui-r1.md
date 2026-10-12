# Review P2-PRICING-HARDEN-01 — Approved (round 1)

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
