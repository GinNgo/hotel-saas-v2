# API tài khoản khách — đề xuất contract, 2026-10-18

## Trạng thái và phạm vi

PO đã yêu cầu thiết kế API tài khoản khách. Tài liệu này là đề xuất để review, KHÔNG mô tả endpoint đang hoạt động. Chưa thêm controller, migration hoặc nối UI với API mới. Không triển khai lại payment/operations của Tân hoặc catalog/reservation creation của Nguyên.

Mục tiêu: Profile hiển thị tài khoản thật, cập nhật tên và xem đặt phòng thuộc tài khoản. Không hiển thị điểm, hạng, hóa đơn hay lịch sử giả. Tái sử dụng User, Reservation, CQRS, ApiResponse và cơ chế xác thực hiện có; không thêm service, cache hay dependency.

## Actor, boundary và ownership

- Browser Profile → WebApi guest policy → Application query/command → Infrastructure EF → User/Reservation. Domain không phụ thuộc HTTP.
- Chỉ session đã xác thực có vai trò khách (Customer/Guest theo role thực tế trong source) được gọi. Staff/SuperAdmin không mặc nhiên được dùng guest API; cổng PMS giữ riêng.
- Subject lấy từ claims đã xác minh. Không nhận guestUserId, tenantId, propertyId từ payload để quyết định quyền. Không tin email/social ID trình duyệt cung cấp. Social login phải xác minh token với provider trước khi dùng làm nguồn identity.
- Quyền sở hữu reservation phải dựa trên liên kết account đã lưu và kiểm chứng trong source/schema; không suy luận bằng tên, email hoặc số điện thoại. Booking chưa liên kết không tự nhận về khi trùng thông tin.
- Một khách có thể đặt nhiều tenant. Guest query không được dùng tenant header tùy ý hoặc mở rộng quyền middleware chung. Cần review riêng đường đọc cross-tenant: tập reservation giới hạn bởi subject trước khi đọc dữ liệu và chỉ projection các trường được phép. Không dùng IgnoreQueryFilters toàn cục hay đưa raw entity về frontend.
- Nếu chưa chứng minh được ownership/filter an toàn thì chưa bật history; trả trạng thái chưa hỗ trợ, không fallback sang danh sách PMS.

## Contract đề xuất (prefix /api/guest)

Tất cả response dùng ApiResponse hiện có; field casing/error convention khớp serializer của repo. JSON dưới đây là hình dạng data, không phải response mẫu từ môi trường thật.

### GET /me

Data: `{ id, fullName, email, capabilities: { canEditName, canViewBookings } }`.
Email chỉ đọc, chỉ là verified khi có evidence provider/account verification trong schema; không tự thêm cờ true. Không trả password hash, refresh token, social identifiers hoặc membership giả. Cache-Control: no-store.

### PATCH /me

Payload allowlist `{ fullName }`; reject trường không được hỗ trợ, đặc biệt role/tenant/email/points. Tên trim, bắt buộc không rỗng, giới hạn theo entity/validator thật. Cập nhật qua command/FluentValidation. Trả projection /me và refresh identity trong session frontend. Không cho sửa email/phone ở vòng này vì chưa có contract xác minh. Không dùng browser-local save như thành công server.

Concurrency: đề xuất ETag/If-Match cho cập nhật hồ sơ; token dựa trên concurrency primitive được xác minh trong schema. Nếu cần thêm cột phải có thiết kế migration/rollback được duyệt trước; không tự tạo migration. 412 khi version cũ, 428 khi thiếu precondition nếu contract ETag được chọn. Không tuyên bố đã có optimistic concurrency.

### GET /bookings?page=1&pageSize=10

PageSize tối đa đề xuất 50, reject số âm/không nguyên. Sort ổn định createdAtUtc desc, id desc; không nhận SQL sort tùy ý. Data `{ items, page, pageSize, totalCount }`, mỗi item gồm `{ id, reference, property: { name, slug }, roomTypeName, rentalType, startAtUtc, endAtUtc, status, totalAmount, currency }` từ snapshot/contract thật. Snapshot thiếu phải hiển thị thiếu, không lấy dữ liệu tenant khác để lấp.

