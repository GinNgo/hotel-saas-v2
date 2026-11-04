# KHAI BÁO SỬ DỤNG AI & MINH CHỨNG CHỈNH SỬA TUẦN 04
## DỰ ÁN: HOTEL SAAS PLATFORM V2 (.NET 10 + ANGULAR 22 + POSTGRESQL 17)
**Trường Đại học Sư phạm Kỹ thuật TP. Hồ Chí Minh — Khoa CNTT — Bộ môn CNPM**  
**Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng  
**Thời gian:** Tuần 04 (26/10/2026 – 02/11/2026)  
**Kho mã nguồn:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2) | **Nhánh:** `develop`

---

### 1. Ngô Võ Tuấn An (MSSV: 24TX810001 — Trưởng nhóm)

**AI hỗ trợ:** Google Antigravity / Gemini 3.8 Flash

**Prompt:**
[Prompt 1 - Ký số VNPay HMAC-SHA512]: "Hãy xây dựng VnpayPaymentService kết nối cổng VNPay Sandbox (.NET 10). Sắp xếp query params theo alphabet ASCII, ghép chuỗi hashData và băm HMAC-SHA512 với vnp_HashSecret. Viết hàm ValidateSignature đối soát chữ ký số trả về."

[Prompt 2 - Webhook VNPay IPN ngầm]: "Viết MediatR command ProcessVnpayIpnCommand xử lý webhook IPN từ VNPay: kiểm tra chữ ký, mã đơn vnp_TxnRef, số tiền vnp_Amount, cập nhật trạng thái Confirmed và trả về JSON {RspCode: '00', Message: 'Confirm Success'}. Đảm bảo phân lập đa thuê bao an toàn."

[Prompt 3 - Xác thực Email qua Token Stateless]: "Thiết kế cơ chế kích hoạt tài khoản qua email cho khách mới đăng ký, gửi link qua Gmail SMTP. Dùng token bảo mật tự hết hạn sau 30 phút, không thêm cột OTP vào bảng Users trong CSDL."

[Prompt 4 - Khắc phục lóa trắng & Chuẩn hóa DatePicker]: "Khắc phục giao diện B2C bị lóa trắng, tăng tương phản viền khối. Thay toàn bộ input date native bằng PrimeNG DatePicker chuẩn UTC+7, thêm padding-right an toàn tránh icon che khuất chữ số ngày dd/mm/yyyy."

**AI tạo ra:**  
Hàm băm VNPay dùng `UrlEncode` trước khi băm gây sai lệch chữ ký, báo lỗi Checksum 97. Webhook IPN chạy ngầm không có claims người dùng nên bị DbContext chặn vì thiếu TenantId/PropertyId. Phần xác thực email đề xuất lưu cột OTP vào bảng Users làm phình schema với dữ liệu tạm thời và phát sinh I/O ghi đĩa không cần thiết. DatePicker bị icon calendar đè mất 2 số cuối của năm.

**SV đã sửa:**  
Kiểm tra ký số VNPay: Sửa hàm băm chỉ lấy raw string các trường có tiền tố `vnp_` nối bằng `&`, bổ sung fallback kiểm tra cả unencoded và encoded; thanh toán thử 1.500.000đ trên VNPay Sandbox thành công 100%. Kiểm tra Webhook IPN: Truy vấn đơn phòng theo TransactionRef trước, nạp TenantId/PropertyId vào ICurrentTenantService rồi mới SaveChanges; test webhook cập nhật đơn Confirmed chuẩn xác. Kiểm tra xác thực email: Chuyển sang dùng JWT Stateless ký HMAC-SHA256, claim `purpose: email_verification` hạn 30 phút, gửi qua MailKit; test click link kích hoạt thành công IsEmailVerified = true. Kiểm tra giao diện & DatePicker: Tăng tương phản viền slate, đặt padding-right `2.75rem` cho input datepicker; test hiển thị rõ `dd/mm/yyyy` trên toàn bộ màn hình.  
**Minh chứng Commit GitHub:**  
Commit `e781ac1` : fix(vnpay): align HMAC-SHA512 query string signing with official VNPay specification  
Commit `fe0cc91` : fix(payment): add unencoded verification fallback and dynamic test dates  
Commit `4a7927b` : fix(payment): provide tenant and property scoping in ProcessVnpayIpnCommand  
Commit `9c48602` : feat(auth): implement email verification token and confirm email page  
Commit `befef49` : fix(ui): eliminate washed-out white layout with architectural ground, distinct borders and enhanced payment hub contrast  
Commit `3218817` : fix(ui): standardize date pickers and eliminate icon overlap across frontend  

