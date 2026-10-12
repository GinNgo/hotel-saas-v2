# Submission: P7-GUEST-UI-VERIFY-01 (Round 2)

- **TaskId:** P7-GUEST-UI-VERIFY-01
- **Round:** 2
- **SubmissionId:** sub-p7-guest-ui-verify-01-r2-20261011
- **ReviewedSubmissionId:** sub-p7-guest-ui-verify-01-r1-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-11T10:33:30+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **Xác minh giao diện khách hoàn toàn độc lập (Frontend Only):** Toàn bộ thử nghiệm thực thi trong môi trường frontend test và headless browser. Tuyệt đối không can thiệp mã nguồn backend C#.
2. **0 kết nối database ngoài:** Không cấu hình và không gửi yêu cầu tới bất kỳ database dev, staging hay production nào (0 connection string, 0 DML).
3. **Cô lập mạng Loopback 100%:** Sử dụng máy chủ static & dynamic fixture server độc lập tại `http://127.0.0.1:4280` (`fixture-server.cjs`). Toàn bộ 32 lượt request trình duyệt đều được ghi nhận tại `127.0.0.1` và kiểm toán tại `network-audit.json`.
4. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không can thiệp module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
5. **0 tài nguyên remote mới:** Không import fonts ngoài, CDN scripts hay ảnh bên thứ ba; toàn bộ đồ họa fallback dùng inline SVG vector tự chứa.

---

## 2. Giải Quyết Triệt Để Các Findings Từ Reviewer Codex (Round 1)

### Finding 1 (HIGH) — Mobile Sticky CTA Bar Redesign & Zero Clipping
- **Hiện tượng Round 1:** Trên màn hình mobile 375px, container sticky sử dụng flex đơn hàng với summary chiếm bề ngang, khiến nút CTA tím bị đẩy sát và cắt ngoài mép phải (`mobile-375.png`).
- **Khắc phục Round 2:**
  - Tái cấu trúc thanh sticky đáy trong `booking.page.ts` sang bố cục **2 hàng phản hồi (Two-row responsive layout)** trên màn hình hẹp (`< 640px` / sm):
    - **Hàng 1 (Top info):** Icon phòng + Tên loại phòng & tên cơ sở lưu trú (co giãn linh hoạt với `min-w-0 flex-1 truncate`) + Tổng tiền thanh toán hiển thị gọn gàng góc phải (`sm:hidden`).
    - **Hàng 2 (Bottom CTA):** Nút CTA chính `id="stickyBottomCtaButton"` chiếm toàn bộ chiều rộng khả dụng (`w-full sm:w-auto`, `min-h-[44px]`), căn giữa hoàn hảo.
  - Trên màn hình Desktop/Tablet (`sm:`): Giữ nguyên bố cục 1 hàng sang trọng (`sm:flex-row`, `sm:items-center`, `sm:justify-between`).
  - **Tăng khoảng đệm chân trang:** Tăng padding bottom của thẻ `<main>` lên `pb-36 sm:pb-28` (144px trên mobile).
- **Kết quả đo đạc thực tế qua CDP (`evaluate_script` trên Chromium thật):**
  - Viewport: $375 \times 812$, DPR = 2.0.
  - `hasHorizontalOverflow: false` (`scrollWidth = clientWidth = 375px`).
  - Nút `#stickyBottomCtaButton`: `left = 16.0px`, `right = 359.2px`, `width = 343.2px`, `top = 758.0px`, `bottom = 802.0px`.
  - Thuộc tính kiểm tra: `isFullyInViewport: true` (nằm trọn vẹn trong vùng hiển thị 375px với 16px padding an toàn mỗi bên).
  - Khoảng hở chống che khuất (Anti-occlusion clearance): Khi cuộn xuống tận cùng đáy trang, nút gửi biểu mẫu (`submitHold`) cách thanh sticky cố định **144.9px** (`isSubmitAboveStickyBar: true`).

