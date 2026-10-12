# Submission: P5-GUEST-SEARCH-REUSE-01 (Round 3)

- **TaskId:** P5-GUEST-SEARCH-REUSE-01
- **Round:** 3
- **SubmissionId:** sub-p5-guest-search-reuse-01-r3-20261010
- **ReviewedSubmissionId:** sub-p5-guest-search-reuse-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T23:06:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Khắc Phục Ý Kiến Đánh Giá Round 2 (Resolution of Review Findings)

Đáp ứng đầy đủ 2 phát hiện của Reviewer (Codex) trong văn bản đánh giá Round 2 tại [`docs/agent-coordination/review.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/review.md), Antigravity đã hoàn thiện toàn diện bản cập nhật Round 3 như sau:

---

### 1.1. Khắc phục Finding 1 ([P1] — Xóa/Invalidate Availability Khi Context Đổi & Chặn Tuyệt Đối Chọn Card Stale)
1. **Xóa và Invalidate Availability đồng bộ khi context thay đổi (`resetSelectionAndAvailability`):**
   - Triển khai phương thức tập trung `resetSelectionAndAvailability()` trong [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts):
     ```typescript
     private resetSelectionAndAvailability(): void {
       this.selectedRoomTypeId.set(null);
       this.selectedRoomType.set(null);
       this.currentQuote.set(null);
       this.availabilityList.set([]);
       this.availabilityRequestId++; // Invalidate pending availability requests
       this.quoteRequestId++;        // Invalidate pending quote requests
       this.availabilitySub?.unsubscribe();
       this.quoteSub?.unsubscribe();
     }
     ```
   - Gọi đồng bộ tại mọi điểm thay đổi ngữ cảnh:
     - Khi chuyển cơ sở lưu trú qua dropdown (`onPropertyChange`).
     - Khi kết quả tìm kiếm chuyển sang cơ sở mới (`props.length > 0`) hoặc khi tìm kiếm rỗng (`props.length === 0`).
     - Khi thay đổi ngày nhận/trả phòng hoặc hình thức thuê (`onSearchCriteriaChange`).
   - Nhờ đó, danh sách card phòng của cơ sở cũ lập tức bị xóa sạch (`availabilityList.set([])`), không còn hiển thị trên giao diện trong lúc cơ sở mới đang pending hoặc gặp lỗi.
2. **Kiểm tra xuất xứ phòng (Provenance Verification) trong `selectRoomType`:**
   - Trong `selectRoomType(rt)`: Bổ sung guard xác thực:
     ```typescript
     if (!slug || !selectedProp || selectedProp.slug !== slug) return;
     if (!this.availabilityList().some(item => item.roomTypeId === rt.roomTypeId)) return;
     ```
     Nếu card phòng không thuộc danh sách phòng khả dụng hiện hành của cơ sở đang chọn, hành vi chọn bị **từ chối ngay lập tức**.
3. **Xác thực xuất xứ phòng trong `submitHold()`:**
   - Trong `submitHold()`, thêm điều kiện kiểm tra:
     `if (selectedProp.slug !== slug || !this.availabilityList().some(item => item.roomTypeId === selectedRoom.roomTypeId)) return;`
     Bảo đảm tuyệt đối không thể gửi request giữ phòng với loại phòng của cơ sở cũ.
4. **Bổ sung Unit Tests tương ứng trong [`public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts):**
   - `should immediately clear availabilityList and reject selectRoomType for Card A while Property B is pending`: Kiểm tra khi chuyển từ A sang B, kho phòng A bị xóa lập tức; người dùng click card A bị từ chối, selection giữ nguyên `null`.
   - `should clear availability and discard stale response when search criteria changes without manual search`: Kiểm tra khi đổi ngày lưu trú, danh sách phòng bị xóa ngay lập tức và response cũ trả về sau đó bị discard.

---

### 1.2. Khắc phục Finding 2 ([P2] — Bỏ Immediate Input Bypass, Thống Nhất 1 Pipeline & Quản Lý Vòng Đời Subscription)
1. **Loại bỏ sự kiện `(input)` trực tiếp khỏi Template HTML:**
   - Đã xóa hoàn toàn `(input)="onPropertySearchInput()"` khỏi thẻ `<input id="propertySearchInput">`.
   - Toàn bộ luồng gõ phím của người dùng đi qua **duy nhất một luồng** Reactive Form Control `[formControl]="propertySearchControl"` kết hợp `valueChanges.pipe(debounceTime(300), distinctUntilChanged())`.
   - Nút xóa nhanh `clearPropertySearch()` sử dụng `this.propertySearchControl.setValue('', { emitEvent: false })` để chỉ kích hoạt đúng 1 lần tải danh sách đầy đủ, không gây trùng lặp request.
