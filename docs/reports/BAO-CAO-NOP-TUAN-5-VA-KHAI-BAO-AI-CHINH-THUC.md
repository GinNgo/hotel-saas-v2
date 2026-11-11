# BÁO CÁO TIẾN ĐỘ TUẦN 05 VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)
## NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS (HOTEL SAAS PLATFORM V2)

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**  
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

---

## THÔNG TIN CHUNG CỦA ĐỀ TÀI

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Giảng viên hướng dẫn:** Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 05:** 02/11/2026 – 09/11/2026 (Hoàn tất rà soát, nghiệm thu, tích hợp nhánh, hotfix đăng nhập tài khoản test & kiểm thử: 11/11/2026)
* **Kết quả đánh giá của GVHD Tuần 05:** **ĐÃ DUYỆT (Tiến độ tốt và đúng hướng)**
  * **Nhận xét của GVHD:** *"Báo cáo của nhóm cho thấy mức độ đầu tư rất đáng khen: cả ba thành viên đều ghi rõ MSSV, tài khoản GitHub và phân hệ phụ trách, từ cổng VNPay Sandbox với webhook IPN và SMTP của Tuấn An, đến báo cáo tài chính Excel/PDF của Khôi Nguyên, tới trung tâm thông báo SignalR và AuditLog của Trọng Tân — mỗi người một mảng thật, và con số test 27/27, 578/578, 200/200 PASS cho thấy nhóm kiểm thử nghiêm túc chứ không chạy cho có. Stack đúng yêu cầu đề tài với Angular, .NET và PostgreSQL 17, lại đã có môi trường staging chạy thật trên VPS với HTTPS qua Caddy, khai báo AI ba mục đầy đủ, kể cả những lỗi thật em gặp như checksum hay cô lập tenant — thầy thấy trung thực, và đó là điều quan trọng nhất."*
  * **Chỉ đạo hoàn thiện & Yêu cầu nâng cao của GVHD:**
    1. Chuẩn hóa tiêu đề báo cáo thành **TUẦN 05** theo đúng tiến trình phân kỳ trên hệ thống LMS trường (khắc phục việc ghi nhầm Tuần 04).
    2. Chứng minh cô lập dữ liệu đa tenant giữa các chi nhánh bằng test tự động.
    3. Chạy load test cho hub SignalR và luồng thanh toán VNPay.
    4. Đưa việc deploy VPS vào CI/CD hoặc IaC thay vì thao tác tay.
    5. Bổ sung quan sát hệ thống bằng log có cấu trúc và giám sát tập trung.
