# Project: Hotel SaaS Platform v2 — Feature Implementation

## Architecture

### Backend (.NET 10 Clean Architecture)
```
HotelSaas.Domain         → Entities, Enums, Interfaces (zero dependencies)
HotelSaas.Application    → CQRS Commands/Queries, MediatR, FluentValidation, Service Interfaces
HotelSaas.Infrastructure → EF Core, DbContext, Services, External API Clients
HotelSaas.WebApi         → Controllers, Middleware, Authorization
```

### Frontend (Angular 22)
```
src/app/core/       → Services, Guards, Interceptors, Models
src/app/shared/     → Reusable UI Components, Pipes
src/app/features/   → Feature Modules (lazy-loaded standalone components)
src/app/layouts/    → Admin, Auth, Guest layouts
```

### Multi-Tenant
- `ITenantScopedEntity` (TenantId) / `IPropertyScopedEntity` (TenantId + PropertyId)
- EF Core Global Query Filters (auto-filter by tenant/property)
- `TenantPropertySaveChangesInterceptor` (254 lines, auto-assign + validate scopes)
- `TenantPropertyContextMiddleware` (338 lines, 4-tier endpoint classification)
- Fail-closed: missing context → reject

### Auth
- JWT (HMAC-SHA256), dual claim aliases (tenantId/tid, propertyId/pid)
- RBAC via bitmask ActionMask on RolePermission
- Database-verified permissions per request

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1A-01 | VNPay Payment URL Creation | Build VNPay payment URL with params & HMAC-SHA512 | M2 | SDD-10, reference |
| F1A-02 | HMAC-SHA512 Signature | Canonical payload signing & constant-time verification | M2 | reference |
| F1A-03 | IPN Webhook Endpoint | GET /api/payments/vnpay/ipn with signature verification | M2 | SDD-10, reference |
| F1A-04 | Idempotency Key | Add IdempotencyKey to Payment entity + IPN idempotency | M1 (schema) + M2 (logic) | reference |
| F1A-05 | Return URL Handling | Frontend VNPay return page | M2 | reference |
| F1A-06 | VNPay Response Codes | Map 11 response codes to payment status transitions | M2 | SDD-10 |
| F1A-07 | Payment Status Transitions | Pending→Completed/Failed/Expired FSM | M2 | SDD-10 |
| F1A-08 | VNPay Configuration | VnpaySettings in appsettings.json | M2 | reference |
| F1A-09 | Subscription Tier Guard | VNPay QR/ATM → Pro+, International → Enterprise | M2 | SDD-10 |
| F1A-10 | SignalR Payment Notification | NewPayment event broadcast | M2 | SDD-06 |
| F1A-11 | Reservation Status Auto-Update | Confirm reservation on payment success | M2 | reference |
| F1A-12 | Amount Validation | Verify vnp_Amount/100 matches Payment.Amount | M2 | reference |
| F1B-01 | SocialIdentity Entity | New entity: Provider, ProviderSubject, ProviderEmail | M1 (schema) + M3 (logic) | reference V38 |
| F1B-02 | SocialProvider Enum | Google=1, Facebook=2 | M1 | reference |
| F1B-03 | Google OAuth2 Verifier | Verify Google ID Token (GoogleJsonWebSignature) | M3 | reference |
| F1B-04 | Facebook OAuth2 Verifier | Verify FB token via Graph API v26.0 debug_token + /me | M3 | reference |
| F1B-05 | Social Login Command | CQRS command for social login → JWT issuance | M3 | reference |
| F1B-06 | Social Account Linking | Link/unlink social accounts to existing users | M3 | reference |
| F1B-07 | Social Login Frontend (Google) | Google Sign-In button integration | M3 | reference |
| F1B-08 | Social Login Frontend (Facebook) | Facebook Login button integration | M3 | reference |
| F1B-09 | Social User Auto-Provisioning | Create user on first social login | M3 | reference |
| F1B-10 | Social Config Settings | GoogleClientId, FacebookAppId/Secret in config | M3 | reference |
| F1B-11 | Password & Social Auth Separation | Users can have password-only, social-only, or both | M3 | reference V64 |
| F2-01 | AI Pricing Suggestion Endpoint | GET /api/ai/pricing/suggest/{roomTypeId} | M4 | SDD-06 |
| F2-02 | AI Pricing Apply Endpoint | POST /api/ai/pricing/apply | M4 | SDD-06 |
| F2-03 | Pricing Factors Service | Gather occupancy, seasonality, demand, day-of-week | M4 | survey |
| F2-04 | AI Model Integration | Gemini API call with pricing context | M4 | survey |
| F2-05 | Pricing Calendar API | 30-day price projection with AI overlay | M4 | SDD-06 |
| F2-06 | Season Management | CRUD for seasons with date ranges & multipliers | M4 | SDD-06 |
| F2-07 | AI Usage Logging | Log to AiUsageLog with scope="pricing" | M4 | survey |
| F2-08 | AI Usage Quota Enforcement | 500/month Enterprise limit, 429 on exceed | M4 | survey |
| F2-09 | Dynamic Price Override | Date-range price override, prevent overlap | M4 | SDD-06 |
| F2-10 | Price History & Audit | Rate change history via RoomTypeRateAudit | M4 | survey |
| F2-11 | Quote Calculation Enhancement | Extend IPricingCalculator for seasonal/AI rates | M4 | survey |
| F2-12 | Real-time Price Updates | SignalR PricingHub broadcasts | M4 | SDD-06 |
| F2-13 | Price Comparison Widget | Frontend: current vs AI vs historical average | M4 | survey |
| F3-01 | SmartLockPin Entity | New entity with PIN hash, status, lifecycle dates | M1 (schema) + M5 (logic) |  survey |
| F3-02 | PinStatus Enum | Pending, Active, Expired, Revoked | M1 | survey |
| F3-03 | PIN Generation Algorithm | Crypto RNG 6-digit, BCrypt hash, sequential/repeated rejection | M5 | survey |
| F3-04 | PIN Creation on Check-in | Auto-generate on Reservation→CheckedIn | M5 | survey |
| F3-05 | PIN Validation Endpoint | POST /api/smart-lock/validate with room+pin | M5 | survey |
| F3-06 | PIN Expiry on Check-out | Auto-expire on Reservation→CheckedOut + background job | M5 | survey |
| F3-07 | PIN Revocation | Manual staff revocation | M5 | survey |
| F3-08 | PIN Regeneration | Revoke old + generate new for same reservation | M5 | survey |
| F3-09 | Smart Lock Dashboard | Frontend: active PINs grid per property | M5 | survey |
| F3-10 | SmartLockAccessLog Entity | New entity: log all validation attempts | M1 (schema) + M5 (logic) | survey |
| F3-11 | PIN Security Constraints | Max 5 failed attempts → 15min lock, rate limiting | M5 | survey |
| F3-12 | PIN Notifications | Email/in-app for PIN create, expiry warning, revoke | M5 | survey |
| F3-13 | Smart Lock Simulation UI | Frontend keypad with lock/unlock animation | M5 | survey |
| F3-14 | Multi-tenant PIN Isolation | IPropertyScopedEntity + global query filters | M5 | survey |

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Schema & Migrations | New entities (SocialIdentity, SmartLockPin, SmartLockAccessLog), new enums (SocialProvider, PinStatus), add IdempotencyKey to Payment. EF Core migrations. | none | PLANNED |
| M2 | VNPay Payment Gateway | Full VNPay integration: HMAC-SHA512, payment URL, IPN webhook, idempotency, response codes, config, frontend return page. Backend + frontend. | M1 | PLANNED |
| M3 | Social Login (Google & Facebook) | Google/Facebook OAuth verification, CQRS commands, user provisioning, account linking, frontend social buttons, config. Backend + frontend. | M1 | PLANNED |
| M4 | AI Dynamic Pricing | Pricing factors service, Gemini API integration, suggest/apply endpoints, quota, seasons, calendar, enhanced quote engine. Backend + frontend. | none | PLANNED |
| M5 | IoT Smart Lock | PIN generation, lifecycle (create/validate/expire/revoke/regenerate), access logging, security, dashboard, simulation UI. Backend + frontend. | M1 | PLANNED |
| M6 | Final Integration & Regression | Run full test suite (401 backend + 230 frontend). Fix any regressions. Cross-feature integration testing. | M2, M3, M4, M5 | PLANNED |

