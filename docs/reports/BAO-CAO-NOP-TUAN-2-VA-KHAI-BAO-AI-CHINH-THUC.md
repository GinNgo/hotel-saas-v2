# BÁO CÁO TIẾN ĐỘ TUẦN 02 VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**  
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

---

## THÔNG TIN CHUNG CỦA ĐỀ TÀI

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Giảng viên hướng dẫn:** Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 02:** 12/10/2026 – 18/10/2026 (Hoàn tất rà soát, nghiệm thu & tích hợp nhánh: 19/10/2026)
* **Kho mã nguồn chính thức (GitHub Repository):** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh tích hợp nghiệm thu:** [https://github.com/GinNgo/hotel-saas-v2/tree/develop](https://github.com/GinNgo/hotel-saas-v2/tree/develop) (đã đồng bộ lên nhánh [main](https://github.com/GinNgo/hotel-saas-v2/tree/main) qua PR #7 tại commit [`003a016`](https://github.com/GinNgo/hotel-saas-v2/commit/003a016))
* **Cam kết liên kết minh chứng:** Toàn bộ liên kết trong báo cáo này 100% sử dụng đường dẫn trực tiếp trên kho mã nguồn GitHub (`github.com/GinNgo/hotel-saas-v2`), tuyệt đối không sử dụng liên kết ngoài GitHub.

### Danh Sách Thành Viên Nhóm Thực Hiện

| STT | Họ và Tên | MSSV | Email sinh viên | Vai trò & Phạm vi phụ trách trong Tuần 02 |
| :---: | :--- | :---: | :--- | :--- |
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | `24tx810001@student.hcmute.edu.vn` | **Nhóm trưởng (Team Leader):** Thiết kế cổng đặt phòng B2C đa cơ sở & chuỗi thương hiệu, thuật toán tìm kiếm theo địa danh du lịch Việt Nam (Haversine + Smart Radius Fallback), hệ thống tích/tiêu điểm thành viên (`LoyaltyLedger`), in hóa đơn VAT, cơ chế kiểm soát phiên đăng nhập an toàn (`Safe Auth Gates`) và tối ưu CI Workflow Vitest. |
| 2 | **Nguyễn Khôi Nguyên** | `24TX810011` | `24tx810011@student.hcmute.edu.vn` | **Thành viên:** Phát triển Backend Quản lý Phòng & Hạng phòng (Clean Architecture CQRS), biểu mẫu Đặt phòng trực tiếp tại quầy Lễ tân (Front-desk Walk-in Modal), tính giá thời gian thực (Live Quote Engine) và sơ đồ lưới thời gian phòng (Room Timeline Grid / Tape Chart) kèm bộ test Vitest. |
| 3 | **Trần Trọng Tân** | `24TX810025` | `24tx810025@student.hcmute.edu.vn` | **Thành viên:** Phát triển phân hệ Vận hành Lễ tân (Check-in / Check-out ràng buộc số dư Folio), Thu ngân & Báo cáo kết ca (`GetShiftReport`), cơ chế Polling dọn phòng an toàn chống rò rỉ bộ nhớ & chống Stale Response, và bảo vệ thanh toán chống trừ tiền trùng (Idempotency Key Retry Safety). |

---

## PHẦN I. TỔNG QUAN KẾT QUẢ THỰC HIỆN TRONG TUẦN 02

Sau khi đã hoàn thành kiến trúc nền tảng và cơ chế đa thuê bao ở Tuần 01, trong Tuần 02 nhóm em tập trung triển khai **chuỗi nghiệp vụ vận hành thực tế của khách sạn**: từ việc khách hàng tìm kiếm và giữ chỗ trên cổng công khai B2C, lễ tân tiếp nhận khách vãng lai và theo dõi sơ đồ phòng trên lưới thời gian, cho đến đối soát hóa đơn/folio khi trả phòng, thanh toán an toàn, tích điểm thành viên và điều phối trạng thái buồng phòng.

Dưới đây là phần tự thuật chi tiết về công việc thực tế của từng thành viên:

### 1. Phân hệ Cổng Đặt phòng B2C, Tìm kiếm Vị trí & Hệ thống Loyalty — Ngô Võ Tuấn An (24TX810001)

* **Xây dựng Cổng Đặt phòng B2C độc lập (Marketplace Guest Portal):**  
  Em nhận thấy trang tìm kiếm và đặt phòng của khách không thể dùng chung layout với trang quản trị nội bộ vì sẽ gây rối mắt và tiềm ẩn rủi ro lộ quyền quản trị. Do đó, em đã tạo riêng một layout mới cho khách tại [guest-layout.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/layouts/guest-layout/guest-layout.ts). Trên trang chủ [booking.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking.page.ts) và trang chi tiết [property-detail.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.ts), em hỗ trợ khách lọc theo chuỗi khách sạn hoặc cơ sở độc lập, cùng 3 hình thức thuê linh hoạt: theo giờ, qua đêm hoặc theo ngày.

* **Cài đặt Thuật toán Tìm kiếm Địa danh & Khoảng cách Haversine (Proximity Search):**  
  Khi làm tính năng tìm kiếm khách sạn gần vị trí người dùng, ban đầu nếu dùng công thức tính khoảng cách hình học phẳng thì sai số rất lớn khi đưa lên tọa độ thực tế của Việt Nam. Em đã tự tìm hiểu và viết lại công thức tính khoảng cách mặt cầu trắc địa Haversine trong [GeoProximityHelper.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Services/GeoProximityHelper.cs). Để tránh việc khách tìm ở bán kính hẹp (2km) không có phòng dẫn đến màn hình trắng, em bổ sung cơ chế Smart Radius Fallback trong [GetPublicPropertiesQuery.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs), tự động nới rộng dần bán kính (2km -> 5km -> 10km) và hiển thị các thẻ gợi ý thông minh (`AI Smart Search Chips`) để khách bấm chọn nhanh.

* **Hệ thống Điểm thưởng Khách hàng (`Loyalty`) & In Hóa đơn chuẩn VAT:**  
  Em xây dựng phân hệ khách hàng thân thiết với thực thể sổ cái [LoyaltyLedgerService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyLedgerService.cs). Thay vì chỉ lưu một con số tổng điểm trên bảng `Users`, em ghi nhận chi tiết từng dòng giao dịch (cộng điểm khi hoàn tất lưu trú, trừ điểm khi đổi ưu đãi) để đảm bảo tính minh bạch. Ở phía giao diện giữ phòng [booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts), em gắn thanh trượt cho phép khách linh hoạt chọn số điểm muốn dùng để trừ tiền phòng ngay tức thì, đồng thời xây dựng chức năng xuất mẫu hóa đơn chuẩn thuế VAT tại [GetMyInvoicesQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Loyalty/Queries/GetMyInvoices/GetMyInvoicesQueryHandler.cs).

* **Kiểm soát Phiên Đăng nhập An toàn (`Safe Auth Gates`) & Khắc phục CI Pipeline:**  
  Em rà soát lại toàn bộ luồng Auth, tách biệt rõ token của khách đặt phòng và token của nhân viên nội bộ, tạm đóng các endpoint đăng nhập mạng xã hội chưa có cơ chế verify an toàn trong [AuthController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs). Em cũng gỡ bỏ khóa bí mật bị hardcode trong [VnpayPaymentService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs) đưa vào cấu hình an toàn, và sửa lỗi thiếu locked peer dependencies của Vitest trong [.github/workflows/ci.yml](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml) giúp GitHub Actions chạy mượt mà và chuyển sang màu xanh.

---

### 2. Phân hệ Quản lý Phòng/Hạng phòng, Đặt phòng tại quầy & Lưới Timeline — Nguyễn Khôi Nguyên (24TX810011)

* **Xây dựng Backend Quản lý Phòng & Hạng phòng theo Clean Architecture CQRS:**  
  Trong tuần này, em đảm nhận viết toàn bộ các API thêm, sửa, xem danh sách và cập nhật trạng thái phòng/hạng phòng ở backend tại [CreateRoomCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommandHandler.cs), [UpdateRoomStatusCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommandHandler.cs), [CreateRoomTypeCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommandHandler.cs) và cung cấp hai Controller tại [RoomsController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs) và [RoomTypesController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs).  
  Phần quan trọng nhất em làm là viết bộ kiểm tra ma trận trạng thái phòng [RoomStatusTransitionValidator.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs). Bộ kiểm tra này ép buộc trạng thái phòng phải đi đúng chu trình: Sạch (`Clean`) -> Có khách (`Occupied`) -> Bẩn (`Dirty`) -> Đang dọn (`Cleaning`) -> Sạch (`Clean`). Nhờ đó, lễ tân không thể bấm nhầm chuyển một phòng vừa trả đang bẩn sang trạng thái sẵn sàng đón khách mới.

* **Biểu mẫu Đặt phòng Trực tiếp tại Quầy Lễ tân (Walk-in Booking Modal):**  
  Ở phía Frontend, em xây dựng giao diện modal cho phép lễ tân tiếp nhận khách vãng lai đến thuê phòng trực tiếp tại quầy trong [reservations.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reservations/reservations.page.ts). Form này cho phép lễ tân chọn nhanh hạng phòng, số giờ hoặc số đêm lưu trú, điền thông tin CCCD và gán phòng trống tức thì.

* **Tích hợp Động cơ Tính giá Tự động (Live Quote Engine):**  
  Để lễ tân không phải tính tiền thủ công bằng tay, em kết nối form đặt phòng với service tính giá [reservation.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/reservation.service.ts). Mỗi khi lễ tân thay đổi loại phòng, giờ nhận/trả hay số lượng khách, hệ thống sẽ tự động gọi API tính toán và hiển thị ngay số tiền phòng dự kiến. Em áp dụng `debounceTime(400ms)` và `distinctUntilChanged` để tránh tình trạng gửi request dồn dập làm chậm trình duyệt khi người dùng gõ phím.

* **Sơ đồ Lưới Thời gian Buồng phòng (Room Timeline Grid / Tape Chart):**  
  Em thiết kế giao diện lưới hiển thị trực quan các khoảng thời gian phòng có khách hay phòng trống bằng CSS Grid và Angular Signals trong [reservations.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reservations/reservations.page.ts). Các khối đặt phòng được tô màu phân biệt theo trạng thái (Đã xác nhận, Đang ở, Đã trả). Em cũng tự viết các bài kiểm thử tự động với Vitest tại [reservations.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reservations/reservations.page.spec.ts) và [reservation.service.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/reservation.service.spec.ts), khắc phục lỗi fake timers để test chạy ổn định.

---

### 3. Phân hệ Vận hành Lễ tân, Thu ngân & An toàn Thanh toán — Trần Trọng Tân (24TX810025)

* **Vận hành Lễ tân: Check-in, Check-out gắn liền số dư Folio:**  
  Tuần này em phụ trách khâu vận hành thực tế của lễ tân tại [reservations.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reservations/reservations.page.ts). Khi khách đến, lễ tân thực hiện Check-in để chuyển trạng thái phòng sang `Occupied`. Điểm then chốt em xử lý ở bước Check-out là: hệ thống bắt buộc phải kiểm tra số dư nợ trên Folio của khách (gồm tiền phòng, dịch vụ, minibar). Nếu khách còn nợ tiền, nút Trả phòng sẽ bị khóa lại kèm thông báo nhắc thu tiền. Chỉ khi số dư nợ bằng 0 đ, lễ tân mới được hoàn tất Check-out, và hệ thống sẽ tự động chuyển phòng sang trạng thái `Dirty` để báo cho nhân viên buồng phòng vào dọn.

* **Thu ngân tại quầy & Báo cáo kết ca (Cashier Shift Reporting):**  
  Em viết Command xử lý thu tiền mặt/chuyển khoản tại quầy [CreatePaymentCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs) và truy vấn tổng kết ca làm việc [GetShiftReportQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs). Trên giao diện [payments.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/payments/payments.page.ts), thu ngân có thể xem danh sách hóa đơn và in báo cáo kết ca. Em gắn chặt điều kiện lọc theo `PropertyId` để thu ngân chi nhánh này không xem được báo cáo tài chính của chi nhánh khác.

* **Cải tiến Polling Dọn phòng an toàn, chống Memory Leak & Stale Response:**  
  Ở màn hình buồng phòng [housekeeping.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/housekeeping/housekeeping.page.ts), ban đầu hệ thống dùng `setInterval` để cập nhật danh sách phòng bẩn. Em phát hiện lỗi nếu nhân viên chuyển sang trang khác mà không dọn timer thì sẽ gây tràn bộ nhớ (Memory Leak), và nếu chuyển đổi chi nhánh thì dữ liệu chi nhánh cũ trả về sau có thể đè lên dữ liệu chi nhánh mới (Stale Response). Em đã sửa bằng cách hủy subscription trong `ngOnDestroy` và gán Generation ID để hủy các gói tin trả về muộn của chi nhánh cũ.

* **Bảo vệ Giao dịch Thanh toán, Chống trừ tiền trùng (Idempotency Key):**  
  Để phòng trường hợp mạng chập chờn hoặc nhân viên bấm nút Thanh toán 2 lần liên tiếp dẫn đến trừ tiền 2 lần, em cài đặt cơ chế khóa `Idempotency-Key` trong [CreatePaymentCommand.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommand.cs). Khi người dùng nhấn gửi lại (retry) cùng một yêu cầu, hệ thống sẽ nhận diện cùng một key và không tạo thêm giao dịch mới. Em đã viết bài test [P4_CashFolioTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs) để kiểm chứng việc này.

---

## PHẦN II. DANH MỤC MINH CHỨNG FILE MÃ NGUỒN TRÊN GITHUB CỦA 3 THÀNH VIÊN

Tất cả các liên kết dưới đây đều trỏ trực tiếp tới tệp mã nguồn thực tế trên nhánh `develop` của kho lưu trữ GitHub nhóm:

### 1. Minh chứng mã nguồn của Ngô Võ Tuấn An (24TX810001)

* **Tầng Application (Địa danh, Proximity, Loyalty & In hóa đơn):**
  * [backend/src/HotelSaas.Application/Public/Services/GeoProximityHelper.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Services/GeoProximityHelper.cs)
  * [backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs)
  * [backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyLedgerService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyLedgerService.cs)
  * [backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyTierRules.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyTierRules.cs)
  * [backend/src/HotelSaas.Application/Loyalty/Queries/GetMyGuestProfile/GetMyGuestProfileQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Loyalty/Queries/GetMyGuestProfile/GetMyGuestProfileQueryHandler.cs)
  * [backend/src/HotelSaas.Application/Loyalty/Queries/GetMyInvoices/GetMyInvoicesQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Loyalty/Queries/GetMyInvoices/GetMyInvoicesQueryHandler.cs)
* **Tầng Infrastructure & WebApi (Bảo mật Auth, VNPay Fail-Safe & Controller):**
  * [backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs)
  * [backend/src/HotelSaas.WebApi/Controllers/AuthController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs)
  * [backend/src/HotelSaas.WebApi/Controllers/PublicController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/PublicController.cs)
* **Tầng Frontend Angular (Cổng B2C, Layout, Form & Shared Components):**
  * [frontend/src/app/layouts/guest-layout/guest-layout.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/layouts/guest-layout/guest-layout.ts)
  * [frontend/src/app/features/public-booking/booking.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking.page.ts)
  * [frontend/src/app/features/public-booking/booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts)
  * [frontend/src/app/features/public-booking/property-detail.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.ts)
  * [frontend/src/app/features/public-booking/member/guest-profile.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/member/guest-profile.page.ts)
  * [frontend/src/app/shared/components/form-field/form-field.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/shared/components/form-field/form-field.component.ts)
  * [frontend/src/app/shared/components/searchable-select/searchable-select.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/shared/components/searchable-select/searchable-select.component.ts)
* **Kiểm thử & CI/CD Workflow:**
  * [backend/tests/HotelSaas.Application.Tests/Public/GeoProximityAndSmartFilterTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Public/GeoProximityAndSmartFilterTests.cs)
  * [backend/tests/HotelSaas.WebApi.Tests/UnconfiguredIntegrationSafetyTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.WebApi.Tests/UnconfiguredIntegrationSafetyTests.cs)
  * [frontend/src/app/features/public-booking/booking-content.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-content.spec.ts)
  * [.github/workflows/ci.yml](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml)

### 2. Minh chứng mã nguồn của Nguyễn Khôi Nguyên (24TX810011)

* **Tầng Backend CQRS (Quản lý Phòng & Hạng phòng):**
  * [backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/CreateRoom/CreateRoomCommandHandler.cs)
  * [backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommandHandler.cs)
  * [backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs)
  * [backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommandHandler.cs)
  * [backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomTypeRate/CreateRoomTypeRateCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/RoomTypes/Commands/CreateRoomTypeRate/CreateRoomTypeRateCommandHandler.cs)
  * [backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs)
  * [backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs)
* **Tầng Frontend Angular (Đặt phòng Lễ tân, Báo giá & Timeline Grid):**
  * [frontend/src/app/core/services/reservation.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/reservation.service.ts)
  * [frontend/src/app/features/reservations/reservations.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reservations/reservations.page.ts)
* **Kiểm thử tự động Frontend Vitest & Tooling:**
  * [frontend/src/app/core/services/reservation.service.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/reservation.service.spec.ts)
  * [frontend/src/app/features/reservations/reservations.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reservations/reservations.page.spec.ts)
  * [frontend/angular.json](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/angular.json)
  * [frontend/package.json](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/package.json)

### 3. Minh chứng mã nguồn của Trần Trọng Tân (24TX810025)

* **Tầng Backend CQRS (Thanh toán Folio & Báo cáo kết ca Thu ngân):**
  * [backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommand.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommand.cs)
  * [backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs)
  * [backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs)
  * [backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs)
  * [backend/src/HotelSaas.Application/Payments/DTOs/FolioDto.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/DTOs/FolioDto.cs)
  * [backend/src/HotelSaas.Application/Payments/DTOs/ShiftReportDto.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/DTOs/ShiftReportDto.cs)
  * [backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs)
* **Tầng Frontend Angular (Thu ngân, Buồng phòng & Xử lý Polling an toàn):**
  * [frontend/src/app/core/services/payment.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/payment.service.ts)
  * [frontend/src/app/features/payments/payments.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/payments/payments.page.ts)
  * [frontend/src/app/features/housekeeping/housekeeping.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/housekeeping/housekeeping.page.ts)
  * [frontend/src/app/features/reservations/reservations.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reservations/reservations.page.ts)
* **Kiểm thử tự động xUnit Backend:**
  * [backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs)
  * [backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs)

---

## PHẦN III. ĐỐI CHIẾU LỊCH SỬ COMMIT NGUYÊN VĂN TRÊN GITHUB

Bảng dưới đây ghi nhận chính xác các commit thực tế kèm liên kết trực tiếp tới từng commit trên GitHub để phục vụ kiểm tra chéo:

| Mã Commit (Link GitHub) | Tác giả | Tài khoản GitHub | Nguyên văn Commit Message | Nội dung thay đổi chính |
| :--- | :--- | :--- | :--- | :--- |
| [`cafb63e`](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63ee7bb30b2f5ac7788dcff6389e3f6c08bd) | Nguyễn Khôi Nguyên | nguyencd | `[feat] full CRUD manage Room and RomType` | Hoàn thiện Backend CRUD Room/RoomType, FSM RoomStatusTransitionValidator và Controllers. |
| [`d83e102`](https://github.com/GinNgo/hotel-saas-v2/commit/d83e1020ecc409395c0de7eb44206419fe182e65) | Ngô Võ Tuấn An | ngovotuanan | `feat(public-booking): upgrade multi-property search with Go2Joy rental modes, tourist landmarks, and tenant chain filtering` | Nâng cấp mô hình tìm kiếm đa cơ sở hỗ trợ hình thức thuê theo giờ, qua đêm, theo chuỗi thương hiệu. |
| [`9ee7b93`](https://github.com/GinNgo/hotel-saas-v2/commit/9ee7b931f7d92e82b9555621fe3d6605cff360e2) | Ngô Võ Tuấn An | ngovotuanan | `feat(booking): add vietnamese landmarks catalog, auto proximity matching, smart radius fallback and ai smart search chips` | Tích hợp danh mục địa danh du lịch VN, thuật toán Haversine và Smart Radius Fallback. |
| [`bb67550`](https://github.com/GinNgo/hotel-saas-v2/commit/bb6755077826f54997f613499ed3ad744b890c88) | Ngô Võ Tuấn An | ngovotuanan | `feat(portal): complete b2c guest booking portal with guest layout, brand storefront, destination explore, property detail, and deals` | Xây dựng trọn bộ giao diện cổng đặt phòng B2C với guest-layout, storefront thương hiệu và chi tiết cơ sở. |
| [`8786b12`](https://github.com/GinNgo/hotel-saas-v2/commit/8786b12fa3abb492e94675dd615dd819f6dc15f4) | Ngô Võ Tuấn An | ngovotuanan | `feat(loyalty): implement guest loyalty membership, point ledger, invoice printing, and points redemption` | Triển khai thẻ thành viên LoyaltyTier, sổ cái điểm thưởng, in hóa đơn VAT và giao diện hồ sơ khách. |
| [`ec98505`](https://github.com/GinNgo/hotel-saas-v2/commit/ec9850583b0b3a1d122913fcf97008db7621d1c2) | Ngô Võ Tuấn An | ngovotuanan | `feat(loyalty): implement automated loyalty ledger service and booking-hold points slider` | Hoàn thiện service tích điểm tự động và thanh trượt quy đổi điểm tại màn hình giữ phòng booking-hold. |
| [`f711156`](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | Trần Trọng Tân | trantrongtan096 | `feat(Tran Trong Tan): implement receptionist operations and cashier reporting` | Triển khai nhận phòng, trả phòng ràng buộc nợ Folio, thu ngân tại quầy và báo cáo kết ca. |
| [`e8fbb33`](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | Trần Trọng Tân | trantrongtan096 | `fix(tan-ops): address housekeeping polling and payment safety issues` | Sửa polling buồng phòng chống stale response và bảo vệ an toàn thanh toán chống trùng lặp. |
| [`9f4291b`](https://github.com/GinNgo/hotel-saas-v2/commit/9f4291b94884accf5f25389e878fd2b12f8df046) | Nguyễn Khôi Nguyên | nguyencd | `[chore] update ver depends` | Cập nhật phiên bản dependency cho phân hệ reservations. |
| [`96d9add`](https://github.com/GinNgo/hotel-saas-v2/commit/96d9add950682229771a045947a5ee0f4867b179) | Nguyễn Khôi Nguyên | nguyencd | `feat(reservations): implement front-desk walk-in booking form, live quote, and room timeline grid` | Xây dựng form Walk-in đặt phòng tại quầy, live quote tính giá thời gian thực và lưới timeline phòng. |
| [`c062cbe`](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | Ngô Võ Tuấn An | ngovotuanan | `feat(integration): publish local booking and admin work with safe auth gates` | Tích hợp safe auth gates phân tách phiên khách/quản trị, gỡ bỏ secret hardcode, thêm safety tests. |
| [`5e40505`](https://github.com/GinNgo/hotel-saas-v2/commit/5e405058fc0e6f3dfdbb4f9829910c5a3bc965a3) | Ngô Võ Tuấn An | GinNgo | `merge(tan-ops): integrate payment safety and housekeeping fixes` | Hợp nhất gói sửa đổi vận hành của Trần Trọng Tân vào nhánh phát triển chung. |
| [`77fbc67`](https://github.com/GinNgo/hotel-saas-v2/commit/77fbc67309e9f5e22119af6510c397640c47a82c) | Ngô Võ Tuấn An | ngovotuanan | `fix(ci): install locked peer dependencies required by Vitest` | Khắc phục lỗi thiếu locked peer dependencies của Vitest trên GitHub Actions CI. |
| [`003a016`](https://github.com/GinNgo/hotel-saas-v2/commit/003a016a598e34b238dbd92d14a77d32be6abc12) | Ngô Võ Tuấn An | GinNgo | `Merge pull request #7 from GinNgo/develop` | Hợp nhất toàn bộ thành quả nghiệm thu Tuần 02 lên main (777/777 unit tests pass 100%). |

---

## PHẦN IV. KẾ HOẠCH THỰC HIỆN TUẦN 03 (TỪ 19/10/2026 ĐẾN 25/10/2026)

Căn cứ vào kết quả đã nghiệm thu ở Tuần 02 và sổ tay kế hoạch chi tiết ([KE-HOACH-CHI-TIET-TUAN-3.md](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/team/KE-HOACH-CHI-TIET-TUAN-3.md)), nhóm xác định mục tiêu trọng tâm trong Tuần 03 là: **Hoàn thiện luồng trải nghiệm khách hàng B2C khép kín (Tìm kiếm cơ sở → Xem chi tiết & tính giá phòng → Giữ phòng 15 phút → Tra cứu đặt phòng), chuyển đổi cơ sở dữ liệu lên Cloud PostgreSQL dùng chung, đồng thời thực hiện kiểm thử hồi quy (Regression Testing) toàn diện và khắc phục triệt để các lỗi phát sinh liên quan đến các phân hệ của Tuần 01 và Tuần 02.**

---

### 1. Phân công công việc chi tiết cho từng thành viên trong Tuần 03

#### 👤 Ngô Võ Tuấn An (24TX810001 - Nhóm trưởng):
* **Nhiệm vụ mới 1 — Hạ tầng Cơ sở dữ liệu Cloud & Cấu hình môi trường (Cloud PostgreSQL):**
  * Khởi tạo cơ sở dữ liệu PostgreSQL dùng chung trên Cloud (sử dụng Neon Serverless Postgres hoặc Supabase), thay thế cho database local riêng lẻ để cả 3 thành viên kiểm thử trên cùng một nguồn dữ liệu thật.
  * Cấu hình chuỗi kết nối an toàn qua biến môi trường (Environment Secrets) trên GitHub Actions, tuyệt đối không commit thông tin bảo mật.
* **Nhiệm vụ mới 2 — Tối ưu hóa Thuật toán Tìm kiếm Cơ sở & Gợi ý GPS thực tế:**
  * Nâng cấp `GetPublicPropertiesQuery`: tích hợp tìm kiếm theo vị trí hiện tại ("📍 Gần tôi"), khống chế trần bán kính tối đa 50km để chặn dứt điểm việc gợi ý các cơ sở ở xa (ví dụ: đang ở TP.HCM nhưng gợi ý Đà Lạt).
  * Chuẩn hóa tọa độ địa danh thực tế tại TP.HCM (Chợ Bến Thành, Landmark 81, Sân bay Tân Sơn Nhất, Phố đi bộ Nguyễn Huệ) và tính toán khoảng cách Haversine hiển thị trực quan (`Cách 300m`, `Cách 2.8km`).
* **Nhiệm vụ Kiểm thử hồi quy & Tương thích hệ thống (Regression Testing & Bug Fixing):**
  * **Kiểm thử hồi quy trên Cloud DB mới:** Chạy lại toàn bộ bộ test suite (190+ test Application, 770+ test tổng thể) trên Cloud PostgreSQL để đảm bảo các migration EF Core, Seeder dữ liệu hành chính và Interceptor cách ly đa chi nhánh (`TenantPropertySavingInterceptor`) hoạt động ổn định, không phát sinh lỗi lệch schema hay lỗi kết nối.
  * **Tái kiểm thử luồng Xác thực & Phân quyền (Tuần 01):** Kiểm tra lại các luồng Đăng nhập, Cấp mới Refresh Token và Chuyển đổi chi nhánh (SwitchContext), đảm bảo các cổng kiểm soát phiên (Safe Auth Gates) không gây xung đột hoặc chặn nhầm luồng truy cập của khách B2C mới.
  * **Chủ trì tích hợp & CI/CD Gatekeeper:** Review toàn bộ Pull Requests của Nguyên và Tân; phát hiện và xử lý ngay các xung đột mã nguồn hoặc lỗi gãy test khi ghép nối phân hệ mới với phân hệ cũ trước khi merge vào nhánh `develop`.

#### 👤 Nguyễn Khôi Nguyên (24TX810011 - Thành viên):
* **Nhánh phát triển dự kiến:** `feature/nguyen-week3-discovery-detail`
* **Nhiệm vụ mới 1 — Duy trì ngữ cảnh Tìm kiếm khi quay lại (Search State Round-trip):**
  * Đồng bộ các tham số tìm kiếm (từ khóa điểm đến, khoảng giá, loại hình cơ sở, chế độ thuê theo giờ/đêm) lên URL query parameters.
  * Đảm bảo khi khách click xem Chi tiết cơ sở rồi bấm nút Quay lại (Back), các điều kiện lọc và danh sách kết quả trước đó vẫn được giữ nguyên vẹn, không bị reset form.
* **Nhiệm vụ mới 2 — Hoàn thiện Trang Chi tiết Cơ sở & Báo giá phòng (Property Detail & Live Quote):**
  * Hoàn thiện giao diện [property-detail.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.ts): hiển thị ảnh chất lượng cao kèm ảnh placeholder khi link ảnh bị lỗi mạng; hiển thị rõ ràng chính sách nhận/trả phòng.
  * Tích hợp kiểm tra sức chứa phòng (Capacity Validation) và kiểm tra hiệu lực báo giá (`expiresAtUtc`); nếu báo giá quá hạn thì nhắc khách tính giá lại trước khi chuyển sang bước Giữ phòng.
* **Nhiệm vụ Kiểm thử hồi quy & Vá lỗi phát sinh liên phân hệ (Regression Testing & Bug Fixing):**
  * **Kiểm thử hồi quy Quản lý Danh mục Hạng phòng & Bảng giá (Tuần 01):** Đảm bảo khi quản trị viên tạo mới hoặc cập nhật giá phòng theo mùa/ngày trong tuần trên trang Admin, API báo giá công khai B2C mới phản ánh tức thì bảng giá hiệu lực chính xác, không bị lỗi cache dữ liệu cũ.
  * **Kiểm thử lại sơ đồ Tape Chart & Đặt phòng tại quầy Walk-in (Tuần 02):** Kiểm tra xem việc thêm các API báo giá mới có làm ảnh hưởng đến hiệu năng hoặc cơ chế RxJS `debounceTime(400ms)` của form Walk-in hay không; sửa các lỗi hiển thị lệch cột giờ trên sơ đồ Tape Chart nếu phát hiện khi chạy thực tế trên các màn hình có độ phân giải khác nhau.
  * Viết bổ sung bộ unit test Vitest cho component Detail (`property-detail.page.spec.ts`) và đảm bảo 100% test case cũ của Tuần 01 & Tuần 02 tiếp tục pass.

#### 👤 Trần Trọng Tân (24TX810025 - Thành viên):
* **Nhánh phát triển dự kiến:** `feature/tan-week3-hold-lookup`
* **Nhiệm vụ mới 1 — Hoàn thiện Quy trình Giữ phòng B2C (Booking Hold & Countdown Timer):**
  * Hoàn thiện màn hình [booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts): hiển thị đồng hồ đếm ngược 15 phút giữ phòng; nếu hết thời gian mà khách chưa thanh toán thì tự động chuyển sang trạng thái hết hạn (`Expired`) và giải phóng phòng.
  * Duy trì khóa `Idempotency-Key` ở bước giữ chỗ để ngăn chặn việc người dùng click đúp tạo trùng nhiều đơn giữ phòng cùng lúc.
* **Nhiệm vụ mới 2 — Xây dựng Trang Tra cứu & Theo dõi trạng thái đặt phòng (Booking Lookup & Status):**
  * Xây dựng trang [booking-lookup.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-lookup.page.ts) cho phép khách hàng tra cứu thông tin đặt phòng bằng Mã đặt phòng (Booking Code) và Số điện thoại mà không bắt buộc phải đăng nhập tài khoản.
  * Xây dựng trang [booking-status.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.ts) hiển thị chi tiết tiến trình đơn đặt phòng (Đang giữ chỗ, Đã thanh toán, Đã nhận phòng, Đã hủy) kèm mã PIN nhận phòng an toàn (Smart Lock Passcode).
* **Nhiệm vụ Kiểm thử hồi quy & Liên thông PMS (Regression Testing & Inter-module Testing):**
  * **Kiểm thử hồi quy Máy trạng thái Buồng phòng FSM (Tuần 01 & Tuần 02):** Kiểm tra liên thông trạng thái: khi khách giữ chỗ trên Web B2C, sơ đồ buồng phòng Lễ tân phải thấy phòng chuyển sang trạng thái `Held`; đặc biệt kiểm tra khi đơn giữ phòng hết hạn (sau 15 phút), phòng phải được tự động nhả về trạng thái `Available` hoặc trạng thái phòng sạch ban đầu mà không bị kẹt cứng (deadlock).
  * **Kiểm thử hồi quy phân hệ Lễ tân Check-in/Check-out & Thu ngân (Tuần 02):** Kiểm tra xem khi khách đến nhận phòng với mã PIN tra cứu B2C, Lễ tân có thể tiếp nhận check-in mượt mà và Folio tính đúng số tiền đã cọc/còn nợ; kiểm tra lại cơ chế chống trừ trùng `Idempotency-Key` khi người dùng retry thanh toán nhiều lần trên môi trường mạng chập chờn.

---

### 2. Quy trình Kiểm thử Hồi quy & Xử lý Lỗi Tồn đọng (Continuous Regression & Bug Fixing Workflow)

1. **Nguyên tắc "Không làm gãy tính năng cũ":** Bất kỳ đoạn mã mới nào được bổ sung trong Tuần 03 đều phải chạy kiểm thử hồi quy song song với toàn bộ các tính năng đã hoàn thành ở Tuần 01 và Tuần 02.
2. **Quy trình xử lý khi phát hiện lỗi cũ:**
   * Nếu trong quá trình phát triển tính năng mới phát hiện lỗi từ các phân hệ trước (như lỗi trần khoảng cách GPS 50km, lỗi rò rỉ timer hoặc lỗi xung đột đồng thời), thành viên phát hiện sẽ lập tức thông báo trong nhóm và mở nhánh `fix/<tên-lỗi>` xử lý dứt điểm.
   * Viết bổ sung ít nhất 01 bài kiểm thử tự động (Unit Test / Integration Test) tái hiện lại lỗi đó (Regression Test Case) để đảm bảo lỗi không bao giờ tái diễn trong tương lai.
3. **Quy chuẩn nghiệm thu Pull Request:** Nhóm trưởng chỉ phê duyệt hợp nhất (Merge) PR khi và chỉ khi:
   * Tất cả bài test mới của Tuần 03 vượt qua 100%.
   * Toàn bộ các bài test cũ của Tuần 01 và Tuần 02 vẫn duy trì trạng thái màu xanh (100% pass, không bị skip).

---

### 3. Tiêu chí nghiệm thu chất lượng Tuần 03 (Quality Acceptance Gates)

1. **Về Mã nguồn & Biên dịch:**
   * Backend (.NET 10): `dotnet build` đạt **0 Errors, 0 Warnings**.
   * Frontend (Angular 22): `npm run build` thành công, không phát sinh lỗi TypeScript strict mode.
2. **Về Kiểm thử tự động (Automated Testing):**
   * Duy trì tỷ lệ **100% unit tests vượt qua** trên cả Backend xUnit và Frontend Vitest (mục tiêu tối thiểu 800+ tests pass).
   * Không bỏ qua (skip) hoặc comment-out các test case bảo mật và đa chi nhánh.
3. **Về Triển khai & Vận hành:**
   * Kết nối thành công hệ thống với cơ sở dữ liệu PostgreSQL Cloud dùng chung, chạy migration dữ liệu mẫu sạch và đồng nhất giữa 3 thành viên.
   * Chạy thông suốt luồng đặt phòng từ B2C đến PMS trên môi trường Staging phục vụ buổi demo trực tiếp với Giảng viên hướng dẫn.
