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

### 3. Chi Tiết Nội Dung Prompt, Mã AI Tạo Ra & Quá Trình Sinh Viên Chỉnh Sửa Hoàn Thiện Thực Tế (Trình Bày Chi Tiết Từng Thành Viên)

#### 1. Ngô Võ Tuấn An (MSSV: 24TX810001 - Nhóm trưởng)

* **Công cụ sử dụng:** Google Antigravity
* **Mô hình AI thực tế (Model):** `Gemini 3.8 Flash High` (kèm huy hiệu Turbo)

**Prompt sử dụng:**
* **[Prompt 1 - Bảo vệ CSDL Cloud VPS & Chống Auto-Migrate]:** "Hãy viết cơ chế kết nối CSDL Cloud PostgreSQL trên VPS Staging (Alpine Linux 17.11) bảo đảm kết nối TLS/SSL an toàn. Cần xây dựng CloudDatabaseGuard để ngăn chặn hoàn toàn việc các lệnh khởi động WebApi ở môi trường local tự động chạy EnsureDeleted() hoặc Drop Database làm mất dữ liệu dùng chung của cả nhóm. Thiết kế DatabaseConnectionResolver tự động nhận diện chuỗi kết nối an toàn qua biến môi trường."
* **[Prompt 2 - Nạp dữ liệu thực tế 34 Tỉnh thành & Xóa bỏ Mock Fake]:** "Hệ thống đang dùng dữ liệu mock giả lập không phản ánh đúng địa lý thực tế. Hãy xây dựng Seeder nạp dữ liệu thật cho 34 tỉnh thành du lịch trọng điểm Việt Nam (Đà Lạt, Sa Pa, Hạ Long, Phú Quốc, Đà Nẵng, Nha Trang, Huế, Ninh Bình, Hà Giang...). Mỗi cơ sở phải có địa chỉ chi tiết đến cấp Phường/Xã, tọa độ GPS thực tế (Latitude/Longitude), các hạng phòng Standard/Deluxe/Suite, phòng vật lý và biểu giá niêm yết VND đang kích hoạt."
* **[Prompt 3 - Tách trang Khám phá & Tìm kiếm Fuzzy Search]:** "Trang chủ hiện đang nhồi nhét cả danh sách khách sạn khiến giao diện bị rối mắt. Hãy tách biệt trang chủ giới thiệu và trang Khám phá (/explore). Xây dựng thanh công cụ tìm kiếm với ô nhập từ khóa có tính năng Search History (lưu 5 lượt tìm gần nhất vào localStorage), gợi ý danh mục điểm đến phổ biến và thuật toán Fuzzy Search không phân biệt dấu tiếng Việt (ví dụ gõ 'vung tau' hoặc 'vũng tàu' đều tìm thấy chính xác)."
* **[Prompt 4 - Báo cáo phân tích chuỗi đa cơ sở (Group Analytics)]:** "Là chủ sở hữu chuỗi khách sạn (Tenant Owner), người dùng cần xem báo cáo tổng hợp tình hình kinh doanh của toàn bộ các chi nhánh. Hãy xây dựng API GetGroupAnalyticsQuery và màn hình Angular Dashboard tổng hợp: KPI chuỗi (Tổng số cơ sở, Tổng phòng, Công suất trung bình, Doanh thu ước tính), biểu đồ CSS trực quan phân bổ theo vùng miền và bảng so sánh chi tiết số liệu giữa từng cơ sở."

**AI tạo ra:**
* Đoạn code khởi tạo DbContext gọi `Migrate()` và `EnsureCreated()` tự động mỗi khi WebApi khởi động, tiềm ẩn nguy cơ xung đột schema hoặc vô tình xóa bảng trên VPS Cloud dùng chung.
* Dữ liệu Seeder chỉ có vài dòng mẫu với tọa độ giả lập `(0, 0)` hoặc địa chỉ chung chung "123 Main St", thiếu hoàn toàn phân cấp hành chính chuẩn Việt Nam.
* Component tìm kiếm nhúng chung vào trang chủ, không lưu lịch sử tìm kiếm và cơ chế so khớp chuỗi `String.Contains` thông thường bị lỗi khi người dùng gõ tiếng Việt không dấu hoặc có dấu sai vị trí.
* Dashboard phân tích chỉ truy vấn đơn lẻ từng `PropertyId`, không có câu lệnh tính toán Group By theo `TenantId` để tổng hợp chỉ số toàn chuỗi.

