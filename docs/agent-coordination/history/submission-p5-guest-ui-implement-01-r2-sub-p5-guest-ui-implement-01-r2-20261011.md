# Submission: P5-GUEST-UI-IMPLEMENT-01 (Round 2)

- **TaskId:** P5-GUEST-UI-IMPLEMENT-01
- **Round:** 2
- **SubmissionId:** sub-p5-guest-ui-implement-01-r2-20261011
- **ReviewedSubmissionId:** sub-p5-guest-ui-implement-01-r1-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-11T10:07:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **Frontend duy nhất (Frontend Only):** Toàn bộ chỉnh sửa giới hạn tuyệt đối trong `frontend/src/app/features/public-booking/`. Không can thiệp mã nguồn backend C#.
2. **0 sửa đổi Backend & 0 Fuzzy Matcher Code:** Hợp đồng Fuzzy Search vẫn giữ nguyên dạng tài liệu đề xuất (`guest-ux-redesign-proposal.md`), không can thiệp query handler hay thêm dependency backend.
3. **0 kết nối database ngoài:** Không kết nối dev, staging hay production DB.
4. **0 vi phạm quyền sở hữu module đồng đội:** Không can thiệp các module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
5. **0 tài nguyên remote mới:** Không import CDN, fonts ngoài hay ảnh remote; 100% SVG nội tuyến và Tailwind CSS tokens có sẵn.

---

## 2. Báo Cáo Khắc Phục Toàn Diện Các Findings Của Reviewer (Codex Round 1)

### 2.1. Finding 1: HIGH — Loại Bỏ Hoàn Toàn Cọc 30% Hardcode & calculateDeposit (ĐÃ GIẢI QUYẾT)
- **Xóa bỏ phương thức tính cọc:** Đã xóa hoàn toàn phương thức `calculateDeposit(total: number)` khỏi class `BookingPage`.
- **Cập nhật giao diện báo giá:** Thay thế dòng hiển thị cọc dự kiến 30% bằng thông báo minh bạch:
  - *"Tiền đặt cọc: Xác định theo chính sách cơ sở khi giữ phòng (depositRequired)"*.
  - Chú thích phía dưới: *"Tiền đặt cọc chính thức (depositRequired) do hệ thống xác định sau khi tạo yêu cầu giữ phòng. Số tiền còn lại thanh toán tại quầy lễ tân."*
- **Trang giữ phòng (Hold page):** Giữ nguyên luồng sử dụng `depositRequired` thực tế trả về từ `GuestHoldDto` của máy chủ.
- **Kiểm chứng Test:** Đã cập nhật test trong `public-booking.page.spec.ts`, loại bỏ assertion gọi `calculateDeposit`, thay bằng assertion xác nhận `(component as any).calculateDeposit === undefined`.

### 2.2. Finding 2: HIGH — Bổ Sung Provenance Guard Cho Property Cards & Chặn Click Thẻ Cũ (ĐÃ GIẢI QUYẾT)
- **Hàm kiểm tra hợp lệ nguồn gốc:** Bổ sung phương thức `isPropertySelectable(prop: PublicPropertyDto)`:
  ```typescript
  isPropertySelectable(prop: PublicPropertyDto): boolean {
    if (this.isLoadingProperties() || !!this.propertiesError()) {
      return false;
    }
    return this.properties().some(p => p.id === prop.id);
  }
  ```
- **Bảo vệ phương thức chọn cơ sở:**
  - `selectProperty(prop)`: Kiểm tra `!this.isPropertySelectable(prop)` $\rightarrow$ return ngay lập tức.
  - `onPropertyChange()`: Kiểm tra `!this.isPropertySelectable(prop)` $\rightarrow$ return.
- **Trạng thái giao diện và khả năng tương tác:**
  - Thẻ `<article>`: Áp dụng class `border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed` khi không thể chọn, và chỉ kích hoạt `(click)` khi `isPropertySelectable(prop)` trả về `true`.
  - Nút chọn cơ sở: Gắn thuộc tính `[disabled]="!isPropertySelectable(prop)"`, `[attr.aria-pressed]="selectedProperty()?.id === prop.id"`, và styling `disabled:opacity-50 disabled:cursor-not-allowed`.
- **Kiểm chứng Test:** Bổ sung unit test kiểm tra 4 kịch bản provenance:
  1. Click vào thẻ cũ không còn nằm trong `properties()` $\rightarrow$ bị chặn hoàn toàn, không đổi `selectedProperty`, không gọi `getAvailability`.
  2. Click khi tìm kiếm đang tải (`isLoadingProperties() === true`) $\rightarrow$ bị chặn.
  3. Click khi tìm kiếm gặp lỗi (`propertiesError() !== null`) $\rightarrow$ bị chặn.
  4. Click khi danh sách cơ sở rỗng $\rightarrow$ bị chặn.

### 2.3. Finding 3: MEDIUM — Bàn Phím, Screen Reader & Loại Bỏ Select Ẩn Thừa (ĐÃ GIẢI QUYẾT)
- **Loại bỏ thẻ select ẩn thừa:** Đã xóa bỏ hoàn toàn thẻ `<select id="propertySlugSelect" class="sr-only" aria-hidden="true">` khỏi template. Thẻ này trước đây thiếu `tabindex="-1"` nên vẫn bị Tab bàn phím focus vào, gây lỗi tiếp cận cho screen reader.
- **Semantics bộ chọn hình thức thuê (Rental Switcher):**
  - Khung bao bọc được gắn `role="tablist"` và `aria-label="Hình thức thuê phòng"`.
  - Các nút tùy chọn được gắn `role="tab"`, `[attr.aria-selected]="..."`, và outline rõ nét qua `focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`.
