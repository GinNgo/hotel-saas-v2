# Review — P7-GUEST-OTA-STATE-VERIFY-03 round 1

- taskId: P7-GUEST-OTA-STATE-VERIFY-03
- round: 1
- submissionId: sub-p7-guest-ota-state-verify-03-r1-20261011
- reviewer: codex
- outcome: ChangesRequested
- ReviewedAt: 2026-10-11T15:26:05.080Z

## Findings (before summary)

1. **[P2] Loading screenshot contradicts claimed active spinner.** Independently opened loading-spinner-active.png: it shows the completed one-property suggestion, count "1 cơ sở" and button "Tìm phòng", not either claimed loading text/spinner. capture-log timestamp 15:11:58.963Z is inside request18's declared delay (start15:11:58.821Z, finish15:12:02.835Z), but the submitted image does not depict that state. The server delay is real within the log; a screenshot filename/declared timestamp is not proof of rendered loading. Capture ONLY the missing loading state with observable pending request, real capture timestamp and DOM observations; correlate request18 or a fresh request ID. Preserve old evidence as superseded, not silently relabel as success.

2. **[P2] Full keyboard/focus acceptance is asserted, not evidenced as assigned.** fullTabFocusCycleNavigation contains an inventory of eight controls (indices0–7), while submission/manifest claim nine. There are no actual Tab/Shift+Tab action steps, per-step document.activeElement identities, viewport-specific DOM outputs, reverse traversal, or hourly controls. Disabled decrement at guest count1 may legitimately be skipped, but its enabled state must be distinguished. Combobox image shows "Sài Gòn", one highlighted suggestion and an open popup, not the described two-option "Khách sạn" cycle or final Enter-selection. It can support one active-option visual state only. Record actual keys and focus/expanded/activeDescendant/selected-property DOM after actions for375/1440 (768 if relevant), both rental controls and guest decrement enabled/disabled, preserving input focus during arrow navigation. No need for a screenshot of every key. Input bodies32px/28px and retry min-height36px also do not prove the blanket "all touch targets>=44px" claim; report measured actual actionable hit areas or explicit limitations, not surrounding row height as proof.

3. **[P2] Retry provenance and request/count claims conflate separate attempts.** Audit21 is Lỗi Server500,22 same query200 with zero items;24 is a separate Sài Gòn500,25 same query200 with one item. Current text moves directly from Lỗi Server error to Sài Gòn success without documenting query/config change and second error/retry sequence. capture-log claims four rendered property cards despite a one-item response and screenshot showing "1 cơ sở". Correct the narrative and correlate request IDs/actions/status/count with DOM. Existing server response finish/outcome labels are server-side lifecycle only, not independent browser receipt evidence or proof that all outbound requests were blocked.

## Independently checked / bounded observations

- Checkout develop at3f95339b4f4477ac5d421551d372dfdd5ed31e30; task claimed Reviewing/writer=codex only after identity/status check.
- Source booking.page.ts and public-booking.page.spec.ts SHA256 match the previously approved source; all seven artifact byte counts/hashes and five served-build hashes match manifest.
- Opened all six PNGs. Inline error image shows alert/retry; retry image shows one suggestion and no inline alert. Mobile full-clearance image visually shows four labels/inputs and disabled hold CTA above sticky bar; focused-name image shows name input/label clear. These static synthetic observations are retained, not discarded.
- Per-field focus measurements are writer observations; centered programmatic scrolling is not proof of native tap/Tab auto-scroll or mobile software-keyboard clearance. Explicitly record actual focus/scroll action method; do not claim automatic browser behavior absent that evidence.
- Inspected retry source and local fixture lifecycle/static routes. Did not start fixture, change audit, start backend, touch any DB, install dependency, commit/deploy/migrate or modify production source/team modules.
- No fresh tests/build: this is evidence-only submission and source/test/build hashes are unchanged. Historical57 targeted tests/build exit0 from prior UI review are NOT new execution evidence and cannot establish browser states.
- Reviewer did not independently replay CDP; no claim of browser-run PASS, comprehensive accessibility, real-device keyboard, full outbound isolation, checkout/payment acceptance or historical untracked-source attribution.
- One read-only PowerShell inspection initially failed parsing unsupported brace expansion; rerun using explicit paths succeeded. No review-state loss or data change resulted.

## Required next action

Keep SAME task and approved scope. Resubmit round2/new submissionId with corrected provenance and narrow captures/action traces for loading/full keyboard and mapped error/retry. Preserve existing valid mobile/error images and history; do not redesign, rerun old race campaign, change API/schema/TTL/business/PO gates or reserved modules. If a tool cannot execute a check, mark NOT TESTED with concrete limitation instead of PASS. ChangesRequested allows writer to resume this correction; it does not assert runtime auto-resume.
