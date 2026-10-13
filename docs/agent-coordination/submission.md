# Submission GUEST-ROOM-IMAGE-FALLBACK-01 — Round 1

- **TaskId:** `GUEST-ROOM-IMAGE-FALLBACK-01`
- **Round:** 1
- **SubmissionId:** `sub-guest-room-image-fallback-01-r1-20261013`
- **ReviewedSubmissionId:** null
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-13T08:55:00+07:00` (UTC: `2026-10-13T01:55:00Z` — Đồng hồ cục bộ, không xác thực độc lập)
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Tóm Tắt Triển Khai (Executive Summary)

Đã hoàn thiện triển khai lát cắt cô lập giao diện đặt phòng khách hàng (`BookingPage`) xử lý ảnh phòng lỗi (broken image fallback), quản lý ngữ cảnh render bất biến và bộ kiểm thử DOM thực tế bám sát 100% hợp đồng hành vi đã được phê duyệt trong `media-integration-plan.md` (Round 3) theo các tiêu chuẩn AC-MEDIA-01 đến AC-MEDIA-09:

1. **Khởi tạo và Đóng Băng Ngữ Cảnh Render (`RoomImageRenderContext`):**
   - Định nghĩa giao diện bất biến `RoomImageRenderContext` mang đủ 5 thành phần định danh: `propertyId`, `generation`, `roomTypeId`, `url`, và `retryAttempt`.
   - Ngữ cảnh được snapshot ngay khi nhận kết quả `getAvailability` từ service và lưu trữ độc lập qua `itemContextMap` (Map tham chiếu đối tượng), không làm biến đổi thuộc tính DTO gốc của backend hay ảnh hưởng đến tính toàn vẹn của DTO model.
2. **Kháng Sự Kiện Muộn & Fail Closed:**
   - **Fail Closed:** Khi `selectedProperty()` là `null`, `isRoomImageRenderable` trả về `false`, không render ảnh, không dùng chuỗi `'global'` làm dự phòng; handler bỏ qua mọi sự kiện lỗi.
   - **Chuyển cơ sở A $\to$ B:** Khi cơ sở thay đổi, sự kiện lỗi từ thẻ `<img>` của cơ sở cũ bị loại bỏ ngay lập tức do `currentProperty.id !== ctx.propertyId`.
   - **Làm mới thế hệ tìm kiếm (Generation advance):** Khi người dùng đổi ngày lưu trú hoặc tìm kiếm mới, `availabilityRequestId` tăng dần; các sự kiện lỗi từ ảnh thế hệ cũ bị loại bỏ do `currentGen !== ctx.generation`.
   - **Kháng lỗi muộn sau khi thử lại (Retry):** Khi người dùng bấm "Thử lại", `retryAttempt` tăng lên 1; các sự kiện lỗi trễ từ lần thử 0 (`retryAttempt: 0`) bị hủy bỏ.
3. **Trải Nghiệm Fallback & Thao Tác Thử Lại (Retry):**
   - Khi ảnh bị lỗi tải, component tự động thay thế thẻ `<img>` bằng khung đồ họa SVG minh họa cao cấp cùng nhãn công bố rõ ràng: `"Hình minh họa — bố trí phòng mẫu"`.
   - Hiển thị nút bấm `"Thử lại"` (Retry) có điều kiện khi ảnh bị lỗi, cho phép người dùng kích hoạt tải lại tài nguyên trong cùng phiên duyệt mà không cần tải lại toàn bộ trang.
   - Bảo toàn thuộc tính `[alt]="rt.roomTypeName"` cho ảnh gốc, không tự tiện suy đoán nhãn AI từ URL.

---

## 2. Bảng Đối Chiếu Tiêu Chí Nghiệm Thu (Acceptance Criteria Mapping)

| Mã AC | Tiêu Chí Nghiệm Thu | Trạng Thái | Minh Chứng Kiểm Thử (Vitest) |
|---|---|:---:|---|
| **AC-MEDIA-01** | Fail closed khi thiếu Property (không render img, SVG có nhãn, loại bỏ 'global'). | **PASS** | `AC-MEDIA-01: should fail closed when Property is missing or null...` |
| **AC-MEDIA-02** | Fallback an toàn với URL null, rỗng hoặc khoảng trắng (không có nút retry). | **PASS** | `AC-MEDIA-02: should render SVG fallback and disclosure badge for null, empty or whitespace URL...` |
| **AC-MEDIA-03** | Bắt lỗi ảnh vỡ runtime trên DOM thực tế (`dispatchEvent(new Event('error'))`) $\to$ chuyển sang SVG và hiện nút retry. | **PASS** | `AC-MEDIA-03: should transition from image to SVG fallback and show retry button when mounted DOM img fires error event` |
| **AC-MEDIA-04** | Render bình thường khi cùng `roomTypeId` nhận URL mới sau lỗi (URL mới không bị kẹt khóa lỗi cũ). | **PASS** | `AC-MEDIA-04: should render new URL successfully for the same roomTypeId after previous URL encountered error` |
| **AC-MEDIA-05** | Bỏ qua sự kiện lỗi muộn từ DOM cũ khi chuyển cơ sở A $\to$ B (`imgA.dispatchEvent`). Không làm nhiễm bẩn cơ sở B. | **PASS** | `AC-MEDIA-05: should ignore late error event dispatched by mounted DOM img of Property A after switching to Property B` |
| **AC-MEDIA-06** | Bỏ qua sự kiện lỗi muộn từ DOM cũ khi thế hệ tìm kiếm đã tăng lên (Generation advance). | **PASS** | `AC-MEDIA-06: should ignore late error event dispatched by mounted DOM img when availability generation has advanced` |
| **AC-MEDIA-07** | Cô lập khóa lỗi giữa các cơ sở dù trùng `roomTypeId` hay `url` (`${propertyId}:${roomTypeId}:${url}`). | **PASS** | `AC-MEDIA-07: should isolate image error keys across properties when roomTypeId or URL are identical` |
| **AC-MEDIA-08** | Thao tác retry tường minh cho cùng URL: xóa khóa lỗi, remount ảnh, tăng retryAttempt, loại bỏ lỗi trễ từ attempt cũ. | **PASS** | `AC-MEDIA-08: should clear error key and remount image on explicit retry, incrementing retryAttempt and rejecting old attempt errors` |
| **AC-MEDIA-09** | Bảo toàn thuộc tính `[alt]="rt.roomTypeName"` cho media hiện có, không suy đoán AI từ URL. | **PASS** | `AC-MEDIA-09: should preserve alt attribute with exact roomTypeName without AI inference or URL mutation` |

---

## 3. Danh Sách Tệp Mã Nguồn Đã Thay Đổi (Source Diff Summary)

1. [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts):
   - Bổ sung interface `RoomImageRenderContext`.
   - Thêm signal `failedImageKeys`, bảng ánh xạ ngữ cảnh `itemContextMap`, và getter `currentAvailabilityRequestId`.
   - Cập nhật template thẻ phòng (`availabilityList` card) hỗ trợ render có điều kiện `isRoomImageRenderable`, fallback SVG + disclosure badge, nút retry, và `[attr.data-render-key]`.
   - Bổ sung các phương thức: `getRoomImageContext`, `isRoomImageRenderable`, `canRetryRoomImage`, `retryRoomImage`, `getRoomImageRenderKey`, và `onRoomImageError`.
2. [`frontend/src/app/features/public-booking/public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts):
   - Bổ sung polyfill JSDOM cho môi trường DOM thực tế trong Vitest.
   - Bổ sung 9 bài kiểm thử gắn DOM thực tế và kiểm thử hành vi theo đúng hợp đồng AC-MEDIA-01 đến AC-MEDIA-09.

