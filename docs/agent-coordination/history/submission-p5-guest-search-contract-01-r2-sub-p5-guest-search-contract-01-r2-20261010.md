# Submission: P5-GUEST-SEARCH-CONTRACT-01 (Round 2)

- **TaskId:** P5-GUEST-SEARCH-CONTRACT-01
- **Round:** 2
- **SubmissionId:** sub-p5-guest-search-contract-01-r2-20261010
- **ReviewedSubmissionId:** sub-p5-guest-search-contract-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T22:27:30+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Khắc Phục Ý Kiến Đánh Giá Round 1 (Resolution of Review Findings)

Đáp ứng đầy đủ 4 phát hiện của Reviewer (Codex) trong văn bản đánh giá Round 1 tại [`docs/agent-coordination/review.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/review.md), Antigravity đã hoàn thiện bản đề xuất hợp đồng kỹ thuật Round 2 tại [`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md) như sau:

---

### 1.1. Khắc phục Finding 1 ([P1] — Bảo Toàn Hợp Đồng API Hiện Có Cho Lát Cắt Tái Sử Dụng)
1. **Bảo tồn 100% Hợp đồng API hiện tại trong Slice A:**
   - **Tuyến & Tham số:** Giữ nguyên `GET /api/public/properties?search={search}`.
   - **Kiểu dữ liệu trả về:** Giữ nguyên `IReadOnlyList<PublicPropertyDto>` (JSON Array trực tiếp, không bọc wrapper phân trang hay object mới).
   - **Tương thích Client:** Frontend `PublicBookingService.getProperties(search?: string): Observable<PublicPropertyDto[]>` (`public-booking.service.ts:26`) tiếp tục hoạt động mà không bị breaking change.
   - **Nội dung cải tiến của Slice A:** Chỉ nâng cấp logic so khớp trong `GetPublicPropertiesQueryHandler` để hỗ trợ tìm kiếm không phân biệt dấu tiếng Việt (diacritics-insensitive / unaccent matching) trên 3 trường `Name`, `Address`, `City`.
2. **Đưa các thay đổi phá vỡ hợp đồng vào PO Gate:**
   - Việc đổi cấu trúc sang phân trang (`{ items, totalCount, page, pageSize }`), tách tham số `keyword`, `city`, hay bổ sung endpoint mới `GET /api/public/destinations` được tách riêng vào **PO Gate 1** để PO duyệt và lập kế hoạch migration client.

---

### 1.2. Khắc phục Finding 2 ([P1] — Quản Lý Publication Policy & Loại Bỏ Tham Số Bypass)
1. **Loại bỏ tham số `isPublishedOnly` khỏi API công khai:**
   - Tuyệt đối không cho phép client/caller anonymous truyền cờ tắt/bật guard xuất bản.
2. **Quy định rõ ràng về Publication Policy:**
   - Mã nguồn hiện tại đang thực thi chính sách Active-only (`p.Status == PropertyStatus.Active`).
   - Việc có mở rộng bắt buộc đồng bộ `p.Status == Active AND p.IsPublished == true` trên toàn bộ các endpoint công khai (danh sách cơ sở, chi tiết theo slug, phòng trống) hay không được đưa vào **PO Gate 2** để PO chốt trước khi triển khai.
   - Slice A giữ nguyên semantics trạng thái hiện tại (`Status == PropertyStatus.Active`).

---

### 1.3. Khắc phục Finding 3 ([P2] — Chuẩn Hóa Dataset Hành Chính & Tránh Suy Diễn Địa Bàn)
1. **Loại bỏ các khẳng định số lượng cứng không có nguồn:**
   - Đã loại bỏ hoàn toàn các khẳng định cứng về "63 đơn vị" hay số lượng xã/phường không có trích dẫn nguồn có ngày hiệu lực.
2. **Minh bạch hóa trường `City` hiện tại:**
   - Ghi nhận rõ: Trường `City` trong database hiện tại là chuỗi văn bản tự do do người dùng nhập (VD: "TP. Hồ Chí Minh", "Da Nang"), **không phải là danh mục tỉnh/thành chuẩn hóa và không có liên kết với cấp xã/phường**.
