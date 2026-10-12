# Review P5-GUEST-UX-REDESIGN-01 — Approved giới hạn UI proposal round3

TaskId: P5-GUEST-UX-REDESIGN-01
Round: 3
SubmissionId: sub-p5-guest-ux-redesign-01-r3-20261011
Reviewer: Codex — 11/10/2026

## Findings / phần chưa được duyệt

- Fuzzy contract chưa Approved để code: fixture 'Ha'→P5 phải đạt substring80 ('khach san ha long bay'), không75 theo max-score rule. Ví dụ Nhatrangg→nhatrang distance1, không2. Score50 phải yêu cầu ALL tokens đạt ngưỡng, không chỉ tồn tại một token distance2; condensed>=7 distance1 phải60, không tự50. Tokenization/separators cần giữ mô tả executable từ round trước. Đây là sửa contract kỹ thuật, không cần PO chọn lại.
- Live research/crawl chưa thực hiện có evidence; bảng đã chuyển thành heuristic references, chấp nhận limitation cho design proposal, không nghiệm thu yêu cầu khảo sát live. Không dùng lý do bản quyền để tuyên bố quan sát mà không evidence.
- Claim160/160 và CPU footprint cực nhỏ không evidence mới; không dùng như PASS/benchmark vòng3. Không xác minh zero production changes vì thiếu baseline snapshot riêng.

## Approved scope

- Mapping availability query/DTO, POST public quotes/QuoteDto, hold/GuestHoldDto đã phù hợp frontend service/models kiểm tra độc lập. RentalType1/2 khớp enum backend. Không hardcode cọc hoặc BasePrice fallback.
- Hướng UI search hợp nhất, cards, SVG fallback, sticky summary có thể triển khai độc lập theo API đã duyệt và yêu cầu PO. HTML vẫn mock/synthetic, không phải UI production hay pixel/a11y evidence. Không duyệt backend fuzzy, API/schema/IsPublished/geography, P6 hoặc P5 policies còn mở.
- Round3 proposal Approved giới hạn UI đủ để mở task implementation riêng; không bắt đợi fuzzy khiến queue dừng.

## Validation / limitations

Độc lập đọc submission/proposal và đối chiếu PublicBookingService, public-booking.model, reservation.model, RentalType enum; checkout develop@3f95339. Không DB/build/test/browser ở proposal review; chưa đo responsive/contrast/keyboard/pixel và chưa khảo sát website live. Evidence baseline160 chỉ writer claim.

## Handoff

P5-GUEST-UI-IMPLEMENT-01 ApprovedNext theo assignment mới: chỉ frontend guest redesign với service/contract hiện có. Fuzzy contract sửa trong tài liệu riêng, không code backend. Giữ lịch sử review/submission và ID được review trước chuyển task; writer none. Runtime cần ACK, không claim auto resume.
