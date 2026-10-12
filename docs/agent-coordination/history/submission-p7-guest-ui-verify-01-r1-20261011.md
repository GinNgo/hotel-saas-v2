# Submission: P7-GUEST-UI-VERIFY-01 (Round 1)

- **TaskId:** P7-GUEST-UI-VERIFY-01
- **Round:** 1
- **SubmissionId:** sub-p7-guest-ui-verify-01-r1-20261011
- **ReviewedSubmissionId:** sub-p5-guest-ui-implement-01-r2-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-11T10:18:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **Xác minh giao diện khách hoàn toàn độc lập (Frontend Only):** Toàn bộ thử nghiệm thực thi trong môi trường frontend test và headless browser. Tuyệt đối không can thiệp mã nguồn backend C#.
2. **0 kết nối database ngoài:** Không cấu hình và không gửi yêu cầu tới bất kỳ database dev, staging hay production nào.
3. **Cô lập mạng Loopback 100%:** Sử dụng máy chủ static & in-memory fixture server độc lập tại `http://127.0.0.1:4280` (`fixture-server.cjs`). Không phát sinh bất kỳ yêu cầu mạng nào ra ngoài Internet.
4. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không chạm vào module của Nguyên (`Rooms`/`RoomTypes`) hay Tân (`Housekeeping`).
5. **0 tài nguyên remote mới:** Không import fonts ngoài, CDN scripts hay ảnh bên thứ ba; toàn bộ đồ họa fallback dùng inline SVG vector tự chứa.

---

## 2. Kết Quả Đo Lường Bố Cục Thực Tế (Actual Layout & Overflow Verification)

Đo đạc trực tiếp trên trình duyệt Chromium thông qua `chrome-devtools-mcp` với DOM properties (`scrollWidth`, `clientWidth`, `getBoundingClientRect()`):

