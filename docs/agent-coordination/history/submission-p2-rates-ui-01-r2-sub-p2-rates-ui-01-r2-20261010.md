# Submission: P2-RATES-UI-01 (Round 2)

- **TaskId:** P2-RATES-UI-01
- **Round:** 2
- **SubmissionId:** sub-p2-rates-ui-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T10:55:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Tóm tắt giải quyết toàn bộ Findings từ Review Round 1

Toàn bộ 3 findings (P1, P1, P2) được Codex chỉ ra trong `review.md` đã được xử lý triệt để và kiểm chứng bằng bộ unit tests RxJS `Subject` chuyên sâu:

### Finding 1 (P1) — Bỏ hoàn toàn suy diễn BasePrice và giá tài chính tự động trong Form
- **Code:** Trong [`frontend/src/app/features/rates/rates.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/rates/rates.page.ts):
  - Tại `initForm()` và `openCreateModal()`: Toàn bộ các trường giá tài chính (`firstHoursPrice`, `additionalHourPrice`, `nightlyPrice`) được khởi tạo nghiêm ngặt là `null` (không còn `basePrice * 0.4`, `basePrice * 0.15` hay fallback `100000`, `30000`, `350000`).
  - Tại `validateForm()`: Bổ sung kiểm tra bắt buộc nhập rõ ràng cho cả 3 trường giá (`Vui lòng nhập giá gói giờ đầu`, `Vui lòng nhập giá mỗi giờ thêm`, `Vui lòng nhập giá thuê qua đêm tiêu chuẩn`), chặn submit giá âm hoặc để trống.
- **Kiểm thử liên quan:** Test 4 trong `rates.page.spec.ts` kiểm chứng khi mở modal, các trường giá đều là `null`, và submit ngay khi chưa nhập giá bị từ chối bởi client validator, tuyệt đối không gọi `rateService.createRate`.

### Finding 2 (P1) — Gắn Modal & POST với Snapshot RoomType/Property và Race Guard
- **Snapshot Context:** Bổ sung hai signals `modalTargetRoomTypeId = signal<string | null>(null)` và `modalTargetPropertyId = signal<string | null>(null)`.
  - Tại `openCreateModal()`: Xác minh loại phòng tồn tại trong `roomTypes()` và lưu snapshot vào hai signals này.
  - Tại `closeCreateModal()`: Reset form và xóa snapshot.
  - Khi người dùng đổi loại phòng qua dropdown (`onRoomTypeChanged`), qua URL query parameters (`routeQuerySub`), hoặc đổi chi nhánh (`handlePropertyContextChange`): Hủy request POST in-flight nếu có, đóng modal và reset snapshot.
- **Entry Guard & Response Guard:**
  - Tại entry của `submitRate()`: Chặn submit nếu `modalTargetRoomTypeId` khác `selectedRoomTypeId`, khác `propertyId`, hoặc không thuộc `roomTypes()`.
  - Tại callback của `createRate` (cả next và error): Kiểm tra `this.propertyId() !== targetPropertyId || this.selectedRoomTypeId() !== targetRoomTypeId || this.modalTargetRoomTypeId() !== targetRoomTypeId`. Nếu context đã thay đổi trong khi request in-flight, response hoặc error sẽ bị loại bỏ hoàn toàn, không hiển thị toast sai ngữ cảnh và không mutate state của phòng khác.
- **Cleanup On Destroy:** `ngOnDestroy()` gọi `cancelPendingRequests()` và giải phóng subscriptions.
- **Kiểm thử bằng Subject:**
  - Test 9: Đổi loại phòng khi modal đang mở tự động đóng và xóa snapshot.
  - Test 10: Selection đổi A $\to$ B khi POST của A đang pending $\to$ response của A về muộn bị bỏ qua, không hiển thị toast hoặc ghi đè state B.
  - Test 11: Chi nhánh đổi A $\to$ B khi POST đang pending $\to$ response bị drop.
  - Test 13: Destroy component hủy pending POST.

### Finding 3 (P2) — Xóa dữ liệu cũ tức thì và Cô lập History Loading / Error / Retry
- **Clear Immediate:** Trong `loadRatesData()`, ngay khi bắt đầu tải loại phòng mới, lập tức set `this.rates.set([])` và `this.rateHistory.set([])`, loại bỏ hoàn toàn nguy cơ hiển thị lịch sử của loại phòng A dưới tên loại phòng B.
- **Cô lập Luồng History:**
  - Tách riêng signals: `isLoadingHistory = signal(false)`, `historyErrorMessage = signal<string | null>(null)`.
  - Tách riêng phương thức `loadHistoryData()`: Không nuốt lỗi (không biến error thành empty array). Khi API history lỗi, ghi nhận vào `historyErrorMessage`, giữ `rateHistory` rỗng và hiển thị nút **"Thử lại tải lịch sử"**.
  - Người dùng có thể nhấn thử lại lịch sử mà không cần tải lại bảng giá đang áp dụng.
- **Kiểm thử liên quan:** Test 12 trong `rates.page.spec.ts` dùng Subject kiểm chứng chuyển A $\to$ B xóa sạch dữ liệu cũ ngay lập tức, response history của B bị lỗi được ghi nhận đúng vào `historyErrorMessage` (không thành empty success), và retry thành công nạp đúng history của B mà không re-fetch rates không cần thiết.

---

## 2. Kết quả Kiểm thử & Biên dịch Độc lập

1. **Targeted Frontend Vitest (`rates.page.spec.ts` & `rate.service.spec.ts`):**
   - Lệnh: `node ./node_modules/vitest/vitest.mjs run src/app/features/rates/rates.page.spec.ts src/app/core/services/rate.service.spec.ts`
   - Kết quả: **19/19 PASS** (16 tests component + 3 tests service, Exit code: 0).

2. **Full Frontend Vitest Suite:**
   - Lệnh: `node ./node_modules/vitest/vitest.mjs run`
   - Kết quả: **88/88 PASS** trên toàn bộ 7 test files (Exit code: 0).
     - `src/app/core/utils/date-time.util.spec.ts` (28 tests PASS)
     - `src/app/core/services/rate.service.spec.ts` (3 tests PASS)
     - `src/app/features/rates/rates.page.spec.ts` (16 tests PASS)
     - `src/app/features/policies/policies.page.spec.ts` (20 tests PASS)
     - `src/app/features/housekeeping/housekeeping.page.spec.ts` (14 tests PASS)
     - `src/app/app.spec.ts` (1 test PASS)
     - `src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts` (6 tests PASS)

3. **Frontend Production Build (`ng build`):**
   - Lệnh: `npm run build`
   - Kết quả: **PASS (Exit code 0)** — Chunk `rates-page` (38.55 kB) bundle thành công.

---

## 3. Danh sách Files đã cập nhật trong Round 2

1. [`frontend/src/app/features/rates/rates.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/rates/rates.page.ts):
   - Bỏ BasePrice heuristics trong form và modal.
   - Gắn snapshot `modalTargetRoomTypeId` / `modalTargetPropertyId` và race guards.
   - Xóa ngay dữ liệu cũ khi đổi roomType; tách `loadHistoryData()`, `isLoadingHistory`, `historyErrorMessage` và nút retry.
2. [`frontend/src/app/features/rates/rates.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/rates/rates.page.spec.ts):
   - Bổ sung 3 tests mới với RxJS `Subject` kiểm chứng cụ thể cho cả 3 findings: Test 4 (no fallback/submit block), Tests 9–11 & 13 (modal snapshot & context race guards), Test 12 (immediate clear & history error isolation/retry).

---

## 4. Trạng thái Bàn giao

- Đã bàn giao quyền điều khiển `writer: "none"`, `status: "Submitted"`.
- Sẵn sàng cho Codex review Round 2.