**SV đã sửa:**
* **Kiểm tra kết nối CSDL Cloud & Bảo vệ dữ liệu:** Sau khi AI sinh mã, em đưa vào project chạy thử nghiệm. Khi khởi động WebApi với chuỗi kết nối VPS, em phát hiện lệnh Auto-Migrate tự động kích hoạt có thể làm đè dữ liệu đang có của các thành viên khác, chưa đúng ý bảo đảm toàn vẹn CSDL; em viết prompt yêu cầu AI xây dựng bộ bảo vệ `CloudDatabaseGuard` kiểm tra cờ môi trường `AllowCloudStartupDatabaseInit = false`, chặn đứng các hàm Drop/EnsureDeleted. Em thao tác khởi động lại backend, mở pgAdmin đối soát CSDL thấy dữ liệu và bảng được giữ nguyên an toàn 100%, đúng ý đồ thiết kế.
* **Kiểm tra nạp dữ liệu thật 34 Tỉnh thành:** Em chạy seeder dữ liệu của AI thì thấy các cơ sở có tọa độ sai lệch và địa chỉ ảo; em viết prompt yêu cầu đối chiếu danh mục 34 tỉnh thành với tọa độ GPS thực và địa chỉ chính xác đến từng Phường/Xã. Em đối soát lại tọa độ các cơ sở lớn (Đà Lạt Edensee, Mường Thanh Sa Pa, Vinpearl Discovery Phú Quốc...), nạp vào CSDL Staging và kiểm tra thấy 35 cơ sở với 136 phòng vật lý hiển thị đầy đủ, đúng ý thực tế.
* **Kiểm tra trang Khám phá & Fuzzy Search:** Thao tác trên giao diện, em thấy trang chủ quá tải thông tin và khi gõ "da lat" không dấu thì bộ lọc không tìm ra kết quả; em yêu cầu AI tách trang `/explore` độc lập, bổ sung `SearchHistoryService` lưu vào localStorage và hàm chuẩn hóa tiếng Việt loại bỏ dấu (`normalizeVietnamese`). Em thao tác gõ thử nghiệm "phu quoc", "nha trang", "sapa" thấy dropdown gợi ý phản hồi tức thì, click chọn vào xem phòng mượt mà và đúng ý trải nghiệm.
* **Kiểm tra báo cáo chuỗi Group Analytics:** Em đăng nhập với quyền Tenant Owner để xem báo cáo thì thấy chỉ xem được cơ sở hiện tại; em prompt AI viết `GetGroupAnalyticsQueryHandler` sử dụng câu truy vấn Group By TenantId, bổ sung bảng so sánh và biểu đồ thanh tỷ lệ lấp đầy. Em thao tác chuyển đổi qua lại giữa các cơ sở, số liệu tổng doanh thu và công suất phòng nhảy cập nhật chuẩn xác, đúng ý quản trị chuỗi.

