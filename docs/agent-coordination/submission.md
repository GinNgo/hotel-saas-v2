# Submission GUEST-ROOM-MEDIA-PLAN-01 — Round 1

- **TaskId:** `GUEST-ROOM-MEDIA-PLAN-01`
- **Round:** 1
- **SubmissionId:** `sub-guest-room-media-plan-01-r1-20261012`
- **ReviewedSubmissionId:** `sub-room-ai-demo-pack-01-r2-20261012`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-12T19:56:00+07:00` (UTC: `2026-10-12T12:56:00Z` — Đồng hồ cục bộ, không xác thực độc lập)
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Tổng Quan Nhiệm Vụ & Kết Quả Đạt Được (Task Overview & Core Deliverables)

Căn cứ vào bàn giao `GUEST-ROOM-MEDIA-PLAN-01 ApprovedNext round1` từ Codex Reviewer (`review.md`) và yêu cầu trong `assignment.md`:
Antigravity đã hoàn thành cuộc khảo sát toàn diện mã nguồn thực tế và xây dựng bản đề xuất kỹ thuật độc lập tại [`docs/agent-coordination/media-integration-plan.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/media-integration-plan.md).

### Các điểm cốt lõi đã hoàn thành:
1. **Khảo sát mã nguồn thực tế với tham chiếu dòng code tuyệt đối (Source-Backed Ground Truth Survey):**
   - **Backend DTOs:** [`PublicPropertyDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/DTOs/PublicPropertyDto.cs#L20) (dòng 20), [`PublicRoomTypeDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/DTOs/PublicRoomTypeDto.cs#L19) (dòng 19), [`PublicRoomTypeAvailabilityDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/DTOs/PublicRoomTypeAvailabilityDto.cs#L16) (dòng 16) đều đã có sẵn thuộc tính `public string? ImageUrl { get; set; }`. Hợp đồng DTO công khai đã hoàn chỉnh và không đòi hỏi bất kỳ sự sửa đổi nào.
   - **Domain Entities & Lược đồ DB:** Thực thể [`RoomType.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Domain/Entities/RoomType.cs#L68) (dòng 68) đã có sẵn cột `ImageUrl` trong database schema và EF Core. Tuy nhiên, thực thể [`Property.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Domain/Entities/Property.cs) **chưa có cột `ImageUrl`** (ghi nhận khoảng cách kỹ thuật / Gap).
   - **Backend Handlers:** [`GetPublicAvailabilityQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicAvailability/GetPublicAvailabilityQuery.cs#L175) (dòng 175) và [`GetPublicRoomTypesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicRoomTypes/GetPublicRoomTypesQuery.cs#L63) (dòng 63) đã chiếu trực tiếp `ImageUrl = rt.ImageUrl`. Ngược lại, [`GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs#L57) (dòng 57) chiếu cứng `ImageUrl = null` do giới hạn schema của `Property`.
   - **Seed Data:** [`LocalDevDataSeeder.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs#L626-L637) không gán `ImageUrl`, do đó mọi bản ghi kiểm thử đều có `ImageUrl == null`.
   - **Frontend UI & Components:** [`booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts) đã có rẽ nhánh `*ngIf="rt.imageUrl"` (dòng 577) và khối SVG dự phòng nội tuyến khi `null` (dòng 578–591) kèm nhãn minh họa (dòng 594). Thẻ cơ sở cũng đã có khối SVG hoàng hôn kiến trúc ("Architectural Twilight Fallback", dòng 385–430). Cơ chế cô lập khi đổi cơ sở `resetSelectionAndAvailability()` (dòng 978–989) xóa sạch danh sách phòng và hủy yêu cầu dở dang, đảm bảo không rò rỉ ảnh cũ.

2. **Xác định các khoảng cách kỹ thuật (Gaps) của giao diện:**
   - Chưa có bộ bắt lỗi tải ảnh: Khi `rt.imageUrl` gặp lỗi 404 hoặc mạng hỏng, thẻ `<img>` bị vỡ mà không tự động rơi về khối SVG dự phòng.
   - Chưa có huy hiệu công bố AI minh họa động: Khi hiển thị ảnh mô phỏng AI từ `rt.imageUrl`, chưa có nhãn công bố minh bạch trên ảnh.
   - Chính sách text thay thế (`alt`) chưa phản ánh rõ ngữ cảnh minh họa cho trình đọc màn hình.

3. **Đề xuất lát cắt triển khai tối thiểu (Smallest Implementation Slice Proposal):**
   - Giữ nguyên 100% backend C#, database schema, quyền hạn và controllers.
   - Đề xuất bổ sung tín hiệu `failedRoomImageIds = signal<Set<string>>(new Set())` cùng sự kiện `(error)="onRoomImageError(rt.roomTypeId)"` vào `booking.page.ts`.
   - Thêm nhãn công bố AI bán trong suốt (`"Ảnh minh họa AI"`) và chuẩn hóa alt text có ngữ cảnh.
   - Reset danh sách lỗi ảnh đồng thời với `resetSelectionAndAvailability()` khi chuyển đổi chi nhánh.
   - Tuyệt đối không thêm remote CDN, thư viện bên thứ ba hay cloud storage mới.

4. **Ranh giới pháp lý & 4 câu hỏi cần PO phê duyệt:**
   - 33 ảnh Legacy (`LEGACY-ROOM-ASSETS-01`) tiếp tục duy trì cách ly nghiêm ngặt (**Quarantine**, `Rights NOT VERIFIED`).
   - 4 ảnh AI (`ROOM-AI-DEMO-PACK-01`) là tài liệu mô phỏng offline, **chưa có quyền thương mại sản xuất (`Commercial Rights NOT VERIFIED`)**. Tuyệt đối không copy vào `frontend/src/assets` production.
   - Nêu rõ 4 câu hỏi trọng tâm cho PO: (Q1) Bản quyền và thời điểm cung cấp ảnh thật; (Q2) Chính sách bắt buộc nhãn AI minh họa; (Q3) Migration bổ sung `Property.ImageUrl`; (Q4) Phương án hạ tầng lưu trữ media production (Local vs S3 Blob).
   - Bảo toàn 7 Cổng quyết định PO trong `decisions.md` và giữ Phase 6 tiếp tục đóng.
   - Bảo toàn ranh giới công việc của Nguyên (`Rooms`, `RoomTypes`) và Tân (`Housekeeping`).

---

## 2. Danh Sách Tài Liệu & Bằng Chứng Trình Duyệt

| STT | Đường Dẫn Tệp | Mô Tả & Nội Dung |
|:---:|---|---|
| 1 | [`docs/agent-coordination/media-integration-plan.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/media-integration-plan.md) | Kế hoạch tích hợp media chi tiết: khảo sát source-backed, phân tích gap, đề xuất lát cắt frontend tối thiểu, chính sách bản quyền, câu hỏi PO, tiêu chí nghiệm thu (AC-MEDIA-01 đến 05). |
| 2 | [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) | Cập nhật trạng thái `Submitted`, giải phóng khóa `writer: "none"`, chuyển giao cho Codex Reviewer. |
| 3 | [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) | Báo cáo đệ trình Vòng 1 của nhiệm vụ `GUEST-ROOM-MEDIA-PLAN-01`. |

---

## 3. Cam Kết Giới Hạn & Tính Toàn Vẹn Hệ Thống (Bounded Constraints)

- **Không can thiệp mã nguồn thực thi:** Nhiệm vụ này thuần túy là khảo sát và lập đề xuất kỹ thuật; không có bất kỳ dòng code nào được thay đổi trên backend, frontend, database hay script seed.
- **Không xâm phạm ranh giới đồng đội:** Giữ nguyên vẹn toàn bộ module buồng phòng của Tân (`Housekeeping`) và danh mục phòng của Nguyên (`Rooms`, `RoomTypes`).
- **Không tự động duyệt cổng nghiệp vụ:** Tiếp tục giữ nguyên 7 Cổng quyết định PO trong `decisions.md` ở trạng thái `NeedsPO`. Phase 6 (AI Search) tiếp tục đóng.
- **Không thêm dịch vụ ngoài:** Không cấu hình CDN, không gọi API bên ngoài, không thêm kết nối cloud.