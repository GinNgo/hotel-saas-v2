# Review P5-GUEST-SEARCH-CONTRACT-01 — ChangesRequested (round 1)

- taskId: P5-GUEST-SEARCH-CONTRACT-01
- round: 1
- submissionId: sub-p5-guest-search-contract-01-r1-20261010
- workspace: C:\Dev\hotel-saas-v2; develop, HEAD 3f95339, dirty baseline
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings

1. [P1] Phase A chưa có contract được duyệt. Proposal mục 3/5 thay search bằng keyword, đổi list thành paginated object, thêm destinations và đổi publication semantics nhưng kết luận thực hiện ngay vì zero migration. PublicController.cs:43 và GetPublicPropertiesQuery.cs:14 hiện trả IReadOnlyList; frontend public-booking.service.ts:26 nhận PublicPropertyDto[]. Giữ search/list tương thích cho lát cắt reuse, hoặc ghi rõ API mới/breaking change và migration client là NeedsPO. Zero-schema không thay approval API/nghiệp vụ. Không coi ưu tiên search của PO là duyệt toàn bộ proposal.
2. [P1] Không đưa isPublishedOnly có thể tắt guard vào API anonymous. Mục 5.1 đề xuất tham số mặc định true nhưng chưa quy định caller có thể truyền false hay không. Nếu chọn publication policy, server phải enforce, thống nhất list/detail/room discovery; cần PO chốt thay đổi Active-only hiện có trước implementation. Chưa kết luận source hiện tại vi phạm contract publication đã duyệt.
3. [P2] Danh mục hành chính chưa có evidence phiên bản hiện hành. Bỏ khẳng định 63 đơn vị và các số lượng/hierarchy không có nguồn chính thức có ngày hiệu lực. Distinct City là chuỗi địa điểm do cơ sở nhập, không phải danh mục tỉnh/thành chuẩn hay mapping xã/phường. Ghi dataset/version/license/source và gate PO, không suy địa bàn từ Address.
4. [P2] Tách scope response và AC của Phase A khỏi Phase B: ngày ở, guests, availability/minPrice không được hứa trả thật khi chưa có query/contract tương ứng. AC mảng rỗng phải khớp response đã chọn. Với thuê giờ, reuse time-window UTC/giờ-đêm hiện có, không thay bằng date-only ngầm. Bỏ cam kết an toàn100%/ngưỡng500 chưa đo; ghi giới hạn input/pageSize, ordering ổn định, bounded query/assumptions và validation tương ứng. Bảng khảo sát DB chỉ có thể gọi là schema từ source/config/migration, không phải xác minh DB thật.

## Kết quả và validation

Khảo sát đã nhận diện đúng thiếu structured geography và tìm kiếm hiện dùng ToLower().Contains trên Name/Address/City, Active-only. Đã đối chiếu source handler/controller/domain và frontend service/spec; reports không thay evidence. Không chạy tests/build vì submission docs-only; không truy cập DB, không sửa implementation. Không duyệt Phase A hay mở P6.

## Next action

Resubmit round 2 cùng task: sửa proposal ngắn, giữ slice reuse API search/list hiện có riêng, và trình các lựa chọn API/publication/dataset/availability cần PO rõ ràng. Chỉ sửa tài liệu contract; không triển khai endpoint/schema/business mới. Các quyết định P5 TTL và quote/hold còn mở giữ nguyên. Writer được giải phóng; runtime Antigravity cần được kích hoạt nếu không hỗ trợ resume.
