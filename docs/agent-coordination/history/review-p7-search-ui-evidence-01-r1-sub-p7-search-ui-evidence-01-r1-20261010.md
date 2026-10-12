# Review P7-SEARCH-UI-EVIDENCE-01 — ChangesRequested (round 1)

- taskId: P7-SEARCH-UI-EVIDENCE-01
- round: 1
- submissionId: sub-p7-search-ui-evidence-01-r1-20261010
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings

1. [P2] Manifest viewport không khớp artifact: độc lập đọc header 7 PNG bằng System.Drawing cho5 desktop1600x915 và2 mobile628x915, không phải desktop1280x800/mobile375x812@2 như khai báo. Không tự suy CSS viewport từ ảnh; bổ sung capture tool settings/deviceScaleFactor và pixel dimensions thực, nếu viewport chưa có evidence ghi unknown. Không claim đã kiểm chứng375px nếu không xác minh được. Không resize ảnh để hợp lý hóa metadata.
2. [P2] Ảnh tĩnh không chứng minh timer bị hủy/không request sau300ms, dropdown có3 options, null internal state hay retry thành công. Manifest visibleElements/submission/matrix4.2 đang coi các mục này là điều nhìn thấy. Đổi thành nguồn source/tests (review P5 round4,30/30 feature+service) hoặc writer procedure unverified; log capture là narrative không phải network/timing trace độc lập. Mobile keyword ảnh chỉ thấy form, cards bên dưới viewport; ghi đúng giới hạn. Hai ảnh keyword dùng có dấu; không gọi chúng evidence trực quan của truy vấn không dấu nếu chưa có capture/trace tương ứng.

## Evidence / limitations

Đã trực tiếp xem keyword-mobile và clear-desktop; chưa pixel-review5ảnh còn lại. Source fixture/local server bind127.0.0.1, mock API synthetic, không DB connector; không chạy server/browser/DB/build/tests vòng này. Ảnh là fixture rendering không phải inventory/booking thật; browser external network isolation unverified. Không phê duyệt claims mobile viewport/dynamic behavior hiện tại. Không yêu cầu chỉnh production UI trong task evidence.

## Next action

Resubmit round2: sửa manifest/submission/matrix captions và capture provenance đúng artifact; giữ ảnh gốc, chỉ recapture nếu cần evidence375px/không dấu. Tách source/test proof khỏi screenshot/procedure claims; không viết lại P7 cũ hay bịa tool settings. Lưu history trước review và release writer=none có guard. PO gates và P6 giữ nguyên.
