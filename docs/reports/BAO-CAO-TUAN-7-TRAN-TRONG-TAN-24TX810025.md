# BÁO CÁO TIẾN ĐỘ TUẦN 07 VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO
## NỀN TẢNG QUẢN LÝ KHÁCH SẠN ĐA CHI NHÁNH THEO MÔ HÌNH SAAS

## THÔNG TIN CHUNG

- **Sinh viên thực hiện:** Trần Trọng Tân — **MSSV:** `24TX810025`
- **Dự án:** Hotel SaaS Platform v2
- **Ngày cập nhật báo cáo:** 26/11/2026
- **Nhánh làm việc:** `feature/tan-week7-playwright-housekeeping-crm`
- **Mã nguồn nền:** Đã đồng bộ với `origin/develop` tại commit `a693e1a`. Khi rà soát để lập báo cáo, nhánh không có commit chênh lệch với remote, nhưng các thay đổi của Tuần 7 vẫn chưa được commit.
- **Tài liệu đối chiếu:** [Phân công Tuần 7](../team/GIAO-VIEC-VA-PROMPT-TUAN-7.txt) và [Kế hoạch chi tiết Tuần 7](../team/KE-HOACH-CHI-TIET-TUAN-7.md)
- **Trạng thái bàn giao:** Chưa commit, push, tạo PR, merge hoặc triển khai các thay đổi của Tuần 7.

## PHẦN I. TỔNG QUAN CÔNG VIỆC

Trong Tuần 7, em tập trung vào bốn nhóm công việc chính: xây dựng bộ kiểm thử giao diện bằng Playwright, cập nhật bảng buồng phòng theo thời gian thực, mở rộng kiểm thử phân quyền và hoàn thiện chức năng quản lý hồ sơ khách hàng. Bên cạnh việc bổ sung tính năng, em cũng kiểm tra lại các luồng nghiệp vụ trên giao diện và xử lý những trường hợp còn thiếu từ các tuần trước.

Các chức năng chính đã được triển khai và kiểm thử trên môi trường Local. Bộ Playwright có **12 kịch bản**, gồm 10 kịch bản theo phân công và 2 kịch bản bổ sung. Ở lượt chạy đầy đủ gần nhất, thực hiện trước khi đồng bộ commit `a693e1a`, kết quả là **11 kịch bản đạt, 1 kịch bản VNPay được bỏ qua và không có kịch bản thất bại**.

Tuy nhiên, **công việc Tuần 7 chưa đủ điều kiện nghiệm thu toàn bộ**. Backend vẫn còn 2 bài kiểm thử phân quyền thất bại, kịch bản VNPay cần giao dịch sandbox thật và 3 file dùng chung đã chỉnh sửa cần được nhóm thống nhất phạm vi. Em tách riêng kết quả trên Local và Staging để thể hiện đúng những phần đã kiểm chứng.

| Hạng mục | Kết quả đã thực hiện | Công việc còn lại |
| :--- | :--- | :--- |
| **T01 — Playwright** | Xây dựng 12 kịch bản (10 theo phân công, 2 bổ sung). Trên Local: 11 đạt, 1 bỏ qua, 0 thất bại. Trên Staging: 2/2 luồng công khai 01–02 đạt. | Kiểm thử VNPay sandbox ở luồng 04; chạy lại các luồng có đăng nhập trên Local sau `a693e1a`; kiểm thử thêm trên Staging khi có tài khoản và dữ liệu được phép sử dụng. |
| **T02 — Housekeeping realtime** | Cập nhật dữ liệu buồng phòng qua SignalR, sử dụng polling khi mất kết nối; kiểm thử nhận việc và đồng bộ giữa hai phiên trình duyệt đạt trên Local. | Nhóm xác nhận ba file dùng chung đã sửa; kiểm chứng thêm trên Staging. |
| **T03 — Ma trận phân quyền** | Kiểm thử bằng HTTP, JWT và PostgreSQL thật trên 6 nhóm vai trò; đã tìm thấy endpoint được bảo vệ cho 17 mã quyền. | Bổ sung độ bao phủ cho đủ 19 mã quyền và kiểm tra quyền đọc nhật ký hoạt động. |
| **T04 — Guest CRM** | Hỗ trợ tra cứu khách không có SĐT, lưu ghi chú, tùy chọn VIP thủ công và blacklist; đã bổ sung kiểm thử Backend, Frontend và trình duyệt. | Chưa có cơ chế tự kế thừa cờ VIP/blacklist sang các đặt phòng mới được tạo sau này. |