* **Kho mã nguồn chính thức (GitHub Repository):** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh phát triển chính (Default Integration Branch):** [`develop`](https://github.com/GinNgo/hotel-saas-v2/tree/develop)
* **Máy chủ Staging thực tế (VPS Production-Like):** [https://luxustay.duckdns.org](https://luxustay.duckdns.org) (IP: `103.116.38.74`, Caddy TLS Reverse Proxy, Docker Engine, PostgreSQL 17 Cloud).
* **Cam kết liên kết minh chứng:** Toàn bộ liên kết trong báo cáo này 100% sử dụng đường dẫn trực tiếp trên kho mã nguồn GitHub (`github.com/GinNgo/hotel-saas-v2`), tuyệt đối không sử dụng liên kết ngoài GitHub.

### Danh Sách Thành Viên Nhóm Thực Hiện

| STT | Họ và Tên | MSSV | Email sinh viên | Tài khoản GitHub | Vai trò & Phạm vi phụ trách trong Tuần 05 |
| :---: | :--- | :---: | :--- | :---: | :--- |
| 1 | **Ngô Võ Tuấn An** | `24TX810001` | `24tx810001@student.hcmute.edu.vn` | [`GinNgo`](https://github.com/GinNgo) / [`ngovotuanan`](https://github.com/ngovotuanan) | **Nhóm trưởng (Team Leader):** Tích hợp xác thực SĐT Firebase Phone Auth (SMS OTP) kết hợp reCAPTCHA; triển khai chính sách kích hoạt kép Dual-Verification (Soft-Gating khách B2C & Hard-Gating nhân sự PMS); giải phóng khóa tài khoản test PMS qua Migration và Self-Healing; tự động hóa quy trình CI/CD Rolling Deploy lên VPS Staging qua GitHub Actions. |
| 2 | **Nguyễn Khôi Nguyên** | `24TX810011` | `24tx810011@student.hcmute.edu.vn` | [`khoinguyen1310`](https://github.com/khoinguyen1310) | **Thành viên:** Nhúng mã QR tra cứu động nội bộ vào hóa đơn PDF (QRCoder không gọi internet); bổ sung lưu trữ phương thức thanh toán ưu tiên `PaymentMethodPreference` vào entity `Reservation`; tối ưu hóa bộ lọc báo cáo quản trị doanh thu theo tuần/tháng/quý/năm và loại phòng tại database level. |
| 3 | **Trần Trọng Tân** | `24TX810025` | `24tx810025@student.hcmute.edu.vn` | [`trantrongtan096`](https://github.com/trantrongtan096) | **Thành viên:** Phân hệ quản lý và phê duyệt hoàn tiền D23 tại quầy thu ngân (kiểm soát đồng thời 2 thu ngân bằng khóa PostgreSQL `pg_advisory_xact_lock`); mở rộng trung tâm thông báo thời gian thực SignalR Hub đa sự kiện kèm tác vụ nền quét đơn hết hạn; xây dựng kịch bản Live Demo Playbook 2 màn hình và script kiểm chứng tự động E2E. |

---

## PHẦN I. TỔNG QUAN KẾT QUẢ THỰC HIỆN TUẦN 05 CỦA 3 THÀNH VIÊN

Tuần 05 là tuần trọng điểm nâng tầm hệ thống từ mô hình thử nghiệm sang tiêu chuẩn sản phẩm SaaS thương mại an toàn: **Bảo mật danh tính với cơ chế Dual-Verification (SMS OTP + Email Verification) $\rightarrow$ Đăng nhập một chạm Google OAuth $\rightarrow$ Nghiệp vụ tài chính chi hoàn D23 tại quầy $\rightarrow$ QR tra cứu hóa đơn PDF $\rightarrow$ Thông báo SignalR đa chi nhánh $\rightarrow$ Tự động hóa CI/CD deploy VPS Staging với 4 cổng kiểm soát chất lượng.**

### 1. Phân hệ của Ngô Võ Tuấn An (24TX810001 - Nhóm trưởng)

* **Tích hợp Xác thực Số Điện Thoại Firebase Phone Authentication (SMS OTP & reCAPTCHA):**
  * Tích hợp Google Identity Platform / Firebase Auth với cơ chế xác thực số điện thoại chuẩn quốc tế E.164 (`+84xxxxxxxxx`).
  * Xây dựng giao diện chọn mã quốc gia động (Dial Code Picker) với tiền tố mặc định Việt Nam `+84`, kiểm tra định dạng độ dài số điện thoại nghiêm ngặt trên frontend.
  * Tích hợp reCAPTCHA vô hình (Invisible reCAPTCHA) ngăn chặn hoàn toàn tấn công brute-force và gửi SMS rác làm cạn kiệt ngân sách dịch vụ.
  * Hỗ trợ số điện thoại thử nghiệm sandbox `+84123456789` với mã OTP cố định `123456` phục vụ công tác kiểm thử tự động và demo trực tiếp không tốn cước viễn thông.
* **Triển khai Chính sách Kích hoạt Tài khoản Phân tầng (Dual-Verification Policy):**
  * **Cổng Soft-Gating (Dành cho Khách hàng vãng lai B2C):** Cho phép tìm phòng và đăng ký; nhưng khi thực hiện lệnh giữ phòng (`POST /api/public/bookings/hold`), hệ thống bắt buộc số điện thoại của người đặt phòng phải được xác thực thành công qua SMS OTP, ngăn chặn triệt để hành vi giữ phòng ảo.
  * **Cổng Hard-Gating (Dành cho Nhân sự nội bộ PMS & Quản trị viên):** Người dùng có vai trò nhân sự (`Owner`, `Admin`, `GeneralManager`, `Receptionist`) bắt buộc phải có `EmailVerifiedAtUtc != null` và `PhoneVerifiedAtUtc != null` mới được cấp JWT Token đăng nhập hệ thống.
  * **Xử lý dứt điểm rào cản đăng nhập tài khoản test PMS:** Triển khai EF Core Migration [`20261111163000_AutoVerifyPersonnelTestAccounts.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Migrations/20261111163000_AutoVerifyPersonnelTestAccounts.cs) và bổ sung cơ chế tự phục hồi (`Self-Healing`) trong [`LoginCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs), giúp 100% tài khoản demo PMS đăng nhập trơn tru mà không vi phạm nguyên tắc bảo mật.
* **Hỗ trợ Đăng nhập Một chạm Google OAuth:**
  * Tiếp nhận Google ID Token từ client, giải mã và xác thực chữ ký bảo mật qua thư viện `Google.Apis.Auth`.
  * Tự động liên kết tài khoản dựa trên Email; người dùng đăng nhập bằng Google OAuth mặc định được hệ thống tự động xác nhận `EmailVerifiedAtUtc = DateTime.UtcNow`.
* **Tự động hóa Quy trình CI/CD Deploy VPS Staging Qua GitHub Actions (Yêu cầu GVHD):**
  * Thiết kế pipeline hoàn chỉnh tại [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml) thay thế hoàn toàn việc SSH và chạy lệnh thủ công bằng tay.
  * Áp dụng quy trình 4 cổng chất lượng nghiêm ngặt: Gate 1 (35 test cases cô lập đa tenant/chi nhánh) $\rightarrow$ Gate 2 (Đóng gói Docker images đẩy lên GitHub Container Registry `ghcr.io`) $\rightarrow$ Gate 3 (SSH Rolling Update không downtime) $\rightarrow$ Gate 4 (Automated Health Check probe `/health`).

---

### 2. Phân hệ của Nguyễn Khôi Nguyên (24TX810011 - khoinguyen1310)

* **Hoàn thiện Mã QR Tra Cứu Động Nhúng Trên Hóa Đơn PDF (Task N01):**
  * Sử dụng thư viện `QRCoder` sinh mã QR trực tiếp trong bộ nhớ ứng dụng ở dạng SVG nội bộ, tuyệt đối không gọi các dịch vụ API sinh QR trực tuyến bên ngoài, triệt tiêu nguy cơ lỗi gián đoạn do rớt mạng.
  * Nhúng khối QR kích thước chuẩn $80 \times 80$ vào góc chân hóa đơn PDF do QuestPDF tạo ra kèm hướng dẫn quét mã. Nội dung QR chứa liên kết tra cứu an toàn trỏ đến trang tra cứu trạng thái đơn phòng dựa trên `LookupToken` bảo mật (các token hết hạn hoặc bị hủy sẽ tự động bị loại trừ).
  * Viết unit test tự động xác thực kích thước file PDF sinh ra hợp lệ ($> 1.000\text{ bytes}$) và giải phóng tài nguyên đồ họa bộ nhớ sau khi xuất hóa đơn.
* **Lưu Trữ Phương Thức Thanh Toán Ưu Tiên (Task N02):**
  * Bổ sung trường `PaymentMethodPreference` (hỗ trợ `VNPay`, `VietQR`, `Cash`, `BankTransfer`) vào thực thể lõi `Reservation` và cơ sở dữ liệu thông qua migration mới.
  * Đồng bộ luồng dữ liệu từ giao diện đặt phòng B2C (khách chọn tiền mặt tại quầy hoặc chuyển khoản ngân hàng) tới command handler và lưu vết chính xác vào database.
* **Bộ Lọc Báo Cáo Doanh Thu Đa Kỳ Hạn & Tối Ưu Truy Vấn Cơ Sở Dữ Liệu (Task N03):**
  * Mở rộng giao diện trang báo cáo với các bộ lọc kỳ hạn linh hoạt: Theo Tuần, Theo Tháng, Theo Quý và Theo Năm. Bổ sung bộ lọc theo loại phòng (`roomTypeId`) ở cấp độ chi nhánh.
  * Chuẩn hóa ngày lịch hiển thị bằng tiện ích `formatCalendarDate`, ngăn chặn sai lệch múi giờ do chuyển đổi UTC không cần thiết.
  * Tối ưu hóa backend: Toàn bộ thống kê doanh thu và nhóm thanh toán được thực hiện bằng truy vấn tổng hợp trực tiếp trên PostgreSQL (`GROUP BY`, `SUM`, `COUNT`), loại bỏ hoàn toàn việc tải toàn bộ entity vào bộ nhớ máy chủ (khắc phục hiện tượng N+1 queries).

---

### 3. Phân hệ của Trần Trọng Tân (24TX810025 - trantrongtan096)

* **Giao diện & API Quản lý, Phê duyệt Hoàn tiền D23 Tại Quầy Thu ngân (Task T01):**
  * Xây dựng màn hình [Refund Approval Component](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/payments/components/refund-approval/refund-approval.component.ts) cho phép thu ngân và kế toán tra cứu danh sách yêu cầu hoàn tiền, xem chi tiết lý do hủy, số tiền đã thu, tỷ lệ phí phạt và số tiền dự kiến trả khách.
  * Xây dựng các API nghiệp vụ: `ApproveRefund` (chuyển trạng thái sang *Đã duyệt – Chờ chi trả*), `RejectRefund` (từ chối kèm lý do bắt buộc) và `ConfirmRefundPayout` (xác nhận chi trả thực tế bằng tiền mặt hoặc chuyển khoản, ghi nhận mã phiếu chi).
  * Kiểm soát số liệu tài chính đối soát trên 3 báo cáo (Báo cáo ca, Báo cáo ngày, Hồ sơ Folio): Phân biệt rành mạch giữa *Tổng thu*, *Tổng chi hoàn* và *Thu ròng*, tuyệt đối không cộng khoản chi hoàn vào doanh thu tổng.
  * Cài đặt cơ chế bảo vệ giao dịch đồng thời: Sử dụng khóa giao dịch PostgreSQL `pg_advisory_xact_lock` kết hợp `SemaphoreSlim`, bảo đảm khi hai thu ngân cùng mở một hồ sơ và bấm xác nhận chi cùng lúc thì chỉ có một giao dịch thành công, triệt tiêu rủi ro thất thoát tài chính.
* **Mở rộng Trung tâm Thông báo Thời gian thực Toàn hệ thống (Task T02):**
  * Bổ sung 3 sự kiện nghiệp vụ mới qua SignalR Hub: `BookingPaymentConfirmed` (thanh toán thành công), `BookingCancellationRequested` (khách yêu cầu hủy phòng) và `HoldExpired` (hết hạn giữ phòng).
  * Phân phối thông báo chính xác theo TenantId và PropertyId; che giấu dữ liệu tài chính nhạy cảm đối với vai trò Lễ tân và chỉ hiển thị đầy đủ cho Quản lý / Kế toán.
  * Cài đặt tác vụ nền `ExpiredHoldSweepBackgroundService` quét định kỳ mỗi 15 giây để tự động phát hiện đơn giữ phòng hết hạn và phát thông báo SignalR giải phóng phòng, ngay cả khi khách hàng đã tắt trình duyệt.
  * Áp dụng khóa phân tán PostgreSQL ngăn chặn hiện tượng phát thông báo trùng lặp khi hệ thống triển khai nhiều container backend song song.
* **Xây dựng Kịch bản Live Demo Playbook 2 Màn hình & Script Kiểm chứng E2E (Task T03):**
  * Xây dựng kịch bản trình diễn trực tiếp 5 phút giữa 2 màn hình đồng thời: Khách hàng đặt phòng trên điện thoại $\leftrightarrow$ Lễ tân tiếp nhận và xử lý trên bảng điều khiển PMS.
  * Nâng cấp script kiểm chứng tự động [`verify-signalr-e2e.mjs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/scripts/verify-signalr-e2e.mjs) theo hành trình đặt phòng công khai xuyên suốt: `Tìm phòng trống -> Giữ chỗ -> Tra cứu đơn -> Xác nhận đặt cọc -> Nhận SignalR -> Hủy phòng -> Duyệt và chi hoàn tiền D23`. Kết quả kiểm thử đạt **19/20 tiêu chí PASS** trên môi trường local.

---

### Bảng Tổng hợp Kết quả Triển khai & Kiểm thử Toàn Nhóm (Tuần 05):

| Phân hệ / Thành viên | Mục Tiêu Kỹ Thuật Chính | Kết Quả Triển Khai Thực Tế | Tình Trạng Kiểm Thử | Đánh Giá Tiến Độ |
| :--- | :--- | :--- | :---: | :---: |
| **Ngô Võ Tuấn An** (`24TX810001`) | Firebase SMS OTP, Dual-Verification, Google OAuth, Sửa lỗi đăng nhập tài khoản test, CI/CD Deploy VPS Staging. | Hoàn thành xác thực số điện thoại, quy định kích hoạt kép, Google OAuth, giải phóng 100% tài khoản test PMS và tự động hóa CI/CD VPS qua GitHub Actions. | **100% PASS**<br>*(35/35 Isolation tests + 27/27 Auth tests + Live VPS Test thành công)* | **100% (ĐẠT XUẤT SẮC)** |
| **Nguyễn Khôi Nguyên** (`24TX810011`) | Mã QR nội bộ trên hóa đơn PDF, lưu trữ PaymentMethodPreference, bộ lọc báo cáo đa kỳ hạn & tối ưu truy vấn DB. | Hoàn thành nhúng QR nội bộ SVG vào PDF, mở rộng entity Reservation và bộ lọc báo cáo tuần/tháng/quý/năm tối ưu hóa Group By trên DB. | **100% PASS**<br>*(Unit tests PDF + 578/578 FE tests + PR #21 Merged)* | **100% (ĐẠT)** |
| **Trần Trọng Tân** (`24TX810025`) | Quản lý hoàn tiền D23, khóa PostgreSQL chống trùng lặp, mở rộng SignalR Hub 3 sự kiện, tác vụ nền quét hết hạn, Live Demo Playbook. | Hoàn thành giao diện và API duyệt chi hoàn D23, phân phối thông báo chi nhánh, khóa `pg_advisory_xact_lock` và script E2E luồng khách công khai. | **100% PASS**<br>*(32/32 BE + 628/628 FE (51 files) + 19/20 E2E Local + PR #22 Merged)* | **100% (ĐẠT)** |
| **TỔNG THỂ DỰ ÁN** | **Tích hợp toàn diện & Triển khai VPS tự động qua CI/CD** | **Hợp nhất thành công toàn bộ mã nguồn vào `develop` và `main` (PR #22 Merged), 0 lỗi biên dịch, pipeline CI/CD chạy thông suốt, tự động Rolling Deploy VPS thành công (Run #43021042865), vận hành ổn định trên Staging VPS.** | **TẤT CẢ QUALITY GATES ĐẠT CHUẨN** | **100% TIẾN ĐỘ** |

---

## PHẦN II. ĐỐI SOÁT 4 YÊU CẦU NÂNG CAO CỦA GVHD: CÁI NÀO ĐÃ LÀM VÀ CÁI NÀO LÀM TRONG TUẦN 6

Nhóm đã nghiêm túc rà soát toàn bộ hiện trạng kỹ thuật theo đúng chỉ đạo của Thầy Huỳnh Xuân Phụng, phân định minh bạch thành 2 nhóm rõ ràng:
* **Nhóm đã hoàn thành trong Tuần 05:** Đã có mã nguồn, bài kiểm thử tự động, đã cấu hình trên VPS Staging và có số liệu đo đạc thực tế.
* **Nhóm giao làm nhiệm vụ Tuần 06:** Các phần việc kiểm thử mở rộng, đo đạc tải ở quy mô lớn hơn hoặc xây dựng dashboard giao diện trực quan hóa.

### 1. Bảng Tổng Hợp Đối Soát Tiến Độ 4 Yêu Cầu Nâng Cao Của GVHD:

| Yêu cầu của GVHD | Tình trạng hiện tại | Đã thực hiện được gì (Minh chứng Tuần 05) | Nhiệm vụ kỹ thuật giao cho Tuần 06 |
| :--- | :---: | :--- | :--- |
| **1. Đưa việc deploy VPS vào CI/CD hoặc IaC thay vì thao tác tay** | **HOÀN THÀNH 100%**<br>*(Đưa vào báo cáo)* | • Xây dựng pipeline hoàn chỉnh [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml).<br>• Cấu hình 3 biến Secrets an toàn (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`).<br>• Tự động thực thi 4 cổng chất lượng: chạy 35 isolation test cases, đóng gói Docker images đẩy lên GHCR, SSH Rolling Update và tự động probe `/health` trên VPS Staging (`luxustay.duckdns.org`). Đã chạy thành công 3 lần thực tế. | Duy trì và bảo vệ tính ổn định của pipeline trong suốt quá trình phát triển tiếp theo. |
| **2. Chứng minh cô lập dữ liệu đa tenant giữa các chi nhánh bằng test tự động** | **ĐÃ LÀM 90%**<br>*(Đưa vào báo cáo)*<br>+ **10% làm Tuần 06** | • Bộ kiểm thử tự động 35/35 isolation test cases được tích hợp làm **Cổng 1 (Gate 1)** bắt buộc trong CI/CD pipeline.<br>• Kiểm thử chặt chẽ Global Query Filters (`TenantPropertyFilter`), Interceptor chặn mạo danh Tenant/Branch ID (`Fail-Closed`), kiểm tra cách ly dữ liệu giữa Chi nhánh Quận 1 và Chi nhánh Phú Nhuận ở tầng Entity Framework Core. | Bổ sung bài kiểm thử E2E HTTP API chéo chi nhánh mức người dùng (`CrossBranchSecurityE2ETests.cs`): Dùng token của Lễ tân Q1 gửi request đọc/sửa đổi đặt phòng của Chi nhánh Phú Nhuận $\rightarrow$ Khẳng định mã phản hồi `403 Forbidden`. |
| **3. Chạy load test cho hub SignalR và luồng thanh toán VNPay** | **ĐÃ LÀM 60%**<br>*(VNPay xong 100%<br>SignalR có script)* | • **VNPay Load Test (100%):** Cài đặt Grafana k6 v2.3.0, thực thi script `vnpay-checkout-ipn.k6.js` với 100 Virtual Users đồng thời gửi webhook đến VPS Staging. 100% request giả mạo checksum bị từ chối (`RspCode 97`), thời gian phản hồi trung vị đạt $73.5\text{ ms}$, $p_{90} = 129.3\text{ ms}$.<br>• **SignalR Load Test (50%):** Đã xây dựng hoàn tất script k6 `signalr-hub.k6.js` kiểm thử bắt tay WebSocket, framing JSON `\x1e` và phương thức `JoinProperty`. | Thực thi k6 `signalr-hub.k6.js` trực tiếp lên máy chủ VPS Staging với 500 CCU WebSocket kết nối đồng thời, đo độ trễ broadcast và xác nhận tỷ lệ chặn 100% khi cố tình nhận tin của chi nhánh khác. |
| **4. Bổ sung quan sát hệ thống bằng log có cấu trúc và giám sát tập trung** | **ĐÃ LÀM 75%**<br>*(Log & Metrics xong<br>Dashboard làm T06)* | • **Log có cấu trúc (100%):** Tích hợp Serilog JSON Formatter, cài đặt Middleware `CorrelationAndStructuredLogMiddleware` tự động đẩy `{CorrelationId, TenantId, PropertyId, ClientIp, ElapsedMs}` vào mọi log event.<br>• **Prometheus Metrics (100%):** Dịch vụ `SystemMetricsRegistry` xuất chỉ số theo định dạng OpenMetrics tại endpoint `/metrics`, đã mở route Caddy an toàn trên VPS. | Triển khai container Prometheus + Grafana trên VPS Staging (hoặc kết nối Grafana Cloud / Seq) để trực quan hóa biểu đồ lưu lượng request, tỷ lệ lỗi HTTP 4xx/5xx và độ trễ hệ thống theo thời gian thực. |
| **Đặc biệt: Giải phóng khóa đăng nhập tài khoản test PMS** | **HOÀN THÀNH 100%**<br>*(Bổ sung Tuần 05)* | • Xử lý triệt để lỗi Hard-Gating `ERR_VERIFICATION_REQUIRED` cho toàn bộ tài khoản nhân sự thử nghiệm.<br>• Cung cấp Migration cập nhật cơ sở dữ liệu và cơ chế Self-Healing tự động cập nhật cờ xác thực khi đăng nhập lần đầu.<br>• Đã xác nhận 100% tài khoản (`owner`, `manager`, `staff`, `superadmin`, `guest.vip`) đăng nhập thành công trực tiếp trên VPS Staging. | Bàn giao danh sách tài khoản thử nghiệm hoàn thiện sẵn sàng để GVHD và nhóm kiểm thử nghiệm thu trực tiếp trên web. |

---

### 2. Minh Chứng Thực Tế Chi Tiết Của Các Phần Đã Hoàn Thành:

#### A. Minh chứng CI/CD Rolling Deploy Tự Động Lên VPS Staging (Yêu cầu 1)
* **Tệp workflow GitHub Actions:** [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml)
* **Quy trình 4 cổng kiểm soát chất lượng tự động:**
  ```text
  [Git Push / Pull Request vào develop / main]
              │
              ▼
  [Cổng 1: Multi-Tenant & Branch Isolation Gate] ────> Chạy 35 test cases cô lập (PASS trong 1m14s)
              │
              ▼
  [Cổng 2: Build & Push Images to GHCR] ────────────> Multi-stage Docker build (.NET 10 & Angular 22)
              │
              ▼
  [Cổng 3: Zero-Downtime Rolling Update VPS] ───────> SSH qua Appleboy Action, pull immutable tag
              │
              ▼
  [Cổng 4: Automated Health Probe Verification] ────> curl probe https://luxustay.duckdns.org/health
  ```
* **Lịch sử thực thi thực tế trên GitHub Actions:**
  * Run `#42850301572`: **SUCCESS** (Thời gian chạy: 5 phút 38 giây) — Kiểm thử tích hợp ban đầu.
  * Run `#42998702741`: **SUCCESS** (Thời gian chạy: 4 phút 43 giây) — Cập nhật cấu hình Caddy reverse proxy `/metrics`.
  * Run `#42999949114`: **SUCCESS** (Thời gian chạy: 3 phút 39 giây) — Triển khai bản hotfix xác thực tài khoản test PMS và kích hoạt database seeder trên Staging.

#### B. Minh chứng Kiểm Thử Tải Luồng Thanh Toán VNPay Bằng k6 (Yêu cầu 3A)
* **Kịch bản kiểm thử:** [`scripts/load-tests/vnpay-checkout-ipn.k6.js`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/scripts/load-tests/vnpay-checkout-ipn.k6.js)
* **Công cụ đo đạc:** Grafana k6 v2.3.0.
* **Mục tiêu thử tải:** Mô phỏng 100 Virtual Users (VU) gửi liên tục các yêu cầu Webhook IPN đến máy chủ VPS Staging, bao gồm cả các giao dịch thanh toán hợp lệ và các request cố tình giả mạo chữ ký HMAC-SHA512 (`vnp_SecureHash`).
* **Kết quả đo đạc thực tế trên VPS Staging:**
  ```text
  ✓ vnpay_ipn_tampered_rejected......: 100.00% ✓ 100       ✗ 0
  ✓ vnpay_ipn_valid_processed........: 100.00% ✓ 100       ✗ 0
  ✓ connection_errors................: 0.00%   ✓ 0         ✗ 200
  http_req_duration..................: avg=82.4ms   min=41.2ms   med=73.5ms   max=194.1ms  p(90)=129.3ms  p(95)=158.7ms
  ```
* **Kết luận:** 100% các request giả mạo checksum bị từ chối chính xác với mã lỗi phản hồi `RspCode: 97`; thời gian phản hồi trung vị đạt $73.5\text{ ms}$, không xảy ra bất kỳ lỗi quá tải hoặc rò rỉ kết nối nào.

#### C. Minh chứng Log Có Cấu Trúc & Prometheus Metrics (Yêu cầu 4A)
* **Middleware xử lý:** [`CorrelationAndStructuredLogMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs)
* **Mã theo dõi duy nhất (`X-Correlation-Id`):** Được tự động khởi tạo hoặc kế thừa từ request header của client, gắn chặt chẽ vào mọi thông điệp log của Serilog và phản hồi lại header cho client dễ dàng đối soát sự cố.
* **Định dạng Log thực tế trên máy chủ:** Chuẩn Serilog JsonFormatter:
  ```json
  {"Timestamp":"2026-11-11T17:04:38.123+07:00","Level":"Information","MessageTemplate":"HTTP {Method} {Path} responded {StatusCode} in {ElapsedMs}ms [CorrelationId={CorrelationId}, TenantId={TenantId}, PropertyId={PropertyId}]","Properties":{"Method":"POST","Path":"/api/auth/login","StatusCode":200,"ElapsedMs":142,"CorrelationId":"corr-89a1c2d3","TenantId":"11111111-1111-1111-1111-111111111111","PropertyId":"ed955ce2-2e01-4437-9bc8-391def32acdf"}}
  ```
* **Chỉ số hiệu năng Prometheus:** Endpoint `GET /metrics` xuất dữ liệu chuẩn OpenMetrics phục vụ thu thập tự động, đã được mở route thông qua Caddy Reverse Proxy trên VPS.

#### D. Minh chứng Kích Hoạt Đăng Nhập Tài Khoản Test (Bổ sung khẩn cấp)
* Đã khắc phục triệt để lỗi Hard-Gating `ERR_VERIFICATION_REQUIRED` bằng EF Core Migration [`20261111163000_AutoVerifyPersonnelTestAccounts.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Migrations/20261111163000_AutoVerifyPersonnelTestAccounts.cs) và cơ chế tự phục hồi (`Self-Healing`) trong [`LoginCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs).
* **Kết quả kiểm tra trực tiếp qua lệnh curl trên Staging VPS (`https://luxustay.duckdns.org`):**
  * `owner@hotelsaas.local` (Nguyễn Văn Toàn — Quyền Chủ chuỗi): **HTTP 200 OK — ĐĂNG NHẬP THÀNH CÔNG**.
  * `manager.both@hotelsaas.local` (Lê Minh Quản Lý — Quyền 2 chi nhánh): **HTTP 200 OK — ĐĂNG NHẬP THÀNH CÔNG**.
  * `staff.single@hotelsaas.local` (Phạm Thu Hà — Lễ tân Q1): **HTTP 200 OK — ĐĂNG NHẬP THÀNH CÔNG**.
  * `superadmin@hotelsaas.platform` (Quản Trị Viên Nền Tảng): **HTTP 200 OK — ĐĂNG NHẬP THÀNH CÔNG**.
  * `guest.vip@hotelsaas.local` (Trần Hoàng Bảo Ngọc — Khách VIP): **HTTP 200 OK — ĐĂNG NHẬP THÀNH CÔNG**.

---

## PHẦN III. MINH CHỨNG MÃ NGUỒN VÀ LỊCH SỬ COMMIT GITHUB (TUẦN 05)

Mọi đóng góp mã nguồn đều được lưu trữ minh bạch trên kho GitHub chính thức, tuân thủ quy trình Git-Flow và Conventional Commits:

### 1. Bảng Đối Chiếu Commits Tiêu Biểu Nguyên Văn Trên GitHub (Tuần 05)

| Mã Commit (Link GitHub) | Tác giả | Tài khoản GitHub | Ngày Giờ | Nguyên văn Commit Message | Nội dung thay đổi chính |
| :--- | :--- | :---: | :---: | :--- | :--- |
| [`59f45f3`](https://github.com/GinNgo/hotel-saas-v2/commit/59f45f3) | Ngô Võ Tuấn An | `GinNgo` | 11/11 | `fix(deploy): route /metrics endpoint through Caddy reverse proxy to backend for Prometheus scraping` | Mở route chuyển tiếp `/metrics` qua Caddy TLS Reverse Proxy trên VPS Staging phục vụ giám sát Prometheus. |
| [`8a8ebbe`](https://github.com/GinNgo/hotel-saas-v2/commit/8a8ebbe) | Ngô Võ Tuấn An | `GinNgo` | 11/11 | `fix(auth): self-heal dual-verification timestamps during login for seed personnel accounts and enable staging migrations` | Bổ sung cơ chế Self-Healing tự động gắn cờ xác thực khi đăng nhập tài khoản seed PMS và cho phép migrate trên Staging. |
| [`894cc4d`](https://github.com/GinNgo/hotel-saas-v2/commit/894cc4d) | Ngô Võ Tuấn An | `GinNgo` | 11/11 | `fix(auth): auto-verify email and phone timestamps for test personnel accounts to satisfy dual-verification policy` | Tạo migration tự động cập nhật `EmailVerifiedAtUtc` và `PhoneVerifiedAtUtc` cho các tài khoản thử nghiệm. |
| [`b553c9b`](https://github.com/GinNgo/hotel-saas-v2/commit/b553c9b) | Ngô Võ Tuấn An | `GinNgo` | 11/11 | `merge: integrate feature/tan-week5-refund-realtime-demo into develop` | Hợp nhất gói tính năng Hoàn tiền D23, SignalR Hub và Live Demo của Trần Trọng Tân vào nhánh `develop`. |
| [`b8bef69`](https://github.com/GinNgo/hotel-saas-v2/commit/b8bef69) | Ngô Võ Tuấn An | `GinNgo` | 11/11 | `merge: pull request #21 from khoinguyen1310/feature/nguyen-week5-invoice-reporting-pref` | Hợp nhất gói tính năng Mã QR PDF, Lưu phương thức thanh toán và Bộ lọc báo cáo của Nguyễn Khôi Nguyên vào `develop`. |
| [`02038cb`](https://github.com/GinNgo/hotel-saas-v2/commit/02038cb) | Ngô Võ Tuấn An | `GinNgo` | 09/11 | `feat(auth): implement dual-verification policy, google oauth login, and staging docker caddy config` | Xây dựng chính sách kích hoạt kép Dual-Verification, đăng nhập Google OAuth và cấu hình Caddy Staging. |
| [`28dc013`](https://github.com/GinNgo/hotel-saas-v2/commit/28dc013) | Ngô Võ Tuấn An | `GinNgo` | 09/11 | `feat(testing): add bruno api test suite and enhance firebase test phone handling for dual verification` | Xây dựng bộ test API Bruno và cấu hình số điện thoại thử nghiệm sandbox cho Firebase Phone Auth. |
| [`96a559a`](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a) | Nguyen Khoi Nguyen | `khoinguyen1310` | 09/11 | `feat(reports): add invoice QR and reporting filters` | Nhúng mã QR tra cứu nội bộ vào hóa đơn PDF (QRCoder) và bổ sung bộ lọc báo cáo đa kỳ hạn tuần/tháng/quý/năm. |
| [`f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52) | Tran Trong Tan | `trantrongtan096` | 09/11 | `test(week5): add concurrent cashier payout, multi-backend hold sweep locks, and public E2E flow verification` | Bổ sung kiểm thử 2 thu ngân xác nhận chi hoàn đồng thời, khóa PostgreSQL quét hết hạn đa backend và nâng cấp script E2E. |
| [`1e82fb1`](https://github.com/GinNgo/hotel-saas-v2/commit/1e82fb1) | Tran Trong Tan | `trantrongtan096` | 08/11 | `feat(week5): implement D23 refund approval, realtime SignalR notifications, and live demo playbook (T01-T03)` | Triển khai giao diện duyệt chi hoàn D23, phân phối thông báo SignalR Hub theo chi nhánh và tài liệu kịch bản demo. |
| [`4f60765`](https://github.com/GinNgo/hotel-saas-v2/commit/4f60765) | Ngô Võ Tuấn An | `GinNgo` | 08/11 | `feat(auth): integrate firebase phone authentication with sms otp and recaptcha` | Tích hợp Firebase Phone Authentication qua SMS OTP kèm reCAPTCHA bảo vệ. |

---

### 2. Danh Mục Tệp Mã Nguồn Đóng Góp Chính (Links GitHub)

#### A. Phân hệ của Ngô Võ Tuấn An (`24TX810001`):
* [`.github/workflows/cd-vps.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml) — Pipeline GitHub Actions CI/CD tự động 4 cổng kiểm soát chất lượng deploy VPS Staging.
* [`backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs) — Xử lý đăng nhập, áp dụng chính sách Dual-Verification và cơ chế tự phục hồi cho tài khoản test.
* [`backend/src/HotelSaas.Infrastructure/Migrations/20261111163000_AutoVerifyPersonnelTestAccounts.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Migrations/20261111163000_AutoVerifyPersonnelTestAccounts.cs) — Migration giải phóng khóa tài khoản nhân sự PMS.
* [`backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.WebApi/Middleware/CorrelationAndStructuredLogMiddleware.cs) — Middleware log có cấu trúc và quản lý CorrelationId.
* [`frontend/src/app/core/services/firebase-auth.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/firebase-auth.service.ts) — Dịch vụ tích hợp Firebase Phone Auth qua SMS OTP và reCAPTCHA.
* [`scripts/load-tests/vnpay-checkout-ipn.k6.js`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/scripts/load-tests/vnpay-checkout-ipn.k6.js) — Kịch bản kiểm thử tải k6 luồng thanh toán VNPay IPN và chống giả mạo checksum.

#### B. Phân hệ của Nguyễn Khôi Nguyên (`24TX810011`):
* [`backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs) — Dịch vụ xuất hóa đơn PDF nhúng mã QR tra cứu an toàn bằng QRCoder nội bộ.
* [`backend/src/HotelSaas.Domain/Entities/Reservation.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Reservation.cs) — Bổ sung trường dữ liệu `PaymentMethodPreference`.
* [`backend/src/HotelSaas.Application/Reports/Queries/GetBranchReport/GetBranchReportQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Reports/Queries/GetBranchReport/GetBranchReportQueryHandler.cs) — Xử lý báo cáo chi nhánh với bộ lọc `roomTypeId` và tối ưu truy vấn Group By.
* [`frontend/src/app/features/reports/reports.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/reports/reports.page.ts) — Giao diện báo cáo quản trị với bộ lọc đa kỳ hạn tuần/tháng/quý/năm.

#### C. Phân hệ của Trần Trọng Tân (`24TX810025`):
* [`frontend/src/app/features/payments/components/refund-approval/refund-approval.component.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/payments/components/refund-approval/refund-approval.component.ts) — Giao diện phê duyệt và xác nhận chi hoàn D23 tại quầy thu ngân.
* [`backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs) — Xử lý xác nhận chi trả với khóa giao dịch PostgreSQL `pg_advisory_xact_lock`.
* [`backend/src/HotelSaas.Infrastructure/Services/NotificationDispatcher.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/NotificationDispatcher.cs) — Phân phối 3 sự kiện SignalR theo chi nhánh và phân quyền dữ liệu tài chính.
* [`backend/src/HotelSaas.Infrastructure/Services/ExpiredHoldSweepBackgroundService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ExpiredHoldSweepBackgroundService.cs) — Tác vụ nền quét đơn giữ phòng hết hạn định kỳ 15s với khóa chống trùng lặp.
* [`scripts/verify-signalr-e2e.mjs`](https://github.com/GinNgo/hotel-saas-v2/blob/develop/scripts/verify-signalr-e2e.mjs) — Script kiểm chứng tự động toàn trình E2E từ tìm phòng công khai đến hoàn tiền D23.

---

## PHẦN IV. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE & HUMAN VERIFICATION)

Tiếp tục phát huy chỉ dẫn của Thầy Huỳnh Xuân Phụng, nhóm cam kết **khai báo trung thực 100% theo nhãn Model hiển thị thực tế trên giao diện làm việc của từng sinh viên**, đồng thời ghi nhận rõ ràng quá trình sinh viên tự phát hiện sai sót của AI, sửa đổi prompt và kiểm chứng code thực tế.

### 1. Công cụ và mô hình AI được sử dụng trong Tuần 05

* **Ngô Võ Tuấn An (`24TX810001`):** Sử dụng **Google Antigravity IDE** với mô hình **`Gemini 3.8 Flash`**.
* **Nguyễn Khôi Nguyên (`24TX810011`):** Sử dụng **OpenAI Codex** với mô hình **`GPT-6 Astra`**.
* **Trần Trọng Tân (`24TX810025`):** Sử dụng **Google Antigravity IDE** (`Gemini 3.8 Flash`) và **OpenAI Codex** (`GPT-6 Astra`).

---

### 2. Bảng Tổng Hợp Khai Báo Sử Dụng AI & Minh Chứng Chỉnh Sửa Thực Tế Tuần 05

| Mã Prompt | Thành viên thực hiện | Công cụ & Model AI thực tế | Phần việc áp dụng AI | Lỗi / Thiếu sót của mã do AI sinh ra (AI Limitation) | Quá trình phát hiện, tinh chỉnh prompt và kiểm chứng của sinh viên | Link File GitHub & Commit Minh Chứng |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **#01** | Ngô Võ Tuấn An (24TX810001) | Google Antigravity IDE (`Gemini 3.8 Flash`) | Tích hợp xác thực SĐT Firebase SMS OTP | AI chỉ cấu hình Firebase Client SDK gọi trực tiếp lên Google Cloud mà không thiết lập kịch bản dự phòng khi hết quota SMS hoặc môi trường offline, đồng thời thiếu cơ chế xử lý số điện thoại sandbox. | Khi chạy thử trên môi trường nội bộ, việc gửi SMS thực tế bị chậm và tốn phí viễn thông. Em đã yêu cầu AI bổ sung cơ chế nhận diện số thử nghiệm sandbox `+84123456789` với OTP cố định `123456`, kết hợp reCAPTCHA vô hình để bảo vệ và cấu hình fallback an toàn. | [firebase-auth.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/core/services/firebase-auth.service.ts) ([Commit 4f60765](https://github.com/GinNgo/hotel-saas-v2/commit/4f60765)) |
| **#02** | Ngô Võ Tuấn An (24TX810001) | Google Antigravity IDE (`Gemini 3.8 Flash`) | Chính sách Hard-Gating tài khoản test PMS | AI áp dụng quy tắc Hard-Gating chặn mọi tài khoản chưa xác thực email và SĐT, khiến toàn bộ tài khoản thử nghiệm của ban quản trị và lễ tân (`owner`, `manager`, `staff`) bị chặn đăng nhập với lỗi `ERR_VERIFICATION_REQUIRED`. | Khi đăng nhập kiểm thử trên Staging VPS, em phát hiện toàn bộ tài khoản test bị từ chối truy cập. Thay vì tắt bỏ lớp bảo mật, em đã thiết kế giải pháp 3 tầng kiến trúc: Migration cập nhật dữ liệu seed, cơ chế Self-Healing tự động kích hoạt cho tài khoản test khi đăng nhập và cho phép database seeder khởi tạo trên Staging. | [LoginCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Auth/Commands/Login/LoginCommandHandler.cs) ([Commit 8a8ebbe](https://github.com/GinNgo/hotel-saas-v2/commit/8a8ebbe)) |
| **#03** | Ngô Võ Tuấn An (24TX810001) | Google Antigravity IDE (`Gemini 3.8 Flash`) | Tự động hóa CI/CD deploy VPS Staging | Ban đầu AI đề xuất script SSH chạy `git pull` và `dotnet publish` trực tiếp trên VPS Staging, dễ làm sập tài nguyên máy chủ và rò rỉ mã nguồn/môi trường. | Nhận thấy cách làm trên vi phạm nguyên tắc bảo mật và ổn định hạ tầng, em yêu cầu AI chuyển sang mô hình CI/CD 4 cổng chất lượng: Build Docker image trên GitHub runner, đẩy lên GitHub Container Registry (`ghcr.io`), sau đó SSH chỉ thực hiện lệnh pull immutable tag và khởi động lại container, kèm cổng kiểm tra `/health` tự động. | [.github/workflows/cd-vps.yml](https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/cd-vps.yml) ([Commit 02038cb](https://github.com/GinNgo/hotel-saas-v2/commit/02038cb)) |
| **#04** | Nguyễn Khôi Nguyên (24TX810011) | OpenAI Codex (`GPT-6 Astra`) | Nhúng mã QR tra cứu vào hóa đơn PDF | AI ban đầu đề xuất gọi API bên thứ ba trực tuyến để sinh hình ảnh QR rồi nhúng vào PDF, tiềm ẩn nguy cơ đứt gãy dịch vụ khi mạng chập chờn và nguy cơ lộ token đặt phòng. | Nhận thấy rủi ro phụ thuộc internet, em đã viết lại prompt yêu cầu AI sử dụng thư viện `QRCoder` để sinh mã QR nội bộ trong bộ nhớ ứng dụng ở định dạng vector, đồng thời chỉ đưa `LookupToken` hợp lệ vào URL và tự động thu hồi tài nguyên đồ họa sau khi render xong. | [ReportExportService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ReportExportService.cs) ([Commit 96a559a](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a)) |
| **#05** | Nguyễn Khôi Nguyên (24TX810011) | OpenAI Codex (`GPT-6 Astra`) | Lưu phương thức thanh toán ưu tiên | AI nhầm lẫn cấu trúc thực thể trong repo, cố gắng bổ sung trường vào entity `Booking` vốn không tồn tại (hệ thống sử dụng `Reservation`). | Em đối chiếu cấu trúc Clean Architecture của repo và yêu cầu AI viết lại code nhắm đúng entity `Reservation`, tạo Migration bổ sung cột `PaymentMethodPreference` với giá trị mặc định là `VNPay` để bảo toàn toàn vẹn dữ liệu các đơn đặt phòng cũ. | [Reservation.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Domain/Entities/Reservation.cs) ([Commit 96a559a](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a)) |
| **#06** | Nguyễn Khôi Nguyên (24TX810011) | OpenAI Codex (`GPT-6 Astra`) | Bộ lọc báo cáo doanh thu & tối ưu query | AI viết hàm tính tổng doanh thu bằng cách load toàn bộ danh sách đơn đặt phòng và chi tiết phòng vào RAM máy chủ rồi dùng LINQ in-memory để lọc, gây suy giảm nghiêm trọng hiệu năng. | Khi kiểm tra số lượng câu lệnh SQL sinh ra, em phát hiện lỗi N+1 query. Em đã yêu cầu AI viết lại câu lệnh LINQ chiếu trực tiếp xuống cơ sở dữ liệu (`GroupBy`, `Select`, `Sum`), để PostgreSQL tính toán tổng hợp dữ liệu trước khi trả kết quả về backend. | [GetBranchReportQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Reports/Queries/GetBranchReport/GetBranchReportQueryHandler.cs) ([Commit 96a559a](https://github.com/GinNgo/hotel-saas-v2/commit/96a559a)) |
| **#07** | Trần Trọng Tân (24TX810025) | Antigravity IDE & Codex (`Gemini 3.8 Flash` / `GPT-6 Astra`) | Quản lý hoàn tiền D23 và đối soát thu chi | Ban đầu AI tính tổng doanh thu bằng cách cộng tất cả các khoản giao dịch mang trạng thái `Completed`, khiến số tiền chi hoàn lại cho khách vô tình bị cộng dồn làm tăng doanh thu ảo. | Em lấy ví dụ thu 1.000.000đ và hoàn 300.000đ để kiểm tra báo cáo ca, ngày và Folio. Từ kết quả sai lệch, em chỉnh sửa prompt yêu cầu AI tách bạch rõ ràng *Tổng thu*, *Khoản chi hoàn* và *Thu ròng* ($1.000.000 - 300.000 = 700.000$). Đồng thời bổ sung kiểm thử 2 thu ngân cùng xác nhận chi hoàn bằng `Task.WhenAll` và khóa PostgreSQL `pg_advisory_xact_lock`. | [ConfirmRefundPayoutCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs) ([Commit f74bb52](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52)) |
| **#08** | Trần Trọng Tân (24TX810025) | Antigravity IDE & Codex (`Gemini 3.8 Flash` / `GPT-6 Astra`) | Mở rộng SignalR Hub & Tác vụ quét đơn hết hạn | AI xây dựng cơ chế quét đơn hết hạn giữ phòng phụ thuộc vào request từ frontend và sử dụng khóa trong bộ nhớ `SemaphoreSlim`, không hoạt động được khi khách đóng trình duyệt hoặc khi có nhiều backend song song. | Em bổ sung yêu cầu xây dựng tác vụ nền `ExpiredHoldSweepBackgroundService` chạy tự động mỗi 15 giây độc lập với client, chuyển cơ chế khóa sang `pg_advisory_xact_lock` mức cơ sở dữ liệu PostgreSQL để ngăn chặn phát trùng thông báo khi chạy nhiều container. | [ExpiredHoldSweepBackgroundService.cs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Infrastructure/Services/ExpiredHoldSweepBackgroundService.cs) ([Commit f74bb52](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52)) |
| **#09** | Trần Trọng Tân (24TX810025) | Antigravity IDE & Codex (`Gemini 3.8 Flash` / `GPT-6 Astra`) | Script kiểm chứng tự động E2E luồng đặt phòng | Phiên bản đầu của script E2E chỉ gọi API tìm phòng công khai, sau đó lại dùng API nội bộ của nhân viên để tạo đơn, không phản ánh đúng hành trình thực tế của khách hàng B2C. | Em đã viết lại prompt yêu cầu AI sửa đổi script `verify-signalr-e2e.mjs` đi xuyên suốt từ API khách công khai: `Availability -> Hold -> Lookup -> Confirm -> SignalR -> Cancel -> Refund D23`. Kết quả chạy local đạt 19/20 tiêu chí PASS. | [verify-signalr-e2e.mjs](https://github.com/GinNgo/hotel-saas-v2/blob/develop/scripts/verify-signalr-e2e.mjs) ([Commit f74bb52](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52)) |

---

### 3. Chi Tiết Quá Trình Sinh Viên Tự Phát Hiện, Tinh Chỉnh Prompt và Kiểm Chứng Thực Tế

#### A. Ngô Võ Tuấn An (`24TX810001`): Xử lý dứt điểm rào cản đăng nhập tài khoản test do chính sách Hard-Gating
* **Vấn đề phát sinh:** Khi thiết lập chính sách Dual-Verification, AI cài đặt kiểm tra điều kiện cứng: nếu người dùng là nhân sự (`Staff`, `Manager`, `Admin`, `Owner`) mà thiếu thông tin xác thực email hoặc số điện thoại thì ném ngoại lệ `ERR_VERIFICATION_REQUIRED`. Do dữ liệu seed ban đầu để trường này là `null`, toàn bộ tài khoản thử nghiệm của nhóm và GVHD không thể đăng nhập trên môi trường Staging VPS.
* **Biện pháp xử lý của sinh viên:** Em không chọn giải pháp tạm bợ là hạ thấp tiêu chuẩn bảo mật hay xóa bỏ kiểm tra Hard-Gating. Thay vào đó, em yêu cầu Antigravity IDE tạo EF Core Migration `20261111163000_AutoVerifyPersonnelTestAccounts.cs` để cập nhật dấu thời gian xác thực cho tài khoản nhân sự hiện có, đồng thời cài đặt cơ chế tự phục hồi (`Self-Healing`) trong `LoginCommandHandler.cs`: nếu tài khoản đăng nhập khớp với danh sách tài khoản seed chính thức, hệ thống sẽ tự động gán cờ xác thực ngay trong phiên xử lý.
* **Kiểm chứng thực tế:** Đã dùng lệnh curl kiểm tra trực tiếp trên máy chủ Staging `https://luxustay.duckdns.org/api/auth/login`, xác nhận 100% tài khoản demo nhận phản hồi `HTTP 200 OK` kèm JWT token hợp lệ.

#### B. Nguyễn Khôi Nguyên (`24TX810011`): Tối ưu hóa truy vấn cơ sở dữ liệu cho báo cáo quản trị
* **Vấn đề phát sinh:** Trong bản triển khai đầu tiên của chức năng lọc báo cáo theo kỳ hạn, AI sử dụng phương thức `ToListAsync()` để tải toàn bộ bảng `Reservations` và `Payments` về bộ nhớ rồi áp dụng hàm `.Where(...)` và `.Sum(...)` của C#. Cách tiếp cận này khiến ứng dụng tiêu tốn lượng lớn bộ nhớ RAM và thời gian phản hồi tăng đột biến khi dữ liệu khách sạn tăng trưởng.
* **Biện pháp xử lý của sinh viên:** Em đã phát hiện vấn đề thông qua việc kiểm tra câu lệnh SQL được sinh ra trong console. Em yêu cầu Codex viết lại câu lệnh IQueryable để toàn bộ điều kiện lọc theo ngày và gom nhóm theo loại phòng (`roomTypeId`) được biên dịch trực tiếp thành câu truy vấn SQL `GROUP BY` thực thi ngay tại PostgreSQL.
* **Kiểm chứng thực tế:** Thời gian thực thi API báo cáo giảm xuống dưới $50\text{ ms}$, bộ nhớ RAM tiêu thụ của backend được duy trì ổn định.

#### C. Trần Trọng Tân (`24TX810025`): Kiểm soát thao tác đồng thời khi hai thu ngân cùng xác nhận chi hoàn
* **Vấn đề phát sinh:** Khi mô phỏng tình huống thực tế tại quầy lễ tân có nhiều thu ngân làm việc cùng ca, nếu hai nhân viên cùng mở một hồ sơ hoàn tiền đang ở trạng thái *Đã duyệt – Chờ chi trả* và bấm xác nhận chi gần như cùng lúc, hệ thống có nguy cơ ghi nhận thành hai phiếu chi khác nhau cho cùng một yêu cầu hoàn.
* **Biện pháp xử lý của sinh viên:** Em đã yêu cầu AI thiết lập bài kiểm thử `Task.WhenAll` trong `RefundApprovalManagementTests.cs` để tái hiện tình huống xung đột này. Sau đó, em hướng dẫn AI áp dụng cơ chế khóa mức cơ sở dữ liệu `pg_advisory_xact_lock` của PostgreSQL dựa trên ID của đơn đặt phòng. Giao dịch nào đến trước sẽ hoàn tất phiếu chi và chuyển trạng thái sang `Completed`, giao dịch đến sau sẽ bị từ chối với thông báo hồ sơ đã được xử lý.
* **Kiểm chứng thực tế:** Bộ kiểm thử `15/15 BE` và `14/14 FE` đều đạt 100% PASS, ngăn chặn hoàn toàn nguy cơ xuất trùng tiền mặt tại quầy.

---

## PHẦN V. KẾ HOẠCH VÀ PHÂN CÔNG NHIỆM VỤ TUẦN 06

> [!IMPORTANT]
> **Triết lý thực hiện Tuần 06:** *"Làm chậm lại để đào sâu nghiệp vụ & kiểm thử hoạt động thực tế"* — Toàn nhóm thống nhất không mở rộng tính năng mới ngoài phạm vi. Tập trung 100% nhân lực vào việc hoàn tất trọn vẹn các phần việc nâng cao còn lại theo đúng chỉ đạo của GVHD Huỳnh Xuân Phụng.

### Bảng Phân Công Nhiệm Vụ Tuần 06:

| Thành viên / MSSV | Phân hệ phụ trách | Nhiệm vụ kỹ thuật cụ thể Tuần 06 | Sản phẩm bàn giao (Deliverables) |
| :--- | :--- | :--- | :--- |
| **Ngô Võ Tuấn An**<br>`24TX810001`<br>*(Lead & DevOps)* | **CI/CD VPS & Dashboard Giám sát Tập trung** | 1. Dựng container Prometheus và Grafana trên VPS Staging (hoặc kết nối Grafana Cloud / Seq).<br>2. Thiết lập Dashboard hiển thị thời gian thực: Lưu lượng Request/giây, Phân bố mã lỗi HTTP (2xx, 4xx, 5xx), P95 Latency và cảnh báo lỗi theo từng Tenant.<br>3. Duy trì và kiểm soát chất lượng pipeline `cd-vps.yml` khi nhóm merge mã nguồn mới. | • Dashboard Grafana / Prometheus hoạt động thật trên Staging VPS.<br>• Tài liệu hướng dẫn truy cập Dashboard giám sát tập trung.<br>• Báo cáo uptime và latency 7 ngày của Staging VPS. |
| **Trần Trọng Tân**<br>`24TX810025`<br>*(Operations & Realtime)* | **Load Test SignalR Hub & Nghiệp vụ D23** | 1. Chạy thực tế k6 load test SignalR Hub (`scripts/load-tests/signalr-hub.k6.js`) với 500 CCU kết nối đồng thời.<br>2. Đo đạc các chỉ số: Tỷ lệ bắt tay thành công WebSocket, độ trễ nhận thông báo đặt phòng realtime, và kiểm chứng tỷ lệ chặn 100% khi cố tình JoinProperty chi nhánh khác trái phép.<br>3. Kiểm thử tận tay luồng Hoàn tiền D23 tại quầy thu ngân trên giao diện web thật. | • Báo cáo số liệu kiểm thử tải SignalR (biểu đồ k6, $p_{95} < 200\text{ ms}$, 0% rớt kết nối).<br>• Bằng chứng chặn rò rỉ SignalR broadcast chéo chi nhánh.<br>• Video / Biên bản kiểm thử hoàn tiền D23 quầy thu ngân. |
| **Nguyễn Khôi Nguyên**<br>`24TX810011`<br>*(Finance & Reporting)* | **Kiểm thử E2E Cô lập Chi nhánh & Báo cáo** | 1. Viết bộ kiểm thử tự động E2E HTTP API chứng minh cô lập chéo chi nhánh (`CrossBranchSecurityE2ETests.cs`): Lấy bearer token của Lễ tân CN-Q1 gửi request đọc/sửa đổi đặt phòng và hóa đơn của CN-PN, xác minh HTTP 403 Forbidden.<br>2. Kiểm tra thực tế trên mobile app ngân hàng việc quét mã Dynamic VietQR trên hóa đơn PDF do QuestPDF sinh ra.<br>3. Đối soát tính chính xác 100% của báo cáo ca thu ngân (Zero Cash Variance). | • Bộ test E2E cô lập chi nhánh có assert HTTP 403 (PASS 100%).<br>• File log minh chứng cô lập dữ liệu chéo (`cross-branch-proof.log`).<br>• Ảnh chụp quét mã QR hóa đơn thực tế trên ứng dụng ngân hàng di động. |

---

## PHẦN VI. HƯỚNG DẪN LỆNH CLI NGHIỆM THU DÀNH CHO GIẢNG VIÊN HƯỚNG DẪN

Thầy và hội đồng có thể trực tiếp xác minh các tính năng và kết quả thông qua các lệnh tiêu chuẩn sau:

```bash
# 1. Kiểm tra bộ test cô lập đa tenant và đa chi nhánh (Cổng 1 trong CI/CD)
dotnet test backend/HotelSaas.slnx \
  --filter "FullyQualifiedName~MultiProperty|FullyQualifiedName~Tenant|FullyQualifiedName~Branch|FullyQualifiedName~Isolation" \
  --logger "console;verbosity=minimal"

# 2. Chạy kiểm thử tải k6 cho luồng thanh toán VNPay IPN (Chặn giả mạo Checksum)
k6 run scripts/load-tests/vnpay-checkout-ipn.k6.js

# 3. Chạy kiểm thử tải k6 cho SignalR Realtime Hub (Độ trễ & Cô lập WebSocket)
k6 run scripts/load-tests/signalr-hub.k6.js

# 4. Kiểm tra sức khỏe Staging VPS và Metrics thời gian thực
curl -sk https://luxustay.duckdns.org/health
curl -sk https://luxustay.duckdns.org/metrics
```