3. **Tiêu chuẩn tích hợp Dataset (PO Gate 3):**
   - Đưa việc tích hợp danh mục hành chính 2 cấp vào **PO Gate 3**, với yêu cầu bắt buộc: Phải có cơ quan thẩm quyền ban hành (Tổng cục Thống kê - GSO / Bộ Nội vụ), phiên bản, ngày hiệu lực và giấy phép sử dụng hợp pháp.
   - Tiếp tục tuân thủ tuyệt đối quy tắc: Không suy đoán địa giới từ trường `Address` tự do.

---

### 1.4. Khắc phục Finding 4 ([P2] — Tách Bạch Scope, Acceptance Criteria & Chuẩn Hóa Kỹ Thuật)
1. **Tách biệt hoàn toàn Scope của Slice A và Phase B:**
   - Slice A chỉ trả về `PublicPropertyDto` với các trường hiện có. **Không cam kết** trả về `minPrice`, `availableRooms`, `totalAvailableRooms`, hay lọc theo ngày ở/số khách trong Slice A.
   - Các tính năng lọc ngày ở, số khách và tính toán phòng trống tổng hợp được đưa vào Phase B (sau khi PO chốt Gate 5).
2. **Bảo tồn cơ chế Thuê theo giờ (Hourly):**
   - Với hình thức thuê theo giờ, tài liệu ghi nhận rõ việc tái sử dụng cơ chế khung thời gian UTC (`StartAtUtc`, `EndAtUtc`) và quy tắc giờ/đêm hiện có (`GetPublicAvailabilityQuery`), không thay thế bằng date-only ngầm.
3. **Chuẩn hóa Acceptance Criteria:**
   - Toàn bộ AC cho Slice A (AC-A01 đến AC-A06) khớp chính xác với định dạng JSON Array `[]` khi rỗng hoặc không tìm thấy (HTTP 200 OK).
4. **Giới hạn đầu vào & Bounded Query:**
   - Bỏ các cam kết suy đoán ("an toàn 100%", "ngưỡng 500").
   - Xác định rõ ràng: Giới hạn `search` tối đa 100 ký tự (trim), sắp xếp xác định `.OrderBy(p => p.Name).ThenBy(p => p.Id)`.
5. **Ghi nhận nguồn gốc Schema:**
   - Bảng khảo sát được định danh chính xác là **"Khảo sát Schema dựa trên mã nguồn / cấu hình EF Core / Migration"**, không tuyên bố xác minh instance DB thật.

---

## 2. Tài Liệu Đề Xuất Hợp Đồng Kỹ Thuật Hoàn Chỉnh (Round 2)

Tài liệu phiên bản 2.0 đã được cập nhật tại:  
📄 **[`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md)**

Nội dung bao gồm:
- Mục 1: Mục tiêu, phạm vi và ranh giới an toàn.
- Mục 2: Khảo sát Schema từ Source/Config/Migration (đối chiếu entity, config và API controller/handler).
- Mục 3: Đặc tả chi tiết Lát cắt Tái sử dụng (Slice A) — Hợp đồng API `GET /api/public/properties?search={search}`, Input boundaries, Unaccent matching logic, Response format, và Bộ tiêu chí chấp nhận AC-A01 đến AC-A06.
- Mục 4: Năm câu hỏi mở kiến trúc cần PO quyết định độc lập (PO Gate 1 đến PO Gate 5).
- Mục 5: Kết luận và đề xuất bước đi tiếp theo.

---

## 3. Trạng Thái An Toàn & Bàn Giao Thẩm Định Round 2

- **Trạng thái mã nguồn:** **0 dòng mã nguồn nghiệp vụ bị sửa đổi, 0 migration, 0 mutation database**.
- **Trạng thái điều phối:** Cập nhật `task.json` sang `status: "Submitted"`, `round: 2`, `writer: "none"`.

Kính chuyển Reviewer (Codex) thẩm định Round 2!