## PHẦN II. NỘI DUNG ĐÃ THỰC HIỆN

### 1. Xây dựng bộ kiểm thử nghiệp vụ bằng Playwright

Em bổ sung Playwright và cấu hình chạy trên trình duyệt Chromium để kiểm tra các thao tác thực tế của người dùng. Các kịch bản làm việc với giao diện và API thật trong môi trường kiểm thử, không dùng dữ liệu giả để thay thế phản hồi HTTP. Những trường hợp chưa có đủ tài khoản hoặc dữ liệu đầu vào được ghi nhận là chưa kiểm thử, thay vì đánh dấu đạt.

Đối với luồng khách đến trực tiếp (*walk-in*), em chuyển bước tạo đơn từ gọi API sang thao tác trên biểu mẫu giao diện. Kịch bản lần lượt kiểm tra tạo đặt phòng, đối chiếu giấy tờ khi nhận phòng, thu số tiền còn lại trên folio và trả phòng. Với quy trình hoàn tiền D23, kịch bản kiểm tra thao tác duyệt yêu cầu và xác nhận chi trả bằng dữ liệu thử nghiệm.

Ngoài 10 luồng được phân công, em bổ sung thêm 2 kịch bản:

- Mở đồng thời phiên lễ tân và phiên nhân viên buồng phòng để kiểm tra việc cập nhật trạng thái phòng theo thời gian thực.
- Kiểm tra hồ sơ khách không có số điện thoại, cập nhật ghi chú và cờ VIP/blacklist, sau đó tải lại trang để xác nhận dữ liệu được lưu.

Cách cấu hình môi trường và chuẩn bị dữ liệu được mô tả trong [hướng dẫn E2E](../../frontend/e2e/README.md).

### 2. Cập nhật bảng buồng phòng theo thời gian thực

Bảng buồng phòng được cập nhật dựa trên các sự kiện SignalR đã được xử lý qua `NotificationService`. Khi có sự kiện thuộc đúng doanh nghiệp và chi nhánh đang làm việc, trang sẽ tải lại phần dữ liệu liên quan. Em cũng bổ sung kiểm tra sự kiện đã nhận để tránh tải lại không cần thiết khi người dùng chỉ thay đổi trạng thái đã đọc của thông báo.

Khi kết nối SignalR được khôi phục, trang chủ động tải lại dữ liệu để cập nhật những thay đổi có thể đã bị bỏ lỡ trong thời gian mất kết nối. Nếu realtime không hoạt động, hệ thống tiếp tục dùng cơ chế gọi API định kỳ **10 giây/lần** làm phương án dự phòng.

Trong lúc kiểm thử, em phát hiện tài khoản Housekeeper bị chuyển đến trang `/forbidden` vì một số thành phần dùng chung vẫn gọi API đặt phòng dù tài khoản không có quyền đọc dữ liệu này. Để xử lý đúng theo phân quyền, em bổ sung bước kiểm tra quyền trước khi gọi API tại `NotificationService` và trang Dashboard, thay vì cấp thêm quyền cho Housekeeper chỉ để vượt qua bài kiểm thử.

Sau khi điều chỉnh, luồng Housekeeper tự nhận việc, bắt đầu dọn và hoàn tất dọn phòng đã chạy đạt trên môi trường Local với tài khoản đúng vai trò.

### 3. Mở rộng kiểm thử phân quyền

Em xây dựng bộ kiểm thử sử dụng HTTP pipeline, JWT và PostgreSQL thật, trong đó mỗi lượt chạy có schema dữ liệu riêng. Sáu nhóm vai trò được kiểm tra gồm **Housekeeper, Receptionist, Manager, Owner, SuperAdmin và Customer**.

