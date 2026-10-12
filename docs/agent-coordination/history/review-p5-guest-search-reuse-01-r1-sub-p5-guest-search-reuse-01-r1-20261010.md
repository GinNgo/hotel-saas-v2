# Review P5-GUEST-SEARCH-REUSE-01 — ChangesRequested (round 1)

- taskId: P5-GUEST-SEARCH-REUSE-01
- round: 1
- submissionId: sub-p5-guest-search-reuse-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2, dirty baseline
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings

1. [P1] booking.page.ts:420-432: search tự đổi propertySlug/selectedProperty nhưng không reset selectedRoomTypeId/selectedRoomType/currentQuote như onPropertyChange:468-474. Search rỗng cũng giữ selection/quote cũ. searchAvailability:514-529 không guard response theo property/time-window; response A muộn có thể ghi availability của A dưới khách sạn B hoặc sau empty result. Dùng đường reset thống nhất khi property thay đổi/rỗng, invalidate availability/quote requests và chặn response stale; không cho hold dùng selection từ cơ sở cũ. Thêm tests select/quote A → search B, A response muộn sau B, và empty-search khi request A còn pending. Property-list request counter hiện tại chưa bảo vệ các request phụ thuộc.
2. [P2] GetPublicPropertiesQuery.cs:42-62 materialize mọi Active DTO rồi lọc tại RAM; đây không phải bounded query. Mỗi input event gọi ngay loadProperties nên gõ N ký tự tạo N lần scan; request counter chỉ discard UI response, không hủy HTTP. Normalize(search) lặp theo mỗi trường mỗi property. Giảm request churn bằng debounce/cancel/lifecycle cleanup, normalize keyword một lần; mô tả tradeoff scan thực và không claim bounded/performance. Không thêm cap/truncation/schema/extension ngoài duyệt; nếu không thể tránh scan trong scope ghi limitation/PO solution riêng, không gọi projection là boundedness.
3. [P2] Evidence report sai: normalizer targeted chạy độc lập được 42 tests, không phải48. Submission còn nói ordering CreatedAtUtc giảm dần trong khi handler Name rồi Id. Sửa nguồn/Fact-Theory counts và attach log thật; không đổi source để khớp report. WebAPI 2Facts báo cáo chưa được reviewer rerun, không coi là tests search-specific.

## Validation / kết quả

Independently ran frontend Vitest public-booking.page.spec.ts + public-booking.service.spec.ts: 20/20, 2 files, exit0. Independently dotnet Application filter VietnameseTextNormalizerTests: 42/42, exit0, unit-only không DB. Source xác nhận search/list DTO và Active-only được giữ, đ/Đ + canonical matching có helper. Không chạy handler DB/HTTP/build trong vòng này; không truy cập DB dev/prod/staging. Existing passing tests chưa cover dependent-state races nêu trên. Dirty baseline không cung cấp delta độc lập cho mọi file.

## Next action

Cùng task resubmit round2, chỉ fixes/tests/source evidence phạm vi trên; không API/schema/publication mới, không modules Nguyên/Tân. PO questions giữ nguyên, không mở P6. Lưu review/submission history và trả writer=none; không claim runtime tự resume.
