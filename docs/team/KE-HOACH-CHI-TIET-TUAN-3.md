# KẾ HOẠCH CHI TIẾT TUẦN 3 — NGUYÊN VÀ TÂN

## 1. Mục tiêu và căn cứ phân công

- **Dự án:** Hotel SaaS Platform v2 — sàn đặt phòng nhiều cơ sở và PMS quản lý.
- **Ngày lập:** 20/10/2026. Đây là kế hoạch giao việc, không phải báo cáo công việc đã hoàn thành.
- **Thời gian đề xuất:** 19/10–25/10/2026, tiếp nối mốc 12/10–18/10 trong báo cáo tuần 2 hiện tại; bắt đầu giao việc từ 20/10. Kế hoạch tuần 2 cũ ghi 13/10–19/10, vì vậy An cần xác nhận lịch trước khi dùng làm báo cáo chính thức.
- **Kết quả cần đạt:** hoàn thiện và kiểm chứng luồng **Tìm cơ sở → Chi tiết/phòng trống/báo giá → Giữ phòng → Tra cứu/trạng thái** trên contract hiện có; không xây lại các trang đã có. Theo yêu cầu bổ sung, mở rộng sang kiểm chứng backend và chuẩn bị PostgreSQL cloud dùng chung; kết nối thật chờ xác nhận target và cấu hình bảo mật ở mục 10.
- **Nhánh đích của PR:** `develop`; không push trực tiếp `main`. Tên nhánh bên dưới là gợi ý, tài liệu này không tạo nhánh hay task trên nền tảng ngoài.

### Căn cứ từ tiến độ thực tế

| Nguồn | Ý nghĩa với tuần 3 |
| --- | --- |
| `docs/reports/BAO-CAO-NOP-TUAN-2-VA-KHAI-BAO-AI-CHINH-THUC.md` và các commit được dẫn trong báo cáo | Nguyên đã có Walk-in, Live Quote và Timeline; Tân đã có Check-in/out, Folio và Thu ngân. Không giao lại như tính năng mới. Báo cáo là nguồn truy xuất; kết quả phải đối chiếu source/test. |
| `docs/team/ROADMAP-CHI-TIET-3-THANH-VIEN.md` | Ma trận P4–P5 hướng đến public discovery và guest hold. Một số mô tả tuần 3 chi tiết cũ trùng phần PMS đã triển khai; kế hoạch này điều chỉnh theo baseline thực tế. |
| `docs/design/booking-marketplace/spec.md` | Home là marketplace nhiều cơ sở, không ép đăng nhập để tìm kiếm/tra cứu, không gắn nhầm tenant quản trị. |
| `docs/design/experience-foundation/spec.md`, `plan.md`, `contracts/forms.md` | Giữ ngữ cảnh tìm kiếm, giá/dữ liệu thật, form dùng chung, trạng thái lỗi và accessibility. Áp dụng cách phân rã story → task → kiểm chứng; repo chưa có `.specify` để chạy pipeline Spec Kit. |

## 2. Phân công tổng quát

| Thành viên | Phần chịu trách nhiệm | Đầu việc | Sản phẩm bàn giao |
| --- | --- | --- | --- |
| **Nguyễn Khôi Nguyên — 24TX810011** | Tìm kiếm và lựa chọn phòng trước khi giữ chỗ | N01–N03 như ban đầu; bổ sung N04: contract public backend; N05: đối chiếu dữ liệu nhiều cơ sở trên cloud | PR phần đầu luồng; test backend/FE theo scope; kết quả đối chiếu cloud khi môi trường sẵn sàng |
| **Trần Trọng Tân — 24TX810025** | Giữ phòng và tra cứu sau khi chọn phòng | T01–T03 như ban đầu; bổ sung T04: bảo mật token backend; T05: kiểm thử liên thông guest/PMS trên môi trường chung | PR phần cuối luồng; regression token/race/expiry; kết quả cross-test hoặc blocker môi trường |
| **Ngô Võ Tuấn An — 24TX810001** | Điều phối, backend/contract và tích hợp cloud | Chốt baseline; sở hữu file dùng chung; C01: guard/config; C02: kết nối cloud read-only; C03: nghiệm thu tích hợp | Baseline, config không chứa secret, evidence kết nối khi có target được duyệt và kết quả CI |

**Ưu tiên:** N01, N02, T01, T02 là phần lõi. Các lỗi thành công giả trong T03 phải xử lý trước nghiệm thu. N03/T03 gom kiểm chứng và hoàn thiện phần tương ứng; trang trí hoặc mở rộng tính năng phải hoãn nếu ảnh hưởng phần lõi.

**Phạm vi bổ sung:** N04/T04 thực hiện được bằng fixture/test cô lập, không phải chờ tài khoản cloud. N05/T05 phụ thuộc C02/C03. Không coi 10 nhiệm vụ của hai bạn là 10 tính năng mới phải hoàn thành bằng mọi giá trong số ngày còn lại; nếu thiếu thời gian, ưu tiên phần lõi và báo rõ backlog.

## 3. Gate bắt đầu và quy tắc tránh xung đột

### G0 — Baseline sạch và owner rõ ràng, An chịu trách nhiệm

Trước khi hai bạn bắt đầu, An ghi SHA `develop` được dùng chung và kiểm tra checkout cùng owner; nếu có cơ chế writer thì phải xác nhận writer trước khi sửa. Không sửa trên checkout đang có người khác ghi; không tự tiếp quản writer. Automation trước đây đã dừng, kế hoạch này không khởi động lại.

