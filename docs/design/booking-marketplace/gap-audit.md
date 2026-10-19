# Audit Home → Detail → Hold → Profile

Ngày 2026-10-18. Evidence: source hiện tại, SRS US-4.5 và regression tests. Không chạy backend/DB hoặc giao dịch; không chấm điểm UX/SUS, coverage hay tuyên bố integration pass. Đây không phải visual audit đầy đủ trên dữ liệu thật.

## Findings cần sửa trước phát hành

### P1 — Hold báo luồng thành công ngay cả khi request lỗi

frontend/src/app/features/public-booking/booking-hold.page.ts:390–440: createHold error vẫn navigate tới TOKEN-DEMO-9981; nhánh thiếu tham số cũng điều hướng bằng timer. Lựa chọn Daily gửi enum 0 trong khi Domain quy định Daily=3; startAtUtc/endAtUtc lấy hiện tại +24h, numberOfGuests=2, không theo lịch/giờ/khách đã chọn. Detail gửi hours nhưng Home gửi durationHours; Hold chưa chuyển hai dữ liệu này thành thời gian thuê đúng.

Tác động: người dùng tưởng đặt thành công, hoặc đặt sai thời điểm/số khách. Sửa: thống nhất adapter ngữ cảnh booking, gọi quote/hold theo contract hiện có, lỗi giữ tại form với retry; không mã booking giả. Test: cả ba mode, lỗi API, retry, không token, nhiều khách, qua ngày; kiểm tra payload và trạng thái, không chỉ navigate được. Rủi ro regression: tiền, tồn kho và trạng thái; không sửa vội cùng bản UI.

### P1 — Tìm kiếm chưa phải tìm phòng trống theo lịch/khách

frontend/src/app/features/public-booking/booking.page.ts:1020 và core/services/public-booking.service.ts:35: request discovery không mang check-in/out, số khách/phòng. backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs:24 cũng chưa nhận các điều kiện đó. SRS US-4.5 đòi kết quả có phòng phù hợp ngày/khách. Hiển thị form không đồng nghĩa lọc availability.

Sửa: phân biệt discovery với availability; tái sử dụng API availability/quote hiện có nếu đủ, tránh một request mỗi card không giới hạn. Nếu cần contract tìm kiếm tổng hợp, phải duyệt API/hiệu năng trước. Test: cùng nơi khác lịch/khách, hết phòng, sức chứa, mode không hỗ trợ, dữ liệu trả về trễ. Không tự thêm schema hoặc chính sách phòng nhiều khách.

### P1 — Detail tính giá bằng tỷ lệ tự đặt, chưa dùng quote engine

frontend/src/app/features/public-booking/property-detail.page.ts:646: basePrice fallback 300000; Hourly=40% và phụ thu 15%, Overnight=70%; Daily không nhân số đêm. onDateChange/onTimeChange rỗng. Banner giá chính xác thời gian thực không khớp thực thi. Chi tiết không đọc search query để khôi phục mode/lịch/khách.

Sửa: báo giá từ API contract đã có, phân biệt loading/stale/error, disable CTA khi quote chưa khớp lựa chọn; giờ lấy theo cơ sở. Test: thay số đêm, đổi mode, sửa giờ, response đảo thứ tự, hết hiệu lực quote. Rủi ro: giá/giữ phòng phải đồng bộ, không tự quyết thuế/phí.

### P1 — Chính sách và review Detail là dữ liệu dựng phía client

frontend/src/app/core/services/public-booking.service.ts:282 và :307: getPropertyPolicies tự gán phí và chính sách hủy; getPropertyReviews dựng người đánh giá/nội dung cho property lấy được. property-detail.page.ts:575 cũng tự bổ sung ảnh stock vào gallery khách sạn.

Sửa: chỉ hiển thị dữ liệu được công bố/đã xác thực, thiếu thì thông báo chưa cung cấp/chưa có đánh giá; ảnh minh họa phải được phân biệt hoặc dùng placeholder trung tính. Không biến fallback thành chính sách hợp đồng. Test: không review/không policy/không ảnh; không render lời hứa giả. Backend quản trị chính sách nếu chưa có cần quyết định riêng, không hardcode thay.

### P1 — Profile chưa là hồ sơ tài khoản thực

