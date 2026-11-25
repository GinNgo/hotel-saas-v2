# MỤC TIÊU CỦA ĐỀ TÀI

**Trường:** Đại học Sư phạm Kỹ thuật TP. Hồ Chí Minh – Khoa Công nghệ Thông tin – Bộ môn Công nghệ Phần mềm  
**Mã đề tài:** 578  
**Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)  
**Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)  
**Nhóm sinh viên thực hiện:**
* Ngô Võ Tuấn An (`24TX810001` - Nhóm trưởng)
* Nguyễn Khôi Nguyên (`24TX810011`)
* Trần Trọng Tân (`24TX810025`)

**Kho mã nguồn GitHub:** https://github.com/GinNgo/hotel-saas-v2  
**Môi trường thử nghiệm:** https://luxustay.duckdns.org  

---

## 1. Bối cảnh thực tế và vấn đề nghiên cứu

Qua tìm hiểu thực tế hoạt động kinh doanh lưu trú tại Việt Nam, các cơ sở quy mô vừa và nhỏ như khách sạn mini, nhà nghỉ, homestay (khoảng 5 đến 50 phòng mỗi cơ sở) chiếm trên 70% số lượng cơ sở trên thị trường. Phần lớn các đơn vị này vẫn đang quản lý lịch phòng bằng sổ tay, file Excel hoặc ghi nhận đặt phòng rời rạc qua tin nhắn Zalo, Facebook. Cách vận hành thủ công làm phát sinh bốn khó khăn chính:

1. **Dễ trùng lịch phòng (double-booking) và lệch trạng thái dọn phòng:** Khi lễ tân tại quầy và kênh đặt phòng trực tuyến cùng tiếp nhận khách vào giờ cao điểm mà không dùng chung dữ liệu phòng trống thời gian thực, cơ sở rất dễ nhận trùng phòng hoặc giao nhầm phòng chưa dọn xong cho khách mới.
2. **Đặc thù khai thác kết hợp thuê theo giờ và thuê qua đêm:** Các phần mềm PMS nước ngoài như Cloudbeds, Mews, Hotelogix hay RoomRaccoon có chi phí sử dụng cao (khoảng 30–500 USD/tháng) và chủ yếu thiết kế theo đơn vị đêm lưu trú. Trong khi đó, cơ sở lưu trú ở Việt Nam thường kinh doanh song song thuê theo giờ, thuê qua đêm và cần khoảng thời gian chờ dọn phòng tối thiểu 30 phút giữa hai lượt khách trên cùng một phòng vật lý.
3. **Khó mở rộng sang nhiều chi nhánh và phân quyền nhân sự chi tiết:** Khi chủ cơ sở mở thêm chi nhánh mới, các công cụ đơn giản không hỗ trợ tách biệt dữ liệu từng chi nhánh trên cùng một hệ thống doanh nghiệp, đồng thời thiếu cơ chế phân quyền chi tiết cho lễ tân, thu ngân hay nhân viên buồng phòng theo đúng phạm vi cơ sở được giao.
4. **Thiếu bản địa hóa và đối soát thu chi minh bạch:** Nhiều giải pháp ngoại chưa hỗ trợ sẵn giao diện tiếng Việt thuận tiện cho nhân viên ca trực, danh mục địa giới hành chính Việt Nam, cổng thanh toán VNPay và chuyển khoản VietQR, cũng như thiếu nhật ký theo dõi khi chỉnh sửa bảng giá phòng hoặc xử lý hoàn tiền cọc tại quầy.