---

## 4. Kết Quả Kiểm Thử Tự Động (Automated Verification Evidence)

- **Targeted Vitest Suite (`public-booking.page.spec.ts`):**
  - Lệnh chạy: `node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts`
  - Kết quả: **50/50 tests passed (100% PASS)** trong 1.85s (41 tests cơ bản + 9 tests AC-MEDIA).
- **Angular Production Build:**
  - Lệnh chạy: `npm run build`
  - Kết quả: **Thành công 100% (0 errors, 0 build failures)** trong 41.39s. Output location: `frontend/dist/frontend`.
- **Backend .NET 10 Test Suite:**
  - Lệnh chạy: `dotnet test C:\Dev\hotel-saas-v2\backend --verbosity minimal`
  - Kết quả: **436/436 tests passed (100% PASS)** (Domain.Tests: 1, WebApi.Tests: 46, Application.Tests: 389).

---

## 5. Cam Kết Giới Hạn & Tính Toàn Vẹn Hệ Thống (Bounded Constraints)

- **Phạm vi cô lập:** Toàn bộ mã nguồn chỉ nằm trong `booking.page.ts` và `public-booking.page.spec.ts`. Không có bất kỳ thay đổi nào đối với shared services, DTOs, backend hay database.
- **Ranh giới đồng đội:** Giữ nguyên vẹn toàn bộ module buồng phòng của Tân (`housekeeping`) và danh mục phòng của Nguyên (`rooms`).
- **Không tự ý phê duyệt cổng nghiệp vụ:** Tiếp tục giữ nguyên 7 Cổng quyết định PO trong `decisions.md` ở trạng thái `NeedsPO`. Phase 6 (AI Search) tiếp tục đóng.
- **Không nhập tài nguyên ngoài:** Không import 4 ảnh AI hay 33 ảnh legacy vào cơ sở dữ liệu production, không kết nối CDN/cloud mới.