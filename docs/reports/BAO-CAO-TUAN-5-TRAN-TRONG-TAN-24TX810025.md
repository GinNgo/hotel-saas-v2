# BÁO CÁO TIẾN ĐỘ TUẦN 05 VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)
## NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS (HOTEL SAAS PLATFORM V2)

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

---

## THÔNG TIN CHUNG

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Sinh viên thực hiện:** Trần Trọng Tân — MSSV: `24TX810025`
* **Email sinh viên:** `24tx810025@student.hcmute.edu.vn`
* **Tài khoản GitHub:** [`trantrongtan096`](https://github.com/trantrongtan096)
* **Giảng viên hướng dẫn:** ThS. Huỳnh Xuân Phụng (`phunghx@hcmute.edu.vn`)
* **Thời gian thực hiện Tuần 05:** 02/11/2026 – 08/11/2026
* **Kho mã nguồn chính thức (GitHub Repository):** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh phát triển cá nhân:** [`feature/tan-week5-refund-realtime-demo`](https://github.com/GinNgo/hotel-saas-v2/tree/feature/tan-week5-refund-realtime-demo)
* **Nhánh đích của Pull Request:** `develop` (không push trực tiếp `main`)
* **Kế hoạch chi tiết quy chiếu:** [`docs/team/PROMPT-TUAN-5-THUC-THI-NHOM.md`](../team/PROMPT-TUAN-5-THUC-THI-NHOM.md) (Mục 4 — Tasks T01–T03)

---

## PHẦN I. TỔNG QUAN KẾT QUẢ THỰC HIỆN TUẦN 05

1. **T01 — Quản lý và Phê duyệt Hoàn tiền tại quầy thu ngân (Refund Approval — D23):** Tiếp nối chức năng hủy phòng của Tuần 04, em bổ sung màn hình để nhân viên đối chiếu yêu cầu hoàn, duyệt hoặc từ chối, sau đó ghi nhận số tiền thực tế đã trả cho khách.
2. **T02 — Mở rộng Trung tâm Thông báo thời gian thực (SignalR Notifications):** Em bổ sung ba sự kiện cho chuông PMS: thanh toán đã xác nhận, khách yêu cầu hủy phòng và đơn hết hạn giữ chỗ. Mỗi sự kiện được chuyển đến đúng chi nhánh; thông tin tài chính được phân biệt với thông tin tác nghiệp của lễ tân.
3. **T03 — Kịch bản và dữ liệu trình diễn nghiệp vụ (Live Demo Playbook):** Em xây dựng kịch bản trình diễn dự kiến 5 phút trên hai màn hình khách hàng và lễ tân, chuẩn bị dữ liệu mẫu, hướng dẫn xử lý sự cố và script kiểm chứng. Trong quá trình kiểm tra, em đã đối chiếu riêng API tìm phòng công khai và luồng thông báo SignalR phát sinh từ đơn đặt phòng nội bộ. Tuy nhiên, chưa xác nhận được toàn bộ luồng xuyên suốt trên cùng một đơn đặt phòng từ trang khách đến PMS, chưa thực hiện giao dịch VNPay Sandbox bên ngoài và chưa đo thời gian chạy trọn kịch bản.

### Bảng Tổng hợp Kết quả Triển khai & Kiểm thử Tuần 05:

| Mã Task | Phân Hệ Tính Năng | Mục Tiêu & Yêu Cầu Kỹ Thuật | Kết Quả Triển Khai Thực Tế | Kiểm Thử Tự Động | Đánh Giá Tiến Độ |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **T01** | Quản lý và Phê duyệt Hoàn tiền D23 | Xây dựng quy trình duyệt, từ chối và xác nhận chi hoàn tại quầy; phân biệt tiền thu, tiền hoàn và thu ròng; kiểm soát thao tác đồng thời. | Hoàn thành giao diện quản lý hoàn tiền, API duyệt/từ chối/xác nhận chi trả và đối soát báo cáo ca, ngày, Folio. Bổ sung khóa PostgreSQL pg_advisory_xact_lock, SemaphoreSlim và kiểm thử hai thu ngân xác nhận chi hoàn đồng thời. | 100% PASS (15/15 BE + 14/14 FE) | 100% (ĐẠT) |
| **T02** | Mở rộng Trung tâm Thông báo SignalR | Bổ sung thông báo thanh toán thành công, yêu cầu hủy phòng và hết hạn giữ chỗ; bảo đảm cách ly theo Tenant/Property và hạn chế phát sự kiện trùng lặp. | Hoàn thành ba sự kiện SignalR, phân phối thông báo theo chi nhánh và tác vụ nền ExpiredHoldSweepBackgroundService. Bổ sung khóa phân tán PostgreSQL và bài kiểm thử xử lý đồng thời giữa hai backend. | 100% PASS (17/17 BE + 26/26 FE) | 100% (ĐẠT) |
| **T03** | Kịch bản Demo Nghiệp vụ & Kiểm chứng E2E | Xây dựng kịch bản demo hai màn hình, chuẩn bị dữ liệu mẫu và kiểm chứng xuyên suốt quy trình đặt phòng công khai, thông báo lễ tân và hoàn tiền D23. | Hoàn thành bộ tài liệu demo và nâng cấp script E2E. Đã kiểm chứng luồng Tìm phòng → Giữ chỗ → Tra cứu → Xác nhận đặt cọc → SignalR → Hủy phòng → Duyệt và xác nhận chi hoàn D23 trên cùng một đơn công khai. | 19/20 TC PASS (Kiểm thử local; TC-06 VNPay Sandbox chưa kiểm chứng) | ĐẠT (SẴN SÀNG DEMO LOCAL) |
| **TỔNG** | **Hoàn thành ba nhiệm vụ T01–T03** | **Tích hợp nghiệp vụ hoàn tiền, thông báo thời gian thực và kiểm chứng luồng đặt phòng công khai đến PMS.** | Hoàn thành triển khai và kiểm chứng local; bổ sung cơ chế kiểm soát đồng thời, cách ly dữ liệu đa chi nhánh và quy trình phê duyệt, chi hoàn D23. Backend và frontend build thành công. |  100% PASS bộ test đã chạy (600/600 FE thuộc 44 tệp; 32/32 BE thuộc T01–T02). E2E: 19/20 TC PASS. | ĐẠT TRONG PHẠM VI LOCAL (Chờ kiểm chứng TC-06) |

*Nguồn số liệu:* [Biên bản kiểm thử T03, mục 3.1](T03-TEST-RESULTS.md). Trong lần rà soát ngày 09/11, bộ kiểm thử backend gồm 15 bài T01 và 17 bài T02; tổng 600 bài frontend đã bao gồm các bài kiểm thử giao diện của T01–T02, không cộng thêm lần nữa.

*Giới hạn nghiệm thu:* Kịch bản E2E công khai đã được kiểm chứng trên môi trường local. Riêng TC-06 — giao dịch VNPay Sandbox thực tế và Webhook IPN từ Internet vẫn chưa được kiểm chứng. Frontend build thành công nhưng theo lần rà soát trước còn cảnh báo về kích thước bundle và thư viện CommonJS sweetalert2.

---

## PHẦN II. NỘI DUNG VÀ GIẢI PHÁP KỸ THUẬT CHI TIẾT

### 1. Task T01 — Giao diện Quản lý và Phê duyệt Hoàn tiền D23 tại Quầy Thu ngân

* **Từ yêu cầu hủy phòng đến hồ sơ chi hoàn:**
  * Tiếp nối chức năng hủy đặt phòng B2C của Tuần 04, em bổ sung [màn hình duyệt hoàn tiền](../../frontend/src/app/features/payments/components/refund-approval/refund-approval.component.ts) để nhân viên thu ngân tra cứu các yêu cầu hoàn tiền, xem mã đặt phòng, số tiền đã thu, phí hủy và số tiền dự kiến trả khách.
  * Tại trang chi tiết, người có quyền có thể thực hiện **Phê duyệt** hoặc **Từ chối** yêu cầu. Trường hợp từ chối phải nhập lý do; nếu được phê duyệt, hồ sơ chuyển sang trạng thái **Đã duyệt – Chờ chi trả**, chưa được tính là khách đã nhận tiền.

* **Ghi nhận việc chi trả và phân quyền nghiệp vụ:**
  * Sau khi thực hiện chi trả thực tế bằng tiền mặt hoặc chuyển khoản, nhân viên chọn phương thức và nhập mã phiếu chi/mã giao dịch. API `confirm-payout` xác nhận khoản chi đã thực hiện và cập nhật trạng thái hồ sơ sang `Completed`, không tự động chuyển tiền qua ngân hàng.
  * API tra cứu yêu cầu hoàn tiền sử dụng quyền `PAYMENTS:Read`; các thao tác phê duyệt, từ chối và xác nhận chi trả yêu cầu `PAYMENTS:Approve`. Backend tiếp tục kiểm tra quyền truy cập theo phạm vi Tenant và chi nhánh, không chỉ phụ thuộc vào điều kiện hiển thị trên frontend.

* **Đối soát số tiền trên báo cáo ca, ngày và Folio:**
  * Em sử dụng cùng một trường hợp để đối chiếu kết quả trên cả ba báo cáo: quầy thu **1.000.000 đồng**, sau đó chi hoàn **300.000 đồng**. Khi hồ sơ mới được duyệt, tổng chi hoàn vẫn là **0 đồng**. Sau khi xác nhận chi, tổng thu giữ nguyên **1.000.000 đồng**, tổng chi hoàn là **300.000 đồng**, còn thu ròng là **700.000 đồng**.
  * Cách xử lý này giúp phân biệt rõ tiền khách đã thanh toán, số tiền thực tế đã hoàn trả và doanh thu ròng, tránh tình trạng cộng khoản chi hoàn vào tổng doanh thu của khách sạn.

* **Kiểm soát hai thu ngân xác nhận chi hoàn đồng thời:**
  * Trong quá trình rà soát, em nhận thấy cần kiểm soát tình huống hai thu ngân cùng mở một hồ sơ đang chờ chi trả và thực hiện xác nhận gần như đồng thời. Nếu không xử lý phù hợp, hệ thống có nguy cơ ghi nhận trùng một khoản hoàn tiền.
  * Em bổ sung khóa giao dịch PostgreSQL `pg_advisory_xact_lock` kết hợp `SemaphoreSlim` để kiểm soát các yêu cầu xác nhận chi hoàn đồng thời.
  * [Bộ kiểm thử hoàn tiền](../../backend/tests/HotelSaas.Application.Tests/Payments/RefundApprovalManagementTests.cs) được bổ sung trường hợp sử dụng `Task.WhenAll` để mô phỏng hai thu ngân cùng xác nhận một hồ sơ. Theo kết quả kiểm thử local mới, **15/15 bài backend và 14/14 bài frontend đạt yêu cầu**.

---

### 2. Task T02 — Mở rộng Trung tâm Thông báo Thời gian thực Toàn hệ thống

* **Phân phối ba sự kiện nghiệp vụ qua SignalR:**
  * `BookingPaymentConfirmed`: Khi backend xác nhận thanh toán thành công, hệ thống gửi thông báo đến nhân viên tại đúng chi nhánh. Lễ tân nhận thông tin phục vụ xử lý đặt phòng; nhóm quản lý có thẩm quyền được nhận thêm thông tin tài chính.
  * `BookingCancellationRequested`: Khi khách gửi yêu cầu hủy phòng, lễ tân nhận thông báo để cập nhật nghiệp vụ, trong khi nhóm quản lý có thể theo dõi hồ sơ và khoản hoàn tiền dự kiến.
  * `HoldExpired`: Khi đơn giữ chỗ chưa thanh toán hết thời hạn, hệ thống phát thông báo đến chi nhánh liên quan để nhân viên biết phòng đã được giải phóng.

* **Tự động phát hiện đơn giữ chỗ hết hạn:**
  * Em bổ sung [`ExpiredHoldSweepBackgroundService`](../../backend/src/HotelSaas.Infrastructure/Services/ExpiredHoldSweepBackgroundService.cs) để backend chủ động kiểm tra các đơn giữ phòng hết hạn, kể cả khi khách đã đóng trình duyệt hoặc không còn mở trang giữ chỗ.
  * Tác vụ nền mặc định thực hiện quét mỗi **15 giây**. Đây là chu kỳ kiểm tra của server, không phải thời hạn giữ phòng **15 phút** của khách.
  * Khi phát hiện đơn hết hạn hợp lệ, hệ thống thực hiện xử lý thông qua `CheckExpiredHoldsCommand` và phát sự kiện `HoldExpired` qua SignalR, không cần chờ thao tác từ frontend.

* **Kiểm soát phát thông báo trùng lặp khi chạy nhiều backend:**
  * Cơ chế ban đầu sử dụng `SemaphoreSlim` để đồng bộ các lượt quét trong cùng một tiến trình. Tuy nhiên, khi hệ thống triển khai nhiều backend độc lập, khóa trong bộ nhớ không đủ để phối hợp giữa các tiến trình.
  * Em bổ sung khóa giao dịch PostgreSQL `pg_advisory_xact_lock` nhằm kiểm soát việc nhiều backend cùng xử lý một đơn giữ phòng hết hạn.
  * Bộ kiểm thử được mở rộng thêm trường hợp hai backend quét đồng thời, thay vì chỉ kiểm tra hai lượt quét trong cùng tiến trình. Theo kết quả kiểm thử local, cơ chế mới đáp ứng tình huống đồng thời đã xây dựng trong bài kiểm thử.

* **Cách ly dữ liệu và cập nhật thông báo trên PMS:**
  * Hệ thống phân phối thông báo theo Tenant/Property để nhân viên chỉ nhận sự kiện thuộc phạm vi được cấp quyền. Các bản tin dành cho lễ tân được che thông tin tài chính như số tiền thanh toán, phương thức thanh toán và khoản hoàn dự kiến.
  * Em duy trì khả năng cập nhật chuông thông báo, badge chưa đọc và danh sách sự kiện bằng Angular Signals mà không cần người dùng nhấn F5. Khi nhấn vào thông báo, nhân viên có thể điều hướng đến hồ sơ đặt phòng hoặc yêu cầu hoàn tiền liên quan.
  * Theo kết quả kiểm thử mới, **17/17 bài backend và 26/26 bài kiểm thử giao diện chuông PMS đạt yêu cầu**, bao gồm các trường hợp phân phối đúng chi nhánh, bảo vệ dữ liệu và xử lý đồng thời.

---

### 3. Task T03 — Xây dựng Kịch bản và Dữ liệu Trình diễn Nghiệp vụ

* **Chuẩn bị kịch bản trình diễn hai màn hình:**
  * Em xây dựng kịch bản demo dự kiến **5 phút**, sử dụng hai màn hình độc lập: màn hình khách hàng thao tác trên trang đặt phòng B2C và màn hình nhân viên lễ tân theo dõi nghiệp vụ trên PMS.
  * Nội dung trình diễn tập trung vào việc theo dõi cùng một đơn đặt phòng, từ lúc khách tìm phòng, giữ chỗ, xác nhận đặt cọc đến khi lễ tân nhận thông báo và quản lý xử lý yêu cầu hoàn tiền.
  * Em chuẩn bị bộ tài liệu gồm [kịch bản demo](T03-LIVE-DEMO-PLAYBOOK.md), [checklist dữ liệu mẫu](T03-SEED-DATA-CHECKLIST.md), [hướng dẫn xử lý sự cố](T03-TROUBLESHOOTING.md) và [biên bản kiểm thử](T03-TEST-RESULTS.md).

* **Nâng cấp script kiểm chứng E2E theo luồng khách công khai:**
  * Trong phiên bản đầu, script `verify-signalr-e2e.mjs` chỉ kiểm tra API tìm phòng công khai, sau đó sử dụng `POST /api/reservations` để tạo đơn nội bộ. Cách kiểm tra này chưa chứng minh được luồng nghiệp vụ xuyên suốt từ trang khách đến PMS.
  * Em điều chỉnh [script kiểm chứng SignalR E2E](../../scripts/verify-signalr-e2e.mjs) để sử dụng các API đặt phòng công khai và tiếp tục xử lý trên cùng một mã đơn.
  * Luồng kiểm chứng mới gồm các bước:
    1. **Tìm phòng:** Gọi `GET /api/public/properties/{slug}/availability` để kiểm tra hạng phòng còn trống và báo giá.
    2. **Giữ chỗ:** Gọi `POST /api/public/bookings/hold` để tạo lượt giữ phòng công khai, không sử dụng JWT của nhân viên.
    3. **Tra cứu:** Sử dụng `LookupToken` gọi `GET /api/public/bookings/{token}` để kiểm tra thông tin và trạng thái `PendingPayment`.
    4. **Xác nhận đặt cọc:** Gọi `POST /api/public/bookings/{token}/confirm` để xác nhận khoản đặt cọc trong môi trường local và chuyển đơn sang `Confirmed`.
    5. **Thông báo SignalR:** Kiểm tra sự kiện `BookingPaymentConfirmed` được gửi đến đúng nhóm quản lý và lễ tân, đồng thời bảo đảm thông tin tài chính được che đối với lễ tân.
    6. **Hủy đặt phòng:** Gọi `POST /api/public/bookings/{token}/cancel` để khách gửi yêu cầu hủy và kiểm tra sự kiện `BookingCancellationRequested`.
    7. **Hoàn tiền D23:** Quản lý tra cứu yêu cầu hoàn tiền, thực hiện phê duyệt và xác nhận đã chi thông qua các API quản lý hoàn tiền.

* **Kết quả kiểm chứng trực tiếp trên môi trường local:**
  * Theo log kiểm thử mới, script đã chạy thành công luồng E2E công khai trên cùng một đơn đặt phòng thử nghiệm `RES-89ZJ7A`.
  * API tìm phòng trả về hạng phòng `Standard Twin (Q1)` với báo giá **1.600.000 đồng**. Sau khi tạo giữ chỗ, hệ thống trả về `LookupToken` và xác nhận trạng thái `PendingPayment`.
  * Bước xác nhận đặt cọc ghi nhận **480.000 đồng** qua API công khai và chuyển trạng thái đơn sang `Confirmed`.
  * **Manager** và **Receptionist** đều nhận đúng một sự kiện `BookingPaymentConfirmed`. Trong đó, Manager nhận thông tin số tiền thanh toán, còn bản tin của Receptionist được che số tiền và phương thức thanh toán.
  * Sau khi khách hủy đơn, hệ thống tiếp tục phát sự kiện `BookingCancellationRequested` đến đúng nhóm nhân viên. Quy trình D23 được thực hiện đến bước phê duyệt và xác nhận khoản chi hoàn **480.000 đồng**.
  * Kết quả trên chứng minh luồng xử lý API và SignalR trong môi trường local; bước xác nhận chi hoàn là ghi nhận nghiệp vụ, không phải thao tác chuyển tiền thật qua ngân hàng.

* **Đối chiếu giao diện và chứng từ trình diễn:**
  * Trong kịch bản hai màn hình, em bổ sung bước kiểm tra trạng thái đặt phòng trên PMS và đối chiếu sơ đồ phòng, bảo đảm phân biệt phòng đã được đặt trước với phòng thực tế đã nhận khách.
  * Hóa đơn thanh toán có thông tin tài chính và VietQR được phân biệt với phiếu xác nhận đặt phòng có mã QR phục vụ tra cứu.
  * Các bước quan sát giao diện, quét mã QR bằng điện thoại và đo thời lượng chạy trọn kịch bản cần được đối chiếu riêng khi thực hiện demo thực tế.

* **Phạm vi nghiệm thu và kết quả kiểm thử:**
  * Theo kết quả kiểm thử local mới, **19/20 tiêu chí kiểm chứng đạt yêu cầu**. Script đã kiểm tra liên tục luồng tìm phòng, giữ chỗ, tra cứu, xác nhận đặt cọc, nhận SignalR, hủy phòng và xử lý hoàn tiền D23.
  * Riêng **TC-06 — thanh toán thẻ thực tế qua VNPay Sandbox và nhận Webhook IPN từ Internet/public tunnel** vẫn ở trạng thái **Chưa kiểm chứng**. Việc xác nhận đặt cọc qua API trong môi trường local không được xem là giao dịch VNPay Sandbox thành công.
  * Kết quả kiểm thử tổng hợp được báo cáo là **600/600 bài frontend** thuộc 44 tệp và **32/32 bài backend** thuộc hai bộ kiểm thử T01–T02.
  * Các thay đổi script, bài kiểm thử và biên bản mới đang được lưu tại working tree local. Cần commit, push và cập nhật liên kết minh chứng GitHub trước khi nộp báo cáo chính thức.

---


## PHẦN III. MINH CHỨNG MÃ NGUỒN VÀ LIÊN KẾT COMMIT GITHUB

### 1. Bảng Đối chiếu Commit và Trạng thái Bàn giao (Tuần 05)

| Mã Commit (Link GitHub) | Tác giả | Tài khoản GitHub | Ngày Giờ | Nguyên văn Commit Message | Nội dung thay đổi chính |
| :--- | :--- | :---: | :---: | :--- | :--- |
| [`1e82fb1`](https://github.com/GinNgo/hotel-saas-v2/commit/1e82fb1672278596e15dc57c97d4f61fca595178) | Tan | `trantrongtan096` | 08/11/2026, 09:05 (UTC+7) | `feat(week5): implement D23 refund approval, realtime SignalR notifications, and live demo playbook (T01-T03)` | Triển khai ban đầu chức năng duyệt và chi hoàn D23 (T01), mở rộng thông báo SignalR (T02), bổ sung tài liệu và script demo (T03). |
| [`65951f6`](https://github.com/GinNgo/hotel-saas-v2/commit/65951f665f52b84cdef7400461c8c7d849cf1185) | Tan | `trantrongtan096` | 08/11/2026, 09:08 (UTC+7) | `docs(reports): update Week 5 report with commit SHA and GitHub evidence links` | Cập nhật báo cáo cá nhân Tuần 05, bổ sung mã commit và liên kết minh chứng GitHub. |
| [`e1cc3ac`](https://github.com/GinNgo/hotel-saas-v2/commit/e1cc3ac8e61957db47bfceaa8b75b8051d56e10d) | Tan | `trantrongtan096` | 09/11/2026, 09:20 (UTC+7) | `Update BAO-CAO-TUAN-5-TRAN-TRONG-TAN-24TX810025.md` | Điều chỉnh nội dung báo cáo, làm rõ phạm vi kiểm thử và những trường hợp chưa nghiệm thu thực tế. |
| [`f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c) | Tan | `trantrongtan096` | 09/11/2026, 09:47 (UTC+7) | `test(week5): add concurrent cashier payout, multi-backend hold sweep locks, and public E2E flow verification` | Bổ sung kiểm thử hai thu ngân xác nhận chi hoàn đồng thời (T01), khóa PostgreSQL và kiểm thử quét hết hạn đa backend (T02), nâng cấp script E2E theo luồng đặt phòng công khai (T03). |

Em triển khai và bàn giao ba nhiệm vụ T01–T03 trên nhánh cá nhân `feature/tan-week5-refund-realtime-demo` qua nhiều commit. Sau khi hoàn thành chức năng ban đầu, em tiếp tục rà soát mã nguồn, bổ sung các trường hợp kiểm thử đồng thời và nâng cấp script kiểm chứng E2E. Các liên kết bên dưới sử dụng phiên bản commit `f74bb52` để đối chiếu mã nguồn đã cập nhật tại thời điểm bàn giao.

---

### 2. Danh mục Tệp Mã Nguồn Cốt Lõi đã Đóng Góp

#### A. Phân hệ Phê duyệt và Chi hoàn tại quầy (Task T01)

* **Giao diện quản lý hoàn tiền:**
  * [`refund-approval.component.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/frontend/src/app/features/payments/components/refund-approval/refund-approval.component.ts) — hiển thị danh sách yêu cầu hoàn tiền, thông tin chi tiết và các thao tác duyệt, từ chối, xác nhận đã chi.
  * [`refund-approval.component.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/frontend/src/app/features/payments/components/refund-approval/refund-approval.component.spec.ts) — kiểm thử hành vi giao diện và trạng thái xử lý yêu cầu hoàn tiền.

* **Xử lý nghiệp vụ tại backend:**
  * [`ApproveRefundCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Application/Payments/Commands/ApproveRefund/ApproveRefundCommandHandler.cs) — xử lý phê duyệt yêu cầu hoàn tiền.
  * [`RejectRefundCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Application/Payments/Commands/RejectRefund/RejectRefundCommandHandler.cs) — xử lý từ chối yêu cầu hoàn tiền và ghi nhận lý do.
  * [`ConfirmRefundPayoutCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs) — xác nhận khoản chi hoàn thực tế và kiểm soát các yêu cầu xử lý đồng thời.

* **Đối soát số tiền trên báo cáo:**
  * [`GetShiftReportQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs), [`GetPaymentSummaryQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Application/Payments/Queries/GetPaymentSummary/GetPaymentSummaryQueryHandler.cs) và [`GetFolioQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs) — phân biệt tổng thu, khoản đã chi hoàn và thu ròng.

* **Minh chứng kiểm thử:**
  * [`RefundApprovalManagementTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/tests/HotelSaas.Application.Tests/Payments/RefundApprovalManagementTests.cs) — kiểm tra phân quyền, trạng thái hoàn tiền, số liệu báo cáo và trường hợp hai thu ngân đồng thời xác nhận chi hoàn bằng `Task.WhenAll`.
  * **Kết quả kiểm thử local được ghi nhận:** 15/15 bài backend và 14/14 bài frontend đạt yêu cầu.

#### B. Phân hệ Thông báo Thời gian thực (Task T02)

* **SignalR Hub và phân phối thông báo:**
  * [`NotificationHub.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Infrastructure/Hubs/NotificationHub.cs) — quản lý kết nối và phân nhóm người nhận theo phạm vi chi nhánh.
  * [`NotificationDispatcher.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Infrastructure/Services/NotificationDispatcher.cs) — phát các sự kiện `BookingPaymentConfirmed`, `BookingCancellationRequested` và `HoldExpired` đến nhóm nhân viên phù hợp.

* **Tự động kiểm tra đơn giữ phòng hết hạn:**
  * [`ExpiredHoldSweepBackgroundService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Infrastructure/Services/ExpiredHoldSweepBackgroundService.cs) — tác vụ nền kiểm tra các đơn giữ phòng hết hạn theo chu kỳ.
  * [`CheckExpiredHoldsCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Application/Public/Commands/CheckExpiredHolds/CheckExpiredHoldsCommand.cs) — xử lý đơn hết hạn, ghi nhận mốc thông báo và bổ sung cơ chế khóa giao dịch PostgreSQL khi nhiều backend cùng thực hiện quét.

* **Giao diện thông báo trên PMS:**
  * [`notification.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/frontend/src/app/core/services/notification.service.ts) và [`notification-bell.component.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/frontend/src/app/shared/components/notification-bell/notification-bell.component.ts) — nhận thông báo, cập nhật bộ đếm chưa đọc và hiển thị dữ liệu thời gian thực.

* **Minh chứng kiểm thử:**
  * [`NotificationHubSecurityTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/tests/HotelSaas.Application.Tests/Notifications/NotificationHubSecurityTests.cs) — kiểm tra cách ly thông báo theo chi nhánh, lọc dữ liệu nhạy cảm và mô phỏng hai backend sử dụng hai DbContext độc lập để quét đơn hết hạn.
  * **Kết quả kiểm thử local được ghi nhận:** 17/17 bài backend và 26/26 bài kiểm thử giao diện chuông thông báo đạt yêu cầu.

#### C. Kịch bản và Dữ liệu Trình diễn (Task T03)

* **Tài liệu chuẩn bị trình diễn:**
  * [Kịch bản demo hai màn hình](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/docs/reports/T03-LIVE-DEMO-PLAYBOOK.md) — trình tự thao tác dự kiến giữa khách hàng và nhân viên PMS.
  * [Checklist dữ liệu mẫu](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/docs/reports/T03-SEED-DATA-CHECKLIST.md) — thông tin khách sạn, tài khoản và dữ liệu phục vụ kiểm thử.
  * [Hướng dẫn xử lý sự cố](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/docs/reports/T03-TROUBLESHOOTING.md) — phương án xử lý các sự cố có thể phát sinh trong quá trình demo.

* **Script và biên bản kiểm chứng:**
  * [`verify-signalr-e2e.mjs`](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/scripts/verify-signalr-e2e.mjs) — kiểm chứng luồng đặt phòng công khai, xác nhận đặt cọc, thông báo SignalR, hủy phòng và xử lý hoàn tiền D23 trên cùng một đơn.
  * [Biên bản kết quả kiểm thử T03](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/docs/reports/T03-TEST-RESULTS.md) — tổng hợp kết quả kiểm thử frontend, backend và các tiêu chí trong kịch bản demo.

* **Kết quả kiểm chứng:**
  * Theo kết quả chạy local được ghi nhận, script E2E đã thực hiện thành công luồng từ tìm phòng công khai đến xác nhận chi hoàn D23.
  * Ma trận kiểm thử ghi nhận **19/20 tiêu chí PASS**. Riêng **TC-06 — thanh toán VNPay Sandbox thực tế và nhận IPN từ Internet** chưa được kiểm chứng.
  * Tổng hợp hai bộ kiểm thử backend T01–T02 đạt **32/32 bài**; toàn bộ 44 tệp kiểm thử frontend đạt **600/600 bài**.
  * Các kết quả trên phản ánh phạm vi kiểm thử local, không đồng nghĩa với việc đã nghiệm thu giao dịch ngân hàng thực tế hoặc hoàn thành buổi demo hai màn hình trong đúng 5 phút.

---

### 3. Tổng hợp Minh chứng và Trạng thái Bàn giao

* **Nhánh phát triển:** `feature/tan-week5-refund-realtime-demo`.
* **Commit triển khai ban đầu:** [`1e82fb1`](https://github.com/GinNgo/hotel-saas-v2/commit/1e82fb1672278596e15dc57c97d4f61fca595178).
* **Commit bổ sung kiểm thử và E2E công khai:** [`f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c).
* **Trạng thái bàn giao:** Mã nguồn và tài liệu đã được push lên nhánh cá nhân. Chưa mặc định xem các thay đổi này là đã merge vào `develop`.
* **Giới hạn nghiệm thu:** Cần tiếp tục kiểm chứng VNPay Sandbox qua Internet và đối chiếu các bước thao tác thực tế trong buổi demo.

Các liên kết minh chứng sử dụng mã commit cố định để bảo đảm người đọc có thể mở đúng phiên bản mã nguồn đã được kiểm tra, kể cả khi nhánh phát triển tiếp tục có thay đổi.

---


## PHẦN IV. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE & HUMAN VERIFICATION)

### 1. Công cụ và Mô hình AI Sử dụng trong Tuần 05

Trong Tuần 05, em tiếp tục sử dụng **Google Antigravity IDE** và **OpenAI Codex** để hỗ trợ thực hiện ba nhiệm vụ được phân công. Hai công cụ được sử dụng ở những công đoạn khác nhau: Antigravity IDE chủ yếu hỗ trợ triển khai chức năng, chỉnh sửa mã nguồn và bổ sung bài kiểm thử; Codex được dùng để rà soát lại cách xử lý nghiệp vụ, kiểm tra những trường hợp còn thiếu và đối chiếu kết quả với yêu cầu của kế hoạch tuần.

Các model được khai báo theo thông tin ghi nhận trong quá trình sử dụng:

* **Google Antigravity IDE:** `Gemini 3.8 Flash`.
* **OpenAI Codex:** `GPT-6 Astra`.

Hai hình ảnh bên dưới được sử dụng lại từ báo cáo Tuần 04 nhằm minh họa công cụ và model đã khai báo, không phải ảnh chụp phiên làm việc mới của Tuần 05.

> **1. Giao diện Google Antigravity IDE — Model: `Gemini 3.8 Flash`**
>
> ![Giao diện Antigravity IDE đã dẫn trong báo cáo Tuần 04](images/image-2.png)

> **2. Giao diện OpenAI Codex — Model: `GPT-6 Astra`**
>
> ![Giao diện Codex đã dẫn trong báo cáo Tuần 04](images/image-1.png)

* **Sinh viên thực hiện:** Trần Trọng Tân (`24TX810025`).
* **Nhiệm vụ phụ trách:** T01 — Quản lý hoàn tiền D23; T02 — Mở rộng thông báo SignalR; T03 — Kịch bản và kiểm chứng E2E.
* **Phạm vi sử dụng AI:** Hỗ trợ lập trình, phân tích nghiệp vụ, tạo và chỉnh sửa bài kiểm thử, rà soát mã nguồn, xây dựng script kiểm chứng và hoàn thiện tài liệu kỹ thuật.

AI giúp em rút ngắn thời gian triển khai, nhất là đối với những phần cần xử lý nhiều lớp từ frontend đến backend. Tuy nhiên, có những trường hợp mã nguồn chạy được nhưng kết quả chưa đúng nghiệp vụ, hoặc bài kiểm thử chưa bao phủ hết tình huống thực tế. Đây là những phần em phải kiểm tra lại và điều chỉnh trong quá trình thực hiện.

---

### 2. Bảng Tổng Hợp Khai Báo Sử Dụng AI & Minh Chứng Chỉnh Sửa Thực Tế Tuần 05

| Mã Prompt | Thành viên thực hiện | Công cụ & Model AI thực tế | Phần việc áp dụng AI | Lỗi / Thiếu sót của bản đầu | Quá trình phát hiện, tinh chỉnh prompt và kiểm chứng của sinh viên | Mã nguồn và Commit sau chỉnh sửa |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **#01** | Trần Trọng Tân (24TX810025) | Antigravity IDE (`Gemini 3.8 Flash`); Codex (`GPT-6 Astra`) | Quản lý hoàn tiền và đối soát thu/chi D23 (T01) | Phần tổng hợp doanh thu ban đầu chưa phân biệt tiền thu với khoản đã chi hoàn, dẫn đến nguy cơ cộng tiền trả khách vào tổng thu. Một số dữ liệu mẫu `null` còn gây lỗi biên dịch test frontend. Chức năng cũng chưa có bài kiểm thử hai thu ngân xác nhận chi đồng thời. | Em lấy trường hợp thu 1.000.000 đồng rồi hoàn 300.000 đồng để kiểm tra ba báo cáo ca, ngày và Folio. Từ kết quả đối chiếu, em điều chỉnh yêu cầu gửi AI để sửa cách tính. Sau khi xử lý lỗi dữ liệu mẫu và chạy lại test frontend, em tiếp tục bổ sung tình huống hai thu ngân cùng xác nhận chi hoàn bằng `Task.WhenAll` và khóa giao dịch PostgreSQL. Bộ kiểm thử mới ghi nhận **15/15 BE và 14/14 FE PASS**. | [RefundApprovalManagementTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/tests/HotelSaas.Application.Tests/Payments/RefundApprovalManagementTests.cs) · [ConfirmRefundPayoutCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Application/Payments/Commands/ConfirmRefundPayout/ConfirmRefundPayoutCommandHandler.cs) · [Commit `f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c) |
| **#02** | Trần Trọng Tân (24TX810025) | Antigravity IDE (`Gemini 3.8 Flash`); Codex (`GPT-6 Astra`) | Thông báo SignalR và tự động xử lý đơn hết hạn (T02) | AI xây dựng API kiểm tra đơn hết hạn nhưng chưa giải quyết việc tự chạy khi khách đóng trang. Cơ chế khóa `SemaphoreSlim` chỉ có tác dụng trong một tiến trình, chưa đủ khi nhiều backend cùng xử lý. | Vấn đề xuất hiện khi em đặt tình huống khách rời trang giữ chỗ nhưng nhân viên vẫn phải nhận thông báo lúc đơn hết hạn. Em bổ sung yêu cầu chạy tác vụ nền và kiểm tra việc gửi sự kiện đúng chi nhánh. Khi rà soát khả năng mở rộng nhiều backend, em tiếp tục điều chỉnh hướng triển khai sang sử dụng `pg_advisory_xact_lock` của PostgreSQL. Bài test mới mô phỏng hai backend độc lập quét đồng thời; kết quả ghi nhận **17/17 BE và 26/26 FE PASS**. | [CheckExpiredHoldsCommand.cs](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/src/HotelSaas.Application/Public/Commands/CheckExpiredHolds/CheckExpiredHoldsCommand.cs) · [NotificationHubSecurityTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/backend/tests/HotelSaas.Application.Tests/Notifications/NotificationHubSecurityTests.cs) · [Commit `f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c) |
| **#03** | Trần Trọng Tân (24TX810025) | Antigravity IDE (`Gemini 3.8 Flash`); Codex (`GPT-6 Astra`) | Kịch bản demo và kiểm chứng luồng E2E công khai (T03) | Script ban đầu tìm phòng bằng API công khai nhưng lại tạo đơn qua API nội bộ, chưa kiểm tra được hành trình B2C trên cùng một đơn. Bản nháp biên bản còn thiếu sự phân biệt rõ giữa xác nhận thanh toán qua API local và giao dịch VNPay Sandbox thực tế. | Khi đối chiếu script với kịch bản demo hai màn hình, em phát hiện bước tạo đơn chưa đi đúng luồng khách hàng. Em chuyển yêu cầu sang kiểm chứng liên tục `Availability → Hold → Lookup → Confirm → SignalR → Cancel → D23`. Script sau chỉnh sửa đã chạy thành công luồng API công khai trên môi trường local. Em giữ riêng TC-06 ở trạng thái chưa kiểm chứng do chưa thực hiện giao dịch VNPay Sandbox qua Internet. Biên bản ghi nhận **19/20 tiêu chí PASS** trong phạm vi local. | [verify-signalr-e2e.mjs](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/scripts/verify-signalr-e2e.mjs) · [T03-TEST-RESULTS.md](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/docs/reports/T03-TEST-RESULTS.md) · [Commit `f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c) |

*Các liên kết GitHub thể hiện mã nguồn và bài kiểm thử tại phiên bản đã cập nhật. Phần diễn biến phát hiện lỗi và điều chỉnh prompt được trình bày theo quá trình thực hiện của sinh viên.*

---

### 3. Chi Tiết Nội Dung Prompt, Mã AI Tạo Ra & Quá Trình Sinh Viên Chỉnh Sửa Hoàn Thiện Thực Tế

#### Trần Trọng Tân (MSSV: 24TX810025 — Phụ trách Tasks T01–T03)

* **Công cụ sử dụng:** Google Antigravity IDE và OpenAI Codex.
* **Model khai báo:** `Gemini 3.8 Flash` và `GPT-6 Astra`.

#### Prompt sử dụng

*Nội dung dưới đây được tóm lược từ yêu cầu của từng nhiệm vụ và những lần điều chỉnh trong quá trình thực hiện, không phải bản sao nguyên văn toàn bộ lịch sử prompt.*

* **[Prompt 1 — Quản lý hoàn tiền và đối soát thu/chi (T01)]:**
  * **Yêu cầu ban đầu:** Xây dựng chức năng quản lý hoàn tiền D23 tại quầy thu ngân. Nhân viên có thể xem yêu cầu hoàn, phê duyệt, từ chối và xác nhận đã chi. Khoản hoàn tiền phải được tách khỏi tổng thu trên báo cáo ca, ngày và Folio.
  * **Yêu cầu bổ sung:** Kiểm tra trường hợp thu 1.000.000 đồng rồi hoàn 300.000 đồng, không được cộng khoản hoàn vào tiền thu. Sửa các bài kiểm thử frontend có dữ liệu mẫu sai kiểu và bổ sung kiểm thử hai thu ngân xác nhận chi đồng thời bằng `Task.WhenAll`, kết hợp khóa giao dịch PostgreSQL.

* **[Prompt 2 — Mở rộng thông báo SignalR và kiểm soát đơn hết hạn (T02)]:**
  * **Yêu cầu ban đầu:** Bổ sung thông báo thanh toán thành công, khách yêu cầu hủy phòng và đơn giữ chỗ hết hạn. Hệ thống phải gửi thông báo đúng chi nhánh, phân biệt quyền xem dữ liệu tài chính và cập nhật trên PMS mà không cần F5.
  * **Yêu cầu bổ sung:** Dù khách đã đóng trang giữ phòng, server vẫn phải chủ động phát hiện đơn hết hạn. Bổ sung tác vụ quét nền và bài kiểm thử chống phát thông báo trùng khi hai backend cùng xử lý, sử dụng khóa giao dịch PostgreSQL thay vì chỉ dựa vào khóa trong bộ nhớ.

* **[Prompt 3 — Xây dựng kịch bản demo và kiểm chứng E2E (T03)]:**
  * **Yêu cầu ban đầu:** Chuẩn bị kịch bản demo 5 phút cho khách hàng và nhân viên PMS, có dữ liệu mẫu, hướng dẫn xử lý sự cố và script kiểm tra các sự kiện SignalR.
  * **Yêu cầu bổ sung:** Thay bước tạo đơn nội bộ bằng API giữ chỗ công khai. Kiểm tra liên tục quá trình tìm phòng, giữ chỗ, tra cứu, xác nhận đặt cọc, nhận thông báo, hủy phòng và chi hoàn D23 trên cùng một đơn. Script sử dụng biến môi trường cho tài khoản thử nghiệm và không đánh dấu PASS cho bước VNPay Sandbox nếu chưa có giao dịch thực tế từ bên ngoài.

#### AI tạo ra và những hạn chế phát hiện được

* **T01 — Xử lý hoàn tiền:** Phần chức năng ban đầu có đủ các thao tác cơ bản nhưng cách tổng hợp số liệu chưa đúng với bản chất thu và chi. Đặc biệt, khoản đã hoàn vẫn mang giá trị dương và trạng thái `Completed`, nên nếu chỉ cộng các giao dịch theo trạng thái thì tổng thu sẽ bị sai. Ngoài vấn đề nghiệp vụ, một số bài kiểm thử frontend còn lỗi do dữ liệu mẫu không khớp kiểu khai báo.

* **T02 — Thông báo hết hạn giữ chỗ:** Giải pháp đầu tiên chỉ xử lý tốt khi có yêu cầu gọi API quét đơn. Khi khách rời khỏi trang, hệ thống vẫn cần một tác vụ chạy trên server để kiểm tra các đơn hết hạn. Sau khi có tác vụ nền, vấn đề tiếp theo là việc nhiều tiến trình backend cùng quét một đơn, trong khi khóa `SemaphoreSlim` không được chia sẻ giữa các tiến trình độc lập.

* **T03 — Kiểm chứng kịch bản demo:** Script ban đầu có thể kiểm tra từng API và sự kiện SignalR nhưng chưa kết nối đầy đủ các bước trong hành trình đặt phòng B2C. Một số nhận định trong bản nháp biên bản cũng cần xem xét lại vì có mã nguồn xử lý thanh toán không đồng nghĩa với việc đã chạy giao dịch qua cổng VNPay Sandbox bên ngoài.

#### Quá trình sinh viên phát hiện, điều chỉnh và kiểm chứng

**T01 — Kiểm tra số tiền thực thu và bổ sung tình huống hai thu ngân cùng xác nhận chi**

Điểm đầu tiên khiến em phải xem lại chức năng hoàn tiền là số liệu trên báo cáo thu ngân. Ví dụ khách đã thanh toán 1.000.000 đồng, sau đó khách sạn hoàn lại 300.000 đồng thì tổng tiền thu vẫn phải là 1.000.000 đồng, không thể tăng lên thành 1.300.000 đồng chỉ vì có thêm một giao dịch mang trạng thái `Completed`.

Em lấy trường hợp này để đối chiếu kết quả trên báo cáo ca, báo cáo ngày và Folio. Khi rà cùng Codex, em phát hiện phần tổng hợp chưa phân biệt rõ khoản thu với khoản chi hoàn. Em đưa lại ví dụ cụ thể vào prompt để Antigravity IDE điều chỉnh cách tính, đồng thời bổ sung kiểm thử nhằm kiểm tra cả ba báo cáo.

Trong lúc chạy lại các bài test frontend, em còn gặp một vấn đề khác: ứng dụng build được nhưng một số bài test không biên dịch vì dữ liệu mẫu chứa `null` không phù hợp với kiểu dữ liệu đang sử dụng. Sau khi sửa phần này, bộ kiểm thử frontend được chạy lại và ghi nhận 600/600 bài đạt.

Phần tính toán đã được xử lý nhưng em vẫn muốn kiểm tra thêm tình huống tại quầy. Nếu hai thu ngân mở cùng một hồ sơ hoàn tiền rồi bấm xác nhận gần như đồng thời thì hệ thống sẽ xử lý thế nào? Đây là trường hợp chưa được bao phủ trong lần kiểm thử ban đầu.

Em bổ sung yêu cầu tạo bài test `Task.WhenAll` với hai DbContext riêng, đồng thời sử dụng khóa giao dịch PostgreSQL `pg_advisory_xact_lock` kết hợp `SemaphoreSlim` trong phần xử lý xác nhận chi. Theo kết quả local mới, bộ kiểm thử backend T01 đạt **15/15 bài**, còn phần giao diện đạt **14/14 bài**.

**T02 — Từ tình huống khách đóng trang đến kiểm tra hai backend quét cùng lúc**

Với chức năng thông báo hết hạn giữ phòng, em thử đặt ra một tình huống khá đơn giản: khách mở trang giữ chỗ, sau đó đóng trình duyệt khi vẫn còn thời gian đếm ngược. Nếu không còn ai mở trang và không có thao tác gọi API thì liệu lễ tân có nhận được thông báo khi đơn hết hạn hay không?

Từ tình huống đó, em kiểm tra lại cách AI xây dựng chức năng quét đơn. Phiên bản ban đầu đã có API xử lý nhưng chưa giải quyết đầy đủ việc tự kích hoạt khi không có người dùng thao tác. Em điều chỉnh prompt theo hướng đưa việc kiểm tra hết hạn về backend và triển khai `ExpiredHoldSweepBackgroundService`.

Sau khi có tác vụ nền, em kiểm tra thêm phạm vi nhận thông báo. Kết quả cần bảo đảm chi nhánh sở hữu đơn được nhận sự kiện `HoldExpired`, còn những chi nhánh không liên quan không được nhận thông tin của đơn đó. Đây là phần quan trọng đối với hệ thống khách sạn đa chi nhánh.

Ở lần rà soát tiếp theo, em xem xét đến trường hợp hệ thống chạy nhiều backend. Lúc này, mỗi backend có bộ nhớ riêng nên `SemaphoreSlim` không thể tự đồng bộ việc quét giữa các tiến trình. Nếu cả hai cùng phát hiện một đơn hết hạn, nguy cơ xử lý trùng vẫn cần được kiểm tra.

Em tiếp tục bổ sung yêu cầu sử dụng khóa PostgreSQL `pg_advisory_xact_lock` và tạo bài test mô phỏng hai backend bằng hai DbContext độc lập. Bài kiểm thử tập trung vào việc chỉ một lượt quét xử lý đơn hết hạn, thay vì cả hai cùng phát sự kiện.

Kết quả kiểm thử local ghi nhận **17/17 bài backend và 26/26 bài kiểm thử giao diện chuông PMS đạt yêu cầu**. Trường hợp nhiều backend đã được mô phỏng trong bộ test, còn việc vận hành trên nhiều máy chủ triển khai thực tế vẫn là phạm vi kiểm chứng riêng.

**T03 — Điều chỉnh script để kiểm chứng đúng hành trình đặt phòng công khai**

Khi xem lại script `verify-signalr-e2e.mjs`, em thấy phần kiểm tra tìm phòng đã gọi API công khai nhưng bước tạo đơn tiếp theo lại sử dụng `POST /api/reservations` dành cho hệ thống nội bộ. Các bước riêng lẻ có thể chạy được, tuy nhiên cách này chưa phản ánh đúng quy trình khách tự đặt phòng trên website.

Trong khi đó, mục tiêu của T03 là trình diễn cùng một đơn đặt phòng xuyên suốt từ màn hình khách hàng đến PMS của lễ tân. Vì vậy, em chuyển hướng kiểm tra sang sử dụng API công khai ngay từ bước tạo giữ chỗ, thay vì tạo sẵn đơn bằng tài khoản nhân viên.

Script được điều chỉnh để thực hiện lần lượt các bước tìm phòng, tạo lượt giữ chỗ, tra cứu đơn qua `LookupToken` và xác nhận đặt cọc. Sau khi backend xác nhận đơn, em đối chiếu sự kiện SignalR nhận được ở tài khoản Manager và Receptionist, đặc biệt là việc che thông tin tài chính đối với lễ tân.

Luồng kiểm tra còn tiếp tục đến bước khách gửi yêu cầu hủy phòng công khai. Từ yêu cầu hủy đó, hệ thống phát thông báo đến nhóm nhân viên liên quan, sau đó quản lý thực hiện phê duyệt và xác nhận chi hoàn D23.

Trong kết quả chạy local được ghi nhận, script sử dụng cùng một đơn thử nghiệm `RES-89ZJ7A`. Khoản đặt cọc là **480.000 đồng** và quy trình được kiểm tra đến bước xác nhận chi hoàn. Đây là kết quả xử lý nghiệp vụ trên môi trường phát triển, không phải giao dịch chuyển tiền thực tế qua ngân hàng.

Một điểm em chú ý khi hoàn thiện biên bản là không đánh đồng việc API xác nhận đặt cọc hoạt động với việc cổng VNPay Sandbox đã gửi IPN từ Internet. Hai trường hợp có cách kiểm chứng khác nhau, nên em vẫn để **TC-06 ở trạng thái Chưa kiểm chứng**.

Theo kết quả được ghi nhận trong biên bản mới, **19/20 tiêu chí đạt PASS** trong phạm vi local. Tuy nhiên, các bước trình diễn trực tiếp trên hai màn hình, quét mã QR bằng thiết bị thật và đo thời lượng demo 5 phút cần được đối chiếu riêng, không chỉ dựa vào kết quả chạy script.

---

### 4. Đánh giá Việc Sử dụng AI và Kết quả Kiểm chứng

Qua ba nhiệm vụ Tuần 05, em thấy AI hỗ trợ khá nhiều trong việc triển khai những chức năng có liên quan đến cả frontend, backend và cơ sở dữ liệu. Dù vậy, có những vấn đề không thể chỉ kiểm tra bằng cách nhìn giao diện hoặc thấy chương trình build thành công.

Ở T01, điều quan trọng là số liệu thu và chi phải phản ánh đúng nghiệp vụ, kể cả khi hai nhân viên thao tác cùng lúc. Với T02, chức năng không chỉ cần gửi được thông báo mà còn phải hoạt động khi khách đã đóng trang và khi nhiều backend cùng xử lý. Còn T03 cho em thấy một script chạy thành công chưa chắc đã chứng minh đúng toàn bộ hành trình khách hàng nếu những bước trong script sử dụng API khác với luồng thực tế.

Trong quá trình làm việc, em sử dụng AI để hỗ trợ đề xuất và chỉnh sửa giải pháp, nhưng vẫn phải đối chiếu mã nguồn, kiểm tra kết quả và bổ sung các trường hợp còn thiếu. Những điểm chưa có đủ bằng chứng được giữ lại trong báo cáo thay vì kết luận đã hoàn thành.

**Kết quả kiểm thử được ghi nhận trong phạm vi local:**

* **Frontend:** 600/600 bài kiểm thử đạt, thuộc 44 tệp.
* **Backend T01:** 15/15 bài kiểm thử đạt.
* **Backend T02:** 17/17 bài kiểm thử đạt.
* **Kịch bản T03:** 19/20 tiêu chí được ghi nhận PASS; TC-06 về VNPay Sandbox và IPN từ Internet chưa kiểm chứng.

Các số liệu trên phản ánh kết quả những bộ kiểm thử đã thực hiện, không được hiểu là toàn bộ hệ thống đã hoàn tất mọi tình huống nghiệm thu thực tế.

**Minh chứng mã nguồn và quá trình cập nhật:**

* [Commit triển khai ban đầu — `1e82fb1`](https://github.com/GinNgo/hotel-saas-v2/commit/1e82fb1672278596e15dc57c97d4f61fca595178).
* [Commit bổ sung kiểm thử đồng thời và E2E công khai — `f74bb52`](https://github.com/GinNgo/hotel-saas-v2/commit/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c).
* [Biên bản kiểm thử Tuần 05 — T03](https://github.com/GinNgo/hotel-saas-v2/blob/f74bb52fc14b947eebcd2a34bc3d70059eed6f2c/docs/reports/T03-TEST-RESULTS.md).

---

**Ngày cập nhật báo cáo:** 09/11/2026

**Ngày lập báo cáo:** 08/11/2026
**Sinh viên thực hiện:** Trần Trọng Tân (`24TX810025`)
