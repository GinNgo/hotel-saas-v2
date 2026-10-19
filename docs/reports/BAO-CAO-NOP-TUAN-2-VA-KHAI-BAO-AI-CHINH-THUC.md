# BÁO CÁO TIẾN ĐỘ TUẦN 02 VÀ KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)

**TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH**
**KHOA CÔNG NGHỆ THÔNG TIN — BỘ MÔN CÔNG NGHỆ PHẦN MỀM**

## THÔNG TIN CHUNG CỦA ĐỀ TÀI

| Nội dung | Thông tin |
| --- | --- |
| Mã đề tài | 578 |
| Tên đề tài | Nền tảng Quản lý Khách sạn Đa chi nhánh theo Mô hình SaaS (Hotel SaaS Platform v2) |
| Giảng viên hướng dẫn | **HUỲNH XUÂN PHỤNG** |
| Kỳ báo cáo | Tuần 02: 11/10/2026 – 17/10/2026; cập nhật tích hợp, kiểm thử và rà soát ngày 18–19/10/2026 |
| Kho mã nguồn | https://github.com/GinNgo/hotel-saas-v2 |
| Nhánh tích hợp | https://github.com/GinNgo/hotel-saas-v2/tree/develop |
| Nhánh phát hành mã nguồn | https://github.com/GinNgo/hotel-saas-v2/tree/main |

Mốc tuần được nối tiếp kỳ Tuần 01 trong báo cáo đã cung cấp; công việc tích hợp ngày 18–19/10 được ghi riêng, không đổi ngày commit để đưa vào kỳ 11–17/10. Các liên kết minh chứng trong báo cáo chỉ sử dụng GitHub của nhóm. Việc cập nhật mã nguồn lên main không đồng nghĩa triển khai hệ thống hoặc chạy migration trên môi trường thật.

### Danh sách thành viên

| STT | Họ và tên | MSSV | Email sinh viên | Phạm vi đóng góp được đối chiếu |
| --- | --- | --- | --- | --- |
| 1 | Ngô Võ Tuấn An | 24TX810001 | 24tx810001@student.hcmute.edu.vn | Kiến trúc/tích hợp, cổng đặt phòng đa cơ sở, tìm kiếm địa danh, guest portal và rà soát UI/form, bảo mật, CI |
| 2 | Nguyễn Khôi Nguyên | 24TX810011 | 24tx810011@student.hcmute.edu.vn | Đặt phòng tại quầy, báo giá trực tiếp và lưới thời gian phòng; tích hợp PR #6 ngày 18/10 |
| 3 | Trần Trọng Tân | 24TX810025 | 24tx810025@student.hcmute.edu.vn | Vận hành lễ tân, buồng phòng, thu ngân/báo cáo ca; sửa polling, retry thanh toán và nhận diện metadata |

## PHẦN I. TỔNG QUAN KẾT QUẢ THỰC HIỆN

Sau phần nền tảng kiến trúc, danh mục phòng và FSM buồng phòng của Tuần 01, nhóm mở rộng sang luồng nghiệp vụ đặt phòng và vận hành. Tuần này không chỉ bổ sung màn hình mà còn xử lý các vấn đề xuyên phân hệ: giữ ngữ cảnh thuê, đối soát giá, idempotency thanh toán, dữ liệu trả về muộn và kiểm thử sau hợp nhất nhánh.

### 1. Ngô Võ Tuấn An — nền tảng tích hợp và cổng đặt phòng

