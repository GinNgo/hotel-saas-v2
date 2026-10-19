# Home missing data — 2026-10-18

## Phạm vi đã triển khai (T008 một phần)

- Thẻ cơ sở không tự tạo tenant/brand, địa chỉ Đà Lạt, khu du lịch, ảnh Unsplash, giá 350.000đ hoặc khoảng cách 500m khi API thiếu dữ liệu.
- Giá theo mode giữ aliases đã công bố (`dailyPriceFrom`/`dailyStartingPrice`, tương tự hourly/overnight). Không tự thêm mode khi API không công bố support.
- Hạng phòng không tự tạo ID rt-1, giường Queen, diện tích, tiện nghi, stock, giá và phụ thu. Model cũ vẫn dùng 0 sentinel cho numeric required; UI card không hiển thị 0 thành miễn phí hoặc hết phòng. Chưa chuyển public DTO sang nullable toàn hệ thống.
- Thiếu ảnh/địa chỉ/metadata/giá có copy riêng; không mở gallery rỗng; không có hạng phòng thì dẫn tới chi tiết cơ sở. Nhãn CTA không khẳng định đã giữ phòng.
- Bỏ badge màu khan hiếm dựa trên stock tại card; thiếu giá/khoảng cách không được lọt qua budget/distance filter. Giá chưa công bố xếp sau giá thật khi sort.
- Brand service chỉ nhóm cơ sở có tenant ID và brand name thật; không tạo default-tenant, mô tả quảng cáo, rating 4.8 hoặc cộng 12 reviews. Chưa có aggregate rating contract nên không tổng hợp điểm chuỗi từ điểm cơ sở.

## Evidence

- Hai regression Home đã fail trước sửa: tenant-hq-01 và giá fallback 350000 thay vì giá công bố 950000.
- Regression brand đã tái hiện grouping giả (2 brands thay vì 1); đổi assertion sang await firstValueFrom để lỗi không bị tách thành unhandled RxJS error.
- `npm --prefix frontend test -- --watch=false --include=src/app/features/public-booking/public-booking.page.spec.ts --include=src/app/core/services/public-booking.service.spec.ts --include=src/app/features/public-booking/property-detail.page.spec.ts`: exit 0, 46/46 tests, 3 files.
- `npm --prefix frontend run build`: exit 0; warning CommonJS sweetalert2 có sẵn.
- Scoped git diff --check: exit 0, thông báo chuyển LF→CRLF cho tenant-brand.page.ts (không phải whitespace error).

## Chưa hoàn tất / ưu tiên kế tiếp

- Room-detail modal vẫn có fallback ảnh/giường/diện tích/hướng nhìn và nhãn availability chưa phù hợp discovery. Cần sửa kèm regression riêng trước khi coi T008 hoàn tất; không chứng nhận modal trung thực từ kết quả test card.
- Các section marketing Home còn testimonial/promotion/timer minh họa; chưa có evidence từ API, cần audit/hide ở lượt tiếp theo. Không coi chúng là user tests hoặc review thật.
- Chưa browser-QA desktop/mobile cho vòng này, chưa đo contrast hoặc kiểm accessibility toàn trang; T010 focus/Escape còn mở.
- Không API/backend/schema mới, không DB, payment, migration, commit, push hoặc deploy. Không file Canva.