- **Focus-within cho khung nhập ngày/giờ:**
  - Khung Date/Stay Inputs (`searchForm`) được bổ sung class `focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500` đồng bộ hoàn toàn với khung tìm kiếm từ khóa.
  - Các input ngày (`#checkInDateInput`, `#checkOutDateInput`, `#hourlyDateInput`) và select thời lượng (`#hourlyDurationSelect`) được bổ sung `focus-visible:ring-1 focus-visible:ring-indigo-500 rounded`.
- **Semantics Property Card:**
  - Thẻ card được gắn `role="region"`, `[attr.aria-label]="'Cơ sở lưu trú: ' + prop.name"`.
  - Nút chọn cơ sở được gắn `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`.

### 2.4. Quan Sát: Quản Lý Vòng Đời Báo Giá Phòng (Quote Switch A $\rightarrow$ B) & Chống Double Submit (ĐÃ GIẢI QUYẾT)
- **Xóa đồng bộ quote khi đổi phòng:**
  - Trong `selectRoomType(rt)`: Gọi `this.currentQuote.set(null);` ngay lập tức trước khi gọi `loadQuote(rt.roomTypeId)` để xóa quote phòng cũ ngay khi người dùng bấm chọn phòng mới.
  - Trong `loadQuote(roomTypeId)`: Reset `this.currentQuote.set(null);` trước khi phát request báo giá mới; nếu request gặp lỗi, `currentQuote()` được đảm bảo giữ nguyên giá trị `null`.
- **Guard chống giữ phòng với quote không hợp lệ:**
  - Trong `submitHold()`: Bổ sung guard `if (this.isLoadingQuote() || this.isSubmittingHold()) return;`
  - Bổ sung xác minh nguồn gốc báo giá: `if (quote.roomTypeId && quote.roomTypeId !== selectedRoom.roomTypeId) return;` (báo giá phải khớp chính xác với hạng phòng đang chọn).
- **Kiểm chứng Test:** Bổ sung 2 test suites độc lập:
  - Kiểm tra toàn diện chuỗi sự kiện đổi phòng A $\rightarrow$ B: khi quote B đang pending thì `currentQuote()` là `null` và `submitHold()` bị từ chối; khi quote B lỗi thì `currentQuote()` vẫn là `null` và `submitHold()` vẫn bị từ chối; khi quote B thành công thì `submitHold()` mới được phép gửi đúng `expectedTotalAmount` của phòng B.
  - Kiểm tra guard chống double-submit: khi `isSubmittingHold()` là `true`, các lần gọi `submitHold()` tiếp theo đều bị chặn.

---

## 3. Quản Lý Baseline & File Attributions

| Tệp tin | Hash SHA256 Trước Sửa (Baseline) | Hash SHA256 Round 1 | Hash SHA256 Sau Sửa (Round 2) |
| :--- | :--- | :--- | :--- |
| `frontend/src/app/features/public-booking/booking.page.ts` | `F6FC7F4949759042A69BEA67640B885BFC98B177AF66773CA974FF22EEFB6E45` | `F68E5B1B2A0E237B3820770C8CD1BE22D83D71192F83B8E6A255DF6006DA6224` | `083B8C011288FDE952F82B682C9729E5334AE3B8DBE6F26DFA99740EE18F2901` |
| `frontend/src/app/features/public-booking/public-booking.page.spec.ts` | `0532D5CC27D56FF1F2AA46DFEC567D91E348CB22FBBAB4D4340DB76C55BB89C8` | `DF55912023CAE920E5058D8AD1F4A789C76C909CBBD95B695FD5505F084F35DE` | `CA462F34B1B3920B2FE5EAD72E89D9C385730FDE6C4A99FEA46DD1D102E543AC` |

---

## 4. Bằng Chứng Thực Thi & Kiểm Thử (Execution Evidence)

Toàn bộ log thực thi và manifest được lưu trữ tại `docs/agent-coordination/evidence/guest-ui-implement/`:
1. **Targeted Vitest Suite (`public-booking.page.spec.ts`):**
   - Lệnh: `vitest run src/app/features/public-booking/public-booking.page.spec.ts`
   - Kết quả: **27/27 PASS (100%)**, thời gian 1.15s, Exit code: `0`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-implement/vitest-targeted.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-implement/vitest-targeted.log)
2. **Full Frontend Vitest Suite:**
   - Lệnh: `vitest run`
   - Kết quả: **11/11 Test Files passed, 165/165 Tests passed (100%)**, thời gian 3.88s, Exit code: `0`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-implement/vitest-full.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-implement/vitest-full.log)
3. **Production Angular Build (`ng build`):**
   - Lệnh: `ng build`
   - Kết quả: **Thành công 100% (Bundle complete trong 7.13s)**, Exit code: `0`.
   - Thư mục đầu ra: `frontend/dist/frontend`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-implement/frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-implement/frontend-build.log)
4. **Tệp Manifest Nghiệm Thu Round 2:**
   - Tệp tin: [`docs/agent-coordination/evidence/guest-ui-implement/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-implement/manifest.json)

---

## 5. Giới Hạn & Ghi Nhận (Limitations)

- **Fuzzy Search Backend:** Tiếp tục giữ nguyên dạng đề xuất tại `guest-ux-redesign-proposal.md`, không can thiệp code C# theo đúng chỉ thị assignment.
- **Browser Visual Evidence:** Xác nhận tính chất hạn chế môi trường không có display server để chạy live browser screenshot; các kiểm chứng tiếp cận (a11y) và tương tác được xác thực bằng DOM/Class unit tests và compilation bundle.
