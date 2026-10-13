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

---

## BẢNG TỔNG HỢP CÁC LƯỢT SỬ DỤNG AI (LOG ENTRIES)

### ENTRY #001: Khởi tạo Kiến trúc Hệ thống & Scaffold Đồ án (Phase 0)

| Tiêu chí | Nội dung chi tiết |
|:---|:---|
| **Thời gian thực hiện** | 03/10/2026 |
| **Thành viên thực hiện** | Ngô Võ Tuấn An (`24TX810001`) |
| **Công cụ AI sử dụng** | Google Antigravity / Claude 3.5 Sonnet & GPT-4o |
| **Phạm vi công việc** | Thiết lập cấu trúc dự án Clean Architecture .NET 10, Angular 22 workspace, Docker Compose và tài liệu nền tảng |
| **Nội dung Prompt chính** | *"Thiết lập solution .NET 10 Clean Architecture gồm 4 tầng Domain, Application, Infrastructure, WebApi. Tích hợp EF Core 10, PostgreSQL 17, MediatR, FluentValidation. Cấu hình Docker Compose cho PostgreSQL, Redis, Seq. Khởi tạo workspace Angular 22 Standalone Components."* |
| **Kết quả AI sinh ra** | - Toàn bộ cấu trúc Solution `.sln` và các file `.csproj`.<br>- Docker Compose cho Postgres 17, Redis 7.<br>- Cấu trúc thư mục tài liệu `docs/srs/`, `docs/sdd/`, `docs/test-plan/`. |
| **Sinh viên kiểm tra & Sửa chữa** | - **Sửa chữa:** Cập nhật lại chuỗi kết nối PostgreSQL tương thích môi trường Windows & Linux.<br>- **Kiểm tra:** Chạy lệnh `dotnet build` và `docker compose up` trên máy local, xác nhận database khởi tạo thành công. |
| **Lỗi AI phát hiện (Hallucination)** | AI sử dụng package MediatR phiên bản cũ có phương pháp đăng ký DI lỗi thời `AddMediatR(typeof(Program))` -> Sinh viên đã tự sửa lại thành `AddMediatR(cfg => cfg.RegisterServicesFromAssembly(...))`. |
| **Commit Git đối chiếu** | `677cd99` — *feat: Phase 0 complete - docs, scaffold, entities, rules* |

---

### ENTRY #002: Hiện thực Xác thực, Phân quyền RBAC & Bảo mật Multi-tenant (Phase 1A)

| Tiêu chí | Nội dung chi tiết |
|:---|:---|
| **Thời gian thực hiện** | 04/10/2026 |
| **Thành viên thực hiện** | Ngô Võ Tuấn An (`24TX810001`) |
| **Công cụ AI sử dụng** | Google Antigravity |
| **Phạm vi công việc** | Triển khai Authentication (JWT + Refresh Token xoay vòng), Multi-tenant Query Filter, Interceptor lưu dữ liệu an toàn |
| **Nội dung Prompt chính** | *"Implement authentication JWT và Refresh Token xoay vòng theo chuẩn Clean Architecture trong .NET 10. Tạo EF Core Global Query Filter tự động lọc theo TenantId và PropertyId. Viết SaveChangesInterceptor ngăn chặn ghi dữ liệu chéo Tenant."* |
| **Kết quả AI sinh ra** | - `TenantPropertySaveChangesInterceptor.cs`<br>- `ExceptionHandlingMiddleware.cs` chuẩn RFC 7807.<br>- `AuthController.cs` với các endpoint Login, RefreshToken, Revoke.<br>- Bitmask permission logic. |
| **Sinh viên kiểm tra & Sửa chữa** | - **Sửa chữa:** Bổ sung kiểm tra trường hợp Tenant hoặc Property bị vô hiệu hóa (`IsActive == false`) thì token lập tức mất hiệu lực.<br>- **Kiểm tra:** Viết 45 unit tests kiểm thử token rotation và chống tấn công Replay Attack. |
| **Lỗi AI phát hiện (Hallucination)** | AI quên gán `TenantId` trong một số trường hợp tạo entity mới dẫn đến lỗi NullReference -> Sinh viên bổ sung logic tự động inject `ICurrentTenantService` vào BaseEntity Handler. |
| **Commit Git đối chiếu** | `3f95339` — *feat(auth): implement Auth + RBAC - Phase 1A complete* |

---

### ENTRY #003: Hiện thực Phân hệ Danh mục Phòng & Hạng phòng (Phase 1B - Room Catalog)

