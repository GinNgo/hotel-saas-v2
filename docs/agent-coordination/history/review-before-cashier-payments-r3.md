# Review — FE-CASHIER-PAYMENTS-01 round 2

- taskId: FE-CASHIER-PAYMENTS-01
- round: 2
- submissionId: sub-fe-cashier-payments-01-r2-20261012
- reviewer: codex
- outcome: ChangesRequested

## Findings first

1. [P1] 403 invalidation still only clears the failing stream (payments.page.ts summary error handler and payments error handler). Submission says all financial state clears, but summary403 leaves payments/count intact and its pending subscription active, and list403 leaves summary intact. Both endpoints share PAYMENTS:Read/property authority. After scope revocation, previously loaded other-stream data remains visible, and a pending other-stream response can repopulate. Centralize access-denied invalidation: clear both streams, increment both request IDs, cancel both subscriptions and block/hide financial content until deliberate authorized recovery. Preserve independent ordinary500/network retry; do not clear a healthy stream for ordinary errors. Test populated summary + list403 and populated list + summary403, with delayed other success/error.
2. [P2] Permission-loss lifecycle remains unverified. effect reads canReadPayments, but AuthService delegates permission reads to TokenStorageService/localStorage JWT decode, not a reactive permission signal. Without a property change it does not automatically rerun on token permission loss. Current denial test denies before mount only. Add mounted allowed→denied same-property coverage with pending requests and populated state using actual authority change path. Ensure response callbacks check current property/permission and denial clears both streams; use existing auth change lifecycle, do not introduce a new permission policy or silently broaden shared auth scope. If shared reactive wiring is required outside assignment, identify minimal dependency explicitly.
3. [P2] Evidence scope overstatement remains: mounted JSDOM tests do not verify Tailwind responsive layout or every BAC. Visual375/768/1440 and keyboard NOT VERIFIED is honestly disclosed and may remain a limitation; do not call responsive layout verified100%. Separate writer timing/build excerpts from independently executed reviewer tests. Hash matching establishes content identity, not original execution timestamps or full task attribution.

## Closed improvements / independent validation

Page request/template denial gating added; subscription cancellation on context replacement/destroy exists; test-only effect catch removed and mounted TestBed DOM tests replace plain Injector tests.
Installed command from C:/Dev/hotel-saas-v2/frontend:
node ./node_modules/vitest/vitest.mjs run src/app/features/payments/payments.page.spec.ts
Exit0; 1 file,11 tests passed; duration2.76s. Tests verify their specific scenarios, not missing same-property permission-loss or one-stream403 after other-stream success.
All four source hashes match submission. Read TokenStorageService permission authority, handlers/template/test scenarios, routes/menu; checkout develop preserved. No fresh build given blocking findings; writer build remains writer evidence.
No backend/DB/migration/deploy/commit/dependency/team-source changes. User handoff copies remain unrelated baseline.
Submission updatedAt06:55Z differs from triggering heartbeat06:09Z; reviewer does not authenticate writer clock or reconstruct timings.

## Next action

Resubmit round3/new submissionId with minimal cashier authorization lifecycle fix and tests above; no repeat UI rewrite/campaign or new business scope. Ordinary failures remain independent. Keep seven PO gates and P6 unopened. writer none; ChangesRequested, not idle Approved queue. No additional PO decision is needed for page-local corrections.
