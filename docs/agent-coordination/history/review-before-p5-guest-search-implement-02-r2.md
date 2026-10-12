# Review P5-GUEST-SEARCH-IMPLEMENT-02 — round 1

TaskId: P5-GUEST-SEARCH-IMPLEMENT-02
Round: 1
SubmissionId: sub-p5-guest-search-implement-02-r1-20261011
Decision: **ChangesRequested**

## Findings

1. P1 — Discovery silently selects the first property and fetches its availability. `booking.page.ts:loadProperties` next handler, when no matching selected slug and props nonempty, patches props[0].slug, selects props[0], calls searchAvailability. This runs on initial load, keyword results, clear and discovery CTA, violating the approved two-step search (no selected property => properties only). It also leaves the blank/typed destination input misleadingly disconnected from the internally selected hotel. Remove automatic selection for discovery; only explicit current-result user selection should select/query inventory. Existing CTA test uses a pending Subject without emitting its nonempty response, so does not exercise this response handler. Add tests delivering nonempty property API responses for init/search/clear and asserting no selected property or availability calls until explicit selection.
2. P1 — Old suggestions remain selectable and old property responses can revive selection during300ms debounce. valueChanges resets dependent state only when selectedProperty exists/name differs; it does not clear properties or increment propertySearchRequestId/unsubscribe propertiesSub immediately. A previous getProperties response arriving before debounce still passes its ID guard, overwrites results and auto-selects inventory; already rendered previous results can also be keyboard-selected while the new keyword is pending. selectSuggestion does not cancel pending debounce, so a subsequent delayed query can replace an explicit selection. Invalidate suggestions/request/loading/error/active option synchronously on every query edit; cancel debounce on explicit suggestion selection and guard current-query provenance. Add deferred-response and old-option Enter tests before300ms, plus selection during pending debounce. Never leave aria-activedescendant pointing outside current visible options.
3. P2 — Date guards do not cover the full hold/date contract. areDatesValid checks only nonempty/string ordering, not actual valid date or past dates; native min alone is not application validation. submitHold does not call this guard at all. onDateChange(checkOut) silently moves check-in backwards, unlike approved checkout adjustment, and can move check-in into the past. Keep a consistent announced checkout-adjustment or explicit validation policy, never silently move guests' arrival to a past date. Apply common active-mode date validity at availability/quote/hold boundaries; test null/partial/malformed/past dates and reversed checkout edits with zero requests. Preserve current UTC/API/business rules.

## Validation / limitations

- Independent targeted command: `node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts`, cwd frontend: **42/42 tests,2files, exit0**. Passing tests do not close the source findings above. Full172/build are writer results, not independent reviewer reruns.
- Inspected production mobile PNG: CTA contained/visible at375px; header, hero and stacked mode buttons remain notably taller than approved compact mockup. In next fix use short side-by-side mode labels and reduced duplicate hero copy/padding, without reopening the whole design. No PO aesthetic approval implied.
- Checkout develop HEAD `3f95339b4f4477ac5d421551d372dfdd5ed31e30`; inspected source/tests and fixture beginning. No fixture/server execution, DB, migration, deploy or commit. No browser outbound/WCAG/real booking proof from synthetic captures. Same HEAD cannot prove unrelated dirty source unchanged. Comments newly added contrary to repository no-inline-comments guidance should be avoided in follow-up.

## Next

Fix focused findings and add behavioral response-path tests (not just spies/template regex). Archive current submission/evidence, fresh round2 identity, targeted/full frontend tests/build and actual screenshots as appropriate. Backend fuzzy/API/schema/PO gates unchanged. Writer released to none.
