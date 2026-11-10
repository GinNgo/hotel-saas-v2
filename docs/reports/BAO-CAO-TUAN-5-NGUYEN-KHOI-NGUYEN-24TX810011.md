# Báo cáo cá nhân tuần 05 — Nguyễn Khôi Nguyên

**Đề tài:** Hotel SaaS Platform v2

**MSSV:** 24TX810011

**Tài khoản GitHub:** [khoinguyen1310](https://github.com/khoinguyen1310)

**Thời gian báo cáo:** 02/11/2026 – 09/11/2026

**Nhánh:** `feature/nguyen-week5-invoice-reporting-pref`

**Commit:** [`96a559a`](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a252e27c197e8d8bfb21f2362fefb7135a) — `feat(reports): add invoice QR and reporting filters`
**Pull request:** [#21 — feat(reports): add invoice QR and reporting filters](https://github.com/GinNgo/hotel-saas-v2/pull/21)

## Công việc đã thực hiện

Tuần này em triển khai ba hạng mục N01–N03 trong prompt thực thi tuần 05. Code đã được đẩy lên nhánh cá nhân và mở pull request vào `develop`.

### N01 — QR tra cứu trên hóa đơn PDF

Em bổ sung QRCoder để sinh mã QR ngay trong ứng dụng, không gọi dịch vụ QR bên ngoài. Hóa đơn PDF nhúng QR kích thước 80 × 80 và dòng hướng dẫn quét mã. Nội dung QR trỏ tới trang tra cứu đặt phòng với lookup token lấy từ reservation snapshot; token hết hạn hoặc bị thu hồi sẽ không được đưa vào mã QR.

Em tách phần render PDF thành hàm có thể gọi độc lập và thêm unit test kiểm tra PDF có QR trả về dữ liệu PDF hợp lệ, dung lượng lớn hơn 1.000 byte. Việc sinh QR và xuất PDF được thực hiện trong bộ nhớ; tài nguyên QR được giải phóng sau khi tạo ảnh.

### N02 — Lưu lựa chọn phương thức thanh toán

Repo sử dụng entity `Reservation` thay cho `Booking`, nên em thêm `PaymentMethodPreference` vào `Reservation`. Trường hỗ trợ Cash, VietQR, VNPay và BankTransfer; mặc định VNPay. Migration `AddPaymentMethodPreferenceToReservation` thêm cột có giá trị mặc định, giữ nguyên được các bản ghi đặt phòng hiện có.

Em nối lựa chọn từ payload tạo giữ phòng tới command handler và entity. Giao diện đặt phòng gửi phương thức đã chọn; lựa chọn “Tiền mặt tại khách sạn” được lưu thành Cash. Em cũng thêm lựa chọn chuyển khoản ngân hàng vào giao diện.

### N03 — Bộ lọc và tối ưu báo cáo

Trang báo cáo có lựa chọn kỳ tuần, tháng, quý, năm và bộ lọc loại phòng ở chế độ báo cáo chi nhánh. Ngày lịch được định dạng bằng `formatCalendarDate` để tránh lệch ngày do chuyển đổi UTC không cần thiết.

Ở backend, API báo cáo chi nhánh nhận `roomTypeId`; thống kê doanh thu và KPI chỉ truy vấn các phòng thuộc loại đã chọn. Dữ liệu reservation được chiếu về các trường cần dùng, còn thống kê thanh toán được nhóm theo phương thức ngay tại database. Phần báo cáo toàn chuỗi cũng dùng truy vấn đếm phòng và tổng hợp payment theo nhóm thay vì tải toàn bộ entity phòng và payment vào bộ nhớ.

## Kiểm tra và phần còn lại

- `git diff --check` đạt; quét staged diff không phát hiện mẫu credential.
- Đã thêm unit test cho PDF hóa đơn có QR, nhưng **chưa chạy test**.
- Chưa chạy backend build, frontend build hoặc toàn bộ test suite.
- Chưa benchmark thời gian truy vấn với 10.000 giao dịch; chưa thể xác nhận mục tiêu dưới 500 ms.
- Migration đã được thêm vào source nhưng chưa áp dụng lên database.
- Chưa kiểm thử trực tiếp QR bằng camera hoặc xác nhận token tra cứu qua staging.

## Tự đánh giá

Ba hạng mục tuần 05 đã có thay đổi source, migration và test mới để review trong [PR #21](https://github.com/GinNgo/hotel-saas-v2/pull/21). Em chưa xem phần việc là đã được kiểm chứng hoàn chỉnh vì chưa chạy build/test, benchmark hoặc kiểm tra trên staging. Hạng mục hiệu năng cần được đo bằng dữ liệu thực tế trước khi kết luận đạt ngưỡng yêu cầu.

## Ghi nhận sử dụng AI

- **Prompt:** Thực hiện các mục N01, N02, N03 dành cho Nguyễn Khôi Nguyên trong `docs/team/PROMPT-TUAN-5-THUC-THI-NHOM.md`.
- **Mục đích:** Hỗ trợ tích hợp QR hóa đơn, lưu phương thức thanh toán, và bổ sung bộ lọc/tối ưu báo cáo.
- **Giới hạn:** AI không chạy build, test suite, benchmark hoặc staging trong lượt thực hiện; mục tiêu hiệu năng 500 ms chưa được đo.
- **Kiểm tra và chỉnh sửa:** Đối chiếu prompt với cấu trúc repo (dùng `Reservation` thay cho `Booking`), rà lại diff, chạy `git diff --check` và quét mẫu credential trước commit.
- **Commit và review:** [Commit `96a559a`](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a252e27c197e8d8bfb21f2362fefb7135a), [PR #21](https://github.com/GinNgo/hotel-saas-v2/pull/21).
