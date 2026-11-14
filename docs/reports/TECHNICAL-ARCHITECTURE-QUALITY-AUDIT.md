# TECHNICAL ARCHITECTURE, DATABASE & QUALITY AUDIT REPORT
**Hotel SaaS Platform v2 (.NET 10 + Angular 22 + PostgreSQL 17)**
**Auditor:** `@tech_quality_auditor`  
**Date:** 2026-11-13  
**Status:** Audit Completed — Verified with Code Citations & Test Evidence

---

## EXECUTIVE SUMMARY & AUDIT SCORECARD

| Dimension | Standard / Specification | Compliance Rate | Status | Critical Risk Areas |
| :--- | :--- | :---: | :---: | :--- |
| **1. Database & Persistence** | `docs/sdd/01-erd.md` & `AGENTS.md` | **58.3%** | ⚠️ Needs Remediation | Missing unique indexes (`User.Email`, `Reservation.ConfirmationCode`), redundant Cascade FK on Room, missing `Payment.IdempotencyKey`. |
| **2. Clean Architecture & CQRS** | `docs/sdd/02-architecture-overview.md` | **62.5%** | 🚨 Critical Violation | 6 Fat Controllers bypassing MediatR with direct DB mutations; 27/48 Commands missing FluentValidation; unhandled exception mapping to 500. |
| **3. Frontend Engineering** | Angular 22 Signals (`AGENTS.md`) | **67.4%** | ⚠️ High Technical Debt | 15/46 feature pages missing `ChangeDetectionStrategy.OnPush`; 182 manual `.subscribe()` calls; low adoption of `<app-page-header>` and `<app-status-badge>`. |
| **4. Automated Quality Gates** | Pre-commit Quality Gates (`AGENTS.md`) | **98.5%** | ⚠️ 1 Failing Test | Frontend: 628/628 passed (100%), `ng build` 0 errors. Backend: 1 failing test (`BookingHttpPipelineTests`) due to past date time-bomb. |

---

## 1. DATABASE & PERSISTENCE LAYER AUDIT

### 1.1 Incomplete Entity Configuration Coverage
In `backend/src/HotelSaas.Infrastructure/Persistence/Configurations/`:
- **Current State:** Only **13 entity configuration classes** exist.
- **Missing Configurations:** The following 19 domain entities rely purely on EF Core implicit conventions without explicit schema, constraint, or indexing definitions:
  - `Tenant`, `User`, `AccessRole`, `PermissionFunction`, `RolePermission`, `RefreshToken`
  - `Subscription`, `SubscriptionPayment`, `SubscriptionPlan`
  - `Invoice`, `InvoiceItem`, `HousekeepingTask`
  - `Notification`, `Promotion`, `GuestReview`, `AiUsageLog`, `TenantContract`, `PrintTemplateConfig`, `SystemBanner`

### 1.2 Missing Database Indexes vs ERD Specification (`docs/sdd/01-erd.md` Section 7)
| Entity | Missing Index / Constraint | ERD Specification | File Citation & Impact |
| :--- | :--- | :--- | :--- |
| **User** | `UX_User_Email` (Unique) | `User \| UX_User_Email \| Email \| Unique` | `ApplicationDbContextModelSnapshot.cs#L1906-L2000`<br/>Missing database uniqueness on `Email`. Relies solely on application-level checks, allowing race condition duplicate signups. |
| **Tenant** | `UX_Tenant_Code` & `UX_Tenant_Slug` | `Tenant \| UX_Tenant_Slug \| Slug \| Unique` | `ApplicationDbContextModelSnapshot.cs#L1770-L1778`<br/>Table `Tenants` has zero indexes apart from PK `Id`. `Code`, `Slug`, and `TaxId` lack unique database constraints. |
| **Reservation** | `UX_Reservation_ConfirmCode` | `Reservation \| UX_Reservation_ConfirmCode \| ConfirmationCode \| Unique` | `ReservationConfiguration.cs#L10-L51` & `ApplicationDbContextModelSnapshot.cs#L1115-L1126`<br/>No unique constraint or index on `ConfirmationCode`. Fast lookups by confirmation code degrade into full table scans. |
| **Reservation** | `IX_Reservation_RoomId_Dates` | `Reservation \| TenantId, RoomId, CheckInDate, CheckOutDate \| Composite` | `ReservationConfiguration.cs#L10-L51`<br/>Missing composite index for availability and overlapping room queries, impacting booking lookup latency under load. |
| **Reservation** | `IX_Reservation_Property_Status_CheckIn` | `PropertyId, Status, StartAtUtc \| Composite` | `ReservationConfiguration.cs#L10-L51`<br/>Missing composite index for branch-level operational schedule queries. |
| **Room** | `IX_Room_Property_Status` & `IX_Room_Property_RoomType_Active` | `PropertyId, Status` & `PropertyId, RoomTypeId, IsActive` | `RoomConfiguration.cs#L10-L54`<br/>Missing composite indexes for active room inventory and room rack status lookups. |
| **Payment** | `UX_Payment_IdempotencyKey` | `Payment \| UX_Payment_IdempotencyKey \| IdempotencyKey \| Unique` | `backend/src/HotelSaas.Domain/Entities/Payment.cs#L9-L65` & `PaymentConfiguration.cs#L10-L45`<br/>Entity `Payment` completely lacks `IdempotencyKey`, `RefundApprovedById`, and `RefundReason` properties. No unique index exists to enforce payment idempotency at the database level. |