frontend/src/app/features/public-booking/member/guest-profile.page.ts:1689, :1773, :1895, :2035: tên/liên hệ hardcode; ngOnInit seedDemoGuestPortalData; đăng ký thành viên chỉ sửa signals và tạo mã ngẫu nhiên; hóa đơn/điểm tải xuống được nhưng lấy từ mẫu. Settings chỉ sửa object trong bộ nhớ, chưa có luồng lưu xác nhận từ server. Route profile chưa có customer guard.

Tác động: bất kỳ người xem có thể nhầm hồ sơ mẫu thành dữ liệu riêng, refresh mất thay đổi/đăng ký. Chưa có bằng chứng rò rỉ dữ liệu thật trong nhánh này, vì dữ liệu là mẫu; đây không phải kết luận API authorization an toàn.

Sửa: lấy identity từ AuthService, chặn nội dung riêng khi chưa đăng nhập, returnUrl trở về Profile, API phải xác minh chủ thể; nối lịch sử/folio/điểm theo contract có thật. Không tự xây quy tắc cộng điểm/ưu đãi. Test: guest/Customer/staff, refresh, user A→logout→user B, 401/403, lỗi lưu, xuất dữ liệu đúng chủ tài khoản. Test Profile hiện kiểm tra demo; pass không chứng minh tích hợp.

### P1 — Home chọn nhầm cơ sở khi tên trùng

frontend/src/app/features/public-booking/booking.page.ts:956: callback modal tìm property bằng name rồi dùng phần tử đầu. Tên không phải định danh duy nhất giữa các tenant. Sửa: lưu propertyId/slug đã chọn, không tìm theo tên. Test hai cơ sở khác tenant cùng tên, assert payload chọn đúng cơ sở. Đây là lỗi lựa chọn phía client, chưa là bằng chứng vượt tenant authorization phía server.

## P2 — Tương tác và khả năng khám phá

1. Dropdown tìm kiếm và menu header thiếu dismiss ngoài/Escape/focus-out. Đã sửa tối thiểu trong vòng này; không blur để đóng trước click chọn gợi ý.
2. Autocomplete chưa có combobox/listbox semantics, ArrowUp/Down, active option, Enter chọn/tìm, trạng thái không có gợi ý. Gợi ý Home được seed tĩnh, chưa phải truy vấn danh mục live theo input. Cần throttle/cancel nếu nối API, không tự thêm dependency.
3. roomsCount tồn tại trong state nhưng không có UI đổi số phòng, initialFilter chưa restore nó. Nhãn Khách & Phòng hiện gây kỳ vọng quá khả năng. Cần chốt single-room booking hay booking nhiều phòng trước thiết kế bộ chọn; trẻ em/tuổi là business scope chưa có contract.
4. Sau GPS rồi nhập địa điểm mới, onDestinationInput không xóa userCoords: payload vẫn giữ vị trí cũ. Cần tách tìm quanh tôi với tìm địa danh và test chuyển hai chiều.
5. Home không có link cơ sở rõ tới /booking/properties/:slug; tiêu đề card chỉ là h3, CTA chủ yếu gallery/modal/giữ phòng. Cần tên/CTA Xem chỗ nghỉ có deep link và giữ search context; không làm mất truy cập trực tiếp hạng phòng nếu giữ được contract.
6. URL/back/refresh chưa khôi phục toàn bộ filter; ngOnInit Home chỉ seed và load. Cần query params canonical, không lộ token hoặc PII trong URL. Giá và số kết quả phải phân biệt toàn bộ dataset với trang đang tải.
7. Request Home và Detail subscribe độc lập, chưa hủy hoặc chặn response cũ khi tìm/đổi slug nhanh. Detail chưa reset room/policy/review/selection theo slug; response cũ có thể ghi đè ngữ cảnh mới. Cần switchMap/takeUntilDestroyed hoặc request generation guard và test response đảo thứ tự.
8. Detail gallery mở tab mới từ div click-only; thiếu bàn phím và modal gallery thống nhất; scrollToRooms dùng top=600 thay anchor thật. Tái sử dụng gallery hiện có, focus-return/Escape/backdrop rõ ràng.
9. Mobile thanh tìm kiếm dài; trợ lý AI nổi có thể che input. Cần thu gọn thông tin phụ, bộ chọn lịch/khách rõ ràng, nút lọc mở panel, chip điều kiện đã áp dụng, clear-all và lỗi cạnh field. Chưa khẳng định layout tối ưu vì chưa kiểm tra visual đầy đủ ở vòng này.
10. Thiếu trạng thái độc lập roomTypes/policies/reviews trên Detail; request con không có error handling đầy đủ. Không đồng nhất lỗi mạng với 404 hoặc chuyển Home ngay mọi lỗi.

