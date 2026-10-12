# P5-GUEST-OTA-UI-03 — Guest booking UI chuyên nghiệp

## Ủy quyền và mục tiêu

PO ngày 11/10/2026 yêu cầu giao task nâng cấp giao diện khách theo chất lượng các trang đặt phòng hiện nay, không phụ thuộc project cũ. Tham khảo Booking.com, Agoda, Traveloka về hierarchy, search, cards và mobile; không clone brand/assets. Thực hiện UI thực tế, không chỉ đổi màu hoặc tiếp tục vòng báo cáo. Phạm vi là guest booking/search presentation hiện hữu; không mở nghiệp vụ/API/schema mới.

## Cách thực hiện

- Đọc AGENTS gần nhất, karpathy, requirements-analysis, Angular enterprise, impeccable, ui-ux-pro-max (thẩm quyền visual), design-system và Spec Kit artifacts phù hợp. Đọc source/DTO/service đã duyệt; kiểm tra checkout/writer và lưu baseline diff/hash trước sửa, không ghi đè dirty edits của người khác.
- Rà các trang tham khảo công khai nếu truy cập được, ghi URL/thời điểm và quan sát thật; không login/bypass/crawl hàng loạt hoặc bịa khảo sát khi không truy cập được. Không để việc truy cập tham khảo chặn triển khai UI đã được PO giao. Không đưa repo/secrets/PII lên dịch vụ ngoài.
- Chọn một visual direction nhất quán, lưu design rationale ngắn rồi triển khai ngay trong scope; không xin lại PO từng chi tiết ít rủi ro. Ưu tiên hospitality/editorial sạch, hierarchy mạnh, typography/spacing/grid đẹp, ảnh có ý nghĩa và search rõ; tránh hero gradient khổng lồ, quá nhiều badge/icon hoặc lộ mã DTO/slug cho khách.
- Thanh search nổi bật nhưng gọn, desktop bố trí hợp lý và mobile xếp lớp dễ dùng; giữ explicit property selection, dates/rental/guest controls đúng contract. Bố cục kết quả có hierarchy tên/địa chỉ/ảnh/action, room cards và quote summary nhất quán; giữ hành trình rõ ràng không nhầm giá phòng với giá cơ sở.
- Chỉ dùng Name/Address/City/image và room availability/estimatedPrice từ DTO thật. Không bịa review/rating/amenities/discount/giá/tồn hoặc filter/sort/map không có backend hỗ trợ. Image null có fallback đẹp; assets sinh nếu cần phải theo AGENTS endpoint, ghi rõ minh họa, không giả ảnh thật của property hay gửi credential vào evidence. Tận dụng assets/tokens/fonts/components đã có, không dependency/CDN mới.
- Giới hạn production edits ở guest feature/templates/styles/tests liên quan. Không shared/auth/admin/backend/service contract/team modules. Bảo toàn discovery fuzzy, latest-wins/debounce/cancellation, quote reset/date validation, hourly/overnight, hold/confirm/idempotency/lookup và PII guards. Không đổi TTL/deposit/pricing/publication/permission/API/schema/geography/aggregated inventory/P6.

## Acceptance và evidence

- Actual CSS viewports375/768/1440: không overflow ngang, form/CTA không bị sticky/header che; tên/địa chỉ dài vẫn đọc được. Keyboard arrows/Enter/Escape/Tab, focus-visible, labels, selected states, touch targets, loading/empty/error/retry có evidence thực.
- Chạy targeted guest/service tests và build bằng scripts có sẵn sau inspect an toàn; không install dependency hoặc full backend ambient suite. Không DB dev/prod/staging, migration, deploy, commit, branch mới.
- Dùng browser frontend với synthetic loopback fixtures đã inspect nếu an toàn; không startup backend ambient. Chụp before/after375/768/1440 thực, manifest capture time/viewport/DPR/actor/actions/served build hashes và network limitation. Không claim browser/visual PASS từ source/unit tests hoặc reports; thiếu tooling ghi NOT TESTED chính xác.
- Evidence riêng docs/agent-coordination/evidence/guest-ota-ui-03/, không ghi đè guest-race đã Approved. Submit source diff/baseline, design rationale, tests/build logs, ảnh thật và limitations theo taskId/round/submissionId. Không bịa coverage/SUS/user tests/rubric điểm.
- Codex review cả visual lẫn functional regressions; không xem functional PASS là giao diện đã đẹp. Các PO gates cũ giữ decisions.md và không chặn UI slice này.
