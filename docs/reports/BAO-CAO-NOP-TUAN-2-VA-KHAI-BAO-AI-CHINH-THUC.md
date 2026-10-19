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

**Mốc mã nguồn nghiệm thu:** PR #7 đã merge vào `main` tại `003a016a598e34b238dbd92d14a77d32be6abc12` ngày 19/10/2026. CI trên chính bản merge hoàn tất thành công ở cấp pipeline; backend 417 tests và frontend 360 tests pass. Bước quét Gitleaks vẫn có lỗi được bỏ qua theo cấu hình hiện hữu, nên không mô tả hệ thống đã đạt nghiệm thu bảo mật toàn diện.

**Bố cục nộp bài:** nội dung, link file theo từng thành viên, lịch sử commit, khai báo AI theo từng prompt, kết quả kiểm thử và hạn chế nằm ngay trong báo cáo này, không cần phụ lục riêng. Dùng Phần IV cho các ô khai báo AI; các phần còn lại là nội dung báo cáo.

### Danh sách thành viên

| STT | Họ và tên | MSSV | Email sinh viên | Phạm vi đóng góp được đối chiếu |
| --- | --- | --- | --- | --- |
| 1 | Ngô Võ Tuấn An | 24TX810001 | 24tx810001@student.hcmute.edu.vn | Kiến trúc/tích hợp, cổng đặt phòng đa cơ sở, tìm kiếm địa danh, guest portal và rà soát UI/form, bảo mật, CI |
| 2 | Nguyễn Khôi Nguyên | 24TX810011 | 24tx810011@student.hcmute.edu.vn | Đặt phòng tại quầy, báo giá trực tiếp và lưới thời gian phòng; tích hợp PR #6 ngày 18/10 |
| 3 | Trần Trọng Tân | 24TX810025 | 24tx810025@student.hcmute.edu.vn | Vận hành lễ tân, buồng phòng, thu ngân/báo cáo ca; sửa polling, retry thanh toán và nhận diện metadata |

## PHẦN I. TỔNG QUAN KẾT QUẢ THỰC HIỆN

Sau phần nền tảng kiến trúc, danh mục phòng và FSM buồng phòng của Tuần 01, nhóm mở rộng sang luồng nghiệp vụ đặt phòng và vận hành. Tuần này không chỉ bổ sung màn hình mà còn xử lý các vấn đề xuyên phân hệ: giữ ngữ cảnh thuê, đối soát giá, idempotency thanh toán, dữ liệu trả về muộn và kiểm thử sau hợp nhất nhánh.

### 0. Mục tiêu nghiệp vụ và phạm vi

1. **Khách đặt phòng:** truy cập trang công khai không buộc đăng nhập, tìm nhiều cơ sở theo điểm đến/loại hình, chọn lịch và chế độ thuê, xem chi tiết trước khi yêu cầu báo giá và giữ chỗ.
2. **Lễ tân:** tạo đặt phòng tại quầy, chọn phòng theo lịch, xem giá trước xác nhận và thực hiện nhận/trả phòng qua API hiện có.
3. **Buồng phòng:** tiếp nhận trạng thái sau trả phòng, cập nhật công việc mà không bị response polling cũ ghi đè.
4. **Thu ngân:** theo dõi folio, thu tiền an toàn khi retry, cập nhật lịch sử/tổng thu/báo cáo ca và xử lý mất quyền theo hướng fail-closed.
5. **Nhóm phát triển:** giữ đúng lịch sử đóng góp, kiểm thử cây mã sau merge; không dùng báo cáo tự khai thay log và không triển khai môi trường thật.

Động cơ đặt phòng, tính giá và vòng đời lưu trú đã có trong nền tảng được **tái sử dụng và tích hợp**, không tính toàn bộ mã nền thành tính năng mới của tuần này. Kế hoạch giao việc là căn cứ phân công, không tự chứng minh hoàn thành; kết quả bên dưới đối chiếu source, commit và test.

### 1. Ngô Võ Tuấn An — nền tảng tích hợp và cổng đặt phòng

- Mở rộng mô hình khám phá nhiều cơ sở lưu trú, phân loại Hotel/Motel/Guesthouse/Homestay/Resort; bổ sung điểm đến, khu du lịch, địa danh và tiện ích tính khoảng cách.
- Bổ sung các hình thức thuê theo ngày, theo giờ và qua đêm trong luồng tìm kiếm; phát triển các màn hình khám phá, thương hiệu, chi tiết cơ sở, giữ chỗ và tra cứu.
- Phát triển phần mã nguồn loyalty/ledger, hồ sơ VAT và truy vấn hóa đơn. **Có mã nguồn không đồng nghĩa tất cả đã được nối vào tài khoản khách hoặc nghiệm thu end-to-end**; giới hạn hiện tại được nêu ở Phần VI.
- Trong đợt rà soát 18–19/10: tách cổng khách và quản lý, chuẩn hóa một phần form dùng chung, đồng bộ URL tìm kiếm, xử lý dữ liệu thiếu và kiểm thử modal/gallery.
- Bổ sung các phần local về quản trị gói/hợp đồng/mẫu in, social identity và VNPay; đây là phần mở rộng cần kiểm thử và cấu hình an toàn, không được mô tả là triển khai thanh toán thật.
- Rà soát trước push phát hiện social-login tin email/subject từ client. Theo quyết định của chủ dự án, endpoint được tạm khóa fail-closed cho tới khi xác minh token Google/Facebook đúng chuẩn. Loại bỏ secret VNPay ghi cứng; cấu hình phải cung cấp riêng qua môi trường/secret store.

#### 1.1. Tìm kiếm đa cơ sở và chuỗi khách sạn

Luồng khám phá chuyển từ cách trình bày giống một khách sạn đơn lẻ sang danh sách nhiều cơ sở. Bộ lọc phân biệt loại lưu trú Hotel/Motel/Guesthouse/Homestay/Resort, điểm đến, thương hiệu/chuỗi và chế độ Daily/Hourly/Overnight. Danh sách khám phá và dữ liệu khả dụng theo lịch là hai trách nhiệm khác nhau: thấy cơ sở trên Home không đồng nghĩa cam kết còn phòng cho mọi khung giờ.

Frontend dùng service và mô hình ngữ cảnh lưu trú dùng chung, thay vì để từng trang tự diễn giải ngày/giờ. Trạng thái tìm kiếm được đưa vào query parameters để hỗ trợ reload/chia sẻ URL. Audit vẫn phát hiện link quay lại từ Detail chưa giữ đủ filter; không ghi toàn bộ luồng điều hướng đã hoàn thiện.

#### 1.2. Danh mục địa danh và thuật toán proximity

`GeoProximityHelper` tính khoảng cách Haversine với bán kính Trái Đất 6.371.000 m, sau đó định dạng m/km. Gợi ý liên kết địa danh có các tầng dựa trên GPS, đơn vị hành chính và so khớp tên/địa chỉ tiếng Việt. Dữ liệu suy ra theo hành chính hoặc văn bản không được hiểu là phép đo GPS chính xác.

Tests kiểm tra tọa độ đã biết, định dạng khoảng cách, từng tầng gợi ý landmark, truy vấn không dấu và fallback bán kính khi ít kết quả. Chưa có benchmark độ trễ hoặc tỷ lệ gợi ý đúng trên dữ liệu vận hành lớn; không tự chấm điểm thuật toán hay gọi đây là chứng minh tối ưu tìm kiếm bằng AI.

#### 1.3. Cổng khách, form dùng chung và chi tiết phòng

Guest layout tách khỏi cổng quản lý; đường dẫn đăng nhập mang ngữ cảnh `portal=guest`. Profile phân biệt người chưa đăng nhập, khách và tài khoản quản lý. Tái sử dụng `SearchableSelect`, bổ sung `FormField` và directive form để thống nhất label, error, disabled và tương tác bàn phím ở các form pilot, không tạo một bộ input mới cho từng trang.

Dialog chi tiết phòng và gallery ảnh có kiểm thử tương tác. Bento category được sửa từ DIV chỉ có click sang native button có accessible name, đồng thời sửa Homestay lọc nhầm Guesthouse. Hai sửa đổi này không có nghĩa mọi claim tiện nghi/chính sách hoặc toàn bộ accessibility đã đạt.