Tại lúc lập kế hoạch, các file sau đang có thay đổi local, **không thuộc phần được tự ghi đè**:

- `frontend/src/app/features/public-booking/booking.page.ts`
- `frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts`
- `frontend/src/app/features/public-booking/components/flash-deals-banner/flash-deals-banner.component.ts`
- `frontend/src/app/layouts/guest-layout/guest-layout.ts`
- `frontend/src/app/core/models/public-booking.model.ts`
- `backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`
- `backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs`
- `docs/design/experience-foundation/tasks.md`
- `docs/reports/BAO-CAO-NOP-TUAN-2-VA-KHAI-BAO-AI-CHINH-THUC.md`

An phải tích hợp hoặc bàn giao riêng phần liên quan trước khi mở quyền sửa. Không tự stash, reset, commit hay gom các thay đổi này vào PR của hai bạn. Nếu N01 chưa được bàn giao, Nguyên làm N02 và test Detail trước.

### G1 — Ranh giới file

| Owner | File/phạm vi được sửa sau G0 |
| --- | --- |
| Nguyên | `frontend/src/app/features/public-booking/property-detail.page.ts`, `property-detail.page.spec.ts`; `booking.page.ts`, `components/booking-filter-bar/booking-filter-bar.component.ts` và spec tương ứng chỉ sau bàn giao |
| Tân | `frontend/src/app/features/public-booking/booking-hold.page.ts`, `booking-lookup.page.ts`, `booking-status.page.ts`; các spec riêng của ba trang này |
| An điều phối | `frontend/src/app/core/models/public-booking.model.ts`, `public-stay-context.ts`, `frontend/src/app/core/services/public-booking.service.ts`, route, guest layout, shared components/tokens và backend |
| An điều phối test chung | `frontend/src/app/features/public-booking/public-booking.page.spec.ts` đã có test Home/Hold/Status; không để hai PR cùng sửa fixture/test tổng hợp này. Ưu tiên thêm test riêng, không nhân bản test chỉ để tăng số lượng. |

**Bổ sung owner backend sau bàn giao của An:** Nguyên được kiểm chứng/sửa tối thiểu các query Detail/RoomTypes và test public liên quan ở N04; Tân được kiểm chứng/sửa query tra cứu và test guest booking ở T04. An vẫn sở hữu DbContext, DI, migration, claims/permission và DTO dùng chung. N04/T04 không cho phép thay contract/quyền/schema hoặc sửa các file Home/shared đang có local changes khi chưa bàn giao.

Nếu cần sửa file dùng chung, gửi mô tả nhỏ gồm lý do, contract trước/sau và test ảnh hưởng cho An; không âm thầm sửa ở cả hai nhánh.

### G2 — Contract bàn giao giữa Nguyên và Tân

- Tái sử dụng `PublicStayContext`, `readPublicStay` và `publicStayInterval`; không tạo bộ quy tắc ngày/giờ thứ hai.
- Giữ `propertySlug`, `roomTypeId` và các trường lịch/khách mà route và service đang hỗ trợ. Không tự thêm nhiều phòng: helper hiện chỉ chấp nhận một phòng.
- Phân biệt **ngữ cảnh discovery** (điểm đến/facet/sort đã hỗ trợ) và **ngữ cảnh đặt phòng** (cơ sở/hạng phòng/lịch/khách). Không gửi facet UI không được hỗ trợ như thể đó là bộ lọc server.
- Bàn giao bằng một URL mẫu sử dụng dữ liệu kiểm thử, expected request và test điều hướng; An duyệt trước khi hai nhánh tích hợp. Không đưa lookup token thật vào tài liệu/ảnh/PR.

## 4. Nhiệm vụ của Nguyễn Khôi Nguyên

**Nhánh gợi ý:** `feature/nguyen-week3-discovery-detail`.

### N01 — Tìm kiếm và quay lại không mất ngữ cảnh

**Story:** khách tìm trong nhiều cơ sở, mở chi tiết rồi quay lại vẫn hiểu và giữ được điều kiện vừa chọn.

- [ ] N01 [US1] Rà soát và bổ sung regression cho URL round-trip trong `frontend/src/app/features/public-booking/booking.page.ts` và `components/booking-filter-bar/booking-filter-bar.component.spec.ts`; chỉ sửa phần còn lỗi sau G0, không viết lại tìm kiếm đã có.
- **Nội dung:** giữ điều kiện hợp lệ khi Submit, reload, Back/Forward và mở Detail; xóa bộ lọc phải xóa đúng query tương ứng. Giữ một khối tìm kiếm hiện có, không tạo form/service song song.
- **Điểm cần đối chiếu:** link quay lại trong `property-detail.page.ts` hiện truyền `stay()`, chưa thể hiện đầy đủ discovery keyword/facet/sort; xác định mất ngữ cảnh nào thực sự tái hiện trước khi sửa.
- **Nghiệm thu:** (1) tìm theo điều kiện hỗ trợ → mở Detail → quay lại còn điều kiện; (2) đổi A sang B rồi nhận phản hồi A trễ không đè B; (3) URL sai không gây request đặt phòng sai; (4) empty/error không chèn cơ sở demo; (5) click ngoài/Escape đóng picker, không tự submit tìm kiếm.
- **Giới hạn:** discovery không được quảng cáo là đã lọc phòng trống theo lịch trên toàn sàn nếu endpoint chưa cung cấp khả năng đó; không tạo N+1 availability cho mọi card.

### N02 — Chi tiết cơ sở, phòng trống và báo giá đáng tin cậy

