# BÁO CÁO TIẾN ĐỘ TUẦN 03 VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**  
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

---

## THÔNG TIN CHUNG CỦA ĐỀ TÀI

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Giảng viên hướng dẫn:** Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 03:** 19/10/2026 – 25/10/2026 (Hoàn tất rà soát, nghiệm thu & tích hợp nhánh: 26/10/2026)
* **Kho mã nguồn chính thức (GitHub Repository):** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh phát triển & tích hợp Tuần 03:** [https://github.com/GinNgo/hotel-saas-v2/tree/feature/an-experience-foundation](https://github.com/GinNgo/hotel-saas-v2/tree/feature/an-experience-foundation) (chuẩn bị hợp nhất vào `develop`)
* **Cam kết liên kết minh chứng:** Toàn bộ liên kết trong báo cáo này 100% sử dụng đường dẫn trực tiếp trên kho mã nguồn GitHub (`github.com/GinNgo/hotel-saas-v2`), tuyệt đối không sử dụng liên kết ngoài GitHub.

### Danh Sách Thành Viên Nhóm Thực Hiện

| STT | Họ và Tên | MSSV | Email sinh viên | Tài khoản GitHub | Vai trò & Phạm vi phụ trách trong Tuần 03 |
| :---: | :--- | :---: | :--- | :---: | :--- |
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | `24tx810001@student.hcmute.edu.vn` | [`ngovotuanan`](https://github.com/ngovotuanan) / [`GinNgo`](https://github.com/GinNgo) | **Nhóm trưởng (Team Leader):** Triển khai CSDL dùng chung PostgreSQL 17 trên Cloud VPS (`hotel_saas_staging`), cơ chế bảo vệ `CloudDatabaseGuard`, Seeder dữ liệu thực tế tại 34 tỉnh thành Việt Nam, bóc tách trang Khám phá & Lịch sử tìm kiếm, Báo cáo phân tích chuỗi đa cơ sở (Group Analytics Dashboard), điều phối và tích hợp Pull Requests. |
| 2 | **Nguyễn Khôi Nguyên** | `24TX810011` | `24tx810011@student.hcmute.edu.vn` | [`N-Golden`](https://github.com/N-Golden) | **Thành viên:** Phát triển và tối ưu hóa luồng đầu trải nghiệm khách hàng B2C (Tasks N01–N04): duy trì ngữ cảnh tìm kiếm (`Search State Retention`), xác thực giá và phòng trống đáng tin cậy trên trang Chi tiết cơ sở, tăng cường tiếp cận người dùng (Accessibility A11y), viết bộ kiểm thử backend cách ly đa cơ sở và hợp đồng công khai. |
| 3 | **Trần Trọng Tân** | `24TX810025` | `24tx810025@student.hcmute.edu.vn` | [`trantrongtan096`](https://github.com/trantrongtan096) | **Thành viên:** Phát triển và tối ưu hóa luồng cuối trải nghiệm khách hàng B2C (Tasks T01–T05): quy trình giữ chỗ 15 phút an toàn với `Idempotency-Key`, trang tra cứu đơn phòng che thông tin cá nhân (PII Masking), chính sách hiển thị mã PIN phòng trung thực, kiểm thử bảo mật token backend và kiểm thử liên thông PMS. |

---

## PHẦN TIẾP THU VÀ HIỆU CHỈNH THEO NHẬN XÉT CỦA GIẢNG VIÊN HƯỚNG DẪN (TUẦN 02)

Nhóm xin chân thành cảm ơn Thầy Huỳnh Xuân Phụng đã xét duyệt ĐẠT báo cáo Tuần 02 và có những góp ý cụ thể, chuẩn xác để nhóm hoàn thiện tác phong kỹ thuật. Nhóm đã lập tức rà soát và thực hiện điều chỉnh dứt điểm 3 nội dung Thầy lưu ý như sau:

1. **Hiệu chỉnh mã SHA dòng commit merge vận hành:**  
   Trong báo cáo Tuần 02 cũ, dòng commit *"merge(tan-ops): integrate payment safety and housekeeping fixes"* bị ghi nhầm chuỗi ký tự rút gọn không tồn tại. Nhóm đã tra cứu nhật ký Git gốc, xác định chính xác commit này mang SHA đầy đủ là `5e40505359d30565589e0b08b7f33ce6d3346322`, do tác giả `ngovotuanan` tạo ngày 19/10/2026. Nhóm đã cập nhật lại liên kết đúng chuẩn trên GitHub:  
   👉 [https://github.com/GinNgo/hotel-saas-v2/commit/5e40505359d30565589e0b08b7f33ce6d3346322](https://github.com/GinNgo/hotel-saas-v2/commit/5e40505359d30565589e0b08b7f33ce6d3346322) (đã sửa trực tiếp vào file báo cáo tuần 2 lưu trữ trong repo).

2. **Đính chính tên tài khoản GitHub của thành viên Nguyễn Khôi Nguyên:**  
   Tài khoản GitHub chính thức đang hoạt động và commit mã nguồn của bạn Nguyễn Khôi Nguyên là **`N-Golden`** (thay vì tên gọi cũ `nguyencd`). Báo cáo từ Tuần 03 trở đi đồng bộ chuẩn xác định danh này trên toàn bộ tài liệu và bảng đối chiếu commit.

3. **Chuẩn hóa danh mục Khai báo AI theo Model thực tế hiển thị trên giao diện của từng thành viên:**  
   Tiếp thu nhắc nhở sâu sắc của Thầy về tính trung thực và khả năng kiểm chứng của công cụ AI, nhóm khai báo đúng 100% theo nhãn hiển thị thực tế trên giao diện của từng thành viên kèm ảnh chụp màn hình trực tiếp để Thầy đối chiếu:  
   * Bạn **Ngô Võ Tuấn An** và **Nguyễn Khôi Nguyên** sử dụng **Google Antigravity IDE** với mô hình hiển thị nguyên văn trên thanh công cụ là **`Gemini 3.8 Flash High`** (có ảnh chụp màn hình giao diện làm việc thực tế trên thư mục dự án `He-thong-quan-ly-khach-san` tại Phần IV).  
   * Bạn **Trần Trọng Tân** sử dụng công cụ **Codex (ChatGPT Codex / OpenAI Codex)** với danh sách mô hình hiển thị nguyên văn trong menu chọn model giao diện là **`6 Astra`** (Frontier intelligence)(có ảnh chụp màn hình menu chọn model thực tế trên dự án `hotel-saas-v2` tại Phần IV).

---

## PHẦN I. TỔNG QUAN KẾT QUẢ THỰC HIỆN TRONG TUẦN 03

Trong Tuần 03, nhóm bám sát mục tiêu đã đề ra trong kế hoạch: **Hoàn thiện luồng trải nghiệm khách hàng B2C khép kín từ Tìm kiếm → Chi tiết/Báo giá → Giữ phòng 15 phút → Tra cứu trạng thái, chuyển đổi toàn bộ hạ tầng lên Cơ sở dữ liệu Cloud PostgreSQL 17 dùng chung trên VPS, và nạp bộ dữ liệu thật phủ khắp 34 tỉnh thành du lịch Việt Nam.**

Dưới đây là phần tự thuật chi tiết về kết quả công việc thực tế của từng thành viên:

### 1. Hạ tầng CSDL Cloud, Dữ liệu thật 34 Tỉnh thành & Quản trị Chuỗi — Ngô Võ Tuấn An (24TX810001)

* **Thiết lập và bảo vệ CSDL Cloud PostgreSQL 17 Staging trên VPS (Tasks C01–C03):**  
  Nhằm giải quyết dứt điểm tình trạng phân mảnh dữ liệu khi mỗi bạn chạy một database local riêng lẻ, em đã thiết lập máy chủ cơ sở dữ liệu PostgreSQL 17.11 (x86_64 Alpine Linux) tại địa chỉ `103.116.38.74:5435` với cơ sở dữ liệu `hotel_saas_staging`. Phiên kết nối được bắt buộc mã hóa bảo mật qua TLS/SSL (`IsSecure = True`). Em đã cài đặt extension `btree_gist v1.7` phục vụ các ràng buộc chống trùng lặp lịch phòng, chạy toàn bộ 15 bản EF Core Migrations tạo lập đủ 32 bảng hệ thống, và nạp 5 Access Roles cùng 17 Permission Functions chuẩn.  
  Đặc biệt, em viết bộ bảo vệ [CloudDatabaseGuard.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/CloudDatabaseGuard.cs) và [DatabaseConnectionResolver.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/DatabaseConnectionResolver.cs) để tự động chặn các lệnh drop/clean table ngoài ý muốn từ máy cá nhân lên CSDL chung của nhóm.

* **Nạp Dữ liệu thực tế 34 Tỉnh thành & Xóa bỏ Mock Fake:**  
  Em xây dựng seeder dữ liệu thực tế tại [RealData34ProvincesSeeder.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/RealData34ProvincesSeeder.cs), nạp thành công **35 cơ sở lưu trú** (gồm 34 khách sạn & resort cao cấp 4–5 sao tại 34 tỉnh/thành phố du lịch trọng điểm Việt Nam: Đà Lạt, Sa Pa, Hạ Long, Phú Quốc, Đà Nẵng, Nha Trang, Huế, Hội An, Ninh Bình, Hà Giang...), có địa chỉ chi tiết đến tận Phường/Xã (Phường 4 Đà Lạt, Phường Bãi Cháy Hạ Long, Xã Dương Tơ Phú Quốc...), tọa độ GPS thực tế, 68 hạng phòng, 136 phòng vật lý và 68 biểu giá VND đang kích hoạt.  
  Đồng thời, em rà soát và loại bỏ triệt để toàn bộ dữ liệu giả lập `Math.random()` và dữ liệu gán cứng (hardcoded mock) tại [reports.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reports/reports.page.ts) và [subscriptions.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/subscriptions/subscriptions.page.ts).

* **Bóc tách Trang Khám phá Chuyên dụng, Lịch sử Tìm kiếm & Fuzzy Search:**  
  Em tách rời lưới tìm kiếm 2 cột ra khỏi trang chủ [booking.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking.page.ts), trả lại không gian Landing Discovery chuẩn mực cho trang chủ và chuyển toàn bộ kết quả lọc sang trang chuyên dụng [explore-search.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/explore-search.page.ts). Trên thanh tìm kiếm [booking-filter-bar.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts), em bổ sung tính năng **Lịch sử tìm kiếm gần đây** (lưu `localStorage`, hiển thị dropdown khi click vào ô trống kèm nút xóa từng mục/xóa tất cả) và thuật toán **Fuzzy Search & Typo Tolerance** (bỏ dấu tiếng Việt, gõ tắt liền từ như "sapa" $\rightarrow$ Sa Pa, "dalat" $\rightarrow$ Đà Lạt, cho phép sai lệch 1-2 ký tự Levenshtein).

* **Báo cáo Phân tích Chuỗi Đa Chi nhánh (Multi-Property Group Analytics Dashboard):**  
  Em xây dựng trang phân tích tài chính chuỗi dành cho chủ khách sạn [reports.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reports/reports.page.ts) và [reports.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reports/reports.page.spec.ts), tự động tính toán các chỉ số quản trị khách sạn chuẩn quốc tế: Tỷ lệ lấp đầy (Occupancy Rate), Giá bình quân mỗi phòng bán được (ADR), Doanh thu trên mỗi phòng sẵn có (RevPAR), và biểu đồ Top 5 chi nhánh đạt doanh thu cao nhất.

---

### 2. Duy trì Ngữ cảnh Tìm kiếm, Báo giá Đáng tin cậy & Kiểm thử Hợp đồng — Nguyễn Khôi Nguyên (24TX810011 - N-Golden)

* **Duy trì Ngữ cảnh Tìm kiếm khi Quay lại (Search Context Retention — Task N01):**  
  Em cài đặt hàm `returnQueryParams()` và `detailQueryParams()` trong [property-detail.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.ts) và [booking.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking.page.ts). Khi khách hàng tìm kiếm với nhiều điều kiện (từ khóa địa danh, hạng sao, khoảng giá, chế độ thuê, ngày giờ, số khách) rồi click vào xem chi tiết một khách sạn, sau đó bấm nút **"← Quay lại tìm chỗ nghỉ"**, toàn bộ các tham số tìm kiếm trước đó được giữ nguyên vẹn trên URL và phục hồi chính xác trên bộ lọc, không làm mất công sức tìm kiếm của khách.

* **Hoàn thiện Trang Chi tiết Cơ sở & Báo giá Phòng Đáng tin cậy (Task N02):**  
  Trong [property-detail.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.ts), em xây dựng hàm `startingPrice(room)`: tự động nhận diện chế độ lưu trú hiện hành của khách (`Hourly`, `Overnight`, hoặc `Daily`) để hiển thị đúng biểu giá khởi điểm tương ứng, có xử lý trường hợp phòng chưa công bố giá công khai.  
  Em bổ sung logic chặn lỗi nghiệp vụ: Nếu khách chọn hình thức thuê mà cơ sở đó không hỗ trợ, hệ thống lập tức thông báo rõ ràng; khi khách chuẩn bị chuyển sang bước giữ chỗ (`proceedToHold`), hệ thống bắt buộc kiểm tra xem báo giá còn trong thời hạn hiệu lực (`expiresAtUtc`) hay không và phòng được chọn có còn khả dụng hay không.

* **Tăng cường Tiếp cận Người dùng (Accessibility / A11y — Task N03):**  
  Trong [booking-filter-bar.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts), em chuẩn hóa liên kết `for="booking-destination"` với `id="booking-destination"`. Bộ chọn số lượng khách được gắn các thuộc tính ngữ nghĩa `role="group"`, `aria-label`, `aria-live="polite"`, các nút tăng/giảm đạt kích thước bấm tối thiểu theo chuẩn WCAG và tự động kích hoạt `disabled` khi chạm ngưỡng giới hạn (1 đến 20 khách).

* **Kiểm thử Hợp đồng Backend & Cách ly Đa cơ sở (Contract Testing — Task N04):**  
  Tại [P5_GuestBookingTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs), em viết các bài kiểm thử tự động kiểm chứng việc cô lập dữ liệu giữa các chi nhánh: Truy vấn cơ sở A tuyệt đối không trả về phòng của cơ sở B; cơ sở tạm ngưng hoạt động (`Inactive`) hoặc slug không tồn tại phải trả về lỗi `NotFoundException` (HTTP 404); kiểm thử hàm tính phòng trống `GetAvailability` theo đúng khoảng thời gian và sức chứa tối đa; kiểm thử việc từ chối báo giá hết hạn. Bộ kiểm thử đạt 100% Pass.

---

### 3. Quy trình Giữ chỗ 15 phút, Tra cứu Đơn phòng & Bảo mật Token — Trần Trọng Tân (24TX810025 - trantrongtan096)

* **Hoàn thiện Quy trình Giữ phòng B2C & Đồng hồ Đếm ngược 15 phút (Task T01):**  
  Em xây dựng màn hình giữ chỗ tại [booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts): Khi khách bấm giữ phòng, hệ thống khóa giữ phòng tạm thời trong 15 phút với đồng hồ đếm ngược trực quan. Nếu hết 15 phút mà khách chưa hoàn tất thanh toán cọc, đơn giữ phòng tự động chuyển sang trạng thái `Expired` và phòng được giải phóng ngay lập tức cho khách khác thuê. Em duy trì khóa `Idempotency-Key` để ngăn việc bấm chuột nhiều lần gây tạo trùng nhiều mã giữ phòng.

* **Trang Tra cứu Đơn đặt phòng & Che mờ Thông tin Cá nhân (PII Masking — Task T02):**  
  Em hoàn thiện trang [booking-lookup.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-lookup.page.ts) cho phép khách hàng tra cứu tiến trình đặt phòng bằng Mã đặt phòng và Số điện thoại mà không yêu cầu phải tạo tài khoản. Để bảo vệ quyền riêng tư theo tiêu chuẩn an toàn thông tin, em cài đặt cơ chế che mờ dữ liệu cá nhân (PII Masking): Số điện thoại chỉ hiển thị 3 số cuối (VD: `*******890`), họ tên và email được che bớt các ký tự giữa.

* **Trang Trạng thái Đơn phòng, Loại bỏ Thành công giả & Hiển thị Mã PIN Trung thực (Task T03):**  
  Trên màn hình [booking-status.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.ts), em thiết kế thanh tiến trình trạng thái đơn phòng rõ ràng (Đang giữ chỗ $\rightarrow$ Đã thanh toán $\rightarrow$ Đã nhận phòng $\rightarrow$ Đã trả phòng). Em loại bỏ hoàn toàn các thông báo thành công giả khi giao dịch chưa được xác nhận; đặc biệt, mã PIN phòng thông minh (Smart Lock Passcode) chỉ được phép hiển thị khi đơn đã thanh toán cọc thành công và trong khung giờ nhận phòng hợp lệ.

* **Kiểm thử Bảo mật Quyền Tra cứu Token ở Backend (Task T04):**  
  Trong [P5_GuestBookingTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs) và [GetGuestBookingByTokenQuery.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs), em viết các test case bảo mật chứng minh: Token sai, token bị thu hồi hoặc token đã hết hạn truy cập đều bị từ chối với HTTP 404; Token của cơ sở A tuyệt đối không thể đọc được đơn đặt phòng của cơ sở B; đơn giữ phòng hết hạn hiển thị đúng trạng thái `Expired` mà không bị lộ các trường dữ liệu nhạy cảm.

* **Kiểm thử Liên thông Đơn khách B2C với Phân hệ Lễ tân PMS (Cross-Testing — Task T05):**  
  Sau khi CSDL PostgreSQL 17 Cloud được triển khai, em phối hợp kiểm thử liên thông: Tạo đơn giữ phòng trên cổng B2C, sau đó đăng nhập tài khoản Lễ tân trên hệ thống quản trị để kiểm tra xem đơn phòng có xuất hiện đúng tại cơ sở đó không, Folio tính tiền có khớp số tiền cọc không, và lễ tân chi nhánh khác có bị chặn xem đơn theo đúng nguyên tắc đa thuê bao Fail-Closed hay không.

---

## PHẦN II. DANH MỤC MINH CHỨNG FILE MÃ NGUỒN TRÊN GITHUB CỦA 3 THÀNH VIÊN

Toàn bộ các đường dẫn dưới đây đều trỏ trực tiếp tới tệp mã nguồn thực tế trên kho lưu trữ GitHub nhóm:

### 1. Minh chứng mã nguồn của Ngô Võ Tuấn An (24TX810001)

* **Tầng Infrastructure & Database Cloud (CSDL Staging VPS, Bảo vệ Guard & Seeder 34 Tỉnh):**
  * [backend/src/HotelSaas.Infrastructure/Persistence/CloudDatabaseGuard.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/CloudDatabaseGuard.cs)
  * [backend/src/HotelSaas.Infrastructure/Persistence/DatabaseConnectionResolver.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/DatabaseConnectionResolver.cs)
  * [backend/src/HotelSaas.Infrastructure/Persistence/RealData34ProvincesSeeder.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/RealData34ProvincesSeeder.cs)
  * [backend/src/HotelSaas.Infrastructure/Persistence/SeedData.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/SeedData.cs)
* **Tầng Frontend Angular (Trang Khám phá Độc lập, Lịch sử Tìm kiếm, Fuzzy Search & Group Analytics):**
  * [frontend/src/app/features/public-booking/explore-search.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/explore-search.page.ts)
  * [frontend/src/app/features/public-booking/booking.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking.page.ts)
  * [frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts)
  * [frontend/src/app/features/reports/reports.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reports/reports.page.ts)
  * [frontend/src/app/features/subscriptions/subscriptions.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/subscriptions/subscriptions.page.ts)
* **Kiểm thử Probe Cloud Database & Analytics:**
  * [backend/tests/HotelSaas.WebApi.Tests/RemoteCloudDatabaseProbeTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.WebApi.Tests/RemoteCloudDatabaseProbeTests.cs)
  * [frontend/src/app/features/reports/reports.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reports/reports.page.spec.ts)
  * [frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.spec.ts)

### 2. Minh chứng mã nguồn của Nguyễn Khôi Nguyên (24TX810011 - N-Golden)

* **Tầng Frontend Angular (Giữ ngữ cảnh tìm kiếm, Kiểm tra giá & A11y):**
  * [frontend/src/app/features/public-booking/property-detail.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.ts)
  * [frontend/src/app/features/public-booking/booking.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking.page.ts)
  * [frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts)
* **Kiểm thử Tự động Backend & Frontend:**
  * [backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs)
  * [frontend/src/app/features/public-booking/property-detail.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.spec.ts)

### 3. Minh chứng mã nguồn của Trần Trọng Tân (24TX810025 - trantrongtan096)

* **Tầng Backend CQRS (Quyền Tra cứu Token & Idempotency):**
  * [backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs)
  * [backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Commands/CreateGuestHold/CreateGuestHoldCommand.cs)
  * [backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs)
* **Tầng Frontend Angular (Giữ phòng 15p, Tra cứu PII Masking & Trạng thái phòng):**
  * [frontend/src/app/features/public-booking/booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts)
  * [frontend/src/app/features/public-booking/booking-lookup.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-lookup.page.ts)
  * [frontend/src/app/features/public-booking/booking-status.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.ts)
* **Kiểm thử Tự động Backend & Frontend:**
  * [backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs)
  * [frontend/src/app/features/public-booking/booking-lookup.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-lookup.page.spec.ts)
  * [frontend/src/app/features/public-booking/booking-status.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.spec.ts)

---

## PHẦN III. ĐỐI CHIẾU LỊCH SỬ COMMIT NGUYÊN VĂN TRÊN GITHUB (TUẦN 03)

Bảng dưới đây ghi nhận chính xác 100% các commit thực tế đã được đẩy lên GitHub trong Tuần 03, kèm tác giả thật, tài khoản GitHub thật và liên kết trực tiếp:

| Mã Commit (Link GitHub) | Tác giả | Tài khoản GitHub | Ngày | Nguyên văn Commit Message | Nội dung thay đổi chính |
| :--- | :--- | :---: | :---: | :--- | :--- |
| [`07c1b4a`](https://github.com/GinNgo/hotel-saas-v2/commit/07c1b4a4ccf9c4251fe0c420da4dca32d694e7ee) | Ngô Võ Tuấn An | ngovotuanan | 24/10 | `feat(infra): connect shared staging database on vps with tls, schema migrations, and rbac seed (Tasks C02-C03)` | Kết nối CSDL PostgreSQL 17 chung trên VPS qua TLS, nạp 32 bảng EF Core và 5 vai trò RBAC. |
| [`bee51ad`](https://github.com/GinNgo/hotel-saas-v2/commit/bee51addc90c3af69f8174064fbdc1fc644baf00) | Ngô Võ Tuấn An | ngovotuanan | 24/10 | `feat(infra): implement cloud database guard, connection resolver, and guest middleware routing` | Cài đặt CloudDatabaseGuard chặn drop table tự động và bộ điều phối kết nối linh hoạt. |
| [`22bfb78`](https://github.com/GinNgo/hotel-saas-v2/commit/22bfb783809c9b70f114fa1fc610785f36532835) | Trần Trọng Tân | trantrongtan096 | 23/10 | `fix(booking): harden guest hold and status flows` | Hoàn thiện luồng giữ phòng 15 phút, đồng hồ đếm ngược và che PII thông tin khách. |
| [`6a5b6c4`](https://github.com/GinNgo/hotel-saas-v2/commit/6a5b6c41175882259a7c96af687057fd42fe97c3) | Ngô Võ Tuấn An | ngovotuanan | 24/10 | `fix(booking): enforce honest smart lock pin display and clean review stub per spec kit` | Ràng buộc hiển thị PIN phòng trung thực theo giờ check-in thực tế và dọn dẹp mock reviews. |
| [`bece6bf`](https://github.com/GinNgo/hotel-saas-v2/commit/bece6bf6e4db47a23052b6da4d3b474aa0e2dbf7) | Ngô Võ Tuấn An | ngovotuanan | 25/10 | `fix(swagger): configure custom schema IDs to support duplicate DTO names across namespaces` | Cấu hình Swagger Schema ID tùy chỉnh hỗ trợ các DTO trùng tên giữa Public và Admin. |
| [`98a6675`](https://github.com/GinNgo/hotel-saas-v2/commit/98a6675105a9a39e025c70dc8d7582a7ac891a8f) | Ngô Võ Tuấn An | ngovotuanan | 25/10 | `fix(ui): harmonize form input dimensions and align search bar layout` | Đồng bộ kích thước form input 44px và căn chỉnh bố cục thanh tìm kiếm chuẩn responsive. |
| [`6ae5114`](https://github.com/GinNgo/hotel-saas-v2/commit/6ae511454e481ffa5b009daa45f2ac43e75956ed) | Ngô Võ Tuấn An | ngovotuanan | 25/10 | `fix(auth): grant properties permission to owner and add hold/lookup unit tests` | Cấp quyền PROPERTIES cho chủ chuỗi khách sạn và bổ sung unit test giữ chỗ/tra cứu. |
| [`58670ac`](https://github.com/GinNgo/hotel-saas-v2/commit/58670acb28a304590a735660256091c73aca87bc) | Ngô Võ Tuấn An | ngovotuanan | 25/10 | `feat(reports): add multi-property group analytics dashboard and tests` | Xây dựng màn hình Báo cáo phân tích chuỗi đa cơ sở (RevPAR, ADR, Occupancy) và bộ test. |
| [`7d43d1a`](https://github.com/GinNgo/hotel-saas-v2/commit/7d43d1ae343a9c4aa48093f33af4bbedaee86b4d) | Trần Trọng Tân | trantrongtan096 | 26/10 | `feat(booking-status): improve confirmation UI and booking progress` | Nâng cấp giao diện trạng thái đơn đặt phòng và tiến trình các bước lưu trú. |
| [`ff48e6d`](https://github.com/GinNgo/hotel-saas-v2/commit/ff48e6d26808bb21fe12190e86a906dfca004365) | Nguyễn Khôi Nguyên | N-Golden | 26/10 | `fix(public-booking): preserve discovery context and validate room quotes` | Duy trì ngữ cảnh tìm kiếm khi quay lại, kiểm tra giá và hạn báo giá, test backend N04. |
| [`5bf7134`](https://github.com/GinNgo/hotel-saas-v2/commit/5bf7134f23e362c91d0cc3c86c14df82e95125b3) | Ngô Võ Tuấn An | ngovotuanan | 26/10 | `feat(discovery): seed 34 real provinces, add search history, fuzzy search, and isolate explore page` | Nạp 34 tỉnh thành thực tế vào Cloud DB, thêm Lịch sử tìm kiếm gần đây, Fuzzy Search và tách trang Home. |
| [`977514b`](https://github.com/GinNgo/hotel-saas-v2/commit/977514b12b147717bea826339d1b548f7c2a20e0) | Ngô Võ Tuấn An | ngovotuanan | 25/10 | `merge(booking): integrate Tan's hardened guest hold, lookup, and status flows` | Hợp nhất gói công việc luồng Giữ chỗ & Tra cứu của Trần Trọng Tân. |
| [`ddef7e4`](https://github.com/GinNgo/hotel-saas-v2/commit/ddef7e47a3272475ebdce87b6e0d14631d817297) | Ngô Võ Tuấn An | ngovotuanan | 26/10 | `merge(booking): integrate Nguyen's discovery context retention, room quote validation, and backend contract tests` | Hợp nhất gói công việc duy trì ngữ cảnh và kiểm thử backend của Nguyễn Khôi Nguyên. |
| [`3771339`](https://github.com/GinNgo/hotel-saas-v2/commit/3771339101d6c173504797fa6b5af26d336779a0) | Ngô Võ Tuấn An | ngovotuanan | 26/10 | `merge(booking): integrate Tan's booking-status confirmation UI and progress flows` | Hợp nhất gói hoàn thiện UI tiến trình đặt phòng của Trần Trọng Tân. |
| [`58f0948`](https://github.com/GinNgo/hotel-saas-v2/commit/58f0948d05e7f8b1e7f0417250080faed8f5d08f) | Ngô Võ Tuấn An | ngovotuanan | 27/10 | `fix(ci-cd): sanitize vps secret, resolve cross-property context in tests, and fix seed execution` | Loại bỏ mật khẩu VPS khỏi code, bảo mật qua biến môi trường, xử lý ngữ cảnh đa cơ sở giúp CI PR #8 xanh 100%. |
| [`cc860c0`](https://github.com/GinNgo/hotel-saas-v2/commit/cc860c0f88e4abc2cf5060668207c4520cc00a90) | Ngô Võ Tuấn An | ngovotuanan | 27/10 | `fix(booking): extend hold token ttl and resolve property context in test fixture` | Cập nhật thời hạn TTL token giữ phòng và chuẩn hóa ngữ cảnh chi nhánh giúp CI PR #9 xanh 100%. |

---

## PHẦN IV. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE & HUMAN VERIFICATION)

Toàn bộ thành viên trong nhóm nghiêm túc tuân thủ chuẩn mực học thuật: **Chỉ sử dụng AI hỗ trợ sinh khung scaffolding hoặc gợi ý cú pháp ban đầu; sinh viên là người trực tiếp chạy thử, phát hiện lỗi nghiệp vụ, lỗi bảo mật hoặc sai lệch dữ liệu, sau đó viết prompt tinh chỉnh và trực tiếp kiểm thử bằng code/test thực tế trước khi đưa vào hệ thống.**

### 1. Phân bổ Công cụ & Phiên bản Model AI thực tế đang hiển thị trên giao diện

> [!NOTE] Minh chứng tên Model thực tế hiển thị trên giao diện công cụ của từng thành viên
> Nhóm minh bạch 100% bằng cách đính kèm ảnh chụp màn hình trực tiếp từ giao diện công cụ làm việc thực tế của sinh viên để Thầy đối chiếu trực quan, đúng tinh thần chỉ dẫn của Thầy: *"khai đúng tên công cụ và model thực tế đang dùng, ghi chính xác như tên hiển thị trong giao diện"*:  
> 
> **1. Giao diện Google Antigravity IDE (Tuấn An & Khôi Nguyên):**  
> Thanh công cụ hiển thị rõ thư mục dự án `He-thong-quan-ly-khach-san` và mô hình **`Gemini 3.8 Flash High`** (kèm huy hiệu `Turbo`):  
> ![Giao diện Google Antigravity hiển thị Gemini 3.8 Flash High](https://github.com/GinNgo/hotel-saas-v2/raw/develop/docs/reports/images/antigravity-gemini-3.8-flash-high-ui.png)  
> 
> **2. Giao diện Codex / ChatGPT Codex (Trần Trọng Tân):**  
> Giao diện hiển thị rõ dự án `hotel-saas-v2` trên nhánh `develop` và menu chọn model hiển thị nguyên văn các mô hình **`6 Astra`** (Frontier intelligence for your most demanding tasks):  
> ![Giao diện Codex hiển thị model 6 Astra](https://github.com/GinNgo/hotel-saas-v2/raw/develop/docs/reports/images/codex-chatgpt-model-ui.png)

* **Ngô Võ Tuấn An (`24TX810001` - Nhóm trưởng):**
  * **Google Antigravity IDE (Model: `Gemini 3.8 Flash High`):** Hỗ trợ cấu hình CSDL Cloud PostgreSQL 17, thiết kế bộ lọc `CloudDatabaseGuard`, tối ưu hóa truy vấn địa danh 34 tỉnh thành, sinh khung tính toán KPI RevPAR/ADR cho Group Analytics và giải quyết xung đột merge.
* **Nguyễn Khôi Nguyên (`24TX810011` - Thành viên):**
  * **Google Antigravity IDE (Model: `Gemini 3.8 Flash High`):** Hỗ trợ sinh mã khung DTO truy vấn URL query parameters, phân tích máy trạng thái báo giá `expiresAtUtc` và kiểm thử xUnit cách ly đa chi nhánh.
* **Trần Trọng Tân (`24TX810025` - Thành viên):**
  * **Codex / ChatGPT Codex (Model: `6 Astra`):** Hỗ trợ sinh khung timer đếm ngược RxJS cho trang giữ phòng, thuật toán che mờ PII Masking và thiết kế FSM trạng thái đặt phòng.

---

### 2. Bảng Tổng Hợp Khai Báo Sử Dụng AI & Minh Chứng Chỉnh Sửa Thực Tế Tuần 03 (10 Hạng Mục)

| Mã Prompt | Thành viên thực hiện | Công cụ & Model AI thực tế | Phần việc áp dụng AI | Lỗi / Thiếu sót của mã do AI sinh ra (AI Limitation) | Quá trình phát hiện, tinh chỉnh prompt và kiểm chứng của sinh viên | Link File GitHub & Commit Minh Chứng |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **#01** | Ngô Võ Tuấn An (24TX810001) | Google Antigravity (Gemini 3.8 Flash High) | Kết nối Cloud PostgreSQL VPS & Khởi tạo Schema | AI đề xuất chạy tự động `context.Database.MigrateAsync()` ngay trong startup WebApi mà không có cơ chế bảo vệ, tiềm ẩn rủi ro phá hủy schema chung khi nhiều máy cùng kết nối. | Em phát hiện việc auto-migrate trên cloud rất nguy hiểm nếu cấu hình sai lệch; đã viết lại bộ kiểm tra `CloudDatabaseGuard.cs` bắt buộc kiểm tra cờ an toàn, cấm tự động drop/recreate DB chung trên VPS. | [CloudDatabaseGuard.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/CloudDatabaseGuard.cs) ([Commit bee51ad](https://github.com/GinNgo/hotel-saas-v2/commit/bee51ad)) |
| **#02** | Ngô Võ Tuấn An (24TX810001) | Google Antigravity (Gemini 3.8 Flash High) | Seeder dữ liệu thực tế 34 tỉnh thành Việt Nam | AI tự sinh dữ liệu khách sạn giả định với tọa độ GPS ngẫu nhiên ngoài biển và địa chỉ Phường/Xã không có thật tại Việt Nam. | Em rà soát thấy tọa độ bị lệch ra biển, nên yêu cầu AI đối chiếu bảng địa giới hành chính chuẩn; tự hiệu chỉnh chính xác địa chỉ Phường/Xã thật, tọa độ GPS và tên khách sạn 4-5 sao thật tại 34 tỉnh thành. | [RealData34ProvincesSeeder.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Persistence/RealData34ProvincesSeeder.cs) ([Commit 5bf7134](https://github.com/GinNgo/hotel-saas-v2/commit/5bf7134)) |
| **#03** | Ngô Võ Tuấn An (24TX810001) | Google Antigravity (Gemini 3.8 Flash High) | Tìm kiếm mờ (Fuzzy Search) & Bỏ dấu tiếng Việt | AI chỉ dùng hàm `.toLowerCase().includes()` chuẩn của JavaScript, khi người dùng gõ không dấu ("da lat", "sapa") hoặc gõ sai 1 ký tự thì kết quả trả về hoàn toàn rỗng. | Em phát hiện khách hàng thường gõ không dấu trên điện thoại, nên viết thêm hàm normalize bỏ dấu tiếng Việt (Unaccent) và tích hợp thuật toán khoảng cách Levenshtein cho phép sai lệch 1-2 ký tự. | [booking-filter-bar.component.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts) ([Commit 5bf7134](https://github.com/GinNgo/hotel-saas-v2/commit/5bf7134)) |
| **#04** | Ngô Võ Tuấn An (24TX810001) | Google Antigravity (Gemini 3.8 Flash High) | Báo cáo chuỗi đa chi nhánh (Group Analytics) | AI dùng hàm `Math.random()` để vẽ biểu đồ tăng trưởng doanh thu thay vì truy vấn dữ liệu thực tế từ cơ sở dữ liệu. | Em kiểm tra thấy số liệu doanh thu nhảy loạn xạ mỗi lần F5, nên xóa bỏ toàn bộ `Math.random()`, viết API tính toán chuẩn xác các chỉ số RevPAR, ADR và Tỷ lệ lấp đầy theo dữ liệu đặt phòng thật. | [reports.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reports/reports.page.ts) ([Commit 58670ac](https://github.com/GinNgo/hotel-saas-v2/commit/58670ac)) |
| **#05** | Nguyễn Khôi Nguyên (24TX810011) | Google Antigravity (Gemini 3.8 Flash High) | Giữ ngữ cảnh tìm kiếm khi bấm Quay lại (Back) | AI chỉ truyền lại ngày nhận/trả phòng trong routerLink, làm mất toàn bộ từ khóa địa danh, khoảng giá và các bộ lọc tiện ích của khách. | Em bấm thử nút "← Quay lại" thấy trang kết quả bị reset trắng bộ lọc, nên viết hàm `returnQueryParams()` thu thập toàn bộ các query params hiện có trên URL để bảo toàn 100% ngữ cảnh tìm kiếm. | [property-detail.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.ts) ([Commit ff48e6d](https://github.com/GinNgo/hotel-saas-v2/commit/ff48e6d)) |
| **#06** | Nguyễn Khôi Nguyên (24TX810011) | Google Antigravity (Gemini 3.8 Flash High) | Kiểm tra hiệu lực báo giá phòng (Quote Expiration) | AI cho phép chuyển thẳng sang màn hình giữ phòng kể cả khi thời hạn báo giá (`expiresAtUtc`) đã hết, dẫn đến lỗi xung đột giá ở backend. | Em nhận thấy giá phòng có thể thay đổi sau khi hết hạn báo giá, nên bổ sung bước kiểm tra `expiresAtUtc > Date.now()`; nếu hết hạn thì hiển thị cảnh báo yêu cầu khách tính giá lại trước khi tiếp tục. | [property-detail.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.ts) ([Commit ff48e6d](https://github.com/GinNgo/hotel-saas-v2/commit/ff48e6d)) |
| **#07** | Nguyễn Khôi Nguyên (24TX810011) | Google Antigravity (Gemini 3.8 Flash High) | Backend Testing cách ly chi nhánh (N04) | AI viết test kiểm tra danh sách phòng nhưng không tạo chi nhánh thứ 2 để đối chiếu, không chứng minh được tính cách ly đa chi nhánh. | Em phát hiện test case chưa đủ chặt chẽ, nên tạo thêm `Property B` và `Property Inactive` trong fixture test để kiểm chứng API tuyệt đối không trả lẫn lộn phòng giữa các cơ sở khác nhau. | [P5_GuestBookingTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs) ([Commit ff48e6d](https://github.com/GinNgo/hotel-saas-v2/commit/ff48e6d)) |
| **#08** | Trần Trọng Tân (24TX810025) | Codex / ChatGPT (Model: 6 Astra) | Đồng hồ đếm ngược giữ phòng 15 phút | Khi hết 15 phút, AI chỉ hiển thị thông báo trên giao diện nhưng không gọi lệnh hủy giữ chỗ ngầm, khiến phòng vẫn bị khóa tạm thời. | Em quan sát thấy hết giờ mà phòng không mở lại cho khách khác, nên viết hàm tự động cập nhật trạng thái đơn sang `Expired` và gọi API giải phóng phòng trống ngay khi đồng hồ về 00:00. | [booking-hold.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-hold.page.ts) ([Commit 22bfb78](https://github.com/GinNgo/hotel-saas-v2/commit/22bfb78)) |
| **#09** | Trần Trọng Tân (24TX810025) | Codex / ChatGPT (Model: 6 Astra) | Tra cứu đặt phòng & Che mờ PII khách hàng | AI trả về nguyên văn số điện thoại và email của khách trong API tra cứu bằng token, vi phạm nghiêm trọng chính sách bảo mật dữ liệu cá nhân. | Em nhận diện lỗ hổng lộ thông tin cá nhân của khách, nên viết hàm che PII ở cả backend lẫn frontend: chỉ để lại 3 số cuối điện thoại và ẩn các ký tự giữa của tên/email. | [booking-lookup.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-lookup.page.ts) ([Commit 22bfb78](https://github.com/GinNgo/hotel-saas-v2/commit/22bfb78)) |
| **#10** | Trần Trọng Tân (24TX810025) | Codex / ChatGPT (Model: 6 Astra) | Chính sách hiển thị mã PIN phòng thông minh | AI sinh mã PIN mẫu "123456" hiển thị cố định ngay cả khi đơn đặt phòng đang ở trạng thái chờ thanh toán hoặc đã bị hủy. | Em phát hiện hiển thị mã PIN bừa bãi là sai nghiệp vụ khách sạn thông minh, nên ràng buộc điều kiện: chỉ giải mã và hiển thị mã PIN thật khi đơn đã thanh toán cọc và đang trong khung giờ check-in. | [booking-status.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking-status.page.ts) ([Commit 6a5b6c4](https://github.com/GinNgo/hotel-saas-v2/commit/6a5b6c4)) |

---

## PHẦN V. KẾ HOẠCH THỰC HIỆN TUẦN 04 (TỪ 26/10/2026 ĐẾN 01/11/2026)

Căn cứ vào kết quả đã nghiệm thu ở Tuần 03, hệ thống đã hoàn thiện luồng trải nghiệm khách hàng B2C và vận hành ổn định trên CSDL Cloud PostgreSQL 17 Staging. Nhóm xác định mục tiêu trọng tâm trong Tuần 04 là: **Tích hợp Cổng thanh toán trực tuyến thực tế (VNPay Sandbox & VietQR Pay), Xử lý Webhook IPN tự động chuyển trạng thái đơn phòng, Hệ thống Thông báo thời gian thực (Realtime Notifications qua SignalR), Xuất báo cáo Kế toán chuẩn Excel/PDF và Kiểm thử tải đồng thời (Concurrency Load Testing) sẵn sàng cho buổi nghiệm thu tổng thể đề tài.**

*(Chi tiết phân rã user story, nhiệm vụ kỹ thuật và checklist nghiệm thu được trình bày tại tài liệu độc lập trong repo: [`docs/team/KE-HOACH-CHI-TIET-TUAN-4.md`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/docs/team/KE-HOACH-CHI-TIET-TUAN-4.md)).*

---

### 1. Phân công công việc chi tiết cho từng thành viên trong Tuần 04

#### 1. Ngô Võ Tuấn An (24TX810001 - Nhóm trưởng):
* **Nhiệm vụ 1 — Tích hợp Cổng Thanh toán Trực tuyến & Webhook IPN an toàn (Tasks A01–A02):**
  * Triển khai endpoint tiếp nhận Webhook IPN (Instant Payment Notification) từ cổng thanh toán VNPay và VietQR với cơ chế xác thực chữ ký điện tử HMAC-SHA512.
  * Đảm bảo tính toán toàn vẹn dữ liệu: Khi VNPay gửi thông báo thanh toán thành công, hệ thống tự động cập nhật đơn phòng từ `PendingPayment` sang `Confirmed`, ghi nhận khoản tiền cọc vào Folio và tự động gửi hóa đơn điện tử cho khách.
  * Cài đặt cơ chế kiểm soát xử lý Idempotent cho Webhook để chống việc VNPay retry webhook nhiều lần gây ghi trùng giao dịch.
* **Nhiệm vụ 2 — Hệ thống Thông báo Thời gian thực (Realtime SignalR Hub — Task A03):**
  * Xây dựng `NotificationHub` trên nền tảng ASP.NET Core SignalR: Khi có khách hàng hoàn tất đặt phòng trên cổng B2C, hệ thống lập tức phát tín hiệu thời gian thực (realtime notification) tới màn hình của Lễ tân chi nhánh tương ứng để lễ tân chuẩn bị phòng đón khách.
* **Nhiệm vụ 3 — Điều phối Tích hợp, Kiểm thử Tải & Chuẩn bị Báo cáo Tổng kết (Tasks A04–A05):**
  * Chạy kịch bản kiểm thử tải đồng thời (Concurrency & Stress Testing) bằng k6 / test script trên máy chủ Staging để kiểm chứng khả năng chịu tải của các ràng buộc `btree_gist` khi 100 khách cùng tranh chấp giữ 1 phòng cuối cùng.
  * Review PR, duy trì CI/CD GitHub Actions đạt 100% pass với 0 build warnings.

#### 2. Nguyễn Khôi Nguyên (24TX810011 - N-Golden):
* **Nhánh phát triển dự kiến:** `feature/nguyen-week4-invoicing-export`
* **Nhiệm vụ 1 — Phân hệ Xuất Báo cáo Tài chính & Sổ cái Kế toán ra Excel/PDF (Tasks N01–N02):**
  * Xây dựng chức năng xuất Báo cáo Doanh thu, Báo cáo Công suất phòng và Báo cáo Sổ cái Thu ngân ra tệp định dạng **Excel (.xlsx)** và **PDF** chuẩn in ấn bằng thư viện chuyên dụng ở backend (`ClosedXML` / `QuestPDF`).
  * Đảm bảo báo cáo xuất ra có đầy đủ tiêu đề cơ sở lưu trú, logo khách sạn, phân tách rõ thuế VAT, tiền dịch vụ, tiền cọc và chữ ký người lập biểu.
* **Nhiệm vụ 2 — Hoàn thiện Trang Đặt phòng B2C Đa Phương thức Thanh toán (Task N03):**
  * Bổ sung giao diện lựa chọn hình thức thanh toán tại màn hình giữ phòng: Thanh toán qua Cổng VNPay (Thẻ ATM nội địa, Thẻ quốc tế Visa/Mastercard), Quét mã VietQR chuyển khoản nhanh 24/7, hoặc Thanh toán trực tiếp tại quầy Lễ tân khi nhận phòng.
  * Hiển thị mã QR động chuẩn VietQR có kèm nội dung chuyển khoản mã hóa và số tiền chính xác để khách quét app ngân hàng tiện lợi.
* **Nhiệm vụ 3 — Kiểm thử Hồi quy Toàn diện & Viết Test Suite (Task N04):**
  * Viết bổ sung bộ unit test và integration test cho các Service xuất báo cáo Excel/PDF và luồng sinh mã VietQR.

#### 3. Trần Trọng Tân (24TX810025 - trantrongtan096):
* **Nhánh phát triển dự kiến:** `feature/tan-week4-notifications-audit`
* **Nhiệm vụ 1 — Giao diện Trung tâm Thông báo Lễ tân & Khách hàng (Tasks T01–T02):**
  * Xây dựng component `NotificationBell` và thanh thông báo nổi (Toast Notification) trên giao diện Lễ tân Angular: Tự động phát âm thanh thông báo và hiển thị popup khi có đơn đặt phòng mới phát sinh hoặc có yêu cầu dọn phòng khẩn cấp.
  * Xây dựng tính năng nhắc nhở tự động cho khách hàng khi đơn giữ phòng sắp hết hạn (còn 3 phút cuối cùng) kèm nút gia hạn hoặc thanh toán ngay.
* **Nhiệm vụ 2 — Nhật ký Hoạt động Hệ thống & Vết Kiểm toán (Audit Logging System — Task T03):**
  * Hoàn thiện phân hệ ghi vết kiểm toán (`AuditLog`): Lưu vết chi tiết lịch sử mọi thao tác quan trọng (Ai đã thay đổi giá phòng, Ai đã hủy đơn đặt phòng, Ai đã duyệt check-in/out không thu tiền) kèm địa chỉ IP và dấu thời gian UTC để phục vụ đối soát gian lận.
* **Nhiệm vụ 3 — Kiểm thử Luồng Hủy phòng & Hoàn tiền Cọc (Cancellation & Refund Flow — Task T04):**
  * Kiểm thử nghiệp vụ hủy phòng: Khách tự hủy đơn trước giờ quy định thì hoàn điểm thưởng/tiền cọc theo đúng chính sách hoàn hủy; đơn phòng hủy quá giờ thì trừ phí phạt theo quy định cơ sở.
  * Kiểm chứng việc phòng sau khi hủy lập tức hiển thị lại trên cổng tìm kiếm B2C mà không bị nghẽn trạng thái.

---

### 2. Tiêu chí nghiệm thu chất lượng Tuần 04 (Quality Acceptance Gates)

1. **Về Mã nguồn & Biên dịch:**
   * Backend (.NET 10): `dotnet build backend/HotelSaas.slnx` đạt **0 Errors, 0 Warnings**.
   * Frontend (Angular 22): `npm run build` thành công 100%, không phát sinh lỗi cảnh báo tối ưu hóa.
2. **Về Kiểm thử tự động (Automated Testing):**
   * Duy trì tỷ lệ **100% unit tests vượt qua** trên toàn bộ hệ sinh thái (mục tiêu tối thiểu **800+ test cases** pass).
   * 100% các luồng Webhook IPN và tính toán số dư Folio được kiểm thử tự động với ít nhất 10 kịch bản biên (Edge Cases).
3. **Về Vận hành & Nghiệm thu Tổng kết:**
   * Luồng thanh toán thực tế với VNPay Sandbox và VietQR Pay hoạt động trơn tru từ đầu đến cuối trên máy chủ Cloud Staging.
   * Toàn bộ hệ thống sẵn sàng cho buổi báo cáo nghiệm thu kết thúc đề tài với Giảng viên hướng dẫn.
