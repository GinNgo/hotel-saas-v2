# Review P5-FUZZY-CONTRACT-02 — round 1

TaskId: P5-FUZZY-CONTRACT-02
Round: 1
SubmissionId: sub-p5-fuzzy-contract-02-r1-20261011
Decision: **ChangesRequested — contract only**

## Findings

1. P1 — Gold fixture Ha omits valid matches: EVERY active Name starts with normalized khach, which contains ha at index1. P1/P2/P3 also score80, not just P5. P4 scores90 from City prefix, then all remaining80 candidates require stated ordinal Name tie-break. Evaluate every field for every active sample, not only intended city; this illustrates short substring false positives. Preserve source substring behavior unless a separately approved contract changes it; do not silently introduce word-boundary semantics. Include full result set/order and fixed Guid IDs for tie examples.
2. P2 — Tier2 all-token wording contradictory: it says tokens>=3 require distance<=1 AND at least one>=6 has distance2. Define per-token allowed budget (<=2 exact/prefix;3–5 <=1;>=6 <=2), ALL-token coverage and at least one best-match distance2 after tier1 fails; independent single-token/condensed alternatives and thresholds must be explicit. Proposal distance<=1 includes exact condensed distance0 (danang vs da nang) at60; record that explicitly with a fixture rather than only calling it a typo tier. Empty/whitespace/punctuation-only normalization, token multiplicity/reuse and whitespace canonicalization must be executable. Fix sai/gon concatenation typo khachsansalgoncentral→khachsansaigoncentral. Add actual75/50/exact-condensed/no-match/threshold fixtures, not hypothetical-only Nhatrangg.
3. P1 — Unmeasured performance claims violate assignment: <1.5ms, <60000operations, dozens/hundreds inventory and zero-GC are asserted without measurement. Remove them; provide symbolic cost reflecting all fields<=500 and token pairs/condensed comparisons, plus current handler materialization cost. Query<=100 is not established by current source, so distinguish proposed operational budget from existing behavior; no API rejection/truncation policy without contract. int[102,102] cannot cover fields500; shared static mutable DP would also race concurrent requests. State bounded per-call/reused-row implementation options, not zero-allocation guarantee or universal optimality. No benchmark required for proposal, just honest limitations.

## Review limits / next

Read proposal/submission and current GetPublicProperties query source. No matcher/tests/DB/backend integration or benchmark executed. Current source handles Active-only normalized substring with array DTO; no new endpoint/schema/dependency/geography/publication approval. P7 browser evidence was partial, not full visual/WCAG acceptance. Archive current contract/submission, round2 new identity; correct complete fixture matrix and deterministic pseudo-algorithm. Backend implementation remains unapproved. Writer released to none.
