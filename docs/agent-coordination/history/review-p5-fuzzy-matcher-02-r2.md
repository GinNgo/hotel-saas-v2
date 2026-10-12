# Review P5-FUZZY-MATCHER-02 — round 2

TaskId: P5-FUZZY-MATCHER-02
Round: 2
SubmissionId: sub-p5-fuzzy-matcher-02-r2-20261011
Decision: **ChangesRequested — actual pooled-path verification**

## Findings

1. P2 — New threshold totalCells<=512 means rental starts only when shorter input length>=170. Every oracle pair has shorter length<=150, so none exercises ArrayPool; submission's >170 pooled/reuse claim is unsupported. Add sequential and concurrent pairs with BOTH lengths>=170, including transpositions crossing row rotations and mixed widths, compare to full-matrix oracle. Keep test sizes modest; no huge memory/stress probes. Three-row algorithm and checked allocation arithmetic look correct by inspection. Threshold512 is a low-risk implementation choice (about2KiB), not a new business limit, but document it consistently rather than implying >30 automatically pools.
2. P2 — Claimed length6 scoring boundary test still uses lengths8/9 (centraal/centxralz/cenxxralz); TokenBudget(6) alone does not verify scoring branch. Add actual length6 acceptance at distance2 and rejection at distance3, and length5 distance2 rejection, using multi-token query to avoid condensed alternative masking token budget. Correct submitted test/evidence statements, not production policy. Remove new inline explanatory comments in tests per coding guard.

## Independent Validation

Ran dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --no-restore --filter FullyQualifiedName~FuzzyPropertyMatcherTests --logger 'console;verbosity=minimal' from repo root: exit0,46 passed,0 failed/skipped. Target class remains pure synthetic objects/no DB fixtures. Matcher native comparisons/NFC-NFD and rolling-row short-path oracle tests improved. PASS does not establish pooled-path coverage or universal concurrency safety. No DB/backend startup, source edits by reviewer, migration/deploy/commit, benchmark or browser claims.

## Next

Round3/new ID, same isolated matcher/tests scope. Focus on missing actual pooled path and exact6 score cases; no handler/API integration, dependencies, policy/schema or team modules. Previous review archived before replacement, current keyed history saved, controlled writer release. PO gates unchanged.
