# Submission GUEST-ROOM-MEDIA-PLAN-01 — Round 3

- **TaskId:** `GUEST-ROOM-MEDIA-PLAN-01`
- **Round:** 3
- **SubmissionId:** `sub-guest-room-media-plan-01-r3-20261013`
- **ReviewedSubmissionId:** `sub-guest-room-media-plan-01-r2-20261013`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-13T08:24:00+07:00` (UTC: `2026-10-13T01:24:00Z` — Đồng hồ cục bộ, không xác thực độc lập)
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Tổng Quan Cập Nhật Theo Phản Hồi Vòng 2 (Review Findings Resolution)

Bản đệ trình Vòng 3 giải quyết triệt để điểm phản hồi [P2] từ Codex Reviewer trong `docs/agent-coordination/review.md`:

### 1.1. Khắc Phục Lỗi Đánh Giá Lại Biểu Thức Template Khi Sự Kiện Kích Hoạt:
- **Nguyên nhân kỹ thuật được chỉ ra:** Khi template truyền trực tiếp các thuộc tính component như `availabilityRequestId` hay `selectedProperty()`, biểu thức Angular trong `(error)` được đánh giá lại tại thời điểm sự kiện kích hoạt (runtime evaluation). Khi đó, nếu component đã chuyển sang cơ sở mới hoặc thế hệ tìm kiếm mới, tham số được truyền vào hàm là ID mới, khiến phép so sánh `eventRequestId !== this.availabilityRequestId` so sánh ID mới với chính nó và **không thể nhận diện sự kiện muộn của ảnh cũ**.
- **Giải pháp Vòng 3:**
  - Thiết kế kiểu dữ liệu ảnh chụp ngữ cảnh render bất biến:
    ```typescript
    export interface RoomImageRenderContext {
      readonly propertyId: string;
      readonly generation: number;
      readonly roomTypeId: string;
      readonly url: string;
    }
    ```
  - Khi nhận dữ liệu availability, mỗi phần tử được gắn sẵn `imageContext` bất biến đóng băng 4 thông tin: `propertyId`, `generation`, `roomTypeId`, `url`.
  - Template truyền trực tiếp snapshot `imageContext` vào hàm bắt lỗi: `(error)="onRoomImageError(item.imageContext)"`.

### 1.2. Đóng Chặt Cơ Chế Khi Thiếu Property (Fail Closed, Loại Bỏ 'global' Fallback):
- Khi `selectedProperty()` là `null`, `isImageAvailable` trả về `false`, không render ảnh, không dùng chuỗi `'global'` làm giá trị dự phòng.
- Trong handler `onRoomImageError(ctx)`: nếu không có `currentProperty` hoặc `currentProperty.id !== ctx.propertyId`, sự kiện lỗi lập tức bị hủy bỏ (bỏ qua sự kiện từ cơ sở cũ).

### 1.3. Kháng Sự Kiện Muộn Trên DOM Thực Tế (Mounted DOM Late Event Cases):
- Khi chuyển cơ sở A $\to$ B hoặc khi làm mới thế hệ tìm kiếm (generation $1 \to 2$):
  - Thẻ `<img>` cũ còn gắn trên DOM phát sinh sự kiện lỗi muộn: `imgElement.dispatchEvent(new Event('error'))`.
  - Handler đối chiếu `ctx.propertyId !== currentProperty.id` hoặc `ctx.generation !== this.availabilityRequestId` và **bỏ qua hoàn toàn**, không ghi nhận khóa lỗi cho cơ sở mới.

### 1.4. Bộ Tiêu Chí Nghiệm Thu Mở Rộng (AC-MEDIA-01 đến 09):
- Bổ sung đầy đủ 9 tiêu chí chấp nhận dựa trên nguồn:
  - AC-MEDIA-01: Fail closed khi thiếu Property.
  - AC-MEDIA-02: Fallback an toàn với URL null/rỗng/khoảng trắng.
  - AC-MEDIA-03: Bắt lỗi ảnh vỡ runtime với snapshot chính xác.
  - AC-MEDIA-04: Render bình thường khi cùng `roomTypeId` nhận URL mới.
  - AC-MEDIA-05: Bỏ qua sự kiện lỗi muộn từ DOM cũ khi chuyển cơ sở A $\to$ B (`imgElement.dispatchEvent`).
  - AC-MEDIA-06: Bỏ qua sự kiện lỗi muộn từ DOM cũ khi làm mới thế hệ tìm kiếm.
  - AC-MEDIA-07: Cô lập khóa lỗi giữa các cơ sở dù trùng `roomTypeId` hay `url`.
  - AC-MEDIA-08: Thao tác retry tường minh cho cùng URL.
  - AC-MEDIA-09: Bảo toàn thuộc tính `[alt]="item.roomTypeName"` cho media hiện có.

---

## 2. Danh Sách Tài Liệu & Bằng Chứng Trình Duyệt

| STT | Đường Dẫn Tệp | Mô Tả & Nội Dung |
|:---:|---|---|
| 1 | [`docs/agent-coordination/media-integration-plan.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/media-integration-plan.md) | Kế hoạch tích hợp media Vòng 3: chụp ảnh ngữ cảnh render bất biến `RoomImageRenderContext`, đóng chặt khi thiếu Property, xử lý sự kiện DOM muộn, 9 tiêu chí AC-MEDIA-01 đến 09. |
| 2 | [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) | Cập nhật round 3, submissionId `sub-guest-room-media-plan-01-r3-20261013`, giải phóng khóa `writer: "none"`, trạng thái `Submitted`. |
| 3 | [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) | Báo cáo đệ trình Vòng 3 của nhiệm vụ `GUEST-ROOM-MEDIA-PLAN-01`. |

---

## 3. Cam Kết Giới Hạn & Tính Toàn Vẹn Hệ Thống (Bounded Constraints)

- **Không can thiệp mã nguồn thực thi:** Nhiệm vụ này thuần túy là khảo sát và lập đề xuất kỹ thuật; không có bất kỳ dòng code nào được thay đổi trên backend, frontend, database hay script seed.
- **Không xâm phạm ranh giới đồng đội:** Giữ nguyên vẹn toàn bộ module buồng phòng của Tân (`Housekeeping`) và danh mục phòng của Nguyên (`Rooms`, `RoomTypes`).
- **Không tự động duyệt cổng nghiệp vụ:** Tiếp tục giữ nguyên 7 Cổng quyết định PO trong `decisions.md` ở trạng thái `NeedsPO`. Phase 6 (AI Search) tiếp tục đóng.
- **Không thêm dịch vụ ngoài:** Không cấu hình CDN, không gọi API bên ngoài, không thêm kết nối cloud.