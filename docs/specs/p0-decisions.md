# Quyết định P0 đã duyệt — 2026-10-05

> Người dùng chọn: 1A, 2A, 3A, 4A, 5B, 6A, 7A, 8A, 9A, 10A; bổ sung 11A, 12A, 13A, 14 (Phương án C - Cấu hình riêng theo cơ sở), 15A, 16A, 17A, 18A, 19A, 20B, 21A, 22A, 23A, 24A, 25A. (25/25 quyết định đã được duyệt).
> Đây là yêu cầu đã duyệt, không phải trạng thái chức năng đã implement. Tài liệu này là nguồn đối chiếu cho các lựa chọn dưới đây; nội dung SRS cũ trái với chúng phải được đồng bộ trước triển khai.

## Quyết định và acceptance criteria

| ID | Quyết định được duyệt | Phase | Tiêu chí kiểm chứng |
|---|---|---|---|
| D01 | Online chọn loại phòng; backend tự phân phòng cụ thể ngay khi hold. Nội bộ chọn phòng cụ thể. | P3/P5 | Hold có RoomId đúng chi nhánh/loại; hai kênh tranh cùng phòng chỉ một thành công. |
| D02 | Guest checkout, không bắt buộc đăng ký; tra cứu qua liên kết/token bảo mật. | P5 | Đặt không login được; token sai/hết hạn không đọc được PII; mã xác nhận ngắn không đủ quyền truy cập. |
| D03 | Hold online 15 phút. | P5 | Expiry = thời điểm tạo server + 15 phút; đến expiry hold không còn chiếm tồn, dù cleanup chưa chạy. |
| D04 | Giá gói giờ đầu, sau đó giá từng giờ phát sinh; số giờ gói và giá do chi nhánh cấu hình. | P2/P3 | Quote dùng đúng version policy; chưa cấu hình không tự tạo giá; booking giữ snapshot khi policy đổi. |
| D05 | Giờ phát sinh làm tròn lên mỗi 60 phút. | P2/P3 | Đúng cuối gói không phát sinh; vượt 1 phút tính 1 giờ; vượt 60 phút tính 1 giờ, vượt 61 phút tính 2 giờ. Không mặc định grace period. |
| D06 | Theo đêm mặc định nhận 12:00, trả 12:00 ngày kế tiếp; cơ sở cấu hình riêng giờ nhận/trả. Cập nhật theo xác nhận mới, thay mốc check-in 14:00 trước đó. | P2/P3 | Tính theo timezone cơ sở, overnight có EndAt > StartAt; thay giờ chính sách không đổi snapshot booking cũ. |
| D07 | Khoảng cách giữa checkout lượt trước và check-in lượt sau trên cùng phòng tối thiểu 30 phút, áp dụng giờ/đêm; chi nhánh được tăng nhưng không giảm dưới 30 phút; vẫn xác nhận đã dọn. | P2/P3 | Checkout 12:00: 12:29 bị chặn, 12:30 chỉ nhận khi đã dọn; cấu hình <30 phút bị từ chối; hết buffer không tự clean. |
| D08 | Demo online: lễ tân xác nhận và ghi nhận cọc thủ công trước khi hold hết hạn; chưa gateway. | P4/P5 | Xác nhận đúng quyền/scope, cọc thỏa policy và hold còn hiệu lực; retry không tạo booking/payment trùng. |
| D09 | Chi nhánh cấu hình hạn hủy miễn phí/phí hủy; snapshot khi đặt; hoàn tiền thủ công có audit. | P2/P4/P5 | Đổi chính sách không đổi phí booking cũ; người không quyền không ghi refund; truy vết actor/thời điểm/số tiền/lý do. |
| D10 | AI tìm phòng tiếng Việt cho khách online và nhân viên, chỉ dùng giá/tồn từ backend. | P6 | Public chỉ thấy dữ liệu public; staff chỉ thấy branch được giao; AI hỏi lại thiếu dữ liệu và có fallback form. |

