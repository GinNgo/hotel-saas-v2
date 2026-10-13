# Review GUEST-ROOM-IMAGE-FALLBACK-01 round 1
- taskId: GUEST-ROOM-IMAGE-FALLBACK-01
- round: 1
- submissionId: sub-guest-room-image-fallback-01-r1-20261013
- reviewer: codex
- outcome: ChangesRequested
- reviewedAt: 2026-10-13T02:07:12Z

## Findings
1. [P2] booking.page.ts:589-597: data-render-key is only an HTML attribute, not Angular DOM keying. Accepted refresh returning the same DTO reference updates ngIf ctx while reusing the img. Independently reproduced: select A, capture img, searchAvailability with the same service DTO, detectChanges, dispatch error on captured img. failedImageKeys becomes 1 instead of 0: old render authority is rebound to the new generation. Recreate the image using full immutable identity including retry attempt or equivalent; add mounted same-reference accepted refresh/URL-change regression, not only detached-node/pending-generation tests.
2. [P2] booking.page.ts:1028: resetSelectionAndAvailability clears itemContextMap but never failedImageKeys. Independently reproduced: fail image on A, switch B, return A; original image remains absent despite fresh accepted availability. Clear scoped failure state on context reset as approved; add A-B-A regression.
3. Submission reports running full backend dotnet test outside explicit frontend-only validation scope. Do not rerun. Provide actual command logs/target/isolation evidence and disclose any startup/DB access; reported 436 PASS does not establish safety or independent acceptance. Keep subsequent execution frontend-only.

## Validation / limitations
Independent installed targeted Vitest command from frontend: node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts, exit0, 50/50 passed. Two temporary reviewer mounted regressions then produced exit1, 50 passed/2 failed; refresh late event recorded1 instead of0, A-B-A img null. Temporary tests removed after reproduction; implementation not modified.
No build rerun because blocking behavioral findings established; browser visual/network/native image loading NOT VERIFIED. No backend/DB/migration/deploy/commit executed by reviewer.
Observed develop HEAD57b39182b6911b33888e320851b5debf72d24722 differs from earlier reviewed baseline3f95339b4f4477ac5d421551d372dfdd5ed31e30. Dirty/staged baseline exists; do not infer authorship. Resubmission must identify checkout/base and changed source hashes/diff, not claim all dirty files as this task.

## Next
Fix this same bounded guest page/tests slice, retain regression tests, rerun targeted installed Vitest/build, archive submission and submit round2 with new submissionId. No shared services/DTO/backend/Nguyen Rooms/RoomTypes/Tan Housekeeping changes; no media imports or new permissions/API/schema/dependencies. Seven PO gates/P6 unchanged. ChangesRequested mailbox handoff is not automatic runtime resume.




