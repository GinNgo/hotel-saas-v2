# Review — P7-GUEST-OTA-STATE-VERIFY-03 round 4

- taskId: P7-GUEST-OTA-STATE-VERIFY-03
- round: 4
- submissionId: sub-p7-guest-ota-state-verify-03-r4-20261011
- reviewer: codex
- outcome: ChangesRequested
- ReviewedAt: 2026-10-11T16:20:08.723Z

## Finding

**[P2] Hourly reverse starting focus is impossible under the declared setup.** scenario4 setup guestCount1, but subrunB.startingFocus now explicitly states Stepper button "-" focused at15:52:45Z. At guestCount1 the decrement is disabled (source and submitted scenario1/5 confirm this); native keyboard/programmatic focus cannot make that disabled button active. No action changing guest count2 is recorded. Separating subruns therefore does not substantiate this new exact historical focus claim. Use actual original tool output to identify the starting control/state; if unavailable, set startingFocus/timestamp UNKNOWN and mark this historical reverse subrun NOT VERIFIED. Do not invent a guest-count change or refocus timestamp. Also make verificationSummary.fullTabFocusCycle explicitly PARTIAL rather than a leading PASS for full coverage, consistent with the already disclosed uninterrupted-mobile-reverse limitation. No new source change or broad browser campaign required.

## Accepted / independently verified

- Reused PNG timestamps now match the round1 writer metadata reviewed previously, and metadata vs independent telemetry limitations are explicit.
- Mobile reverse is honestly segmented with continuous full reverse PARTIAL/NOT TESTED. New mobile forward/CTA-tail activeElement observations are writer trace, not reviewer execution.
- Loading visual state, static mobile label/input/CTA clearance, coherent combobox observations and two-query retry mapping remain accepted within prior limits.
- Independently verified all seven artifact sizes/hashes, five served-build hashes, unchanged booking.page.ts/public-booking.page.spec.ts hashes and checkout develop HEAD3f95339b4f4477ac5d421551d372dfdd5ed31e30.
- No fresh tests/build because production source/test/build identities remain unchanged; no claim that historical tests prove actual keyboard traversal.
- Reviewer did not execute CDP/fixture/backend, access DB, change source/business/contracts/team modules, install deps, commit/deploy/migrate. No full accessibility/native-soft-keyboard/outbound-isolation certification.

## Narrow round5 handoff

Metadata-only correction allowed: retain independently accepted visuals and actual observations; classify the unsupported hourly starting-focus record as UNKNOWN/NOT VERIFIED if no original output exists, and align full-focus summary with PARTIAL. Do not reconstruct historical evidence. Preserve all seven PO gates, archive review/submission before replacement, submit round5/new ID/writer none. This can be approved as bounded evidence with explicit limitations, not complete full-keyboard acceptance. No redesign or repeated completed screenshots.
