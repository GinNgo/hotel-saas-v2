# Research và decision record — Draft

## Phương án so sánh

| Hướng | Lợi ích | Đánh đổi |
| --- | --- | --- |
| A — Foundation nhỏ + cải tiến từng luồng (khuyến nghị) | Tái sử dụng native/PrimeNG hiện có, regression dễ giới hạn, sửa root cause | Mất một vòng chuẩn hóa trước khi nhiều màn hình trông mới |
| B — Chỉ trang trí từng page | Có thay đổi hình thức nhanh | Label/validation/state vẫn lệch; duplication tăng, không giải quyết data truth |
| C — Thay toàn bộ UI kit / dynamic form engine | Có thể đồng bộ một lần về lý thuyết | Migration lớn, thêm abstraction/dependency, phá control contracts, chưa có nhu cầu đo được; loại khỏi vòng này |

Decision đề xuất: A. Không thay framework, không tạo microservice hoặc CMS mới chỉ để cấu hình màu/form.

## Visual authority

UI/UX Pro Max được truy vấn bằng script search.py cho marketplace hotel booking accessible forms. Kết quả gợi ý marketplace/search-centric, labels liên kết, keyboard, error announce, submit feedback. Gợi ý Liquid Glass/amber/font mới không áp dụng máy móc: chính output cảnh báo contrast/performance, xung đột mục tiêu Operate và identity indigo/emerald đang có.

Giữ nền sáng/slate và font stack hiện tại; guest dùng accent indigo hiện có, PMS dùng emerald hiện có, semantic success/error không thay theo shell. Chưa tuyên bố đây là rebrand đã duyệt. Không tải Google Font hoặc external asset.

## Reuse và data model

- Field shell chịu label/hint/error/layout, không giữ value và không gọi HTTP.
- Native input styling directive chỉ lo presentation/ARIA glue có contract rõ; dùng native form integration, không viết CVA cho text input không cần thiết.
- Custom searchable select đã có CVA: harden reactive options, semantics và keyboard trước reuse. Không giữ hai nguồn truth disabled/value; tương thích form APIs đang sử dụng.
- Server validation/business rule vẫn tại application/backend; client không tự phát minh giới hạn phone/price/name khác contract.
- UI-only phase không thêm bảng/cột/entity. View state gồm touched/submitted/pending/field errors và nullable public data, không phải schema mới.

## API và trust boundaries

Profile theo ../booking-marketplace/guest-account-api.md, status đề xuất. Bulk date/capacity search cần contract riêng nếu user chọn scope đó; không giả vờ discovery đã hỗ trợ. Public tenant/brand metadata không dùng để cấp quyền PMS. Payment/schema/social auth không được chứng nhận bởi audit UI này.

## Tooling / unresolved decisions

- Canva chưa được kết nối. Không có design transaction/file để lưu. Khi connector xuất hiện: kiểm tra capabilities tạo thiết kế trước, không dùng skill edit để giả tạo text/page mới; preview trước khi lưu thay đổi vĩnh viễn.
- .specify không tồn tại, nên đây là artifact theo cấu trúc Spec Kit chứ không phải run thành công setup-plan. Không có hooks để dispatch. Không tự cài extension/CLI hoặc tạo nhánh.
- Chờ xác nhận ưu tiên guest hay PMS. Hướng draft guest-first không trở thành quyết định đã duyệt khi user chưa trả lời.
- Tên thương hiệu/asset chính thức chưa chốt; giữ tên hiện có, không bịa logo/chứng nhận/testimonial.
- Khối hóa đơn/loyalty, claim booking anonymous và read cross-tenant là business/security gates, không được âm thầm giải quyết bằng UI design.