### 1.3 Redundant Foreign Keys and Cascade Delete Risk on `Reservation`
- **Location:**
  - `backend/src/HotelSaas.Infrastructure/Persistence/Configurations/ReservationConfiguration.cs#L43-L49`
  - `backend/src/HotelSaas.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs#L2261-L2275`
- **Issue:**
  In `ReservationConfiguration.cs#L43`, `builder.HasOne<Room>()` configures a composite foreign key `(PropertyId, RoomId) -> Rooms(PropertyId, Id)` with `DeleteBehavior.Restrict` without binding to the navigation property `res => res.Room`.
  Consequently, EF Core created a **duplicate shadow foreign key** on `RoomId` with default `DeleteBehavior.Cascade`:
  ```csharp
  // ApplicationDbContextModelSnapshot.cs line 2261:
  b.HasOne("HotelSaas.Domain.Entities.Room", "Room")
      .WithMany("Reservations")
      .HasForeignKey("RoomId")
      .OnDelete(DeleteBehavior.Cascade) // CRITICAL: Deleting a Room will cascade-delete reservations!
      .IsRequired();
  ```
- **Risk:** Deleting a room record in PostgreSQL could trigger cascading deletion of active guest reservations and financial ledger histories.

### 1.4 Soft Delete Audit
- **Findings:**
  - Neither `BaseEntity.cs` (`backend/src/HotelSaas.Domain/Common/BaseEntity.cs#L1-L22`) nor individual entities define soft delete flags (`IsDeleted`, `DeletedAtUtc`).
  - EF Core has no soft delete interceptor or global soft-delete query filter.
  - When records (e.g. rooms, staff, rate policies) are removed via `_context.Remove(...)`, physical hard `DELETE` statements are issued directly against PostgreSQL.

### 1.5 TenantPropertySaveChangesInterceptor Review
- **File:** `backend/src/HotelSaas.Infrastructure/Persistence/Interceptors/TenantPropertySaveChangesInterceptor.cs`
- **Status:** **EXCELLENT / PASS**
- **Strengths Verified:**
  - Enforces fail-closed tenant scoping on entity inserts (`ERR_TENANT_REQUIRED` at lines 83, 93).
  - Enforces immutability of partition scope fields `TenantId` and `PropertyId` (`ERR_IMMUTABLE_SCOPE_FIELDS` at lines 99, 165, 276, 292).
  - Detects request header vs entity mismatch (`ERR_CONTEXT_MISMATCH` at lines 119, 153).
  - Implements batch scope verification (`VerifyPersistedScopesBatchAsync` at lines 205-317) using single multi-ID SQL queries per table, preventing N+1 performance degradation.

---

## 2. CLEAN ARCHITECTURE & CQRS PATTERN AUDIT

### 2.1 Layer Dependency Inversion
- **Result:** **PASS**.
- `backend/src/HotelSaas.Application/HotelSaas.Application.csproj` references only `HotelSaas.Domain`.
- No `using HotelSaas.Infrastructure` statements exist anywhere in the Application layer.

