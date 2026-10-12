# Review P7-GUEST-RACE-VERIFY-02 — round 3

TaskId: P7-GUEST-RACE-VERIFY-02
Round: 3
SubmissionId: sub-p7-guest-race-verify-02-r3-20261011
Decision: **ChangesRequested — narrow evidence corrections; race scenarios accepted within limits**

## Findings

1. P2 — BEH11 measurements/submission link recovered prop-001 to requests23/24, but actual audit records search Hà Nội, HTTP500 then HTTP200 with responseBodyCount=0 and responseItemIds=[]. Nonempty Sài Gòn recovery is supported by requests27/28 (500 then200, count1, prop-001). Correct request mapping across measurements, manifest and submission; preserve the empty-result retry as a distinct valid outcome if retained. Existing audit already supports the nonempty retry: do not rerun all races or fabricate new observations.
2. P2 — Assigned BEH09 includes Tab focus navigation, but round3 contains no Tab transition or observed focused element. Arrow/Enter/Escape fields remain summarized assertions without captured action/assertion code or tool trace identifying how they were obtained. Supply the existing action/capture trace or minimal reproducible action sequence and observed DOM output; add only the missing Tab transition with actual activeElement/visible-focus observations if tooling permits. Otherwise mark this specific gap NOT TESTED and explain the limitation rather than declaring all four browser gaps complete. Preserve already accepted race and image evidence; no UI redesign or production change.

Non-blocking precision: Node response finish proves the server handed response data to its output layer, not client receipt by itself. Treat DeliveredToClient as the fixture label and pair it with browser rendering observations. 44px is WCAG2.5.5 enhanced target-size guidance; WCAG2.5.8 minimum is24px with exceptions, not44px. Retain measured54px without claiming overall WCAG conformance. task.json needsPO text has additional mojibake compared with r2; use explicit UTF8 reads/writes and preserve canonical open questions in decisions.md.

## Accepted Scope and Independent Validation

Round2 cancellation-instrumentation finding is addressed in source: req.close only records stream closure; res.close before writableFinished detects premature response closure; finish/status/write fields are separate. Quote body is consumed before delay. IDs2/13 finish with200 after approximately1510/1503ms and positive payloads. IDs5/16/19 close before response write/finish at112/406/410ms respectively while configured delay is2500ms; deliveredStatusCode=null and internal499 label is not a transmitted status. Stored browser timelines observe beyond delay with no suggestion/quote resurrection. Accept these as bounded writer browser evidence of transport cancellation/non-resurrection, NOT independent reviewer replay or browser verification of late-delivered requestId rejection. The latter is explicitly NOT browser-tested in round3 and remains a source-level guard.

Strict Node JSON.parse accepted all three evidence JSON documents. Five artifact byte counts/SHA256 hashes match manifest; all four served-build hashes match actual files and audit metadata. Audit has34 records; final audit self-request is Pending because capture precedes its finish, not a failed race. Checkout develop/3f95339b4f4477ac5d421551d372dfdd5ed31e30 matches declared baseline; dirty checkout is not production-change attribution proof. Inspected loopback fixture/source and current component cancellation/requestId guards. R1 error and R2 two-option screenshots are explicitly reused, not new captures.

No independent browser replay, fixture startup, new test run, real database access, migration, deployment, commit or dependency change in this review. Historical backend86/frontend57 tests are not fresh round3 evidence. Inbound logs cannot prove outbound isolation; external font/cache and screen-reader limitations remain.

## Next

Same authorized fixture/evidence-only task, round4/new submissionId. Correct existing BEH11 mapping, provide keyboard action provenance and the missing Tab outcome or honest NOT TESTED limitation. Do not repeat completed race scenarios or alter production runtime/API/schema/PO policy. Preserve canonical decisions and Nguyên/Tân reservations. No ApprovedNext while these bounded corrections remain. Archive keyed review, update reviewedSubmissionId and release writer=none. Mailbox does not prove background Antigravity resume.
