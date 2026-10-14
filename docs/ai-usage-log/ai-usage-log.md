# NHẬT KÝ SỬ DỤNG CÔNG CỤ TRÍ TUỆ NHÂN TẠO (AI USAGE LOG) — TUẦN 01
## TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH — KHOA CNTT
---

* **Đề tài:** Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh Theo Mô Hình SaaS (Topic 578)
* **Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)
* **Nhóm thực hiện:** 
  1. Ngô Võ Tuấn An (`24TX810001` - Trưởng nhóm)
  2. Nguyễn Khởi Nguyên (`24TX810011`)
  3. Trần Trọng Tân (`24TX810025`)
* **Mục đích:** Ghi nhận minh chứng thực tế về việc áp dụng AI trợ lực phát triển phần mềm theo chuẩn Rubric môn học (Tiêu chí TC2.3 - Tận dụng AI có kiểm soát, có phản biện và kiểm thử độc lập).
* **Kho lưu trữ GitHub chính thức:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2) (Nhánh `develop`)

---

## BẢNG TỔNG HỢP CÁC LƯỢT SỬ DỤNG AI (LOG ENTRIES)

### ENTRY #001: Khởi tạo Kiến trúc Hệ thống & Scaffold Đồ án (Phase 0)

| Tiêu chí | Nội dung chi tiết |
|:---|:---|
| **Thời gian thực hiện** | 03/10/2026 |
| **Thành viên thực hiện** | Ngô Võ Tuấn An (`24TX810001`) |
| **Công cụ AI sử dụng** | Google Antigravity / Claude 3.5 Sonnet & GPT-4o |
| **Phạm vi công việc** | Thiết lập cấu trúc dự án Clean Architecture .NET 10, Angular 22 workspace, Docker Compose và tài liệu nền tảng |
| **Nội dung Prompt chính** | *"Tôi đang dựng backend .NET 10 theo Clean Architecture cho đồ án SaaS quản lý khách sạn đa chi nhánh. Nhờ bạn gợi ý cấu trúc solution 4 tầng Domain, Application, Infrastructure, WebApi. Tích hợp EF Core với PostgreSQL 17, MediatR, FluentValidation và viết giúp file docker-compose chạy Postgres với Redis. Sau đó gợi ý cấu trúc thư mục tài liệu SRS, SDD chuẩn học thuật."* |
| **Kết quả AI sinh ra** | AI đưa ra cấu trúc các thư mục, file solution `.sln`, các file `.csproj` tương ứng và file cấu hình `docker-compose.yml`. AI cũng gợi ý mục lục tài liệu kỹ thuật SRS và SDD. Tuy nhiên, ở phần MediatR, AI sinh cú pháp đăng ký Dependency Injection của phiên bản cũ `AddMediatR(typeof(Program))`. |
| **Sinh viên kiểm tra & Sửa chữa** | Tôi đã tải mã nguồn về máy local, sửa lại cách đăng ký MediatR sang chuẩn .NET 10 mới `AddMediatR(cfg => cfg.RegisterServicesFromAssembly(...))`. Tôi cũng chỉnh lại chuỗi kết nối PostgreSQL để tương thích với Docker trên Windows. Sau đó tôi chạy `dotnet build` và khởi động container, xác nhận hệ thống build thành công 0 lỗi. |
| **Lỗi AI phát hiện (Hallucination)** | AI sử dụng cú pháp đăng ký thư viện cũ không tương thích với MediatR v12+ trên .NET 10 $\to$ Sinh viên tự tay cập nhật lại cú pháp mới theo tài liệu chính thức của thư viện. |
| **Commit Git đối chiếu** | [Commit 4acf372](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) — *feat(arch): initial core architecture foundation - Clean Architecture .NET 10, Multi-tenant, Auth + RBAC, Seed Data, CI/CD* |

---

### ENTRY #002: Hiện thực Xác thực, Phân quyền RBAC & Bảo mật Multi-tenant (Phase 1A)