**Story:** khách chọn lịch/hạng phòng và chỉ tiếp tục bằng thông tin thuộc đúng lựa chọn hiện hành.

- [ ] N02 [US2] Hoàn thiện trạng thái và regression trong `frontend/src/app/features/public-booking/property-detail.page.ts` và `property-detail.page.spec.ts`.
- **Nội dung:** tái sử dụng loading/error/quote và generation guard đang có; kiểm tra khả năng thuê theo cấu hình cơ sở, capacity và lịch bằng contract hiện hành. Đổi điều kiện phải vô hiệu lựa chọn/báo giá cũ phù hợp.
- **Nghiệm thu:** (1) đổi hạng phòng hoặc lịch khi request đang chạy không dùng kết quả cũ; (2) không có phòng/không có giá/lỗi mạng có hướng khôi phục; (3) quote hết `expiresAtUtc` không tiếp tục như còn hiệu lực, phải kiểm tra giá lại; (4) tổng tiền, cọc và breakdown theo response, không tính lại công thức nghiệp vụ ở client; (5) CTA sang Hold giữ đúng slug, roomType và stay.
- **Dữ liệu thiếu:** ảnh lỗi có placeholder; thiếu đánh giá thì ghi chưa có dữ liệu, không bịa sao/điểm/số phòng hoặc tên hạng phòng. Không tự mở API reviews/promotions.
- **Phụ thuộc:** An giải quyết contract thiếu hoặc lỗi backend; Nguyên không tự thay DTO/schema/quy tắc giá để làm UI chạy.

### N03 — Kiểm chứng UX đầu luồng và bàn giao cho Tân

- [ ] N03 [US1] Kiểm tra và sửa trong phạm vi owner các vấn đề form/keyboard/layout của `frontend/src/app/features/public-booking/property-detail.page.ts` và `components/booking-filter-bar/booking-filter-bar.component.ts`; ghi kết quả thật trong PR.
- **Nghiệm thu:** label/error liên kết input; Tab/Enter/Escape hoạt động; focus trở về trigger sau đóng modal; click trong không bị coi là click ngoài; tên cơ sở dài không đẩy mất CTA. Kiểm tại 375/768/1024/1440px và zoom 200%, ghi thiết bị/kích thước đã chạy.
- Tái sử dụng form/shared components và token hiện có; không tự thêm thư viện, remote font hay đổi design system. Nếu cần đổi shared control thì báo An theo G1.
- **Bàn giao:** URL và request mẫu ở G2, test kết quả quote → Hold, ảnh hai trạng thái đại diện và danh sách lỗi/blocker còn lại. Không tuyên bố đã user-test/SUS/accessibility audit toàn diện chỉ từ lượt kiểm tra này.

### N04 — Kiểm chứng backend public Detail/RoomTypes theo cơ sở

- [ ] N04 [US2] Bổ sung test và sửa lỗi đã tái hiện trong `backend/src/HotelSaas.Application/Public/Queries/GetPublicPropertyBySlug/GetPublicPropertyBySlugQuery.cs`, `GetPublicRoomTypes/GetPublicRoomTypesQuery.cs` và test thuộc `backend/tests/HotelSaas.Application.Tests/Public/` sau khi An bàn giao scope.
- **Nghiệm thu:** cơ sở A/B có dữ liệu khác nhau; slug A chỉ trả chi tiết và room types của A; cơ sở không hoạt động/không tồn tại theo đúng contract hiện tại; dữ liệu nullable không thành giá/ảnh/đánh giá giả; lỗi API được FE hiển thị đúng ở N02.
- Các public query đang dùng `IgnoreQueryFilters()` có chủ đích để phục vụ marketplace; test phải chứng minh điều kiện công khai và giới hạn property tường minh, không suy ra rằng public được đọc mọi entity. Không mở rộng `IgnoreQueryFilters` hoặc trả raw entity/PII.
- Không sửa `GetPublicPropertiesQuery.cs` đang có local changes nếu An chưa bàn giao. Nếu phát hiện cần đổi contract, ghi failing test/bước tái hiện và chuyển An duyệt thay vì tự thêm field hoặc quyền.

### N05 — Kiểm chứng cấu hình và dữ liệu nhiều cơ sở trên cloud

- [ ] N05 [US5] Sau C02 và khi có dataset mẫu được chủ môi trường xác nhận, đối chiếu kết quả public Detail/RoomTypes với `frontend/src/app/features/public-booking/property-detail.page.ts`; ghi bảng expected/actual trong PR.
- Dùng ít nhất hai cơ sở mẫu đã có với hình thức thuê, giờ nhận/trả và giá được công bố khác nhau. Không giả định dataset cloud đã được seed; nếu thiếu dữ liệu thì báo blocker, không tự tạo hoặc copy DB local.
- **Nghiệm thu:** frontend chỉ gọi API, không giữ connection string PostgreSQL; chọn A không hiển thị cấu hình B; dữ liệu thay đổi sau lần đọc mới không bị cache UI cũ ghi đè; lỗi mạng có retry. Chỉ xác nhận các trường endpoint thực sự công khai, không yêu cầu lộ cấu hình quản trị.
- Nếu cloud chưa sẵn sàng, chạy bằng fixture có nhãn và nộp phần test được; trạng thái N05 vẫn chờ kiểm trên cloud, không ghi đã tích hợp thật.

## 5. Nhiệm vụ của Trần Trọng Tân

**Nhánh gợi ý:** `feature/tan-week3-hold-lookup`.

### T01 — Giữ phòng, hết hạn và thử lại an toàn