| Tiêu chí thực tế | Phần mềm PMS quốc tế (Cloudbeds, Mews, Hotelogix...) | Quản lý thủ công (Excel, Sổ tay, Zalo) | Hướng giải quyết của đề tài |
| :--- | :--- | :--- | :--- |
| Chi phí cho cơ sở nhỏ | Cao (khoảng 30–500 USD/tháng) | Thấp nhưng tốn công rà soát | Mô hình SaaS linh hoạt theo gói |
| Khai thác chung lịch Giờ + Đêm + Buffer dọn phòng | Hạn chế, thiên về thuê theo đêm | Dễ nhầm lẫn, chồng giờ | Dùng chung một lịch phòng, kiểm tra buffer từ 30 phút |
| Cách ly dữ liệu đa doanh nghiệp và đa chi nhánh | Có hỗ trợ | Không có | Tách biệt dữ liệu theo Tenant và Property, chặn mặc định khi thiếu ngữ cảnh |
| Phân quyền nhân sự theo chi nhánh | Vai trò cố định (trừ gói cao cấp) | Không có | Bitmask RBAC tùy chỉnh theo từng chức năng và chi nhánh |
| Bản địa hóa Việt Nam (VNPay, VietQR, Tiếng Việt, Địa giới VN) | Không tích hợp sẵn | Thao tác rời rạc | Hỗ trợ sẵn VNPay, VietQR, tiếng Việt và danh mục hành chính Việt Nam |

---

## 2. Mục tiêu chung của đề tài

Đề tài hướng tới việc xây dựng **Hotel SaaS Platform v2**, một nền tảng quản lý khách sạn đa chi nhánh theo mô hình phần mềm dịch vụ (SaaS), kết hợp giữa hệ thống quản trị vận hành nội bộ (PMS) và cổng đặt phòng trực tuyến cho khách hàng trên cùng một nguồn tồn phòng thực tế. Hệ thống tập trung giải quyết bài toán vận hành thuê phòng theo giờ và theo đêm tại Việt Nam, bảo đảm tách biệt dữ liệu an toàn giữa các doanh nghiệp và chi nhánh, phân quyền linh hoạt theo vai trò (RBAC) và minh bạch hóa quy trình thanh toán, đối soát.

---

## 3. Các mục tiêu cụ thể

### 3.1. Nghiệp vụ quản lý khách sạn và đặt phòng
* Xây dựng cấu trúc quản trị nhiều tầng từ Doanh nghiệp (`Tenant`) đến từng Chi nhánh (`Property`), cho phép thiết lập danh mục hạng phòng (`RoomType`), phòng vật lý (`Room`), chính sách phụ thu và bảng giá theo khoảng ngày hiệu lực (lưu lịch sử thay đổi giá và giữ nguyên giá chụp tại thời điểm đặt phòng).
* Vận hành đồng bộ hai hình thức thuê theo giờ và thuê qua đêm trên cùng một lịch phòng giữa lễ tân và cổng đặt phòng trực tuyến; áp dụng giữ chỗ tạm thời 15 phút (tự động giải phóng phòng khi quá hạn), kiểm tra khoảng đệm dọn phòng tối thiểu 30 phút giữa hai lượt khách và quản lý chuyển trạng thái buồng phòng theo quy trình (`Dirty -> Cleaning -> Clean`).
* Tích hợp cổng thanh toán trực tuyến **VNPay** (ký kiểm tra `HMAC-SHA512` và cập nhật qua webhook IPN), tạo mã chuyển khoản **VietQR** để thu ngân kiểm tra đối chiếu tại quầy, xuất hóa đơn PDF có gắn mã QR tra cứu đơn phòng, tự tính phí hủy theo mốc thời gian và kiểm soát quy trình duyệt, chi hoàn tiền cọc không bị chi trùng.
* Hỗ trợ người dùng tìm phòng bằng câu hỏi tiếng Việt và gợi ý điều chỉnh giá dựa trực tiếp trên dữ liệu tồn phòng và bảng giá thực tế trong cơ sở dữ liệu.