Trong các trường hợp kiểm tra quyền của nhân viên, quyền truy cập nghiệp vụ trong cơ sở dữ liệu được đặt ở trạng thái không cho phép, còn JWT vẫn chứa claim quyền tương ứng. Cách kiểm tra này nhằm xác nhận rằng chỉ có claim trong JWT thì chưa đủ để truy cập API khi quyền trong cơ sở dữ liệu không hợp lệ. Bộ test cũng có trường hợp đối chứng: khi cấp quyền đọc phòng trong cơ sở dữ liệu, API phòng trả về thành công.

Kết quả hiện tại ghi nhận **17 mã quyền có endpoint được bảo vệ**, tương ứng **102 tổ hợp vai trò/mã quyền trả về HTTP 403**. Kiểm tra truy cập khi chưa đăng nhập trả về HTTP 401 trên 17 endpoint và được lặp lại trong từng trường hợp vai trò; đây không phải 17 bài test độc lập. Ngoài ra, có **4 trường hợp đối chứng** cho API phòng trả về HTTP 200 với các vai trò nhân sự.

Bộ kiểm thử vẫn còn **2 bài thất bại**, cụ thể:

- Chưa tìm thấy endpoint có kiểm tra quyền tương ứng cho hai mã `INVOICES` và `ROLES` theo yêu cầu của ma trận 19 mã quyền.
- Mã `AUDIT_LOGS` đã được kiểm tra ở endpoint ghi sự kiện, nhưng hai endpoint đọc `AuditLogsController.GetList` và `GetById` chưa có guard quyền tương ứng.

Vì vậy, **phần kiểm thử phân quyền Backend chưa đạt yêu cầu nghiệm thu**. Em giữ nguyên kết quả thất bại trong báo cáo để nhóm có cơ sở bổ sung khi tích hợp các phần việc liên quan.

### 4. Hoàn thiện chức năng quản lý hồ sơ khách hàng

Đối với Guest CRM, em sửa cách lấy danh sách để không bỏ qua các đặt phòng thiếu số điện thoại. Khóa định danh khách được sử dụng thống nhất khi hiển thị danh sách, lịch sử và cập nhật thông tin. Thứ tự ưu tiên là số điện thoại, email đã chuẩn hóa, mã người dùng kết hợp tên và cuối cùng là mã đặt phòng. Các khóa này sử dụng tiền tố `phone:`, `email:`, `user:` và `reservation:`. Khi không có đủ dữ liệu để xác định cùng một khách, hệ thống không tự gộp hồ sơ chỉ vì trùng tên.

Trên giao diện, những trường hợp chưa có số điện thoại được hiển thị là **“Chưa có SĐT”**. Em bổ sung khả năng chọn VIP theo cách tự động hoặc thủ công và đánh dấu blacklist. Các thông tin này được lưu trong JSON snapshot của đặt phòng, không cần tạo bảng hoặc migration mới. Riêng giá trị VIP thủ công được phân biệt rõ: `false` nghĩa là chủ động bỏ trạng thái VIP, còn `null` nghĩa là quay lại cách xác định VIP tự động.

Khi cập nhật hồ sơ, các trường snapshot khác và thông tin thời gian lưu trú vẫn được giữ nguyên. Em cũng xử lý trường hợp dữ liệu lịch sử trả về chậm làm ghi đè ghi chú, VIP hoặc blacklist mà người dùng đang chỉnh sửa. Những nút điều khiển bị lặp trong giao diện card trên điện thoại đã được loại bỏ.

Hiện tại, chức năng chỉ cập nhật các đặt phòng đã tồn tại, có định danh phù hợp và thuộc phạm vi mà người dùng được phép truy cập. **Cờ VIP/blacklist chưa được tự động kế thừa sang đặt phòng mới.** Đây là phần nhóm cần tiếp tục xem xét nếu xây dựng hồ sơ khách dùng chung trong các giai đoạn sau.

## PHẦN III. PHẠM VI THAY ĐỔI

### 1. Những file chính thuộc phần việc được phân công