## Interface Contracts

### VNPay ↔ Payment System
- `IVnPayService` (Application interface):
  - `CreatePaymentUrlAsync(PaymentSession, clientIp) → string paymentUrl`
  - `VerifyIpnCallbackAsync(queryParams) → VnPayCallbackResult`
  - `ComputeHmacSha512(key, data) → string hexHash`
- VNPay IPN endpoint: `GET /api/payments/vnpay/ipn` → `{ RspCode, Message }`
- Payment entity: existing `Payment.cs` + new `IdempotencyKey` field

### Social Login ↔ Auth System
- `ISocialIdentityVerifier` (Application interface):
  - `VerifyGoogleTokenAsync(idToken) → SocialProfile`
  - `VerifyFacebookTokenAsync(accessToken) → SocialProfile`
- `ISocialAccountService` (Application interface):
  - `ResolveOrProvisionAsync(SocialProfile) → User`
  - `LinkAsync(userId, SocialProfile) → SocialIdentity`
  - `UnlinkAsync(userId, provider) → void`
- New entity: `SocialIdentity` (UserId, Provider, ProviderSubject, ProviderEmail)

### AI Pricing ↔ Quote System
- `IAiPricingService` (Application interface):
  - `SuggestPriceAsync(roomTypeId, propertyId) → AiPricingSuggestion`
  - `ApplyPriceAsync(roomTypeId, suggestion) → RoomTypeRate`
