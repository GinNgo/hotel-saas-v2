# Review P5-GUEST-SEARCH-FORM-02 — ChangesRequested round1

TaskId: P5-GUEST-SEARCH-FORM-02
Round: 1
SubmissionId: sub-p5-guest-search-form-02-r1-20261011
Reviewer: Codex — 11/10/2026

## Findings

1. HIGH — Chưa có mockup visual đủ để PO xem cải thiện. Mục4 chỉ ASCII wireframe; evidence chỉ proposal, không HTML/rendered desktop/mobile. Với phản hồi PO cần đẹp như form booking, văn bản rounded/shadow không chứng minh giải pháp mới. Tạo một mockup local HTML/CSS/SVG không remote/dependency cho375/768/1440, capture thật nếu có browser, rõ synthetic; không production code. Form, dropdown mở, calendar mở và guest stepper phải thấy được; spacing/header/card và CTA phải khác bản hiện tại, không chỉ đổi copy.
2. MEDIUM — Mapping giờ sai và thêm policy ngầm. Mục3 hourly ghi ISO UTC(07:00 VN) trong khi source gửi T07:00:00Z tức14:00 VN; model hiện hourlyDurationHours không hourlyDuration. Giữ conversion hiện có và ghi đúng UTC/VN, không đổi sang07VN. Các14/12 hiện là source behavior, không universal property policy mới. Giới hạn2/3/4 theo maxHourlyHours mới cần nêu đúng validators/source hiện có; không tự sửa rules vì mockup. Map numberOfGuests vào guestForm control duy nhất, không hai bản state/form controls tách nhau.
3. MEDIUM — Chưa có interaction contract cho CTA/autocomplete/range. Nút 'Tìm phòng' phải nói rõ trước chọn property chỉ tìm cơ sở; sau chọn property/date mới availability, không gửi occupancy filter API không hỗ trợ. Guests chỉ số khách gửi hold, không đảm bảo results theo occupancy. Bổ sung Enter/Escape/arrows/focus/selected item, loading/error/stale suggestions guards, range partial/reversed/null/date reset và không double request từ bubbled card click; latest-request-wins/quote reset giữ nguyên. Chốt dùng component hiện có hay fallback dựa source thật, không để2option chưa khảo sát dẫn đến tự thêm dependency.

## Accepted direction / validation limits

Hướng search-first/floating card/SVG/copy hospitality và total guest stepper hợp lý, không cần hỏi lại PO chi tiết ít rủi ro. Quan sát Agoda desktop calendar/guest popup là Codex live observation từ chat; mobile compact là đề xuất, chưa mobile Agoda kiểm chứng. Không agent live crawl claim. Reviewer đọc proposal/submission và đối chiếu source time/form và repo file inventory; develop@3f95339. Không tests/build/browser cho vòng tài liệu, không DB. Wireframe chưa pixel/a11y evidence và chưa production implementation.

## Next

ChangesRequested: round2 mockup visual + clarified mappings/interactions, ID mới, archive submission trước thay. Không code production/API/schema/permission/business mới/backend/fuzzy/team/DB/dependency/commit/deploy. Source behavior giữ nguyên, business policy gate riêng. Writer none khi hoàn tất review.
