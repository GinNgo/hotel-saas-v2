# Findings theo mức ưu tiên

Evidence: source ngày 18/10/2026; đường dẫn dưới đây tương đối với repository. Không suy ra browser behavior đã được kiểm chứng khi chỉ đọc source.

| ID | Mức | Evidence và vấn đề | Tác động / hướng xử lý | Kiểm chứng cần có |
| --- | --- | --- | --- | --- |
| UX01 | P1 | `features/public-booking/booking.page.ts`, adapter `loadPublicProperties`: fallback giá 350000, tenant-hq-01, địa chỉ/ảnh/stock/tiện nghi; `shared/components/room-detail-modal` có ảnh khách sạn thay thế | Khách hiểu nhầm dữ liệu mẫu là giá/tồn/địa chỉ thật. Chuẩn hóa nullable DTO và trạng thái chưa công bố trước khi trang trí card | Fixture thiếu từng trường: không hiện claim/ảnh cơ sở khác, không mở hold khi thiếu định danh; quote vẫn chỉ từ server |
| UX02 | P1 | `core/services/public-booking.service.ts`, `getTenantBrands`: điểm 4.8, reviewCount fallback 12 và mô tả uy tín suy diễn | Gây social proof không có evidence; fallback tenant có thể gộp cơ sở không cùng chuỗi | Thiếu brand ID → không dựng chuỗi; chưa đánh giá → không hiện điểm/count giả |
| UX03 | P1 | `shared/components/searchable-select`: trigger chỉ có aria-expanded, không có contract label/listbox/options; span role=button nằm trong button, chỉ xử lý Enter cho clear | Shared control nhân rộng khó dùng bàn phím/AT. Không thay toàn bộ native select bằng control này trước khi harden | Browser Tab/Shift+Tab, Arrow, Enter, Escape; clear là button độc lập; ARIA IDs duy nhất |
| UX04 | P1 | Cùng component: `computed()` đọc `@Input() items` thường trong selectedItem/filteredItems | Khi options tải bất đồng bộ/đổi tỉnh, input không phải dependency reactive; computed có thể giữ danh sách/nhãn cũ nếu signal phụ thuộc không đổi | Regression thay options sau render mà không đổi query/value; options/selected label phải cập nhật. Đây là rủi ro source, chưa tái hiện bằng test vòng này |
| UX05 | P1 | `features/properties/properties.page.ts`, form name/code/type/slug: label đứng cạnh input, thiếu for/id ở mẫu đã đọc | Label nhìn thấy không đồng nghĩa programmatic label. Screen reader và click label có thể không tới control | DOM association test từng field; không dựa vào placeholder hoặc dấu * đơn độc |
| UX06 | P2 | `features/auth/login/login.page.ts`: label for=password nhưng p-password dùng id ở host, chưa thấy inputId; lỗi field chưa gắn describedby/invalid | Cần xác minh DOM PrimeNG trước kết luận runtime; contract phải áp tới input thật bên trong | Kiểm tra accessible name/description thực tế, toggle password có nhãn, error được đọc |
| UX07 | P2 | Hold dùng native inputs/FormsModule, Login dùng reactive + PrimeNG, Partner dùng reactive + custom CVA; lớp border/radius/text lặp lại | Không sai chỉ vì trộn form APIs; vấn đề là không có contract chung về state, label và kích thước | Dùng field shell + native styling directive, giữ form logic tại feature; không ép rewrite toàn bộ sang một form engine |
| UX08 | P2 | Hold có lỗi toàn form và required, chưa có error association từng field/focus lỗi đầu tiên | Người dùng phải tự tìm lỗi, nhất là mobile; retry có nguy cơ nhập lại | Invalid submit → giữ input, focus lỗi đầu, error dưới trường; server error giữ nguyên nội dung và idempotency |
| UX09 | P2 | `shared/components/photo-gallery-modal` có Escape/Arrow; `room-detail-modal` không thấy focus trap/restore hoặc Escape trong source | aria-modal không tự quản lý focus. Backdrop-only là chưa đủ | Mở dialog → focus bên trong; Tab không thoát; Escape/close → trả focus trigger; không đăng ký handler khi đóng |
| UX10 | P2 | `styles.css` và `tailwind.config.js` khai báo trùng palette/shadow; feature dùng indigo/emerald trực tiếp | Token có nhưng chưa là authority duy nhất; sửa theme dễ lệch shell/input/CTA | Primitive → semantic → component aliases; giữ palette incumbent, không đổi brand toàn hệ thống |
| UX11 | P2 | Home query restore có lịch/loại/điểm đến/GPS nhưng sidebar sort/price dùng signals riêng | Reload/Back không khôi phục đầy đủ ý định tìm; current results là discovery, không phải availability toàn sàn | URL round-trip/Back test đầy đủ facet; phân biệt lọc tập tải về với server pagination |
| UX12 | P2 | Profile đã bỏ demo nhưng lịch sử/edit/loyalty chưa kết nối API | Thêm tab không làm tính năng hoạt động. Không dùng local save để che thiếu backend | Capability states; guest-account-api.md làm dependency; ownership/cross-tenant tests trước khi mở history |

## Inventory tái sử dụng

- Giữ PageHeader, EmptyState, LoadingSpinner, Pagination, StatusBadge, BusinessDatePipe. Không tạo thư viện song song.
- SearchableSelect và GoogleMapPicker mới đang có trong worktree: cần xác nhận owner, đọc tests và harden có giới hạn; không triển khai component trùng.
- DateRangeFilter là control báo cáo có presets, PrimeNG datepicker; không dùng nguyên xi cho booking Hourly/Overnight/Daily vì khác semantics.
- PhotoGallery/RoomDetailModal giữ nội dung và API component hiện hữu khi sửa focus; Angular CDK đã có nên không thêm dialog library.
- PrimeNG và Angular Material/CDK đều có dependency. Không thêm UI kit thứ ba hoặc migrate framework để giải quyết form labels.

## Những gì chưa được kết luận

Chưa audit từng field mọi trang Reports/Payments/Rooms, chưa browser-QA màu/overflow/calendar/portal thật, chưa đo bundle/contrast/SUS. Không coi 51 tests của vòng trước là kiểm chứng thay đổi thiết kế mới. Các vấn đề payment/housekeeping đã giao Tân phải giữ owner, không nhập vào implementation backlog của vòng UI.