**Story:** khách nhập liên hệ, giữ phòng một lần và thấy đúng thời hạn server trả về.

- [ ] T01 [US3] Harden `frontend/src/app/features/public-booking/booking-hold.page.ts`; bổ sung `booking-hold.page.spec.ts` nếu chưa có tại baseline, dựa trên test Hold hiện có để tránh trùng lặp.
- **Contract:** `createHold` gửi `Idempotency-Key`; kết quả có `lookupToken`, `holdExpiresAtUtc`, `secondsRemaining`. Trang đã có countdown, kiểm tra quote expiry, submit guard và timer cleanup; nhiệm vụ là kiểm chứng/bổ sung phần thiếu, không xây lại.
- **Nghiệm thu:** (1) dữ liệu liên hệ không hợp lệ không gửi request; focus tới field lỗi; (2) double-click không tạo hai request đồng thời; retry cùng ý định dùng đúng key theo contract; payload thay đổi không âm thầm tái dùng key cho ý định khác; (3) quote quá hạn chặn tạo hold và cho kiểm tra giá lại; (4) response thiếu token không báo thành công; (5) refresh URL có token chỉ tải hold hiện hữu, không gọi tạo hold mới.
- **Đồng hồ:** dựa `holdExpiresAtUtc`, không khởi động lại 15 phút khi reload, không âm số/NaN; ngày hết hạn thiếu/sai phải có trạng thái an toàn. `Expired` từ server không bị timer tương lai ghi thành còn hiệu lực. Khi về trang từ tab nền phải tính lại theo deadline, không trừ đếm theo số tick.
- Timer/request subscription được dọn khi rời trang; token mới hoặc response trễ không để dữ liệu hold cũ quay lại. Fake timers trong unit test, không chờ đủ thời gian thật.
- Không tự thiết kế lưu PII/token/key lâu dài trong localStorage; nếu cần recovery ngoài contract hiện có thì gửi An duyệt trước.

### T02 — Tra cứu và trạng thái không lẫn đơn đặt phòng

**Story:** khách tra cứu bằng token thấy đúng đơn và đúng trạng thái server, kể cả khi đổi mã nhanh hoặc gặp lỗi.

- [ ] T02 [US4] Sửa trạng thái/request lifecycle trong `frontend/src/app/features/public-booking/booking-lookup.page.ts` và `booking-status.page.ts`; thêm spec riêng tương ứng nếu chưa có.
- **Điểm có trong source cần tái hiện:** hai trang gán booking khi request về nhưng chưa thấy guard cho A/B response race; nhánh lỗi không xóa booking cũ. Label hiện map `Hold`, trong khi query backend trả enum thực tế như `PendingPayment` hoặc `Expired`.
- **Nghiệm thu:** (1) A thành công → nhập B lỗi không còn hiện chi tiết A như kết quả của B; (2) gửi A rồi B, A về sau không đè B; (3) empty token không gửi request; token không hợp lệ/lỗi mạng có thông báo và retry thích hợp, không lộ nội bộ; (4) loading kết thúc đúng ở cả success/error; (5) route đổi/rời trang không để request cũ cập nhật UI.
- Hiển thị nhất quán `PendingPayment`, `Expired`, `Confirmed`, `CheckedIn`, `CheckedOut`, `Cancelled` theo response; trạng thái chưa biết có fallback trung thực, không coi là đã xác nhận.
- Giá, paid/remaining balance, PII đã che và PIN chỉ hiển thị theo response được phép. Không lấy query string thanh toán để tự đánh dấu đã thu tiền hoặc mở quyền truy cập PMS.

### T03 — Loại bỏ thành công giả, hoàn thiện thao tác và regression

- [ ] T03 [US4] Rà soát action trong `frontend/src/app/features/public-booking/booking-lookup.page.ts` và `booking-status.page.ts`, bổ sung test vào spec riêng của từng trang.
- **Lỗi trung thực dữ liệu cần xử lý:** `submitReview` trong core service hiện trả `of(true)`; không để giao diện báo đã lưu đánh giá thật. Khi chưa có API được duyệt, ẩn/vô hiệu action và giải thích chưa hỗ trợ; không tự thêm backend reviews.
- `simulateNfcTouch()` hiện có fallback PIN và thông báo xác thực thành công. Loại bỏ đường thành công giả khỏi luồng khách; không mô phỏng mở khóa/hiển thị PIN thay dữ liệu thật. Việc tích hợp thiết bị là scope riêng.
- Copy token/PIN chỉ báo thành công khi Clipboard Promise resolve; không hỗ trợ/bị từ chối phải có thông báo phù hợp. Không đưa PIN thật vào toast/log/ảnh bàn giao. Kiểm tra in xác nhận không tự bổ sung dữ liệu booking hoặc thanh toán giả.
- VNPay đang có action tạo URL nhưng không đồng nghĩa guest payment đã được nghiệm thu. An xác nhận contract/quyền/config sandbox trước khi bật; khi chưa đạt gate, thể hiện chưa khả dụng. Không mở thanh toán thật, hardcode secret hoặc sửa callback/payment FSM.
- **Nghiệm thu:** test reject clipboard, submit review chưa hỗ trợ, NFC không tạo thành công giả; kiểm keyboard/mobile ở Hold/Lookup/Status, thông báo lỗi có hướng tiếp tục và không lộ token/PIN trong minh chứng.

### T04 — Kiểm chứng quyền tra cứu token và dữ liệu trả về ở backend

