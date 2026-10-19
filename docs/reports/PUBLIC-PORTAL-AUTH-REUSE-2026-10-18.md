# Public Home, cổng đăng nhập và khảo sát tái sử dụng — 18/10/2026

## Findings quan trọng trước khi tích hợp social/payment

### CRITICAL — Social login mới chưa xác minh danh tính nhà cung cấp

Source hiện tại `backend/src/HotelSaas.Application/Auth/Commands/SocialLogin/SocialLoginCommand.cs` nhận ProviderSubject/ProviderEmail từ request, tìm/liên kết user theo email và cấp token. `AuthController` công khai endpoint social-login. Không có bước xác minh Google ID token/Facebook access token trước liên kết trong handler đã đọc. `login.page.ts` còn gửi danh tính demo cố định.

Không coi đây là OAuth hoạt động an toàn. Người gọi có thể tự khai danh tính/email thay vì chứng minh sở hữu. Không deploy hoặc nhập tài khoản thật. Đã hỏi PO cho phép tạm khóa endpoint đến khi có verifier thật; lần sửa này chưa sửa backend hoặc tuyên bố đã khóa.

### HIGH — VNPay hiện có chưa đủ điều kiện nghiệm thu sandbox

- `VnpayPaymentService` có fallback merchant/signing-secret hardcode; không sao chép các giá trị này sang tài liệu hoặc môi trường khác. Cần cấu hình rõ ràng và fail-closed khi thiếu, không suy mặc định là credential sử dụng hợp lệ.
- Payload ký đang dùng raw value, còn request URL encode riêng; bản cũ có canonicalPayload URL-encode tên và giá trị trước ký. Cần official golden-vector/encoding tests (tiếng Việt, khoảng trắng, dấu+, URL lồng) trước khi tuyên bố hai cách tương đương.
- `ProcessVnpayIpnCommand` chỉ từ chối amount khi đồng thời chênh trên100 và dưới20% tổng đơn. Ví dụ tổng1.000.000, callback amount300.000 không bị nhánh này từ chối; sau đó có đường Confirmed. Phải đối chiếu đúng expected payment intent/amount/deposit, không tự quyết chính sách20% từ code demo.
- Callback đang lookup reservation bằng confirmationCode/ID và lock nhưng cần audit transaction, unique payment attempt/TxnRef, merchant/property mapping, replay và amount trước khi bật thật. Chưa chạy callback/DB/gateway.
- ReturnUrl mặc định trỏ `/booking/vnpay-return`, nhưng route này chưa xuất hiện trong app.routes đã khảo sát. Không coi redirect trình duyệt thành bằng chứng đã thu tiền.

## Nguyên nhân có thể kéo Home về đăng nhập đã xác minh bằng tests

1. Root route trong working tree hiện đã redirect `/` → `/booking`, booking không có authGuard. Không thay đổi root hoặc nhận công phần sửa local có trước.
2. errorInterceptor trước đây gọi logout khi bất kỳ request401 không có refresh token, kể cả `/api/public/...`. Logout điều hướng `/login`;403 cũng đẩy `/forbidden`. Đây là đường redirect phụ, không phải chỉ root routing.
3. AuthService trước đây khôi phục property và tự gọi `/auth/me/memberships` cho Customer khi không có cached branch; lỗi quyền ở API này có thể làm khách rời Home. Login khách cũng có nhánh tự tải staff memberships.
4. authGuard trước đây cho mọi access token chưa hết hạn vào layout quản lý; pages plans/contracts thiếu guard SuperAdmin ở cả alias có prefix và không prefix. API admin hiện đã được middleware giới hạn SuperAdmin; FE cần khớp contract này.

## Thay đổi thực hiện (bounded slice)

- `core/interceptors/error.interceptor.ts`: lỗi401/403 public booking được trả về component xử lý, không logout/đổi trang; auth public endpoints tự hiển thị lỗi. Phân loại pathname, không dùng query chứa public path để bypass protected handling. Protected401/403 giữ hành vi cũ.
- `core/guards/auth.guard.ts`: PMS cho TenantStaff/SuperAdmin; Customer/Guest về profile; role lạ fail-closed; chưa đăng nhập chuyển `/auth/login?portal=admin&returnUrl=...` bằng UrlTree.
- Export platformAdminGuard và gắn plans/contracts ở hai nhóm routes; chỉ SuperAdmin theo contract backend hiện hữu.
- `core/services/auth.service.ts`: Customer/Guest không lấy staff memberships khi init/login; xóa property context còn sót khi vào session khách. Không tạo token store hoặc provider mới.
- Thêm regression tests services/guard/interceptor và Router navigation dùng stub lazy components. Không sửa styling/layout, không thêm dependency hoặc sửa role/API/backend/schema.

## Phân khu hiện tại và giới hạn

