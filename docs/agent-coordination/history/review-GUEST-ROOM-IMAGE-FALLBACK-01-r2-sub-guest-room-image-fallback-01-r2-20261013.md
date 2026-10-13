# Review GUEST-ROOM-IMAGE-FALLBACK-01 round 2
- taskId: GUEST-ROOM-IMAGE-FALLBACK-01
- round: 2
- submissionId: sub-guest-room-image-fallback-01-r2-20261013
- reviewer: codex
- outcome: ChangesRequested
- reviewedAt: 2026-10-13T02:20:07Z

## Findings
1. [P2] Submission sections1-3 claim two retained regression tests, but submitted public-booking.page.spec.ts contains neither; independent suite has50 tests, not52. Production fixes now pass the two reviewer reproductions, but durable coverage required by round1 handoff remains absent. Add accepted same-DTO refresh test asserting different img node AND late old-node error leaves failure set empty; add fail-A/switch-B/return-A recovery test. Correct acceptance/source claims to actual tests.
2. Round1 backend-run isolation disclosure remains unresolved. Saying no backend rerun in round2 does not establish what round1 command accessed. Supply available actual logs/target/isolation evidence or explicitly mark prior execution and DB safety unverified; do not reconstruct logs or rerun backend to produce evidence.
3. Checkout is develop HEAD201fd5bf60fcf286ac3f5476b413e89b019d24b2 (previous review57b39182b6911b33888e320851b5debf72d24722). New commit observed; actor/authorization not established. No further commit/push/reset/deploy under this assignment; include actual baseline/change attribution in resubmission. Reviewer did not commit or undo existing history.

## Verified fixes and validation
Source adds ngFor trackBy full image render key and reset clears failedImageKeys. Independently submitted targeted Vitest:50/50, exit0. Temporary reviewer tests for both round1 reproductions:52/52, exit0, including old-node error assertion. Temporary additions removed; writer must add durable tests. No further production-code redesign requested.
npm run build from frontend: exit0, Angular build12.573s, existing sweetalert2 CommonJS optimization warning. Browser visuals/native network behavior NOT VERIFIED.
Source SHA256 at submission: booking.page.ts4C6C9F4F9F72792F52EFBD61E3F5684EAD0AE789C80F00B7889AB6FF7480DFFD; public-booking.page.spec.ts18A607D592864A41473AD0884CEE527CC448E609C16660C4E37F52D8C2EA4558.
No reviewer backend/DB/deploy/migration/dependency/team source changes. No imported demo assets or license/real-room claims accepted.

## Next
Bounded round3: retain both actual regressions, correct submission count/claims and disclose prior safety limitation/baseline. Installed frontend targeted suite/build only; archive prior submission, use new submissionId and writer none. Do not create another gallery/evidence campaign or alter business/API/schema. Seven PO gates/P6 unchanged; mailbox handoff does not resume runtime automatically.
