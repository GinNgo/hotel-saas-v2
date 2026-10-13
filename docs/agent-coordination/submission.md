# Submission GUEST-ROOM-MEDIA-PLAN-01 — Round 2

- **TaskId:** `GUEST-ROOM-MEDIA-PLAN-01`
- **Round:** 2
- **SubmissionId:** `sub-guest-room-media-plan-01-r2-20261013`
- **ReviewedSubmissionId:** `sub-guest-room-media-plan-01-r1-20261012`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-13T08:12:00+07:00` (UTC: `2026-10-13T01:12:00Z` — Đồng hồ cục bộ, không xác thực độc lập)
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Tổng Quan Cập Nhật Theo Phản Hồi Vòng 1 (Review Findings Resolution)

Bản đệ trình Vòng 2 giải quyết toàn diện 3 điểm phản hồi (Findings 1, 2, 3) từ Codex Reviewer trong `docs/agent-coordination/review.md`:

### 1.1. Giải quyết Finding 1 [P1] — Phân tách Broken-Image Fallback khỏi AI Provenance:
- **Hiện tượng cũ:** Mục 4.1 trong Vòng 1 gán nhãn "Ảnh minh họa AI" cho mọi URL và tự động chèn chú thích minh họa vào thuộc tính `alt`.
- **Khắc phục Vòng 2:**
  - Lát cắt tối thiểu được phân tách độc lập, chỉ tập trung vào **xử lý lỗi ảnh vỡ (Broken-Image Error Fallback)** cho bất kỳ phương tiện media nào hiện có.
  - Hợp đồng DTO công khai hiện tại chỉ có `imageUrl?: string`, không có trường chỉ báo xuất xứ (provenance discriminator). Không suy diễn AI hay ảnh thật dựa trên sự có mặt của URL hay mã/tên phòng.
  - Bảo toàn nguyên vẹn thuộc tính `[alt]="rt.roomTypeName"` cho thẻ `<img>`.
  - Khối SVG dự phòng tiếp tục mang nhãn minh họa kiến trúc (`"Hình minh họa — bố trí phòng mẫu"` / `"HÌNH MINH HỌA HẠNG PHÒNG"`).
  - Huy hiệu AI được tách rời hoàn toàn và chỉ hiển thị khi có siêu dữ liệu xuất xứ demo được xác minh rõ ràng (verified explicit demo provenance) hoặc khi có hợp đồng mới được phê duyệt riêng biệt trong tương lai.

### 1.2. Giải quyết Finding 2 [P2] — Quản lý Khóa Lỗi Theo Ngữ Cảnh, Thế Hệ & URL, Hỗ Trợ Retry:
- **Hiện tượng cũ:** `failedRoomImageIds` chỉ lưu `roomTypeId`, khiến một URL mới cho cùng loại phòng bị kẹt lỗi vĩnh viễn, và sự kiện lỗi muộn từ ảnh cũ có thể vô hiệu hóa ảnh mới.
- **Khắc phục Vòng 2:**
  - Nâng cấp cơ chế quản lý lỗi thành `failedImageKeys = signal<Set<string>>(new Set())` với khóa định danh đầy đủ theo ngữ cảnh: `${propertyId}:${roomTypeId}:${url}`.
  - Bộ bắt lỗi nhận tham số thế hệ: `onRoomImageError(roomTypeId, url, eventRequestId)`. Bỏ qua sự kiện lỗi đến muộn nếu `eventRequestId !== this.availabilityRequestId` hoặc URL trống.
  - Khi cùng một `roomTypeId` nhận URL mới, URL mới có key khác nên được phép render ngay lập tức.
  - Bổ sung phương thức thử lại tường minh `retryRoomImage(roomTypeId, url)` giúp xóa khóa lỗi và thử tải lại tài nguyên khi cần.
  - Bổ sung đầy đủ 7 tiêu chí chấp nhận hành vi dựa trên nguồn (AC-MEDIA-01 đến 07) gồm URL mới cho cùng ID, sự kiện lỗi trễ sau chuyển cơ sở, URL rỗng/trắng, và retry.

### 1.3. Giải quyết Finding 3 [P2] — Hiệu Chỉnh Khảo Sát Mã Nguồn & Giảm Thiểu Tuyên Bố Tuyệt Đối:
- **Hiện tượng cũ:** Khảo sát ngụ ý mã nguồn chứng minh cột cơ sở dữ liệu vật lý tồn tại và seeder chứng minh toàn bộ dữ liệu DB là null; có các tuyên bố "100% race-proof / ngăn chặn tuyệt đối".
- **Khắc phục Vòng 2:**
  - Mục 1.2 nêu rõ: trường `RoomType.ImageUrl` được định nghĩa trong mô hình C# và phép chiếu EF Core, nhưng cơ sở dữ liệu vật lý runtime là **CHƯA ĐƯỢC XÁC MINH (DB NOT VERIFIED)**.
  - Mục 1.4 nêu rõ: `LocalDevDataSeeder` khi tạo mẫu mới bỏ qua `ImageUrl`, nhưng điều này không chứng minh toàn bộ dữ liệu DB hiện hữu có null hay không (`DB NOT VERIFIED`).
  - Thay thế các tuyên bố tuyệt đối bằng mô tả kỹ thuật chính xác về cơ chế hủy subscription và tăng thế hệ request ID.

### 1.4. Phân Tách Các Vấn Đề Dài Hạn Khỏi Lát Cắt Giao Diện:
- Khẳng định rõ: Việc xử lý ảnh vỡ trên giao diện là chi tiết UI thông thường, **không đòi hỏi PO phê duyệt lại nghiệp vụ hay cấp hạ tầng mới**.
- Các vấn đề: Cung cấp ảnh thật, bản quyền, migration lược đồ `Property.ImageUrl` và hạ tầng Blob Storage là các chủ đề dài hạn, độc lập và không phải là điều kiện tiên quyết (non-blocking) đối với lát cắt này.

---

## 2. Danh Sách Tài Liệu & Bằng Chứng Trình Duyệt

| STT | Đường Dẫn Tệp | Mô Tả & Nội Dung |
|:---:|---|---|
| 1 | [`docs/agent-coordination/media-integration-plan.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/media-integration-plan.md) | Kế hoạch tích hợp media Vòng 2: khảo sát source-backed hiệu chỉnh, phân tách broken-image fallback độc lập, quản lý khóa lỗi theo ngữ cảnh/URL, phương thức retry, 7 tiêu chí chấp nhận AC-MEDIA-01 đến 07. |
| 2 | [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) | Cập nhật round 2, submissionId `sub-guest-room-media-plan-01-r2-20261013`, giải phóng khóa `writer: "none"`, trạng thái `Submitted`. |
| 3 | [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) | Báo cáo đệ trình Vòng 2 của nhiệm vụ `GUEST-ROOM-MEDIA-PLAN-01`. |

---

## 3. Cam Kết Giới Hạn & Tính Toàn Vẹn Hệ Thống (Bounded Constraints)

- **Không can thiệp mã nguồn thực thi:** Nhiệm vụ này thuần túy là khảo sát và lập đề xuất kỹ thuật; không có bất kỳ dòng code nào được thay đổi trên backend, frontend, database hay script seed.
- **Không xâm phạm ranh giới đồng đội:** Giữ nguyên vẹn toàn bộ module buồng phòng của Tân (`Housekeeping`) và danh mục phòng của Nguyên (`Rooms`, `RoomTypes`).
- **Không tự động duyệt cổng nghiệp vụ:** Tiếp tục giữ nguyên 7 Cổng quyết định PO trong `decisions.md` ở trạng thái `NeedsPO`. Phase 6 (AI Search) tiếp tục đóng.
- **Không thêm dịch vụ ngoài:** Không cấu hình CDN, không gọi API bên ngoài, không thêm kết nối cloud.