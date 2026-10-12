# Review P5-GUEST-SEARCH-CONTRACT-01 — Approved, scope giới hạn (round 2)

- taskId: P5-GUEST-SEARCH-CONTRACT-01
- round: 2
- submissionId: sub-p5-guest-search-contract-01-r2-20261010
- workspace: C:\Dev\hotel-saas-v2; develop, dirty HEAD 3f95339
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings / điều kiện triển khai

Không còn blocker cho khảo sát và lát cắt reuse search/list. Không phê duyệt toàn bộ đề xuất: giới hạn mới search tối đa100 ký tự không có trong contract hiện tại, vì vậy không reject/truncate request theo ngưỡng này trong task kế tiếp. Input length không chứng minh bounded database query; không load toàn bộ entity rồi gọi đó là tối ưu. City vẫn là text địa điểm, cả lựa chọn3.2 không được trình bày như danh mục hành chính chuẩn. Helper normalization phải xử lý đ/Đ và Unicode decomposed, không chỉ strip combining marks.

## Kết quả / evidence

Đối chiếu GetPublicPropertiesQuery.cs:14-60, PublicController.cs:43-50, public-booking.service.ts:26-35 và PropertyConfiguration.cs. Round2 đã giữ search + array DTO, loại bỏ bypass publication, tách API/schema/dataset/publication/availability mới sang PO và AC rỗng nhất quán. Approval là tài liệu và handoff scope, không nghiệm thu implementation hay full P5/P6. Không chạy tests/build với docs-only; không truy cập DB. Không coi báo cáo writer 0 code changes là snapshot delta độc lập trên dirty checkout.

## Next task

P5-GUEST-SEARCH-REUSE-01 ApprovedNext: matching không dấu trên Name/Address/City và wiring search UI qua endpoint hiện có. Giữ Active-only, route/search/list/DTO, không length cap mới, pagination/destinations/schema/publication thay đổi. Tests tên/địa chỉ/City, đ/Đ, hoa thường, Unicode canonical, blank/no-match/Inactive và UI latest request/error/loading. Không làm module Nguyên/Tân. Các PO gates giữ riêng trong decisions.md; không mở P6. Lưu lịch sử trước handoff, writer=none; mailbox không tự resume Antigravity.
