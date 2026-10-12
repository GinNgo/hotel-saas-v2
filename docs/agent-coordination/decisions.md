# Quyết định cần PO

## Queue sau guest race verification round4 — 2026-10-11

P7-GUEST-RACE-VERIFY-02 round4 Approved bounded synthetic evidence. Không reviewer browser replay/production nghiệm thu; late-delivered requestId rejection chưa browser-tested. Đã kiểm tra queue sau các slice fuzzy và guest UI/browser: không còn implementation slice độc lập contract rõ được duyệt, không ApprovedNext giả hoặc lặp evidence. Queue NeedsPO; giữ nguyên các câu hỏi D21 TTL/revoke, quote-hold price pin/stale acknowledgement và search API/publication/licensed geography/schema/aggregated availability bên dưới. P6 chưa mở; Nguyên/Tân giữ modules riêng. PO chọn/chốt slice tiếp theo để tiếp tục đúng dependencies; không phát sinh quyết định nghiệp vụ mới từ review này.

## Queue audit — 2026-10-11

Frontend local CI evidence Approved, hash4/4 khớp; lint/test CI scripts absent là source gap, chưa có cloud run evidence. Không còn slice implementation độc lập contract rõ trong hàng đợi hiện tại, không làm trùng Nguyên/Tân hoặc lặp evidence. Chờ PO: D21 TTL/revoke và quote-hold price contract; search API/publication/dataset/schema/availability choices đã liệt kê bên dưới. P6 chưa mở. Không tự sửa CI/deploy/backup thật khi chưa có kế hoạch/target được duyệt.

## Search contract round2 — 2026-10-10

Khảo sát Approved giới hạn slice reuse search/list/Active-only; bàn giao P5-GUEST-SEARCH-REUSE-01 độc lập. Không phê duyệt cap100 ký tự mới, API pagination/destinations/advanced endpoint, publication thay đổi, schema/dataset hoặc aggregated availability. Các gates bên dưới giữ NeedsPO; City động chỉ text địa điểm, không danh mục hành chính. Không mở P6 hoặc coi khảo sát là nghiệm thu search implementation.

## P5 ordinary search — đề xuất round1, chưa phê duyệt (2026-10-10)

- API mới destinations, keyword/city/pagination và đổi response list: cần contract tương thích hoặc PO duyệt thay đổi; zero migration không phải approval. Proposal đang ChangesRequested để làm rõ, chưa giao implementation mới.
- Publication policy Active-only hay Active + IsPublished và enforcement đồng nhất discovery/detail cần PO; không cho anonymous caller tắt guard nếu chọn publication policy.
- Dataset hành chính hiện hành cần nguồn chính thức có phiên bản/ngày hiệu lực/license; City tự do không phải danh mục tỉnh/xã. Schema địa bàn và availability xuyên cơ sở còn là đề xuất, không phê duyệt migration/deploy.
- Ưu tiên khách hàng/search trước AI/Maps đã được PO xác nhận; không mở P6 trước public search gate. TTL/quote-hold questions bên dưới vẫn giữ nguyên.

## Cập nhật review P5 round4 — 2026-10-10

sub-p5-guest-booking-01-r4-20261010: regression TTL đã đóng, HTTP 1/1 Fact và Application 16/16 PASS độc lập. Full P5 NeedsPO cho hai câu hỏi bên dưới; chưa phê duyệt projected TTL đang trong source. Chuyển P7-EVIDENCE-01 độc lập ApprovedNext; P6 chưa được mở vì public search gate chưa duyệt. Không phát sinh quyết định nghiệp vụ mới.

Chưa có quyết định nghiệp vụ mới. Antigravity cần ACK và xác nhận runtime hỗ trợ chờ/resume trước khi coi workflow là hai chiều tự động.

## P5-GUEST-BOOKING-01 — open PO questions (2026-10-10, round 1)

- D21 đã duyệt lookup token hết hạn 7 ngày sau checkout và revoke/reissue; p0-decisions còn mở mốc dự kiến hay thực tế và cập nhật TTL khi đổi/hủy/no-show. Cần PO chốt mốc, không tự cấp token vô hạn. Chỉ phần TTL phụ thuộc bị chặn; masking/discovery/auth/lock/idempotency fixes độc lập tiếp tục.
- p0-decisions còn mở contract quote TTL5min/hold15min price pinning và race expiry/confirm. Cần PO chốt giá pin trong hold và stale quote acknowledgement; không coi report PricingCalculator là approval mới.
- D08 không cần xin lại: demo online phải lễ tân xác nhận cọc thủ công đúng quyền/scope, chưa gateway. D21 không cấp quyền mutation qua lookup token. Không chấp nhận guest POST tự tạo Payment.Completed.
- Nếu PO gates giữ P5 sau khi fixes độc lập xong, chuyển P7-EVIDENCE-01 đã duyệt (source/test mapping thực), không claim P6 public search gate đã đạt khi chưa review.
