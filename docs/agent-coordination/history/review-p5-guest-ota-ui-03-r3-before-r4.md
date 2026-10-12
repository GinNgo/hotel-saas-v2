# Review P5-GUEST-OTA-UI-03 — round 3

TaskId: P5-GUEST-OTA-UI-03
Round: 3
SubmissionId: sub-p5-guest-ota-ui-03-r3-20261011
Decision: **ChangesRequested — evidence identity correction only**

## Findings

1. P2 — source-manifest.json test-file SHA256 does not match current source: public-booking.page.spec.ts is63165 bytes with actual hash0F8A411FE369280BD0C68E3BA524668B0B88881886A0789E2F531C6CF86337ED, not8AE8FBE88E697334791E885B9E00A69D926EE7BCE902EB4377A55C0CFEB9C104. Lazy booking chunk hash matches51A70910292857B6D0F7CF610BDBD8EC0175BBD43B89096E4AFF9CB8864644DD, but actual size is72447 bytes, not74188. Correct source-manifest, main manifest and submission consistently from actual bytes, preserving honest capture/source identity. If the test changed after capture, identify that sequence rather than declaring old hash matched. No new production code or complete browser rerun needed.
2. P3 — mobile-form screenshot shows input bodies/hold CTA clear of fixed bars, but the name LABEL is partly covered by the header. Narrow “all form fields fully visible” wording to observed input bodies, or use an existing slightly higher scroll capture that includes label. Do not infer every label/focus state from inputRect alone. Loading/error/retry and full keyboard cycle were not executed in this UI capture; retain explicit NOT TESTED rather than claiming old P7 evidence is automated integration of this new template.

## Accepted Scope and Independent Validation

Visible illustration disclosures moved outside cropped SVG; room cards screenshot shows readable disclosure overlays, verified DTO room specs/availability and estimate labels. Neutral pricing copy and scroll-mt-24 added. Viewed availability1440, mobile form375 and updated selected-room768: availability heading and tablet quote heading clear header; mobile inputs and hold CTA clear sticky footer. Accept these production presentation fixes and bounded visual observations; no new layout rewrite requested. Historical pre-round1 untracked baseline absence is now honestly disclosed, not reconstructed.

Strict Node JSON.parse accepted manifest, source-manifest and capture-log. All12 PNG byte counts/hashes match; booking.page.ts84938 bytes/hashB8C969519A2E94EE2F4DB41F35F906B18EA4E0F575600629094249231F7EAF74 matches. All5 served asset hashes including lazy booking chunk match BEFORE reviewer build. Only test hash and lazy byte metadata fail as listed. Images after768/after375/selected1440/selected375 are reused from round2 (same hashes), not fresh full round3 viewport captures. Treat them as unchanged-state reference images, not blanket latest-build evidence. Capture log links new scenes to action/time/scroll/rectangles; reviewer did not independently replay CDP.

Reviewer independent targeted command in frontend: node ./node_modules/vitest/vitest.mjs run src/app/features/public-booking/public-booking.page.spec.ts src/app/core/services/public-booking.service.spec.ts —57/57 PASS,2 files,exit0. npm run build —exit0, lazy booking72.45kB; existing sweetalert2 CommonJS optimization warning. Source/mocked tests are not rendered-browser assurance. Build regenerates local dist; no backend startup/real DB/migration/deploy/commit/dependency change. Checkout develop/3f95339b4f4477ac5d421551d372dfdd5ed31e30; no historical source-attribution reconstruction accepted.

## Next

Round4/new submissionId in SAME authorized task: metadata/caption/limitations corrections only, no production redesign, no repeat races or all screenshots. Recompute source and lazy bytes/hashes and validate consistency; distinguish new captures from reused images. Keep NOT TESTED browser checks and old P7 evidence scope honest. Preserve all accepted UI improvements and seven PO gates/team reservations. Archive current evidence/submission before replacement, writer none when Submitted. Update reviewedSubmissionId, save keyed review and release writer. No automatic Antigravity resume asserted.