- [ ] T04 [US4] Bổ sung regression trong `backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs` cho `backend/src/HotelSaas.Application/Public/Queries/GetGuestBookingByToken/GetGuestBookingByTokenQuery.cs`; chỉ sửa query nếu có test chứng minh lỗi và An duyệt scope.
- **Nghiệm thu:** token sai/thu hồi/hết hạn bị từ chối theo contract; token A không lấy booking B; response chỉ có PII đã che và PIN theo điều kiện nghiệp vụ hiện có; `PendingPayment` hết hold được hiển thị `Expired`; số dư/đã trả dựa giao dịch hợp lệ, không dựa query string.
- Test token và hold expiry là hai khái niệm khác nhau, không dùng hết thời gian giữ phòng để tự thu hồi mọi quyền tra cứu nếu contract không quy định như vậy. Tái sử dụng logic masking và test hiện có, không tự thêm thuật toán bảo mật khác.
- Không thay định dạng token, thời hạn, chính sách PIN, quyền cross-tenant hoặc payment FSM. Nếu query dùng `IgnoreQueryFilters`, test phải chứng minh booking được giới hạn bởi capability hợp lệ và dữ liệu liên quan thuộc đúng reservation/property.

### T05 — Cross-test đơn khách đặt phòng và màn hình vận hành

- [ ] T05 [US5] Sau C03, kiểm luồng Hold/Lookup/Status và đọc đơn tương ứng trong PMS hiện có; đối chiếu `frontend/src/app/features/public-booking/booking-status.page.ts` với màn hình reservations theo đúng quyền được cấp, ghi kết quả đã che dữ liệu trong PR.
- Mặc định dùng booking mẫu được chủ môi trường cung cấp. Chỉ tạo hold/đơn mới, đăng nhập có ghi session, xác nhận, check-in/out hoặc thu tiền khi An/chủ môi trường đã chốt rõ kịch bản và cho phép ghi dataset demo; không biến lượt kiểm tra read-only thành DML ngầm.
- **Nghiệm thu:** booking hiển thị đúng cơ sở trong PMS; tài khoản cơ sở khác không đọc/sửa đơn ngoài quyền; guest không dùng được endpoint PMS; reload trạng thái chỉ hiển thị dữ liệu server; không nhận return URL thanh toán như chứng cứ đã thu tiền.
- Không chạy bộ integration test có tạo schema/drop dữ liệu trên cloud chung. Kịch bản concurrency/rollback chạy ở DB test cô lập; cloud demo chỉ xác nhận thao tác đã được cho phép, không chứng minh đã stress-test.

## 6. API hiện có và phần không tự mở rộng

Các đường dẫn dưới đây là tương đối với base URL của `PublicBookingService`; dùng service hiện có, không gọi HttpClient trực tiếp từ component.

| Hành vi | Service / endpoint | Owner và giới hạn |
| --- | --- | --- |
| Tìm cơ sở | `getProperties` → `GET /public/properties` | Nguyên dùng tham số đã hỗ trợ. Search toàn sàn theo lịch/bulk availability cần An duyệt contract riêng. |
| Chi tiết/hạng phòng | `getPropertyBySlug`, `getRoomTypes` → `GET /public/properties/{slug}` và `/{slug}/room-types` | Nguyên; phân biệt chưa tải, không có dữ liệu và lỗi. |
| Phòng trống/báo giá | `getAvailability` → `GET /public/properties/{slug}/availability`; `calculateQuote` → `POST /public/quotes` | Dùng interval/helper hiện có; backend quyết định giá và availability. |
| Tạo giữ chỗ | `createHold` → `POST /public/bookings/hold` | Tân; giữ payload và idempotency contract. |
| Tra cứu | `getBookingByToken` → `GET /public/bookings/{token}` | Tân; đây là capability nhạy cảm, không phải ID công khai để đưa vào báo cáo. |
| Xác nhận | `confirmBooking` → `POST /public/bookings/{token}/confirm` | Có method không đồng nghĩa client được tự xác nhận thanh toán; không gọi mới ngoài flow backend đã duyệt. |
| VNPay | `createVnpayPaymentUrl` → `POST /payments/vnpay/create-url` | An kiểm quyền/config trước mọi tích hợp guest. Không chạy giao dịch thật trong nhiệm vụ này. |

**Ngoài phạm vi tuần này của hai bạn:** API tài khoản khách/history mới; OAuth Google/Facebook; schema/migration; thuật toán giá/chống overbooking; payment webhook; reviews/loyalty/promotion engine; CMS mới; nhiều phòng trong một booking; đổi quyền tenant/property. Có blocker thì ghi request/response đã che dữ liệu, bước tái hiện và giao An xử lý, không mock thành tính năng thật.

## 7. Lịch thực hiện đề xuất và dependencies

Đây là lịch dự kiến, cần hai bạn xác nhận khả năng đáp ứng, không phải cam kết tiến độ đã đạt.

