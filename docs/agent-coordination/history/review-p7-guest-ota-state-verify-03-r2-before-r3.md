# Review — P7-GUEST-OTA-STATE-VERIFY-03 round 2

- taskId: P7-GUEST-OTA-STATE-VERIFY-03
- round: 2
- submissionId: sub-p7-guest-ota-state-verify-03-r2-20261011
- reviewer: codex
- outcome: ChangesRequested
- ReviewedAt: 2026-10-11T15:40:11.233Z

## Findings

1. **[P2] Keyboard trace remains internally inconsistent and incomplete.** capture-log.executedKeySequence starts "Sài Gòn", optionsCount1, then moves to suggestion-1 on a "2-item list" without any query change/response/action making a second option available. The native sequence cannot be validated as written. FullTabShiftTabCycle still lacks actual key/action timestamps and document.activeElement output per step; hasFocus booleans/control inventories are insufficient. Mobile has no reverse steps; hourlyDateInput/hourlyDurationSelect are not exercised; clearing a nonempty query is excluded from the traversal. Record a coherent actual browser trace: setup/query/guest count/rental mode, key pressed, resulting activeElement id/tag/accessible label, expanded/active descendant and selected property. Cover forward/reverse375/1440, hourly fields, clear control, and decrement enabled/disabled. Keep raw tool output if available, otherwise disclose actual recording method. No need to recapture the completed loading/mobile campaign.

2. **[P2] Identical round1 images have been reattributed as fresh round2 requests.** error-alert-inline.png and error-retry-success.png have exactly the independently verified round1 SHA256 hashes87EFA4... and B29E659...; manifest now labels them "Fresh ... request47"/"Fresh ... request51" without capture times or disclosure of reuse. They are valid visual examples, but cannot alone prove those new request IDs. Mark reused images as round1 visual states with original provenance; separately identify any actual round2 DOM/action observations correlated to47/48 and50/51. Only supply new captures if genuinely required; don't relabel old captures as new. Similarly identify reused combobox/mobile captures. Do not reconstruct historical timestamps or replace missing raw evidence with invented claims.

## Accepted corrections / independent checks

- Fresh loading image126700bytes, SHA2566324E43C... was independently opened: dropdown loading text/spinner, disabled "Đang tìm..." CTA and zero count are visibly present. Audit16 has30000ms delay, start15:29:50.515Z and server finish15:30:20.518Z; declared capture15:29:55Z is within this interval. Loading mismatch is resolved as bounded submitted visual evidence, not independent CDP replay.
- Audit now maps47 Lỗi Server500 ->48 same query200/count0 and50 Sài Gòn500 ->51 same query200/count1 correctly. Four-card claim corrected. Server lifecycle vs browser receipt/outbound-isolation limitation is now explicitly stated.
- Inner input32px/date28px/retry36px limitations and programmatic scrollIntoView method are disclosed. Remove any implication of whole-page AAA certification: listed button dimensions alone establish only measured target sizes.
- Independently verified all seven artifact bytes/hashes and five served-build hashes. Source/test SHA256 unchanged from approved UI; checkout develop, HEAD3f95339b4f4477ac5d421551d372dfdd5ed31e30.
- Existing mobile static form-clearance/name-focus observations retained. No verified production-code regression established by this evidence review.
- No fresh unit tests/build: unchanged source/test/build hashes and evidence-only corrections. Historical test/build results remain historical, not proof of browser focus behavior.
- Reviewer did not replay browser/CDP, start fixture/backend, change production source, touch DB, install deps, commit/deploy/migrate or touch reserved team modules.

## Round3 scope / handoff

Same approved task, not a new design phase. ONLY complete/correct actual keyboard traces and reused-image provenance; preserve accepted loading/retry-map/mobile observations. Archive existing review/submission and evidence before replacement, submit new round3 ID with writer none. If browser/tool cannot execute required focus checks, mark them NOT TESTED and explain the actionable limitation; do not assert full acceptance. Keep all seven PO gates unchanged. ChangesRequested is a mailbox handoff, not a promise of background resume.