| Viewport (Màn hình) | Kích thước Viewport (CSS px) | DPR | `scrollWidth` | `clientWidth` | Tràn ngang (`scrollWidth > clientWidth`) | Trạng thái Sticky Summary Bar | Bằng chứng ảnh chụp thực |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **Desktop 1440px** | $1440 \times 900$ | 1.0 | 1427 px | 1427 px | **FALSE (0 px overflow)** | Hiển thị cố định đáy màn hình ($h = 68.8$ px), không che khuất form | [`desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/desktop-1440.png) |
| **Tablet 768px** | $768 \times 1024$ | 1.0 | 755 px | 755 px | **FALSE (0 px overflow)** | Hiển thị cố định đáy màn hình ($h = 68.8$ px), tự co giãn theo độ rộng | [`tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/tablet-768.png) |
| **Mobile 375px** | $375 \times 812$ (iPhone) | 2.0 | 375 px | 375 px | **FALSE (0 px overflow)** | Docked chính xác ở đáy viewport ($top = 743.2$ px, $743.2 + 68.8 = 812$ px) | [`mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/mobile-375.png) |

---

## 3. Hoàn Thiện Khả Năng Tiếp Cận & Semantics (A11y Refinements)

Theo góp ý của Reviewer Codex tại handoff Round 2:
1. **Chuẩn hóa bộ chọn hình thức thuê (Rental Switcher):**
   - Chuyển đổi từ `role="tablist"` sang button group chuẩn mực: `role="group"` kèm `aria-label="Hình thức thuê phòng"`.
   - Các nút tùy chọn gắn thuộc tính trạng thái `[attr.aria-pressed]="searchForm.get('rentalType')?.value === ..."` (Overnight: `true`, Hourly: `false`).
   - Giữ nguyên focus indicator rõ nét với `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`.
2. **Loại bỏ thẻ select ẩn thừa:**
   - Đã xóa hoàn toàn `<select id="propertySlugSelect" class="sr-only" aria-hidden="true">` khỏi DOM, giải quyết dứt điểm cảnh báo phần tử `aria-hidden` vẫn nhận focus Tab từ bàn phím.
3. **Focus-within và Focus-visible:**
   - Khung nhập ngày nhận/trả phòng có `focus-within:ring-2 focus-within:ring-indigo-500`.
   - Từng input ngày có `focus-visible:ring-1 focus-visible:ring-indigo-500 rounded`.
4. **Property Cards Semantics:**
   - Thẻ `<article>` có `role="region"` và `aria-label="Cơ sở lưu trú: {name}"`.
   - Nút hành động trong card có `aria-pressed`, outline focus rõ nét và tự động disabled (`disabled:opacity-50 disabled:cursor-not-allowed`) khi thẻ rơi vào trạng thái stale/loading/error.
   - Khi `property.imageUrl === null`, component render vector SVG fallback nội tuyến thanh lịch, không gây vỡ giao diện hay lỗi 404 ảnh.

---

## 4. Quản Lý Baseline & File Attributions

| Tệp tin | Hash SHA256 Trước Sửa (Baseline) | Hash SHA256 Sau Hoàn Thiện (Current) |
| :--- | :--- | :--- |
| `frontend/src/app/features/public-booking/booking.page.ts` | `F6FC7F4949759042A69BEA67640B885BFC98B177AF66773CA974FF22EEFB6E45` | `865E38613D67FC98C5ADB9AFD16891796FB56C22ED20CC93A80D2B8CC528652A` |
| `frontend/src/app/features/public-booking/public-booking.page.spec.ts` | `0532D5CC27D56FF1F2AA46DFEC567D91E348CB22FBBAB4D4340DB76C55BB89C8` | `0477BFAEC5347B8EE7A37BE280E26F3B2D58C88DA1F3D2C84B9128C5FF83C74B` |

---

## 5. Bằng Chứng Thực Thi & Kiểm Thử (Execution Evidence)

Tất cả log kiểm chứng và bằng chứng ảnh được lưu trữ tại `docs/agent-coordination/evidence/guest-ui-verify/`:
1. **Targeted Vitest Suite (`public-booking.page.spec.ts`):**
   - Lệnh: `vitest run src/app/features/public-booking/public-booking.page.spec.ts`
   - Kết quả: **28/28 PASS (100%)**, thời gian 1.33s, Exit code: `0`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-verify/vitest-targeted.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/vitest-targeted.log)
2. **Full Frontend Vitest Suite:**
   - Lệnh: `vitest run`
   - Kết quả: **11/11 Test Files passed, 166/166 Tests passed (100%)**, thời gian 5.09s, Exit code: `0`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-verify/vitest-full.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/vitest-full.log)
3. **Production Angular Build (`ng build`):**
   - Lệnh: `ng build`
   - Kết quả: **Thành công 100% (Bundle generation complete trong 10.31s)**, Exit code: `0`.
   - Thư mục đầu ra: `frontend/dist/frontend`.
   - Log: [`docs/agent-coordination/evidence/guest-ui-verify/frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/frontend-build.log)
4. **Bằng chứng ảnh chụp màn hình thật (Real Browser Screenshots):**
   - Desktop: [`docs/agent-coordination/evidence/guest-ui-verify/desktop-1440.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/desktop-1440.png)
   - Tablet: [`docs/agent-coordination/evidence/guest-ui-verify/tablet-768.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/tablet-768.png)
   - Mobile: [`docs/agent-coordination/evidence/guest-ui-verify/mobile-375.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/mobile-375.png)
5. **Tệp Manifest Nghiệm Thu Visual:**
   - Tệp tin: [`docs/agent-coordination/evidence/guest-ui-verify/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ui-verify/manifest.json)

---

## 6. Giới Hạn & Ghi Nhận (Limitations)

- **Synthetic In-Memory Fixtures:** Dữ liệu phòng trống và báo giá hiển thị trên ảnh chụp dựa trên máy chủ fixture tổng hợp offline (`fixture-server.cjs`), không đại diện cho kho phòng production hay kết nối live cloud.
- **Fuzzy Search Backend:** Tiếp tục bảo lưu trong tài liệu đề xuất `guest-ux-redesign-proposal.md`, không can thiệp code C# khi chưa có task backend riêng từ PO.