### 3.2. Kiến trúc phần mềm, phân quyền và an toàn dữ liệu
* Thiết kế hệ thống theo kiến trúc Clean Architecture kết hợp mô hình CQRS trên nền tảng **.NET 10**, cơ sở dữ liệu **PostgreSQL 17**, cập nhật thông báo thời gian thực qua **SignalR** và giao diện web **Angular 22** tương thích cả máy tính quầy lễ tân lẫn điện thoại của nhân viên buồng phòng.
* Cách ly dữ liệu giữa các doanh nghiệp và chi nhánh theo `TenantId` và `PropertyId` từ tầng Middleware đến `EF Core Query Filter` và `SaveChangesInterceptor`, bảo đảm từ chối mặc định mọi yêu cầu thiếu ngữ cảnh hợp lệ.
* Triển khai cơ chế phân quyền **Bitmask RBAC** cho phép chủ khách sạn tùy chỉnh quyền chi tiết theo từng nhóm chức năng và chi nhánh, kết hợp xác thực tài khoản qua Email, Google OAuth và Firebase SMS OTP.
* Kiểm soát xung đột khi nhiều thao tác diễn ra cùng lúc (nhiều khách giữ phòng cuối cùng hoặc hai thu ngân cùng bấm chi hoàn tiền) bằng khóa giao dịch PostgreSQL (`pg_advisory_xact_lock`, `FOR UPDATE`, kiểm soát đồng thời lạc quan), đồng thời ghi lại nhật ký kiểm toán (`Audit Log`) cho các thay đổi nhạy cảm.

### 3.3. Kiểm thử và triển khai thực nghiệm
* Xây dựng bộ kiểm thử tự động gồm Unit Test, Integration Test và các bài kiểm thử cô lập dữ liệu liên chi nhánh, tích hợp chạy tự động trên quy trình GitHub Actions CI/CD.
* Đóng gói hệ thống bằng Docker, triển khai trên máy chủ VPS thử nghiệm công khai kèm ghi log có cấu trúc và công cụ giám sát tình trạng hoạt động của dịch vụ.

---

## 4. Các chỉ số đầu ra hướng tới (KPIs)

| STT | Hạng mục đo lường | Mục tiêu đề ra | Cách thức kiểm chứng |
| :-: | :--- | :--- | :--- |
| 1 | Thời gian đặt giữ phòng trực tuyến | <= 3 phút | Đo từ lúc tìm phòng trống đến khi tạo giữ chỗ thành công trên cổng khách hàng |
| 2 | Thời gian thao tác Check-in / Check-out tại quầy | <= 2 phút | Kiểm tra trên giao diện lễ tân với dữ liệu đơn đặt phòng thực tế |
| 3 | Chống đặt trùng phòng và chi trùng hoàn tiền | Không phát sinh trùng lặp trong kịch bản đồng thời | Kiểm thử đa luồng (`Task.WhenAll`) kết hợp khóa giao dịch PostgreSQL |
| 4 | Thời gian phản hồi API (phân vị P95) | <= 300ms | Đo bằng kịch bản tải (`k6`) và ghi nhận qua log thời gian xử lý |
| 5 | Kiểm thử tự động phân hệ lõi và cô lập chi nhánh | Vượt qua 100% cổng kiểm tra trên CI/CD | Chạy `dotnet test`, Vitest và bộ kiểm thử bảo mật liên chi nhánh |

---

## 5. Giới hạn phạm vi thực hiện

Để tập trung hoàn thiện chiều sâu nghiệp vụ cốt lõi trong thời gian học phần, đề tài xác định rõ các giới hạn sau:
* Không xây dựng đồng bộ tồn phòng hai chiều với các sàn OTA bên ngoài (như Booking.com, Agoda, Traveloka).
* Không phát triển ứng dụng di động gốc riêng cho iOS/Android và chế độ làm việc ngoại tuyến khi mất mạng; thao tác trên thiết bị di động sử dụng giao diện Web Responsive.
* Các tính năng mã khóa phòng thông minh (Smart Lock PIN) và đối soát chuyển khoản VietQR dừng ở mức quản lý vòng đời mã PIN trên phần mềm và xác nhận thu chi tại quầy, chưa kết nối phần cứng khóa từ vật lý hay webhook ngân hàng tự động.
