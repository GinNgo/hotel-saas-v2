# Review tích hợp code Tân — 17/10/2026

## Findings cần sửa

### P1 — Poll buồng phòng có thể ghi đè dữ liệu chi nhánh mới

- Source: `frontend/src/app/features/housekeeping/housekeeping.page.ts:599`, callback ghi `rooms` và `totalCount` tại dòng652.
- `pollServerSync()` subscribe riêng, không lưu subscription, không chụp property/request generation/filter. Khi đổi chi nhánh hoặc bộ lọc, request poll cũ vẫn có thể hoàn thành sau request danh sách mới và ghi dữ liệu cũ vào bảng. `ngOnDestroy()` cũng không hủy request poll đang chạy.
- Sửa tối thiểu: hủy poll khi đổi context/destroy; chụp property + generation và kiểm tra trước mọi callback, kể cả lỗi. Invalidate khi đổi filter/page; không để poll cũ đè response mới hoặc trạng thái sau mutation.
- Test cần thêm: Subject poll A pending → đổi B → B success → A late success/error; đổi filter trong lúc poll; destroy trước response. Đây là kết luận source review, chưa chạy race test độc lập.

### P1 — Retry thu tiền tạo khóa idempotency mới

- Source: `frontend/src/app/features/payments/payments.page.ts:1775`.
- Mỗi lần `submitPayment()` tạo UUID mới. Nếu server đã ghi nhận nhưng response mất, bấm lại sẽ là giao dịch mới. Với thanh toán một phần, số dư vẫn còn đủ nên guard chống vượt dư nợ không bảo vệ được việc thu trùng.
- Sửa tối thiểu: giữ khóa và snapshot payload cho cùng một ý định thu tiền qua lỗi kết nối/retry; chỉ đổi khóa khi bắt đầu ý định mới hoặc payload/context thay đổi có chủ đích. Không tự retry mutation với payload đã đổi.
- Test cần thêm: lần đầu response mất, retry giữ nguyên key/payload; thành công hoặc đổi reservation/property phải reset ý định. Chưa mô phỏng mất response thực tế.

### P2 — Báo cáo ca không cập nhật sau thu tiền; xử lý403 chưa đồng bộ

- Source: `frontend/src/app/features/payments/payments.page.ts:1815`: success chỉ refresh folio, summary và payments, không gọi `loadShiftReport()`. Báo cáo ca tiếp tục hiển thị tổng cũ đến khi người dùng refresh/đổi ca.
- Tại dòng1423, lỗi shift-report chỉ đặt thông báo, không dùng `handleAccessDenied()` như summary/list. Vì vậy403 của API ca không kích hoạt cùng cơ chế xóa/latch dữ liệu tài chính.
- Sửa: refresh stream ca sau mutation thành công; đồng bộ chính sách403 với hai stream hiện hữu. Test tổng ca đổi sau thu và403 ca xóa dữ liệu theo contract.

### P2 — Tìm khóa idempotency lẫn metadata với nội dung tham chiếu public

- Source: `backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs:173` và dòng325.
- Nhánh mới dùng `TransactionRef.Contains(ikTag)` nhưng phần `cleanRef` từ public request chỉ Trim, không escape dấu ngoặc như CreatePayment tại quầy. Chuỗi người dùng có thể chứa `[IK:...]`, bị nhận nhầm là khóa hệ thống trong lần lookup tiếp theo; gây conflict sai giữa các reservation hoặc chọn nhầm bản ghi replay.
- Sửa tối thiểu: chỉ match prefix metadata do server tạo, không tìm toàn bộ nội dung người dùng; đồng bộ sanitization và parser giữa public confirm, manual payment, folio. Chưa đề xuất schema/dependency mới.
- Test: tham chiếu người dùng chứa token `[IK:...]`/`[PURPOSE:DEPOSIT]` không làm đổi khóa hay phân loại giao dịch khác. Chưa chạy integration test DB.

## Kết quả merge