- Extends existing `IPricingCalculator` with seasonal/AI-override consideration
- Uses existing `AiUsageLog` for tracking

### Smart Lock ↔ Reservation System
- `ISmartLockService` (Application interface):
  - `GeneratePinAsync(reservationId) → SmartLockPinResult` (plaintext PIN returned once)
  - `ValidatePinAsync(roomNumber, pinCode, propertyId) → PinValidationResult`
  - `RevokePinAsync(pinId) → void`
  - `RegeneratePinAsync(reservationId) → SmartLockPinResult`
  - `ExpirePinsForCheckoutAsync(reservationId) → void`
- Triggered by: CheckInReservationCommandHandler, CheckOutReservationCommandHandler

## Code Layout

### Backend — New Files (by milestone)

#### M1: Schema & Migrations
```
Domain/Entities/SocialIdentity.cs
Domain/Entities/SmartLockPin.cs
Domain/Entities/SmartLockAccessLog.cs
Domain/Enums/SocialProvider.cs
Domain/Enums/PinStatus.cs
Infrastructure/Persistence/Configurations/SocialIdentityConfiguration.cs
Infrastructure/Persistence/Configurations/SmartLockPinConfiguration.cs
Infrastructure/Persistence/Configurations/SmartLockAccessLogConfiguration.cs
Infrastructure/Persistence/Migrations/<timestamp>_AddVnPaySocialLockEntities.cs
```

#### M2: VNPay Payment Gateway
```
Application/Payments/Commands/CreateVnPayPayment/CreateVnPayPaymentCommand.cs
Application/Payments/Commands/CreateVnPayPayment/CreateVnPayPaymentCommandHandler.cs
Application/Payments/Commands/CreateVnPayPayment/CreateVnPayPaymentCommandValidator.cs
Application/Payments/Commands/ProcessVnPayIpn/ProcessVnPayIpnCommand.cs
Application/Payments/Commands/ProcessVnPayIpn/ProcessVnPayIpnCommandHandler.cs
Application/Payments/DTOs/VnPayPaymentUrlDto.cs
Application/Payments/DTOs/VnPayIpnResponseDto.cs
Application/Common/Interfaces/IVnPayService.cs
Infrastructure/Services/VnPayService.cs
Infrastructure/Services/VnPaySettings.cs
WebApi/Controllers/VnPayController.cs
```
Frontend:
```
frontend/src/app/features/payments/vnpay-return.page.ts
frontend/src/app/core/services/vnpay.service.ts (or extend payment.service.ts)
```

