# Review P5-GUEST-SEARCH-FORM-02 — round 3

TaskId: P5-GUEST-SEARCH-FORM-02
Round: 3
SubmissionId: sub-p5-guest-search-form-02-r3-20261011
Decision: **ChangesRequested**

## Blocking finding

P1 — Mobile content is clipped inside the hero despite reported document overflow=false. In submitted `mobile-375.png`, destination/date/guests fields extend past the white search card and purple hero right edge; the plus button, date badge and CTA right edge are cut off by the viewport/hero. CTA is now vertically visible, but not fully visible horizontally. `scrollWidth == clientWidth` does not detect descendants hidden by an overflow-clipping ancestor. Fix the main form grid intrinsic sizing: use shrinkable tracks (`minmax(0,1fr)`), `min-width:0` on relevant grid/flex items and responsive date sub-layout/native inputs; keep44px buttons without clipping. Do not solve by hiding overflow. Capture actual main form again at375/768/1440 and report bounding rectangles for card, every field and CTA against their container/viewport, including right edges, not only document overflow and CTA bottom. Also inspect320px/reasonable zoom as a diagnostic, not a new aesthetic redesign loop.

## Accepted progress / implementation constraints

- Compact vertical form,44px stepper intent, native-date choice, context invalidation and null/partial date guards are substantially addressed. No need to redesign those again or build functional mockup JS.
- Native date rendering is browser-specific; no universal device support/format guarantee. Remove HTML5 Native/Hold-only/internal task metadata from production customer-facing copy. Mobile Agoda remains a recommendation, not live-observed behavior.
- Implementation must preserve2-step CTA semantics: without selected property only search properties; with property and valid dates query availability. Keep DOM focus in input with aria-activedescendant, omit active descendant when no active option. Date/rental changes must invalidate in-flight quote/availability as well as clear currentQuote. Preserve API/time semantics, guest single control and existing backend validation; do not invent universal guest/hour limits or claim fuzzy backend implemented.

## Verification and limitations

Reviewer inspected submission/proposal, mockup source and actual mobile PNG. All5 manifest artifact hashes matched. Checkout develop HEAD `3f95339b4f4477ac5d421551d372dfdd5ed31e30`. Writer metrics are not independent reviewer browser execution and are contradicted by clipping visible in PNG. No production tests/build run for static proposal. No DB, migration, deploy or commit. No completed dual-agent design/browser audit claimed; same HEAD alone cannot prove zero changes in dirty checkout.

## Next

Round4: correct horizontal clipping in actual main form and capture fresh artifacts/hashes with element containment evidence. No production code until proposal approved. PO/API/schema/fuzzy gates unchanged. Writer released to none.
