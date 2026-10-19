# BÁO CÁO TIẾN ĐỘ TUẦN 02 — TRẦN TRỌNG TÂN

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

## THÔNG TIN CHUNG

* **Mã đề tài:** 578
* **Tên đề tài:** Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2)
* **Sinh viên thực hiện:** Trần Trọng Tân — `24TX810025`
* **Email sinh viên:** `24tx810025@student.hcmute.edu.vn`
* **Giảng viên hướng dẫn:** Huỳnh Xuân Phụng
* **Phạm vi tuần 02:** Giao diện vận hành lễ tân, liên thông buồng phòng và thu ngân.
* **Kế hoạch phân công:** [Kế hoạch chi tiết tuần 2](../team/KE-HOACH-CHI-TIET-TUAN-2.md)
* **Kho mã nguồn:** [GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
* **Nhánh thực hiện:** [`feature/tan-operations`](https://github.com/GinNgo/hotel-saas-v2/tree/feature/tan-operations)
* **Commit minh chứng:** [`f711156`](https://github.com/GinNgo/hotel-saas-v2/commit/f711156) — `feat(Tran Trong Tan): implement receptionist operations and cashier reporting`

## PHẦN I. TỔNG QUAN KẾT QUẢ TUẦN 02

Tuần 02 tập trung nối quy trình đặt phòng đã có với thao tác thực tế tại quầy: nhận phòng, thu tiền, trả phòng và bàn giao phòng bẩn cho bộ phận buồng phòng. Giao diện sử dụng API và trạng thái lưu tại backend thay vì tự đổi trạng thái chỉ ở phía trình duyệt.

| Hạng mục trong kế hoạch | Kết quả triển khai | Minh chứng chính |
| :--- | :--- | :--- |
| Check-in / Check-out | Modal xác nhận nhận/trả phòng, kiểm tra trạng thái và công nợ trước khi trả phòng | `reservations.page.ts` |
| Liên thông buồng phòng | Sau Check-out, phòng chuyển sang `Dirty`; bảng buồng phòng cập nhật trạng thái | `housekeeping.page.ts`, API Check-out hiện có |
| Folio và thu ngân | Xem tiền phòng, khoản phát sinh, tiền đã trả/cọc và số dư; ghi nhận tiền mặt hoặc chuyển khoản | `payments.page.ts`, `GetFolioQueryHandler.cs` |
| Báo cáo thu | Tổng thực thu trong ngày theo giờ Việt Nam và báo cáo theo ca | `payments.page.ts`, `GetShiftReportQueryHandler.cs` |

## PHẦN II. NỘI DUNG THỰC HIỆN

### 1. Thủ tục nhận phòng và trả phòng

* **Nhận phòng:** Bổ sung modal đối chiếu giấy tờ tùy thân trực tiếp tại quầy, xác nhận khách và phòng được giao; gửi yêu cầu Check-in qua `ReservationService`. Hệ thống không lưu hoặc truyền số giấy tờ qua thao tác xác nhận này. API hiện có chuyển trạng thái đặt phòng sang đang lưu trú và phòng vật lý sang `Occupied`.
* **Trả phòng:** Modal hiển thị thông tin đơn, công nợ Folio và cảnh báo khoản còn phải thu. Lễ tân thu đủ tiền trước khi hoàn tất; API Check-out hiện có xử lý chuyển trạng thái đặt phòng và phòng vật lý sang `Dirty` trong cùng nghiệp vụ.
* **Đồng bộ giao diện:** Chuẩn hóa ánh xạ trạng thái đặt phòng trả về từ API, tải lại danh sách và thông tin phòng sau thao tác. Các modal dùng phần phủ toàn màn hình để tránh khoảng hở ở đầu trang.

### 2. Liên thông bảng buồng phòng

* Bảng buồng phòng nhận và hiển thị lại trạng thái thực tế sau Check-out; `Dirty` được phân biệt với phòng đang có khách và phòng sẵn sàng.
* Tận dụng quy trình dọn phòng và máy trạng thái đã xây dựng ở tuần 01, không thay thế trạng thái trong cơ sở dữ liệu bằng màu sắc chỉ tồn tại trên frontend.

### 3. Bảng kê Folio và thu tiền

* Hiển thị giá phòng theo bản chụp lúc đặt, khoản phát sinh, số tiền đã thanh toán/đặt cọc và số dư còn phải thu. Khoản đã thu được ghi nhận như thanh toán, không trừ cọc hai lần.
* Form tại quầy cho phép thu tiền mặt hoặc chuyển khoản, nhập mã tham chiếu/ghi chú và tra cứu lịch sử giao dịch. Chỉ giao dịch hoàn tất mới được tính vào số thực thu.
* Không coi việc hiển thị mã QR là đã thanh toán. Giao diện không hiển thị QR khi chi nhánh chưa có tài khoản nhận tiền được cấu hình hợp lệ.
* Trang thu ngân có chức năng hiển thị phiếu thu; đây là chứng từ thu tiền trong hệ thống, không đồng nghĩa với hóa đơn thuế điện tử.

### 4. Báo cáo thu ngân

* Modal “Báo cáo thu ngân trong ngày” ở trang Đặt phòng và trang “Thu ngân & Giao dịch” hiển thị tổng thực thu, số giao dịch cùng phân tách theo phương thức thanh toán của chi nhánh đang chọn.
* Báo cáo ca thu ngân lọc theo ngày và ca, áp dụng ranh giới thời gian theo múi giờ Việt Nam (UTC+7); các khoảng ca không chồng lấn tại thời điểm giao ca.
* Có trạng thái đang tải, lỗi, làm mới và hiển thị `0 đ` khi không có giao dịch. Báo cáo theo ca hiện phục vụ thống kê/bàn giao, chưa phải quy trình kiểm đếm và khóa két vật lý.

## PHẦN III. MINH CHỨNG MÃ NGUỒN

Các liên kết dưới đây trỏ tới nhánh tính năng đã đẩy lên GitHub; việc hợp nhất vào `develop` phụ thuộc quy trình review của nhóm.

* **Lễ tân và đặt phòng:** [reservations.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/reservations/reservations.page.ts), [reservation.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/core/services/reservation.service.ts), [reservations.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/reservations/reservations.page.spec.ts).
* **Buồng phòng:** [housekeeping.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/housekeeping/housekeeping.page.ts), [room.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/core/services/room.service.ts), [housekeeping.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/housekeeping/housekeeping.page.spec.ts).
* **Folio và thu ngân:** [payments.page.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/payments/payments.page.ts), [payment.service.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/core/services/payment.service.ts), [GetFolioQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs), [CreatePaymentCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs).
* **Báo cáo ca và kiểm thử:** [GetShiftReportQueryHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs), [PaymentsController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs), [P4_CashFolioTests.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs), [payments.page.spec.ts](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/frontend/src/app/features/payments/payments.page.spec.ts).
* **API vòng đời đặt phòng được tích hợp:** [ReservationsController.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.WebApi/Controllers/ReservationsController.cs), [CheckInReservationCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Reservations/Commands/CheckInReservation/CheckInReservationCommandHandler.cs), [CheckOutReservationCommandHandler.cs](https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/backend/src/HotelSaas.Application/Reservations/Commands/CheckOutReservation/CheckOutReservationCommandHandler.cs). Các API/handler này là thành phần sẵn có được nối vào giao diện, không nhận là toàn bộ mã nguồn mới của tuần 02.

## PHẦN IV. KIỂM THỬ VÀ ĐỐI CHIẾU

* Đã bổ sung/điều chỉnh kiểm thử cho giao diện Đặt phòng, Buồng phòng, Thu ngân, service trạng thái và nghiệp vụ Folio/báo cáo ca. Các trường hợp chính gồm thành công, lỗi API, thay đổi chi nhánh, trạng thái rỗng và ranh giới ca.
* Đã kiểm thử thủ công luồng đặt phòng → Check-in → thu tiền mặt → Check-out trên tài khoản lễ tân mẫu; đối chiếu trạng thái phòng và tổng thu trong ngày trên giao diện.
* Không khẳng định toàn bộ bộ kiểm thử frontend đã đạt: một số test của phân hệ đặt phòng công khai ngoài phạm vi tuần 02 còn không tương thích. Cần chạy lại các quality gate trên commit cuối hoặc xem kết quả CI trước khi nghiệm thu chính thức.

## PHẦN V. SỬ DỤNG AI VÀ GIỚI HẠN NGHIỆP VỤ

* Trong quá trình phát triển có sử dụng trợ lý AI để khảo sát kiến trúc, đề xuất sửa lỗi giao diện/API và gợi ý kiểm thử. Sinh viên đối chiếu với kế hoạch, đọc lại mã nguồn, chạy thử luồng nghiệp vụ và quyết định phần mã được đưa vào commit. Tên model, danh sách prompt và thời điểm sử dụng cần lấy từ nhật ký AI thực tế; báo cáo này không tự dựng lại các thông tin đó.
* Phần chuyển khoản/QR cần tài khoản ngân hàng thực tế của từng chi nhánh và quy trình xác nhận tiền vào tài khoản. Phiếu thu trong hệ thống chưa thay thế hóa đơn điện tử; báo cáo ca chưa bao gồm kiểm quỹ vật lý.
* Trạng thái Pull Request/review/merge được cập nhật minh chứng chi tiết tại Phần VI dưới đây.

---

## PHẦN VI. BÁO CÁO HOÀN THIỆN FIX BUG: TAN-OPS-FIX-01 (GITHUB ISSUE #5)

* **Task ID:** TAN-OPS-FIX-01
* **GitHub Issue:** [#5 — Reviewer Findings: Housekeeping Polling & Cashier Payment Safety](https://github.com/GinNgo/hotel-saas-v2/issues/5)
* **Người thực hiện:** Trần Trọng Tân — `24TX810025`
* **Nhánh làm việc:** `feature/tan-operations` | **Target PR:** `develop`

### A. TỔNG QUAN NGUYÊN NHÂN GỐC VÀ GIẢI PHÁP (SUMMARY)

#### 1. TASK P1 — Fix Stale Poll Response trong Housekeeping
* **Tệp ảnh hưởng:** `frontend/src/app/features/housekeeping/housekeeping.page.ts`
* **Nguyên nhân gốc:** Các request polling trong `pollServerSync()` phát ra độc lập không hủy request trước đó khi người dùng đổi chi nhánh, chuyển trang, áp dụng bộ lọc hoặc thực hiện cập nhật trạng thái phòng (mutation). Khi mạng chậm, response cũ về muộn ghi đè dữ liệu mới, gây hiện tượng phòng vừa dọn xong bị nhảy ngược lại trạng thái cũ hoặc hiển thị sai chi nhánh.
* **Giải pháp thực hiện:**
  - Thiết lập quản lý lifecycle polling: `pollSub: Subscription`, `pollGeneration: number`, `lastMutationTimestamp: number`, `isDestroyed: boolean`.
  - Bổ sung hàm `invalidatePolling()`: hủy ngay subscription đang bay và tăng `pollGeneration` mỗi khi người dùng đổi chi nhánh, đổi bộ lọc, đổi trang hoặc kích hoạt mutation.
  - Thẩm định ngữ cảnh trước khi áp dụng response: kiểm tra `requestGeneration === pollGeneration`, `propertyId`, `page`, `pageSize`, `statusFilter`, `selectedFloor`, `search` và bảo đảm thời điểm bắt đầu request phải sau `lastMutationTimestamp`.
  - Chặn cả stale success và stale error (không làm tắt loading hay hiển thị thông báo lỗi của ngữ cảnh mới).
  - Cleanup dứt điểm `pollSub.unsubscribe()` trong `ngOnDestroy()`.
* **Hành vi trước và sau:**
  - *Trước:* Đổi chi nhánh hoặc vừa dọn phòng xong, response cũ về muộn ghi đè danh sách phòng và tổng số phòng.
  - *Sau:* Dữ liệu mutation và bộ lọc mới luôn được bảo toàn; response cũ bị bỏ qua hoàn toàn, polling kế tiếp cập nhật đúng dữ liệu mới nhất.

#### 2. TASK P1 — Fix Idempotency khi Retry Thanh toán
* **Tệp ảnh hưởng:** `frontend/src/app/features/payments/payments.page.ts`
* **Nguyên nhân gốc:** Mỗi lần người dùng nhấn thanh toán trong `submitPayment()`, hệ thống tự sinh UUID mới (`crypto.randomUUID()`). Khi gặp lỗi mạng/timeout phía client mà server đã nhận và xử lý giao dịch, việc nhấn thanh toán lại (retry) gửi UUID mới toanh, dẫn tới tạo thêm giao dịch mới và trừ tiền trùng của khách.
* **Giải pháp thực hiện:**
  - Thiết kế vòng đời `activePaymentIntent` gắn với snapshot dữ liệu: `{ key, reservationId, propertyId, amount, method, transactionRef, isDeposit }`.
  - Khi retry cùng ý định (cùng payload sau lỗi mạng hoặc timeout chưa rõ kết quả), tái sử dụng chính xác `idempotencyKey` cũ.
  - Khi thanh toán thành công hoặc người dùng thay đổi bất kỳ trường thanh toán nào (đổi đơn, đổi chi nhánh, đổi số tiền, đổi phương thức, đổi tham chiếu, đổi cọc), reset intent để giao dịch mới có `idempotencyKey` mới hoàn toàn độc lập.
  - Bổ sung cờ `isSubmitting` chặn double-click hoặc gửi đồng thời nhiều request.
* **Hành vi trước và sau:**
  - *Trước:* Mạng chập chờn nhấn retry -> server tạo 2 payment khác nhau với 2 key khác nhau.
  - *Sau:* Retry lỗi mạng gửi lại đúng key cũ -> server nhận diện replay và trả về giao dịch cũ, không tạo thêm bản ghi mới. Đổi số tiền sẽ tự động tạo key mới.

#### 3. TASK P2 — Đồng bộ Báo cáo Thu ngân và Xử lý HTTP 403
* **Tệp ảnh hưởng:** `frontend/src/app/features/payments/payments.page.ts`
* **Nguyên nhân gốc:** Sau khi thu tiền thành công, hệ thống chỉ làm mới Folio mà không cập nhật Daily Payment Summary, Payment History và Shift Report. Khi tải lại Shift Report, hệ thống tự động reset ngày về hôm nay hoặc đổi ca. Ngoài ra, khi Shift Report gặp lỗi HTTP 403 Forbidden, trang không chốt latch bảo vệ, vẫn để lộ số liệu tài chính cũ hoặc hiển thị `0 đ` giả.
* **Giải pháp thực hiện:**
  - Sau khi thu tiền thành công: kích hoạt làm mới đồng bộ 4 nhóm dữ liệu độc lập: (1) Folio hiện tại, (2) Daily Payment Summary, (3) Payment History, (4) Shift Report.
  - Báo cáo ca (`Shift Report`) giữ nguyên chính xác ngày (`shiftDate`) và ca (`selectedShiftType`) người dùng đang chọn; không tự ý reset bộ lọc.
  - Bọc các request làm mới độc lập bằng `catchError` riêng để lỗi ở một phần không làm hỏng phần khác; không hiển thị 0 đ giả khi API lỗi.
  - Xử lý HTTP 403: khi Shift Report trả về 403 Forbidden, gọi `handleAccessDenied()`, kích hoạt latch bảo vệ, xóa sạch toàn bộ dữ liệu tài chính (summary, payments, shiftReport) để ngăn rò rỉ dữ liệu phiên trước, khóa thao tác retry cho đến khi có recovery hợp lệ.
* **Hành vi trước và sau:**
  - *Trước:* Thu tiền xong tổng thu và báo cáo ca không cập nhật; gặp 403 vẫn lưu số liệu cũ hoặc hiện 0 đ; đổi ca bị nhảy ngày.
  - *Sau:* Thu tiền xong cập nhật tức thì cả 4 khối dữ liệu đúng ca/ngày đang chọn; gặp 403 xóa sạch dữ liệu nhạy cảm và khóa giao diện an toàn.

#### 4. TASK P2 — Fix Metadata Injection trong Transaction Reference
* **Tệp ảnh hưởng:**
  - `backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs`
  - `backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs`
  - `backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs`
* **Nguyên nhân gốc:** Cả 3 file sử dụng `.Contains("[PURPOSE:DEPOSIT]")` và `.Contains(ikTag)` trên toàn bộ chuỗi `TransactionRef`. Khách hoặc thu ngân tự do nhập ghi chú chứa chuỗi giống token hệ thống (`[IK:...]`, `[PURPOSE:DEPOSIT]`) khiến hệ thống nhận nhầm thành metadata máy chủ, gây xung đột idempotency sai giữa các đơn khác nhau (false collision) hoặc biến thanh toán thường thành tiền cọc trong Folio.
* **Giải pháp thực hiện:**
  - Quy định chuẩn tiền tố: Chỉ chấp nhận metadata hệ thống ở đúng vị trí do server tạo.
  - Nhận diện tiền cọc: chuyển từ `Contains` sang `StartsWith("[PURPOSE:DEPOSIT]", StringComparison.OrdinalIgnoreCase)` trong cả 3 vị trí (ConfirmGuestBooking, CreatePayment, GetFolio).
  - Nhận diện Idempotency-Key: chỉ khớp với tiền tố hợp lệ do server định dạng: `p.TransactionRef.StartsWith(directPrefix) || p.TransactionRef.StartsWith(depositPrefix)` với `directPrefix = $"[IK:{key}]"` và `depositPrefix = $"[PURPOSE:DEPOSIT][IK:{key}]"`. Loại bỏ triệt để `Contains(ikTag)`.
  - Sanitize đầu vào: trong `ConfirmGuestBookingCommand.cs`, chuẩn hóa `request.TransactionRef` bằng `Replace("[", "(").Replace("]", ")")` tương tự `CreatePaymentCommandHandler`.
  - Chuẩn hóa helper `ExtractUserRef()` trong cả 2 command: bóc tách tiền tố có cấu trúc từ đầu chuỗi (`[PURPOSE:DEPOSIT]`, `[IK:...]`, `[BY:...]`), giữ nguyên vẹn nội dung ghi chú tự do của người dùng ở phần sau.
  - Bảo đảm tương thích 100% với dữ liệu hợp lệ cũ, bảo toàn cơ chế replay và phát hiện `ERR_IDEMPOTENCY_PAYLOAD_MISMATCH` khi sai lệch thông tin.
* **Hành vi trước và sau:**
  - *Trước:* Ghi chú có `[IK:abc]` khiến đơn khác dùng key `abc` bị chặn 409 sai; ghi chú có `[PURPOSE:DEPOSIT]` bị tính nhầm thành cọc.
  - *Sau:* Toàn bộ token trong ghi chú người dùng bị cô lập/sanitize, không bao giờ nhận nhầm thành metadata server; chống tuyệt đối va chạm sai và phân loại cọc chính xác.

---

### B. DANH SÁCH TỆP THAY ĐỔI (FILES CHANGED)

| STT | Tệp thay đổi | Nội dung thay đổi | Lý do thay đổi |
| :--- | :--- | :--- | :--- |
| 1 | `frontend/src/app/features/housekeeping/housekeeping.page.ts` | Thêm `pollSub`, `pollGeneration`, `lastMutationTimestamp`, `invalidatePolling()`, kiểm tra ngữ cảnh toàn diện trước khi nhận dữ liệu poll, cleanup on destroy | Khắc phục triệt để race condition và stale poll response ghi đè dữ liệu mới |
| 2 | `frontend/src/app/features/housekeeping/housekeeping.page.spec.ts` | Bổ sung 6 regression tests kiểm thử lifecycle polling, late response, late error, property switch, filter switch, mutation race guard | Tự động hóa kiểm thử ngăn chặn hồi quy polling |
| 3 | `frontend/src/app/features/payments/payments.page.ts` | Thêm `activePaymentIntent` snapshot, tái sử dụng key khi retry lỗi mạng, reset key khi thành công/sửa thông tin, cờ `isSubmitting`, refresh 4 nhóm dữ liệu giữ nguyên ngày/ca, 403 latch & clear data | Đảm bảo an toàn thanh toán, chống thu trùng lặp và đồng bộ báo cáo thu ngân |
| 4 | `frontend/src/app/features/payments/payments.page.spec.ts` | Bổ sung 6 regression tests cho payment intent retry, key reset, double click, 4-group refresh giữ ngày/ca, Shift Report 403 latch | Kiểm thử tự động hóa cho các kịch bản an toàn thu ngân |
| 5 | `frontend/src/app/shared/components/empty-state/empty-state.component.ts` | Chuyển khai báo `input()` sang `@Input()` decorator để tương thích chuẩn Angular JIT trong môi trường Vitest | Khắc phục triệt để lỗi NG0303 trong test runner mà không dùng NO_ERRORS_SCHEMA |
| 6 | `backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs` | Sanitize ngoặc vuông `[ -> (`, `] -> )`, đổi `HasDepositTag` sang `StartsWith`, đổi kiểm tra `[IK:]` sang `StartsWith(directPrefix) \|\| StartsWith(depositPrefix)`, chuẩn hóa `ExtractUserRef()` | Chống metadata injection trong luồng xác nhận đặt phòng trực tuyến |
| 7 | `backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs` | Đổi `HasDepositTag` sang `StartsWith`, đổi kiểm tra `[IK:]` sang `StartsWith(directPrefix) \|\| StartsWith(depositPrefix)` (bỏ Contains), chuẩn hóa `ExtractUserRef()` | Chống metadata injection trong thu tiền tại quầy, bảo toàn replay |
| 8 | `backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs` | Đổi kiểm tra `[PURPOSE:DEPOSIT]` sang `p.TransactionRef.StartsWith("[PURPOSE:DEPOSIT]", StringComparison.OrdinalIgnoreCase)` | Ngăn chặn nhận nhầm thanh toán thường thành tiền cọc trong Folio |
| 9 | `backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs` | Bổ sung 3 integration test: chống false collision khi user ref có `[IK:]`, chống phân loại nhầm cọc khi user ref có `[PURPOSE:DEPOSIT]`, xác nhận sanitize và replay luồng booking | Minh chứng kiểm thử tự động cho Task P2 Backend |
| 10 | `backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs` | Cấu hình cổng kết nối PostgreSQL linh hoạt theo biến môi trường `TEST_POSTGRES_PORT` (mặc định 5435 trên môi trường test cô lập) | Cho phép chạy tự động toàn bộ 16 integration tests của bộ P5_GuestBookingTests |

---

### C. KẾT QUẢ KIỂM THỬ THỰC TẾ (TEST RESULTS)

#### 1. Kiểm thử Frontend (Targeted Vitest Suite)
* **Lệnh thực thi:**
  ```bash
  node node_modules/vitest/vitest.mjs run src/app/features/payments/payments.page.spec.ts src/app/features/reservations/reservations.page.spec.ts src/app/features/housekeeping/housekeeping.page.spec.ts src/app/core/services/payment.service.spec.ts src/app/core/services/reservation.service.spec.ts
  ```
* **Exit code:** `0`
* **Kết quả:**
  - `src/app/core/services/reservation.service.spec.ts`: **2 passed (2)**
  - `src/app/core/services/payment.service.spec.ts`: **5 passed (5)**
  - `src/app/features/housekeeping/housekeeping.page.spec.ts`: **25 passed (25)**
  - `src/app/features/reservations/reservations.page.spec.ts`: **49 passed (49)**
  - `src/app/features/payments/payments.page.spec.ts`: **33 passed (33)**
  - **Tổng cộng:** **114 passed (114/114 tests) — 0 failed, 0 skipped**.

#### 2. Kiểm thử Biên dịch Frontend (Angular Build)
* **Lệnh thực thi:** `npm run build` (tại thư mục `frontend/`)
* **Exit code:** `0`
* **Kết quả:** `Application bundle generation complete. [9.380 seconds] - 0 Errors`.

#### 3. Kiểm thử Biên dịch Backend (.NET 10 Solution)
* **Lệnh thực thi:** `dotnet build backend/HotelSaas.slnx --no-restore --verbosity minimal`
* **Exit code:** `0`
* **Kết quả:** `Build succeeded. 0 Warning(s), 0 Error(s)`.

#### 4. Kiểm thử Tích hợp Backend (PostgreSQL Test DB cô lập `hotel_saas_p1b01a_test` Port 5435)
* **Lệnh thực thi 1 (Bộ thanh toán, Folio & Báo cáo ca):**
  ```bash
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --no-build --filter "FullyQualifiedName~P4_CashFolioTests"
  ```
  - **Exit code:** `0`
  - **Kết quả:** **Passed! Failed: 0, Passed: 25, Skipped: 0, Total: 25, Duration: 17 s**.
* **Lệnh thực thi 2 (Bộ đặt phòng trực tuyến & xác nhận cọc):**
  ```bash
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --no-build --filter "FullyQualifiedName~P5_GuestBookingTests"
  ```
  - **Exit code:** `0`
  - **Kết quả:** **Passed! Failed: 0, Passed: 16, Skipped: 0, Total: 16, Duration: 13 s**.
* **Lệnh thực thi 3 (Bộ Domain Tests):**
  ```bash
  dotnet test backend/tests/HotelSaas.Domain.Tests/HotelSaas.Domain.Tests.csproj --no-build
  ```
  - **Exit code:** `0`
  - **Kết quả:** **Passed! Failed: 0, Passed: 1, Skipped: 0, Total: 1**.
* **Tổng cộng Backend Tests:** **42/42 tests PASS 100%**.

---

### D. THÔNG TIN GIT VÀ COMMITS

* **Nhánh làm việc:** `feature/tan-operations`
* **Nhánh đích (Target):** `develop`
* **Commit Message:** `fix(tan-ops): address housekeeping polling and payment safety issues`
* **Pull Request:** Sẽ tạo PR vào `develop` với tiêu đề `fix(tan-ops): address housekeeping polling and payment safety issues (Fixes #5)`.

---

### E. BẢNG ĐỐI CHIẾU TIÊU CHÍ NGHIỆM THU (ISSUE #5 ACCEPTANCE CRITERIA)

| Hạng mục Issue #5 | Yêu cầu kỹ thuật | Trạng thái | Bằng chứng kiểm tra thực tế |
| :--- | :--- | :---: | :--- |
| **TASK P1 — Housekeeping Polling** | Hủy request cũ khi đổi ngữ cảnh hoặc destroy; cơ chế generation validation | **ĐÃ HOÀN TẤT** | `housekeeping.page.ts` (pollGeneration, invalidatePolling); 25/25 test pass trong `housekeeping.page.spec.ts` |
| | Ngăn chặn stale poll response ghi đè kết quả vừa cập nhật từ mutation | **ĐÃ HOÀN TẤT** | `lastMutationTimestamp` chặn cập nhật nếu request poll khởi tạo trước thời điểm mutation |
| **TASK P1 — Payment Retry Idempotency** | Quản lý vòng đời `activePaymentIntent`: giữ nguyên key khi retry cùng payload | **ĐÃ HOÀN TẤT** | `payments.page.ts` (activePaymentIntent); BAC 7 test 1 trong `payments.page.spec.ts` pass |
| | Cấp key mới khi thanh toán thành công hoặc người dùng sửa đổi thông tin giao dịch | **ĐÃ HOÀN TẤT** | BAC 7 test 2 & 3 pass; reset intent khi `createPayment()` thành công hoặc payload thay đổi |
| | Chặn double-click và multiple concurrent submissions | **ĐÃ HOÀN TẤT** | `isSubmitting` flag chặn; BAC 7 test 4 pass |
| **TASK P2 — Cashier Report Sync & 403** | Thanh toán thành công cập nhật đủ 4 nhóm: Folio, Summary, History, Shift Report | **ĐÃ HOÀN TẤT** | BAC 7 test 5 pass; kích hoạt cập nhật đồng thời cả 4 nhóm |
| | Báo cáo ca giữ nguyên `shiftDate` và `selectedShiftType` đang chọn, không reset | **ĐÃ HOÀN TẤT** | BAC 7 test 5 khẳng định `shiftDate` và `selectedShiftType` giữ nguyên |
| | Xử lý 403 Shift Report: chốt access-denied latch, xóa dữ liệu nhạy cảm, chặn retry | **ĐÃ HOÀN TẤT** | BAC 7 test 6 pass; `handleAccessDenied()` xóa summary/payments/shiftReport và latch khóa retry |
| **TASK P2 — Fix Metadata Injection** | Chỉ nhận diện metadata ở tiền tố do server sinh (`StartsWith`), loại bỏ toàn bộ `Contains()` | **ĐÃ HOÀN TẤT** | `ConfirmGuestBookingCommand.cs`, `CreatePaymentCommandHandler.cs`, `GetFolioQueryHandler.cs` dùng `StartsWith` |
| | Sanitize dấu ngoặc vuông user reference trong `ConfirmGuestBookingCommand` | **ĐÃ HOÀN TẤT** | `safeUserRef = request.TransactionRef.Replace("[", "(").Replace("]", ")")` |
| | Chống false idempotency collision khi user ref có `[IK:...]` | **ĐÃ HOÀN TẤT** | Test `CreatePayment_UserRefWithInjectedIkToken_DoesNotCauseFalseCollision` pass |
| | Chống phân loại nhầm tiền cọc khi user ref có `[PURPOSE:DEPOSIT]` | **ĐÃ HOÀN TẤT** | Test `CreatePayment_UserRefWithInjectedDepositTag_DoesNotClassifyAsDeposit` pass |
| | Replay hợp lệ và phát hiện payload mismatch vẫn hoạt động chính xác | **ĐÃ HOÀN TẤT** | Test `ConfirmGuestBooking_UserRefWithInjectedTokens_SanitizedAndReplayWorks` pass |
| **Quality Gates** | Frontend Vitest 100% pass, Angular build 0 error | **ĐÃ HOÀN TẤT** | 114/114 Vitest tests pass; `ng build` thành công 0 error |
| | Backend Tests 100% pass, .NET build 0 error | **ĐÃ HOÀN TẤT** | 25/25 P4 tests pass, 16/16 P5 tests pass; `dotnet build` thành công 0 error |