- Mở rộng mô hình khám phá nhiều cơ sở lưu trú, phân loại Hotel/Motel/Guesthouse/Homestay/Resort; bổ sung điểm đến, khu du lịch, địa danh và tiện ích tính khoảng cách.
- Bổ sung các hình thức thuê theo ngày, theo giờ và qua đêm trong luồng tìm kiếm; phát triển các màn hình khám phá, thương hiệu, chi tiết cơ sở, giữ chỗ và tra cứu.
- Phát triển phần mã nguồn loyalty/ledger, hồ sơ VAT và truy vấn hóa đơn. **Có mã nguồn không đồng nghĩa tất cả đã được nối vào tài khoản khách hoặc nghiệm thu end-to-end**; giới hạn hiện tại được nêu ở Phần IV.
- Trong đợt rà soát 18–19/10: tách cổng khách và quản lý, chuẩn hóa một phần form dùng chung, đồng bộ URL tìm kiếm, xử lý dữ liệu thiếu và kiểm thử modal/gallery.
- Bổ sung các phần local về quản trị gói/hợp đồng/mẫu in, social identity và VNPay; đây là phần mở rộng cần kiểm thử và cấu hình an toàn, không được mô tả là triển khai thanh toán thật.
- Rà soát trước push phát hiện social-login tin email/subject từ client. Theo quyết định của chủ dự án, endpoint được tạm khóa fail-closed cho tới khi xác minh token Google/Facebook đúng chuẩn. Loại bỏ secret VNPay ghi cứng; cấu hình phải cung cấp riêng qua môi trường/secret store.

Minh chứng commit đã có trên remote:

- https://github.com/GinNgo/hotel-saas-v2/commit/d83e102 — mở rộng tìm kiếm đa cơ sở và hình thức thuê.
- https://github.com/GinNgo/hotel-saas-v2/commit/9ee7b93 — danh mục địa danh và proximity/smart-filter.
- https://github.com/GinNgo/hotel-saas-v2/commit/bb67550 — cổng đặt phòng công khai và các route guest.
- https://github.com/GinNgo/hotel-saas-v2/commit/8786b12 — loyalty, VAT và hóa đơn.
- https://github.com/GinNgo/hotel-saas-v2/commit/ec98505 — loyalty ledger và tích hợp điểm trong mã nguồn booking.

### 2. Nguyễn Khôi Nguyên — đặt phòng tại quầy và lịch phòng

- Bổ sung form tạo đặt phòng tại quầy, chọn lịch/phòng và lấy báo giá trước khi xác nhận.
- Bổ sung lưới timeline phòng để hỗ trợ lễ tân theo dõi thời gian lưu trú.
- Mở rộng service và kiểm thử reservation, đồng bộ các thao tác check-in/check-out với trạng thái phòng.
- Phần này được commit và hợp nhất ngày **18/10**, là cập nhật tích hợp sau kỳ tuần, không ghi thành hoàn thành trong ngày 17/10.

Minh chứng:

- https://github.com/GinNgo/hotel-saas-v2/commit/96d9add950682229771a045947a5ee0f4867b179
- https://github.com/GinNgo/hotel-saas-v2/pull/6

### 3. Trần Trọng Tân — vận hành và an toàn thu ngân

- Phát triển các thao tác vận hành lễ tân, thanh toán/folio và báo cáo thu ngân theo ca.
- Bổ sung bảo vệ polling buồng phòng: kiểm tra generation/ngữ cảnh, bỏ dữ liệu trả về muộn và dọn subscription khi rời trang.
- Quản lý payment intent và idempotency key khi retry cùng nội dung; chặn submit đồng thời, cập nhật các nhóm dữ liệu thu ngân sau thanh toán và xử lý mất quyền 403.
- Sửa nhận diện metadata trong tham chiếu giao dịch: không dùng tìm kiếm token ở mọi vị trí trong dữ liệu người dùng; phân biệt tiền tố do server sinh, sanitize nội dung và bổ sung regression tests.

Minh chứng:

- https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354
- https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff
- https://github.com/GinNgo/hotel-saas-v2/blob/feature/tan-operations/docs/reports/BAO-CAO-TUAN-2-TRAN-TRONG-TAN-24TX810025.md

Các số test trong báo cáo cá nhân là thông tin do thành viên báo cáo; chỉ kết quả chạy lại hoặc log CI trực tiếp mới được dùng làm nghiệm thu tích hợp tại Phần III.

