# BÁO CÁO TIẾN ĐỘ TUẦN 02 — TRẦN TRỌNG TÂN

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

## THÔNG TIN CHUNG

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Sinh viên thực hiện:** Trần Trọng Tân — `24TX810025`
* **Email sinh viên:** `24tx810025@student.hcmute.edu.vn`
* **Giảng viên hướng dẫn:** Huỳnh Xuân Phụng
* **Phạm vi tuần 02:** Giao diện vận hành lễ tân, liên thông buồng phòng và thu ngân.
* **Kế hoạch phân công:** [Kế hoạch chi tiết tuần 2](../team/KE-HOACH-CHI-TIET-TUAN-2.md)
* **Kho mã nguồn:** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh thực hiện:** [`feature/tan-operations`](https://github.com/GinNgo/hotel-saas-v2/tree/feature/tan-operations)
* **Commit minh chứng:** [`f711156`](https://github.com/GinNgo/hotel-saas-v2/commit/f711156) — `feat(Tran Trong Tan): implement receptionist operations and cashier reporting`

## PHẦN I. TỔNG QUAN KẾT QUẢ TUẦN 02

Tuần 02 tập trung nối quy trình đặt phòng đã có với thao tác thực tế tại quầy: nhận phòng, thu tiền, trả phòng và bàn giao phòng bẩn cho bộ phận buồng phòng. Giao diện sử dụng API và trạng thái lưu tại backend thay vì tự đổi trạng thái chỉ ở phía trình duyệt.

| Hạng mục trong kế hoạch | Kết quả triển khai | Minh chứng chính |
| :--- | :--- | :--- |
| Check-in / Check-out | Modal xác nhận nhận/trả phòng, kiểm tra trạng thái và công nợ trước khi trả phòng | `reservations.page.ts` |
| Liên thông buồng phòng | Sau Check-out, phòng chuyển sang `Dirty`; bảng buồng phòng cập nhật trạng thái | `housekeeping.page.ts`, API Check-out hiện có |
| Folio và thu ngân | Xem tiền phòng, khoản phát sinh, tiền đã trả/cọc và số dư; ghi nhận tiền mặt hoặc chuyển khoản | `payments.page.ts`, `GetFolioQueryHandler.cs` |
| Báo cáo thu | Tổng thực thu trong ngày theo giờ Việt Nam và báo cáo theo ca | `payments.page.ts`, `GetShiftReportQueryHandler.cs` |

## PHẦN II. NỘI DUNG THỰC HIỆN

### 1. Thủ tục nhận phòng và trả phòng

* **Nhận phòng:** Bổ sung modal đối chiếu giấy tờ tùy thân trực tiếp tại quầy, xác nhận khách và phòng được giao; gửi yêu cầu Check-in qua `ReservationService`. Hệ thống không lưu hoặc truyền số giấy tờ qua thao tác xác nhận này. API hiện có chuyển trạng thái đặt phòng sang đang lưu trú và phòng vật lý sang `Occupied`.
* **Trả phòng:** Modal hiển thị thông tin đơn, công nợ Folio và cảnh báo khoản còn phải thu. Lễ tân thu đủ tiền trước khi hoàn tất; API Check-out hiện có xử lý chuyển trạng thái đặt phòng và phòng vật lý sang `Dirty` trong cùng nghiệp vụ.
* **Đồng bộ giao diện:** Chuẩn hóa ánh xạ trạng thái đặt phòng trả về từ API, tải lại danh sách và thông tin phòng sau thao tác. Các modal dùng phần phủ toàn màn hình để tránh khoảng hở ở đầu trang.

### 2. Liên thông bảng buồng phòng

* Bảng buồng phòng nhận và hiển thị lại trạng thái thực tế sau Check-out; `Dirty` được phân biệt với phòng đang có khách và phòng sẵn sàng.
* Tận dụng quy trình dọn phòng và máy trạng thái đã xây dựng ở tuần 01, không thay thế trạng thái trong cơ sở dữ liệu bằng màu sắc chỉ tồn tại trên frontend.

### 3. Bảng kê Folio và thu tiền

* Hiển thị giá phòng theo bản chụp lúc đặt, khoản phát sinh, số tiền đã thanh toán/đặt cọc và số dư còn phải thu. Khoản đã thu được ghi nhận như thanh toán, không trừ cọc hai lần.
* Form tại quầy cho phép thu tiền mặt hoặc chuyển khoản, nhập mã tham chiếu/ghi chú và tra cứu lịch sử giao dịch. Chỉ giao dịch hoàn tất mới được tính vào số thực thu.
* Không coi việc hiển thị mã QR là đã thanh toán. Giao diện không hiển thị QR khi chi nhánh chưa có tài khoản nhận tiền được cấu hình hợp lệ.
* Trang thu ngân có chức năng hiển thị phiếu thu; đây là chứng từ thu tiền trong hệ thống, không đồng nghĩa với hóa đơn thuế điện tử.

### 4. Báo cáo thu ngân

* Modal “Báo cáo thu ngân trong ngày” ở trang Đặt phòng và trang “Thu ngân & Giao dịch” hiển thị tổng thực thu, số giao dịch cùng phân tách theo phương thức thanh toán của chi nhánh đang chọn.
* Báo cáo ca thu ngân lọc theo ngày và ca, áp dụng ranh giới thời gian theo múi giờ Việt Nam (UTC+7); các khoảng ca không chồng lấn tại thời điểm giao ca.
* Có trạng thái đang tải, lỗi, làm mới và hiển thị `0 đ` khi không có giao dịch. Báo cáo theo ca hiện phục vụ thống kê/bàn giao, chưa phải quy trình kiểm đếm và khóa két vật lý.

## PHẦN III. MINH CHỨNG MÃ NGUỒN

Các liên kết dưới đây trỏ tới nhánh tính năng đã đẩy lên GitHub; việc hợp nhất vào `develop` phụ thuộc quy trình review của nhóm.

* **Lễ tân và đặt phòng:** [reservations.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/reservations/reservations.page.ts), [reservation.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/core/services/reservation.service.ts), [reservations.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/reservations/reservations.page.spec.ts).
* **Buồng phòng:** [housekeeping.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/housekeeping/housekeeping.page.ts), [room.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/core/services/room.service.ts), [housekeeping.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/housekeeping/housekeeping.page.spec.ts).
* **Folio và thu ngân:** [payments.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/payments/payments.page.ts), [payment.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/core/services/payment.service.ts), [GetFolioQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs), [CreatePaymentCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs).
* **Báo cáo ca và kiểm thử:** [GetShiftReportQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs), [PaymentsController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs), [P4_CashFolioTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs), [payments.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/payments/payments.page.spec.ts).
* **API vòng đời đặt phòng được tích hợp:** [ReservationsController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs), [CheckInReservationCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs), [CheckOutReservationCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs). Các API/handler này là thành phần sẵn có được nối vào giao diện, không nhận là toàn bộ mã nguồn mới của tuần 02.

## PHẦN IV. KIỂM THỬ VÀ ĐỐI CHIẾU

* Đã bổ sung/điều chỉnh kiểm thử cho giao diện Đặt phòng, Buồng phòng, Thu ngân, service trạng thái và nghiệp vụ Folio/báo cáo ca. Các trường hợp chính gồm thành công, lỗi API, thay đổi chi nhánh, trạng thái rỗng và ranh giới ca.
* Đã kiểm thử thủ công luồng đặt phòng → Check-in → thu tiền mặt → Check-out trên tài khoản lễ tân mẫu; đối chiếu trạng thái phòng và tổng thu trong ngày trên giao diện.
* Không khẳng định toàn bộ bộ kiểm thử frontend đã đạt: một số test của phân hệ đặt phòng công khai ngoài phạm vi tuần 02 còn không tương thích. Cần chạy lại các quality gate trên commit cuối hoặc xem kết quả CI trước khi nghiệm thu chính thức.

## PHẦN V. SỬ DỤNG AI VÀ GIỚI HẠN NGHIỆP VỤ

* Trong quá trình phát triển có sử dụng trợ lý AI để khảo sát kiến trúc, đề xuất sửa lỗi giao diện/API và gợi ý kiểm thử. Sinh viên đối chiếu với kế hoạch, đọc lại mã nguồn, chạy thử luồng nghiệp vụ và quyết định phần mã được đưa vào commit. Tên model, danh sách prompt và thời điểm sử dụng cần lấy từ nhật ký AI thực tế; báo cáo này không tự dựng lại các thông tin đó.
* Phần chuyển khoản/QR cần tài khoản ngân hàng thực tế của từng chi nhánh và quy trình xác nhận tiền vào tài khoản. Phiếu thu trong hệ thống chưa thay thế hóa đơn điện tử; báo cáo ca chưa bao gồm kiểm quỹ vật lý.
* Trạng thái Pull Request/review/merge chưa được ghi là hoàn tất trong báo cáo này. Sau khi tạo PR vào `develop`, bổ sung liên kết PR và kết quả CI để làm minh chứng nghiệm thu cuối cùng.
