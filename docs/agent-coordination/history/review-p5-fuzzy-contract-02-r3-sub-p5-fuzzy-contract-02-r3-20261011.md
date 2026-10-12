# Review P5-FUZZY-CONTRACT-02 — round 3

TaskId: P5-FUZZY-CONTRACT-02
Round: 3
SubmissionId: sub-p5-fuzzy-contract-02-r3-20261011
Decision: **ChangesRequested — final executable consistency pass**

## Findings

1. P2 — Tier2 condensed branch still inherits ALL-token guard, so a single concatenated query cannot distance2-match a multiword field unless it also matches an individual token. Define independent alternatives explicitly: token Tier2 = ALL budgets and some bestDist2; OR single-query-token condensed length>=6 and OSA2. If instead requiring token guard deliberately, remove condensed2 promise. Apply token-empty guard before75/60/50; define min over empty target as infinity. State token reuse/multiplicity from round2 and literal normalization unchanged. Add a real multiword condensed2 fixture (e.g. nhxtrangg vs Nha Trang) demonstrating chosen rule.
2. P2 — Submitted distance trace still contains invented/wrong numbers: independent full-matrix OSA calculation yields centxralz→da=8 (not9), →nang=7 (not8), →chau=7 (not8). Name bestDist2/score50 unchanged, but City/Address bestDist8 claims incorrect. Correct trace via an executable OFFLINE verifier artifact instead of more manually asserted numbers. Include comprehensive branch/result fixture checking and fixed-Guid same-name tie, no production matcher/DB/dependency. This is a verification aid, not benchmark/coverage evidence.

## Accepted / verification

Literal punctuation/full query behavior, centrally corrected centraal1/centxralz2, dynamic long buffers and removal of silent truncation accepted. Inspected proposal/submission; independently computed OSA distances in reviewer JS full DP matrix (standard insertion/deletion/substitution/adjacent-transposition recurrence), no repo script or production code executed. Develop HEAD3f95339b4f4477ac5d421551d372dfdd5ed31e30. No DB/tests/build/integration/commit/deploy/migration. Short stack allocation<=30 must be conditional implementation threshold, not claim all tokens<=30.

## Next

Round4: publish exact scoring pseudocode and offline verifier+output checking fixtures, correct trace and independent condensed2 alternative. No new aesthetic/UI changes or PO gates; backend integration remains unapproved. Archive existing proposal/submission. Writer released to none.