**Minh chứng Commit GitHub:**
* Commit [`07c1b4a`](https://github.com/GinNgo/hotel-saas-v2/commit/07c1b4a4cb402b8daec161c56f8f175489f029b9): `feat(db): establish cloud postgresql staging and enforce safe connection guard`
* Commit [`bee51ad`](https://github.com/GinNgo/hotel-saas-v2/commit/bee51ad982fe51578a59489fcffb38d38865c3bb): `feat(explore): implement isolated exploration page, active filter bar, and search dropdown with history`
* Commit [`5bf7134`](https://github.com/GinNgo/hotel-saas-v2/commit/5bf7134f23e362c91d0cc3c86c14df82e95125b3): `feat(discovery): seed 34 real provinces, add search history, fuzzy search, and isolate explore page`
* Commit [`58670ac`](https://github.com/GinNgo/hotel-saas-v2/commit/58670ac23ae6245fba5e7d5cf2279165d4911d95): `feat(analytics): add multi-property group analytics dashboard and comparison table`
* Commit [`58f0948`](https://github.com/GinNgo/hotel-saas-v2/commit/58f0948d05e7f8b1e7f0417250080faed8f5d08f): `fix(ci-cd): sanitize vps secret, resolve cross-property context in tests, and fix seed execution`

---

#### 2. Nguyễn Khôi Nguyên (MSSV: 24TX810011 - Thành viên)

* **Công cụ sử dụng:** Google Antigravity
* **Mô hình AI thực tế (Model):** `Gemini 3.8 Flash High` (kèm huy hiệu Turbo)

**Prompt sử dụng:**
* **[Prompt 1 - Duy trì ngữ cảnh tìm kiếm khi Quay lại (Back)]:** "Khi khách hàng click từ trang Khám phá vào xem chi tiết một khách sạn rồi bấm nút Quay lại (Back), toàn bộ thông tin ngày nhận/trả phòng, số lượng khách và từ khóa tìm kiếm đang bị xóa trắng về mặc định. Hãy sửa lại router Angular sử dụng NavigationExtras queryParamsHandling: 'merge' và BookingSearchSyncService để đồng bộ hai chiều query parameters lên URL, đảm bảo khi bấm Quay lại trang trước vẫn giữ nguyên trạng thái tìm kiếm ban đầu của khách."
* **[Prompt 2 - Báo giá theo chế độ lưu trú & Kiểm tra hạn expiresAtUtc]:** "Logic tính giá phòng đang lấy giá niêm yết nhân với số ngày một cách cơ học mà không phân biệt hình thức lưu trú (Thuê theo Giờ, Thuê Qua Đêm, Thuê Theo Ngày). Hãy hoàn thiện CalculateRoomPriceQuery tính giá chi tiết cho từng chế độ, kiểm tra phụ thu nhận sớm/trả trễ. Bổ sung trường expiresAtUtc (thời hạn 15 phút) trong token báo giá để chặn việc khách giữ giá cũ quá hạn khi khách sạn đã điều chỉnh giá."
* **[Prompt 3 - Backend Contract Testing cách ly chi nhánh (Task N04)]:** "Viết bộ kiểm thử tích hợp hợp đồng Backend (Contract Tests) bằng xUnit và FluentAssertions để kiểm chứng API GetPublicPropertyDetailQuery và GetRoomQuoteQuery. Bộ test phải xác minh tính bất biến đa thuê bao: một khách hàng không thể dùng RoomTypeId của khách sạn A để tạo báo giá hoặc đặt phòng tại khách sạn B (Cross-Property Isolation)."

**AI tạo ra:**
* Router Angular chỉ chuyển trang đơn thuần `router.navigate(['/booking/property', id])` không truyền tham số tìm kiếm, dẫn đến khi người dùng ấn Back thì mất toàn bộ bộ lọc đã chọn.
* Logic tính giá chỉ có công thức đơn giản `Price = BasePrice * Days`, bỏ qua hoàn toàn các chính sách giá đặc thù của khách sạn Việt Nam (giá 2 giờ đầu, giá qua đêm từ 22h - 8h sáng) và token báo giá không có hạn sử dụng.
* Bài test backend xUnit chỉ kiểm tra trường hợp đúng (Happy Path) với dữ liệu cùng chi nhánh, không có kịch bản giả lập tấn công chéo chi nhánh (Cross-Property Data Leakage).

**SV đã sửa:**
* **Kiểm tra duy trì ngữ cảnh tìm kiếm (Context Retention):** Đưa mã vào chạy thử nghiệm, em thao tác chọn ngày `28/10 - 30/10` tại Đà Lạt rồi click vào xem chi tiết khách sạn. Khi em bấm nút "Quay lại danh sách", form tìm kiếm bị reset về ngày hôm nay làm khách phải chọn lại từ đầu, trải nghiệm chưa đúng ý; em viết prompt yêu cầu AI dùng `queryParamsHandling: 'merge'` và đồng bộ vào query string của URL. Em thao tác bấm Back/Forward nhiều lần trên trình duyệt kiểm tra thấy ngày tháng và bộ lọc khách giữ nguyên vẹn 100%, đúng ý mong muốn.
* **Kiểm tra báo giá đa chế độ & Thời hạn giữ giá:** Thao tác chọn phòng thuê theo giờ, em thấy giá hiển thị thành giá 1 ngày là sai nghiệp vụ; em prompt AI chia thành 3 công thức tính giá theo `StayMode` (Hourly, Overnight, Daily) và sinh `PriceQuoteToken` có hạn `expiresAtUtc` đúng 15 phút. Em thao tác chọn thử 3 giờ và qua đêm thấy hệ thống tính giá chuẩn xác từng nghìn đồng, đúng ý nghiệp vụ khách sạn.
* **Kiểm tra bảo mật cách ly chi nhánh (Contract Testing):** Em chạy bộ test backend của AI thì thấy thiếu trường hợp kiểm tra bảo mật; em yêu cầu AI bổ sung test fixture `CrossPropertyRoomQuoteRejectionTests`. Khi chạy test thử nghiệm, hệ thống xác nhận trả về mã lỗi `400 Bad Request` kèm thông báo chặn không cho phép lấy giá phòng của chi nhánh khác, CI pass xanh toàn bộ và đúng ý an toàn đa thuê bao.

**Minh chứng Commit GitHub:**
* Commit [`ff48e6d`](https://github.com/GinNgo/hotel-saas-v2/commit/ff48e6d87d96a7d5cbdf35a4d95267bca9c1b35e): `feat(booking): retain search params when navigating to detail and booking hold`
* Commit [`ddef7e4`](https://github.com/GinNgo/hotel-saas-v2/commit/ddef7e47a3272475ebdce87b6e0d14631d817297): `merge(booking): integrate Nguyen's discovery context retention, room quote validation, and backend contract tests`
* Commit [`cc860c0`](https://github.com/GinNgo/hotel-saas-v2/commit/cc860c0f88e4abc2cf5060668207c4520cc00a90): `fix(booking): extend hold token ttl and resolve property context in test fixture`

---

#### 3. Trần Trọng Tân (MSSV: 24TX810025 - Thành viên)

* **Công cụ sử dụng:** Codex / ChatGPT
* **Mô hình AI thực tế (Model):** `6 Astra` (Frontier intelligence) / `6.1 Sol`

**Prompt sử dụng:**
* **[Prompt 1 - Đồng hồ đếm ngược giữ phòng 15 phút & Hủy ngầm khi hết giờ]:** "Trên trang giữ phòng B2C (booking-hold.page.ts), hãy xây dựng đồng hồ đếm ngược 15 phút (900 giây) sử dụng Angular Signals và rxjs interval. Khi đồng hồ về 0, giao diện phải lập tức chuyển sang trạng thái hết hạn (Hold Expired), vô hiệu hóa nút thanh toán và gọi API ReleaseExpiredHoldCommand để giải phóng phòng ngầm trong database, cho phép khách khác vào đặt."
* **[Prompt 2 - Tra cứu đặt phòng & Che mờ thông tin cá nhân (PII Masking)]:** "Xây dựng trang tra cứu đơn đặt phòng B2C (/booking/lookup) bằng Mã đặt phòng (Booking Code) và Số điện thoại. Để tuân thủ nguyên tắc bảo vệ quyền riêng tư người dùng, API trả về và giao diện tuyệt đối không hiển thị nguyên văn số điện thoại và email của khách mà phải che mờ (masking PII): ví dụ số điện thoại 0901234567 thành 090****567, email nguyenvana@gmail.com thành n***a@gmail.com."
* **[Prompt 3 - Ràng buộc hiển thị mã PIN phòng thông minh trung thực]:** "Trên trang trạng thái xác nhận đặt phòng (booking-status.page.ts), hệ thống đang hiển thị mã mở cửa thông minh (Smart Door PIN Code) ngay cả khi đơn mới được tạo và chưa thanh toán cọc. Hãy thiết lập điều kiện bảo mật: Mã PIN chỉ được giải mã và hiển thị khi đơn đặt phòng có trạng thái Confirmed (đã thanh toán hoặc xác nhận), và thời gian hiện tại nằm trong khung giờ check-in hợp lệ. Nếu chưa thanh toán, hiển thị hướng dẫn cọc kèm trạng thái 'Chờ kích hoạt mã PIN'."

**AI tạo ra:**
* Đồng hồ đếm ngược chỉ hiển thị chữ tĩnh trên giao diện, không có timer chạy thực tế và khi người dùng tải lại trang thì số phút bị reset lại từ đầu; không có lệnh gọi giải phóng phòng khi hết giờ.
* Màn hình tra cứu hiển thị toàn bộ họ tên, số điện thoại, email và giá tiền công khai, tạo lỗ hổng rò rỉ dữ liệu cá nhân nếu ai đó gõ mò trúng mã đặt phòng.
* Mã PIN khóa cửa phòng thông minh được gán giá trị mặc định cố định `"123456"` hiển thị ngay lập tức trên trang kết quả mà không cần kiểm tra trạng thái thanh toán.

**SV đã sửa:**
* **Kiểm tra đồng hồ đếm ngược giữ phòng:** Đưa mã vào chạy thử nghiệm, em thao tác đặt giữ phòng thử và quan sát màn hình giữ phòng thì thấy timer đếm ngược không giảm giây, F5 lại trang thì timer nhảy lại 15:00 chưa đúng ý; em viết prompt yêu cầu AI tính toán thời gian còn lại dựa trên hiệu số giữa thời gian hiện tại và `HoldExpiresAtUtc` từ server. Em chờ thử nghiệm hết 15 phút, giao diện tự động vô hiệu hóa nút thanh toán và phòng được trả về trạng thái Available đúng ý nghiệp vụ.
* **Kiểm tra tra cứu & Che mờ thông tin cá nhân:** Thao tác nhập mã tra cứu đơn phòng trên giao diện, em thấy thông tin cá nhân của khách hiển thị công khai toàn bộ là vi phạm bảo mật PII chưa đúng ý; em prompt AI viết hàm `MaskPhoneNumber` và `MaskEmail` ở tầng Application DTO và component Angular. Em thao tác tra cứu lại thấy số điện thoại đã hiển thị dạng `091****890` và email `a***n@gmail.com`, an toàn và đúng ý bảo vệ khách hàng.
* **Kiểm tra hiển thị mã PIN khóa thông minh:** Thao tác kiểm tra đơn phòng chưa thanh toán, em thấy màn hình vẫn hiện mã PIN "123456" cho phép vào phòng là sai quy trình khách sạn; em prompt yêu cầu AI ràng buộc chặt chẽ logic `canViewSmartPin = isConfirmed && isWithinCheckInWindow`. Em thao tác với đơn phòng đang ở trạng thái `PendingPayment` thấy mã PIN được che kín kèm thông báo "Mã PIN sẽ kích hoạt sau khi thanh toán", sau khi xác nhận thanh toán thì mã PIN mới hiện lên chuẩn xác, đúng ý.

**Minh chứng Commit GitHub:**
* Commit [`22bfb78`](https://github.com/GinNgo/hotel-saas-v2/commit/22bfb78f4fe742b7811fe0901b51610e53a2bb61): `feat(booking): harden guest hold, lookup, and status flow`
* Commit [`6a5b6c4`](https://github.com/GinNgo/hotel-saas-v2/commit/6a5b6c478a87796d1ff8e919ff7ae383021966a4): `feat(booking): add public lookup and status confirmation pages`
* Commit [`7d43d1a`](https://github.com/GinNgo/hotel-saas-v2/commit/7d43d1a2d7f87252033bc88aa97e2f12fd0248ad): `feat(booking): enhance booking lookup form with tracking code guidance and clean empty state`
* Commit [`977514b`](https://github.com/GinNgo/hotel-saas-v2/commit/977514b12b147717bea826339d1b548f7c2a20e0): `merge(booking): integrate Tan's hardened guest hold, lookup, and status flows`
* Commit [`3771339`](https://github.com/GinNgo/hotel-saas-v2/commit/3771339101d6c173504797fa6b5af26d336779a0): `merge(booking): integrate Tan's booking-status confirmation UI and progress flows`

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
