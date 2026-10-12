# Review LEGACY-ROOM-ASSETS-01 round 2
- taskId: LEGACY-ROOM-ASSETS-01
- round: 2
- submissionId: sub-legacy-room-assets-01-r2-20261012
- reviewer: codex
- outcome: ChangesRequested
- reviewedAt: 2026-10-12T11:16:53Z

## Findings first
[P2] Source/generation provenance still asserted, not evidenced. Manifest uses .../assets paths instead of exact pinned source URLs/blob identities and no retrieval log/source excerpt is saved. V7/V8 sort_order claim has no exact source reference. AI section states original prompts and a single generation time but supplies no retained response metadata/execution evidence; script deletion is not proof. Add precise source identifiers and sanitized existing evidence; if original prompt/time or generation execution cannot be recovered, mark writer-reported/NOT VERIFIED rather than reconstructing or claiming authenticated provenance. A bounded33-image inventory does not establish absence of LICENSE throughout repo: state license not verified in surveyed scope. No need to regenerate images or expose credentials.

## Closed findings / independent checks
Unsupported bed/view descriptions now clearly illustrative/unknown; seed room associations included; same-room angle claims withdrawn. Legacy images marked quarantine/reference-only, no production reuse authorization.
Independent filesystem hashing/grouping:37 files,13 duplicate pairs and11 singleton hashes, matching report; destination-default now included. This verifies local duplicate structure, not remote source origin or visual identity.
Prior source inspection verifies roomtype codes/prices/capacities and101/102/201/301/302/401 seed associations, not real hotel inventory.
Checkout develop; root-only AGENTS scope unchanged. No code/build/DB tests appropriate for provenance-only correction. No DB/commit/deploy/migration/team-source modification.
Submission time18:15 differs from mailbox18:12; neither clock is independently authenticated.

## Next
Round3/new ID: finish minimal exact-source manifest and honest evidence limitations. Missing rights remains blocked for production, but inventory/proposed AI demo may be reviewed independently. Seven PO gates/P6 unchanged. writer none.