## PHẦN II. MINH CHỨNG MÃ NGUỒN VÀ THUẬT TOÁN

| Hạng mục | Minh chứng trên GitHub | Ý nghĩa kiểm chứng |
| --- | --- | --- |
| Khám phá đa cơ sở | https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs | Truy vấn public, bộ lọc cơ sở |
| Khoảng cách địa lý | https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Public/Services/GeoProximityHelper.cs | Tính proximity; không coi khoảng cách suy đoán là dữ liệu chắc chắn |
| Tính giá | https://github.com/GinNgo/hotel-saas-v2/blob/develop/backend/src/HotelSaas.Application/Quotes/Services/PricingCalculator.cs | Logic biểu giá phải đối soát lại ở server |
| Tìm kiếm phía khách | https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/booking.page.ts | Bộ lọc, URL state và khám phá nhiều cơ sở |
| Chi tiết/báo giá | https://github.com/GinNgo/hotel-saas-v2/blob/develop/frontend/src/app/features/public-booking/property-detail.page.ts | Kiểm tra lịch, hạng phòng và quote trước giữ chỗ |
| Lễ tân/timeline | https://github.com/GinNgo/hotel-saas-v2/blob/96d9add950682229771a045947a5ee0f4867b179/frontend/src/app/features/reservations/reservations.page.ts | Form tại quầy, live quote, lịch phòng |
| Polling buồng phòng | https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/frontend/src/app/features/housekeeping/housekeeping.page.ts | Generation và ngữ cảnh chống stale response |
| Retry thu tiền | https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/frontend/src/app/features/payments/payments.page.ts | Snapshot intent và vòng đời idempotency key |
| Metadata thanh toán | https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs | Phân tách metadata server và nội dung khách nhập |
| Regression tiền/cọc | https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs | Test chống nhận nhầm token/tiền cọc |
| CI | https://github.com/GinNgo/hotel-saas-v2/blob/develop/.github/workflows/ci.yml | Kiểm tra build và test tự động |

Các trang dạng `blob/develop` phản ánh nhánh tích hợp đang tiếp tục thay đổi; các đường dẫn gắn commit là mốc cố định để đối chiếu đóng góp. Báo cáo không tự gán độ phức tạp tối ưu, điểm thuật toán, coverage hay hiệu năng khi chưa đo.

## PHẦN III. TÍCH HỢP NHÁNH VÀ KIỂM THỬ

### 1. Trạng thái trước đợt xử lý 19/10

- PR #3, #4 và #6 đã merge vào develop; không merge lại các nhánh lịch sử chỉ để tăng số merge.
- Remote develop ở `5d0bfd6`; remote main ở `3a602c2` trước lần tích hợp này.
- Nhánh `feature/tan-operations` còn commit sửa lỗi `e8fbb33` chưa nằm trong develop ở thời điểm kiểm tra.
- Local có nhiều thay đổi chưa commit. Chủ dự án xác nhận đưa local lên develop trước rồi mới tiếp tục hợp nhất main.

### 2. Lỗi CI được đối chiếu trực tiếp

Run https://github.com/GinNgo/hotel-saas-v2/actions/runs/39122543463 thất bại frontend vì `TS2300`: import `RoomService` và field `roomService` bị khai báo trùng trong reservations sau hợp nhất. Job backend của run này thành công, security bị skip; không ghi cả pipeline là pass.

Workflow cũ gọi `npm run test:unit:ci --if-present` nhưng package.json không có script đó. Kết quả xanh trước đây vì thế không đủ chứng minh unit tests frontend được chạy. Lần sửa này dùng script `npm test -- --watch=false` thực sự tồn tại và siết tổng hợp trạng thái backend/frontend.

Build local đầu vòng thành công nhưng có hai warning xung đột EF Core Relational 10.0.4/10.0.12. Đã chỉ định cùng phiên bản Relational 10.0.12 với EF Core hiện hữu để kiểm tra lại, không thêm thư viện ngoài stack.