| Tiêu chí | Nội dung chi tiết |
|:---|:---|
| **Thời gian thực hiện** | 06/10/2026 – 08/10/2026 |
| **Thành viên thực hiện** | Nguyễn Khởi Nguyên (`24TX810011`) |
| **Công cụ AI sử dụng** | GitHub Copilot & ChatGPT Plus |
| **Phạm vi công việc** | Xây dựng CRUD RoomType và Room theo mẫu CQRS, xây dựng UI Angular Catalog |
| **Nội dung Prompt chính** | *"Xây dựng MediatR Commands và Queries cho RoomType và Room trong .NET 10 theo mẫu đã có. Thêm ràng buộc không được xóa RoomType nếu còn Room trực thuộc. Viết component Angular 22 hiển thị danh sách phòng có phân trang và bộ lọc theo tầng."* |
| **Kết quả AI sinh ra** | - Bộ Command/Query/Handler/Validator cho Room và RoomType.<br>- Service gọi API Angular `room.service.ts`, `room-type.service.ts`.<br>- Component template Angular với Tailwind CSS. |
| **Sinh viên kiểm tra & Sửa chữa** | - **Sửa chữa:** Chuyển đổi mã nguồn Frontend do AI sinh ra (vốn dùng Angular template cũ) sang chuẩn Angular 22 Standalone Components với Signals (`signal()`, `computed()`).<br>- **Kiểm tra:** Kiểm tra ràng buộc Unique của `RoomNumber` trong cùng một chi nhánh. |
| **Lỗi AI phát hiện (Hallucination)** | AI sinh ra logic xóa cứng (Hard Delete) làm mất lịch sử đặt phòng -> Sinh viên đã sửa thành kiểm tra ràng buộc khóa ngoại với Reservation trước khi cho phép xóa. |
| **Commit Git đối chiếu** | `94c93fd` — *feat: Phase 1 complete - architecture foundation, auth & RBAC, feature scaffolds* |

---

### ENTRY #004: Hiện thực Máy trạng thái Buồng phòng & Concurrency Lock (Phase 1B - Housekeeping)

| Tiêu chí | Nội dung chi tiết |
|:---|:---|
| **Thời gian thực hiện** | 09/10/2026 – 12/10/2026 |
| **Thành viên thực hiện** | Trần Trọng Tân (`24TX810025`) |
| **Công cụ AI sử dụng** | Google Antigravity & Claude 3.5 Sonnet |
| **Phạm vi công việc** | Thiết kế máy trạng thái buồng phòng FSM, Concurrency Lock bằng `expectedOldStatus`, giao diện Housekeeping Board |
| **Nội dung Prompt chính** | *"Thiết kế Room Status FSM cho khách sạn gồm 5 trạng thái: Clean, Dirty, Cleaning, Occupied, OutOfService. Viết endpoint PATCH /api/rooms/{id}/status có cơ chế khóa lạc quan (Optimistic Concurrency) với tham số expectedOldStatus. Viết UI Angular Housekeeping Board đổi màu theo trạng thái phòng và tự cập nhật Optimistic UI."* |
| **Kết quả AI sinh ra** | - `RoomStatusTransitionValidator.cs`<br>- `UpdateRoomStatusCommand.cs`<br>- `housekeeping.page.ts` với đầy đủ thẻ phòng, chuyển đổi trạng thái và xử lý lỗi xung đột 409.<br>- Các hàm tiện ích tính KPI buồng phòng. |
| **Sinh viên kiểm tra & Sửa chữa** | - **Sửa chữa:** AI bỏ sót trường hợp phòng `OutOfService` hoàn tất bảo dưỡng chuyển về `Clean` -> Sinh viên tự bổ sung transition này vào validator.<br>- **Kiểm tra:** Viết bộ test `RoomStatusTransitionValidatorTests.cs` kiểm tra 100% các nhánh chuyển trạng thái. |
| **Lỗi AI phát hiện (Hallucination)** | AI sử dụng thư viện bên ngoài không cần thiết để quản lý state -> Sinh viên chủ động lược bỏ, sử dụng thuần Angular Signals gốc để tối ưu hiệu năng. |
| **Commit Git đối chiếu** | `4c810ac` — *feat(housekeeping): Trần Trọng Tân - implement housekeeping board and state machine* |

---

## KẾT LUẬN VỀ VIỆC ỨNG DỤNG AI TRONG ĐỒ ÁN

1. **Hiệu quả đạt được:**
   - AI giúp nhóm tăng tốc độ scaffold mã nguồn lặp lại (Boilerplate code, DTOs, Validators) lên hơn 60%.
   - Hỗ trợ rà soát nhanh các quy chuẩn lập trình và gợi ý cấu trúc tài liệu đồ án chuẩn chỉ.
2. **Nguyên tắc kiểm soát của nhóm:**
   - **Không sao chép nguyên văn:** Mọi đoạn mã AI sinh ra đều được thành viên trong nhóm trực tiếp đọc hiểu, đối chiếu logic nghiệp vụ và điều chỉnh theo kiến trúc chung.
   - **Kiểm thử độc lập:** Tất cả tính năng đều phải vượt qua unit tests và biên dịch thành công 0 warnings, 0 errors trước khi đưa vào kho mã nguồn chính.
