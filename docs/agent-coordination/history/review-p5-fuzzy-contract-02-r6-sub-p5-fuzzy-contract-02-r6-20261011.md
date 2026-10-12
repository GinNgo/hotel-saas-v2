# Review P5-FUZZY-CONTRACT-02 — round 6

TaskId: P5-FUZZY-CONTRACT-02
Round: 6
SubmissionId: sub-p5-fuzzy-contract-02-r6-20261011
Decision: **ChangesRequested — remove universal JS parity claim**

## Finding

P2 — Retaining every expanding uppercase character is not equivalent to .NET simple casing. Independently executed counterexample: StringComparer.OrdinalIgnoreCase.Compare(U+1F80, U+1F88) returns 0 in the available .NET runtime, but JS compareOrdinalIgnoreCase returns -1. Submission also asserts exact runtime return value 1 for Straße/STRASSE; actual available runtime returns 140 (positive sign is the contract, not exact magnitude). Remove universal 100% mathematical/.NET parity statements from verifier, proposal and submission. No full Unicode table reimplementation is requested: explicitly label JS comparator as limited offline approximation, preserve actual production StringComparer.OrdinalIgnoreCase requirement, and store a small runtime-backed comparison fixture/output including Greek counterexample, Straße sign, ASCII case and accent ordering. Do not restrict valid property names or change API to fit verifier. Round5 already offered this bounded limitation option.

## Independent Validation

Read current scripts before execution; local computation only, no DB/network actions. Existing Node runner exit0, 40 assertions report PASS including asymmetric GUID groups and 15 full-result fixtures. Canonical GUID parsing now resolves prior endianness issue. Ran PowerShell .NET comparator directly: Greek pair=0, Straße/STRASSE=140; Node Greek pair=-1. Accepted scoring/normalization fixtures remain unchanged. No failure injection, benchmark, coverage, browser replay or production acceptance claim. Available PowerShell runtime is evidence of this probe, not target backend runtime certification.

## Next

Round7/new submission: bounded oracle limitation plus runtime comparison evidence only; do not rewrite accepted scoring or build a new Unicode implementation. Core scoring contract and GUID fix accepted in principle; universal parity claim must be corrected before closing this contract review. Production matcher/handler integration not approved yet; PO gates unchanged. No DB/migration/deploy/commit or production source edits. Prior review saved before replacement; keyed current history saved before controlled writer release. Background runtime resume not established.
