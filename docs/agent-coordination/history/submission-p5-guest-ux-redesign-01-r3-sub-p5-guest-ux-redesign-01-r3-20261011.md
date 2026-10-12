# Submission: P5-GUEST-UX-REDESIGN-01 (Round 3)

- **TaskId:** P5-GUEST-UX-REDESIGN-01
- **Round:** 3
- **SubmissionId:** sub-p5-guest-ux-redesign-01-r3-20261011
- **ReviewedSubmissionId:** sub-p5-guest-ux-redesign-01-r2-20261011
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-11T09:43:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Commitments)

1. **0 sửa đổi mã nguồn sản xuất (Zero Production Code Changes):** Round 3 hoàn toàn tập trung chuẩn hóa hợp đồng API, công thức xếp hạng Damerau-Levenshtein OSA và tài liệu đề xuất. Không can thiệp mã nguồn trong `frontend/src/` hay `backend/src/`.
2. **0 kết nối database ngoài:** Tuyệt đối không kết nối hay gửi truy vấn tới bất kỳ database dev, staging hay production nào.
3. **0 vi phạm quyền sở hữu module của đồng đội:** Tuyệt đối không can thiệp các module dành riêng cho Nguyên (`Rooms`/`RoomTypes` responsive/a11y) và Tân (`Housekeeping` UX).
4. **Bảo toàn 100% Offline Standalone Mockups:** Toàn bộ CSS và SVG fallback được nhúng nội tuyến tự chứa.

---

## 2. Báo Cáo Giải Quyết Toàn Diện 3 Findings Của Reviewer (Codex Round 2)

### Finding 1: HIGH — Khớp 1:1 Toàn Bộ Hợp Đồng API Với Mã Nguồn Thực Tế (ĐÃ GIẢI QUYẾT)
Đã đối soát trực tiếp với mã nguồn frontend tại `PublicBookingService.ts`, `public-booking.model.ts` và `reservation.model.ts`:
- **Bước 1 — Tìm kiếm cơ sở lưu trú:**
  - Endpoint: `GET /api/public/properties?search={keyword}`
  - DTO: `PublicPropertyDto[]` (`id`, `name`, `code`, `slug`, `address`, `city`, `checkInTime`, `checkOutTime`, `bufferMinutes`, `maxHourlyHours`, `imageUrl`).
  - Xử lý: `imageUrl` hiện null $\rightarrow$ hiển thị **Fallback SVG Placeholder**. Không có giá/tồn/tiện ích ở bước này.
- **Bước 2 — Tình trạng phòng & Giá ước tính (Room Availability):**
  - Phương thức: `PublicBookingService.getAvailability(slug, query)`
  - Endpoint: `GET /api/public/properties/{slug}/availability`
  - Tham số query: `rentalType: number` (1: Hourly, 2: Overnight), `startAtUtc: string`, `endAtUtc: string` (optional: `checkInDate`, `checkOutDate`).
  - DTO trả về: `PublicRoomTypeAvailabilityDto[]` (`roomTypeId`, `roomTypeName`, `description`, `maxOccupancy`, `bedType`, `squareMeters`, `imageUrl`, `totalRooms`, `availableRooms`, `isAvailable`, `estimatedPrice`).
  - Phân biệt rõ: Trường `estimatedPrice` là giá ước tính cho khoảng lưu trú để hiển thị duyệt xem trên UI, **không có BasePrice fallback** và **không phải báo giá có thẩm quyền (authoritative quote)**.
- **Bước 3A — Báo giá chính thức từ Pricing Engine (Authoritative Quote):**
  - Phương thức: `PublicBookingService.calculateQuote(request)`
  - Endpoint: `POST /api/public/quotes`
  - Request: `CalculatePublicQuoteRequest` (`propertySlug`, `roomTypeId`, `rentalType`, `startAtUtc`, `endAtUtc`, `checkInDate?`, `checkOutDate?`).
  - DTO trả về: `QuoteDto` (`propertyId`, `roomTypeId`, `roomTypeName`, `rentalType`, `totalAmount`, `currency`, `expiresAtUtc`, `breakdown: QuoteBreakdownItemDto[]`, `appliedPolicies: AppliedPoliciesDto`).
