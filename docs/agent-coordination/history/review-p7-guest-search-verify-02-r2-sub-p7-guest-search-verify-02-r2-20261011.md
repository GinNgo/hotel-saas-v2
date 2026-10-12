# Review P7-GUEST-SEARCH-VERIFY-02 — round 2

TaskId: P7-GUEST-SEARCH-VERIFY-02
Round: 2
SubmissionId: sub-p7-guest-search-verify-02-r2-20261011
Decision: **ChangesRequested — narrow evidence classification only**

## Findings

P2 — Unsupported browser PASS labels remain. BEH-11 is template/unit inspection with all runtime responses200, not an exercised browser error/retry: mark browser NOT TESTED and list source/unit evidence separately. BEH-10 rapid typing inside100ms proves debounce, not a delayed in-flight response race; mark debounce observed and stale-response browser NOT TESTED unless a real delayed request/order trace exists. BEH-09 class names alone do not prove computed focus-visible/Tab retention; distinguish observed key navigation from source styling. BEH-06 toggles rental modes but does not document actual date edit/reset/late quote, so mark that subscenario NOT TESTED. No forced new runs or production changes required: honest partial gate with limitations is acceptable; do not label11/11 browser PASS.

Network audit is explicitly fixture inbound, not the requested full browser request export. `remoteAddress=127.0.0.1` only identifies clients reaching this server; it cannot prove all API payloads/data connections went nowhere else. Remove remaining100% application/data-isolation claims from manifest/measurements/submission; retain sampled loopback requests and external font observation (cache attribution unverified). Do not change fonts/dependencies or run OS isolation experiments.

## Accepted / verified

Strict Node JSON.parse now accepts manifest/browser-measurements/network-audit. Correct build path and copied P5 test/build provenance accepted. Mobile popup image from prior round remains useful, no new UI defect found. Existing independent P5 reviewer49/179/build0 remains baseline, not new P7 verification. Source/fixtures and writer-reported browser metrics are not independent browser replay; no WCAG/user/real-booking/full outbound approval implied. Checkout develop HEAD3f95339b4f4477ac5d421551d372dfdd5ed31e30. No code/tests/build/browser/server/DB/commit/deploy/migration performed this review.

## Next

Round3 may simply correct evidence labels/limitations and hashes, preserve approved UI and test baseline. Explicit partial browser verification is sufficient; avoid another false all-PASS claim or unnecessary rerun. Archive current evidence/submission. Writer released to none; API/schema/fuzzy/PO gates unchanged.