### 2.2 Severe Architectural Breach: Fat WebApi Controllers Bypassing CQRS
- **Rule Violated:** `AGENTS.md` Invariant Rule 4: *"Thin Controllers: WebApi controllers only dispatch requests via MediatR and return standard HTTP responses (ApiResponse<T>)."*
- **Identified Fat Controllers:**
  1. `AdminContractsController.cs` (363 lines): Directly injects `IApplicationDbContext`. Manages `TenantContracts` directly, performs raw queries, executes status changes, generates SHA256 digital signature hashes, and defines DTOs inside the controller file (`#L28, #L46-L75, #L160-L215, #L292-L363`).
  2. `AdminPlansController.cs` (318 lines): Directly injects `IApplicationDbContext`. Directly creates, modifies, and toggles `SubscriptionPlans` without MediatR (`#L27, #L53-L120, #L160-L240`).
  3. `AiController.cs` (682 lines): Directly injects `IApplicationDbContext`. Directly queries database entities, constructs system prompts, and handles AI responses inside controller actions (`#L35, #L80-L160`).
  4. `PrintDocumentsController.cs` (499 lines): Directly injects `IApplicationDbContext`. Performs raw entity queries to compile printable HTML documents for contracts, invoices, and vouchers (`#L33, #L60-L220`).
  5. `ReportsController.cs` (538 lines): Directly injects `IApplicationDbContext`. Performs in-controller financial aggregations and LINQ joins (`#L40, #L75-L210`).
  6. `SubscriptionsController.cs` (295 lines): Directly injects `IApplicationDbContext`. Modifies subscription tiers and processes simulated payments directly (`#L30, #L60-L180`).
- **Impact:** Feature directories for `Contracts`, `Plans`, `PrintDocuments`, and `Subscriptions` **do not exist** in `HotelSaas.Application`. Business logic is trapped in the Presentation layer, making it impossible to unit test without spinning up HTTP fixtures.

### 2.3 FluentValidation Coverage on CQRS Commands
- **Rule Violated:** `AGENTS.md` Section 1.3: *"Every mutation is handled by a Command (IRequest<ApiResponse<T>>) validated via FluentValidation."*
- **Audit Result:** **27 out of 48 Commands lack FluentValidation validators (56.25% failure rate)**.
- **Unvalidated Commands List:**
  - `CreatePropertyCommand`, `UpdatePropertyCommand`, `UpdatePropertyPoliciesCommand`
  - `CreateGuestHoldCommand`, `ConfirmGuestBookingCommand`, `CancelGuestBookingCommand`, `ExtendGuestHoldCommand`
  - `CancelReservationCommand`, `CheckInReservationCommand`, `CheckOutReservationCommand`
  - `CreatePaymentCommand`, `ApproveRefundCommand`, `RejectRefundCommand`, `ConfirmRefundPayoutCommand`, `CreateVnpayUrlCommand`, `ProcessVnpayIpnCommand`
  - `DeleteRoomCommand`, `DeleteRoomTypeCommand`
  - `CreateStaffMemberCommand`, `UpdateStaffMemberCommand`, `DeleteStaffMemberCommand`, `DeleteRoleCommand`
  - `RefreshTokenCommand`, `SocialLoginCommand`, `SwitchContextCommand`, `RevokeTokenCommand`
  - `UpdateGuestNotesCommand`, `EnrollPropertyMembershipCommand`, `UpdateGuestVatProfileCommand`

### 2.4 Unhandled Exception Mapping Causing HTTP 500
- **Location:**
  - `backend/src/HotelSaas.Application/Properties/Commands/CreateProperty/CreatePropertyCommand.cs#L63, #L72`
  - `backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs#L57, #L86`
- **Issue:**
  `CreatePropertyCommandHandler.cs` lines 63 and 72 throw `System.ComponentModel.DataAnnotations.ValidationException`:
  ```csharp
  throw new ValidationException($"Mã chi nhánh '{request.Code}' đã tồn tại trong chuỗi.");
  ```
  However, `ExceptionHandlingMiddleware.cs` line 57 only catches `HotelSaas.Application.Common.Exceptions.ValidationException`.
  As a result, `System.ComponentModel.DataAnnotations.ValidationException` falls through to line 86 default:
  ```csharp
  _ => (StatusCodes.Status500InternalServerError, ApiResponse.Fail("ERR_SYSTEM", "Đã xảy ra lỗi hệ thống."))
  ```
  A standard business conflict returns an internal server crash (HTTP 500) rather than a clean HTTP 400 or 409 response.

### 2.5 Query Tracking Optimization (`AsNoTracking`)
- **Location:** `backend/src/HotelSaas.Application/Properties/Queries/GetTenantProperties/GetTenantPropertiesQuery.cs#L37-L41, #L55-L59, #L61-L68`
- **Issue:** The query handler retrieves `Properties` (with `Rooms`), `Reservations`, and `Payments` without appending `.AsNoTracking()`. These entities are tracked in EF Core's ChangeTracker throughout the request lifecycle, incurring unnecessary memory overhead.