- **Bước 3B — Giữ chỗ 15 phút dưới khóa hàng (Room Hold):**
  - Phương thức: `PublicBookingService.createHold(request)`
  - Endpoint: `POST /api/public/bookings/hold` (Header: `Idempotency-Key`).
  - Request: `CreateGuestHoldRequest` (`propertySlug`, `roomTypeId`, `rentalType`, `startAtUtc`, `endAtUtc`, `guestName`, `guestEmail`, `numberOfGuests`, `expectedTotalAmount?`).
  - DTO trả về: `GuestHoldDto` (`reservationId`, `confirmationCode`, `lookupToken`, `assignedRoomNumber`, `totalAmount`, `depositRequired`, `holdExpiresAtUtc`, `secondsRemaining`, `status`, `breakdown: QuoteBreakdownItemDto[]`).
  - Tiền cọc yêu cầu (`depositRequired`) và thời gian giữ chỗ (`holdExpiresAtUtc`) do server trả về theo chính sách cơ sở. Tuyệt đối **không hardcode** 30% cọc hay xác nhận tức thì vào mã nguồn sản xuất.
- Đã đồng bộ toàn bộ bảng đối chiếu mục 5.1 trong `proposal.md`, mockup HTML và `manifest.json`.

---

### Finding 2: MEDIUM — Hợp Đồng Fuzzy Ranking Xác Định Tuyệt Đối & Có Thể Code/Test Ngay (ĐÃ GIẢI QUYẾT)
- **Biến thể thuật toán:** Thống nhất sử dụng **Optimal String Alignment (OSA) Distance** (restricted Damerau-Levenshtein) hỗ trợ 4 phép: Thêm, Xóa, Thay thế và Hoán vị ký tự kề nhau ($O(M \times N)$).
- **Hằng số điểm số cố định (Closed Discrete Scores):**
  - `Score = 100`: `ExactMatch` (Toàn chuỗi chuẩn hóa của trường mục tiêu trùng khớp 100% với $Q_{norm}$).
  - `Score = 90`: `PrefixMatch` (Chuỗi chuẩn hóa của trường bắt đầu bằng $Q_{norm}$).
  - `Score = 80`: `SubstringMatch` ($Q_{norm}$ là chuỗi con liên tiếp nằm trong trường mục tiêu).
  - `Score = 75`: `AllTokensExactMatch` (Mọi token trong $Q_{norm}$ đều xuất hiện chính xác như một từ riêng biệt trong trường).
  - `Score = 60`: `TypoTolerantMatchTier1` (Tất cả token đều thỏa mãn ngưỡng lỗi Damerau-Levenshtein $\le 1$ hoặc condensed string distance = 1).
  - `Score = 50`: `TypoTolerantMatchTier2` (Tồn tại token $\ge 6$ ký tự có OSA distance = 2 hoặc condensed string distance = 2).
  - `Score = 0`: `NoMatch` (Không thỏa mãn, trả về danh sách rỗng `[]`).
- **Công thức tính điểm tối đa cho Property:**
  $$\text{RelevanceScore}(P) = \max \Big( \text{Score}(P.\text{Name}), \text{Score}(P.\text{City}), \text{Score}(P.\text{Address}) \Big)$$
- **Truy vấn hỗn hợp (Short-token + Typo Mixed Cases):**
  - Token ngắn $\le 2$ ký tự (như `"da"`, `"ha"`): **Bắt buộc khớp Exact hoặc Prefix**, tuyệt đối không cho phép typo.
  - Token $\ge 3$ ký tự (như `"nag"`, `"bien"`): Cho phép OSA distance $\le 1$.
  - Mọi token trong truy vấn đều phải khớp (All-query-tokens semantics). Ví dụ: `"da nag"` khớp `"da"` (exact) và `"nag"` (dist = 1) $\rightarrow$ gán mức điểm `Score = 60` (`TypoTolerantMatchTier1`).
- **Biên độ Condensed String (Condensed Boundaries):**
  - Chỉ kích hoạt khi truy vấn là từ đơn duy nhất (1 token, không có khoảng trắng) và có độ dài $\ge 4$ ký tự (ví dụ `"danag"` len 5 $\rightarrow$ dist 1 tới `"danang"` $\rightarrow$ Score 60; `"haoni"` len 5 $\rightarrow$ transposition dist 1 tới `"hanoi"` $\rightarrow$ Score 60).
  - Nếu truy vấn có khoảng trắng (nhiều token), áp dụng quy tắc token-level matching ở trên.
- **Explicit Tie-breaking Comparer:**
  1. `RelevanceScore` Giảm dần (`DESC`)
  2. `Name` Tăng dần (`StringComparer.OrdinalIgnoreCase`) (`ASC`)
  3. `Id` Tăng dần (`Guid.CompareTo`) (`ASC`)