| Khu vực | URL hiện hữu | Hành vi |
|---|---|---|
| Khách công khai | `/`, `/booking`, `/booking/properties/:slug`, `/booking/lookup` | Không yêu cầu tài khoản |
| Đăng nhập khách | `/auth/login?portal=guest` | UI portal khách hiện hữu; đăng nhập password dùng API hiện hữu |
| Đăng nhập vận hành | `/auth/login?portal=admin` | UI portal PMS hiện hữu, guard tự chọn portal này |
| PMS | `/admin/dashboard`, `/admin/rooms`, `/admin/reservations`, `/admin/payments` và aliases | Token staff + permission guards hiện hữu; Customer bị chặn khỏi management layout |
| Admin nền tảng | `/admin/plans`, `/admin/contracts` và aliases | SuperAdmin; backend middleware vẫn là authority thực |

Hai login portal hiện vẫn dùng chung component, API password và token store. Đây là tách luồng truy cập/quyền, KHÔNG phải hai session độc lập hoặc hệ OAuth đã hoàn tất. Chưa thiết kế lại taxonomy `/admin` thành `/pms` vì dễ phá các link hiện có. Login staff hiện vẫn có nhánh về dashboard sau chọn chi nhánh; việc honor đầy đủ returnUrl có thể làm ở slice tiếp theo cùng kiểm tra safe destination.

## Dự án cũ: tái sử dụng có chọn lọc

Đọc read-only checkout `C:\Projects\He-thong-quan-ly-khach-san`, commit quan sát `7e7ed12`. Không đọc/copy .env, backup hoặc DB khách hàng; không chạy mã/migration/seeder của project cũ.

- Google: `backend/src/main/java/com/hotel/services/social/GoogleIdentityVerifier.java` xác minh ID token với audience cấu hình và email_verified. Tái sử dụng yêu cầu bảo mật/test cases, không copy Java nguyên vào .NET hoặc dùng client-provided email làm authority.
- Facebook: `.../services/social/FacebookIdentityVerifier.java` có verifier riêng và tests; cần đối chiếu provider proof/app binding/error handling khi port. Chưa chứng nhận toàn bộ verifier Facebook hoặc thực OAuth handshake.
- VNPay: `.../services/payment/VnpayPaymentGateway.java`, `VnpayConfig`, `VnpayPaymentGatewayTest.java`: tham chiếu canonical signing/verification và test cases. Cần checkout frontend/BE v2 thống nhất amount/TxnRef/callback/return route, và dùng sandbox merchant được chủ sở hữu cung cấp an toàn.
- Dữ liệu mẫu: ưu tiên catalog property/roomtype/amenity và ảnh có nguồn/quyền; không reuse booking/payment/user/password/token/PII. Fixture demo phải có tenant→property→roomtype→room mapping nhất quán, không tự nhập DB hoặc ghi thành dữ liệu thực. Chưa import seed/assets ở slice này.

## Validation

- Red phase guard/interceptor:10 failed/4 passed, thể hiện redirect public và token khách vào management trước fix.
- Router tests sau sửa JSDOM Event realm:4 failed/7 passed trước gắn platform guard, chứng minh staff vào plans/contracts khi thiếu guard.
- AuthService red phase:3 failed/1 passed trước chặn restore staff context và membership fetch cho khách.
- Green targeted4 files:29/29 passed, exit0. Lệnh từ frontend:
  `node node_modules/vitest/vitest.mjs run src/app/app.routes.spec.ts src/app/core/guards/auth.guard.spec.ts src/app/core/interceptors/error.interceptor.spec.ts src/app/core/services/auth.service.spec.ts`
- Route tests dùng Router navigation thật nhưng lazy page/layout stub: kiểm tra route/guard, KHÔNG chứng minh full Home/browser/native auth hay kết nối provider.
- `npm run build` từ frontend: exit0, Angular build83.930s; còn warning sweetalert2 CommonJS có sẵn, chưa đạt yêu cầu0 warning. Không coi build thành nghiệm thu OAuth/VNPay.
- Không backend startup/tests/DB/migration/deploy/commit/push. Working tree có nhiều thay đổi khác đang làm; không quy toàn bộ diff cho task này.

## Next / cần PO

1. Quyết định tạm khóa social-login chưa có verifier (đã hỏi), rồi triển khai xác minh provider token thật và account-linking có proof; cần public client IDs/registered callbacks, secret lưu ngoài source. Không dùng danh tính demo để nghiệm thu.
2. Chốt expected payment amount/deposit theo intent hiện hữu, sửa callback/signing/replay trước chạy sandbox; không đưa tiền/thông tin ngân hàng thật vào tests.
3. Bổ sung VNPay return page chỉ hiển thị/poll trạng thái server, không tự xác nhận từ query string; chuẩn bị fixture demo riêng sau kiểm tra quyền và mapping.
