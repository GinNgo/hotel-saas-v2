# Review P7-FUZZY-CONTRACT-VERIFY-02 — round 1

TaskId: P7-FUZZY-CONTRACT-VERIFY-02
Round: 1
SubmissionId: sub-p7-fuzzy-contract-verify-02-r1-20261011
Decision: **ChangesRequested — evidence classification**

## Findings

1. P2 — New service test labeled latest-request-wins merely subscribes twice and flushes older response first, then newer response. It demonstrates independent requests/consecutive completions, not stale-response rejection. PublicBookingService itself does not enforce latest-wins. Rename test/report to actual behavior; cite existing page race tests separately or add page-level newer-first/late-older behavior test if needed, without changing runtime service semantics. Do not call sequential flush evidence a race verification.
2. P2 — Serializer time/value preservation assertions only require string and colon, not expected values; name/code/slug/address/city only checked for type/nonblank elsewhere. Assert per-property projection values including distinct checkIn/checkOut times, buffer/hours and full exact JSON key sets using current options. Current fixtures all share time/numeric values, masking field swaps. Report says 14:00/12:00 while default TimeOnly serializer typically emits seconds; use actual exact output, not invented formats. No HTTP claims from serializer/reflection tests. Record serializer options as source-equivalent copy, not runtime-resolved DI options. Manifest runtime/node versions should be observed exact values or explicitly unverified, not v22.x/net10.0(10.0.9) presented as measured.

## Independent Validation

Read tests/fake helpers before execution; synthetic context no DB configuration. Program.cs confirms CamelCase/WhenWritingNull/StringEnum settings copied by tests. Ran filtered three backend classes --no-restore: exit0,85 passed,0 failed/skipped. Ran existing Vitest two files: exit0,56 passed,2 files. All10 manifest source hashes matched current files. Logs support writer test counts, not universal coverage/browser/SQL/HTTP transport correctness. Fake strips EF annotations; no DB/backend startup, migration/deploy/commit or production edits by reviewer.

## Next

Round2/new identity, tests/evidence corrections only. Preserve existing API/array/Active-only and production UI behavior; all PO gates/team reservations unchanged. No new dependency/DB harness or production changes. Save prior/current keyed review history and release writer. Runtime resume not established by mailbox.