### 3. Kết quả nghiệm thu cuối đợt

Đợt tích hợp được theo dõi tại https://github.com/GinNgo/hotel-saas-v2/pull/7 với các mốc:

- https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe — commit/push local đã được chủ dự án xác nhận, gồm gate bảo mật và sửa lỗi khai báo trùng.
- https://github.com/GinNgo/hotel-saas-v2/commit/5e40505 — merge bản sửa vận hành của Tân; giải quyết conflict test connection bằng cách giữ biến cổng và Persist Security Info, đồng bộ EmptyState theo Input/template tương thích.
- https://github.com/GinNgo/hotel-saas-v2/commit/77fbc67 — chuyển CI sang `npm ci`; log thực tế cho thấy `--legacy-peer-deps` trước đó bỏ dependency peer Vite cần để nạp Vitest, dẫn tới thông báo không tìm thấy Vitest dù package đã được khai báo. Không tắt test để làm xanh pipeline.

| Phạm vi kiểm tra | Kết quả trực tiếp |
| --- | --- |
| Frontend sau merge Tân, local | 360/360 tests pass, 35 files |
| Frontend trên GitHub Actions tại 77fbc67 | 360/360 tests pass, 35 files; build production thành công |
| Backend sau merge Tân, local | Release build: 0 warning, 0 error |
| Backend CI trên cây mã 5e40505 | Application 366, Domain 1, WebApi 50: tổng 417 tests pass, 0 fail, 0 skip |
| Safety/Domain chạy local riêng | 2 tests chặn social-login/VNPay thiếu cấu hình và 1 Domain test pass; nằm trong bộ backend, không cộng trùng vào tổng 417 |

Minh chứng backend sau merge: https://github.com/GinNgo/hotel-saas-v2/actions/runs/39224402282 — job backend pass, **toàn run còn fail frontend** trước khi sửa cài peer dependencies. Minh chứng CI sau sửa: https://github.com/GinNgo/hotel-saas-v2/actions/runs/39224713549. Trạng thái đồng bộ main và các check trên bản merge cuối được kiểm tra tại PR #7 và https://github.com/GinNgo/hotel-saas-v2/actions.

Build frontend còn warning CommonJS `sweetalert2`. `npm audit` báo 7 mục (5 high, 2 moderate), chủ yếu chuỗi công cụ Tailwind 3/glob/PostCSS; không chạy `npm audit fix --force` vì đề xuất đổi major Tailwind 4 có thể phá giao diện. Chưa kết luận khả năng khai thác runtime; cần đánh giá và nâng cấp trong task riêng. Bước lint dùng `--if-present` không tương đương có linter cấu hình; gitleaks hiện vẫn advisory (`continue-on-error`), không phải cổng security bắt buộc hay chứng nhận không có lỗ hổng.

Không dùng lại số 347/348 của vòng audit trước làm kết quả nghiệm thu cho cây mã mới. Các test DB chỉ được chạy trong dịch vụ PostgreSQL test cô lập của CI; không chạy vào DB dev/prod/staging trên máy.

## PHẦN IV. HẠN CHẾ VÀ KẾ HOẠCH TUẦN TIẾP THEO

