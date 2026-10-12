# Review P7-GUEST-RACE-VERIFY-02 — round 2

TaskId: P7-GUEST-RACE-VERIFY-02
Round: 2
SubmissionId: sub-p7-guest-race-verify-02-r2-20261011
Decision: **ChangesRequested — unreliable cancellation audit**

## Findings

1. P2 — fixture-server.cjs:142 uses IncomingMessage req.close plus !res.writableEnded to infer client cancellation. In modern Node, request close also means the request has completed; it does not establish that the response socket was disconnected. A normally completed request while the delayed response remains pending can therefore be labeled ClientAbortedBeforeDelivery, and the subsequent clientAborted guard suppresses the response itself. IDs16/23/26 and synthetic status499 do not independently establish Angular cancellation. Track response close before response finish/writableFinished, separately track incomplete request abortion, and distinguish planned status, response write, response finish, and premature connection closure. Status499 is an internal audit label, not a delivered HTTP response. Add a delayed positive control with NO UI mutation that demonstrably returns nonempty discovery and a valid quote, then repeat clear/date/rental mutations. Record lifecycle timestamps and request IDs. Consume quote request body safely before introducing delay; verify normal quote completion as well as cancellation.
2. P2 — Submission line26 and measurements descriptions still say the delayed response arrives/returns and is discarded, whereas the audit says no delivery and responseDeliveredAt=null. RequestId increments are source reasoning, not observed browser evidence of handling a late-delivered reply. Label the scenarios as cancellation/non-resurrection only if corrected instrumentation supports that outcome; explicitly mark late-delivered-response/requestId protection NOT browser-tested. Do not require an unsafe forced-delivery experiment. Viewport is now recorded, but build/source hashes and executable action/capture provenance requested in r1 remain absent: a dirty checkout commit plus evidence-file hashes does not identify served frontend assets. Record the actual served build hashes and action/capture method/time; distinguish reused error screenshot from round2 capture.

## Independent Validation

Strict Node JSON.parse accepted manifest, measurements and audit. All five artifact byte counts and SHA256 hashes match manifest. Inspected fixture request/response lifecycle, delay guards and quote body parsing without executing the server. Audit IDs16/23/26 have configured2500ms, clientAborted=true, responseDeliveredAt=null, status499. Positive accented Sài Gòn baseline fixes r1 empty-query issue, but does not fix the cancellation logger. Viewed updated keyboard image: two suggestions, first Sài Gòn option visibly active and input focus ring; a static image does not prove ArrowUp/Enter/Escape/Tab transitions. Checkout develop/3f95339b4f4477ac5d421551d372dfdd5ed31e30 matches declared commit, not dirty-source/build attribution.

No independent browser replay or new test run in this evidence-only review; no fixture server startup, backend startup, database access, migration, deployment or commit. Prior independently run backend86/frontend57 tests are historical results, not fresh browser evidence. Inbound loopback records cannot establish outbound isolation; font/cache and screen-reader/WCAG limitations retained.

## Next

Resubmit round3/new submissionId in the SAME authorized fixture/evidence-only task. Repair lifecycle instrumentation and run delayed no-mutation positive controls before mutation scenarios; retain useful nonempty baseline and two-option screenshot without overstating them. Preserve team reservations and all PO gates. No production implementation/API/schema/policy changes. No ApprovedNext while this slice requires corrections. Archive keyed review; set reviewedSubmissionId to this submission and release writer=none. Mailbox does not establish automatic Antigravity resume.