---

### 2. Nguyễn Khôi Nguyên (MSSV: 24TX810011)

**AI hỗ trợ:** OpenAI Codex / GPT-6 Astra

**Prompt:**
[Prompt 1 - Xuất báo cáo Excel bằng ClosedXML]: "Xây dựng ReportExportService dùng ClosedXML (.NET 10) xuất báo cáo doanh thu ra file .xlsx. Báo cáo gồm thông tin chi nhánh, khoảng ngày, danh sách đơn phòng, tiền phòng, minibar, tổng tiền. Dòng tổng cộng ở cuối bảng phải dùng công thức SUM tự động của Excel."

[Prompt 2 - Xuất Hóa đơn PDF bằng QuestPDF]: "Dùng QuestPDF thiết kế hóa đơn tiền phòng khổ A4: Header khách sạn, thông tin khách, chi tiết phòng, thuế phí, số tiền đã trả và còn lại. Đảm bảo chạy hoàn toàn offline, không gọi API bên thứ ba."

[Prompt 3 - Tùy chọn thanh toán B2C & VietQR]: "Tại trang giữ phòng và tra cứu, bổ sung lựa chọn thanh toán: VNPay, VietQR và Tiền mặt tại quầy (cọc 30% trong 15 phút). Với VietQR, hiển thị ảnh QR, ngân hàng, số tài khoản, số tiền và nút sao chép."

**AI tạo ra:**  
Hàm xuất Excel tính tổng doanh thu bằng code C# rồi ghi số cứng vào ô tổng cộng, sửa số liệu hàng thì ô tổng không tự cập nhật. File PDF gọi Google Charts API lấy ảnh QR, phụ thuộc mạng ngoài và dễ đơ luồng khi offline. Giao diện VietQR báo tự động xác nhận chuyển khoản trong khi hệ thống chưa có webhook ngân hàng đối soát.

**SV đã sửa:**  
Kiểm tra xuất Excel: Đổi số cứng thành công thức `=SUM(H{start}:H{end})`, bổ sung lọc theo TenantId; mở Excel sửa số liệu thấy tổng tự nhảy lại, unit test pass 1/1. Kiểm tra xuất PDF: Bỏ lệnh gọi Google Charts API để xuất offline ổn định dưới 200ms, dời mã QR nội bộ sang Tuần 5. Kiểm tra thanh toán B2C: Sửa mô tả tiền mặt yêu cầu nộp cọc 30% tại quầy trong 15 phút; hiển thị đúng thông tin VietQR và nút sao chép số tài khoản.  
**Minh chứng Commit GitHub:**  
Commit `4983182` : feat(reports): add Excel and PDF exports with payment options  
Commit `5353c1e` : merge: integrate feature/nguyen-week4-invoicing-export into develop  

---

### 3. Trần Trọng Tân (MSSV: 24TX810025)

**AI hỗ trợ:** Google Antigravity / Gemini 3.8 Flash

**Prompt:**
[Prompt 1 - Chuông thông báo OnPush Signals & SignalR]: "Xây dựng component `<app-notification-bell>` trên Header PMS bằng Angular 22 Signals và SignalR client: badge chưa đọc, dropdown 10 thông báo gần nhất, phím tắt WAI-ARIA, tự phát âm thanh và hiện Toast 5 giây khi có sự kiện mới."

[Prompt 2 - Cảnh báo giữ phòng 3 phút & Gia hạn 5 phút]: "Trên booking-hold.page.ts, khi thời gian giữ phòng còn <= 3 phút thì đổi màu hổ phách cảnh báo. Thêm nút 'Gia hạn 5 phút', khống chế chỉ cho phép gia hạn tối đa 1 lần duy nhất."

