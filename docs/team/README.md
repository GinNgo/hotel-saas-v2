# 🏨 Bộ Tài Liệu Kỹ Thuật & Kế Hoạch Bàn Giao Nhóm Phát Triển (Team Enablement Package)
## Dự Án: Hotel SaaS Platform v2 (.NET 10 + PostgreSQL 17 + Angular 22)

> **Mã gói:** `TEAM-ENABLEMENT-01` | **Phiên bản:** 1.1 (Hiệu chỉnh theo chỉ đạo PO & Reviewer)  
> **Ngày lập:** 2026-10-09 | **Trạng thái:** Bản Thảo Trình Product Owner (PO) Phê Duyệt  
> **Nguyên tắc thực thi:** **CHỈ TÀI LIỆU, KẾ HOẠCH & BẰNG CHỨNG LOCAL AN TOÀN**.  
> Tuyệt đối KHÔNG deploy, KHÔNG tạo database, KHÔNG chạy migration và KHÔNG kết nối vào CSDL staging để thay đổi dữ liệu.  
> Giữ nguyên các điểm blocker hiện hữu: **P2B-02** (chờ Reviewer thẩm định độc lập) và **P3A** (chờ PO duyệt đặc tả).

---

## 1. TỔNG QUAN & QUYẾT ĐỊNH CỦA PRODUCT OWNER (PO)

Theo quyết định định hướng từ Product Owner (PO):
1. **Môi Trường Staging Dùng Chung:**
   - Sử dụng một cơ sở dữ liệu staging tập trung (`hotel_saas_staging`) phục vụ việc tích hợp hệ thống, kiểm thử liên module (cross-testing giữa frontend và backend) và demo cho các bên liên quan.
   - Cơ sở dữ liệu này được thiết kế tách biệt hoàn toàn khỏi database phát triển local (`hotel_saas_dev_{user}`), database kiểm thử tự động (`hotel_saas_p1b01a_test`) và database production (`hotel_saas_prod`).
2. **Mô Hình Nhân Sự Full-Stack Theo Module (Phân Công Đề Xuất):**
   - Hai kỹ sư chính của dự án là **Nguyên** và **Tân** được đề xuất đảm nhiệm vai trò **Full-Stack Engineer** (phụ trách cả Frontend và Backend theo từng module được giao).
   - **Nguyên** (Đề xuất): phụ trách module **Xác thực & Chuyển đổi ngữ cảnh chi nhánh** (`FE-AUTH-01`).
   - **Tân** (Đề xuất): phụ trách module **Quản lý Danh mục Phòng & Loại phòng** (`FE-ROOM-01`).
   - Module **Bảng Trạng Thái Buồng Phòng** (`FE-HK-01`) tạm hoãn phân công, chờ sau khi hoàn tất ngữ cảnh và danh mục phòng.
   - Hai thành viên thực hiện **Review chéo (Peer Cross-Review)** cho nhau; **Reviewer Kỹ Thuật (Technical Reviewer / Tech Lead)** chịu trách nhiệm nghiệm thu kỹ thuật cuối cùng trước khi PO đánh giá nghiệm thu sản phẩm.
3. **Đóng Băng Hợp Đồng Backend (Contract Freeze):**
   - Không tự ý thay đổi backend API contracts nếu giao diện người dùng (UI) có thể tích hợp với các API hiện có. Mọi điều chỉnh format response phải được giải quyết qua tầng adapter/service ở frontend hoặc thông qua quy trình RFC nếu thực sự cần thiết.
   - Không tự ý tạo task BE mới nằm ngoài phạm vi tích hợp của các module đã được phê duyệt.
4. **Vòng Đời Trạng Thái Công Việc (Task Lifecycle):**
   - Vòng đời: `Backlog` $\to$ `Ready` $\to$ `In Progress` $\to$ `In Review` $\to$ `Changes Requested` $\to$ `Done`.
   - **Quy tắc chuyển trạng thái:** Các task chưa được PO phê duyệt chính thức bắt buộc giữ ở trạng thái **`Backlog`**. Kỹ sư và AI Agent chỉ được phép đưa ticket tối đa đến trạng thái `In Review`. **Tuyệt đối không tự ý đánh dấu `Done`**. Trạng thái `Done` thuộc quyền quyết định độc lập của Reviewer Kỹ Thuật và PO.

---

## 2. BẢN ĐỒ TÀI LIỆU (DOCUMENTATION SITEMAP)

