# Review P5-GUEST-UX-REDESIGN-01 — ChangesRequested round2

TaskId: P5-GUEST-UX-REDESIGN-01
Round: 2
SubmissionId: sub-p5-guest-ux-redesign-01-r2-20261011
Reviewer: Codex — 11/10/2026

## Findings

1. HIGH — Mapping API còn sai (proposal:96–97). Source PublicBookingService.getAvailability dùng rentalType/startAtUtc/endAtUtc và PublicRoomTypeAvailabilityDto, không phải startDate/endDate/PublicRoomTypeDto/BasePrice. calculateQuote dùng POST /api/public/quotes trả QuoteDto, không có GET /properties/{slug}/quote/BookingQuoteDto. createHold trả GuestHoldDto, không phải HoldBookingResponse. Sửa mapping từ service + frontend models + backend DTO/controller thực tế; không tự tạo endpoint hoặc trường policy. Phân biệt estimate availability với quote authoritative; không BasePrice fallback. Đây là blocker triển khai UI, không câu hỏi PO.
2. MEDIUM — Fuzzy ranking chưa deterministic đủ để code/test. Fixture Đà Nẵng ghi exact City score90 dù rule exact=100; Ha ghi Tier1 score80 dù Tier1=90–100 và Name không prefix Ha. Score70–79/50–69 chưa có công thức; mục6.3 cho token ngắn exact/prefix nhưng6.4 yêu cầu mọi token>=3 ở typo tier nên truy vấn hỗn hợp 'da nag' không rõ. Chốt scores cố định, max score trên field, short-token + typo mixed cases, condensed boundaries và variant Damerau (OSA/full). Fixture phải tính được đúng theo rules; tie-break explicit comparer + Id. Bổ sung case existing substring không mất, inactive không trả, ngày/khách không fuzzy. Không cần xin PO chi tiết thuật toán ít rủi ro này.
3. MEDIUM — Nghiên cứu website vẫn chưa có evidence. Việc xóa timestamp không chứng minh khảo sát thật; lý do không lưu ảnh thương hiệu không thay thế được một log quan sát/snapshot đã redaction. Nếu không có tool evidence, ghi bảng là tham khảo pattern/chưa xác minh quan sát live, không claim đã crawl/khảo sát hoàn thành. Chỉ research deliverable bị hạn chế, không cần bịa bằng chứng để unblock.

## Findings đã đóng / giới hạn

- Static HTML đã loại CDN/fonts/remote images; SVG inline và CSS local. Desktop label associations đã sửa; mục tiêu a11y đã chuyển về chưa kiểm chứng. Không đòi browser PASS ở proposal-only gate khi limitation được công khai.
- Benchmark <5ms đã bỏ; in-memory vẫn unbounded toàn bộ Active, số1000 chỉ assumption, không hard cap/tuning đã đo. pg_trgm chỉ option tương lai, không phê duyệt extension/migration.
- Độc lập đọc HTML/proposal/manifest/submission, service + models. Checkout develop @3f95339. Không browser/pixel/contrast review; không DB/build/test ở round tài liệu. 160tests vẫn report baseline, không evidence mới hoặc reviewer PASS. Không xác nhận zero code changes vì thiếu baseline diff riêng.

## Next

ChangesRequested; sửa đúng mapping/rules/evidence claims và submit round3 ID mới. Không production implementation trước contract gate. Không đổi API/schema/quyền/policy/dependency, DB thật, commit/deploy hoặc module team. Writer none; reviewedSubmissionId cập nhật round2; history lưu trước thay review. Sau proposal Approved, ưu tiên lát cắt UI dùng contract hiện có theo yêu cầu PO, không để fuzzy proposal chặn phần UI độc lập.