Tài liệu phân tích gồm `spec.md`, `plan.md`, `tasks.md` và đề xuất API khách trong `docs/design`. Repo không có bộ scripts `.specify` đầy đủ: ghi nhận cách tổ chức đặc tả theo Spec Kit, không khẳng định đã chạy CLI không tồn tại. Chưa có minh chứng bàn giao file Canva trong đợt này.

#### 1.4. Hội viên, ledger điểm và hóa đơn

Mã nguồn có hồ sơ hội viên, quy tắc hạng, sổ giao dịch điểm và truy vấn hóa đơn/bản in. Đây là nền tảng tích hợp; Profile render được không chứng minh ownership, lịch sử tài khoản hoặc đổi điểm đã hoàn tất end-to-end.

Profile hiện lấy tên/email từ phiên đăng nhập và thông báo rõ mục chưa nối. Không điền điểm, đơn đặt phòng hoặc hóa đơn giả để giao diện có vẻ đầy đủ. API hồ sơ/lịch sử khách đã được yêu cầu thiết kế tiếp, nhưng tài liệu contract không được tính như API hoàn thiện.

#### 1.5. An toàn tích hợp và giới hạn vận hành

Social-login được chặn ở endpoint công khai bằng `503 / SOCIAL_LOGIN_DISABLED`, không dispatch identity chưa xác minh vào handler. Đây là giảm rủi ro tạm thời, không phải đã hoàn thiện Google/Facebook login.

VNPay không dùng merchant/secret fallback ghi cứng: thiếu cấu hình thì không tạo URL và không xác nhận callback hợp lệ. Hai safety tests kiểm tra các nhánh này. `Payment__Vnpay__TmnCode` và `Payment__Vnpay__HashSecret` phải cung cấp riêng; báo cáo không chứa giá trị bí mật hoặc khẳng định đã thanh toán thật.

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

#### 2.1. Form đặt phòng tại quầy và live quote

Form tập hợp thông tin khách, lịch lưu trú, hình thức thuê và phòng chọn; tích hợp tỉnh/xã và nhóm phòng theo tầng/hạng phòng. Preset hỗ trợ nhập nhanh, không thay bước kiểm tra giá/khả dụng phía server. Live quote kết nối service báo giá để hiển thị tiền dự kiến trước tạo đơn; backend vẫn là nguồn quyết định tiền và quyền thực thi.

Đóng góp trực tiếp ở `96d9add` tập trung frontend và service/tests liên quan. Backend reservation/quote là nền tảng dùng chung; không gán toàn bộ thuật toán server cho commit UI này.

#### 2.2. Lưới thời gian phòng

Timeline hỗ trợ đổi ngày/số ngày, lọc tầng/hạng phòng, ghép đơn theo ô ngày và mở form điền sẵn khi chọn ô trống. Tests kiểm tra đơn theo giờ/qua đêm và loại đơn hủy trong các tình huống được mô tả.

Timeline không thay cơ chế chống overbooking. Nền `ReservationTimeHelper` kiểm tra giao thoa khoảng lưu trú với buffer tối thiểu 30 phút; tính nhất quán khi đồng thời cần cơ chế server/database và test riêng. Không dùng màu phòng trên UI làm bằng chứng chống đặt trùng.

#### 2.3. Phối hợp nhận/trả phòng và phân quyền

Trang reservations nhận cả thay đổi vận hành từ Tân. Merge phải giữ check-in/check-out, lỗi folio và quyền lễ tân, không chọn nguyên một phiên bản làm mất phần người còn lại. Tests có tình huống thiếu quyền đọc hạng phòng, folio tải lỗi và xác nhận kiểm tra giấy tờ tại quầy. Không lấy tên file chung làm bằng chứng một người viết toàn bộ file.

Minh chứng:

- https://github.com/GinNgo/hotel-saas-v2/commit/96d9add950682229771a045947a5ee0f4867b179
- https://github.com/GinNgo/hotel-saas-v2/pull/6

### 3. Trần Trọng Tân — vận hành và an toàn thu ngân

- Phát triển các thao tác vận hành lễ tân, thanh toán/folio và báo cáo thu ngân theo ca.
- Bổ sung bảo vệ polling buồng phòng: kiểm tra generation/ngữ cảnh, bỏ dữ liệu trả về muộn và dọn subscription khi rời trang.
- Quản lý payment intent và idempotency key khi retry cùng nội dung; chặn submit đồng thời, cập nhật các nhóm dữ liệu thu ngân sau thanh toán và xử lý mất quyền 403.
- Sửa nhận diện metadata trong tham chiếu giao dịch: không dùng tìm kiếm token ở mọi vị trí trong dữ liệu người dùng; phân biệt tiền tố do server sinh, sanitize nội dung và bổ sung regression tests.

#### 3.1. Liên thông lễ tân — buồng phòng

Modal vận hành dùng API vòng đời lưu trú hiện có. Backend check-out kiểm tra trạng thái và dư nợ trước khi cập nhật đơn sang `CheckedOut`, phòng sang `Dirty` trong giao dịch. Nếu chưa lấy được folio, UI phải báo lỗi, không thay bằng số dư 0 để cho trả phòng. Xác nhận kiểm tra giấy tờ tại quầy không phải OCR hoặc tự động xác minh căn cước.

#### 3.2. Chống stale response của polling

Response cũ có thể về sau khi đổi chi nhánh/bộ lọc hoặc vừa cập nhật phòng. Sửa đổi dùng generation, ngữ cảnh request và dấu mốc mutation để chỉ nhận kết quả còn phù hợp, đồng thời dọn subscription khi rời trang. Cả success và error trả muộn phải bị loại bỏ, tránh ghi đè dữ liệu/thông báo của ngữ cảnh mới.

#### 3.3. Chống thu trùng khi retry

Payment intent giữ snapshot đơn, chi nhánh, số tiền, phương thức, tham chiếu, cờ tiền cọc và key. Khi mạng lỗi chưa biết server đã xử lý chưa, retry cùng intent giữ key cũ. Khi thành công hoặc payload đổi thì tạo vòng đời mới; cờ đang gửi chặn double-click. Hiệu quả replay vẫn phụ thuộc backend kiểm key/payload, không chỉ trạng thái component.

#### 3.4. Đồng bộ báo cáo ca và xử lý 403

Thu tiền thành công cập nhật folio, tổng thu ngày, lịch sử và báo cáo ca, giữ ngày/ca đã chọn. Nếu báo cáo trả 403, xóa dữ liệu tài chính đang giữ và khóa thao tác không còn quyền. Không hiển thị số cũ như dữ liệu mới hoặc tự đổi lỗi thành `0 đ`.

#### 3.5. Chống nhận nhầm metadata

Chuỗi `[IK:...]` hoặc `[PURPOSE:DEPOSIT]` do người dùng nhập không được hiểu là metadata server. Sửa đổi nhận diện prefix hợp lệ thay cho tìm token mọi vị trí, sanitize ngoặc trong user reference và bóc tách prefix có cấu trúc. Tests kiểm false collision, nhầm cọc và replay sau sanitize; không coi riêng `StartsWith` là đã loại bỏ mọi injection toàn hệ thống.

Minh chứng:

- https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354
- https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff
- https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb33/docs/reports/BAO-CAO-TUAN-2-TRAN-TRONG-TAN-24TX810025.md

Các số test trong báo cáo cá nhân là thông tin do thành viên báo cáo; chỉ kết quả chạy lại hoặc log CI trực tiếp mới được dùng làm nghiệm thu tích hợp tại Phần V.

## PHẦN II. DANH MỤC MINH CHỨNG FILE MÃ NGUỒN CỦA BA THÀNH VIÊN

Link source cố định theo commit có thay đổi của thành viên; link main cố định theo mốc tích hợp `003a016`. Cột commit là căn cứ đối chiếu diff, không suy ra người này tự viết toàn bộ file. `A` = thêm, `M` = sửa so với parent; một file có thể nhận đóng góp trên nhiều nhánh.

Chỉ chọn source, test, cấu hình và đặc tả trực tiếp liên quan báo cáo; không lấy số lượng migration/ảnh/tài liệu phụ để xếp hạng đóng góp.

### 1. Minh chứng của Ngô Võ Tuấn An — 24TX810001

Phân biệt commit chức năng 15/10 với commit local/tích hợp `c062cbe` ngày 19/10. Author commit tích hợp không chứng minh toàn bộ phần local do An viết độc lập.

