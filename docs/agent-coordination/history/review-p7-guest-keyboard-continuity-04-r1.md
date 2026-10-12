# Review — P7-GUEST-KEYBOARD-CONTINUITY-04 round 1

- taskId: P7-GUEST-KEYBOARD-CONTINUITY-04
- round: 1
- submissionId: sub-p7-guest-keyboard-continuity-04-r1-20261011
- reviewer: codex
- outcome: Approved — bounded synthetic traversal evidence
- ReviewedAt: 2026-10-11T16:45:18.991Z

## Findings / limitations first

No blocking source defect established for this narrow traversal slice. The chronological writer trace records8 mobile and11 hourly reverse keys from enabled CTA, disabled decrement skipped, repeated hourly date-input activeElement observations, and no declared intervening focus reset. This is submitted writer evidence, NOT independent reviewer CDP replay or an authenticated raw tool transcript.

:focus-visible=true alone does not prove a visible ring: several inner input/select outlines are transparent or none, and hourly key3 reports false. Source has ancestor focus-within styling (destination/date/guest containers); submitted log lacks ancestor computed observations. Thus per-control visual focus acceptance is bounded, not a whole-page accessibility certification. Repeated date activeElement establishes element-level continuity, not independent verification of the named year/month/day/calendar subfield labels.

## Independent checks

- Opened both PNGs:375x812 mobile and1440x900 hourly desktop show final header lookup focus. They support final visual states, not a photograph of every key.
- Both PNG byte counts/SHA256 match manifest; all five served-build hashes match local dist.
- booking.page.ts/public-booking.page.spec.ts hashes unchanged from approved source. Prior state-verification network-audit.json remains1582F669... unchanged.
- Checkout develop HEAD3f95339b4f4477ac5d421551d372dfdd5ed31e30. Inspected isolated fixture path, loopback bind and source ancestor focus-within classes; did not start server or alter old audit.
- No fresh tests/build for unchanged source/test/build; historical57 tests/build0 remain historical only.
- No backend/DB/team/source/dependency/commit/deploy/migration changes. No native mobile software keyboard, screen-reader, outbound isolation, payment/booking production acceptance or universal WCAG claims.

## Queue audit after approval

Newest assignment records this slice Approved and audits remaining queue. P2-P4 and existing independent P5/P7 slices are already reviewed per assignment; Rooms/RoomTypes and Housekeeping remain reserved; no uncompleted independent implementation with an approved business contract remains. Do NOT rerun old evidence or invent an ApprovedNext task solely to keep busy.

Remaining work is dependent on seven existing decisions.md gates: D21 TTL/revoke/reissue, quote-to-hold price pin/stale acknowledgement, search API compatibility, publication Active/IsPublished, licensed versioned geography dataset, geographic schema/migration, two-step vs aggregated inventory. P6 stays unopened. Approval of this synthetic evidence does not approve those gates. Await PO contract decision, then select dependency-ready task and publish ApprovedNext. No runtime auto-resume claim.
