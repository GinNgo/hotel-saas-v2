# Review GUEST-ROOM-MEDIA-PLAN-01 round 2
- taskId: GUEST-ROOM-MEDIA-PLAN-01
- round: 2
- submissionId: sub-guest-room-media-plan-01-r2-20261013
- reviewer: codex
- outcome: ChangesRequested
- reviewedAt: 2026-10-13T01:13:59Z

## Findings first
[P2] Proposed template passes live availabilityRequestId evaluated when error fires, not the generation captured when that image was rendered. Equality check therefore compares the current ID to itself and cannot reject an old image event. Handler also obtains current selectedProperty rather than captured property. Capture immutable render identity (propertyId,generation,roomTypeId,exactURL) per rendered image/view-model; pass that snapshot, compare to current context/current URL and ignore obsolete events. Do not use 'global' fallback when property missing. Include same-ID/same-URL A→B and refresh/retry late-event cases, actual mounted DOM event tests rather than only manually passing stale integers.

## Closed improvements
Existing-media alt preserved; AI provenance correctly separated, SVG-only illustration label. New URL no longer shares failure key; explicit retry specified. Entity/seeder claims now largely source-scoped, runtime DB NOT VERIFIED.
Small broken-image-only frontend scope otherwise suitable; no new rights/API/schema/business decision needed. No need to repeat survey or ask PO routine UI details.

## Validation / limits
Reviewed proposed handler/template/acceptance and previously inspected current guest source/DTO. Proposal only, no executable implementation tests/build appropriate. No DB/commit/deploy/migration/team code changes. No claim browser race behavior verified.

## Next
Round3/new submissionId: correct captured render identity, fail closed without property, add DOM late-event acceptance. Then hand off bounded guest-room image-fallback implementation. Preserve seven PO gates/P6 and separate license/data sourcing.




