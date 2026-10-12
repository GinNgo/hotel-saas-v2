# Review — MVP-LEGACY-PARITY-01 round 1

- taskId: MVP-LEGACY-PARITY-01
- round: 1
- submissionId: sub-mvp-legacy-parity-01-r1-20261012
- reviewer: codex
- outcome: ChangesRequested

## Findings first

1. [P1] Cashier slice uses nonexistent summary keys. legacy-parity-01.md section4.1 AC1 names totalCashAmount/totalBankTransferAmount/totalCollectedAmount/successfulPaymentCount. Current frontend payment.model.ts and backend summary handler use cashCollected/bankTransferCollected/totalCollected/completedCount (also creditCardCollected). Folio names in section2.6 likewise differ from the actual model (totalAmount/paidAmount/remainingBalance). Correct against actual DTOs, not an invented contract; otherwise UI shows undefined values.
2. [P1] Proposed daily shift reconciliation conflates incompatible date semantics. GetPaymentsQueryHandler filters CreatedAtUtc using UTC DateOnly boundaries; GetPaymentSummaryQueryHandler filters Completed PaidAtUtc using Vietnam UTC+7 day boundaries. PaymentDto exposes createdAtUtc, not a paid timestamp. A same-day table cannot be represented as the transactions composing daily collected KPI. Minimal safe frontend scope: separate clearly labeled creation-date UTC history and daily collection Vietnam summary, no claim of shift reconciliation or equal totals, no backend/date policy changes. Add timezone-boundary tests and explicit labels/acceptance criteria; changing the backend contract requires PO.
3. [P2] Public endpoint mapping is inaccurate: current PublicController exposes GET api/public/properties and POST api/public/quotes/calculate, not the asserted search-properties and quote routes. Verify all route/DTO references from controllers/services and pin legacy evidence by actual repository file + symbol. Legacy tree at submitted SHA resolves, but its existence alone does not verify the broad parity assertions.
4. [P2] Unsupported universal evidence claims: 100% permission scenarios, full lifecycle parity and standard Accessibility conflict with limited earlier approvals. Writer reports one PaymentAndFolio Fact PASS without raw output/command environment evidence; this is not independent verification or full coverage. Replace with bounded source/test mapping and NOT VERIFIED where necessary. Define focused page/service behavioral tests, property-switch stale-response rejection, absent-property fail-closed, permission denial and independent loading/error/empty/retry for both streams.

## Independent checks / limitations

Checkout develop HEAD3f95339b4f4477ac5d421551d372dfdd5ed31e30; existing dirty baseline preserved. Read PaymentService, PaymentDto/FolioDto/PaymentSummaryDto, PaymentsController, both list/summary handlers, public routes and route/menu references. Payments menu is a placeholder and service GETs exist: the read-only cashier UI gap is useful, not rejected.
GitHub read-only tree resolved legacy SHA7e7ed12c0f4149527d46c78aa764b4c2ec88bab9 and controller/test paths. No legacy scripts executed.
Inspected PaymentAndFolioHttpPipelineTests: RealDatabaseTests with environment override and permissive name guard. Did NOT run backend/DB tests or trust reported PASS as reviewer evidence. No code changed, no build required for document review; no actual DB access, migration, dependency, commit or deploy.
Cannot establish task-exclusive source attribution from dirty checkout or authenticate writer test execution.

## Next action

Resubmit parity round2 with corrected concrete DTO/routes/date semantics and a bounded FE-CASHIER-PAYMENTS-01 READ-only plan: no new payment creation, shift-close/audit entity, bank reconciliation, receipt or NoShow API. Explicitly separate daily VN collection from UTC-created history. State route/menu PAYMENTS:Read gating using existing guard and active-property pattern; preserve seven PO gates and reserved team modules.
After corrected contract review, select cashier implementation ApprovedNext under PO continuation instruction; do not ask PO to reapprove low-risk approved-contract UI details. For now task stays ChangesRequested, writer none; not an idle Approved queue.