Gói tài liệu enablement được tổ chức thành các chuyên đề rõ ràng trong thư mục `docs/team/` (sử dụng liên kết tương đối):

| Tên File | Chuyên Đề | Nội Dung Chính | Đối Tượng Sử Dụng |
| :--- | :--- | :--- | :--- |
| [`README.md`](./README.md) | **Tổng quan gói Enablement** | Mục tiêu, quyết định PO, ranh giới an toàn, bản đồ tài liệu và checklist PO cần duyệt. | Toàn bộ team, PO, Reviewer |
| [`onboarding.md`](./onboarding.md) | **Hướng dẫn Onboarding thành viên** | Chuẩn hóa môi trường (Node v22.22.3, npm 11.13.0, .NET 10, PG17), setup DB riêng, seed dữ liệu mẫu với input an toàn (không hardcode password), chạy local. | Nguyên, Tân, Developer mới |
| [`database-guide.md`](./database-guide.md) | **Kiến trúc & Vận hành CSDL** | Quy ước DB cá nhân, thiết kế Staging tập trung, role `migration_owner`, default privileges đúng scope, thu hồi quyền `PUBLIC`, VPN/SSH, checklist STAGING-SETUP-01. | Backend, DevOps, DBA, PO |
| [`user-guide.md`](./user-guide.md) | **Hướng dẫn Sử dụng & Vận hành UI** | Hướng dẫn luồng Auth/Context Selector, ảnh màn hình thực tế trong `./assets/screenshots/`, trạng thái các trang ("Chưa có" nếu chưa code), mã lỗi thường gặp, đề xuất E2E. | Nguyên, Tân, Tester, PO |
| [`task-board.md`](./task-board.md) | **Bảng Công Việc & Task Full-Stack** | Chi tiết tickets FE-AUTH-01, FE-ROOM-01, FE-HK-01, DOC-API-01; scope, tiêu chí nghiệm thu DoD, files được phép sửa, drafts GitHub Issues. Tất cả ở `Backlog`. | Nguyên, Tân, Reviewer, PO |
| [`review-checklist.md`](./review-checklist.md) | **Checklist Kiểm Duyệt & Nghiệm Thu** | Quy trình review chéo 3 cổng, checklist an toàn bảo mật multi-tenant, kiểm thử hồi quy 220 tests, tiêu chí chuyển trạng thái ticket. | Nguyên, Tân, Reviewer |
| [`ui-test-plan.md`](./ui-test-plan.md) | **Kế Hoạch Kiểm Thử Giao Diện** | Chiến lược kiểm thử UI (Unit, Component, E2E cô lập), ma trận kịch bản test (Happy path, 409 stale conflict, switch context). Không tự ý cài đặt package. | Nguyên, Tân, QA/Tester |

---

## 3. TỔNG HỢP PHÁT HIỆN KỸ THUẬT TỪ SOURCE & TESTS (FINDINGS REGISTER)

Quá trình đối chiếu chéo giữa mã nguồn, API controllers, bộ test suite tự động và tài liệu handoff ghi nhận các phát hiện kỹ thuật sau:

1. **Finding F-01 (Định Dạng Response Giữa Auth Controller và Frontend DTOs):**
   - *Thực tế Backend:*
     - Endpoint `POST /api/auth/login` và `POST /api/auth/refresh-token` trả về trực tiếp object `LoginResponse` ở root: `{ accessToken, refreshToken, expiresAtUtc, user, memberships }` (không bọc qua `{ success, data }`).
     - Endpoint `POST /api/auth/switch-context` và `GET /api/auth/me/memberships` trả về bọc trong `{ success = true, data = ... }`.
     - Endpoint `GET /api/rooms` và `GET /api/room-types` trả về trực tiếp object `PagedResult<T>` ở root: `{ items, totalCount, page, pageSize, ... }`.
   - *Thực tế Frontend:*
     - `AuthService.login()` trong file `auth.service.ts` đang gán kiểu `Observable<ApiResponse<LoginResponse>>` và kiểm tra điều kiện `if (response.success && response.data)`.
   - *Giải pháp & Ranh giới:* Tuân thủ nguyên tắc **Contract Freeze** của PO, kỹ sư Frontend (Nguyên) trong ticket `FE-AUTH-01` sẽ cập nhật `AuthService` ở tầng client để xử lý tương thích linh hoạt cả hai định dạng response mà không sửa mã nguồn backend.

