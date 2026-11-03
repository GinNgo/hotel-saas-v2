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
Hàm băm VNPay dùng `UrlEncode` trước khi băm gây sai lệch chữ ký, báo lỗi Checksum 97. Webhook IPN chạy ngầm không có claims người dùng nên bị DbContext chặn vì thiếu TenantId/PropertyId. Phần xác thực email đề xuất lưu cột OTP vào bảng Users gây nặng CSDL. DatePicker bị icon calendar đè mất 2 số cuối của năm.

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

### 3. Trần Trọng Tấn (MSSV: 24TX810025)

**AI hỗ trợ:** Google Antigravity / Gemini 3.8 Flash

**Prompt:**
[Prompt 1 - Chuông thông báo OnPush Signals & SignalR]: "Xây dựng component `<app-notification-bell>` trên Header PMS bằng Angular 22 Signals và SignalR client: badge chưa đọc, dropdown 10 thông báo gần nhất, phím tắt WAI-ARIA, tự phát âm thanh và hiện Toast 5 giây khi có sự kiện mới."

[Prompt 2 - Cảnh báo giữ phòng 3 phút & Gia hạn 5 phút]: "Trên booking-hold.page.ts, khi thời gian giữ phòng còn <= 3 phút thì đổi màu hổ phách cảnh báo. Thêm nút 'Gia hạn 5 phút', khống chế chỉ cho phép gia hạn tối đa 1 lần duy nhất."

[Prompt 3 - Nhật ký kiểm toán tự động bằng EF Interceptor]: "Xây dựng hệ thống Audit Logging tự động ghi vết thay đổi giá phòng, hóa đơn, hủy phòng bằng SaveChangesInterceptor của EF Core. Lọc bỏ thông tin nhạy cảm trước khi lưu JSON, phân quyền trang tra cứu cho Owner và GeneralManager."

[Prompt 4 - Hủy phòng B2C & Phí phạt 24h]: "Xây dựng chức năng hủy đặt phòng trên booking-status.page.ts: hủy trước 24h miễn phí, trong vòng 24h phạt 100% cọc đêm đầu. Tách bạch việc giải phóng phòng trống ngay với quy trình duyệt hoàn tiền D23 tại quầy."

**AI tạo ra:**  
Chuông thông báo tải file MP3 ngoài bị lỗi 404 trên VPS, dùng `setInterval` gây rò rỉ bộ nhớ. Nút gia hạn chỉ tăng biến client `remainingSeconds += 300` cho phép bấm liên tục để giữ phòng vô hạn. Hệ thống kiểm toán đề xuất gọi thủ công ở Controller dễ sót và chuỗi JSON lưu cả hash mật khẩu. Giao diện hủy phòng không hiện mốc giờ check-in thực tế và báo tự động chuyển khoản tiền ngay gây hiểu nhầm.

**SV đã sửa:**  
Kiểm tra chuông thông báo: Dùng Web Audio API tổng hợp âm thanh chuông 2 âm sắc bằng JavaScript không cần file mp3, dọn dẹp subscription khi OnDestroy; test frontend pass 21/21. Kiểm tra cảnh báo giữ phòng: Đồng bộ thời gian với server, thêm biến `holdExtensionCount` khóa nút sau 1 lần gia hạn, đồng hồ dưới 3 phút chuyển màu hổ phách; test pass 39/39. Kiểm tra nhật ký kiểm toán: Dùng `AuditSaveChangesInterceptor` bắt ChangeTracker tự động, lọc bỏ PasswordHash/CreditCard trước khi lưu, phân quyền xem nhật ký; test pass 29/29. Kiểm tra hủy phòng: Hiển thị rõ giờ check-in, giờ hủy, số giờ còn lại và điều khoản phạt 24h; hủy phòng giải phóng phòng trống ngay, cọc chuyển sang chờ duyệt D23; test pass 111/111.  
**Minh chứng Commit GitHub:**  
Commit `ce6dfe9` : feat(notifications): add notification bell, realtime toast and SignalR client (T01)  
Commit `3f43393` : feat(booking): add 3-min hold expiration alert and guest cancellation workflow (T02, T04)  
Commit `96e0acc` : feat(audit): implement audit logging entity, interceptor, controller and admin UI (T03)  
Commit `786fa5a` : merge(week4): integrate feature/tan-week4-notifications-audit into develop