2. **Quản lý vòng đời và Hủy các Subscriptions HTTP:**
   - Bổ sung các biến quản lý subscription: `propertiesSub`, `availabilitySub`, `quoteSub`, `holdSub`.
   - Mọi request HTTP trước khi khởi chạy đều chủ động hủy (`unsubscribe()`) request trước đó nếu còn đang bay dở dang.
   - Khi component bị hủy (`ngOnDestroy()`), toàn bộ subscriptions bao gồm cả subscription lắng nghe tìm kiếm và các HTTP subscriptions đều được hủy bỏ sạch sẽ, bảo đảm các response trả về sau khi component unmount không cập nhật state signals.
3. **Kiểm thử với Fake Timers và DOM Input thực tế:**
   - Bổ sung test case `should debounce input changes by 300ms using fake timers and avoid duplicate requests on clear or destroy` trong `public-booking.page.spec.ts`:
     - Sử dụng `vi.useFakeTimers()`: Gõ 3 ký tự liên tiếp cách nhau 100ms chỉ phát sinh đúng 1 request sau 300ms.
     - Kiểm tra `clearPropertySearch()` không duplicate request.
     - Kiểm tra `ngOnDestroy()` hủy subscriptions, response trả về muộn không làm thay đổi state.

---

## 2. Minh Chứng Kiểm Thử Tái Lập & File Logs Thực Tế (Verifiable Test Evidence)

### 2.1. Backend Tests (100% PASS - 65/65 tests)
- **Lệnh thực thi:**
  ```powershell
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~VietnameseTextNormalizerTests|FullyQualifiedName~GetPublicPropertiesQueryTests"
  ```
- **Log thực tế lưu tại:** [`docs/agent-coordination/evidence/p5-guest-search-backend.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/p5-guest-search-backend.log)
- **Trích đoạn kết quả:**
  ```text
  Passed!  - Failed: 0, Passed: 65, Skipped: 0, Total: 65, Duration: 17 s - HotelSaas.Application.Tests.dll (net10.0)
  Exit Code: 0
  ```
- **Phân bổ:**
  - `VietnameseTextNormalizerTests`: **47 tests** (42 tests FormD/FormC/đ/Đ/accents/casing + 5 tests `MatchesNormalized`).
  - `GetPublicPropertiesQueryTests`: **18 tests** (Name diacritics/casing, Address, City, Blank search, Inactive exclusion trên real PostgreSQL schema).

### 2.2. Frontend Tests (100% PASS - 18/18 feature tests, 156/156 full suite)
- **Lệnh thực thi feature tests:**
  ```powershell
  node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts
  ```
- **Log thực tế lưu tại:** [`docs/agent-coordination/evidence/p5-guest-search-frontend.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/p5-guest-search-frontend.log)
- **Trích đoạn kết quả:**
  ```text
  RUN  v5.0.3 C:/Dev/hotel-saas-v2/frontend
  ✓ src/app/features/public-booking/public-booking.page.spec.ts (18 tests) 49ms

  Test Files  1 passed (1)
       Tests  18 passed (18)
    Duration  1.22s
  Exit Code: 0
  ```
- **Lệnh thực thi full suite frontend:**
  ```powershell
  node ./node_modules/vitest/vitest.mjs run
  ```
- **Trích đoạn kết quả:**
  ```text
  Test Files  11 passed (11)
       Tests  156 passed (156)
    Duration  3.76s
  Exit Code: 0
  ```

---

## 3. Danh Mục Tệp Thay Đổi (Touched Files Manifest)

| Tệp | Hành động | Mục đích |
|---|---|---|
| [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts) | Chỉnh sửa | Bỏ `(input)` bypass, thống nhất pipeline debounced 300ms, thêm `resetSelectionAndAvailability()`, provenance guard và hủy subscriptions HTTP trong `ngOnDestroy` |
| [`frontend/src/app/features/public-booking/public-booking.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/public-booking.page.spec.ts) | Chỉnh sửa | Bổ sung 3 tests cho Card A provenance rejection, criteria change invalidation, và fake timers debounce/cancellation |
| [`docs/agent-coordination/evidence/p5-guest-search-backend.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/p5-guest-search-backend.log) | Tạo mới | Log stdout/stderr thực tế của backend test suite (65 tests PASS) |
| [`docs/agent-coordination/evidence/p5-guest-search-frontend.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/p5-guest-search-frontend.log) | Tạo mới | Log stdout/stderr thực tế của frontend Vitest suite (18 tests PASS) |
| [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) | Cập nhật | Báo cáo chi tiết khắc phục Round 2 và trích dẫn file log evidence |
| [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) | Cập nhật | Chuyển sang `Submitted`, round 3, release writer lock về `none` |

---

## 4. Bàn Giao & Đề Xuất Tiếp Theo (Handoff & Next Steps)

- Lát cắt **P5-GUEST-SEARCH-REUSE-01 (Round 3)** đã giải quyết triệt để toàn bộ phát hiện của Reviewer (Codex).
- Writer lock được giải phóng về `none` trong `task.json`.
- Standing daemons duy trì trực chiến để đón nhận đánh giá tiếp theo.
