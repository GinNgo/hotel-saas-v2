# Review P5-FUZZY-CONTRACT-02 — round 4

TaskId: P5-FUZZY-CONTRACT-02
Round: 4
SubmissionId: sub-p5-fuzzy-contract-02-r4-20261011
Decision: **ChangesRequested**

## Findings

1. P2 — Verifier uses localeCompare(Name, 'vi'), not contract StringComparer.OrdinalIgnoreCase. Equal-score probe returns Á Hotel before Z Hotel, opposite ordinal order. Align comparator and add case/accent ordering fixtures; verify fixed valid GUID ordering against Guid.CompareTo.
2. P2 — Verifier strips only U+0300–036F, not source NonSpacingMark; a\u1ab0 retains its combining mark. Query U+0301 normalizes empty but returns zero results instead of current handler's all-Active bypass. Correct contract/verifier and add normalized-empty and other combining-mark fixtures. Align all-whitespace regex tokenization with C# pseudocode's limited delimiter list.
3. P2 — Runner checks only top ID/score, not full nonempty results, and never exits nonzero for failed assertions. Added P7/P2_TIE participate globally but Ha expected table omits them. Scope fixtures separately or update full result arrays; assert complete membership/order/scores, inactive exclusion, blank/normalized-empty, transposition and token reuse. Fix explanatory edit counts: centxralz→da is 7 deletions +1 substitution; →nang is 5 deletions +2 substitutions. Sài Gòn matches P3 Name, not its City.

## Independent Validation

Read both offline scripts before execution: pure computation, no DB/network calls. Ran node docs/agent-coordination/evidence/run-verify-fuzzy-contract.cjs: exit0, 12 top/count checks and identical-name tie reported PASS. Corrected OSA distances and independent condensed2 nhxtrangg score50 reproduced. Independent Node probes reproduced comparator, U+1AB0 and normalized-empty defects. PASS is not full-table verification or production acceptance. No benchmark/coverage claims, no backend/frontend test rerun or browser replay.

Checkout develop HEAD 3f95339b4f4477ac5d421551d372dfdd5ed31e30; dirty baseline does not prove attribution. No reviewer production code edits, DB/migration/deploy/commit. Prior review archived before replacement.

## Next

Resubmit round5/new ID, contract and offline verifier/output only. Condensed alternatives and token-empty guard accepted in principle; production integration remains unapproved. Preserve PO gates and team reservations; mailbox does not prove runtime resume.