| Nhóm công việc | File hoặc thư mục liên quan |
| :--- | :--- |
| **Playwright** | `frontend/package.json`, `frontend/package-lock.json`, `frontend/playwright.config.ts`, `frontend/e2e/**` |
| **Housekeeping** | `frontend/src/app/features/housekeeping/housekeeping.page.ts`, `housekeeping-realtime.spec.ts` |
| **Guest CRM Backend** | `backend/src/HotelSaas.Application/Guests/**`, `backend/src/HotelSaas.Application/Reservations/DTOs/ReservationSnapshot.cs`, `backend/src/HotelSaas.WebApi/Controllers/GuestsController.cs` |
| **Guest CRM Frontend** | `frontend/src/app/features/guests/guests.page.ts`, `guests.page.spec.ts`, `frontend/src/app/core/models/guest.model.ts`, `frontend/src/app/core/services/guest.service.ts` |
| **Kiểm thử Backend** | `backend/tests/HotelSaas.Application.Tests/Guest/GuestDirectoryAndNotesTests.cs`; `RbacPermissionMatrixE2ETests.cs`, `GuestCrmPostgresTests.cs` và fixture trong `CrossBranchSecurityE2ETests.cs` thuộc `backend/tests/HotelSaas.WebApi.Tests/Security/` |

### 2. Ba file dùng chung cần nhóm xác nhận

Trong quá trình sửa lỗi Housekeeper bị chuyển đến `/forbidden`, em cần chỉnh thêm 3 file nằm ngoài danh sách được phân công ban đầu:

- `frontend/src/app/core/services/notification.service.ts`: Kiểm tra quyền đọc phòng và đặt phòng trước khi gọi API lấy dữ liệu hoặc cập nhật định kỳ.
- `frontend/src/app/features/dashboard/dashboard.page.ts`: Kiểm tra quyền trước khi tải dữ liệu phòng, đặt phòng và tổng hợp thanh toán.
- `frontend/src/app/shared/components/notification-bell/notification-bell.component.spec.ts`: Bổ sung bài test xác nhận hệ thống không gọi API đặt phòng khi tài khoản thiếu quyền đọc.

Đây là những chỉnh sửa để xử lý lỗi thực tế trong quá trình kiểm thử, nhưng vì liên quan đến file dùng chung, **em cần trao đổi để nhóm thống nhất trước khi merge** hoặc xem xét tách thành PR riêng.

Trong phạm vi các thay đổi Tuần 7 được ghi nhận, em không tạo migration hay bảng `GuestProfile` mới và không sửa `DbContext`, `Program.cs`, workflow triển khai, `AuditLogsController` hoặc `StaffController`.

## PHẦN IV. KẾT QUẢ KIỂM THỬ

Em tổng hợp kết quả theo từng lượt chạy và mã nguồn nền tương ứng (`ac17ee7` hoặc `a693e1a`). Những bài test được chạy lại theo nhóm chỉ dùng để xác nhận phần có liên quan, **không cộng thêm vào tổng số test của toàn hệ thống**.

### 1. Build và kiểm thử tự động

| Nội dung kiểm tra | Mã nguồn nền | Kết quả ghi nhận |
| :--- | :--- | :--- |
| Backend build | `a693e1a` | Đạt, 0 cảnh báo và 0 lỗi |
| Backend test phần bị ảnh hưởng (Geo và Guest CRM) | `a693e1a` | **23/23 đạt** |
| Backend full test | `ac17ee7` (trước lần đồng bộ cuối) | **886 đạt, 2 thất bại, 0 bỏ qua** |
| Frontend production build | `a693e1a` | Đạt |
| Frontend full unit test | `a693e1a` | **62/62 file, 766/766 test đạt** |
| Kiểm tra kiểu TypeScript cho Playwright | `a693e1a` | Đạt, 0 lỗi |

Ở lượt chạy toàn bộ Backend trên nền `ac17ee7`, kết quả gồm `Domain 1/1`, `Application 733/733` và `WebApi 152/154`. Hai bài thất bại là `AllNineteenFunctions_HaveProductionPermissionGuard` và `AuditLogsReadEndpoints_HaveProductionPermissionGuard`.

**Sau khi đồng bộ `a693e1a`, em chưa có kết quả chạy lại toàn bộ Backend.** Kết quả `23/23` chỉ xác nhận các bài test Geo và Guest CRM được chọn để kiểm tra lại, không thay thế kết quả full test.