| D11 | MVP timezone Asia/Ho_Chi_Minh, VND; lưu thời điểm UTC, hiển thị/tính ngày theo giờ cơ sở. | P1–P5 | Round-trip UTC/local đúng; không lấy timezone máy chủ để tính ngày lưu trú. |
| D12 | Gói giờ đầu mặc định 2 giờ, sau đó giá từng giờ phát sinh. | P2/P3 | 2 giờ dùng giá gói; 2 giờ 1 phút dùng giá gói + 1 giờ thêm theo D05. |
| D13 | Fixture Standard: 150.000đ/2 giờ đầu, 50.000đ/giờ thêm, 400.000đ/đêm; là cấu hình demo, không hardcode giá toàn hệ thống. | P2/P7 | 3 giờ = 200.000đ; 3 giờ 1 phút = 250.000đ; 1 đêm = 400.000đ trước phụ thu đã cấu hình. |
| D14 | Giới hạn thuê giờ tối đa (MaxHourlyHours) cấu hình riêng theo cơ sở: 1–24 giờ, mặc định 12 giờ. Vượt giới hạn yêu cầu chọn hình thức khác (thuê đêm), tuyệt đối không tự chuyển sang thuê đêm. | P2/P3 | Thuê giờ > MaxHourlyHours trả HTTP 422 ERR_HOURLY_LIMIT_EXCEEDED; cấu hình < 1h hoặc > 24h trả HTTP 400 ERR_VALIDATION; không tự động convert gói sang overnight. |
| D15 | Online cọc 30% tổng tiền cho giờ và đêm. | P4/P5 | Standard 2 giờ cọc 45.000đ; 1 đêm cọc 120.000đ; confirm theo policy cọc, không coi cọc là toàn bộ tiền đã trả. |
| D16 | Nội bộ không bắt buộc cọc; lễ tân có thể ghi cọc hoặc thu khi khách đến. | P3/P4 | Booking nội bộ không cọc vẫn xác nhận đúng quyền, công nợ còn nguyên. |
| D17 | Chính sách demo: thuê giờ hủy trước ít nhất 2 giờ, thuê đêm trước ít nhất 24 giờ miễn phí; hủy muộn phí 30% tổng tiền booking. Chi nhánh được cấu hình, snapshot khi đặt. | P2/P4/P5 | Test đúng mốc và hai phía mốc; refund tính từ khoản thực thu trừ phí, không hoàn tiền chưa thu. |
| D18 | Lễ tân xác nhận no-show thủ công; phí bằng mức hủy muộn trong snapshot, phần thu dư xử lý hoàn thủ công. | P3/P4 | Không tự no-show bằng timer chưa chốt; audit actor/thời điểm/phí và snapshot, không charge lặp. |
| D19 | Điều chỉnh thời gian nhận sớm/trả muộn/gia hạn: backend kiểm tra tồn và tính phụ thu theo bảng cấu hình, người dùng xác nhận trước cập nhật. | P2/P3 | Phòng xung đột thì từ chối; thiếu bảng phụ thu không tự gán giá; retry không cộng phí hai lần. |
| D20 | Quote TTL 5 phút (20B), khác hold TTL 15 phút. | P2/P5 | Quote hết hạn phải lấy lại giá; tạo hold revalidate giá/tồn. Không tự rút hold xuống 5 phút hoặc tự kéo quote lên 15 phút. |
| D21 | Link tra cứu bảo mật gửi email, hết hạn 7 ngày sau thời điểm trả phòng, có thể thu hồi/cấp lại. | P5 | Email chỉ chứa quyền lookup tối thiểu; token thu hồi/hết hạn không đọc PII; lookup không tự cấp quyền hủy/refund. |
| D22 | Cọc đến sau hold expiry: không tự khôi phục; ghi tiền chờ xử lý. Lễ tân kiểm tra tồn tạo booking mới hoặc chuyển yêu cầu refund cho quản lý. | P4/P5 | Khoản thu không mất/nhân đôi, không ép bán trùng; liên kết xử lý có audit. |
| D23 | Lễ tân tạo yêu cầu refund; quản lý chi nhánh hoặc admin doanh nghiệp duyệt và ghi nhận. | P4 | Lễ tân không tự duyệt/ghi hoàn tất; approver đúng scope; retry không refund trùng. |
| D24 | Platform mặc định quản trị tenant; hỗ trợ dữ liệu vận hành chỉ khi doanh nghiệp cấp quyền có thời hạn, lý do/audit. | P1 | Không quyền support hoặc đã hết hạn thì từ chối; quyền cấp giới hạn tenant/scope và có thể thu hồi. |
| D25 | Giá mẫu là tổng giá khách trả, không tự cộng thuế/phí chưa cấu hình; VND làm tròn 1 đồng, lưu quy tắc trong snapshot. Không cam kết hóa đơn/thuế thực tế. | P2/P4 | Breakdown khớp tổng; không cộng thuế hai lần; test ranh giới làm tròn sau chốt midpoint rule. |