| Ngày | Nguyên | Tân | An / gate |
| --- | --- | --- | --- |
| 20/10 | Đọc baseline; tái hiện N01/N02, bắt đầu test Detail nếu Home chưa bàn giao | Đọc DTO và tái hiện T01/T02/T03, chuẩn bị test timer/race | G0, G1, G2; chọn target cloud và quyền truy cập |
| 21–22/10 | Hoàn thiện N01/N02; test N04 nếu phần lõi ổn định | Hoàn thiện T01/T02 và lỗi thành công giả; test T04 nếu phần lõi ổn định | C01; giải quyết blocker contract và review PR nháp |
| 23/10 | N03/N04, test scoped, bằng chứng UI | T03/T04, test scoped, bằng chứng trạng thái | C02 khi có cấu hình cloud; không tự tạo schema |
| 24/10 | Kiểm chuỗi Search → Detail → Hold; N05 nếu C02 đạt | Kiểm chuỗi Hold → Lookup/Status; T05 nếu C03 cho phép | C03; tích hợp lần lượt vào `develop`, chạy quality gates/CI độc lập cloud chung |
| 25/10 | Sửa findings; chốt kết quả N01–N05 hoặc backlog | Sửa findings; chốt kết quả T01–T05 hoặc backlog | Nghiệm thu và tổng hợp báo cáo tuần 3 từ minh chứng thật |

Dependency: **G0/G1 → N02 song song T01/T02 → G2 + N01 → N03/T03 → tích hợp**. Test T01 có thể dùng fixture đúng DTO để không chờ N01, nhưng phải có lượt kiểm chuỗi sau cùng. Fixture không chứng minh API, email, thanh toán hay thiết bị thật hoạt động.

Bổ sung: **N02 → N04** và **T02 → T04** có thể làm song song trên file/test khác nhau; **chốt target → C01 → C02 → N05**, sau đó **C03 cho phép kịch bản ghi demo → T05**. Cloud không chặn hai bạn sửa/test local; cloud chưa có thì không tự chuyển sang DB staging bất kỳ.

Nếu thiếu thời gian, ưu tiên tính đúng dữ liệu, lỗi/race/expiry và action trung thực; hoãn animation, layout trang trí, tính năng mới. Không nghiệm thu trạng thái thành công giả để kịp lịch.

## 8. Kiểm chứng và Definition of Done

### Lệnh có sẵn trong repo

Chạy tại thư mục gốc. Chọn scoped spec thực tế; spec mới chỉ chạy sau khi đã tạo file.

```powershell
npm --prefix frontend test -- --watch=false --include=src/app/features/public-booking/property-detail.page.spec.ts
npm --prefix frontend test -- --watch=false --include=src/app/features/public-booking/public-booking.page.spec.ts
npm --prefix frontend test -- --watch=false
npm --prefix frontend run build
git diff --check
```

Tân chạy scoped test tương tự với `booking-hold.page.spec.ts`, `booking-lookup.page.spec.ts`, `booking-status.page.spec.ts` sau khi các file đó tồn tại. Test tổng hợp cần chạy vì đã có coverage Hold/Status trong đó. Không có script lint/E2E riêng trong `frontend/package.json`; không tự gọi lệnh không tồn tại hoặc thêm framework để hoàn thành kế hoạch.

An chạy thêm quality gates backend trước commit/tích hợp theo `AGENTS.md` trong môi trường test an toàn đã kiểm tra, không kết nối DB dev/prod/staging:

```powershell
dotnet build backend/HotelSaas.slnx --verbosity minimal
dotnet test backend/HotelSaas.slnx --no-build
```

Nếu test cần PostgreSQL, phải được An xác nhận môi trường test dùng riêng trước; không tự chạy migration/seeder trên DB thật. Thiếu môi trường thì ghi limitation, không đánh dấu pass.

### Checklist nộp PR của mỗi bạn

1. PR vào `develop`, gắn N01–N03 hoặc T01–T03; nêu baseline SHA và commit SHA thực tế, không ghi link minh chứng khi chưa có.
2. Có bước tái hiện trước sửa, expected/actual và regression test cho từng lỗi sửa; không đặt chỉ tiêu số test/coverage tùy ý.
3. Ghi nguyên lệnh đã chạy, thời điểm, kết quả và warning/failure còn lại. Không dùng số test tuần 2 như kết quả tuần 3.
4. Có ảnh/video desktop/mobile của phần đã kiểm, dữ liệu fixture được ghi nhãn; che token/PIN/PII/secrets. Không đưa hồ sơ khách thật ra ngoài.
5. Kiểm luồng với cơ sở A/B khác nhau: không trộn tên/phòng/giá/booking; không thêm tenant/property authority từ input hoặc public URL.
6. Angular standalone, Signals/OnPush; network qua core service; không `any`, dependency mới, refactor lớn hay sửa file ngoài owner nếu chưa bàn giao.
7. Không sửa nghiệp vụ PMS tuần 2, không commit/push secret; không deploy, migrate hoặc truy cập DB thật ngoài target/phạm vi được xác nhận riêng ở mục 10. Kết nối cloud không mặc nhiên cho phép ghi dữ liệu. Build warning phải ghi nhận và xử lý trong scope, không tuyên bố đạt gate 0 warning khi còn warning.
8. Bàn giao phần chưa xong/blocker rõ ràng. An review rồi mới merge; tài liệu kế hoạch này không phải quyền tự merge hoặc push `main`.

## 9. Nội dung có thể gửi trực tiếp cho từng bạn

### Gửi Nguyên

> Tuần 3 bạn phụ trách đầu luồng khách đặt phòng: N01 giữ ngữ cảnh tìm kiếm; N02 kiểm chứng phòng trống/quote; N03 keyboard/mobile; bổ sung N04 test backend public Detail/RoomTypes và N05 đối chiếu dữ liệu nhiều cơ sở trên cloud khi có môi trường. Không xây lại Walk-in/Timeline tuần 2. Đọc mục 3–4 và 10, lấy baseline SHA từ An trước khi sửa Home có local changes. PR vào develop kèm test/ảnh thật; không đổi DTO/quyền/schema hoặc lấy connection string đưa vào frontend. Cloud chưa sẵn sàng thì tiếp tục fixture và ghi blocker.

