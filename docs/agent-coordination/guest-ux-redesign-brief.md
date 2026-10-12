# P5-GUEST-UX-REDESIGN-01 — brief giao Antigravity

## Yêu cầu PO ngày 11/10/2026

Thiết kế lại giao diện khách theo chất lượng trang tìm kiếm/đặt phòng hiện đại; khảo sát website công khai và chuẩn bị tìm kiếm gần đúng. "Fuzzing" được hiểu tạm là fuzzy search, cần ghi giả định trong submission.

## Deliverables round1

1. Nghiên cứu 3 trang: URL, thời gian, screenshot/quan sát thật, pattern có thể áp dụng và không phù hợp; không claim đã crawl nếu chỉ đọc source.
2. Audit giao diện hiện tại dựa source/screenshot thật: hierarchy, search form, property cards, responsive, keyboard/focus/labels, loading/empty/error/retry. Phân biệt chưa quan sát với lỗi đã xác minh.
3. Một hướng thiết kế và mockup desktop/mobile: thanh tìm kiếm nổi bật, thông tin ngày/số khách theo contract hiện có, card ảnh hợp pháp, CTA rõ, typography/spacing/color nhất quán. Không sao chép nhận diện thương hiệu. Không tạo dữ liệu đánh giá/giá/tồn có vẻ thật.
4. Fuzzy proposal dựa Name/Address/City hiện có: normalization tiếng Việt/đ/Unicode, ưu tiên exact rồi normalized rồi typo, đề xuất ngưỡng và stable ranking; từ quá ngắn/không-match giữ hành vi an toàn. Không suy mã hành chính từ địa chỉ, không fuzzy các điều kiện booking, không tải toàn bộ inventory về frontend. Công khai hạn chế query in-memory hiện tại và kế hoạch đo bằng fixture, không bịa benchmark.
5. Acceptance cases: có/không dấu, đ/Đ, Unicode canonical, gõ sai 1 ký tự, query ngắn, không-match, exact không bị typo lấn; stale results/debounce/clear/destroy; đổi cơ sở/ngày reset quote và selection; giá/tồn vẫn từ API thật. Breakpoint kiểm chứng ít nhất 375/768/1440 CSS px, bàn phím và không scroll ngang toàn trang.
6. Smallest implementation plan, file ownership, API compatibility, test commands tồn tại, câu hỏi PO thật sự quan trọng và limitation. Round1 chỉ research/design/proposal, không sửa production.

## Boundaries

Không DB dev/prod/staging, commit, deploy, migration, secrets, dependency mới, API/schema/quyền/publication mới, AI provider/Maps hoặc module Nguyên/Tân. Browser chỉ truy cập public bình thường; không bypass anti-bot hoặc scrape dữ liệu người dùng. Không gửi source/PII/secrets cho site nghiên cứu. Mock rõ nhãn, không coi mockup là production/integration evidence. Hình mới nếu cần tuân AGENTS và quyền tài sản.

Submission lưu riêng task/round/ID, commands/exit/evidence thực và hạn chế. Archive submission trước thay, writer none khi Submitted; reviewer không dựa report PASS làm evidence độc lập.