| Tiêu chí | Nội dung chi tiết |
|:---|:---|
| **Thời gian thực hiện** | 04/10/2026 |
| **Thành viên thực hiện** | Ngô Võ Tuấn An (`24TX810001`) |
| **Công cụ AI sử dụng** | Google Antigravity |
| **Phạm vi công việc** | Triển khai Authentication (JWT + Refresh Token xoay vòng), Multi-tenant Query Filter, Interceptor lưu dữ liệu an toàn |
| **Nội dung Prompt chính** | *"Hãy viết giúp tôi module Authentication bằng JWT có cơ chế Refresh Token xoay vòng (Token Rotation) để chống Replay Attack trong .NET 10. Đồng thời tạo giúp tôi EF Core Interceptor tự động lấy TenantId và PropertyId từ request header gắn vào entity khi thêm mới, ngăn không cho người dùng sửa hoặc đọc chéo dữ liệu của khách sạn khác."* |
| **Kết quả AI sinh ra** | AI sinh ra file `AuthController` với các endpoint đăng nhập, làm mới token; middleware bắt lỗi chuẩn RFC 7807; và class `TenantPropertySaveChangesInterceptor`. Code cơ bản cấp phát được token và chặn được truy vấn đơn giản. |
| **Sinh viên kiểm tra & Sửa chữa** | Khi xem lại code, tôi thấy AI chưa xử lý trường hợp Tenant bị vô hiệu hóa (`IsActive == false`), nếu không chặn thì dù bị khóa khách sạn vẫn dùng được refresh token cũ. Tôi đã bổ sung logic kiểm tra trạng thái kích hoạt vào token validator. Tôi cũng viết bộ unit tests để kiểm thử hành vi xoay vòng token và xác nhận hệ thống từ chối nếu có token giả mạo. |
| **Lỗi AI phát hiện (Hallucination)** | AI quên gán `TenantId` trong một số trường hợp tạo entity mới dẫn đến lỗi NullReference $\to$ Sinh viên bổ sung logic tự động inject `ICurrentTenantService` vào BaseEntity Handler. |
| **Commit Git đối chiếu** | [Commit 4acf372](https://github.com/GinNgo/hotel-saas-v2/commit/4acf372) — *feat(arch): initial core architecture foundation - Clean Architecture .NET 10, Multi-tenant, Auth + RBAC, Seed Data, CI/CD* |

---

### ENTRY #003: Hiện thực Phân hệ Danh mục Phòng & Hạng phòng (Phase 1B - Room Catalog)

| Tiêu chí | Nội dung chi tiết |
|:---|:---|
| **Thời gian thực hiện** | 06/10/2026 – 08/10/2026 |
| **Thành viên thực hiện** | Nguyễn Khởi Nguyên (`24TX810011`) |
| **Công cụ AI sử dụng** | GitHub Copilot & ChatGPT Plus |
| **Phạm vi công việc** | Xây dựng CRUD RoomType và Room theo mẫu CQRS, xây dựng UI Angular Catalog |
| **Nội dung Prompt chính** | *"Mình đang làm tính năng quản lý danh mục Loại phòng (RoomType) và Phòng (Room) cho khách sạn bằng C# .NET 10. Bạn viết giúp mình các Command và Query MediatR để thêm, sửa, xóa, lấy danh sách có phân trang và lọc theo tầng. Lưu ý số phòng không được trùng nhau trong cùng một khách sạn và không cho xóa loại phòng nếu đang có phòng trực thuộc."* |
| **Kết quả AI sinh ra** | AI sinh ra đầy đủ các class Command, Query, Handler và Validator dùng FluentValidation, cùng với code service Angular để gọi API. Nhưng phần xử lý xóa thì AI lại viết xóa cứng (hard delete) trực tiếp vào database, không kiểm tra xem phòng đó trước đây đã từng có đơn đặt phòng (Reservation) nào chưa. |
| **Sinh viên kiểm tra & Sửa chữa** | Tôi đã kiểm tra lại nghiệp vụ khách sạn và sửa lại logic: thay vì xóa cứng thì phải kiểm tra ràng buộc với lịch sử đặt phòng, nếu phòng đã từng phát sinh giao dịch thì chặn lại và thông báo cho người dùng. Về phía Frontend Angular, AI sinh code dạng module cũ nên tôi đã tự tay viết lại toàn bộ sang Angular Standalone Component dùng Signals (`signal()`, `computed()`) để trang quản lý danh mục phòng load nhanh và mượt hơn. |
| **Lỗi AI phát hiện (Hallucination)** | AI sinh ra logic xóa cứng (Hard Delete) làm mất lịch sử đặt phòng $\to$ Sinh viên đã sửa thành kiểm tra ràng buộc khóa ngoại với Reservation trước khi cho phép xóa. |
| **Commit Git đối chiếu** | [Commit cafb63e](https://github.com/GinNgo/hotel-saas-v2/commit/cafb63e) — *[feat] full CRUD manage Room and RomType* |

---

### ENTRY #004: Hiện thực Máy trạng thái Buồng phòng & Concurrency Lock (Phase 1B - Housekeeping)

| Tiêu chí | Nội dung chi tiết |
|:---|:---|
| **Thời gian thực hiện** | 09/10/2026 – 12/10/2026 |
| **Thành viên thực hiện** | Trần Trọng Tân (`24TX810025`) |
| **Công cụ AI sử dụng** | Google Antigravity & Claude 3.5 Sonnet |
| **Phạm vi công việc** | Thiết kế máy trạng thái buồng phòng FSM, Concurrency Lock bằng `expectedOldStatus`, giao diện Housekeeping Board |
| **Nội dung Prompt chính** | *"Mình cần làm màn hình quản lý buồng phòng (Housekeeping) cho khách sạn. Khách sạn có 5 trạng thái phòng: Sạch, Bẩn, Đang dọn, Có khách và Hỏng/Bảo trì. Bạn viết giúp mình API đổi trạng thái phòng có kiểm tra luồng chuyển đổi hợp lệ và tránh trường hợp 2 nhân viên cùng bấm đổi trạng thái một lúc. Phía giao diện Angular hiển thị các thẻ phòng theo từng tầng và đổi màu theo trạng thái."* |
| **Kết quả AI sinh ra** | AI đề xuất tạo class `RoomStatusTransitionValidator` để chặn các chuyển đổi sai luật, và gợi ý gửi kèm `expectedOldStatus` lên API PATCH để so khớp trạng thái cũ. Phía Angular thì AI sinh ra giao diện danh sách phòng có nút bấm đổi trạng thái nhưng lại dùng thư viện quản lý state bên ngoài. |
| **Sinh viên kiểm tra & Sửa chữa** | Khi tôi dò lại bảng ma trận chuyển đổi trạng thái thì thấy AI bỏ sót mất trường hợp: phòng bảo dưỡng xong (OutOfService) chuyển về lại phòng sạch (Clean) để đón khách, nên tôi đã tự thêm rule này vào validator. Ở giao diện Angular, tôi bỏ thư viện ngoài và viết lại bằng Angular Signals thuần, đồng thời thêm cơ chế khóa nút bấm khi đang gọi API để tránh nhân viên click liên tục làm lỗi hệ thống. Tôi cũng tự viết thêm file tính tỷ lệ phần trăm phòng sạch để hiển thị KPI ở đầu trang. |
| **Lỗi AI phát hiện (Hallucination)** | AI bỏ sót bước chuyển trạng thái từ Bảo trì (`OutOfService`) về Phòng sạch (`Clean`) và dùng thư viện thừa $\to$ Sinh viên đã bổ sung đầy đủ luật chuyển đổi và tối ưu hóa code nhẹ nhàng. |
| **Commit Git đối chiếu** | [Commit 5e39c97](https://github.com/GinNgo/hotel-saas-v2/commit/5e39c97) / [Pull Request #4](https://github.com/GinNgo/hotel-saas-v2/pull/4) — *feat(housekeeping): Trần Trọng Tân - implement housekeeping board and state machine* |

---

## KẾT LUẬN VỀ VIỆC ỨNG DỤNG AI TRONG ĐỒ ÁN

1. **Hiệu quả đạt được:**
   - AI giúp nhóm tăng tốc độ scaffold mã nguồn lặp lại (Boilerplate code, DTOs, Validators) lên đáng kể.
   - Hỗ trợ rà soát nhanh các quy chuẩn lập trình và gợi ý cấu trúc tài liệu đồ án chuẩn chỉ.
2. **Nguyên tắc kiểm soát của nhóm:**
   - **Không sao chép nguyên văn:** Mọi đoạn mã AI sinh ra đều được thành viên trong nhóm trực tiếp đọc hiểu, đối chiếu logic nghiệp vụ và điều chỉnh theo kiến trúc chung.
   - **Kiểm thử độc lập:** Tất cả tính năng đều phải vượt qua unit tests và biên dịch thành công 0 warnings, 0 errors trước khi đưa vào kho mã nguồn chính.