[Prompt 3 - Nhật ký kiểm toán tự động bằng EF Interceptor]: "Xây dựng hệ thống Audit Logging tự động ghi vết thay đổi giá phòng, hóa đơn, hủy phòng bằng SaveChangesInterceptor của EF Core. Lọc bỏ thông tin nhạy cảm trước khi lưu JSON, phân quyền trang tra cứu cho Owner và GeneralManager."

[Prompt 4 - Hủy phòng B2C & Phí phạt 24h]: "Xây dựng chức năng hủy đặt phòng trên booking-status.page.ts: hủy trước 24h miễn phí, trong vòng 24h phạt 100% cọc đêm đầu. Tách bạch việc giải phóng phòng trống ngay với quy trình duyệt hoàn tiền D23 tại quầy."

### AI tạo ra và những hạn chế phát hiện được

- **T01 – Chuông thông báo:** Ở phiên bản đầu, AI sắp xếp quá nhiều thành phần trong khung Header có chiều rộng cố định 400px. Điều này khiến tiêu đề “Trung tâm thông báo” bị cắt chữ, còn nhãn “Trực tiếp” bị xuống dòng. AI cũng đưa ra phương án sử dụng âm thanh từ tệp MP3 tĩnh thay vì tạo âm thanh bằng Web Audio như yêu cầu ban đầu.

- **T02 – Cảnh báo và gia hạn giữ phòng:** Phần gia hạn ban đầu chỉ tăng biến `remainingSeconds` thêm 300 giây ở frontend, chưa gọi API để cập nhật thời hạn giữ phòng thực tế. Do không kiểm soát số lượt gia hạn, người dùng có thể liên tục bấm nút khiến thời gian hiển thị tăng lên, dù server chưa xác nhận gia hạn.

- **T03 – Nhật ký kiểm toán:** Mặc dù prompt đã yêu cầu sử dụng EF Core Interceptor, phương án AI đưa ra ban đầu vẫn thiên về ghi log thủ công tại từng Controller. Cách triển khai này dễ bỏ sót thao tác thay đổi dữ liệu và khó quản lý tập trung. Bên cạnh đó, dữ liệu lưu trong nhật ký chưa được lọc đầy đủ, tiềm ẩn nguy cơ ghi nhận cả những trường thông tin nhạy cảm.

- **T04 – Hủy phòng và hoàn tiền:** Modal xác nhận hủy phòng ban đầu chỉ thông báo mức phí phạt 30% mà không hiển thị rõ các mốc thời gian dùng để tính phí. Nội dung thông báo còn mặc định khách sẽ nhận tiền hoàn qua chuyển khoản, chưa phân biệt giữa việc hủy đơn thành công và quá trình đối soát, phê duyệt hoàn tiền.

### Quá trình sinh viên phát hiện, điều chỉnh và kiểm chứng

**T01 – Kiểm tra và chỉnh sửa giao diện Chuông thông báo**

Sau khi chạy frontend, em mở dropdown chuông thông báo để xem giao diện thực tế. Lúc này, tiêu đề bị cắt thành “Trung tâm thông...” và nhãn “Trực tiếp” hiển thị trên hai dòng, làm phần Header khá rối.

Em chụp ảnh màn hình lỗi và gửi cho Antigravity IDE, yêu cầu AI sắp xếp lại các thành phần để không bị tràn hoặc xuống dòng. AI bổ sung `whitespace-nowrap`, `shrink-0`, thu gọn badge số lượng thông báo chưa đọc và điều chỉnh chiều rộng dropdown thành `w-[min(26rem,calc(100vw-1.5rem))]`.

Em mở lại giao diện để kiểm tra phần tiêu đề, badge và cách hiển thị của dropdown sau khi sửa.

**T02 – Kiểm tra chức năng gia hạn giữ phòng**

Trong lúc thử tính năng trên trang giữ phòng, em thấy thanh cảnh báo đã xuất hiện khi đồng hồ còn khoảng 3 phút. Tuy nhiên, khi bấm gia hạn nhiều lần, thời gian trên giao diện tiếp tục tăng mà chưa có cơ chế chặn lượt.

