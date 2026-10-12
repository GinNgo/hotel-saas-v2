# Review P7-GUEST-UI-VERIFY-01 — ChangesRequested round1

TaskId: P7-GUEST-UI-VERIFY-01
Round: 1
SubmissionId: sub-p7-guest-ui-verify-01-r1-20261011
Reviewer: Codex — 11/10/2026

## Findings

1. HIGH — Mobile screenshot có CTA sticky bar bị cắt gần hết ngoài cạnh phải. Reviewer trực tiếp mở mobile-375.png: summary dài chiếm chiều ngang, chỉ phần đầu nút tím ló ra, không đọc/click được toàn CTA. booking.page.ts sticky aside flex có left group không min-w-0/flex-1, right shrink-0 và text dài. scrollWidth==clientWidth không chứng minh element không bị clipping. Sửa responsive: summary flex-1/min-w-0/overflow hợp lý, CTA text ngắn hoặc layout2rows/mobile full width, không overflow-x:hidden che lỗi. Capture actual375px có quote và verify CTA bounding rect trong viewport, text dài + zoom, form/last control không bị fixed bar che. Đây là blocker visual, không cần PO.
2. MEDIUM — Manifest đo viewport chưa tái lập: PNG thực desktop1803x915, tablet963x915, mobile750x1624. Mobile consistent375x812 DPR2; desktop/tablet không bằng declared1440x900/768x1024 DPR1. Có thể là screenshot tool capture khác, không tự suy CSS viewport từ pixels; cần raw browser metrics/log, screenshot clip/scale metadata, commands/cwd/time và source/build hashes để giải thích. Chưa có capture/network log, nên100% network isolation chỉ report. Fixture server bind loopback và /api fixtures không DB được source xác nhận, không bằng browser outbound request audit.
3. MEDIUM — Test có tên accessible group/hidden select tại public-booking.page.spec.ts:826 chỉ gọi class/form và calculateDeposit undefined, không assert DOM/template/role/aria/hidden select. Source group/aria-pressed đã sửa đúng, nhưng test không chứng minh claim DOM verification. Thêm rendered DOM hoặc template assertion thực và keyboard/browser evidence; không đặt tên a11y PASS cho test state-only. Fixture lookup route /api/public/bookings/lookup/... không khớp service /bookings/{token}; chỉ trả quote cố định cho mọi room/date, nên không đủ chứng minh dynamic state/error/retry/hold navigation. Giới hạn evidence hoặc sửa fixture đúng contract và thêm scenarios.

## Validation / limitations

- Reviewer xem trực tiếp2 ảnh mobile/desktop; tablet chỉ đọc PNG header, chưa pixel review. Không tự capture browser hoặc đo live DOM. Source fixture không DB, environment apiUrl=/api; chưa chạy fixture server và chưa audit outgoing requests.
- Reviewer độc lập targeted feature/service: node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts tại frontend: exit0,2files36/36 PASS. Không full166/build rerun; writer results không thay visual evidence.
- Đọc source/scripts/manifest/submission; checkout develop@3f95339. Baseline hashes vẫn của trước UI implementation, không task-specific snapshot/diff như giao; attribution limitation.
- Đọc environment.prod.ts không tồn tại gây exit1 ở grouped read; environment.ts đã đọc thành công, không có mutation/DB.

## Next

ChangesRequested: sửa mobile CTA/focus DOM evidence và capture metadata/limits, submit round2 ID mới. Không backend/fuzzy/API/schema/dependency/DB/commit/deploy/module team. Preserve screenshots/logs round1 trong history/evidence trước thay; screenshots không integration thật. Writer none sau ghi review; chưa Approved responsive/a11y.
