# Submission: P5-GUEST-UI-IMPLEMENT-01 (Round 1)

- **TaskId:** P5-GUEST-UI-IMPLEMENT-01
- **Round:** 1
- **SubmissionId:** sub-p5-guest-ui-implement-01-r1-20261011
- **ReviewedSubmissionId:** sub-p5-guest-ux-redesign-01-r3-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-11T09:54:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **Chỉ can thiệp Frontend (Frontend Only):** Triển khai hoàn toàn trong tầng giao diện khách (`frontend/src/app/features/public-booking/`). Tuyệt đối không chạm mã nguồn C# backend.
2. **0 sửa đổi Backend & Fuzzy Logic:** Đề xuất Fuzzy Search Backend vẫn được giữ nguyên dạng tài liệu tại `guest-ux-redesign-proposal.md` chờ PO/Codex duyệt riêng; không tự ý tạo matcher hay can thiệp query handler.
3. **0 kết nối database ngoài:** Không kết nối dev, staging hay production DB.
4. **0 vi phạm quyền sở hữu module đồng đội:** Không can thiệp các module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
5. **0 tài nguyên remote mới:** Không import font ngoài, CDN script hay ảnh remote; sử dụng 100% SVG nội tuyến và Tailwind CSS tokens có sẵn.

---

## 2. Chi Tiết Triển Khai Giao Diện Khách (UI Redesign Implementation)