Em nhận thấy cách xử lý này không phù hợp vì thời hạn giữ phòng cần được backend quản lý. Em viết prompt yêu cầu AI sửa lại chức năng, gọi API gia hạn và sử dụng `holdExtensionCount` từ dữ liệu server để kiểm tra số lượt đã dùng.

Sau khi AI cập nhật, em thử gia hạn thêm 5 phút và kiểm tra trạng thái nút. Giao diện hiển thị “Đã sử dụng 1/1 lượt gia hạn”, đồng thời không cho phép tiếp tục bấm. Phần backend cũng được bổ sung kiểm tra giới hạn một lần gia hạn để tránh phụ thuộc hoàn toàn vào frontend.

**T03 – Kiểm tra Audit Logging và dữ liệu nhạy cảm**

Khi xem lại cách AI triển khai chức năng ghi nhật ký, em nhận thấy việc thêm lệnh ghi log thủ công vào từng Controller sẽ dễ thiếu sót nếu sau này hệ thống phát sinh thêm API hoặc các thao tác cập nhật ngầm.

Vì vậy, em yêu cầu AI viết một prompt fix, trong đó nhấn mạnh việc chuyển sang `AuditSaveChangesInterceptor` của EF Core và sử dụng `ChangeTracker` để tự động ghi nhận các thay đổi.

Đối với dữ liệu JSON, em tiếp tục yêu cầu AI bổ sung cơ chế lọc thông tin nhạy cảm trước khi lưu. Phần xử lý này được triển khai thông qua các hàm kiểm tra tên trường và xử lý giá trị ngay trong `AuditSaveChangesInterceptor`, thay vì lưu toàn bộ dữ liệu thô.

Ở bước kiểm chứng, em xem lại dữ liệu nhật ký và thử phân quyền truy cập trang `/admin/audit-logs`. Tài khoản lễ tân thông thường bị từ chối truy cập, trong khi tài khoản có vai trò `Owner` hoặc `GeneralManager` có thể mở trang tra cứu và xem chi tiết thay đổi.

**T04 – Kiểm tra hủy phòng và làm rõ quy trình hoàn tiền D23**

Khi thử hủy một đơn đặt phòng trong vòng 24 giờ trước giờ nhận phòng, em thấy modal chỉ hiển thị khoản phạt 30% mà không giải thích rõ cách xác định thời gian. Nếu là khách hàng, việc chỉ nhìn thấy tỷ lệ phạt như vậy sẽ khá khó hiểu.

Em yêu cầu AI viết prompt fix để bổ sung giờ nhận phòng, thời điểm gửi yêu cầu hủy và số giờ còn lại trước khi nhận phòng. Đồng thời, phần điều khoản phí phạt cần được trình bày nổi bật hơn.

Một vấn đề khác em nhận ra là thông báo hoàn tiền chưa đúng với mọi phương thức thanh toán. Khách có thể thanh toán bằng VNPay, VietQR hoặc tiền mặt, nên không thể mặc định khách sạn sẽ hoàn tiền bằng chuyển khoản.

Em sử dụng prompt đã điều chỉnh để Antigravity IDE sửa lại giao diện và nội dung thông báo. Theo quy trình D23, việc hủy đơn và giải phóng phòng được xử lý riêng với việc hoàn tiền; khoản hoàn dự kiến vẫn cần được đối soát và phê duyệt trước khi chi trả.

Sau khi chỉnh sửa, em kiểm tra lại modal hủy phòng và trang trạng thái đặt phòng để bảo đảm khách có thể phân biệt giữa “Đã hủy đặt phòng” và “Đã hoàn tiền”.

**Minh chứng Commit GitHub:**
Commit ce6dfe9 : feat(notifications): add notification bell, realtime toast and SignalR client (T01)
Commit 3f43393 : feat(booking): add 3-min hold expiration alert and guest cancellation workflow (T02, T04)
Commit 96e0acc : feat(audit): implement audit logging entity, interceptor, controller and admin UI (T03)
Commit 786fa5a : merge(week4): integrate feature/tan-week4-notifications-audit into develop