- Đã fetch origin và fast-forward **develop local** từ `ec98505` tới `efb6f81`, nhận3 commit của `origin/feature/tan-operations`. Không tạo merge commit, không push.
- Phạm vi32 file, gồm lễ tân, buồng phòng, thu ngân, báo cáo ca và báo cáo tuần2. Không merge riêng nhánh Nguyên hoặc nhánh housekeeping cũ.
- Giữ nguyên các thay đổi local có trước: `IApplicationDbContext.cs`, `ApplicationDbContext.cs`, ba entity/enum PrintTemplateConfig/TenantContract/TenantContractStatus. Không stash/reset/ghi đè.

## Đối chiếu báo cáo và thuật toán

- Đã đọc `BAO-CAO-TUAN-2-TRAN-TRONG-TAN-24TX810025.md`. Không tìm thấy báo cáo thuật toán riêng có tên rõ ràng trong docs; đánh giá ở đây áp dụng thuật toán/luồng ca, folio, idempotency và đồng bộ liên quan code Tân.
- Ranh giới ca dùng VN UTC+7 và điều kiện `[startUtc, endUtc)`; ca đêm kết thúc06:00 hôm sau. Cách chia khoảng không chồng tại14:00/22:00/06:00 là đúng theo source. Chưa xác nhận thực thi SQL/DB.
- Folio tính dư nợ `TotalAmount - sum(Completed)`; cọc nằm trong payment, không bị trừ lần hai. Breakdown thiếu Category trảnull thay vì tự bịa tiền phòng. Chưa kiểm chứng dữ liệu thực hoặc toàn bộ snapshot legacy/loyalty.
- KPI buồng phòng có guard danh sách rỗng, tính clean/total và dirty+cleaning tuyến tính O(n). Đây là KPI của danh sách truyền vào, không chứng minh KPI toàn chi nhánh nếu danh sách đang phân trang/lọc.
- Không coi signal trong một trình duyệt là realtime liên thiết bị; liên thiết bị hiện dựa poll10s và còn race nêu trên. Không xác thực độc lập tuyên bố manual test trong báo cáo.
- Báo cáo giữ minh chứng feature branch là hợp lý; merge local chưa chứng minh origin/develop hoặc PR/CI đã hoàn tất.

## Validation thực chạy

- Frontend cwd `C:\Dev\hotel-saas-v2\frontend`:
  - `node node_modules/vitest/vitest.mjs run src/app/features/payments/payments.page.spec.ts src/app/features/reservations/reservations.page.spec.ts src/app/features/housekeeping/housekeeping.page.spec.ts src/app/core/services/payment.service.spec.ts src/app/core/services/reservation.service.spec.ts`: **exit1,96 pass/6 fail,4 file pass/1 file fail**. Payments mounted tests lỗi render nội dung empty-state; stderr NG0303 với input iconClass/description. Shared component có signal inputs tương ứng và production build pass, nên cần kiểm tra JIT/test setup trước khi kết luận production template sai. Chưa quy kết lỗi này mới phát sinh từ branch Tân vì chưa chạy baseline riêng.
  - `npm run build`: **exit0**, có warning sweetalert2 CommonJS. Không đạt tiêu chí0 warning trong AGENTS.
- Repo cwd `C:\Dev\hotel-saas-v2`:
  - `dotnet build backend/HotelSaas.slnx --no-restore --verbosity minimal`: **exit1,2 errors/2 warnings**. Test double `GetPublicPropertiesSyntheticTests.TestApplicationDbContext` thiếu TenantContracts và PrintTemplateConfigs do interface local chưa đồng bộ. Không quy lỗi này cho merge Tân. Có MSB3277 EFCore.Relational10.0.4 vs10.0.12.
- Không chạy backend integration tests vì suite Payment dùng PostgreSQL thực; chưa chuẩn bị/kiểm tra môi trường test cô lập. Không kết nối DB dev/prod/staging, không migrate/deploy. Không sửa implementation hay dependency trong lần review này.

## Thứ tự tiếp theo

1. Sửa poll race và idempotency retry, thêm regression tests.
2. Đồng bộ báo cáo ca/403 và metadata parser public/manual.
3. Hoàn thiện test doubles của thay đổi local, kiểm tra EF package resolution và cấu hình mounted tests; chạy lại quality gates trước push/PR.
