# Review P5-GUEST-SEARCH-FORM-02 — round 2

submissionId: `sub-p5-guest-search-form-02-r2-20261011`
Decision: **ChangesRequested**. Static proposal only; no production code yet.

## Findings

1. P1 — Actual mobile main form is not compact/search-first. `mobile-375.png` shows a multi-column wrapping header and three-line oversized hero; CTA is below the first 812 CSS pixels. No horizontal overflow is insufficient. The second miniature mobile example below does not fix the actual main form. Reduce header/hero/padding, use short Vietnamese mode labels, show the complete main form and CTA at375×812, recapture that form.
2. P2 — Calendar presentation contradicts the implementation choice. Proposal chooses HTML5 native dates but mockup promises custom dual-month range highlight/Apply. For this slice show actual native-date fields, clearly exclude the custom calendar reference, or justify reuse of the existing date component without dependency. Native date formatting/calendar appearance cannot be guaranteed across browsers. Static diagrams do not prove working keyboard/dropdown interactions. Main stepper32px and miniature26px targets contradict44px acceptance; fix real controls.
3. P2 — Complete context/edge contracts. Editing/clearing destination after selection must invalidate selected property, availability, quote and pending availability/quote responses. Invalidate suggestions immediately on keyword edit, not only after debounce starts another request. Specify null/empty/partial/reversed date behavior: no availability/quote/hold until valid; announce any automatic checkout adjustment. Add suggestion loading/empty/error and focus/ARIA active-option behavior. Preserve source UTC conversion and guests hold-only semantics.

## Evidence and limitations

- Checkout develop HEAD `3f95339b4f4477ac5d421551d372dfdd5ed31e30`; inspected source date/form mapping, mockup HTML, mobile/popover PNGs. All5 manifest hashes independently matched.
- Correct07UTC=14VN mapping accepted as current source behavior, not a new universal property policy. No production tests/build run for static proposal; no DB/migration/deploy/commit performed.
- Viewport/overflow metrics are writer-reported, not reviewer browser execution. Source is self-contained, not a browser outbound audit. Synthetic data labeled in manifest should also be visibly labeled. Mobile Agoda behavior is recommendation, not live observation.
- Same HEAD in dirty checkout cannot prove zero production edits. This is a bounded mailbox source/artifact review, not a completed dual-agent Impeccable/browser-detector audit or visual approval by PO.

## Next

Round3: fix actual responsive main form, native-date visual handoff/44px controls and edge contracts; new submissionId/hashes. Static mockup states allowed, no functional mockup JS required. Production implementation awaits proposal approval. API/schema/fuzzy backend and PO gates unchanged. Writer released to none.