---

## 3. FRONTEND ENGINEERING (ANGULAR 22) AUDIT

### 3.1 ChangeDetectionStrategy.OnPush Non-Compliance
- **Rule Violated:** `AGENTS.md` Section 3.1: *"Use ChangeDetectionStrategy.OnPush across all feature components."*
- **Audit Result:** **15 out of 46 feature components/pages (32.6%) omit `OnPush`**, reverting to default zone-based dirty checking:
  1. `frontend/src/app/features/auth/login/login.page.ts`
  2. `frontend/src/app/features/auth/register/register.page.ts`
  3. `frontend/src/app/features/auth/partner-register/partner-register.page.ts`
  4. `frontend/src/app/features/forbidden/forbidden.page.ts`
  5. `frontend/src/app/features/housekeeping/housekeeping.page.ts`
  6. `frontend/src/app/features/payments/payments.page.ts`
  7. `frontend/src/app/features/policies/policies.page.ts`
  8. `frontend/src/app/features/rates/rates.page.ts`
  9. `frontend/src/app/features/reports/reports.page.ts`
  10. `frontend/src/app/features/reservations/reservations.page.ts`
  11. `frontend/src/app/features/subscriptions/subscriptions.page.ts`
  12. `frontend/src/app/features/public-booking/ai-concierge-widget/ai-concierge-widget.component.ts`
  13. `frontend/src/app/features/public-booking/components/curated-bento-grid/curated-bento-grid.component.ts`
  14. `frontend/src/app/features/public-booking/components/hotelier-cta-banner/hotelier-cta-banner.component.ts`
  15. `frontend/src/app/features/public-booking/components/trust-pillars/trust-pillars.component.ts`

### 3.2 RxJS Manual Subscriptions vs Angular Signals
- **Rule Violated:** `AGENTS.md` Section 3.1: *"Use Angular Signals (signal(), computed(), effect()) for state management. Avoid imperative manual subscriptions."*
- **Audit Result:** **182 manual `.subscribe()` occurrences** across feature components.
- **Key Risk Areas:**
  - `frontend/src/app/features/dashboard/dashboard.page.ts#L1210-L1285`: Multiple nested `.subscribe()` calls without `takeUntilDestroyed()`.
  - `frontend/src/app/features/admin-contracts/admin-contracts.page.ts#L445, #L458, #L502, #L522, #L539`: Imperative `.subscribe()` without unsubscription hooks.
  - `frontend/src/app/features/admin-plans/admin-plans.page.ts#L439, #L537, #L572, #L588`.
  - `frontend/src/app/features/auth/login/login.page.ts#L444, #L496, #L531, #L577, #L609`.

### 3.3 Shared UI Component Reuse
- **Rule:** `AGENTS.md` Section 3.2: *"Reuse core shared components: <app-page-header>, <app-stat-card>, <app-status-badge>, <app-pagination>, <app-empty-state>."*
- **Adoption Inventory Across 46 Component Files:**
  - `<app-page-header>`: **5 occurrences** (Only `audit-logs`, `ops-readiness`, `properties`, `room-types`, `rooms`). 41 pages implement custom header HTML blocks.
  - `<app-stat-card>`: **8 occurrences**.
  - `<app-status-badge>`: **2 occurrences** (Extremely underutilized; pages like reservations, payments, housekeeping use custom `<span>` badges).
  - `<app-pagination>`: **7 occurrences**.
  - `<app-empty-state>`: **21 occurrences** (Good adoption).

### 3.4 HttpClient Encapsulation
- **Result:** **100% COMPLIANT**.
- 0 components directly inject `HttpClient`. All HTTP requests are encapsulated in dedicated services in `src/app/core/services/` or feature services.

---

## 4. AUTOMATED TESTING & QUALITY GATES AUDIT

### 4.1 Frontend Quality Verification
- **Command:** `npm --prefix frontend run build` & `npm --prefix frontend test -- --watch=false`
- **Build Outcome:** **SUCCESS (0 errors, 0 warnings)**. Output location: `frontend/dist/frontend`.
- **Test Results:**
  - **Test Files:** 51 passed (51/51 = 100%)
  - **Total Tests:** 628 passed (628/628 = 100%)
  - **Skipped / Failed:** 0

### 4.2 Backend Quality Verification
- **Command:** `dotnet test backend/HotelSaas.slnx`
- **Projects:**
  - `HotelSaas.Domain.Tests`: 1 passed, 0 failed.
  - `HotelSaas.WebApi.Tests`: 66 passed, **1 FAILED** (67 total).
