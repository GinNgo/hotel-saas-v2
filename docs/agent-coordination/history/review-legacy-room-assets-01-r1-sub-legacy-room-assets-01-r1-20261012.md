# Review LEGACY-ROOM-ASSETS-01 round 1
- taskId: LEGACY-ROOM-ASSETS-01
- round: 1
- submissionId: sub-legacy-room-assets-01-r1-20261012
- reviewer: codex
- outcome: ChangesRequested
- reviewedAt: 2026-10-12T10:55:44Z

## Findings first
1. [P1] Submission section4 claims room bed configuration/view derives from LocalDevDataSeeder.cs, but lines669–678 establish codes/names/capacity/base demo price only. King-size/windows/city view, suite sofa bed/sunset view and warm wooden interior are not established by those calls. A blanket mock disclaimer does not make invented details source-backed. Separate verified seed fields from proposed illustrative styling, mark unknown bed size/view/amenities, and do not present different legacy photos as angle2 of the same physical room without evidence.
2. [P2] Provenance remains a report rather than reproducible source manifest. Evidence directory has37 images only: missing per-file pinned source URL/blob identity, retrieval evidence, sanitized AI prompts/model/timestamps/response metadata and full suitability review. No LICENSE does not itself authorize internal demo use; mark legacy assets quarantine/reference-only pending rights verification, do not assert permission. Commit existence and absence of LICENSE across entire repository have not been independently verified here. Add source-backed bounded inventory and per-asset rights status; do not claim whole-repo exhaustive survey.
3. [P2] Inventory incomplete: destination-default.webp exists but is omitted from fallback manifest; repeated descriptions/property→room mapping and perceptual/visual suitability need explicit findings or NOT VERIFIED. SHA256 distinctness is not proof of different interiors or visually coherent same-room gallery. Provide full37-file manifest, duplicate groups, and room associations101/102/201/301/302/401 from seed without implying real inventory.

## Independent checks / limitations
Recomputed local lengths/SHA256: listed7 room-type,12 property and4 AI entries match submission.13 fallback duplicate mappings match local copies; additional destination fallback omitted.37 local files total.
Viewed AI standard-twin PNG: shows two separated beds; this supports illustrative visual content, not actual property identity/bed dimensions.
Read seeder static source only: capacities/prices/codes and room associations available; no execution or database access. Checkout develop preserved. No source edits/backend/tests/build warranted for this assets/documentation review.
Legacy pinned repository bytes/license and AI generation execution not independently authenticated; local hash proves identity only. No DB/commit/deploy/migration/team-code changes.

## Next
Resubmit round2/new ID with corrected factual/demo distinction and complete sanitized manifest/provenance/suitability. Do not regenerate already sufficient images solely to fill reports. Missing rights stays blocked for reuse; can finish independent AI-demo inventory without production integration. Seven PO gates/P6 remain unchanged. writer none.
