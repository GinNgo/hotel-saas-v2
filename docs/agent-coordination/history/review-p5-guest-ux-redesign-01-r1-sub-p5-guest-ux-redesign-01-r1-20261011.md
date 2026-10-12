# Review P5-GUEST-UX-REDESIGN-01 — ChangesRequested

TaskId: P5-GUEST-UX-REDESIGN-01
Round: 1
SubmissionId: sub-p5-guest-ux-redesign-01-r1-20261011
Reviewer: Codex
Ngày: 11/10/2026

## Findings trước kết luận

1. HIGH — Evidence nghiên cứu và benchmark chưa đủ. proposal.md:26 ghi Traveloka khảo sát 09:25, sau submission timestamp 09:22/task 09:23; thư mục evidence chỉ có HTML và manifest, không ảnh/log quan sát website. Không xác minh được crawl/public inspection. proposal:140–141 khẳng định <=1000 properties/<5ms không có dataset hay benchmark. Bỏ khẳng định, ghi assumptions/limitations; bổ sung bằng chứng truy cập thật nếu thực hiện được. Không thay timestamp để hợp thức hóa lịch sử.
2. HIGH — Fuzzy contract mâu thuẫn và chưa thực thi được. proposal:130 chọn Levenshtein nhưng TC07 yêu cầu Damerau transposition=1; TC05 Danag→Đà Nẵng không khớp tokenization da/nang nếu không có quy tắc nối từ rõ. Chốt một thuật toán, whitespace/tokenization, all-query-tokens semantics, exact>prefix>substring>typo và tie-break Name/Id; thêm fixture cụ thể và expected order. Không cần PO chọn sorting giá/tồn khi API không có dữ liệu ấy: giữ deterministic Name/Id như source. Tier2 phải xuất hiện trong flowchart. Chưa cấp phép backend fuzzy implementation theo contract này.
3. HIGH — Design cần map trường tới API thật trước code. GetPublicPropertiesQuery.cs:43–55 không có giá/tồn/amenities và ImageUrl hiện null. Mockups có ảnh, tiện ích/giá/cọc; synthetic label giúp minh bạch nhưng không đủ chứng minh khả năng tích hợp. Bổ sung field→DTO/endpoint mapping, trạng thái chưa chọn ngày/chưa quote/chưa availability, ảnh null fallback; không gọi tồn phòng realtime hoặc giá toàn cơ sở nếu chưa có API contract. Không hardcode cọc30% hay xác nhận tức thì từ mockup vào production; lấy đúng policy/quote/hold hiện có, giữ gate nghiệp vụ riêng.
4. MEDIUM — Accessibility/responsive là mục tiêu, chưa chứng minh compliance. Manifest/submission claim WCAG AA và viewport đạt nhưng không có rendered screenshots/đo contrast/keyboard log. Desktop labels ngày/số khách tại HTML:113,125 chưa liên kết control. Mockups dùng remote Tailwind script/fonts/Unsplash (desktop:7,9,196; mobile:7,9,114) nên chưa phải artifact offline/network-isolated; license/provenance ảnh chưa ghi. Dùng local assets/tooling hiện có hoặc placeholder, không thêm production dependency. Kiểm chứng 375/768/1440 CSS px bằng browser; không dùng overflow-x:hidden để che clipping. Nếu chưa có browser, ghi chưa kiểm chứng và bỏ claim đạt.

## Validation / limitations

- Độc lập đọc submission/proposal/manifest, static HTML và source query; checkout develop @3f95339b4f4477ac5d421551d372dfdd5ed31e30.
- Không mở HTML chứa third-party scripts; không duyệt website ở vòng reviewer này; không có pixel review, contrast measurement hoặc browser keyboard testing.
- Không chạy DB/build/tests vì round này review tài liệu/mockup, không production implementation. Claim160/160 chỉ từ submission; không có fresh log round1 trong evidence và không được coi là rerun độc lập.
- Lệnh rg với wildcard Windows lần đầu thất bại, đã thay bằng directory + -g '*.html' và kiểm tra thành công; không ảnh hưởng dữ liệu.
- Chưa có baseline diff/hash riêng trước khi writer bắt đầu, nên không thể xác nhận tuyệt đối claim zero production changes từ report.

## Next action

ChangesRequested: Antigravity sửa proposal/mockup/evidence trong scope round1, submit round2 với ID mới; không production code, dependency/API/schema/DB/commit/deploy hoặc module Nguyên/Tân. Giữ hướng thiết kế search rõ/card/mobile; không nghiên cứu lại bằng lời nếu không có evidence. Có thể tự quyết sorting Name/Id và chi tiết ít rủi ro, không đẩy các quyết định này về PO. Các gate P5 đã ghi vẫn giữ; không mở P6. Writer trả none sau khi lưu review và reviewedSubmissionId.