#### M3: Social Login
```
Application/Auth/Commands/SocialLogin/SocialLoginCommand.cs
Application/Auth/Commands/SocialLogin/SocialLoginCommandHandler.cs
Application/Auth/Commands/SocialLogin/SocialLoginCommandValidator.cs
Application/Auth/Commands/LinkSocialAccount/LinkSocialAccountCommand.cs
Application/Auth/Commands/LinkSocialAccount/LinkSocialAccountCommandHandler.cs
Application/Auth/Commands/UnlinkSocialAccount/UnlinkSocialAccountCommand.cs
Application/Auth/Commands/UnlinkSocialAccount/UnlinkSocialAccountCommandHandler.cs
Application/Auth/DTOs/SocialLoginDto.cs
Application/Auth/DTOs/SocialIdentityDto.cs
Application/Common/Interfaces/ISocialIdentityVerifier.cs
Application/Common/Interfaces/ISocialAccountService.cs
Infrastructure/Services/GoogleIdentityVerifier.cs
Infrastructure/Services/FacebookIdentityVerifier.cs
Infrastructure/Services/SocialAccountService.cs
Infrastructure/Services/SocialLoginSettings.cs
```
Frontend:
```
frontend/src/app/features/auth/login/login.component.ts (modify — add social buttons)
frontend/src/app/features/auth/social-account-links.page.ts (new)
frontend/src/app/core/services/social-auth.service.ts (new)
frontend/src/app/core/models/social-auth.model.ts (new)
```

#### M4: AI Dynamic Pricing
```
Application/AiPricing/Queries/SuggestPrice/SuggestPriceQuery.cs
Application/AiPricing/Queries/SuggestPrice/SuggestPriceQueryHandler.cs
Application/AiPricing/Commands/ApplyAiPrice/ApplyAiPriceCommand.cs
Application/AiPricing/Commands/ApplyAiPrice/ApplyAiPriceCommandHandler.cs
Application/AiPricing/Commands/ApplyAiPrice/ApplyAiPriceCommandValidator.cs
Application/AiPricing/Queries/GetPricingCalendar/GetPricingCalendarQuery.cs
Application/AiPricing/Queries/GetPricingCalendar/GetPricingCalendarQueryHandler.cs
Application/AiPricing/DTOs/AiPricingSuggestionDto.cs
Application/AiPricing/DTOs/PricingCalendarDto.cs
Application/AiPricing/Services/IPricingFactorsService.cs
Application/AiPricing/Services/PricingFactorsService.cs
Application/Common/Interfaces/IAiPricingService.cs
Infrastructure/Services/GeminiPricingService.cs
Infrastructure/Services/GeminiSettings.cs
WebApi/Controllers/AiPricingController.cs (or extend AiController)
```
Frontend:
```
frontend/src/app/features/rates/ai-pricing.page.ts (new)
frontend/src/app/core/services/ai-pricing.service.ts (new)
frontend/src/app/core/models/ai-pricing.model.ts (new)
```