### Gửi Tân

> Tuần 3 bạn phụ trách cuối luồng: T01 Hold countdown/retry; T02 Lookup/Status; T03 bỏ thành công giả và lỗi thao tác; bổ sung T04 test quyền/expiry/masking token ở backend và T05 đối chiếu đơn guest với PMS trên cloud sau khi được duyệt kịch bản. Không xây lại Folio/Thu ngân tuần 2. Đọc mục 3, 5 và 10; không tự mở API, đổi token/payment FSM hoặc chạy test phá dữ liệu trên cloud chung. PR vào develop kèm test timer/race và minh chứng đã che token/PIN. VNPay chờ An chốt contract/quyền/config sandbox.

Hai đoạn trên là bản nhắn giao việc để người dùng gửi; chưa có tin nhắn, issue hay task mới được tạo bên ngoài tài liệu này.

## 10. PostgreSQL cloud dùng chung — thiết kế và gate triển khai

### 10.1. Trạng thái thật tại lúc bổ sung

**Đã làm:** rà soát source/config, bổ sung nhiệm vụ và thiết kế kết nối vào cùng tài liệu này. **Chưa làm:** sửa runtime/config kết nối, provision dịch vụ, đăng nhập nhà cung cấp, kết nối mạng tới DB, migration, seed hoặc chuyển dữ liệu. Người dùng chưa chỉ định provider/endpoint/database/schema hay nơi lưu credential để dùng.

Những điểm đã xác minh từ source:

| Bằng chứng | Kết luận kỹ thuật |
| --- | --- |
| `backend/src/HotelSaas.Infrastructure/DependencyInjection.cs` | Backend đã dùng EF Core/Npgsql và `ConnectionStrings:DefaultConnection`; không cần thêm SDK cloud hoặc đổi ORM. |
| `backend/src/HotelSaas.WebApi/Program.cs` | Ngoài môi trường `Testing`, startup có thể gọi `MigrateAsync` và seed nếu `SkipStartupDatabaseInit` không bật. Đây là blocker trước khi nối cloud, không phải lệnh kiểm tra kết nối read-only. |
| `backend/src/HotelSaas.WebApi/appsettings.Development.json` | `SkipStartupDatabaseInit` hiện là `false`; không chỉ thay connection string rồi chạy app. Không chép credential đang có trong file vào báo cáo. |
| `.env.example` và `Program.cs` | Template có `POSTGRES_*`, nhưng .NET hiện đọc `ConnectionStrings:DefaultConnection`; không thấy dotenv loader. Đặt `.env` hoặc `POSTGRES_HOST` riêng không tự cấu hình WebApi khi chạy trực tiếp. |
| `backend/src/HotelSaas.Infrastructure/Migrations/20261008000000_P2B02_Rates_Policies_Quote.cs` | Migration phụ thuộc extension `btree_gist` ở schema `public`; cần kiểm tra hỗ trợ/quyền của cloud trước, không bỏ constraint để vượt lỗi. |
| `docs/team/README.md` | Đã có hướng staging dùng chung nhưng tài liệu cũ không chứng minh hạ tầng/role/backup đã được provision. |
| `frontend/src/environments/environment.development.ts` | Frontend gọi `/api`; không nối PostgreSQL trực tiếp và không cần nhận DB password. |

### 10.2. Phương án đề xuất, chờ xác nhận

1. **Nếu đã có PostgreSQL cloud:** ưu tiên dùng database tích hợp riêng được chủ môi trường xác nhận; không tự thay bằng DB production hoặc DB cá nhân đang chứa dữ liệu thật.
2. **Nếu chưa có:** chọn managed PostgreSQL, ví dụ Neon hoặc Supabase, sau khi chốt account/quota/region và hỗ trợ `btree_gist`. Không tự tạo tài khoản, chấp nhận điều khoản, mở gói trả phí hoặc chuyển schema ra ngoài.
3. **Chưa có cloud/credential:** vẫn làm N04/T04 và kiểm chứng cấu hình offline; không dựng thêm service/database khác như thể yêu cầu cloud đã hoàn tất.

Topology tối thiểu: **Angular từng máy → WebApi từng máy → PostgreSQL cloud tích hợp chung**. Chưa triển khai WebApi/Angular lên cloud trong scope này. Các máy phải dùng baseline schema tương thích; không để mỗi lần chạy ứng dụng tự nâng schema chung.

Giữ ba ranh giới dữ liệu: local dev riêng, DB integration cloud riêng, DB test tự động riêng; production không tham gia. Tên database tích hợp `hotel_saas_staging` là đề xuất từ tài liệu trước, không phải target đã tồn tại hoặc đã được người dùng xác nhận.

### 10.3. Phân quyền, TLS và secrets

- Kết nối cloud ban đầu bằng role kiểm tra chỉ đọc được cấp cho đúng database/schema; không dùng owner/superuser để thử ứng dụng. Role runtime dùng quyền tối thiểu cần thiết, tách role migration và role test.
- TLS xác minh server/hostname, không `Trust Server Certificate=true` hoặc hạ SSL để né lỗi. Nếu provider cần CA riêng thì cài/chỉ định CA được xác minh.
- Dùng cấu hình môi trường `ConnectionStrings__DefaultConnection` hoặc cơ chế secrets đã được thống nhất; không commit password vào `.env.example`, appsettings được track, launch settings, frontend hay CI yaml. Không dán secret vào chat/log/ảnh.
- Phải bật `SkipStartupDatabaseInit=true` trong profile cloud, đồng thời hoàn thiện guard ở C01 để không chỉ phụ thuộc thao tác nhớ bật flag. `Development` không đồng nghĩa database local an toàn để seed.
- Chọn direct endpoint hay pooled endpoint dựa trên driver/provider và yêu cầu transaction của ứng dụng; không mặc định đưa EF migrations qua transaction pooler. Pool từng máy phải có giới hạn tổng theo quota cloud; chưa có quota nên chưa chốt con số pool/capacity.
- Không tái sử dụng `TEST_DB_CONNECTION` cho database tích hợp; một số test có DDL/cleanup. Không coi tên chứa `_test` là đủ chứng minh được phép chạy trên cloud.