## Nội dung nên có, theo thứ tự giá trị

- Home: tìm kiếm hoàn chỉnh; card cơ sở có thương hiệu phụ, giá/đơn vị trung thực, tình trạng theo lịch; bộ lọc/chips/sort; điểm đến và thương hiệu từ danh mục thực. Không thêm khối marketing chỉ để đầy trang.
- Detail: gallery thật; tổng quan/tiện nghi/vị trí; lịch/khách và bảng phòng; quote tách khoản; chính sách công bố; review xác thực; CTA sticky mobile không che nội dung.
- Profile: trạng thái chưa đăng nhập; thông tin cá nhân có lưu; đơn sắp tới/đã ở/đã hủy; chi tiết đơn và tra cứu; hóa đơn thực; logout. Ví điểm/hội viên chỉ xuất hiện khi nguồn dữ liệu và quyền thực sự sẵn sàng.
- Wishlist, gần đây, bản đồ đồng bộ, comparison là backlog; không triển khai trước khi search/detail/hold đúng. Không bổ sung dependency bản đồ hoặc analytics khi chưa duyệt.

## Kế hoạch và acceptance gates

| Vòng | Công việc | Gate |
| --- | --- | --- |
| 1 | Dismiss dropdown/menu | Click trong không đóng sớm; ngoài/focus-out đóng; Escape giữ input; không tự search; test lifecycle |
| 2 | Search context, keyboard, validation, URL, request race, deep link, property identity | Home→Detail→Hold giữ nguyên lựa chọn; back/refresh khôi phục; response cũ không ghi đè; hai property trùng tên không nhầm |
| 3 | Availability/quote/hold xuyên stack | Không đặt/giá thành công giả; đúng thời gian/mode/khách; API lỗi có retry; kiểm thử cô lập không DB thật |
| 4 | Profile thực và quyền sở hữu | Login/returnUrl, không demo hóa đơn/điểm, lưu có phản hồi server, phân tách hai tài khoản |
| 5 | Visual Home/Detail/Profile desktop/mobile | Một hệ thống token/component, ảnh có nguồn, điều khiển ≥44px, không overflow, keyboard/focus; screenshot trên fixture rõ nhãn |

Chỉ vòng 1 được sửa trong lượt audit này. Các vòng sau cần giữ scope với Nguyên (catalog/creation) và Tân (payment/ops), dùng contract đã duyệt; API/schema/quy tắc nhiều phòng/hội viên mới phải được PO duyệt trước. Không commit, deploy hay migrate.

## Kiểm chứng vòng sửa tương tác

Trước sửa: chạy 9 test chọn lọc, 4 failed/5 passed; tái hiện ngoài click, focus-out, Escape và outside header không đóng. Sau sửa: 30/30 test đạt trên 4 file (guest-layout, booking-filter-bar, public-booking.page, guest-profile). Bao gồm test không đóng sớm trước chọn gợi ý và outside click không phát search. Profile suite vẫn là demo tests, không thể tính là production readiness.

`npm --prefix frontend run build`: exit 0, 20.197 giây; còn cảnh báo CommonJS sweetalert2 hiện có. Diff whitespace check giới hạn các file frontend liên quan đạt. Chưa browser-QA vòng này và chưa chạy backend integration vì không truy cập DB thật.

Lệnh test: `npm --prefix frontend test -- --watch=false --include='src/app/layouts/guest-layout/guest-layout.spec.ts' --include='src/app/features/public-booking/components/booking-filter-bar/booking-filter-bar.component.spec.ts' --include='src/app/features/public-booking/public-booking.page.spec.ts' --include='src/app/features/public-booking/member/guest-profile.page.spec.ts'`.
