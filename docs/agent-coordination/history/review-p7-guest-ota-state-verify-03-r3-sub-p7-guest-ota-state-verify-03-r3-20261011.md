# Review — P7-GUEST-OTA-STATE-VERIFY-03 round 3

- taskId: P7-GUEST-OTA-STATE-VERIFY-03
- round: 3
- submissionId: sub-p7-guest-ota-state-verify-03-r3-20261011
- reviewer: codex
- outcome: ChangesRequested
- ReviewedAt: 2026-10-11T16:05:18.202Z

## Findings

1. **[P2] "Full reverse" acceptance still exceeds the recorded actions.** scenario5 mobile forward ends at heroSearchButton15:53:57Z; first reverse step15:54:11Z is propertySearchInput, omitting increment/checkOut/checkIn and any focus reset/action between those positions. The three recorded reverse observations support only the combobox->hourly->overnight tail, not a full reverse cycle. scenario4 hourly forward reaches increment15:52:49Z and hero15:52:50Z, but reverse first timestamp is15:52:47Z from Stepper, before the forward finishes. These may be separate subruns, but their starting focus/reset and chronology are not recorded. scenario3 ends reverse at input then asserts Enter "on clear button" without a recorded refocus/Tab action. Record actual missing actions and starting focus or explicitly mark these parts partial/NOT TESTED; do not fill gaps with reconstructed timestamps. Preserve coherent combobox and other recorded observations.

2. **[P2] New historical capture times lack provenance and contradict previously reviewed metadata.** Round3 reused-image timestamps14:48/14:49/14:49:30/14:50/14:50:30Z did not appear in the round1 capture log reviewed here, which reported combobox15:16:42Z, error15:12:33.107Z, retry15:13:07.975Z, mobile15:15:36Z and name focus15:15:57Z. Reuse and SHA identities are now correctly disclosed, but these newly supplied historical times cannot be accepted without original tool/capture records. Use original recorded values clearly attributed as writer metadata (not independently authenticated capture time), or null/UNKNOWN if actual capture time is unavailable. Do not replace an uncertainty with a new exact timestamp.

## Accepted improvements / independent checks

- Combobox trace now consistently sets query "Khách sạn"/two options before suggestion-1 and includes activeElement identifiers for arrow/Escape/Enter observations. This resolves the one-item/two-item contradiction as submitted writer trace; reviewer did not execute CDP.
- Desktop trace now includes enabled/disabled decrement, clear and hourly date/duration controls. Individual hit-size and whole-page certification limitations retained.
- All seven artifact byte counts and SHA256 hashes independently match manifest; all five served-build hashes match local dist. Source/test hashes unchanged. develop HEAD3f95339b4f4477ac5d421551d372dfdd5ed31e30.
- Loading image hash6324E43C... unchanged from accepted round2 visual state; retry audit1582F669... unchanged and accepted two-query/request mapping retained. Reused mobile/error images remain valid static visual examples, not new captures.
- Inspected fixture loopback bind/static/control routes; did not execute it or overwrite audit. Fixture changed length16386 vs16243 in round2; this is evidence tooling, not proof of a production change.
- No new tests/build run for unchanged production source/test/build. Historical results are not fresh evidence of browser traversal.
- No independent browser replay, raw authenticated CDP transcript, native software-keyboard test, whole-page accessibility certification, or outbound-isolation proof.
- No code/API/schema/PO-gate/team changes, backend startup, DB access, dependency installation, commit/deploy/migration performed.

## Narrow round4 handoff

Same task. Correct only the incomplete/inconsistent trace claims and unsupported historical timestamps. Existing genuine observations may be retained with partial/NOT TESTED limitations; actual missing browser actions may be captured if tooling allows, but no fabricated chronology. Clearly separate independent captures, writer DOM observations and metadata-only corrections. Preserve accepted loading/retry-map/mobile evidence; no redesign, old race reruns or new business scope. Archive before replacing; submit round4/new ID/writer none. Seven PO gates remain unchanged. No claim that Antigravity resumes automatically.
