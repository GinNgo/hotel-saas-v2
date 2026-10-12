# Review P5-GUEST-UI-IMPLEMENT-01 — ChangesRequested round1

TaskId: P5-GUEST-UI-IMPLEMENT-01
Round: 1
SubmissionId: sub-p5-guest-ui-implement-01-r1-20261011
Reviewer: Codex — 11/10/2026

## Findings

1. HIGH — booking.page.ts:493,958 vẫn hiển thị cọc30% và tính total*0.30. Trái assignment và submission claim không hardcode cọc; disclaimer sau đó không sửa số tiền sai trên UI. Bỏ estimate tự tính, chỉ nói cọc được server xác định sau hold; trang hold dùng depositRequired thật. Không đổi backend policy. Thêm template assertion không30%/calculateDeposit và test flow depositRequired, giữ đúng actor.
2. HIGH — booking.page.ts:798 selectProperty chỉ guard id hiện chọn, không xác minh prop còn thuộc properties hoặc search request đang lỗi/loading. Card cũ vẫn render trong loading/error; click có thể gửi availability cho cơ sở không còn thuộc kết quả mới. Thêm provenance guard bằng current list/request state, disable stale-card action và test click stale property sau search/empty/error/loading. Giữ context reset và cancellation đã duyệt.
3. MEDIUM — booking.page.ts:244 hidden select sr-only aria-hidden vẫn focusable bằng Tab; controls ngày/giờ tại150,163,182,194 loại outline/ring nhưng container không focus-within như keyword. Người dùng bàn phím không thấy focus, screen reader gặp control aria-hidden. Bỏ select thừa hoặc ẩn thật khỏi focus tree, thêm focus-visible/focus-within rõ và semantics selected rental/card buttons. Kiểm tra template/rendered DOM; không chỉ class-instance tests.

## Quan sát cần giữ khi sửa

- loadQuote:924 chưa clear currentQuote trước request mới; submitHold:973 không guard isLoadingQuote/isSubmittingHold. Có thể giữ quote phòng trước khi chuyển phòng mới và submit expectedTotalAmount cũ. Chưa có baseline source để quy regression vòng này; ghi rủi ro luồng hiện tại, bổ sung regression quote A→B pending/failure không hold với quote A, double-submit guard theo scope bảo toàn request/hold; không tự đổi TTL policy chưa PO.
- Chưa pixel/browser kiểm chứng header/sticky bar375px; layout nowrap nhiều nội dung có nguy cơ overflow. Unit tests và build không chứng minh đẹp/responsive/a11y. Writer ghi limitation screenshot: chấp nhận chưa có evidence, không claim visual đạt. Cần kiểm chứng browser fixture khi có tooling cô lập.

## Validation

- Reviewer chạy độc lập `node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts` tại frontend: exit0, 2files,32/32 tests PASS. Các tests class-instance chưa bắt template/a11y findings.
- SHA256 hai files hiện tại khớp manifest2/2. Baseline chỉ hash, không có bản source/diff theo task; không chứng minh độc lập tất cả source changes thuộc task hoặc zero backend/team changes.
- Đã đọc source UI/service/models/tests và submission/manifest. Không full suite/build rerun ở reviewer vòng này; writer162/full/build chỉ evidence do writer. Không DB/network/backend/deploy. Checkout develop@3f95339.

## Next

ChangesRequested; sửa các findings trong guest frontend, bổ sung targeted regression/template tests và submit round2 ID mới. Không làm trùng team, fuzzy backend/API/schema/dependency/DB/commit/deploy. Archive trước thay submission. Writer none và reviewedSubmissionId round1 sau ghi review. Không chặn vì PO policy ngoài scope: bỏ cọc giả không cần chốt lại policy.
