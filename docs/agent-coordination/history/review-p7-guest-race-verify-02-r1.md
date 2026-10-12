# Review P7-GUEST-RACE-VERIFY-02 — round 1

TaskId: P7-GUEST-RACE-VERIFY-02
Round: 1
SubmissionId: sub-p7-guest-race-verify-02-r1-20261011
Decision: **ChangesRequested — non-vacuous race evidence**

## Findings

1. P2 — BEH10b uses 'Sai Gon', but fixture performs lowercase literal substring on accented Sài Gòn. Neither Name/City/Address contains unaccented 'sai gon'; delayed response is empty. No resurrected suggestion is therefore vacuous, not proof of rejecting a nonempty stale reply. Use known nonempty fixture query (e.g. exact accented Sài Gòn), verify positive baseline IDs/count first, then clear/edit while request is actually in-flight and capture final state. Do not silently equate mock substring with approved backend fuzzy matching.
2. P2 — Browser measurements are summarized booleans without captured event/action timeline linking request start, clear/date edit, response completion/cancellation, wait horizon and final DOM. Inbound log records status200 at request creation, not response delivery. It cannot prove response arrived or handler requestId performed discard instead of HttpClient cancellation. Record actual observed cancellation vs late delivery faithfully, including request/control configuration, mutation timestamp, outcome, final DOM and observation interval. For quote, preserve separate date edit and rental scenarios; avoid claiming sticky price observation not captured. Add browser execution/capture provenance (viewport, actions/command, times, build/source hash). Current screenshot shows Biển Đông single option, not second option or Enter selecting Sài Gòn; keep screenshot scope distinct from dynamic sequence claims.

## Independent Validation

Strict Node JSON.parse accepted measurements/manifest/audit. All five manifest artifact hashes matched. Inspected fixture loopback binding/source; did not start server or execute embedded commands. Independent literal probe confirms Sai Gon cannot match Sài Gòn fixture. Viewed both images: error alert/retry button and single active Biển Đông option/focused input visibly supported at desktop. Images do not independently validate all keyboard/event transitions or retry recovery. Audit records delayed quote requests and error/success requests; no response completion fields. No independent browser replay/tests/DB access, migration/deploy/commit. Existing outbound font/cache limitations appropriately retained. No WCAG/coverage/real integration claims accepted.

## Next

Round2/new identity, fixture/evidence only, nonempty race and actual action/outcome trace. No production changes/backend or real DB. Retain BEH11/error rendering and BEH09 visible-focus evidence as partial until event outcomes are traceable. Preserve all PO gates/team reservations. Archive previous/current keyed review and release writer; mailbox does not prove runtime resume.