Cập nhật mã nguồn tại [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts) và [`frontend/src/app/features/public-booking/public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts):

### 2.1. Các Thành Phần Giao Diện Mới
1. **Unified Hero Search Bar (Thanh tìm kiếm hợp nhất):**
   - Tích hợp ô tìm kiếm cơ sở lưu trú (hỗ trợ tiếng Việt có/không dấu qua server query).
   - Bộ chọn loại hình thuê trực quan (`Hourly` vs `Overnight`).
   - Khung nhập ngày nhận/trả phòng và giờ nhận/trả linh hoạt.
   - Nút CTA "Tìm phòng ngay" và nút "Xóa" tìm kiếm phản hồi tức thì.
2. **Property Cards Grid (Lưới thẻ cơ sở lưu trú trực quan):**
   - Thay thế thẻ `<select>` dropdown thô bằng danh sách thẻ khách sạn trực quan.
   - Hiển thị đầy đủ: Tên (`name`), Địa chỉ (`address`), Thành phố (`city`), Giờ nhận/trả phòng (`checkInTime`/`checkOutTime`), Thời gian đệm (`bufferMinutes`), và Số giờ theo giờ tối đa (`maxHourlyHours`).
   - Thẻ hiển thị trạng thái được chọn (`border-indigo-600 ring-2`) và nút "Chọn cơ sở này".
3. **Inline Vector SVG Placeholder:**
   - Khi `property.imageUrl == null`, component tự động hiển thị SVG đồ họa nội tuyến thanh lịch (biểu tượng khách sạn tối giản phong cách Warm Hospitality), loại bỏ hoàn toàn rủi ro vỡ ảnh hoặc phụ thuộc CDN.
4. **Room Types & Availability (Danh sách hạng phòng & tình trạng tồn):**
   - Hiển thị thẻ từng hạng phòng với các thông số: Số phòng trống (`availableRooms`), Sức chứa tối đa (`maxOccupancy`), Diện tích (`squareMeters`).
   - Badge tình trạng phòng: `Còn phòng` (`bg-emerald-50 text-emerald-700`) hoặc `Hết phòng` (`bg-rose-50 text-rose-700`).
   - Giá phòng hiển thị trường `estimatedPrice` với nhãn minh bạch **"Giá ước tính"**. Tuyệt đối không fallback sang `BasePrice` và không tuyên bố là báo giá cố định.
5. **Authoritative Quote & Hold Integration:**
   - Báo giá chính thức được tính toán qua `PublicBookingService.calculateQuote()` (`POST /api/public/quotes`).
   - Giữ phòng 15 phút qua `PublicBookingService.createHold()` (`POST /api/public/bookings/hold`).
   - Tiền cọc yêu cầu (`depositRequired`) và thời gian hết hạn (`holdExpiresAtUtc`) hiển thị từ phản hồi máy chủ `GuestHoldDto`, không hardcode 30% cọc hay can thiệp chính sách.
6. **Sticky Bottom Summary Bar (Thanh tóm tắt cố định đáy màn hình):**
   - Khi khách hàng đã có báo giá, thanh tóm tắt cố định ở chân trang sẽ xuất hiện hiển thị: Tên hạng phòng, thời gian lưu trú, tổng tiền báo giá, và nút cuộn/xác nhận thông tin khách đặt phòng.
7. **Bảo toàn toàn bộ luồng nghiệp vụ hiện hữu:**
   - Debounce tìm kiếm 300ms, hủy timer khi xóa, latest-request-wins qua RxJS stream.
   - Hủy bỏ và reset trạng thái phòng/báo giá khi đổi cơ sở lưu trú (`selectProperty`).
   - Form thông tin khách đặt phòng, mã tra cứu PII (`lookupToken`), và xác nhận đặt phòng giữ chỗ.

---

## 3. Quản Lý Baseline & File Attributions

| Tệp tin | Hash SHA256 Trước Sửa (Baseline) | Hash SHA256 Sau Sửa (Current) | Trạng thái |
| :--- | :--- | :--- | :--- |
| `frontend/src/app/features/public-booking/booking.page.ts` | `F6FC7F4949759042A69BEA67640B885BFC98B177AF66773CA974FF22EEFB6E45` | `F68E5B1B2A0E237B3820770C8CD1BE22D83D71192F83B8E6A255DF6006DA6224` | Đã nâng cấp UI |
| `frontend/src/app/features/public-booking/public-booking.page.spec.ts` | `0532D5CC27D56FF1F2AA46DFEC567D91E348CB22FBBAB4D4340DB76C55BB89C8` | `DF55912023CAE920E5058D8AD1F4A789C76C909CBBD95B695FD5505F084F35DE` | Đã bổ sung tests |

---

## 4. Bằng Chứng Thực Thi & Kiểm Thử (Execution Evidence)

Toàn bộ log thực thi và manifest được lưu trữ tại `docs/agent-coordination/evidence/guest-ui-implement/`:
1. **Targeted Vitest Suite (`public-booking.page.spec.ts`):**
   - Lệnh: `vitest run src/app/features/public-booking/public-booking.page.spec.ts`
   - Kết quả: **24/24 PASS (100%)**, thời gian 1.16s, Exit code: `0`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-implement/vitest-targeted.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-implement/vitest-targeted.log)
2. **Full Frontend Vitest Suite:**
   - Lệnh: `vitest run`
   - Kết quả: **11/11 Test Files passed, 162/162 Tests passed (100%)**, thời gian 3.89s, Exit code: `0`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-implement/vitest-full.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-implement/vitest-full.log)
3. **Production Angular Build (`ng build`):**
   - Lệnh: `ng build`
   - Kết quả: **Thành công 100% (Bundle generation complete trong 7.28s)**, Exit code: `0`.
   - Thư mục đầu ra: `frontend/dist/frontend`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-implement/frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-implement/frontend-build.log)
4. **Tệp Manifest Nghiệm Thu:**
   - Tệp tin: [`docs/agent-coordination/evidence/guest-ui-implement/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-implement/manifest.json)

---

## 5. Giới Hạn & Ghi Nhận (Limitations)

- **Fuzzy Search Backend:** Thuật toán OSA distance và ranking backend vẫn ở dạng proposal tại `guest-ux-redesign-proposal.md`, chưa được đưa vào backend C# do PO/Codex chưa duyệt lát cắt backend.
- **Visual Capture:** Bằng chứng giao diện đã được kiểm chứng thông qua Unit/Integration tests với Vitest và compile build sạch; chưa capture screenshot browser trực tiếp do môi trường dòng lệnh không có active headless browser display server.
