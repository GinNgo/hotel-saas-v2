# Screen design / handoff — concept để duyệt

Không phải screenshot ứng dụng hay file Canva đã tạo. Khuyến nghị giữ thế giới visual incumbent, cải thiện hierarchy thay vì rebrand. Đây là bố cục đề xuất; guest-first còn chờ xác nhận.

## Kiến trúc thông tin

- Guest: tìm chỗ nghỉ / điểm đến / thương hiệu / tra cứu / tài khoản. Marketplace → cơ sở → phòng → kiểm tra giá → giữ phòng → trạng thái.
- PMS: cơ sở đang chọn luôn thấy được; navigation vận hành riêng. Không trộn tài khoản khách và quyền quản lý trong cùng header.
- Cùng tokens/forms/status, khác density: guest ưu tiên đọc và quyết định; PMS ưu tiên scan, bảng, lặp thao tác. Không dùng một template hero cho cả hai.

## 1. Home / results

```text
[Logo nền tảng]  Khám phá ▾                  Tra cứu  Tài khoản

Tìm chỗ nghỉ phù hợp với lịch của bạn
[Điểm đến                         ] [Hình thức thuê]
[Ngày/giờ theo hình thức          ] [Số khách · 1 phòng] [Tìm]
Giờ nhận/trả và khả năng thuê tùy cơ sở

[Điểm đến biên tập — không kèm giá/số lượng bịa]

Kết quả + điều kiện đã chọn + số cơ sở trong tập tải về
[Bộ lọc]  [Ảnh/placeholder | Cơ sở, địa chỉ, dữ liệu thật | Xem phòng]
          Giá từ + đơn vị nếu có; chưa kiểm tra tồn theo lịch ở discovery
```

Mobile: search xếp một cột/nhóm hợp lý; summary filter và nút mở bộ lọc, không sidebar chiếm trước kết quả. Bộ lọc drawer phải có apply/reset/close và focus contract. Không thêm bản đồ interact cho đến khi có data/key/quota được duyệt; map hiện có ở đăng ký đối tác không phải chứng cứ search map-ready.

## 2. Detail

Tên + địa chỉ + brand khi có → gallery ảnh thật → lịch hiện tại và chỉnh lịch → danh sách phòng phù hợp → breakdown quote → CTA tiếp tục. Desktop có summary bên phải, mobile đặt summary sau phần chọn phòng; sticky chỉ khi không che content/safe area.

Các section: phòng; tiện nghi đã công bố; lịch/check-in/out thật; điều kiện hủy/thanh toán khi public API có dữ liệu; vị trí khi có tọa độ. Section thiếu dùng mô tả ngắn, không lấp bằng policy chung. Không hiện tab reviews đầy sao khi chưa có review API.

State: property not found, request fail/retry, chưa kiểm tra, không phòng phù hợp, quote loading/error/expired, thay lịch invalidate quote. CTA cho biết lý do chưa thể tiếp tục, không chỉ disable không lời giải thích.

## 3. Hold

```text
Quay lại cơ sở/lựa chọn hiện tại
Kiểm tra thông tin và giữ phòng

[Thông tin người nhận phòng]    [Cơ sở / phòng / lịch / khách]
 Họ tên                        [Breakdown từ server]
 Số điện thoại                 [Giá hết hiệu lực lúc ...]
 Email                         [Kiểm tra lại giá]
 [Giữ phòng với giá đã kiểm tra]
 Chỉ giữ thành công khi có mã server; chưa thanh toán tại bước này
```

Mobile summary ngắn trước form, breakdown có thể mở chi tiết nhưng tổng/lịch luôn thấy. Required/error theo field contract. Thành công hiển thị mã/trạng thái/expiry từ server, không thông điệp booking confirmed khi mới là hold. Expired có đường chọn lại giữ context; không countdown giả.

## 4. Account

Header identity thật → thông tin cá nhân → đặt phòng của tôi khi capability sẵn sàng. Thông báo unavailable gọn với đường tra cứu thay vì tab dài trống. Chưa gom hóa đơn pháp lý vào history mặc định; loyalty chỉ xuất hiện khi có contract/use case được duyệt.

API profile chưa hoạt động: nút chỉnh sửa không giả save. Khi mở feature thật phải thiết kế edit/cancel/pending/conflict/error/success; logout/account-switch không lưu draft/PII tài khoản trước vào session sau.

## 5. Auth và Partner

Auth: tiêu đề thể hiện cổng guest/PMS, label rõ, password reveal có accessible name, lỗi gần field, tổng lỗi server không lộ chi tiết. Social provider chỉ mở khi backend xác minh thật; thiết kế đẹp không cho phép demo identity.

Partner: nhóm tài khoản → cơ sở → địa chỉ/vị trí, progressive disclosure thay form dày. Ưu tiên địa chỉ text có thể sửa, options có loading/retry. Map không bắt buộc làm điều kiện hoàn tất nếu contract không yêu cầu; key/mapping provider mới phải được duyệt. Giữ payload/server validators, không tự quyết quyền nâng cấp tài khoản.

## 6. PMS pilot

PageHeader hiện có → ngữ cảnh cơ sở → form sections theo công việc → action footer nhất quán. Xác nhận trường bắt buộc rõ, server field error sát input, cancel không mutate. Chọn một form Properties cùng owner trước khi sửa; Payments/Housekeeping chỉ inventory, không sửa logic của Tân.

## Bộ frame giao cho công cụ thiết kế

- Component sheet: text/select/password/searchable/date, đủ idle/focus/invalid/disabled/pending; dialog/status/empty.
- Home + Detail + Hold + Account desktop 1440 và mobile 390; thêm frame layout-check 375/768/1024 trong QA sau implementation.
- Auth và một PMS form đại diện, không vẽ mọi module trước khi pilot đạt.
- Tất cả nội dung thiết kế dùng tên dữ liệu giả ghi rõ fixture, không đánh giá/giá thực hoặc PII. Không đưa source/secrets lên provider.
- Khi Canva MCP được kết nối, xác minh hỗ trợ tạo thiết kế từ đầu. Skill canva-edit-design chỉ sửa design có sẵn, không tạo textbox/page; không dùng workaround để tuyên bố tạo đủ mockup. Nếu capability không đủ, bàn giao spec hoặc xin dùng công cụ prototype khác.
