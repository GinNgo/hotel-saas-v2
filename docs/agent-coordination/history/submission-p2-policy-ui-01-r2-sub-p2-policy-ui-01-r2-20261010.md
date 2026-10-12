# Submission: P2-POLICY-UI-01 (Round 2)

- **TaskId:** P2-POLICY-UI-01
- **Round:** 2
- **SubmissionId:** sub-p2-policy-ui-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T10:26:00+07:00
- **ConversationId:** e7fb1eb9-f36d-4a15-9916-5c917a5509c9

---

## 1. Tóm tắt giải quyết toàn bộ Findings từ Review Round 1

Toàn bộ 3 findings (P1, P1, P2) được Codex chỉ ra trong `review.md` đã được xử lý triệt để và kiểm chứng độc lập bằng bộ unit tests RxJS `Subject` chuyên sâu:

### Finding 1 (P1) — Revert Unauthorized Permission Fallback (Strict Contract Boundaries)
- **Backend:** Trong [`backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs), đã loại bỏ hoàn toàn fallback `SETTINGS` cho `PROPERTIES`. Handler đánh giá nghiêm ngặt đúng `requirement.FunctionCode` và `AlternativePermissions` theo authoritative `RoleId` từ database (Zero-Aggregation).
- **Frontend Service:** Trong [`frontend/src/app/core/services/token-storage.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/token-storage.service.ts), đã xóa bỏ nhánh fallback `functionCode === 'PROPERTIES' && code === 'SETTINGS'`.
- **Frontend Component:** Trong [`frontend/src/app/features/policies/policies.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/policies/policies.page.ts):
  - `canRead = computed(() => this.authService.hasPermission('PROPERTIES', 1));`
  - `canUpdate = computed(() => this.authService.hasPermission('PROPERTIES', 4));`
  - Đã xóa bỏ SuperAdmin UI bypass và `SETTINGS` fallback. Khi user không có quyền `PROPERTIES.Read`, component hiển thị empty state "Không có quyền truy cập", không gọi API và khóa toàn bộ thao tác.
- **Kiểm thử liên quan:** Test 13 trong `policies.page.spec.ts` chứng minh tài khoản chỉ có quyền `SETTINGS` bị chặn hoàn toàn cả đọc lẫn ghi (`canRead() === false`, `canUpdate() === false`, `getPolicies` và `updatePolicies` không bị gọi).

### Finding 2 (P1) — Loại bỏ nguy cơ ghi đè Policies giữa các chi nhánh (Branch Context & Race Hazard Protection)
- **Ràng buộc form với `loadedPropertyId`:** Thêm signal `loadedPropertyId = signal<string | null>(null);`. Form chỉ được coi là hợp lệ để lưu khi `loadedPropertyId() === this.propertyId()`.
- **Context Lifecycle & Latest-Request-Wins:**
  - Phương thức `handlePropertyContextChange(newPropId)` hủy các request in-flight (`loadSub?.unsubscribe()`, `saveSub?.unsubscribe()`), xóa `loadedPropertyId.set(null)`, reset form về mặc định và tải dữ liệu mới nếu có quyền.
  - Xử lý GET out-of-order: Request A về chậm hơn Request B sẽ bị hủy qua subscription hoặc bị drop qua guard `if (this.propertyId() !== requestedPropId) return;`. Form B không bao giờ bị ghi đè bởi response cũ từ Branch A.
- **Entry Guard chống Double-Submit & Cross-Branch Save:**
  - Ngay tại entry của `savePolicies()`:
    ```typescript
    if (
      this.isSaving() ||
      this.isLoading() ||
      !this.propertyId() ||
      this.loadedPropertyId() !== this.propertyId() ||
      !this.canUpdate()
    ) {
      return;
    }
    ```
  - Chặn double-submit khi request đang pending (`isSaving() === true`).
  - Chặn lưu form của Branch A sang Branch B (`loadedPropertyId !== propertyId`).
  - Chặn lưu khi `propertyId` là null hoặc đang loading.
- **Guard cho PUT Response:** Khi response PUT của Branch A trả về, nếu active branch đã đổi sang B trong lúc request in-flight, response sẽ bị bỏ qua, không mutate state Branch B và không hiển thị toast thành công sai ngữ cảnh.
- **Cleanup On Destroy:** `ngOnDestroy()` gọi `cancelPendingRequests()` giải phóng toàn bộ subscriptions.
- **Kiểm thử bằng Subject:** Tests 14–20 trong `policies.page.spec.ts` kiểm chứng toàn bộ các kịch bản race condition, out-of-order responses, context change và destroy.

### Finding 3 (P2) — Defaults theo Domain Entity Property.cs & Hoàn thiện Accessibility
- **Chuẩn hóa Default Check-In Time:** Căn chỉnh giá trị mặc định của `checkInTime` về `12:00` (khớp với entity [`backend/src/HotelSaas.Domain/Entities/Property.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Domain/Entities/Property.cs) line 77: `new TimeOnly(12, 0, 0)` và Quyết định D06).
- **Chặn lưu form mặc định:** Khi form chưa GET thành công từ API (`loadedPropertyId === null`), nút Lưu bị disable và `savePolicies()` từ chối xử lý (Test 12).
- **Accessibility Attributes:** Bổ sung đầy đủ `aria-label` và `title` cho toàn bộ các control: giờ check-in, check-out, bufferMinutes, maxHourlyHours, nút thêm phụ thu, checkbox kích hoạt, nút xóa quy tắc, select loại phụ thu, giờ từ/đến, cách tính và ô nhập mức phụ thu (% / VND).