#### Mã nguồn backend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`backend/src/HotelSaas.Application/Loyalty/Queries/GetMyGuestProfile/GetMyGuestProfileQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/8786b12fa3abb492e94675dd615dd819f6dc15f4/backend/src/HotelSaas.Application/Loyalty/Queries/GetMyGuestProfile/GetMyGuestProfileQueryHandler.cs) | [A:8786b12](https://github.com/GinNgo/hotel-saas-v2/commit/8786b12fa3abb492e94675dd615dd819f6dc15f4) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Loyalty/Queries/GetMyGuestProfile/GetMyGuestProfileQueryHandler.cs) | — |
| [`backend/src/HotelSaas.Application/Loyalty/Queries/GetMyInvoices/GetMyInvoicesQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/8786b12fa3abb492e94675dd615dd819f6dc15f4/backend/src/HotelSaas.Application/Loyalty/Queries/GetMyInvoices/GetMyInvoicesQueryHandler.cs) | [A:8786b12](https://github.com/GinNgo/hotel-saas-v2/commit/8786b12fa3abb492e94675dd615dd819f6dc15f4) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Loyalty/Queries/GetMyInvoices/GetMyInvoicesQueryHandler.cs) | — |
| [`backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyLedgerService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/ec9850583b0b3a1d122913fcf97008db7621d1c2/backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyLedgerService.cs) | [A:ec98505](https://github.com/GinNgo/hotel-saas-v2/commit/ec9850583b0b3a1d122913fcf97008db7621d1c2) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyLedgerService.cs) | — |
| [`backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyTierRules.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/8786b12fa3abb492e94675dd615dd819f6dc15f4/backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyTierRules.cs) | [A:8786b12](https://github.com/GinNgo/hotel-saas-v2/commit/8786b12fa3abb492e94675dd615dd819f6dc15f4) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Loyalty/Services/LoyaltyTierRules.cs) | — |
| [`backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/9ee7b931f7d92e82b9555621fe3d6605cff360e2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs) | [M:c3f4880](https://github.com/GinNgo/hotel-saas-v2/commit/c3f488006245be82897087eb76bc75a765ce759a), [M:9ee7b93](https://github.com/GinNgo/hotel-saas-v2/commit/9ee7b931f7d92e82b9555621fe3d6605cff360e2) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs) | — |
| [`backend/src/HotelSaas.Application/Public/Services/GeoProximityHelper.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/9ee7b931f7d92e82b9555621fe3d6605cff360e2/backend/src/HotelSaas.Application/Public/Services/GeoProximityHelper.cs) | [A:9ee7b93](https://github.com/GinNgo/hotel-saas-v2/commit/9ee7b931f7d92e82b9555621fe3d6605cff360e2) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Public/Services/GeoProximityHelper.cs) | — |
| [`backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs) | — |
| [`backend/src/HotelSaas.WebApi/Controllers/AuthController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs) | [M:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs) | — |

#### Mã nguồn frontend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`frontend/src/app/features/public-booking/booking-hold.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/features/public-booking/booking-hold.page.ts) | [M:bb67550](https://github.com/GinNgo/hotel-saas-v2/commit/bb6755077826f54997f613499ed3ad744b890c88), [M:8786b12](https://github.com/GinNgo/hotel-saas-v2/commit/8786b12fa3abb492e94675dd615dd819f6dc15f4), [M:ec98505](https://github.com/GinNgo/hotel-saas-v2/commit/ec9850583b0b3a1d122913fcf97008db7621d1c2), [M:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/public-booking/booking-hold.page.ts) | — |
| [`frontend/src/app/features/public-booking/booking.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/features/public-booking/booking.page.ts) | [M:c3f4880](https://github.com/GinNgo/hotel-saas-v2/commit/c3f488006245be82897087eb76bc75a765ce759a), [M:d83e102](https://github.com/GinNgo/hotel-saas-v2/commit/d83e1020ecc409395c0de7eb44206419fe182e65), [M:9ee7b93](https://github.com/GinNgo/hotel-saas-v2/commit/9ee7b931f7d92e82b9555621fe3d6605cff360e2), [M:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/public-booking/booking.page.ts) | — |
| [`frontend/src/app/features/public-booking/member/guest-profile.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/features/public-booking/member/guest-profile.page.ts) | [A:8786b12](https://github.com/GinNgo/hotel-saas-v2/commit/8786b12fa3abb492e94675dd615dd819f6dc15f4), [M:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/public-booking/member/guest-profile.page.ts) | — |
| [`frontend/src/app/features/public-booking/property-detail.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/features/public-booking/property-detail.page.ts) | [A:bb67550](https://github.com/GinNgo/hotel-saas-v2/commit/bb6755077826f54997f613499ed3ad744b890c88), [M:8786b12](https://github.com/GinNgo/hotel-saas-v2/commit/8786b12fa3abb492e94675dd615dd819f6dc15f4), [M:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/public-booking/property-detail.page.ts) | — |
| [`frontend/src/app/layouts/guest-layout/guest-layout.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/layouts/guest-layout/guest-layout.ts) | [A:bb67550](https://github.com/GinNgo/hotel-saas-v2/commit/bb6755077826f54997f613499ed3ad744b890c88), [M:8786b12](https://github.com/GinNgo/hotel-saas-v2/commit/8786b12fa3abb492e94675dd615dd819f6dc15f4), [M:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/layouts/guest-layout/guest-layout.ts) | — |
| [`frontend/src/app/shared/components/form-field/form-field.component.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/shared/components/form-field/form-field.component.ts) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/shared/components/form-field/form-field.component.ts) | — |
| [`frontend/src/app/shared/components/searchable-select/searchable-select.component.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/shared/components/searchable-select/searchable-select.component.ts) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/shared/components/searchable-select/searchable-select.component.ts) | — |

#### Tests backend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`backend/tests/HotelSaas.Application.Tests/Public/GeoProximityAndSmartFilterTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/9ee7b931f7d92e82b9555621fe3d6605cff360e2/backend/tests/HotelSaas.Application.Tests/Public/GeoProximityAndSmartFilterTests.cs) | [A:9ee7b93](https://github.com/GinNgo/hotel-saas-v2/commit/9ee7b931f7d92e82b9555621fe3d6605cff360e2) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/tests/HotelSaas.Application.Tests/Public/GeoProximityAndSmartFilterTests.cs) | — |
| [`backend/tests/HotelSaas.WebApi.Tests/UnconfiguredIntegrationSafetyTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/backend/tests/HotelSaas.WebApi.Tests/UnconfiguredIntegrationSafetyTests.cs) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/tests/HotelSaas.WebApi.Tests/UnconfiguredIntegrationSafetyTests.cs) | — |

#### Tests frontend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`frontend/src/app/features/public-booking/booking-content.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/features/public-booking/booking-content.spec.ts) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/public-booking/booking-content.spec.ts) | — |
| [`frontend/src/app/shared/components/photo-gallery-modal/photo-gallery-modal.component.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/shared/components/photo-gallery-modal/photo-gallery-modal.component.spec.ts) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/shared/components/photo-gallery-modal/photo-gallery-modal.component.spec.ts) | — |
| [`frontend/src/app/shared/components/room-detail-modal/room-detail-modal.component.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/frontend/src/app/shared/components/room-detail-modal/room-detail-modal.component.spec.ts) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/shared/components/room-detail-modal/room-detail-modal.component.spec.ts) | — |

#### Cấu hình/tooling/dữ liệu hỗ trợ

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`.github/workflows/ci.yml`](https://github.com/GinNgo/hotel-saas-v2/blob/77fbc67309e9f5e22119af6510c397640c47a82c/.github/workflows/ci.yml) | [M:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869), [M:77fbc67](https://github.com/GinNgo/hotel-saas-v2/commit/77fbc67309e9f5e22119af6510c397640c47a82c) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/.github/workflows/ci.yml) | — |

#### Tài liệu/minh họa

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`docs/design/booking-marketplace/guest-account-api.md`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/docs/design/booking-marketplace/guest-account-api.md) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/docs/design/booking-marketplace/guest-account-api.md) | — |
| [`docs/design/experience-foundation/plan.md`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/docs/design/experience-foundation/plan.md) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/docs/design/experience-foundation/plan.md) | — |
| [`docs/design/experience-foundation/spec.md`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/docs/design/experience-foundation/spec.md) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/docs/design/experience-foundation/spec.md) | — |
| [`docs/design/experience-foundation/tasks.md`](https://github.com/GinNgo/hotel-saas-v2/blob/c062cbe3b9746f839716d248e5cea04ac32e8869/docs/design/experience-foundation/tasks.md) | [A:c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe3b9746f839716d248e5cea04ac32e8869) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/docs/design/experience-foundation/tasks.md) | — |

Đặc tả/kế hoạch không tự chứng minh API hoặc mọi task đã triển khai.

### 2. Minh chứng của Nguyễn Khôi Nguyên — 24TX810011

Commit của Nguyên ngày **18/10**, là cập nhật ngoài kỳ chính. Phạm vi là frontend/service/tests/cấu hình, không tự gán backend reservation/quote có sẵn cho Nguyên.

#### Mã nguồn frontend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`frontend/src/app/core/services/reservation.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/96d9add950682229771a045947a5ee0f4867b179/frontend/src/app/core/services/reservation.service.ts) | [M:96d9add](https://github.com/GinNgo/hotel-saas-v2/commit/96d9add950682229771a045947a5ee0f4867b179) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/core/services/reservation.service.ts) | Ngô Võ Tuấn An, Trần Trọng Tân |
| [`frontend/src/app/features/reservations/reservations.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/96d9add950682229771a045947a5ee0f4867b179/frontend/src/app/features/reservations/reservations.page.ts) | [M:96d9add](https://github.com/GinNgo/hotel-saas-v2/commit/96d9add950682229771a045947a5ee0f4867b179) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/reservations/reservations.page.ts) | Ngô Võ Tuấn An, Trần Trọng Tân |

#### Tests frontend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`frontend/src/app/core/services/reservation.service.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/96d9add950682229771a045947a5ee0f4867b179/frontend/src/app/core/services/reservation.service.spec.ts) | [A:96d9add](https://github.com/GinNgo/hotel-saas-v2/commit/96d9add950682229771a045947a5ee0f4867b179) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/core/services/reservation.service.spec.ts) | Trần Trọng Tân |
| [`frontend/src/app/features/reservations/reservations.page.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/96d9add950682229771a045947a5ee0f4867b179/frontend/src/app/features/reservations/reservations.page.spec.ts) | [M:96d9add](https://github.com/GinNgo/hotel-saas-v2/commit/96d9add950682229771a045947a5ee0f4867b179) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/reservations/reservations.page.spec.ts) | Trần Trọng Tân |

#### Cấu hình/tooling/dữ liệu hỗ trợ

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`frontend/angular.json`](https://github.com/GinNgo/hotel-saas-v2/blob/96d9add950682229771a045947a5ee0f4867b179/frontend/angular.json) | [M:96d9add](https://github.com/GinNgo/hotel-saas-v2/commit/96d9add950682229771a045947a5ee0f4867b179) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/angular.json) | — |
| [`frontend/package-lock.json`](https://github.com/GinNgo/hotel-saas-v2/blob/9f4291b94884accf5f25389e878fd2b12f8df046/frontend/package-lock.json) | [M:9f4291b](https://github.com/GinNgo/hotel-saas-v2/commit/9f4291b94884accf5f25389e878fd2b12f8df046) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/package-lock.json) | — |
| [`frontend/package.json`](https://github.com/GinNgo/hotel-saas-v2/blob/9f4291b94884accf5f25389e878fd2b12f8df046/frontend/package.json) | [M:9f4291b](https://github.com/GinNgo/hotel-saas-v2/commit/9f4291b94884accf5f25389e878fd2b12f8df046) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/package.json) | — |

### 3. Minh chứng của Trần Trọng Tân — 24TX810025

Đối chiếu `f711156` và `e8fbb33` ngày 17/10 cho vận hành/regression. Reservations/service/tests phối hợp với Nguyên và có tích hợp sau đó của An.

#### Mã nguồn backend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommand.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommand.cs) | — |
| [`backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354), [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Payments/Commands/CreatePayment/CreatePaymentCommandHandler.cs) | — |
| [`backend/src/HotelSaas.Application/Payments/DTOs/FolioDto.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.Application/Payments/DTOs/FolioDto.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Payments/DTOs/FolioDto.cs) | — |
| [`backend/src/HotelSaas.Application/Payments/DTOs/ShiftReportDto.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.Application/Payments/DTOs/ShiftReportDto.cs) | [A:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Payments/DTOs/ShiftReportDto.cs) | — |
| [`backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354), [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Payments/Queries/GetFolio/GetFolioQueryHandler.cs) | — |
| [`backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQuery.cs) | [A:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQuery.cs) | — |
| [`backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs) | [A:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Payments/Queries/GetShiftReport/GetShiftReportQueryHandler.cs) | — |
| [`backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354), [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Public/Commands/ConfirmGuestBooking/ConfirmGuestBookingCommand.cs) | Ngô Võ Tuấn An |
| [`backend/src/HotelSaas.Application/Quotes/DTOs/QuoteDto.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.Application/Quotes/DTOs/QuoteDto.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Quotes/DTOs/QuoteDto.cs) | — |
| [`backend/src/HotelSaas.Application/Quotes/Queries/CalculateQuote/CalculateQuoteQueryHandler.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.Application/Quotes/Queries/CalculateQuote/CalculateQuoteQueryHandler.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Quotes/Queries/CalculateQuote/CalculateQuoteQueryHandler.cs) | — |
| [`backend/src/HotelSaas.Application/Quotes/Services/PricingCalculator.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.Application/Quotes/Services/PricingCalculator.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Quotes/Services/PricingCalculator.cs) | — |
| [`backend/src/HotelSaas.Infrastructure/Persistence/SeedData.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.Infrastructure/Persistence/SeedData.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Infrastructure/Persistence/SeedData.cs) | Ngô Võ Tuấn An |
| [`backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.WebApi/Controllers/PaymentsController.cs) | Ngô Võ Tuấn An |
| [`backend/src/HotelSaas.WebApi/Models/CreatePaymentRequest.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/backend/src/HotelSaas.WebApi/Models/CreatePaymentRequest.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.WebApi/Models/CreatePaymentRequest.cs) | — |

#### Mã nguồn frontend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`frontend/src/app/app.config.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/app.config.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/app.config.ts) | — |
| [`frontend/src/app/app.routes.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/app.routes.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/app.routes.ts) | Ngô Võ Tuấn An |
| [`frontend/src/app/core/models/payment.model.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/core/models/payment.model.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/core/models/payment.model.ts) | Ngô Võ Tuấn An |
| [`frontend/src/app/core/models/reservation.model.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/core/models/reservation.model.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/core/models/reservation.model.ts) | — |
| [`frontend/src/app/core/services/payment.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/core/services/payment.service.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/core/services/payment.service.ts) | — |
| [`frontend/src/app/core/services/reservation.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/core/services/reservation.service.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/core/services/reservation.service.ts) | Ngô Võ Tuấn An, Nguyễn Khôi Nguyên |
| [`frontend/src/app/core/services/room.service.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/core/services/room.service.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/core/services/room.service.ts) | — |
| [`frontend/src/app/features/housekeeping/housekeeping.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/frontend/src/app/features/housekeeping/housekeeping.page.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354), [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/housekeeping/housekeeping.page.ts) | — |
| [`frontend/src/app/features/payments/payments.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/frontend/src/app/features/payments/payments.page.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354), [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/payments/payments.page.ts) | Ngô Võ Tuấn An |
| [`frontend/src/app/features/reservations/reservations.page.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/features/reservations/reservations.page.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/reservations/reservations.page.ts) | Ngô Võ Tuấn An, Nguyễn Khôi Nguyên |
| [`frontend/src/app/shared/components/empty-state/empty-state.component.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/frontend/src/app/shared/components/empty-state/empty-state.component.ts) | [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/shared/components/empty-state/empty-state.component.ts) | Ngô Võ Tuấn An |

#### Tests backend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354), [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/tests/HotelSaas.Application.Tests/Payments/P4_CashFolioTests.cs) | — |
| [`backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs) | [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/tests/HotelSaas.Application.Tests/Public/P5_GuestBookingTests.cs) | Ngô Võ Tuấn An |

#### Tests frontend

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`frontend/src/app/core/services/payment.service.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/core/services/payment.service.spec.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/core/services/payment.service.spec.ts) | — |
| [`frontend/src/app/core/services/reservation.service.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/core/services/reservation.service.spec.ts) | [A:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/core/services/reservation.service.spec.ts) | Nguyễn Khôi Nguyên |
| [`frontend/src/app/features/housekeeping/housekeeping.page.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/frontend/src/app/features/housekeeping/housekeeping.page.spec.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354), [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/housekeeping/housekeeping.page.spec.ts) | — |
| [`frontend/src/app/features/payments/payments.page.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/frontend/src/app/features/payments/payments.page.spec.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354), [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/payments/payments.page.spec.ts) | — |
| [`frontend/src/app/features/reservations/reservations.page.spec.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/app/features/reservations/reservations.page.spec.ts) | [M:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/app/features/reservations/reservations.page.spec.ts) | Nguyễn Khôi Nguyên |

#### Cấu hình/tooling/dữ liệu hỗ trợ

| File theo commit đóng góp | Commit thay đổi | Bản main tích hợp | Phối hợp trong tập commit khảo sát |
| --- | --- | --- | --- |
| [`.gitignore`](https://github.com/GinNgo/hotel-saas-v2/blob/e8fbb338887d48c4b1c098fa441999bd70bd3eff/.gitignore) | [M:e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb338887d48c4b1c098fa441999bd70bd3eff) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/.gitignore) | — |
| [`frontend/src/jsdom.d.ts`](https://github.com/GinNgo/hotel-saas-v2/blob/f711156f8ea8e4a04659d13f1a5660d3d05f4354/frontend/src/jsdom.d.ts) | [A:f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156f8ea8e4a04659d13f1a5660d3d05f4354) | [Xem file](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/frontend/src/jsdom.d.ts) | — |

### 4. Mã nền dùng chung được tái sử dụng

- [`backend/src/HotelSaas.Application/Public/Queries/CalculatePublicQuote/CalculatePublicQuoteQuery.cs`](https://github.com/GinNgo/hotel-saas-v2/blob/003a016a598e34b238dbd92d14a77d32be6abc12/backend/src/HotelSaas.Application/Public/Queries/CalculatePublicQuote/CalculatePublicQuoteQuery.cs).
Các file trên tồn tại ở bản tích hợp nhưng không có diff trong tập commit nội dung của An đã khảo sát. Chỉ ghi là nền được sử dụng, không tính thành phần An viết mới trong tuần.

### 5. Cơ chế, kiểm thử và giới hạn

| Bài toán | Cơ chế | Tình huống đối chiếu | Chưa được suy ra |
| --- | --- | --- | --- |
| Gần địa danh | Haversine + fallback | Tọa độ, không dấu, bán kính hẹp | Hiệu năng/tỷ lệ gợi ý đúng thực tế |
| Giá/đặt phòng | Core, buffer, quote dùng chung | Biên buffer, FSM, HTTP pipeline | Timeline thay được concurrency guard |
| Polling | Generation/context/mutation | Success/error cũ, đổi ngữ cảnh | Thay được isolation server |
| Retry tiền | Intent + key + replay server | Retry, đổi payload, double-click | Cổng thanh toán thật đã đối soát |
| Metadata | Prefix + sanitize | IK/cọc giả, replay | Audit mọi đầu vào toàn hệ thống |
| Mất quyền | Clear/latch 403 | Báo cáo ca/access denied | Mọi permissions đã được kiểm toàn diện |
| Input/dialog | Shared control, native button | Test host, child thật, modal/gallery | Toàn bộ WCAG đã đạt |

## PHẦN III. ĐỐI CHIẾU LỊCH SỬ COMMIT NGUYÊN VĂN

| Ngày | Commit | Tác giả Git | Commit message nguyên văn |
| --- | --- | --- | --- |
| 15/10 | [d83e102](https://github.com/GinNgo/hotel-saas-v2/commit/d83e102) | Tuan An | feat(public-booking): upgrade multi-property search with Go2Joy rental modes, tourist landmarks, and tenant chain filtering |
| 15/10 | [9ee7b93](https://github.com/GinNgo/hotel-saas-v2/commit/9ee7b93) | Tuan An | feat(booking): add vietnamese landmarks catalog, auto proximity matching, smart radius fallback and ai smart search chips |
| 15/10 | [bb67550](https://github.com/GinNgo/hotel-saas-v2/commit/bb67550) | Tuan An | feat(portal): complete b2c guest booking portal with guest layout, brand storefront, destination explore, property detail, and deals |
| 15/10 | [8786b12](https://github.com/GinNgo/hotel-saas-v2/commit/8786b12) | Tuan An | feat(loyalty): implement guest loyalty membership, point ledger, invoice printing, and points redemption |
| 15/10 | [ec98505](https://github.com/GinNgo/hotel-saas-v2/commit/ec98505) | Tuan An | feat(loyalty): implement automated loyalty ledger service and booking-hold points slider |
| 17/10 | [f711156](https://github.com/GinNgo/hotel-saas-v2/commit/f711156) | Tan | feat(Tran Trong Tan): implement receptionist operations and cashier reporting |
| 17/10 | [e8fbb33](https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb33) | Tan | fix(tan-ops): address housekeeping polling and payment safety issues |
| 18/10 | [96d9add](https://github.com/GinNgo/hotel-saas-v2/commit/96d9add) | nguyencd | feat(reservations): implement front-desk walk-in booking form, live quote, and room timeline grid |
| 19/10 | [c062cbe](https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe) | Tuan An | feat(integration): publish local booking and admin work with safe auth gates |
| 19/10 | [5e40505](https://github.com/GinNgo/hotel-saas-v2/commit/5e40505) | Tuan An | merge(tan-ops): integrate payment safety and housekeeping fixes |
| 19/10 | [77fbc67](https://github.com/GinNgo/hotel-saas-v2/commit/77fbc67) | Tuan An | fix(ci): install locked peer dependencies required by Vitest |
| 19/10 | [8618846](https://github.com/GinNgo/hotel-saas-v2/commit/8618846) | Tuan An | docs(reports): finalize week 2 evidence and AI disclosure |
| 19/10 | [003a016](https://github.com/GinNgo/hotel-saas-v2/commit/003a016) | AnNgo | Merge pull request #7 from GinNgo/develop |

Tác giả lấy từ metadata Git, không suy ra model AI hay người gõ từng dòng chỉ từ author name. Commit tích hợp có thể chứa phần đóng góp đã xác nhận của nhiều người. Tên “complete” trong commit là nguyên văn lịch sử, không thay thế các giới hạn nghiệm thu của báo cáo này.

## PHẦN IV. KHAI BÁO SỬ DỤNG TRÍ TUỆ NHÂN TẠO (AI DISCLOSURE)

### 1. Công cụ, phạm vi và nguyên tắc khai báo

Nhóm sử dụng AI hỗ trợ phân tích yêu cầu, đề xuất code/test, đọc diff và log CI, rà soát lỗi và soạn tài liệu. Công cụ được xác nhận trong phiên này là **OpenAI Codex**. Không suy đoán model/version từ tuần 01; thiếu nhật ký thì ghi rõ không lưu chính xác phiên bản.

Prompt bên dưới là **bản chuẩn hóa chính tả/rút gọn từ yêu cầu đã trao đổi**, không phải log nguyên văn. Nếu quy định yêu cầu nguyên văn, thành viên cần đối chiếu nhật ký gốc. Đóng góp theo commit không chứng minh người đó tự gõ mọi dòng hay dùng một model cụ thể.

Phần “Bạn đã sửa/hoàn thiện” phân biệt quyết định/phạm vi do người dùng xác nhận với việc sửa source/test có Codex hỗ trợ; không biến việc AI thực hiện thành khai báo sinh viên tự viết tay. Không tự điền công cụ/model hoặc prompt riêng của Nguyên/Tân khi thiếu nhật ký.

### 2. Từng prompt tương ứng với form

Mỗi mục có đủ năm trường: Công cụ; Model; Prompt; Nội dung AI tạo ra; Phần bạn đã sửa/hoàn thiện. Nếu form chỉ có một mục mỗi công cụ, gộp #01–#08 theo từng trường Codex, không khai thêm công cụ không sử dụng.
#### #01 — Home đặt phòng nhiều cơ sở và header cổng khách

**Công cụ AI**

```text
OpenAI Codex
```

**Phiên bản / model**

```text
Không lưu chính xác phiên bản model của phiên Codex; không suy đoán từ báo cáo tuần trước.
```

**Prompt đã dùng — bản chuẩn hóa**

```text
Phân tích lại header và Home đặt phòng vì hệ thống có nhiều khách sạn, không phải website của một khách sạn. Tham khảo cách tổ chức trang đặt phòng, kiểm tra cấu hình có thể tái sử dụng và lập đặc tả theo Spec Kit. Ưu tiên khách đặt phòng và form dùng chung trước, sau đó mới áp dụng cho PMS.
```

**Nội dung AI tạo ra**

```text
Hỗ trợ đọc source, phân tích cấu trúc marketplace nhiều cơ sở, phân biệt thương hiệu với từng khách sạn và đề xuất luồng khám phá theo điểm đến/loại hình/lịch thuê. Hỗ trợ tổ chức guest layout và tài liệu đặc tả/kế hoạch. Không có bằng chứng bàn giao file Canva trong đợt này; không khai việc yêu cầu tham khảo/crawl là đã hoàn thành nếu thiếu evidence.

Minh chứng:
https://github.com/GinNgo/hotel-saas-v2/commit/d83e102
https://github.com/GinNgo/hotel-saas-v2/commit/bb67550
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/frontend/src/app/layouts/guest-layout/guest-layout.ts
```

**Phần bạn đã sửa / hoàn thiện**

```text
Tôi chốt hướng Home là nơi tìm nhiều cơ sở và ưu tiên “Khách đặt phòng + form chung trước”. Tôi yêu cầu tiếp tục rà soát các luồng còn sơ sài thay vì chỉ thay giao diện. Phần phân tích, sửa source và test có Codex hỗ trợ; không khai toàn bộ là mã tôi tự viết tay hoặc đã có bản thiết kế Canva hoàn chỉnh.
```

#### #02 — Design system, input và form tái sử dụng

**Công cụ AI**

```text
OpenAI Codex
```

**Phiên bản / model**

```text
Không lưu chính xác phiên bản model của phiên Codex.
```

**Prompt đã dùng — bản chuẩn hóa**

```text
Đóng vai senior full-stack, phân tích sâu UI/UX của các giao diện và form input hiện tại. Kiểm tra những control có thể dùng chung, thiết kế các trạng thái còn thiếu, dùng Spec Kit lập plan và đánh giá trước khi triển khai. Ưu tiên luồng khách đặt phòng và form chung.
```

**Nội dung AI tạo ra**

```text
Hỗ trợ kiểm kê shared components, viết spec/plan/tasks và đề xuất field contract. Tái sử dụng SearchableSelect, bổ sung FormField và phần điều khiển form để thống nhất label/error/disabled; hỗ trợ test control và các form pilot. Không chứng nhận toàn bộ PMS đã chuyển sang design system mới hoặc toàn bộ WCAG đã đạt.

Minh chứng:
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/docs/design/experience-foundation/spec.md
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/docs/design/experience-foundation/plan.md
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/docs/design/experience-foundation/tasks.md
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/frontend/src/app/shared/components/form-field/form-field.component.ts
```

**Phần bạn đã sửa / hoàn thiện**

```text
Tôi lựa chọn thứ tự làm cổng khách trước, PMS sau và yêu cầu phân tích rồi mới thực hiện. Việc sửa component/test do Codex hỗ trợ theo phạm vi này. Tôi chưa khai thêm các chỉnh sửa tay riêng hoặc kết quả user test khi chưa đối chiếu được evidence; tài liệu kế hoạch không được xem là mọi task đã xong.
```

#### #03 — Search, Detail, Profile và lỗi nội dung giao diện

**Công cụ AI**

```text
OpenAI Codex
```

**Phiên bản / model**

```text
Không lưu chính xác phiên bản model của phiên Codex.
```

**Prompt đã dùng — bản chuẩn hóa**

```text
Giao diện Home còn đơn sơ, tính năng ít và một số thao tác chưa tốt. Hãy rà soát tìm kiếm, mở/đóng thành phần, Home, Detail và Profile; xác định còn thiếu gì rồi thực hiện lần lượt. Không dùng dữ liệu tài khoản mẫu để giả làm tính năng đã hoạt động.
```

**Nội dung AI tạo ra**

```text
Hỗ trợ xử lý state/URL tìm kiếm, modal phòng và gallery; kiểm tra Profile theo trạng thái đăng nhập. Khi tích hợp cuối, sửa tile Homestay lọc sai Guesthouse và dùng native category button có accessible name; test render component con thật thay vì chỉ kiểm trang cha đã bỏ child. Profile đọc identity thật từ session và thông báo các tính năng chưa nối.

Những voucher/chính sách/tiện nghi tĩnh, link quay lại mất một phần filter và các luồng backend chưa hoàn chỉnh vẫn được ghi hạn chế, không tuyên bố đã sửa hết.

Minh chứng:
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/frontend/src/app/features/public-booking/booking-content.spec.ts
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/frontend/src/app/features/public-booking/member/guest-profile.page.ts
https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe
```

**Phần bạn đã sửa / hoàn thiện**

```text
Tôi phản hồi giao diện và chức năng tìm kiếm/chuyển trang còn thiếu, yêu cầu xử lý tiếp theo từng bước. Codex hỗ trợ sửa source và kiểm thử; tôi không tự nhận đã chỉnh tay toàn bộ các lỗi này. Không khai lịch sử đặt phòng/điểm thưởng đã hoạt động chỉ vì giao diện có tab tương ứng.
```

#### #04 — Đề xuất API tài khoản khách

**Công cụ AI**

```text
OpenAI Codex
```

**Phiên bản / model**

```text
Không lưu chính xác phiên bản model của phiên Codex.
```

**Prompt đã dùng — bản chuẩn hóa**

```text
Thiết kế thêm API tài khoản khách để hỗ trợ hồ sơ và lịch sử đặt phòng theo người đăng nhập; xác định quyền sở hữu dữ liệu, phân quyền và trạng thái lỗi trước khi triển khai.
```

**Nội dung AI tạo ra**

```text
Hỗ trợ đề xuất contract guest account, phân tách identity đăng nhập với dữ liệu khách theo tenant/property, nhận diện các câu hỏi về ownership và kiểm thử account A/B, session switch, 401/403/404. Đây là tài liệu thiết kế phạm vi tiếp theo; không khai toàn bộ API cập nhật hồ sơ/lịch sử đã được implement hay Profile đã nối end-to-end.

Minh chứng:
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/docs/design/booking-marketplace/guest-account-api.md
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/frontend/src/app/features/public-booking/member/guest-profile.page.ts
```

**Phần bạn đã sửa / hoàn thiện**

```text
Tôi xác nhận mở thêm phạm vi “Thiết kế thêm API tài khoản khách”. Tôi không xem việc đồng ý thiết kế là đã nghiệm thu API; phần triển khai ownership/schema còn phải được kiểm chứng theo contract. Chưa có khai báo chỉnh sửa tay backend của riêng tôi trong mục này.
```

#### #05 — Automation chức năng và phân biệt lỗi thật với fixture

**Công cụ AI**

```text
OpenAI Codex
```

**Phiên bản / model**

```text
Không lưu chính xác phiên bản model của phiên Codex.
```

**Prompt đã dùng — bản chuẩn hóa**

```text
Test automation các chức năng và báo cáo lỗi, đặc biệt những tính năng chưa hoạt động. Nêu rõ bước tái hiện, kết quả thực tế, giới hạn môi trường kiểm thử và phần nào chưa thể xác nhận.
```

**Nội dung AI tạo ra**

```text
Hỗ trợ chạy unit tests/build và thao tác browser bằng fixture local không proxy API/DB thật. Báo cáo các vấn đề voucher chưa nối, claim tiện nghi/chính sách thiếu dữ liệu, category filter/keyboard và mất context khi quay từ Detail. Tách API bị fixture chặn chủ động khỏi lỗi production.

Vòng audit ban đầu ghi 347 pass, 1 fail / 348. Sau sửa và merge, CI main là 360 tests frontend và 417 backend pass; không dùng kết quả mới để xóa finding lịch sử hoặc tuyên bố các luồng payment/auth thật đã được kiểm đầy đủ.

Minh chứng audit lịch sử:
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/docs/reports/FUNCTIONAL-AUTOMATION-2026-10-19.md
Minh chứng CI sau tích hợp:
https://github.com/GinNgo/hotel-saas-v2/actions/runs/39225620829
```

**Phần bạn đã sửa / hoàn thiện**

```text
Tôi yêu cầu kiểm thử và báo cáo chức năng chưa hoạt động, không chỉ báo build thành công. Test automation và phân tích log có Codex thực hiện hỗ trợ. Tôi chưa xác nhận đã tự chạy user test, đo SUS/coverage hoặc thanh toán sandbox end-to-end; không bổ sung số liệu đó vào báo cáo.
```

#### #06 — Hợp nhất nhánh, sửa CI và báo cáo tuần 02

**Công cụ AI**

```text
OpenAI Codex
```

**Phiên bản / model**

```text
Không lưu chính xác phiên bản model của phiên Codex.
```

**Prompt đã dùng — bản chuẩn hóa**

```text
Merge các nhánh của nhóm, đẩy thay đổi local lên develop trước rồi hợp nhất main. Nếu có lỗi thì sửa CI dựa trên mã sau merge. Dùng báo cáo tuần 01 làm tham khảo để viết tuần 02; tên giảng viên là HUỲNH XUÂN PHỤNG, không ghi chức danh.
```

**Nội dung AI tạo ra**

```text
Hỗ trợ đối chiếu ancestry/commit và chỉ nhận phần Tân còn thiếu, giữ PR #6 đã merge của Nguyên; không merge lặp nhánh lịch sử. Giải quyết conflict test connection/EmptyState theo consumer thực tế. Sửa CI để chạy script unit test có thật, chuyển cài dependency sang npm ci và đồng bộ EF Core Relational. Theo dõi develop/main CI, soạn báo cáo dựa source, commit và log.

Lỗi CI đã xử lý gồm khai báo RoomService trùng và clean install thiếu peer dependency cần cho Vitest. Không tắt test để làm xanh. PR #7 đã merge main tại 003a016; 417 backend và 360 frontend pass. Gitleaks còn lỗi được bỏ qua, không ghi toàn bộ bảo mật đã đạt.

Minh chứng:
https://github.com/GinNgo/hotel-saas-v2/pull/7
https://github.com/GinNgo/hotel-saas-v2/commit/c062cbe
https://github.com/GinNgo/hotel-saas-v2/commit/5e40505
https://github.com/GinNgo/hotel-saas-v2/commit/77fbc67
https://github.com/GinNgo/hotel-saas-v2/actions/runs/39225620829
```

**Phần bạn đã sửa / hoàn thiện**

```text
Tôi xác nhận đưa local lên develop trước khi main, yêu cầu giữ đóng góp các thành viên và sửa tên giảng viên. Codex hỗ trợ thao tác Git, sửa CI, chạy kiểm tra và soạn báo cáo; không nhận toàn bộ là thao tác tay của sinh viên. Công việc tích hợp 18–19/10 được ghi riêng, không đổi thành hoàn thành trong kỳ 11–17/10. Không yêu cầu deploy hoặc migration môi trường thật.
```

#### #07 — Tạm khóa social-login và bỏ credential VNPay ghi cứng

**Công cụ AI**

```text
OpenAI Codex
```

**Phiên bản / model**

```text
Không lưu chính xác phiên bản model của phiên Codex.
```

**Prompt / quyết định đã dùng — bản chuẩn hóa**

```text
Đồng ý tạm khóa social-login chưa xác minh Google/Facebook token và bỏ secret VNPay ghi cứng trước khi đẩy mã nguồn. Thiếu cấu hình phải từ chối an toàn, không dùng credential fallback.
```

**Nội dung AI tạo ra**

```text
Hỗ trợ chặn endpoint social-login trả 503/SOCIAL_LOGIN_DISABLED, không dispatch identity chưa xác minh; bỏ credential fallback của VnpayPaymentService và thêm hai safety tests không cần DB. Thiếu credential: không tạo URL thanh toán và không xác nhận callback hợp lệ.

Đây là khóa an toàn tạm thời, không phải OAuth hoàn chỉnh hoặc chứng minh VNPay sandbox đã hoạt động. Xóa source hiện tại không thu hồi secret cũ trong Git history; chủ sở hữu cần rotate nếu còn hiệu lực.

Minh chứng:
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/backend/src/HotelSaas.WebApi/Controllers/AuthController.cs
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/backend/src/HotelSaas.Infrastructure/Services/VnpayPaymentService.cs
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/backend/tests/HotelSaas.WebApi.Tests/UnconfiguredIntegrationSafetyTests.cs
```

**Phần bạn đã sửa / hoàn thiện**

```text
Tôi phê duyệt “Đồng ý khóa tạm và bỏ secret” sau khi được thông báo rủi ro. Codex hỗ trợ thực hiện source/test; tôi không khai đã tự triển khai xác minh token hoặc tự rotate credential. Không đưa giá trị secret vào nội dung nộp bài.
```

#### #08 — Kiểm tra 7 cảnh báo và làm lại báo cáo theo form

**Công cụ AI**

```text
OpenAI Codex
```

**Phiên bản / model**

```text
Không lưu chính xác phiên bản model của phiên Codex.
```

**Prompt đã dùng — bản chuẩn hóa**

```text
Xem cụ thể 7 cảnh báo dependency là gì. Báo cáo tuần 02 còn thiếu chi tiết so với tuần 01: bổ sung nghiệp vụ, thuật toán, mã nguồn/commit và kết quả kiểm chứng; tách khai báo AI thành từng prompt và từng ô theo form nộp bài; gộp nội dung và minh chứng vào một báo cáo theo bố cục tuần 01.
```

**Nội dung AI tạo ra**

```text
Hỗ trợ chạy npm audit đầy đủ và production-only, đối chiếu cây dependency. Kết quả: 7 package bị ảnh hưởng (5 high, 2 moderate) từ hai advisory gốc braces và postcss-selector-parser trong chuỗi Tailwind/PostCSS; production-only 0 mục. Không đồng nhất kết quả này với chứng nhận toàn ứng dụng an toàn.

Mở rộng báo cáo tuần 02 theo từng thành viên, bài toán/cơ chế/test/giới hạn, danh mục file và commit; cập nhật main merge và CI cuối. Tổng hợp kết quả audit và tám mục khai báo có năm trường để sao chép ngay trong báo cáo này. Không tự nâng Tailwind major, không tự bịa model AI hoặc phần sinh viên sửa tay.

Căn cứ dependency:
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/frontend/package.json
https://github.com/GinNgo/hotel-saas-v2/blob/003a016/frontend/package-lock.json
Advisory:
https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
https://github.com/advisories/GHSA-rj75-hqrm-r3gf
```

**Phần bạn đã sửa / hoàn thiện**

```text
Tôi phản hồi báo cáo trước còn sơ lược, cung cấp ảnh form và yêu cầu giải thích cảnh báo/tách từng prompt. Nội dung sửa báo cáo và phân tích dependency được Codex hỗ trợ trong phiên cập nhật này; tôi cần đọc lại và xác nhận phần khai báo cá nhân trước khi nộp. Không khai các dependency đã được sửa vì phiên này chỉ kiểm tra.
```

### 3. Thông tin Nguyên/Tân cần xác nhận

Không có đủ nhật ký AI riêng của hai thành viên trong ngữ cảnh hiện tại để điền thay năm trường. Trước khi nộp báo cáo nhóm, mỗi bạn bổ sung công cụ, model thật hoặc ghi không lưu, prompt đã dùng, đầu ra AI và chỉnh sửa do mình trực tiếp làm. Có thể đối chiếu các phần việc sau, nhưng không xem chúng là prompt AI gốc:

| Thành viên | Phần việc đối chiếu | Minh chứng code |
| --- | --- | --- |
| Nguyễn Khôi Nguyên | Walk-in/live quote/timeline, service và tests reservation | https://github.com/GinNgo/hotel-saas-v2/commit/96d9add |
| Trần Trọng Tân | Check-in/out, thu ngân/báo cáo ca, polling, retry, metadata regression | https://github.com/GinNgo/hotel-saas-v2/commit/f711156 và https://github.com/GinNgo/hotel-saas-v2/commit/e8fbb33 |

Nếu form chỉ nộp theo cá nhân, không đưa phần AI của người khác vào như thể chính mình đã dùng công cụ đó. Tên giảng viên dùng thống nhất **HUỲNH XUÂN PHỤNG**, không chức danh.

## PHẦN V. TÍCH HỢP, KIỂM THỬ VÀ CẢNH BÁO KỸ THUẬT

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

Minh chứng backend sau merge: https://github.com/GinNgo/hotel-saas-v2/actions/runs/39224402282 — job backend pass, **toàn run còn fail frontend** trước khi sửa cài peer dependencies. Minh chứng CI sau sửa: https://github.com/GinNgo/hotel-saas-v2/actions/runs/39224713549.

**Cuối đợt trên main:** PR #7 đã merge tại `003a016`. Cây file main/develop không khác nhau khi xác nhận, và `e8fbb33` là ancestor của main. Run https://github.com/GinNgo/hotel-saas-v2/actions/runs/39225620829 hoàn tất `success`: backend **366 Application + 1 Domain + 50 WebApi = 417**, frontend **360 tests**. Không cộng hai safety tests lần nữa. Đây không phải coverage phần trăm hoặc 777 kịch bản end-to-end.

Build frontend còn warning CommonJS `sweetalert2`. Audit lại ngày 19/10 xác nhận **7 package (5 high, 2 moderate), từ hai advisory gốc**: `braces` có thể cạn stack khi parse pattern lồng sâu; `postcss-selector-parser` có thể tiêu tốn CPU khi parse selector đặc biệt. `chokidar`, `micromatch`, `fast-glob`, `postcss-nested`, `tailwindcss` bị cảnh báo theo chuỗi phụ thuộc. Chúng xuất phát từ Tailwind 3 trong devDependencies; audit production-only trả 0 mục, không đồng nghĩa toàn ứng dụng không có rủi ro. Không chạy `npm audit fix --force` vì đề xuất major Tailwind 4 cần đánh giá tương thích.

Lint `--if-present` không chứng minh có linter cấu hình. Run main có annotation lỗi Gitleaks nhưng bước này `continue-on-error: true`, nên pipeline vẫn success; không báo secret scan đã đạt. Xóa secret khỏi source không thu hồi giá trị cũ trong lịch sử Git; credential còn hiệu lực phải được chủ sở hữu rotate riêng.

Không dùng lại số 347/348 của vòng audit trước làm kết quả nghiệm thu cho cây mã mới. Các test DB chỉ được chạy trong dịch vụ PostgreSQL test cô lập của CI; không chạy vào DB dev/prod/staging trên máy.


### 4. Chi tiết bảy cảnh báo dependency

| Package / phiên bản trong cây dependency | Mức độ npm | Nguyên nhân / ảnh hưởng | Trực tiếp hay gián tiếp |
| --- | --- | --- | --- |
| `braces@3.0.3` | High | Lỗi gốc: mẫu glob có dấu ngoặc lồng rất sâu có thể làm cạn call stack, gây từ chối dịch vụ khi parser xử lý đầu vào đó. Advisory áp dụng `<=3.0.3`. | Gián tiếp qua `chokidar@3.6.0` và `micromatch@4.0.8` |
| `chokidar@3.6.0` trong Tailwind | High | Bị đánh dấu do phụ thuộc `braces`; đây là thư viện theo dõi file, không phải một advisory gốc thứ ba. | Gián tiếp qua Tailwind |
| `micromatch@4.0.8` | High | Bị lan truyền từ `braces` trong xử lý glob/pattern. | Gián tiếp qua Tailwind / fast-glob |
| `fast-glob@3.3.3` | High | Bị lan truyền từ `micromatch → braces` khi duyệt/match đường dẫn. | Gián tiếp qua Tailwind |
| `tailwindcss@3.4.19` | High | Package khai báo trực tiếp, kéo các chuỗi bị ảnh hưởng của glob và PostCSS. Mức high là mức tổng hợp từ dependency, không tự chứng minh có lỗi khai thác trên browser. | Trực tiếp, nhưng thuộc `devDependencies` |
| `postcss-selector-parser@6.1.4` | Moderate | Lỗi gốc: phân tích selector phẳng có độ phức tạp bậc hai, có thể tiêu tốn CPU với đầu vào được tạo đặc biệt. Advisory áp dụng `<7.1.6`. | Gián tiếp qua Tailwind và postcss-nested |
| `postcss-nested@6.2.0` | Moderate | Bị lan truyền từ `postcss-selector-parser`; dùng trong biến đổi CSS lồng nhau. | Gián tiếp qua Tailwind |

Advisory gốc:

- Braces — stack-exhaustion DoS: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm — CVSS 7.5 theo output npm.
- PostCSS selector parser — CPU exhaustion: https://github.com/advisories/GHSA-rj75-hqrm-r3gf — CVSS 5.9 theo output npm.

Hai advisory gốc lan truyền qua chuỗi Tailwind 3/PostCSS; không phải bảy lỗi nghiệp vụ độc lập. Ngày 19/10, `npm --prefix frontend audit --json` trả exit 1 với 5 high/2 moderate; `npm --prefix frontend audit --omit=dev --json` trả exit 0 với 0 mục; `npm ls` xác nhận phiên bản trong bảng. Exit 1 do phát hiện vulnerability, không phải build thất bại. Chưa nâng cấp dependency trong đợt kiểm tra này.

Npm đề xuất Tailwind 4.3.3 (major upgrade) cho phần lớn chuỗi; không tự chạy `npm audit fix --force` hoặc ép parser major 7 vào consumer yêu cầu major 6. Cần đánh giá PostCSS/plugin/theme và giao diện trước/sau, rồi clean install/build/tests/audit lại. Production-only 0 không chứng nhận toàn ứng dụng an toàn.

## PHẦN VI. HẠN CHẾ VÀ KẾ HOẠCH TUẦN TIẾP THEO

1. Các claim về Smart Lock, hoàn tiền, voucher, tiện nghi và giá marketing còn cần ràng buộc dữ liệu/capability thật theo từng cơ sở. Không công bố toàn bộ tính năng đã sẵn sàng cho khách sử dụng.
2. Hoàn thiện hợp đồng API hồ sơ khách và lịch sử theo subject đăng nhập; giao diện hiện có phần chưa nối. Không dùng hóa đơn/điểm mẫu thay dữ liệu thật.
3. Social login tạm khóa cho tới khi xác minh chữ ký, issuer/audience/expiry và quy tắc liên kết tài khoản được kiểm chứng. Có cấu hình dự án cũ không thay thế bước xác minh token.
4. VNPay cần cấu hình merchant/secret riêng và kiểm thử sandbox hoàn chỉnh. Unit test chữ ký hoặc callback không chứng minh thanh toán hay hoàn tiền thực đã thành công.
5. Tiếp tục regression ngữ cảnh tìm kiếm khi quay lại từ Detail; kiểm tra keyboard, mobile, zoom và nội dung component con sau thay đổi UI.
6. Giữ các guard tenant/property, authorization, idempotency và chống đặt trùng trong mọi vòng tích hợp; không chạy migration/deploy thật trong đợt nộp mã này.
7. Xử lý dependency audit theo đánh giá tương thích; duy trì test frontend thực sự được chạy trên clean install, không dựa node_modules cũ của máy thành viên.

### Ma trận ưu tiên tiếp theo

| Ưu tiên | Việc còn lại | Tiêu chí nghiệm thu đề xuất |
| --- | --- | --- |
| P1 | Voucher/chính sách/tiện nghi | Không hiện claim thiếu dữ liệu/capability cơ sở; giảm giá do server tính lại |
| P1 | OAuth | Từ chối token sai chữ ký/issuer/audience/hết hạn; không cấp JWT từ email client tự khai |
| P1 | Gitleaks và credential cũ | Xác định lỗi quét, xử lý phát hiện thực; chủ sở hữu xác nhận rotate credential còn hiệu lực |
| P2 | API tài khoản khách | Account A không đọc/sửa dữ liệu B; đủ 401/403/404, validation và session-switch tests |
| P2 | Dependency | Audit lại, clean install/build/tests pass, so sánh UI trước/sau; không đổi major thiếu kiểm chứng |
| P2 | Search context | Keyword, loại cơ sở, sort và lịch giữ nguyên khi từ Detail trở lại; có round-trip test |
| P2 | Booking/payment sandbox | Môi trường test cô lập được duyệt; kiểm replay/expiry/callback, không tiền hoặc DB thật |
| P3 | Accessibility | Keyboard, mobile, zoom 200%, focus/screen reader; lưu evidence thay vì tự chấm điểm |

## CAM KẾT TRUNG THỰC

Không báo cáo tính năng mock hoặc chưa tích hợp là hoạt động thực tế; không ghi test pass khi chưa có kết quả; không dùng test source hay báo cáo thành viên thay log chạy. Không công bố secret, token hoặc thông tin khách hàng. Không tự tạo số coverage, SUS, hiệu năng hoặc kết quả user test. Thành viên chịu trách nhiệm đọc và xác nhận khai báo cá nhân trước khi nộp.