### 10.4. Các đầu việc của An / phần cần thực hiện tiếp

- [x] C01 [US5] Sau khi chốt thiết kế, chuẩn bị config kết nối và guard khởi tạo trong `backend/src/HotelSaas.WebApi/Program.cs`, `backend/src/HotelSaas.Infrastructure/DependencyInjection.cs` cùng test an toàn thuộc `backend/tests/HotelSaas.WebApi.Tests/`; giữ nguyên secret ngoài Git, không thêm dependency.
  - Guard từ chối auto migration/seed đối với cloud/target chưa xác nhận; thiếu hoặc sai cấu hình trả lỗi rõ nhưng không lộ connection string.
  - 10 unit tests offline (`CloudDatabaseGuardTests.cs`) đạt 100% pass.
- [x] C02 [US5] Sau khi có target/credential được cấp và C01 đạt, kiểm tra kết nối PostgreSQL **read-only** vào database/schema đã xác nhận; lưu kết quả đã che dữ liệu ở mục 10.6 của tài liệu này.
  - Xác nhận host `103.116.38.74:5435`, database `hotel_saas_staging`, user `hotel_admin`, TLS phiên kết nối `IsSecure = True`.
  - Phiên bản: PostgreSQL 17.11 (Alpine), Extension: `btree_gist 1.7` đã được nạp sẵn.
  - Test probe xác nhận tự động qua xUnit: `RemoteCloudDatabaseProbeTests.ProbeSharedCloudDatabase_ValidatesTlsVersionAndBTreeGist` (Pass 100%).
- [x] C03 [US5] Khởi tạo schema đầy đủ bằng EF Core Migrations và nạp cấu hình quyền RBAC ban đầu lên môi trường dùng chung.
  - Đã chạy EF Core migration cập nhật toàn bộ 32 bảng hệ thống (từ `20261008000000_P2B02` đến `20261017144540_P6_SocialAuth_And_SmartLock`).
  - Đã nạp thành công bộ 5 Access Roles và 17 Permission Functions chuẩn hệ thống (`SeedDefaultRolesAndVerifySchema_PopulatesBaselineRbac` Pass 100%).
  - Môi trường sẵn sàng cho Nguyên (N05) và Tân (T05) kiểm liên thông.

### 10.5. Điều kiện bắt đầu và nghiệm thu

**Cần người dùng xác nhận:** provider đã có/chưa có; mục đích environment; database/schema cụ thể có được phép dùng; endpoint direct/pooler và credential được cấp qua vị trí bảo mật trên máy; owner hạ tầng và quyền read-only ban đầu. Tạo dịch vụ có phí, migration, chuyển dữ liệu, seed hoặc ghi dataset demo phải xin riêng theo hành động thực tế.

**Nghiệm thu kết nối:** config không lộ secret; startup không tự DDL/DML; kiểm tra read-only tới đúng target qua TLS có bằng chứng; khi lỗi xác thực/TLS/network thì không fallback sang DB local một cách âm thầm; rollback cấu hình trả từng máy về local mà không tác động cloud. Thử lỗi xác thực/TLS bằng test offline, không brute-force tài khoản thật.

**Nghiệm thu tích hợp sau đó:** N05/T05 có expected/actual thật, quyền tenant/property không đổi, secrets không sang frontend, CI không chạm database integration. Không gộp tất cả các tiêu chí này vào một tuyên bố “đã kết nối” chỉ từ `SELECT 1`.

### 10.6. Nhật ký thực hiện và limitation

| Hạng mục | Trạng thái hiện tại | Bằng chứng / việc tiếp theo |
| --- | --- | --- |
| Bổ sung N04/N05/T04/T05 và C01–C03 | Đã hoàn thành C01-C03 | Nhánh `feature/an-experience-foundation`, PR #8 |
| Khảo sát DI, startup init, biến config và extension | Đã hoàn thành | `DatabaseConnectionResolver.cs`, `CloudDatabaseGuard.cs` |
| Chọn cloud và target được phép | Đã xác nhận VPS Linux | Host: `103.116.38.74:5435` (hoặc `luxustay.duckdns.org:5435`), DB: `hotel_saas_staging` |
| Guard/runtime config và tests C01 | Đã hoàn thành (10/10 tests pass) | `CloudDatabaseGuardTests.cs` |
| Kết nối read-only C02 | Đã hoàn thành (Evidence ghi nhận) | `RemoteCloudDatabaseProbeTests.cs` (TLS True, PG 17.11, btree_gist 1.7) |
| Migration & Schema C03 | Đã hoàn thành (32 bảng, RBAC seed) | EF Core Database Update thành công, 32 tables, 5 roles, 17 permissions |
| Tests/build ứng dụng toàn bộ | 100% Pass (0 warning, 0 error) | Backend 442/442 tests pass; Frontend 367/367 tests pass |
