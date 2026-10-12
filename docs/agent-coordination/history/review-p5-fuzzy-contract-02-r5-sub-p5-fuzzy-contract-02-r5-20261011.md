# Review P5-FUZZY-CONTRACT-02 — round 5

TaskId: P5-FUZZY-CONTRACT-02
Round: 5
SubmissionId: sub-p5-fuzzy-contract-02-r5-20261011
Decision: **ChangesRequested — comparator parity**

## Findings

1. P2 — compareGuid reads little-endian integers from bytes parsed directly from canonical GUID text. Text groups are numeric hexadecimal in display order, not Guid.ToByteArray memory layout. Counterexample: compareGuid('00000001-0000-0000-0000-000000000000', '00000100-0000-0000-0000-000000000000') returns +1; Guid.CompareTo compares first fields 1 and 256, hence must return negative. Parse canonical groups numerically (or correctly construct .NET byte layout). Add asymmetric fixtures exercising first, second, third groups and remaining bytes; repeated-digit IDs cannot catch endianness errors. Correct submission's LE explanation.
2. P2 — compareOrdinalIgnoreCase uses JavaScript whole-string toUpperCase, which performs expanding Unicode mappings, unlike .NET ordinal case comparison. Probe Straße vs STRASSE returns zero, falsely triggering Id tie-break between distinct names. Do not claim exact .NET parity from ASCII/accent test alone. Use runtime-backed .NET comparison fixtures or constrain and label JS oracle limits without changing production name policy; actual matcher must use StringComparer.OrdinalIgnoreCase. Add expanding-case counterexample.

## Independent Validation

Read offline source/runner before execution; no network/DB calls. Ran existing Node runner from repo root: exit0, 34 assertions report PASS, including 15 complete-result fixtures and three bypass checks. Independent probes reproduced two comparator defects above. Normalized-empty/U+1AB0, full-result assertions, token reuse/transposition, independent condensed2 and explicit delimiters are improved. Failure exit branch exists in source; not fault-injected. No production acceptance, benchmark, coverage or browser claim.

Checkout develop HEAD 3f95339b4f4477ac5d421551d372dfdd5ed31e30. Dirty baseline remains attribution limitation. No reviewer backend/frontend edits, DB access, commit/deploy/migration. Previous round4 review archived before replacement.

## Next

Round6/new submission ID: comparator corrections and adversarial fixtures only, documentation/offline scope. Avoid rewriting accepted scoring logic. No production matcher/handler integration approved yet; PO gates and Nguyên/Tân reservations unchanged. Release writer after keyed history save; runtime resume remains unverified.