1. Các claim về Smart Lock, hoàn tiền, voucher, tiện nghi và giá marketing còn cần ràng buộc dữ liệu/capability thật theo từng cơ sở. Không công bố toàn bộ tính năng đã sẵn sàng cho khách sử dụng.
2. Hoàn thiện hợp đồng API hồ sơ khách và lịch sử theo subject đăng nhập; giao diện hiện có phần chưa nối. Không dùng hóa đơn/điểm mẫu thay dữ liệu thật.
3. Social login tạm khóa cho tới khi xác minh chữ ký, issuer/audience/expiry và quy tắc liên kết tài khoản được kiểm chứng. Có cấu hình dự án cũ không thay thế bước xác minh token.
4. VNPay cần cấu hình merchant/secret riêng và kiểm thử sandbox hoàn chỉnh. Unit test chữ ký hoặc callback không chứng minh thanh toán hay hoàn tiền thực đã thành công.
5. Tiếp tục regression ngữ cảnh tìm kiếm khi quay lại từ Detail; kiểm tra keyboard, mobile, zoom và nội dung component con sau thay đổi UI.
6. Giữ các guard tenant/property, authorization, idempotency và chống đặt trùng trong mọi vòng tích hợp; không chạy migration/deploy thật trong đợt nộp mã này.
7. Xử lý dependency audit theo đánh giá tương thích; duy trì test frontend thực sự được chạy trên clean install, không dựa node_modules cũ của máy thành viên.

## PHẦN V. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO

### 1. Phạm vi hỗ trợ

Nhóm sử dụng công cụ AI để hỗ trợ phân tích yêu cầu, đề xuất cấu trúc code/test, kiểm tra khác biệt nhánh, đọc log CI, phát hiện lỗi và soạn thảo tài liệu. Trong phiên tích hợp này sử dụng **OpenAI Codex**. Tên model/version của các phiên trước không được suy đoán từ báo cáo mẫu; thành viên cần xác nhận nhật ký của mình nếu biểu mẫu yêu cầu cụ thể.

### 2. Các nhóm yêu cầu và đầu ra

| Nhóm yêu cầu | Vai trò của AI | Hoạt động rà soát/đối chiếu thực tế |
| --- | --- | --- |
| Phân tích Home, form và luồng tìm phòng | Đọc source, đề xuất đặc tả và component dùng chung; hỗ trợ tạo test | Đối chiếu route/service/state; tách claim khỏi dữ liệu thật; không khẳng định đã tạo file Canva khi không có thiết kế được xác nhận |
| Review vận hành của thành viên | Đọc diff housekeeping/payment và đề xuất regression | Đối chiếu commit sửa của Tân, không lấy báo cáo thành viên thay log kiểm thử |
| Automation chức năng | Chạy test và browser fixture, ghi findings | Phân biệt lỗi sản phẩm với API bị fixture chủ động chặn; không gọi thanh toán hoặc DB thật |
| Merge và sửa CI | Kiểm tra ancestry, log build, script thực tế, cấu hình dependency | Giữ lịch sử commit thành viên; sửa nguyên nhân lỗi thay vì tắt test; kiểm tra lại trước khi cập nhật main |
| Bảo mật tích hợp | Phát hiện endpoint tin identity client và secret hard-coded | Chủ dự án đồng ý khóa endpoint tạm và bỏ secret trước push; không ghi thông số bí mật vào báo cáo |
| Báo cáo tuần 02 | Tổng hợp kết quả theo commit, source và log | Ghi rõ mốc tích hợp ngoài kỳ; sửa tên giảng viên theo xác nhận; không tự tạo số coverage, SUS hay kết quả người dùng |

Đây là tóm tắt nội dung hỗ trợ, không phải bản chép nguyên văn mọi prompt hay toàn bộ lịch sử AI của từng thành viên. Đóng góp được phân công theo phạm vi/commit; chưa có bằng chứng đầy đủ để khẳng định sinh viên đã tự viết lại toàn bộ phần do AI đề xuất. Thành viên chịu trách nhiệm đọc, kiểm chứng và xác nhận nội dung trước khi nộp.

### 3. Cam kết trung thực

Không báo cáo tính năng đang mock hoặc chưa tích hợp là hoạt động thực tế; không ghi test “pass” nếu chưa có kết quả; không gộp mã mới chưa kiểm chứng vào minh chứng cũ. Không công bố secret, token cá nhân hoặc thông tin khách hàng. Điểm số, coverage và trải nghiệm người dùng chỉ được bổ sung khi có phương pháp đo cùng bằng chứng.