Chỉ trả reservation có ownership đã xác minh; không trả lookupToken, ghi chú nội bộ, thông tin khách khác, room access code, chi tiết thẻ/payment credentials. Trạng thái giữ nguyên enum/server mapping hiện hữu, không suy diễn hold thành Confirmed. Dùng AsNoTracking và projection; đo query plan trước khi quyết định index mới. Không chạy đo trên DB thật trong task thiết kế này.

### GET /bookings/{id}

Tra theo cả id VÀ subject; id ngoài ownership trả 404 cùng dạng với id không tồn tại. Data dùng cùng snapshot ở list, bổ sung chính sách/deposit/expiry từ nguồn có thật nếu được phép công khai. Không gọi endpoint PMS rồi lọc phía trình duyệt. Không dùng token tra cứu public làm quyền mặc định cho guest API.

### Ngoài vòng đầu

- Folio/receipt/invoice: chưa thêm endpoint. Phải chốt phân biệt phiếu thanh toán và hóa đơn pháp lý, trường thuế/PII và quyền tải trước; không render invoice giả.
- Loyalty: chưa thêm endpoint hoặc tự động ghi danh. Cần chốt consent, tenant vs platform membership, ledger, quy đổi/hoàn điểm và lifecycle. Không cộng/trừ điểm trong profile command.
- Nhận booking cũ vào account: cần challenge xác minh và quy tắc chống chiếm booking riêng. Không tự gán bằng email trùng.
- Hủy/đổi booking/thanh toán: tái sử dụng nghiệp vụ được duyệt, thiết kế quyền guest riêng sau; không sao chép logic của đội operations.

## Errors, privacy và vận hành

- 401 token thiếu/hết hạn; 403 sai vai trò; 404 sai ownership/không tồn tại; 400 validation; concurrency dùng contract ở trên sau khi duyệt. Lỗi theo error envelope hiện có, không lộ stack trace hay existence booking khác.
- Logout/đổi tài khoản xóa cache/list/detail và bỏ response đang bay của session trước; API response không cache ở shared proxy. UI có loading/empty/error/retry, không thay bằng demo.
- Log correlationId, endpoint, subject nội bộ và outcome; không log token, request full PII hoặc nội dung hóa đơn. Audit thay đổi profile với trường tối thiểu theo retention policy hiện có.
- Dùng auth/rate-limit hiện hữu. Chưa có số liệu tải nên không bịa capacity/SLA. Pagination giới hạn chi phí; chỉ thêm index nếu đo được nhu cầu.
- Không thay deployment/topology. Rollout đọc /me trước, history sau security tests; giữ UI honest-unavailable nếu capability tắt. Nếu cần schema, lập migration và rollback riêng, PO duyệt trước khi chạy bất cứ môi trường nào.

## Tasks và acceptance theo dependency

1. Kiểm kê claims/roles, User và liên kết Reservation; ghi bằng chứng ownership và tenant-filter strategy. Review security trước bước 3.
2. Chốt /me, allowlist tên, concurrency primitive và error envelope; thêm contract tests 401/403/400, không mass assignment.
3. Triển khai read history/detail sau khi bước 1 được duyệt; test khách A/B, tenant A/B, staff, missing context, account chưa có liên kết, booking không tồn tại, phân trang ổn định. Không chạm DB thật; dùng test doubles hoặc DB test cô lập được xác nhận.
4. Nối Profile qua core service, signals/OnPush; tests logout A → login B, request cũ không ghi đè, empty/error/retry, refresh session sau edit.
5. Review full stack và accessibility; chỉ đánh dấu hoàn thành khi source/tests thực tế đạt, không coi báo cáo là evidence.

## Quyết định còn cần PO trước triển khai mở rộng

- Chấp thuận contract cập nhật tên/concurrency và cách đọc ownership cross-tenant sau kiểm kê source.
- Có cho nhận booking anonymous cũ không, xác minh bằng gì?
- Phạm vi loyalty từng tenant hay toàn sàn, consent và quy tắc ledger?
- Receipt hay hóa đơn pháp lý, retention và dữ liệu thuế nào được khách sửa?

Trong lúc chờ, Profile chỉ hiển thị identity thật và tra cứu công khai hiện có; các tính năng chưa có API phải được mô tả rõ là chưa hỗ trợ.
