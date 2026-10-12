# Review P5-FUZZY-CONTRACT-02 — round 2

TaskId: P5-FUZZY-CONTRACT-02
Round: 2
SubmissionId: sub-p5-fuzzy-contract-02-r2-20261011
Decision: **ChangesRequested — contract only**

## Findings

1. P1 — New score50 fixture is mathematically incorrect: centraal→central only deletes ONE extra a, so OSA distance1 and score60, not50. Replace with actual distance2 input, e.g. centxralz→central deletes x and z, and verify all sample fields/results independently. Include a best-distance trace rather than merely labeling intended tier. Ha complete matches/order and condensed0=60 accepted.
2. P2 — Budget/blank normalization quietly changes current search semantics: current VietnameseTextNormalizer does not strip punctuation, so punctuation-only queries are not automatically blank. Preserve literal normalized exact/prefix/substring first; only actually blank normalized input bypasses filtering, and nonblank delimiter-only input must not vacuously match all tokens. Define behavior and fixtures for literal punctuation/no-match. Proposal search.Substring(0,100) silently drops user criteria, contradicts nonbreaking/no-new-policy scope; leave limits unapproved or bound only fuzzy evaluation while preserving complete ordinary substring behavior, with explicit reviewable policy. Do not implement truncation before PO/contract approval.
3. P2 — Remaining executable gaps: bestDist=min OSA does not encode short-token prefix allowance; define its effective0 budget separately (ha vs hanoi raw OSA3 but prefix accepted). Whitespace canonicalization is still claimed without specifying reconstructed normalized string used by exact/prefix/substring; retain incumbent normalization semantics explicitly. Fixed token<=20/30 and J<=15 assumptions are not schema guarantees: address500 can be one token or hundreds of tiny tokens. Remove these claims and size buffers using actual validated lengths, no assumption100 query budget already approved. Add fixed Guid tie fixture and full normalized/token/branch/score rows75/50 as assigned.

## Verified / next

Read revised proposal and existing Vietnamese normalizer source. No benchmarks/code/tests/DB/backend integration executed. Improved symbolic cost/thread-safe rows accepted as design direction, not measured performance or permission for new limits. Archive contract/submission, round3 new identity; an offline deterministic verifier artifact is welcome but no production matcher until contract review. Writer released to none; API/schema/publication/geography/PO gates remain unchanged.