#### M5: IoT Smart Lock
```
Application/SmartLock/Commands/GeneratePin/GeneratePinCommand.cs
Application/SmartLock/Commands/GeneratePin/GeneratePinCommandHandler.cs
Application/SmartLock/Commands/ValidatePin/ValidatePinCommand.cs
Application/SmartLock/Commands/ValidatePin/ValidatePinCommandHandler.cs
Application/SmartLock/Commands/RevokePin/RevokePinCommand.cs
Application/SmartLock/Commands/RevokePin/RevokePinCommandHandler.cs
Application/SmartLock/Commands/RegeneratePin/RegeneratePinCommand.cs
Application/SmartLock/Commands/RegeneratePin/RegeneratePinCommandHandler.cs
Application/SmartLock/Commands/ExpirePins/ExpirePinsCommand.cs
Application/SmartLock/Commands/ExpirePins/ExpirePinsCommandHandler.cs
Application/SmartLock/Queries/GetSmartLockDashboard/GetSmartLockDashboardQuery.cs
Application/SmartLock/Queries/GetSmartLockDashboard/GetSmartLockDashboardQueryHandler.cs
Application/SmartLock/DTOs/SmartLockPinDto.cs
Application/SmartLock/DTOs/PinValidationResultDto.cs
Application/Common/Interfaces/ISmartLockService.cs
Infrastructure/Services/SmartLockPinService.cs
WebApi/Controllers/SmartLockController.cs
```
Frontend:
```
frontend/src/app/features/smart-lock/ (new feature module)
frontend/src/app/features/smart-lock/smart-lock.page.ts
frontend/src/app/features/smart-lock/lock-simulation.component.ts
frontend/src/app/core/services/smart-lock.service.ts (new)
frontend/src/app/core/models/smart-lock.model.ts (new)
```

### File Ownership Rules (Concurrent Workers)
- M1 worker: ONLY Domain/Entities/*, Domain/Enums/*, Infrastructure/Persistence/Configurations/*, Infrastructure/Persistence/Migrations/*
- M2 worker: ONLY Application/Payments/*, Infrastructure/Services/VnPay*, WebApi/Controllers/VnPayController.cs, frontend payments/*
- M3 worker: ONLY Application/Auth/Commands/Social*, Infrastructure/Services/Google*, Infrastructure/Services/Facebook*, Infrastructure/Services/SocialAccount*, frontend auth/social*, frontend core/services/social*
- M4 worker: ONLY Application/AiPricing/*, Infrastructure/Services/Gemini*, WebApi/Controllers/AiPricing*, frontend features/rates/ai*, frontend core/services/ai-pricing*, frontend core/models/ai-pricing*
- M5 worker: ONLY Application/SmartLock/*, Infrastructure/Services/SmartLock*, WebApi/Controllers/SmartLockController.cs, frontend features/smart-lock/*, frontend core/services/smart-lock*, frontend core/models/smart-lock*

### Shared Files (Modify with care — coordinate)
- `Domain/Entities/Payment.cs` — M1 adds IdempotencyKey
- `Application/Common/Interfaces/IApplicationDbContext.cs` — M1 adds new DbSet properties
- `Infrastructure/Persistence/ApplicationDbContext.cs` — M1 adds DbSet properties + query filters
- `Infrastructure/DependencyInjection.cs` — each milestone adds its own service registrations
- `WebApi/Program.cs` — may need middleware additions
- `frontend/src/app/app.routes.ts` — each frontend milestone adds routes

## Reference Codebase
- Path: `C:\Projects\He-thong-quan-ly-khach-san`
- Stack: Spring Boot 3.2.5 / Java 21 / SQL Server / Angular
- VNPay: `VnpayPaymentGateway.java`, `VnpayConfig.java`, `PaymentSession.java`, `PaymentController.java`
- Social Login: `GoogleIdentityVerifier.java`, `FacebookIdentityVerifier.java`, `SocialIdentity.java`, `SocialAccountLinkService.java`
- Frontend: `@abacritt/angularx-social-login`, `payment.service.ts`, `login.component.ts`

## Verification Commands
```bash
dotnet build backend/HotelSaas.slnx --verbosity minimal
dotnet test backend/HotelSaas.slnx --no-build
npm --prefix frontend run build
```

## Critical Constraints
- ALL 401 backend tests must pass after every milestone
- ALL 230 frontend tests must pass after every milestone
- Clean Architecture / DDD / CQRS patterns (AGENTS.md)
- Multi-tenant isolation (fail-closed)
- Schema changes MUST be additive-only (new entities, new nullable fields)
