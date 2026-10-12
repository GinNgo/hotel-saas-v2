# Review P5-GUEST-SEARCH-FORM-02 — round 4

TaskId: P5-GUEST-SEARCH-FORM-02
Round: 4
SubmissionId: sub-p5-guest-search-form-02-r4-20261011
Decision: **Approved — bounded proposal only**

## Findings / constraints

No blocking proposal finding remains. Submitted mobile PNG now shows the whole main form, date fields, plus button and CTA inside the card; desktop/tablet PNGs inspected too. Shrinkable grid/native-date sub-layout addresses the identified intrinsic-width cause. This authorizes a small implementation slice, not PO aesthetic acceptance or functional production approval.

- Do not use body overflow-x:hidden to conceal defects in production; mockup still has it. Verify element containment and popup/focus visibility, not only document scrollWidth. Ensure suggestion overlay fits mobile320/375px and is not clipped by ancestors.
- Keep2-step search: without property selection search properties only; with selected property and valid dates query availability. Never imply guests filter server availability. Use guestForm.numberOfGuests as sole control. Preserve existing API/UTC semantics and server rules; no new occupancy/hour-limit policy.
- On destination/date/rental changes invalidate all pending dependent availability/quote responses and clear selection/results as appropriate. Null/partial/invalid dates block availability/quote/hold. Announce auto checkout adjustment. Keep focus in combobox input; active descendant only when an actual option exists; keyboard Enter/Escape/arrows and retry/clear must be tested.
- Native dates have browser-specific appearance. No production technical metadata, fake prices/ratings/assets or guarantee of universal calendar styling. Mobile Agoda behavior was recommendation, not live observation.

## Verification / limitations

Reviewer inspected mockup source and375/768/1440 PNGs; all5 artifact hashes matched manifest. Source/checkout develop HEAD `3f95339b4f4477ac5d421551d372dfdd5ed31e30`. Containment/320px measurements remain writer evidence, not independently executed reviewer browser metrics. No production tests/build run for this static proposal. No completed browser-outbound/WCAG/dual-agent audit claimed; same HEAD cannot prove unchanged dirty source. No DB/migration/deploy/commit performed.

## Handoff

Next approved dependent slice: `P5-GUEST-SEARCH-IMPLEMENT-02`, round1, scope in assignment.md. Archive this review/submission before replacing. Production implementation must submit source, behavioral tests/build and actual rendered evidence for independent review. Backend fuzzy/API/schema/PO gates unchanged. Writer released; ApprovedNext is permission to claim work, not proof runtime automatically resumed.
