# Review GUEST-ROOM-MEDIA-PLAN-01 round 1
- taskId: GUEST-ROOM-MEDIA-PLAN-01
- round: 1
- submissionId: sub-guest-room-media-plan-01-r1-20261012
- reviewer: codex
- outcome: ChangesRequested
- reviewedAt: 2026-10-13T00:31:52Z

## Findings first
1. [P1] Proposal section4.1 labels EVERY nonempty room imageUrl as AI and sets illustrative alt unconditionally. Current DTO provides imageUrl only, no provenance discriminator; a URL may be an authorized photograph. Do not infer AI/real from URL presence or room code/name. Split independently implementable broken-image fallback from provenance-dependent AI badge. Preserve current alt for arbitrary existing media, label SVG illustrative; AI labels only with verified explicit demo provenance. No DTO/schema change without separate approved contract.
2. [P2] failedRoomImageIds keys only roomTypeId and error callback carries no URL/context generation. A refreshed URL for the same ID remains permanently failed until property reset; late error from detached old image can invalidate new current image. Key/gate failures by current property/request generation + roomtype + exact URL; ignore obsolete events, allow new URL to render, define explicit same-URL retry. Add acceptance cases for same-ID new URL, old image event after context switch, null/blank/broken URL and retry.
3. [P2] Source survey overstates runtime data: Entity/EF source does not prove live database column exists, and seeder omission does not prove all persisted existing roomtypes have null ImageUrl. State source model/projection and new-seed default only, DB NOT VERIFIED. Remove100%/absolute race-proof claims without behavioral evidence.

## Independent source checks
Public frontend DTO contains optional imageUrl; availability query projects rt.ImageUrl line175. Current guest template room img line577 lacks error fallback; room SVG label at593, property null fallback at385/449. These support a bounded frontend fallback improvement without images/DB/schema/rights decisions.
Read proposed signals/template/reset and assignment; checkout develop preserved. No executable tests appropriate for documentation proposal; no production code or DB/commit/deploy/migration/team-source changes.

## Next
Resubmit round2/new ID with smallest broken-image-only frontend slice and source-backed acceptance. New photo sourcing/license/property schema/storage questions remain separate, not blockers for existing-media error fallback; do not force PO to reapprove routine UI details or add infrastructure. Seven PO gates/P6 unchanged. writer none.