2. **Finding F-02 (Cấu Trúc Thực Tế Của `UserMembershipDto`):**
   - *Thực tế Backend (`UserMembershipDto.cs`):* Gồm các trường `{ id, tenantId, tenantName, tenantCode, propertyId, propertyName, propertyCode, staffRole, roleName, isTenantWide }`.
   - *Lưu ý:* Trường `propertyId` có giá trị `null` đối với quyền toàn tập đoàn (`isTenantWide = true`) và bị omit khỏi JSON bởi `JsonIgnoreCondition.WhenWritingNull`.
   - *Đính chính tài liệu cũ:* Trong bản thảo handoff v1.2 có ví dụ JSON chứa `role` và `isDefault: true` - hai trường này **không tồn tại** trong contract backend. Bảng task và hợp đồng API trong gói này đã được chuẩn hóa lại 100% khớp với source code C#.

3. **Finding F-03 (Bảo Vệ Database Target Của `BE-SEED-01`):**
   - Công cụ seeding `LocalDevDataSeeder` có cơ chế bảo vệ fail-closed `ValidateTargetDatabase`: chỉ cho phép database cá nhân `hotel_saas_dev_{username}` hoặc database test có cờ `--allow-test-db`.
   - Công cụ **từ chối tuyệt đối** bất kỳ database nào chứa từ khóa `staging` hoặc tên `hotel_saas_staging`.
   - *Quyết định PO:* Giữ nguyên guard an toàn này của `BE-SEED-01`. Không sửa code để bypass. Khi triển khai staging trong tương lai, sẽ lập phương án provisioning staging riêng (`BE-SEED-STAGING-01`) trình PO phê duyệt.

4. **Finding F-04 (Bảo Toàn Trạng Thái Blocker P2B-02 và P3A):**
   - Toàn bộ kết quả chạy test tự động 220/220 PASS chứng minh tính ổn định của mã nguồn hiện tại trong môi trường test harness, nhưng **không thay thế cho quyết định nghiệm thu độc lập**.
   - Blocker **P2B-02** (5 tiêu chí của Reviewer) tiếp tục giữ trạng thái **Chờ Reviewer Nghiệm Thu Độc Lập**.
   - Blocker **P3A** (6 quyết định sản phẩm) tiếp tục giữ trạng thái **Bản Thảo Chờ PO Phê Duyệt**.

5. **Finding F-05 (An Toàn Credentials & Cơ Chế Mật Khẩu Khi Seed):**
   - Không hardcode mật khẩu cố định trong tài liệu.
   - Khi chạy seed local, mật khẩu do người vận hành tự cung cấp qua tham số hoặc biến môi trường `SEED_DEFAULT_PASSWORD` / prompt bảo mật.
   - Thuật toán seeding có tính lũy kế: chạy lại seed **không đổi mật khẩu của tài khoản đã tồn tại**, bảo toàn hash mật khẩu hiện có trong database.
   - Tài khoản staging hoàn toàn tách biệt và **chưa được provision**.

---

## 4. CHECKLIST DÀNH CHO PRODUCT OWNER (PO) PHÊ DUYỆT TRƯỚC KHI THỰC THI

Trước khi team chuyển các ticket từ `Backlog` sang `Ready` để bắt tay vào code hoặc khởi tạo hạ tầng staging, PO cần xem xét và phê duyệt các hạng mục sau:

- [ ] **1. Phê duyệt phân công Full-Stack:** Đồng ý đề xuất Nguyên phụ trách `FE-AUTH-01`, Tân phụ trách `FE-ROOM-01`, giữ `FE-HK-01` chờ sau.
- [ ] **2. Phê duyệt thiết kế CSDL Staging:** Đồng ý kiến trúc `hotel_saas_staging`, role `migration_owner`, tài khoản cá nhân read-only `dev_nguyen` / `dev_tan`, kết nối qua VPN/SSH tunnel.
- [ ] **3. Phê duyệt chính sách cấp phát Secret Staging:** Đồng ý cấp phát credentials qua kênh bí mật (Vault/Password Manager), không lưu trữ trong Git/chat.
- [ ] **4. Phê duyệt checklist STAGING-SETUP-01:** Xem xét 8 hạng mục hạ tầng Staging (hiện đang ở trạng thái `Pending`).
- [ ] **5. Phê duyệt kế hoạch kiểm thử UI:** Đồng ý chiến lược E2E trên môi trường cô lập, không cài thêm dependency hoặc đặt lịch tự động ngoài repo.
- [ ] **6. Giữ nguyên ranh giới Blocker:** Xác nhận P2B-02 và P3A chưa được nghiệm thu cho đến khi có văn bản phê duyệt riêng.