### Finding 2 (MEDIUM) — Tái Lập Viewport Metrics, Kích Thước PNG & Network Audit
- **Hiện tượng Round 1:** Kích thước PNG desktop (1803x915) và tablet (963x915) bị chi phối bởi kích thước cửa sổ OS thay vì CSS viewport chuẩn; thiếu audit request mạng outbound.
- **Khắc phục Round 2:**
  - Thiết lập chuẩn xác CDP Emulation bằng `Emulation.setDeviceMetricsOverride` qua lệnh `emulate` của MCP trước khi chụp:
    - **Desktop 1440px:** Viewport $1440 \times 900$, DPR 1.0 $\rightarrow$ Kích thước ảnh PNG xuất ra: **1440 × 900 px** (142,905 bytes).
    - **Tablet 768px:** Viewport $768 \times 1024$, DPR 1.0 $\rightarrow$ Kích thước ảnh PNG xuất ra: **768 × 1024 px** (136,983 bytes).
    - **Mobile 375px:** Viewport $375 \times 812$, DPR 2.0 $\rightarrow$ Kích thước ảnh PNG xuất ra: **750 × 1624 px** (176,844 bytes, tương ứng $375 \times 2$ và $812 \times 2$).
  - Thu thập toàn bộ chỉ số thực từ trình duyệt (`window.innerWidth`, `innerHeight`, `clientWidth`, `scrollWidth`, `boundingClientRect`) lưu trong `manifest.json`.
  - **Kiểm toán mạng Outbound (Network Audit):** Thu thập toàn bộ 32 lượt request thông qua endpoint nội bộ `/__audit/network` và lưu tại `network-audit.json`: 100% request có nguồn gốc từ `127.0.0.1` (`loopbackOnly: true`).

### Finding 3 (MEDIUM) — Kiểm Thử Template/DOM Khả Năng Tiếp Cận & Khớp Endpoint Fixture Server
- **Khắc phục Spec Test (`public-booking.page.spec.ts:826`):**
  - Không chỉ kiểm tra trạng thái component instance, test đã được nâng cấp để assert trực tiếp cấu trúc Template và DOM:
    1. Kiểm tra tồn tại Angular Ivy Component Definition (`(BookingPage as any).ɵcmp`).
    2. Xác minh trích xuất Template có `role="group"` và `aria-label="Hình thức thuê phòng"`.
    3. Xác minh cả 2 nút tùy chọn gắn thuộc tính ràng buộc động `[attr.aria-pressed]`.
    4. Xác minh không còn bất kỳ phần tử thừa `propertySlugSelect` hay `id="propertySlugSelect"`.
    5. Xác minh thanh sticky có `id="stickyBottomCtaButton"`, `id="stickySummaryBar"`, class phản hồi `w-full sm:w-auto` và `pb-36 sm:pb-28`.
- **Khắc phục Fixture Server (`fixture-server.cjs`):**
  - Cập nhật đúng hợp đồng endpoint của `PublicBookingService`:
    - `GET /api/public/bookings/:token` (thay vì chỉ route phụ `/lookup/:token`).
    - `POST /api/public/bookings/:token/confirm` (hỗ trợ xác nhận đặt phòng idempotent).
  - Triển khai động Pricing Engine: `POST /api/public/quotes` tính toán giá linh hoạt theo loại phòng và hình thức thuê từ request body.
  - Triển khai kho lưu trữ giữ phòng in-memory: `POST /api/public/bookings/hold` lưu token vào `holdsMap` để hỗ trợ luồng chuyển trang và tra cứu động.
  - Bổ sung kịch bản mã lỗi: token `invalid-token` trả về HTTP 404, `expired-token` trả về trạng thái hết hạn.

---

## 3. Bảng Tổng Hợp Đo Lường Layout Trực Tiếp Trên Trình Duyệt

