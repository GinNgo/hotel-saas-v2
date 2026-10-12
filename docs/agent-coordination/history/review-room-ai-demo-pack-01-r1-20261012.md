# Review ROOM-AI-DEMO-PACK-01 round 1
- taskId: ROOM-AI-DEMO-PACK-01
- round: 1
- submissionId: sub-room-ai-demo-pack-01-r1-20261012
- reviewer: codex
- outcome: ChangesRequested
- reviewedAt: 2026-10-12T12:10:31Z

## Findings first
1. [P2] gallery.html:411 infers physical accommodation for3 people from synthetic room image and MaxOccupancy. Capacity is a seed convention, not measured floor space or verified third sleeping place; sofa bed is explicitly unknown. Replace with illustrative suite layout only, capacity3 from seed, sleeping-place adequacy NOT VERIFIED. Likewise avoid measured bed-size/real-property suitability claims.
2. [P2] Offline package is not self-contained for handoff: only gallery.html plus4 PNGs exist. Full hashes, writer-reported provenance and future integration guidance are in mailbox submission.md, which is routinely replaced. Put a durable README/manifest in this evidence package with complete paths/SHA256/seed source/unknown facts/rights limitations and guidance; link from gallery. No backend/frontend production integration.
3. [P2] gallery.html:477 asserts image rights via copyright/ownership wording without verified license basis. AI-generated is not proof of exclusive ownership/distribution rights. Remove unsupported entitlement claim and state provenance writer-reported, rights/production-use not verified. No need to regenerate assets.

## Independent checks / limitations
All4 PNG hashes match previous AI asset copies. Static HTML references4 relative local images, no script/http/CDN reference found by source scan. This is static inspection, not browser network/layout/keyboard verification. develop preserved. Full37 legacy assets remain outside package/quarantined.
Initial optional wildcard read of absent package markdown failed (no such files), no mutation; missing durable docs confirmed.
No source/build/DB tests warranted for this offline document-only review; no DB/commit/deploy/migration/team-source change.

## Next
Round2/new submissionId: minimal copy correction and durable manifest/README. Can mark unexecuted browser/layout checks NOT VERIFIED, do not fabricate evidence or add dependencies. Seven PO gates/P6 unchanged; writer none.