Các nhóm kiểm thử liên quan đến phần việc Tuần 7 có CRM Backend **4 test**, CRM PostgreSQL **1 test**, cô lập doanh nghiệp/chi nhánh **7 test**, CRM Frontend **3 test** và Housekeeping **30 test**. Bộ Notification Bell có **27 test đạt**, trong đó gồm kiểm tra quyền trước khi gọi API. Các con số này thuộc những lượt chạy đã ghi ở trên, không phải số bài kiểm thử được cộng thêm.

### 2. Kiểm thử Playwright trên môi trường Local

Lượt chạy đầy đủ gần nhất sử dụng Frontend tại `127.0.0.1:4200`, Backend tại `127.0.0.1:5283` và cơ sở dữ liệu kiểm thử riêng. Lượt này diễn ra trước khi đồng bộ commit `a693e1a`, sử dụng HTTP thật, không mock phản hồi, với tổng thời gian **58 giây**. Kết quả: **11 đạt, 1 bỏ qua, 0 thất bại**.

| Mã | Kịch bản kiểm thử | Kết quả |
| :---: | :--- | :--- |
| 01 | Hiển thị danh mục 34 tỉnh/thành và tìm kiếm cơ sở lưu trú | **Đạt** |
| 02 | Mở chi tiết cơ sở lưu trú và chọn phòng | **Đạt** |
| 03 | Khách đã xác thực áp dụng ưu đãi và giữ phòng 15 phút | **Đạt** |
| 04 | VNPay return và kiểm tra trạng thái đặt phòng từ giao dịch sandbox thật | **Chưa kiểm thử** — thiếu dữ liệu giao dịch |
| 05 | Owner đăng nhập PMS và giữ ngữ cảnh HQ sau khi tải lại trang | **Đạt** |
| 06 | Tạo walk-in trên giao diện, nhận phòng, quyết toán và trả phòng | **Đạt** |
| 07 | Housekeeper tự nhận việc, bắt đầu và hoàn tất dọn phòng | **Đạt** |
| 08 | Duyệt yêu cầu D23 và ghi nhận chi hoàn bằng dữ liệu thử nghiệm | **Đạt** |
| 09 | SuperAdmin xem danh sách người dùng và doanh nghiệp | **Đạt** |
| 10 | Từ chối truy cập dữ liệu chéo chi nhánh | **Đạt** |
| 11 | Hai phiên trình duyệt nhận cập nhật buồng phòng qua SignalR | **Đạt** |
| 12 | Khách thiếu SĐT lưu ghi chú, VIP và blacklist, sau đó kiểm tra lại khi tải trang | **Đạt** |

Sau khi đồng bộ mã nguồn `a693e1a`, hai luồng công khai **01 và 02** đã được chạy lại trực tiếp trên Staging và đạt **2/2**. Những luồng cần đăng nhập trên Local **chưa được chạy lại** ở phiên bản mã nguồn này.

### 3. Kiểm thử trên môi trường Staging

Ở lần kiểm tra trên nền `a693e1a`, các endpoint `/health/ready`, `/api/locations/provinces` và `/api/public/properties` đều trả về **HTTP 200** sau giai đoạn trước đó từng xuất hiện lỗi `502`.

