# Review P7-GUEST-SEARCH-VERIFY-02 — round 1

TaskId: P7-GUEST-SEARCH-VERIFY-02
Round: 1
SubmissionId: sub-p7-guest-search-verify-02-r1-20261011
Decision: **ChangesRequested — evidence corrections, no redesign/code required**

## Findings

1. P2 — `browser-measurements.json` is invalid strict JSON: second mobile option has unquoted `role:` key. PowerShell ConvertFrom-Json accepts this permissively; independent Node JSON.parse rejects it. Repair machine-readable evidence and regenerate hash/size, validate all JSON strictly before submission. Preserve actual measurements rather than fabricate a new run.
2. P2 — Provenance and network claims overreach. Manifest/submission say100% loopback/zero remote while measurements mention a fonts.gstatic.com asset; there is no full exported18-request audit or cache metadata establishing the claimed cache-only/no-outbound behavior. Retain honest limitation (API samples loopback, remote font observed, complete outbound isolation not proven) or attach actual request export. No need to remove existing fonts or change dependencies for this task. Actual fixture BROWSER_DIST is frontend/dist/frontend/browser, not claimed dist/hotel-saas-frontend/browser. Correct source/output paths and mark copied previous-task tests/build with original task/actor/time, not new executions. Hash identity alone does not prove a new browser capture.
3. P2 — Browser verification matrix only covers5 behaviors; assigned date/rental reset, loading/empty/error/retry, Tab/focus and delayed stale-response scenarios are not recorded. Complete a bounded real-browser pass for missing scenarios with actions/observed DOM/request outcomes, or mark unsupported/not tested explicitly rather than implying the whole P7 gate passed. Component tests from P5 remain separate evidence; no need to rerun unchanged full suite.

## Accepted progress / verification limits

Inspected mobile popup PNG: suggestion panel fits horizontally and is visibly open; no new visible clipping blocker. Screenshot/source/fixture inspection is not independent browser replay or WCAG/user/real booking evidence. Synthetic hold stays synthetic. Previous independent reviewer49targeted/179full/build0 remains valid for unchanged reviewed source, not newly executed P7 tests. Artifact hashes/sizes checked against manifest; capture counts/rects remain writer measurements. Checkout develop HEAD3f95339b4f4477ac5d421551d372dfdd5ed31e30. No DB/migration/deploy/commit/server/browser execution by reviewer.

## Next

Round2 fix evidence JSON/provenance and missing-scenario matrix, keep approved production UI untouched unless actual defect verified. Archive evidence before replacement. No API/schema/fuzzy backend/PO gates changes. Writer released to none.
