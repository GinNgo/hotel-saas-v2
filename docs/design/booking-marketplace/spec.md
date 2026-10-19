# Home và header đặt phòng đa khách sạn

Ngày: 2026-10-18. Trạng thái: người dùng đã duyệt hướng thiết kế; vòng UI đầu đã triển khai. Xem implementation.md cho kết quả và giới hạn.

## Phương pháp và phạm vi

Áp dụng cấu trúc đặc tả Spec Kit: user stories, yêu cầu, acceptance scenarios, success criteria. Repo hiện không có `.specify/` hoặc `specs/`; đây là tài liệu tương thích về cấu trúc, không phải kết quả chạy pipeline Spec Kit. Không khởi tạo framework, tạo nhánh hoặc chạy script không có trong repo.

Chỉ thay bố cục guest header và Home; giữ API, schema, quyền, booking/quote/payment contract. Không sửa phần vận hành của Nguyên/Tân. Không lấy cấu hình bí mật, thông tin khách hay ảnh chưa rõ quyền từ dự án cũ.

## Vấn đề từ source hiện tại

- Header guest có đồng thời tìm phòng, điểm đến, thương hiệu, ưu đãi, hồ sơ và các hành động bên phải: cạnh tranh với mục tiêu tìm phòng, nhất là chiều rộng trung gian.
- Home đã có bộ lọc thương hiệu và danh sách cơ sở; cần làm rõ nền tảng → thương hiệu/chuỗi → cơ sở → hạng phòng, thay vì trình bày như một khách sạn duy nhất.
- Banner đang ghi giữ chỗ miễn phí 10 phút: không tiếp tục coi nội dung hardcode là chính sách chung nếu chưa đối chiếu contract thực tế.
- Card đang hiển thị điểm và số đánh giá; trường hợp không có đánh giá phải dùng trạng thái chưa có đánh giá, không trình bày điểm 0 như chất lượng đã đo.

## User stories và acceptance scenarios

### US1 — Tìm chỗ nghỉ trên toàn sàn (P1)

Khách chưa đăng nhập tìm theo điểm đến, lịch lưu trú, số khách và số phòng mà không phải chọn thương hiệu trước.

- Given mở `/booking`, when chưa đăng nhập, then vẫn xem và tìm cơ sở; không chuyển tới đăng nhập.
- Given không có tenant filter, when tìm kiếm, then UI không tự gắn thương hiệu khách sạn vào toàn sàn.
- Given chọn địa điểm, lịch và hình thức thuê, when xem kết quả, then hiển thị điều kiện tìm hiện hành; không tuyên bố còn phòng chỉ dựa trên ảnh hoặc giá khởi điểm.

### US2 — Phân biệt cơ sở và thương hiệu (P1)

- Given nhiều cơ sở cùng tên hoặc cùng chuỗi, then mỗi card có tên cơ sở là tiêu đề, địa chỉ là thông tin chính và thương hiệu là thông tin phụ; track bằng propertyId.
- Given chuyển sang thương hiệu/cơ sở qua route hiện có, then thể hiện ngữ cảnh và đường quay lại toàn sàn; không biến ngữ cảnh public thành tenant context quản trị.
- Given chưa có đánh giá hoặc ảnh, then hiển thị trạng thái trung thực và placeholder, không tạo số liệu hoặc ảnh thay mặt khách sạn.

### US3 — Header gọn trên desktop/mobile (P1)

- Header desktop: logo nền tảng, Khám phá, Tra cứu đặt phòng, tài khoản; đối tác/PMS ở vị trí phụ, không hai nút đăng nhập ngang cấp cạnh CTA tìm phòng.
- Điểm đến, thương hiệu và ưu đãi vẫn truy cập được qua menu Khám phá hoặc footer; không xóa route hiện có.
- Mobile: logo, tài khoản và nút menu có nhãn; menu hoạt động bằng bàn phím, có aria-expanded, đóng bằng Escape và trả focus về nút mở.
- Không ép đăng nhập để tra cứu hoặc tìm phòng; giữ nguyên hành vi bảo mật của route hiện tại.

## Yêu cầu chức năng

FR01: Home mặc định là marketplace. Trang thương hiệu và trang cơ sở dùng route hiện có.

FR02: Một khối tìm kiếm chính: điểm đến → hình thức thuê và lịch tương ứng → khách/phòng → Tìm chỗ nghỉ. Tái sử dụng BookingFilterBar, không tạo một mô hình filter thứ hai.

FR03: Giữ Hourly/Overnight/Daily và cấu hình hình thức thuê từng cơ sở; không đổi đơn vị giá, mặc định nghiệp vụ hoặc quy tắc thời gian ngầm.

FR04: Phần đầu Home giải thích giá trị tìm nhiều chỗ nghỉ; tiếp theo điểm đến; kết quả có bộ lọc đang chọn, sắp xếp và card cơ sở. Không thêm carousel tự chạy hoặc khối quảng cáo lấn tìm kiếm.

FR05: Card có ảnh, tên cơ sở, địa chỉ, thương hiệu phụ, đánh giá khi có dữ liệu, giá từ kèm đơn vị theo mode và CTA xem phòng. Giá báo cuối cùng vẫn do quote contract quyết định; không tự diễn giải đã gồm thuế/phí.

FR06: Loading, lỗi có thử lại, không kết quả có xóa bộ lọc, ảnh lỗi, tên dài và số lượng cơ sở lớn phải có trạng thái rõ ràng.

## Hướng visual đề xuất