Hai kịch bản Playwright công khai đã chạy đạt trực tiếp trên [môi trường Staging](https://luxustay.duckdns.org): luồng **01 mất 9,6 giây**, luồng **02 mất 2,3 giây**, tổng thời gian ghi nhận **12,8 giây** và kết quả **2/2 đạt**.

Kết quả này **chỉ xác nhận hai luồng công khai**, không đồng nghĩa cả 12 luồng Playwright đã đạt trên Staging. Các luồng cần đăng nhập hoặc làm thay đổi dữ liệu chưa được chạy vì chưa có bộ tài khoản và dữ liệu thử nghiệm riêng được cấp phép. Giao diện đăng nhập trên Staging cũng không hiển thị tiện ích chọn tài khoản demo.

Theo nhật ký thực hiện, hai máy chủ Local tạm thời đã được dừng và cơ sở dữ liệu E2E tạm đã được dọn sau khi kiểm thử. File trace và ảnh chụp được lưu ngoài repository tại `%TEMP%\hotelsaas-week7-playwright`; dữ liệu phiên đăng nhập không được đưa lên Git.

## PHẦN V. HẠN CHẾ VÀ KẾ HOẠCH HOÀN TẤT

Dựa trên kết quả hiện tại, em xác định các công việc cần tiếp tục như sau:

1. **Hoàn thiện kiểm thử phân quyền cùng nhóm.** Đối chiếu endpoint hóa đơn với phần việc của Nguyên, quyền đọc nhật ký hoạt động với phần việc của An và mã quyền `ROLES` tại các endpoint quản lý vai trò. Sau khi nhóm tích hợp, cần chạy lại ma trận để kiểm tra đủ **19 mã quyền trên 6 nhóm vai trò**. Hai test đang thất bại chỉ được chuyển sang đạt khi đã có kết quả kiểm thử thực tế.

2. **Kiểm thử luồng VNPay sandbox.** Chuẩn bị giao dịch sandbox thật và dữ liệu tra cứu phù hợp để thực hiện kịch bản Playwright số 04. Trong thời gian chưa có dữ liệu, kịch bản này vẫn được tính là **chưa kiểm thử**, không tính vào số luồng đạt.

3. **Thống nhất phạm vi ba file dùng chung.** Trao đổi với nhóm về các thay đổi tại `notification.service.ts`, `dashboard.page.ts` và `notification-bell.component.spec.ts` trước khi merge hoặc quyết định tách thành PR riêng.

4. **Chạy lại kiểm thử sau khi đồng bộ mã nguồn.** Tiếp tục kiểm tra những luồng E2E có thể bị ảnh hưởng bởi commit `a693e1a`. Khi các phần liên quan đã được tích hợp, cần chạy lại đầy đủ bộ kiểm tra để chốt kết quả bàn giao. Đối với Staging, chỉ thực hiện thao tác làm thay đổi dữ liệu khi có bộ dữ liệu thử nghiệm được cho phép.

5. **Theo dõi lỗi khởi tạo cơ sở dữ liệu trống.** Nhật ký ở lượt chạy trước từng ghi nhận lỗi thiếu tenant context khi seeding đi qua `AuditSaveChangesInterceptor`. Chưa có kết quả kiểm thử riêng để xác nhận lỗi này trên `a693e1a`, nên cần bàn giao nhóm kiểm tra lại, không lấy kết luận ở phiên bản cũ thay cho phiên bản mới.

6. **Tiếp tục hoàn thiện thiết kế hồ sơ khách hàng.** Cần thống nhất cách kế thừa trạng thái VIP và blacklist sang các đặt phòng được tạo mới nếu nhóm triển khai hồ sơ khách dùng chung. Giải pháp lưu thông tin theo snapshot của đặt phòng hiện tại chưa xử lý được trường hợp này.

## PHẦN VI. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO

Trong quá trình thực hiện Tuần 7, em có sử dụng công cụ AI để hỗ trợ đọc mã nguồn, triển khai một số phần chức năng, tìm lỗi và tổng hợp kết quả kiểm thử. Những công cụ và phạm vi hỗ trợ được ghi nhận như sau:

| Công cụ AI | Model sử dụng | Nội dung hỗ trợ |
| :--- | :--- | :--- |
| **OpenAI Codex** | **GPT-6 Astra** | Phân tích tài liệu phân công và mã nguồn; hỗ trợ tạo cấu hình, kịch bản Playwright ban đầu; triển khai Guest CRM, Housekeeping realtime và bộ kiểm thử RBAC; rà soát vấn đề kỹ thuật và hỗ trợ biên tập báo cáo. |
| **Google Antigravity** | **Gemini 4 Neon** | Đối chiếu các file đã thay đổi; hỗ trợ phát hiện và sửa lỗi giao diện, xử lý dữ liệu trả về chậm trong Guest CRM và kiểm tra quyền gọi API của Housekeeper; chạy các bộ kiểm thử Local, 12 kịch bản Playwright, 2 luồng công khai trên Staging; đồng bộ nhánh với `origin/develop` và cập nhật báo cáo. |