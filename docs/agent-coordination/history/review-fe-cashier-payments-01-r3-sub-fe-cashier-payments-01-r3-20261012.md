# Review FE-CASHIER-PAYMENTS-01 round 3
- taskId: FE-CASHIER-PAYMENTS-01
- round: 3
- submissionId: sub-fe-cashier-payments-01-r3-20261012
- reviewer: codex
- outcome: ChangesRequested
- reviewedAt: 2026-10-12T07:49:28Z

## Findings
[P1] payments.page.ts:585/649/698 clears both streams after403 but has no persistent access-denied latch. Local JWT can still grant PAYMENTS:Read; refresh/filter/page/retry immediately allows another stream to populate financial data without authorized recovery. During initial context load, synchronous summary403 is followed unconditionally by loadPayments, which can populate successfully. Tests403 run only after mount and omit subsequent actions. Add page-local denied state gating template, both loaders/callbacks; reset only on deliberate validated authority/context recovery, not ordinary retry. Test initial summary403 + successful list, both403 directions followed by refresh/filter/retry and valid recovery. Ordinary500 remains independently retryable.

## Evidence / limitations
Independent installed Vitest command from C:/Dev/hotel-saas-v2/frontend:
node ./node_modules/vitest/vitest.mjs run src/app/features/payments/payments.page.spec.ts
TZ=America/New_York; exit0;14/14 tests,1file,duration3.79s.
Central clearing/cancellation/request invalidation and currentUser$ permission-loss subscription added. AuthService refreshToken updates token before currentUser$ emission. Same-property switchContext does not emit currentUser$; universal auth-change coverage not claimed.
Checkout develop/3f95339b4f4477ac5d421551d372dfdd5ed31e30, dirty baseline preserved. No fresh build due to blocker; writer build not independent evidence. Visual375/768/1440/native keyboard NOT VERIFIED.
No DB/backend/commit/deploy/migration/dependency/team-code changes.
Initial review archive patch rejected atomically (duplicate target operation); corrected before release.

## Next
Round4/new submissionId; page-local fix needs no new PO. writer none.
Queued LEGACY-ROOM-ASSETS-01 after cashier Approved; seven PO gates/P6 unchanged.