Giữ nhận diện indigo/slate hiện có trong vòng này, nền sáng, typography hiện có hỗ trợ tiếng Việt, ảnh cơ sở làm nội dung chính; giảm badge/gradient trang trí. UI/UX Pro Max được truy vấn với `hotel booking marketplace multi property trustworthy`; các gợi ý font luxury/morphing không phù hợp mục tiêu thao tác nhanh nên không áp dụng máy móc. Không thêm font/dependency ngoài.

Khoảng cách theo thang 4/8, một CTA chính trong khối tìm kiếm, target ít nhất 44px, focus rõ, label thật thay placeholder-only, contrast văn bản thường ít nhất 4.5:1. Kiểm tra tại 375, 768, 1024 và 1440px; không tràn ngang. Tôn trọng reduced-motion.

## Inventory tái sử dụng

| Nguồn hiện có | Cách tái sử dụng | Giới hạn |
| --- | --- | --- |
| `frontend/src/app/layouts/guest-layout/guest-layout.ts` | Shell/logo nền tảng, route links, phân biệt guest/PMS | Không đưa thương hiệu tenant vào global header |
| `frontend/src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.ts` | Bộ lọc và sự kiện tìm kiếm | Phải kiểm chứng mapping service/API trước tuyên bố lọc server đầy đủ |
| `frontend/src/app/core/models/public-booking.model.ts` | RentalType, PublicBookingSearchFilter, PublicPropertyDto, suggestion DTO | Có model không đồng nghĩa backend hỗ trợ mọi trường |
| `frontend/src/app/features/public-booking/booking.page.ts` | Facet thương hiệu, card cơ sở, gallery, dữ liệu theo mode | Facet từ dữ liệu đã tải không phải thống kê toàn sàn |
| PopularDestinations, loading, empty-state, property detail/gallery hiện có | Điểm đến và trạng thái nội dung | Không tạo thư viện component song song |
| `backend/src/HotelSaas.Domain/Entities/Property.cs` | Cấu hình check-in/out và dữ liệu cơ sở | Chỉ dùng trường đã được public API cho phép; không gọi API quản trị |
| `backend/src/HotelSaas.Domain/Entities/Tenant.cs` | Có cấu hình logo/liên hệ/thời gian để đánh giá reuse | Chưa kết luận có thể đưa trực tiếp lên public DTO; không mở rộng API trong vòng UI |

Không cần CMS mới cho vòng đầu. Banner/menu/khối homepage có thể là cấu hình trình bày typed cục bộ nếu thật sự dùng nhiều nơi; cấu hình chỉnh sửa từ CMS, white-label/domain riêng, hỗ trợ nhiều tiền tệ/ngôn ngữ là scope riêng cần duyệt. Cấu hình OAuth/VNPay dự án cũ không phải cấu hình header/Home và không được sao chép vào client.

## Nghiên cứu tham khảo

HTTP read-only ngày 2026-10-18; chỉ kiểm tra HTML trả về, không đăng nhập, không vượt chặn, không sao chép hình/giá/đánh giá. Không xem đây là visual audit hoặc user test.

| URL | Evidence thực tế | Giới hạn |
| --- | --- | --- |
| https://www.booking.com/ | HTTP 202, không có title hoặc các từ khóa tìm kiếm đã kiểm tra | Không đủ dữ liệu để kết luận layout |
| https://www.agoda.com/ | HTTP 200, HTML có destination/check-in/check-out/rooms/guests | Từ khóa có thể nằm trong script; chưa xác minh điều khiển hiển thị |
| https://www.traveloka.com/vi-vn/ | HTTP 200, title Traveloka Việt Nam; HTML có khách sạn, đăng nhập, destination, check-in, rooms, guests | Chưa xem layout desktop/mobile; không suy luận thứ tự UI từ từ khóa |

Đề xuất ưu tiên điểm đến/lịch/khách là quyết định thiết kế dựa trên nhu cầu và model dự án, không phải kết quả chứng minh chuyển đổi của các website trên.

## Kế hoạch tuần tự và kiểm chứng

1. Conflict gate: `git ls-files -u` hiện không trả entry; tìm marker đầu dòng trong `frontend/src/**/*.ts` không có kết quả. Không thay hoặc stage code để giải quyết conflict vốn đã hết. Repo còn nhiều thay đổi có sẵn, phải giữ nguyên.
2. Xác nhận marketplace là Home mặc định và phạm vi guest header/Home; sau đó mới sửa giao diện.
3. Viết test navigation, public access, menu bàn phím và card thiếu dữ liệu theo test runner hiện có; triển khai tối thiểu bằng component/service hiện tại.
4. Chạy test chọn lọc và `npm --prefix frontend run build`. Kiểm tra desktop/mobile một lượt; sửa theo batch rồi xác nhận tối đa một lượt. Không gọi DB thật hoặc khởi chạy backend chỉ để xem UI.
5. Definition of Done: các scenario đạt, không mất route/query hiện hành, không tràn ngang, không thêm dependency/API/schema, báo đúng kết quả kiểm thử và limitation.

## Quyết định còn mở

- Xác nhận Home chung nhiều khách sạn là hướng mặc định, không phải website riêng một chuỗi.
- Canva chưa có link/design ID và chưa có connector phù hợp được xác nhận; không tuyên bố đã chỉnh Canva. Nếu cần deliverable Canva, phải có link và khả năng truy cập; không chặn nghiên cứu/source spec vì thiếu Canva.
- Chưa có screenshot/browser QA hoặc test chạy cho thiết kế này; chưa sửa production UI. Không tuyên bố hoàn tất triển khai.
