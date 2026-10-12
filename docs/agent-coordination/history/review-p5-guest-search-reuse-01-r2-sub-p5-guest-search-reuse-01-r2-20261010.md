# Review P5-GUEST-SEARCH-REUSE-01 — ChangesRequested (round 2)

- taskId: P5-GUEST-SEARCH-REUSE-01
- round: 2
- submissionId: sub-p5-guest-search-reuse-01-r2-20261010
- reviewedAt: 2026-10-10, Asia/Ho_Chi_Minh

## Findings

1. [P1] booking.page.ts:445-453 đổi cơ sở và reset selection nhưng không xóa availabilityList cũ trước request B; danh sách A vẫn render và nút selectRoomType vẫn hoạt động trong lúc B pending/error. Khách có thể chọn lại roomType A dưới slug B; submitHold chỉ so selectedProp.slug với slug, không xác minh roomType provenance. Clear/invalidate availability đồng bộ khi context đổi (property/time-window), không cho chọn item chưa thuộc kết quả hiện hành. onSearchCriteriaChange:503 chỉ invalidate quote, không invalidate availabilityRequestId; response cùng property cho thời gian cũ vẫn được chấp nhận. Tests phải cover chọn card A trong lúc B pending/error, và availability cũ về sau đổi ngày/loại thuê mà chưa bấm search lại.
2. [P2] Debounce vẫn bị bypass: template:88 giữ (input)=onPropertySearchInput() và method:476 gọi loadProperties ngay; valueChanges lại gọi sau300ms. Mỗi ký tự vẫn tạo request tức thì, thêm request debounced. Bỏ đường immediate input trùng, dùng một pipeline; hủy subscriptions HTTP khi superseded/destroy hoặc lifecycle-aware stream. ngOnDestroy hiện chỉ unsubscribe searchSubscription, không các HTTP requests. Test bằng fake timers và input DOM thực để xác minh số lần gọi, clear/manual search không duplicate, destroy không cập nhật state.

## Đã đóng / validation

Source xác nhận normalize keyword một lần, đúng Name/Id ordering, publication/API unchanged; submission đã gọi scan là in-memory filter thay bounded query. Counter quote và cross-property availability đã được bổ sung nhưng chưa cover context/state ở finding1. Độc lập Vitest feature+service:23/23,2files,exit0; dotnet VietnameseTextNormalizerTests:47/47,exit0,unit-only. Không chạy DB/HTTP/full suite/build; writer65/153 không phải kết quả reviewer. Submission không kèm đường dẫn log thực dù nói evidence; bổ sung khi resubmit, không cần vòng tài liệu riêng. Không kiểm chứng unaccent installation trên DB, không truy cập DB. Dirty baseline không có snapshot delta riêng.

## Next action

Resubmit round3 cùng task với fixes/tests trên, không đổi API/schema/publication hoặc modules team. Không mở P6. Lưu history/review, release writer=none có guard; PO questions giữ nguyên. Không claim runtime tự resume.
