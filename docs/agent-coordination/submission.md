# Submission GUEST-ROOM-IMAGE-FALLBACK-01 — Round 3

- **TaskId:** `GUEST-ROOM-IMAGE-FALLBACK-01`
- **Round:** 3
- **SubmissionId:** `sub-guest-room-image-fallback-01-r3-20261013`
- **ReviewedSubmissionId:** `sub-guest-room-image-fallback-01-r2-20261013`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-13T09:25:00+07:00` (UTC: `2026-10-13T02:25:00Z` — Đồng hồ cục bộ)
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Giải Quyết Đầy Đủ Các Điểm Đánh Giá Từ Reviewer Codex (Round 2 Findings Resolution)

1. **Bổ sung bền vững 2 bài kiểm thử hồi quy (Durable Regression Tests):**
   - Đã tích hợp trực tiếp 2 test cases bền vững vào cuối `public-booking.page.spec.ts`:
     * `review regression: refresh accepted same DTO must recreate image identity and reject old-node error`: Khẳng định thẻ `<img>` mới được tái tạo hoàn toàn khác thẻ cũ (`newImage !== oldImage`), và sự kiện lỗi muộn phát ra từ node cũ bị loại bỏ hoàn toàn (`failedImageKeys.size === 0`).
     * `review regression: property reset clears previous image failure on A-B-A cycle`: Khẳng định chu trình chuyển cơ sở A $\to$ B $\to$ A dọn sạch trạng thái lỗi và phục hồi hiển thị ảnh hợp lệ (`failedImageKeys.size === 0`, `restoredImg !== null`).
   - Tổng số bài kiểm thử của suite đạt **52/52 tests (100% PASS)** (trước đó là 50 tests).

2. **Công bố tính cô lập và giới hạn thực thi Backend trước đó (Isolation & Safety Disclosure):**
   - Lệnh chạy `dotnet test` trong báo cáo Round 1 được đánh dấu là không xác thực độc lập về mức độ an toàn CSDL hay môi trường khởi động; các lần thực thi tiếp theo từ Round 2 và Round 3 được tuân thủ nghiêm ngặt theo phạm vi frontend-only (chỉ chạy Vitest và Angular build trên thư mục `frontend/`). Không chạy lại bất kỳ lệnh backend hay truy cập CSDL nào.

3. **Ghi nhận lịch sử Commit và Baseline:**
   - Baseline tham chiếu là commit `201fd5bf60fcf286ac3f5476b413e89b019d24b2` trên nhánh `develop`. Các thay đổi mã nguồn trong nhiệm vụ này được giới hạn tuyệt đối trong lát cắt đặt phòng công khai của khách hàng.

---

## 2. Bảng Đối Chiếu Tiêu Chí Nghiệm Thu (Acceptance Criteria Mapping)

| Mã AC / Test | Tiêu Chí Nghiệm Thu | Kết Quả | Minh Chứng Kiểm Thử (Vitest) |
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
| **Regression 1** | Refresh chấp nhận cùng DTO reference phải tái tạo định danh DOM của ảnh (`newImage !== oldImage`) và lỗi từ node cũ không làm kẹt key mới. | **PASS** | `review regression: refresh accepted same DTO must recreate image identity and reject old-node error` |
| **Regression 2** | Chuyển đổi cơ sở A $\to$ B $\to$ A phải làm sạch trạng thái lỗi cũ, phục hồi ảnh hợp lệ. | **PASS** | `review regression: property reset clears previous image failure on A-B-A cycle` |

---

## 3. Danh Sách Tệp Mã Nguồn Đã Sửa Đổi (Source Diff Summary)

1. [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts):
   - Template: Bọc `<img>` trong `<ng-container *ngFor="let key of [getRoomImageRenderKey(rt)]; trackBy: trackByRenderKey">` đảm bảo DOM keying tuyệt đối.
   - Class: Bổ sung `trackByRenderKey = (_index: number, key: string): string => key`.
   - `resetSelectionAndAvailability()`: Bổ sung `this.failedImageKeys.set(new Set<string>());` dọn sạch trạng thái lỗi khi đổi cơ sở hoặc tiêu chí tìm kiếm.
2. [`frontend/src/app/features/public-booking/public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts):
   - Bổ sung bền vững 2 bài kiểm thử hồi quy DOM cho refresh cùng DTO và chu trình A-B-A.

---

## 4. Kết Quả Kiểm Thử Tự Động (Automated Verification Evidence)

- **Targeted Vitest Suite (`public-booking.page.spec.ts`):**
  - Lệnh chạy: `node C:/Dev/hotel-saas-v2/frontend/node_modules/vitest/vitest.mjs run --root C:/Dev/hotel-saas-v2/frontend src/app/features/public-booking/public-booking.page.spec.ts`
  - Kết quả: **52/52 tests passed (100% PASS)** trong 1.58s (Test files: 1 passed, Tests: 52 passed).
- **Angular Production Build:**
  - Lệnh chạy: `npm --prefix C:/Dev/hotel-saas-v2/frontend run build`
  - Kết quả: **Thành công 100% (0 errors, 0 build failures)**. Output location: `frontend/dist/frontend`.

---

## 5. Cam Kết Giới Hạn & Tính Toàn Vẹn Hệ Thống (Bounded Constraints)

- **Phạm vi cô lập:** Toàn bộ mã nguồn chỉ nằm trong `booking.page.ts` và `public-booking.page.spec.ts`. Không có bất kỳ thay đổi nào đối với shared services, DTOs, backend hay database.
- **Ranh giới đồng đội:** Giữ nguyên vẹn toàn bộ module buồng phòng của Tân (`housekeeping`) và danh mục phòng của Nguyên (`rooms`).
- **Không tự ý phê duyệt cổng nghiệp vụ:** Tiếp tục giữ nguyên 7 Cổng quyết định PO trong `decisions.md` ở trạng thái `NeedsPO`. Phase 6 tiếp tục đóng.
- **Không nhập tài nguyên ngoài:** Không import ảnh AI hay legacy images vào CSDL.