| Màn hình | Viewport Khai Báo (CSS px) | DPR | Kích Thước File PNG Thực | `scrollWidth` / `clientWidth` | Tràn ngang | Trạng thái Nút CTA Sticky | Bằng chứng hình ảnh |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **Desktop** | $1440 \times 900$ | 1.0 | **1440 × 900 px** | 1425 / 1425 px | **FALSE** | `left = 1101.2`, `width = 251.2`, `isFullyInViewport: true` | [`desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/desktop-1440.png) |
| **Tablet** | $768 \times 1024$ | 1.0 | **768 × 1024 px** | 753 / 753 px | **FALSE** | `left = 469.6`, `width = 251.2`, `isFullyInViewport: true` | [`tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/tablet-768.png) |
| **Mobile** | $375 \times 812$ | 2.0 | **750 × 1624 px** | 375 / 375 px | **FALSE** | `left = 16.0`, `width = 343.2`, `right = 359.2`, **`isFullyInViewport: true`** | [`mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/mobile-375.png) |

---

## 4. Quản Lý Baseline & File Attributions

| Tệp tin | Hash Baseline (Trước UI) | Hash Round 1 | Hash Round 2 (Hiện tại) |
| :--- | :--- | :--- | :--- |
| `frontend/src/app/features/public-booking/booking.page.ts` | `F6FC7F49...` | `865E3861...` | **`4768C05C516A13EDFF703FD16DDC178B7A0E7E063D0465A1CEC83F82C7BEC1FC`** |
| `frontend/src/app/features/public-booking/public-booking.page.spec.ts` | `0532D5CC...` | `0477BFAE...` | **`308D460BC89FCE357146DCAA16EE398309056E041B8379274EC924E59286C4E3`** |
| `docs/agent-coordination/evidence/guest-ui-verify/fixture-server.cjs` | — | `693B9F25...` | **`244FD2AD19EAC420CCE289F3098988F594679CF042A48A864CC233ECF170BBF2`** |
| `docs/agent-coordination/evidence/guest-ui-verify/network-audit.json` | — | — | **`2397A06C49763470E1F594696DF994FEA1DE4307AB721912C16EB46EB7E737A9`** |
| `docs/agent-coordination/evidence/guest-ui-verify/mobile-375.png` | — | `0DB40242...` | **`C61A5CE2CAED37A9F41C24AF705CDE60766BAF4ABD8B3B2D2DF93E9BF6DAD7F1`** |
| `docs/agent-coordination/evidence/guest-ui-verify/tablet-768.png` | — | `EE89D0BA...` | **`005C1CB466F2B5931303512660AC60C580BF06F309F686B94A7E3CA3AAB5B75C`** |
| `docs/agent-coordination/evidence/guest-ui-verify/desktop-1440.png` | — | `B288D8E9...` | **`D34044E8FF4C48908C5A61782EB7B0A45C890F9BBDFEF0DF89F241479F3062DC`** |

---

## 5. Bằng Chứng Thực Thi & Kiểm Thử (Execution Evidence)

Tất cả log kiểm chứng và bằng chứng ảnh được cập nhật đầy đủ tại `docs/agent-coordination/evidence/guest-ui-verify/`:
1. **Targeted Vitest Suite (Public Booking Feature & Service):**
   - Lệnh: `node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts`
   - Kết quả: **2/2 Test Files passed, 36/36 Tests passed (100%)**, thời gian 1.32s, Exit code: `0`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-verify/vitest-targeted.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/vitest-targeted.log)
2. **Full Frontend Vitest Suite:**
   - Lệnh: `node ./node_modules/vitest/vitest.mjs run`
   - Kết quả: **11/11 Test Files passed, 166/166 Tests passed (100%)**, thời gian 3.86s, Exit code: `0`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-verify/vitest-full.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/vitest-full.log)
3. **Production Angular Build (`ng build`):**
   - Lệnh: `npm run build`
   - Kết quả: **Thành công 100% (Bundle generation complete trong 7.58s)**, Exit code: `0`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-verify/frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/frontend-build.log)
4. **Kiểm toán mạng (Network Request Audit):**
   - Log: [`docs/agent-coordination/evidence/guest-ui-verify/network-audit.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/network-audit.json)
   - Kết quả: 32/32 request đến `127.0.0.1:4280`, 0 kết nối ra ngoài.
5. **Tệp Manifest Nghiệm Thu Visual:**
   - Tệp tin: [`docs/agent-coordination/evidence/guest-ui-verify/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/manifest.json)

---

## 6. Giới Hạn & Ghi Nhận (Limitations)

- **Synthetic In-Memory Fixtures:** Dữ liệu phòng trống và báo giá hiển thị trên ảnh chụp dựa trên máy chủ fixture tổng hợp offline (`fixture-server.cjs`), không đại diện cho kho phòng production hay kết nối live cloud.
- **Fuzzy Search Backend:** Tiếp tục bảo lưu trong tài liệu đề xuất `guest-ux-redesign-proposal.md`, không can thiệp code C# khi chưa có task backend riêng từ PO.
