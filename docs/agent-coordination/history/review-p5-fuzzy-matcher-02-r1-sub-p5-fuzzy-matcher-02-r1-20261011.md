# Review P5-FUZZY-MATCHER-02 — round 1

TaskId: P5-FUZZY-MATCHER-02
Round: 1
SubmissionId: sub-p5-fuzzy-matcher-02-r1-20261011
Decision: **ChangesRequested**

## Findings

1. P2 — OsaDistance allocates full (l1+1)*(l2+1) matrix instead of approved three-row buffer. Memory is quadratic, and unchecked int multiplication can overflow into a negative or misleadingly small stack allocation size. Contract deliberately has no arbitrary query truncation; public helper accepts arbitrary strings. Use three rolling rows sized to shorter input +1, safe allocation arithmetic, stack threshold consistent with contract, ArrayPool return in finally. Preserve restricted transposition row i-2; do not add a new input limit. Current 50-character test does not expose growth/overflow. Source inspection establishes defect; reviewer did not run huge allocation probes.
2. P2 — Tests of StringComparer/Guid themselves do not test matcher sorting. Add actual SearchProperties/CompareProperties fixtures with Greek equivalent names requiring GUID tie, sharp-S distinct names, ASCII case ties and asymmetric GUIDs, plus actual score boundary rejection/acceptance for lengths2/3/5/6 and NFC/NFD query equivalence. Add repeat/concurrent long-buffer comparisons against a small full-matrix test oracle to verify rolling-row reuse. No DB fixtures or new dependencies. Remove newly added inline commentary per developer coding guard; preserve existing files/comments outside scope.

## Independent Validation

Inspected helper, test class/project before running targeted tests: class uses synthetic Property objects, no DB fixture/inheritance or runtime handler wiring. Ran dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --no-restore --filter FullyQualifiedName~FuzzyPropertyMatcherTests --logger console;verbosity=minimal (logger passed as one argument): exit0, 42 passed, zero failed/skipped. This is not coverage/full-suite/production acceptance. No DB/backend service startup, migration/deploy/commit. No nested backend AGENTS found. Existing dirty baseline limits attribution.

## Next

Resubmit round2/new ID, same isolated matcher/tests scope. Scoring branches and native comparators look consistent with approved contract; fix memory root cause before handler/API integration. All PO gates and team reservations preserved. Prior review saved before replacement; keyed history saved before controlled writer release.
