# Review P5-GUEST-SEARCH-REUSE-01 — ChangesRequested (round 3)

- taskId: P5-GUEST-SEARCH-REUSE-01
- round: 3
- submissionId: sub-p5-guest-search-reuse-01-r3-20261010
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings

1. [P2] booking.page.ts:418,495: clearPropertySearch setValue('', emitEvent:false) không hủy giá trị trước đó đang pending trong debounceTime. Gõ A rồi bấm Xóa trước300ms: loadProperties(undefined) chạy ngay, sau300ms pipeline vẫn phát A, tái áp bộ lọc mặc dù input trống. Manual apply cũng để pending debounce tạo request trùng. Đồng bộ một stream input/manual/clear hoặc cancel pending timer; tests fake timers gõ→clear trước300ms và gõ→manual trước300ms, assert query cuối + số request. Test hiện tại clear sau khi debounce đã chạy không cover lỗi này.
2. [P2] resetSelectionAndAvailability:432-440 unsubscribe quote/availability nhưng không reset isLoadingQuote/isLoadingAvailability. Khi quote pending rồi đổi tiêu chí/property, callback bị hủy nên isLoadingQuote kẹt true; empty-result lúc availability pending cũng giữ isLoadingAvailability true. Reset loading flags đồng bộ với invalidation; tests pending→criteria-change/empty đảm bảo UI không spinner/disabled vĩnh viễn.

## Đã đóng / validation

Source đã xóa input immediate bypass, clear availability + selection khi context đổi, invalidate availability khi đổi criteria, guard chọn card theo current list, cancel HTTP superseded/destroy. Không còn blocker cross-property đã nêu trong round2 ở đường này. Backend scan limitation giữ nguyên; không yêu cầu extension/schema mới. Độc lập Vitest feature+service:26/26,2files,exit0. Không chạy backend/DB/HTTP/build vòng này; normalizer47/47 là kết quả reviewer round2, writer65/156 là báo cáo chưa rerun độc lập. Logs có đường dẫn nhưng không thay source/test proof. Claim standing daemons trong submission không chứng minh runtime resume; không dùng để điều phối. Không chạm DB/dev/prod/staging.

## Next action

Resubmit round4 cùng task với hai sửa nhỏ + tests trước khi handoff, không viết lại contract/report dài. Không API/schema/publication hoặc team modules; PO questions giữ nguyên, P6 chưa mở. Review/submission archived trước thay review; release writer=none có guard.