## Contracts và failure paths

- Giờ check-in/check-out theo đêm là policy từng cơ sở, snapshot vào booking; mặc định 12:00 ngày nhận đến 12:00 ngày trả (ít nhất ngày kế tiếp), không phải giới hạn thuê giờ 12 giờ. Check-in đúng mốc chỉ khi phòng sẵn sàng. Checkout lượt trước lúc 12:00 thì lượt sau trên cùng phòng sớm nhất 12:30, và chỉ khi đã xác nhận dọn xong. Khi xếp lịch dùng thời điểm kết thúc dự kiến + buffer; khi nhận khách dùng checkout thực tế + buffer và clean readiness. Checkout thực tế trễ phải chặn check-in, không tự sửa giờ/giá booking sau. Mốc check-in cơ sở 12:00 không ghi đè khoảng cách này; UI/search phải hiển thị thời điểm khả dụng thật. Mức phụ thu trả muộn theo đêm còn cấu hình/chốt, không mặc định dùng giá thuê giờ.
- Backend tính tiền decimal, currency/breakdown/snapshot; D12/D13 là mặc định/fixture được duyệt, không phải giá cố định mọi loại phòng/chi nhánh.
- D05 làm tròn thời gian phát sinh lên 60 phút; D19 không cho phép gia hạn đè booking kế tiếp. Biểu phí nhận sớm/trả muộn và xử lý khách thực ở quá giờ cần cấu hình/chốt chi tiết.
- Quote 5 phút, hold 15 phút là hai lifecycle. Khi tạo hold kiểm tra lại giá/tồn; nếu quote stale thì yêu cầu lấy/xác nhận lại. Cơ chế pin giá trong hold và race giữa quote expiry/confirm cần chốt contract trước P5, không âm thầm đổi giá.
- Confirm/expiry/cleanup atomic: không khôi phục hold hết hạn hoặc giải phóng booking confirmed. D22/D23 quy định khoản tiền nhận muộn phải xử lý thủ công có audit, không được bỏ mất.
- Tiền hoàn dựa trên khoản thực thu và phí snapshot; nếu phí lớn hơn thực thu, không tạo refund âm. Quy tắc công nợ/miễn phần phí chưa thu còn mở.
- Token lookup không đoán được, scope tối thiểu, không log; D21 TTL tới 7 ngày sau trả phòng. Cần chốt mốc trả phòng dự kiến hay thực tế và cập nhật TTL khi booking đổi/hủy/no-show.
- Support grant D24 phải giới hạn tenant/scope/time; không biến quyền platform thành quyền đọc mặc định toàn bộ dữ liệu.
- AI không SQL/mutation/đặt trước xác nhận; server-side secrets, data minimization, timeout/quota/fallback.

## Các tham số/quy tắc vẫn còn mở

- Biểu phụ thu nhận sớm/trả muộn, minimum stay ngoài gói đầu, vượt giờ thực tế và xung đột lượt sau.
- Quote/hold price pinning, tiền cọc vượt mức yêu cầu, phí chưa thu sau hủy/no-show; không tự ghi công nợ/miễn phí ngoài quyết định đã duyệt.
- Midpoint rule VND 1 đồng, thuế/phí khi cấu hình và thời điểm rounding cọc/phí cần chốt contract.
- Mốc no-show và quyền ghi nhận; token TTL theo checkout dự kiến/thực tế, booking hủy/no-show; support grant max duration/scope.
- Budget AI/SLA/quy mô/deadline; rubric có bắt buộc catalog/bản đồ/VNPay không.

## Trạng thái P0

Toàn bộ 25 lựa chọn sản phẩm đã được phê duyệt (D01–D25). D14 đã được PO duyệt theo Phương án C (cấu hình MaxHourlyHours theo cơ sở 1–24h, mặc định 12h, vượt giới hạn từ chối với ERR_HOURLY_LIMIT_EXCEEDED, không tự chuyển sang đêm). P0 tiếp tục đồng bộ actors/stories/processes/rules/data dictionary/ERD/API và chốt blocker theo task. Không coi tài liệu quyết định là chức năng đã implement.