- **Khắc phục triệt để tính toán bảng Fixtures mẫu:**
  - `"Đà Nẵng"`: P1 và P2 đều đạt City exact match $\rightarrow$ **Score = 100** (khắc phục mâu thuẫn ghi 90 ở round trước). Tie-break theo `Name` A-Z: P1 (Biển Đông) xếp trước P2 (Central).
  - `"Danag"`: P1 và P2 đều đạt condensed string dist = 1 tới `"danang"` $\rightarrow$ **Score = 60**. Tie-break theo `Name` A-Z.
  - `"da nag"`: P1 và P2 đạt mixed token match $\rightarrow$ **Score = 60**.
  - `"Central"`: P2 và P3 đều đạt Name substring match $\rightarrow$ **Score = 80**. Tie-break: P2 ("Khách Sạn Central Đà Nẵng") xếp trước P3 ("Khách Sạn Sài Gòn Central").
  - `"Ha"`: P4 đạt City prefix match ("ha noi") $\rightarrow$ **Score = 90**; P5 đạt Name token exact ("ha") $\rightarrow$ **Score = 75**. Xếp hạng: P4 (Score 90) đứng trước P5 (Score 75).
  - `"Haoni"`: P4 đạt condensed OSA transposition dist = 1 tới `"hanoi"` $\rightarrow$ **Score = 60**.
  - `"biển"`: P1 đạt Name substring match $\rightarrow$ **Score = 80** (bảo toàn tìm kiếm chuỗi con hiện hữu).
  - Cơ sở `Inactive`: Tuyệt đối loại trừ (`Status == PropertyStatus.Active`).
  - Ngày nhận/trả và số khách: Tuyệt đối không fuzzy.

---

### Finding 3: MEDIUM — Bằng Chứng Nghiên Cứu & Trạng Thái Khảo Sát (ĐÃ GIẢI QUYẾT)
- Đổi tên Deliverable 1 thành: **"Bảng Tham Khảo Mẫu Hình Giao Diện Thực Hành Tốt (UI Pattern Benchmark & Reference)"**.
- Ghi nhận trung thực: Bảng so sánh 3 nền tảng (Booking.com, Agoda, Traveloka) là tài liệu đối chuẩn mẫu hình thiết kế (Industry Best Practices / UX Patterns Benchmark).
- Khẳng định rõ: Đây không phải là phiên crawl tự động hay live inspection có lưu vết (Unverified Live Inspection) nhằm tuân thủ quy định sở hữu trí tuệ và không can thiệp anti-bot của bên thứ ba.
- Loại bỏ hoàn toàn các khẳng định về phiên crawl/khảo sát trực tiếp đã hoàn thành.

---

## 3. Danh Mục Các Bằng Chứng & Tài Liệu Nghiệm Thu Round 3

1. **Tài liệu đề xuất giải pháp cập nhật hoàn chỉnh:**
   👉 [`docs/agent-coordination/guest-ux-redesign-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/guest-ux-redesign-proposal.md)
2. **Mockup Desktop 100% Offline Standalone:**
   👉 [`docs/agent-coordination/evidence/guest-ux-mockups/desktop-mockup.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ux-mockups/desktop-mockup.html)
3. **Mockup Mobile 100% Offline Standalone:**
   👉 [`docs/agent-coordination/evidence/guest-ux-mockups/mobile-mockup.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ux-mockups/mobile-mockup.html)
4. **Manifest Khai báo Bằng chứng Round 3:**
   👉 [`docs/agent-coordination/evidence/guest-ux-mockups/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ux-mockups/manifest.json)

---

## 4. Tình Trạng Mã Nguồn & Kiểm Thử

- Trong Round 3, không có bất kỳ dòng mã sản xuất nào bị thay đổi (Zero Production Changes).
- Toàn bộ suite kiểm thử frontend hiện tại tiếp tục giữ trạng thái 160/160 tests passing (Exit code: 0).

---

## 5. Kết Luận & Đề Nghị Bước Tiếp Theo

Toàn bộ các yêu cầu của Reviewer Codex ở Round 2 đã được chuẩn hóa chính xác, khớp 1:1 với source code và tài liệu hóa hoàn toàn determinist.
Đề nghị Reviewer Codex và Product Owner đánh giá submission Round 3 để phê duyệt chuyển sang trạng thái triển khai lát cắt nhỏ nhất (`ApprovedNext`).