---

## 2. Files thay đổi chi tiết

1. [`backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.WebApi/Authorization/PermissionAuthorizationHandler.cs):
   - Revert `SETTINGS` fallback, khôi phục contract authorization nghiêm ngặt cho `PROPERTIES`.
2. [`frontend/src/app/core/services/token-storage.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/token-storage.service.ts):
   - Revert `hasPermission` fallback từ `SETTINGS` sang `PROPERTIES`.
3. [`frontend/src/app/features/policies/policies.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/policies/policies.page.ts):
   - Thêm `loadedPropertyId`, latest-request-wins, guards tại entry `savePolicies()`, default 12:00, accessibility labels, cleanup `ngOnDestroy`.
4. [`frontend/src/app/features/policies/policies.page.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/policies/policies.page.spec.ts):
   - Mở rộng từ 11 lên 20 unit tests sử dụng RxJS `Subject`s kiểm thử race conditions, out-of-order responses, branch switch, context null, double submit guard, domain defaults và permission isolation.
5. [`frontend/src/app/app.spec.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/app.spec.ts):
   - Chuẩn hóa Vitest runner cho test suite toàn cục.

---

## 3. Kết quả kiểm thử độc lập & Exit Codes

1. **Policies Unit Test Suite (Vitest):**
   - Command: `node ./node_modules/vitest/vitest.mjs run src/app/features/policies/policies.page.spec.ts`
   - **Kết quả: 20/20 PASSED, Exit Code: 0** (Thời gian chạy: 1.03s).
   - Danh sách 20 tests:
     1. should create and load initial policies
     2. should reject bufferMinutes < 30
     3. should reject maxHourlyHours < 1 or > 24 per Decision D14
     4. should reject surcharge with toTime <= fromTime
     5. should reject surcharge with invalid percentage or flatAmount
     6. should detect overlapping surcharge intervals for the same SurchargeType
     7. should allow non-overlapping intervals for the same SurchargeType
     8. should allow adding and removing surcharges
     9. should save valid policies successfully and show toast
     10. should block saving when user only has Read permission
     11. should handle error response from backend gracefully
     12. should initialize form with domain defaults (12:00 check-in/out, 30min buffer, 12h maxHourly) and disallow save before GET succeeds
     13. should block SETTINGS-only permission from read and update without fallback
     14. should block saving when activePropertyId is null
     15. should prevent branch A late GET response from overwriting branch B (latest-request-wins)
     16. should drop branch A error if branch switched to B while GET pending
     17. should block saving branch B when form still holds branch A (mismatch between loadedPropertyId and propertyId)
     18. should block duplicate submit when savePolicies is already in progress (anti-double-submit entry guard)
     19. should drop pending PUT response if branch switched to B while save was in-flight
     20. should cancel in-flight requests and not update form on component destroy

2. **Frontend Full Vitest Suite (Toàn bộ 5 test files):**
   - Command: `node ./node_modules/vitest/vitest.mjs run`
   - **Kết quả: 69/69 PASSED, 5/5 files passed, Exit Code: 0** (Thời gian chạy: 1.89s).
     - `src/app/core/utils/date-time.util.spec.ts`: 28/28 PASSED
     - `src/app/features/policies/policies.page.spec.ts`: 20/20 PASSED
     - `src/app/features/housekeeping/housekeeping.page.spec.ts`: 14/14 PASSED
     - `src/app/shared/components/date-range-filter/date-range-filter.component.spec.ts`: 6/6 PASSED
     - `src/app/app.spec.ts`: 1/1 PASSED

3. **Backend Pricing & Application Tests:**
   - Command: `dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter FullyQualifiedName~Pricing --verbosity quiet`
   - **Kết quả: 25/25 PASSED, Exit Code: 0**.

4. **Backend WebApi Regression Suite:**
   - Command: `dotnet test backend/tests/HotelSaas.WebApi.Tests/HotelSaas.WebApi.Tests.csproj --verbosity quiet`
   - **Kết quả: 42/42 PASSED, Exit Code: 0**.

5. **Backend Solution Build:**
   - Command: `dotnet build backend/HotelSaas.slnx`
   - **Kết quả: 0 Errors, Exit Code: 0**.

---

## 4. Bàn giao & Giải phóng Lock

- Đã giải phóng writer lock: `writer: "none"`, `status: "Submitted"`.
- SubmissionId: `sub-p2-policy-ui-01-r2-20261010`.
- Sẵn sàng cho Codex thực hiện review độc lập vòng 2.
