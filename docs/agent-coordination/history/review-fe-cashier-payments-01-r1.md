# Review — FE-CASHIER-PAYMENTS-01 round 1

- taskId: FE-CASHIER-PAYMENTS-01
- round: 1
- submissionId: sub-fe-cashier-payments-01-r1-20261012
- reviewer: codex
- outcome: ChangesRequested

## Findings first

1. [P1] Missing page-level permission gating (payments.page.ts:504,590,627). canReadPayments exists but is never called by template/load functions or context effect. Route/menu protect initial navigation only; component continues issuing GETs and retaining data when permissions change while mounted. Submission claim that denied permission hides forms/data is not implemented. Gate both requests/rendering through existing permission authority, clear/invalidate state on denied/403, preserve backend auth and add rendered permission tests. Do not invent a new authorization contract.
2. [P2] Subscription lifecycle not disposed (payments.page.ts:578,599,649). Destroy and property changes increment counters but never unsubscribe HTTP subscriptions. Stale writes are mostly rejected, but requests/handlers continue after navigation and context changes. Use existing RxJS/Angular lifecycle disposal; no new dependency. Assert cancel/dispose on A→B, A→none and destroy for both streams.
3. [P2] Tests bypass the exact acceptance behavior (payments.page.ts:535 and payments.page.spec.ts). Constructor catches effect setup errors specifically for plain Injector tests; tests manually call load functions instead of exercising mounted Angular effects. BAC1 tests signal assignment, not rendered DTO/template. BAC2 covers only summary late success after explicit load; no list late response/error, A→none from populated state, denied route/menu, or actual permission-driven render. Remove production catch used to accommodate inadequate test harness; use existing Angular TestBed/runtime setup and verify rendering and automatic lifecycle.
4. [P2] Missing required visual and execution provenance evidence. No 375/768/1440 or keyboard observations, nor explicit NOT VERIFIED entry for them; writer test/build excerpts lack standalone raw log/hash/baseline diff evidence. Supply bounded real observations or actionable NOT VERIFIED limitation, not comprehensive BAC/rendered acceptance assertions.

## Independent validation

Ran installed runner from C:/Dev/hotel-saas-v2/frontend:
node ./node_modules/vitest/vitest.mjs run src/app/features/payments/payments.page.spec.ts
Exit0; 1 file, 9 tests passed; duration1.14s. This independently confirms those nine class-level tests only, not complete acceptance.
Read component/template/tests, permissionGuard/auth delegation, route and menu PAYMENTS:Read action1. Read-only services and DTO separation retained. Did not run build after decisive source findings; writer build success remains writer-reported, not reviewer execution.
Checkout develop HEAD3f95339b4f4477ac5d421551d372dfdd5ed31e30 dirty baseline; no task-exclusive attribution from HEAD. User-requested team-handoff copies are separate coordinator work, not Antigravity implementation evidence.
Initial claim/test command used frontend cwd for relative mailbox path and failed before claim/test; corrected repo cwd, claimed successfully, then ran frontend tests. No DB/backend/migration/deploy/commit/dependency/source edits.

## Next action

Fix only cashier page/lifecycle and focused tests/evidence under current assignment, resubmit round2/new ID/writer none. Keep seven PO gates and team modules untouched. No ApprovedNext while this implementation is ChangesRequested; no new PO question required for these fixes.