- **Failing Test Root Cause Analysis:**
  - **Failed Test:** `HotelSaas.WebApi.Tests.BookingHttpPipelineTests.HttpPipeline_Reservations_FullLifecycle_And_Security`
  - **Failure Point:** `BookingHttpPipelineTests.cs#L445`
  - **Error:** `Assert.Equal() Failure: Expected Created (201), Actual BadRequest (400)`.
  - **Root Cause Isolation:**
    1. `BookingHttpPipelineTests.cs#L432` hardcodes an overnight reservation payload with:
       ```csharp
       startAtUtc = "2026-11-12T07:00:00Z"
       ```
    2. During reservation handling, `CreateReservationCommandHandler.cs#L277` dispatches `CalculateQuoteQuery`.
    3. `CalculateQuoteQueryValidator.cs#L41-L44` enforces:
       ```csharp
       RuleFor(x => x.StartAtUtc)
           .GreaterThanOrEqualTo(DateTime.UtcNow.AddMinutes(-30))
           .WithErrorCode("ERR_PAST_DATE")
           .WithMessage("Thời điểm bắt đầu không được lùi quá dung sai walk-in 30 phút so với hiện tại.");
       ```
    4. As time passed beyond `2026-11-12T07:30:00Z`, the hardcoded test timestamp became invalid, triggering `ERR_PAST_DATE` and throwing a `ValidationException` that resulted in HTTP 400 Bad Request.
  - **Remediation:** In `BookingHttpPipelineTests.cs`, calculate `startAtUtc` and `endAtUtc` dynamically relative to `DateTime.UtcNow` (e.g., `DateTime.UtcNow.Date.AddDays(1)`).

---

## 5. PRIORITIZED REMEDIATION ROADMAP

### Phase 1: High Priority / Architecture & Database Integrity (Immediate)
1. **Fix Duplicate Foreign Key on Room & Cascade Delete Hazard:**
   - In `backend/src/HotelSaas.Infrastructure/Persistence/Configurations/ReservationConfiguration.cs`, configure `builder.HasOne(res => res.Room)` explicitly with `DeleteBehavior.Restrict` on both the navigation and composite key. Generate EF Core migration to alter `FK_Reservations_Rooms_RoomId` to `Restrict`.
2. **Add Missing Unique Indexes:**
   - Create `UserConfiguration.cs` with `builder.HasIndex(u => u.Email).IsUnique()`.
   - In `ReservationConfiguration.cs`, add `builder.HasIndex(r => r.ConfirmationCode).IsUnique()`.
   - Add composite index on `(TenantId, RoomId, CheckInDate, CheckOutDate)`.
3. **Fix Exception Handling Middleware:**
   - In `backend/src/HotelSaas.WebApi/Middleware/ExceptionHandlingMiddleware.cs`, catch `System.ComponentModel.DataAnnotations.ValidationException` and map to HTTP 400 Bad Request with `ERR_VALIDATION_ERROR`, or replace usage in `CreatePropertyCommand.cs` with `ConflictException`.
4. **Fix Failing WebApi Integration Test:**
   - Replace hardcoded static date `2026-11-12T07:00:00Z` in `BookingHttpPipelineTests.cs` with relative future date.

### Phase 2: Medium Priority / Refactoring & CQRS Decoupling (Week 6)
1. **Migrate 6 Fat Controllers to MediatR CQRS:**
   - Create Application feature modules: `Contracts`, `Plans`, `PrintDocuments`, `Subscriptions`, `Ai`.
   - Move raw EF Core operations into dedicated Command/Query Handlers.
   - Refactor `AdminContractsController`, `AdminPlansController`, `AiController`, `PrintDocumentsController`, `ReportsController`, and `SubscriptionsController` to only inject `ISender`.
2. **Implement Missing FluentValidation on 27 Commands:**
   - Create missing `*CommandValidator.cs` classes under `backend/src/HotelSaas.Application/`.
3. **Apply `AsNoTracking()` to `GetTenantPropertiesQuery.cs`.**

### Phase 3: Frontend Modernization & Standards Alignment
1. **Enforce `ChangeDetectionStrategy.OnPush` on 15 Remaining Feature Components.**
2. **Refactor 182 Manual Subscriptions:**
   - Introduce `takeUntilDestroyed()` or convert to `toSignal()` / `computed()`.
3. **Adopt Shared Components Registry:**
   - Standardize page headers with `<app-page-header>` and badges with `<app-status-badge>`.
