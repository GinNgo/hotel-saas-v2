# Đề Xuất Thiết Kế Lại Giao Diện Khách & Hợp Đồng Tìm Kiếm Gần Đúng (P5-GUEST-UX-REDESIGN-01)

- **Mã Task:** `P5-GUEST-UX-REDESIGN-01`
- **Vòng (Round):** 3 (Chuẩn Hóa Hợp Đồng API Từ Source Code Thực Tế, Chốt Công Thức Điểm Fuzzy OSA & Bảng Mẫu Hình Tham Khảo)
- **Tác giả:** Antigravity (Pair Programming Agent)
- **Ngày cập nhật:** 11/10/2026
- **Workspace:** `C:\Dev\hotel-saas-v2` (`develop` @ `3f95339`)

---

## 1. Tuyên Bố Giả Định Nghiệp Vụ Cốt Lõi (Core Assumptions)

> [!IMPORTANT]
> **Làm rõ thuật ngữ "Fuzzing" theo yêu cầu PO ngày 11/10/2026:**
> PO yêu cầu: *"khảo sát các trang tìm kiếm/đặt phòng hiện đại, thiết kế lại giao diện khách và tìm kiếm fuzzing"*.
> - **Giả định chính thức:** Thuật ngữ *"fuzzing"* trong ngữ cảnh đặt phòng của người dùng cuối (Guest Portal) được định nghĩa chuẩn hóa là **Fuzzy Search (Tìm kiếm gần đúng / Chấp nhận lỗi chính tả gõ phím của khách)** trên tên khách sạn, địa chỉ và thành phố.
> - **Không phải Security Fuzzing:** Thuật ngữ này hoàn toàn **không** phải là kỹ thuật kiểm thử bảo mật ngẫu nhiên (Fuzz testing / Protocol mutation) nhằm đánh sập API hay tìm lỗ hổng tràn bộ nhớ đệm.

---

## 2. Deliverable 1: Bảng Tham Khảo Mẫu Hình Giao Diện Thực Hành Tốt (UI Pattern Benchmark & Reference)

> [!NOTE]
> **Giới hạn & Tuyên bố về bằng chứng nghiên cứu (Research Limitations & Provenance):**
> Bảng phân tích dưới đây là tài liệu tổng hợp và tham khảo các mẫu hình thiết kế tốt (Industry Best Practices / UX Patterns Benchmark) từ các nền tảng thương mại điện tử du lịch phổ biến (Booking.com, Agoda, Traveloka).
> - **Không phải kết quả crawl tự động hay live inspection có lưu vết:** Nhằm tuân thủ tuyệt đối quyền sở hữu trí tuệ, điều khoản dịch vụ và chính sách bảo mật dự án, đề xuất không sử dụng bot/crawler tự động và không lưu giữ snapshot/ảnh chứa thương hiệu của bên thứ ba trong mã nguồn. Bảng mang tính chất đối chuẩn kiến trúc (heuristic architectural reference).

### Bảng Phân Tích Mẫu Hình Thiết Kế (Heuristic UX Comparison)
| Tiêu chí | 1. Booking.com Pattern | 2. Agoda Pattern | 3. Traveloka Pattern |
| :--- | :--- | :--- | :--- |
| **Cấu trúc Search Bar** | Thanh tìm kiếm 4 phân đoạn nằm ngang nổi bật: Điểm đến $\rightarrow$ Ngày nhận/trả $\rightarrow$ Số người/phòng $\rightarrow$ Nút Tìm. | Tabs chuyển đổi loại hình lưu trú $\rightarrow$ Search box phân cấp (Thành phố / Khu vực / Khách sạn). | Thanh capsule hiện đại: Nơi lưu trú $\rightarrow$ Lịch nhận/trả $\rightarrow$ Số đêm & Khách. |
| **Trải nghiệm Mobile** | Thu gọn thành 1 thanh chạm (Search Pill), khi click mở Bottom Sheet toàn màn hình để chọn ngày. | Form thẻ dọc bo tròn, sticky button "Tìm kiếm" ở cuối viewport. | Giao diện Native-app style, calendar dạng cuộn trực quan, mượt mà. |
| **Hiển thị Thẻ Khách sạn** | Tỷ lệ ảnh 4:3 bên trái, thông tin ở giữa, giá & CTA nằm bên phải dưới cùng. Badge trạng thái rõ ràng. | Nhấn mạnh ảnh lớn, tiện ích icon nổi bật (Wifi, Hồ bơi, Ăn sáng), giá to rõ ràng. | Bố cục card thoáng đãng, badge "Hủy miễn phí", giá minh bạch "Đã bao gồm thuế phí". |
| **Pattern ÁP DỤNG cho SaaS** | **1.** Hero Search Bar phân đoạn rõ ràng.<br>**2.** Badge trạng thái phòng trống.<br>**3.** Sticky summary bar khi đã chọn phòng. | **1.** Autocomplete phân cấp (Thành phố vs Khách sạn).<br>**2.** Icon thông tin trực quan.<br>**3.** Minh bạch giờ check-in / check-out trên card. | **1.** Phong cách thiết kế tối giản, sạch sẽ (Warm Minimalism).<br>**2.** Tóm tắt chính sách cọc và thời gian giữ phòng ngay trong card.<br>**3.** Mobile layout không tràn ngang, touch targets $\ge 44$px. |
| **Pattern KHÔNG PHÙ HỢP (Loại bỏ)** | Gây áp lực tâm lý (FOMO) dày đặc: *"15 người đang xem"*, *"Vừa được đặt 2 phút trước"* (không phù hợp SaaS B2B). | Drip pricing (giá hiển thị chưa gồm thuế/phí khiến khách bất ngờ ở bước cuối); Pop-up khuyến mãi dày đặc. | Bán chéo quá nhiều dịch vụ không liên quan (Vé máy bay, xe khách, thẻ tín dụng trả góp PayLater). |

---

## 3. Deliverable 2: Audit Giao Diện Đặt Phòng Công Khai Hiện Tại

Dựa trên mã nguồn hiện hành tại [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts) và bằng chứng tại [`docs/agent-coordination/evidence/search-ui/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/manifest.json):

### 3.1. Các điểm mạnh đã đạt được (P5-GUEST-SEARCH-REUSE-01 & P7)
1. **Tìm kiếm tiếng Việt chuẩn hóa:** Đã có ô tìm kiếm tích hợp `VietnameseTextNormalizer`, tìm kiếm không phân biệt có/không dấu, đ/Đ trên `Name`, `Address`, `City`.
2. **Xử lý bất đồng bộ an toàn:** Debounce 300ms, hủy timer khi xóa (`clearPropertySearch`), xử lý race condition (latest-request-wins) thông qua subscription management.
3. **Trạng thái phản hồi đầy đủ:** Đã có trạng thái Đang tải (`isLoadingProperties`), Lỗi kèm Thử lại (`propertiesError` + nút "Thử lại"), và Không tìm thấy (`properties.length === 0` + nút "Xem tất cả").

### 3.2. Các hạn chế trải nghiệm người dùng (UX Gaps) cần tái thiết kế
1. **Phân cấp thị giác yếu (Visual Hierarchy):** Ô tìm kiếm từ khóa và form chọn ngày/cơ sở lưu trú bị tách rời thành 2 khối rời rạc, khiến khách hàng phải thao tác qua 2 bước riêng biệt thay vì 1 thanh tìm kiếm hợp nhất (Unified Hero Search Bar).
2. **Dropdown chọn cơ sở lưu trú dạng thô:** Sau khi tìm kiếm, kết quả trả về là một `<select>` dropdown đơn điệu (`<option>`), buộc người dùng phải mở dropdown để chọn khách sạn thay vì hiển thị trực quan các thẻ khách sạn (Hotel Cards) có ảnh, địa chỉ, vị trí và thông số nhận/trả phòng.
3. **Thiếu hình ảnh cơ sở lưu trú & Fallback khi null:** Thẻ phòng hiện tại chỉ hiển thị chữ và thông số kỹ thuật, thiếu ảnh đại diện trực quan của khách sạn và phòng nghỉ; chưa có cơ chế hiển thị ảnh thay thế (Fallback SVG Placeholder) khi `ImageUrl` trả về từ API là `null`.
4. **Trải nghiệm Mobile chưa tối ưu:** Trên màn hình hẹp (375px), người dùng phải cuộn qua form dài mới thấy được danh sách phòng; khi đã chọn phòng, thiếu thanh tóm tắt cố định ở đáy màn hình (Sticky Bottom Bar) để giữ chỗ 15 phút nhanh chóng.
5. **Chưa có khả năng chịu lỗi gõ phím (Typo Tolerance):** Khách gõ sai 1 ký tự (ví dụ: *"Danag"*, *"Sai gon"*, *"Bieen Dong"*) sẽ lập tức nhận kết quả rỗng `[]`, gây đứt gãy trải nghiệm tìm kiếm.

---

## 4. Deliverable 3: Hướng Thiết Kế Mới & Bằng Chứng Mockups Độc Lập

### 4.1. Hệ thống Quy chuẩn Thiết kế (Design Tokens & Principles)
Tuân thủ tiêu chuẩn **Warm Minimalism & Modern Hospitality** từ `ui-ux-pro-max`:
- **Màu sắc chủ đạo:**
  - Nền & Thẻ: `bg-slate-50` (nền trang), `bg-white` (thẻ nổi bật), viền `border-slate-200`.
  - Tông màu thương hiệu: `text-indigo-600` / `bg-indigo-600` (nút hành động chính), hover `bg-indigo-700`.
  - Trạng thái phòng: `bg-emerald-50 text-emerald-700` (Còn phòng), `bg-rose-50 text-rose-700` (Hết phòng), `bg-amber-50 text-amber-800` (Cảnh báo).
- **Typography Scale:**
  - Hero Header: 36px – 48px, `font-extrabold`, tracking-tight.
  - Section Title: 20px – 24px, `font-bold`.
  - Card Title / Hotel Name: 18px, `font-bold`.
  - Body / Info: 12px – 14px, `font-medium`, line-height 1.5.
- **Tương tác & Khả năng tiếp cận (Accessibility Objective):**
  - **Mục tiêu thiết kế:** Hướng tới tiêu chuẩn WCAG AA với độ tương phản màu dự kiến $\ge 4.5:1$, touch targets trên mobile tối thiểu $44 \times 44$px, liên kết thẻ `<label for="...">` rõ ràng tới các control nhập liệu, và outline focus bàn phím rõ nét.
  - **Giới hạn kiểm chứng:** Trong phạm vi tài liệu và mockup tĩnh, các chỉ số này **chưa qua kiểm chứng tự động bằng CDP metrics, screen reader tự động hay contrast measurement tool**. Báo cáo không tuyên bố đã đạt chứng nhận WCAG AA mà xác nhận đây là tiêu chuẩn thiết kế mục tiêu.

### 4.2. Bằng chứng Mockup Độc Lập (100% Offline Standalone Artifacts)
1. **Bản Mockup Desktop (1440px Viewport):**
   - Tệp tin: [`docs/agent-coordination/evidence/guest-ux-mockups/desktop-mockup.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ux-mockups/desktop-mockup.html)
   - Đặc điểm: Hero Search hợp nhất, danh sách thẻ cơ sở 3 cột (Thumb SVG fallback, Thông tin từ `PublicPropertyDto`, và Nút kích hoạt Step 2), khu vực hiển thị phòng từ API availability, và Sticky Bottom Bar khi có báo giá.
2. **Bản Mockup Mobile (375px Viewport):**
   - Tệp tin: [`docs/agent-coordination/evidence/guest-ux-mockups/mobile-mockup.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ux-mockups/mobile-mockup.html)
   - Đặc điểm: Giao diện dòng dọc đơn cột, không cuộn ngang, touch target $\ge 44$px, capsule search gọn gàng, thẻ cơ sở mobile-friendly, sticky bottom CTA bar với nút "Giữ phòng 15 phút" nổi bật.
3. **Tệp Manifest Khai báo Bằng chứng:**
   - Tệp tin: [`docs/agent-coordination/evidence/guest-ux-mockups/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/guest-ux-mockups/manifest.json)

---

## 5. Deliverable 4: Bảng Ánh Xạ Trường Dữ Liệu Tới API Thật (Khớp 1:1 Mã Nguồn PublicBookingService)

Khảo sát trực tiếp từ mã nguồn thực tế tại [`frontend/src/app/core/services/public-booking.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/public-booking.service.ts), [`frontend/src/app/core/models/public-booking.model.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/models/public-booking.model.ts) và [`frontend/src/app/core/models/reservation.model.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/models/reservation.model.ts):

### 5.1. Bảng Đối Chiếu Thành Phần Giao Diện & DTO Backend Thực Tế
| Bước (Step) | Thành phần UI (Mockup Element) | API Endpoint Backend & Method | Phương thức trong `PublicBookingService` | Request Params / Body | DTO Trả về & Các trường thực tế | Xử lý khi thiếu dữ liệu / Null / Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Bước 1** | Thẻ Cơ sở Lưu trú (Property Card) | `GET /api/public/properties?search={keyword}` | `getProperties(search?: string)` | Query: `search?: string` | `PublicPropertyDto[]`:<br>- `id: string`<br>- `name: string`<br>- `code: string`<br>- `slug: string`<br>- `address: string`<br>- `city?: string`<br>- `checkInTime: string`<br>- `checkOutTime: string`<br>- `bufferMinutes: number`<br>- `maxHourlyHours: number`<br>- `imageUrl?: string` | - `imageUrl` hiện là `null` $\rightarrow$ Render **Fallback SVG Placeholder** nội tuyến.<br>- **KHÔNG CÓ** giá phòng, tồn phòng hay tiện ích tại bước này. Card hiển thị: *"Chọn ngày để xem phòng và báo giá"*. |
| **Bước 2** | Thẻ Hạng phòng & Tồn phòng (Room Availability Cards) | `GET /api/public/properties/{slug}/availability` | `getAvailability(slug, query)` | Query params:<br>- `rentalType: number`<br>- `startAtUtc: string`<br>- `endAtUtc: string`<br>- *(optional: checkInDate, checkOutDate)* | `PublicRoomTypeAvailabilityDto[]`:<br>- `roomTypeId: string`<br>- `roomTypeName: string`<br>- `description?: string`<br>- `maxOccupancy: number`<br>- `bedType?: string`<br>- `squareMeters?: number`<br>- `imageUrl?: string`<br>- `totalRooms: number`<br>- `availableRooms: number`<br>- `isAvailable: boolean`<br>- `estimatedPrice: number` | - `estimatedPrice`: Giá **ước tính** theo khoảng lưu trú để hiển thị duyệt phòng; **KHÔNG CÓ BasePrice fallback** và đây không phải là báo giá có thẩm quyền (authoritative quote).<br>- Nếu `isAvailable == false` hoặc `availableRooms == 0` $\rightarrow$ Disable nút chọn, gắn badge "Hết phòng". |
| **Bước 3A** | Báo Giá Chính Thức (Authoritative Quote Calculation) | `POST /api/public/quotes` | `calculateQuote(request)` | Body `CalculatePublicQuoteRequest`:<br>- `propertySlug: string`<br>- `roomTypeId: string`<br>- `rentalType: number`<br>- `startAtUtc: string`<br>- `endAtUtc: string`<br>- *(checkInDate?, checkOutDate?)* | `QuoteDto`:<br>- `propertyId: string`<br>- `roomTypeId: string`<br>- `roomTypeName: string`<br>- `rentalType: string`<br>- `totalAmount: number`<br>- `currency: string`<br>- `expiresAtUtc: string`<br>- `breakdown: QuoteBreakdownItemDto[]`<br>- `appliedPolicies: AppliedPoliciesDto` | - Báo giá chuẩn xác do Pricing Engine tính toán.<br>- `appliedPolicies` gồm: `maxHourlyHours`, `bufferMinutes`, `checkInTime`, `checkOutTime`. |
| **Bước 3B** | Giữ Phòng 15 Phút Dưới Khóa Hàng (Room Hold) | `POST /api/public/bookings/hold` | `createHold(request)` | Body `CreateGuestHoldRequest`:<br>- `propertySlug: string`<br>- `roomTypeId: string`<br>- `rentalType: number`<br>- `startAtUtc: string`<br>- `endAtUtc: string`<br>- `guestName: string`<br>- `guestEmail: string`<br>- `numberOfGuests: number`<br>- `expectedTotalAmount?: number`<br>- Header: `Idempotency-Key` | `GuestHoldDto`:<br>- `reservationId: string`<br>- `confirmationCode: string`<br>- `lookupToken: string`<br>- `assignedRoomNumber: string`<br>- `totalAmount: number`<br>- `depositRequired: number`<br>- `holdExpiresAtUtc: string`<br>- `secondsRemaining: number`<br>- `status: string`<br>- `breakdown: QuoteBreakdownItemDto[]` | - Tiền cọc yêu cầu (`depositRequired`) và thời gian giữ chỗ (`holdExpiresAtUtc`) do server trả về theo chính sách cơ sở. Tuyệt đối **không hardcode** 30% cọc hay xác nhận tức thì vào mã nguồn. |

### 5.2. Các Trạng Thái Giao Diện (UI States)
1. **Trạng thái khởi tạo (Initial / Unsearched State):** Hiển thị toàn bộ các cơ sở có `Status == PropertyStatus.Active`, nhắc nhở khách nhập từ khóa hoặc chọn điểm đến.
2. **Trạng thái đang tìm kiếm (Loading / Debounce State):** Spinner nhỏ gọn trong ô tìm kiếm sau 300ms debounce, không làm khóa toàn màn hình.
3. **Trạng thái cơ sở tìm thấy nhưng chưa chọn ngày (Dates Pending):** Hiển thị danh sách thẻ khách sạn; mỗi thẻ có nút *"Xem phòng & Báo giá"*, khi click sẽ cuộn tới mục chọn ngày hoặc mở modal chọn lịch.
4. **Trạng thái đã chọn cơ sở & xem tồn phòng (Availability Loaded):** Hiển thị danh sách các hạng phòng kèm số lượng phòng trống và giá ước tính (`estimatedPrice`).
5. **Trạng thái đã chọn phòng & tính báo giá (Quote Ready):** Kích hoạt Sticky Bottom Bar hiển thị tổng tiền (`QuoteDto.totalAmount`), số tiền cọc yêu cầu theo chính sách cơ sở và nút *"Giữ phòng 15 phút"*.

---

## 6. Deliverable 5: Đề Xuất Thuật Toán & Hợp Đồng Tìm Kiếm Gần Đúng (Fuzzy Search Contract)

### 6.1. Thuật Toán Thống Nhất: Optimal String Alignment (OSA) Distance
Kiến trúc đề xuất sử dụng **Optimal String Alignment (OSA) Distance** (biến thể restricted Damerau-Levenshtein chuẩn tắc):
- Hỗ trợ đầy đủ 4 phép biến đổi cơ bản:
  1. **Chèn ký tự (Insertion)** (ví dụ: `Danag` $\rightarrow$ `Danang`)
  2. **Xóa ký tự (Deletion)** (ví dụ: `Danangg` $\rightarrow$ `Danang`)
  3. **Thay thế ký tự (Substitution)** (ví dụ: `Saigpn` $\rightarrow$ `Saigon`)
  4. **Hoán vị 2 ký tự kề nhau (Transposition)** (ví dụ: `Haoni` $\rightarrow$ `Hanoi`) trong đó mỗi ký tự tham gia tối đa một phép hoán vị.
- Thuật toán chạy trên bảng quy hoạch động $O(M \times N)$, thực thi thuần in-memory với CPU footprint cực kỳ nhỏ.

### 6.2. Bảng Hằng Số Điểm Số Cố Định (Closed, Deterministic Scoring Formula)
Để bảo đảm tính xác định tuyệt đối (deterministic) khi viết code và chạy test, các mức điểm không dùng dải khoảng (range) mà được gán cố định thành các hằng số:

| Hằng số điểm (Score Constant) | Tên mức điểm (Level) | Điều kiện kích hoạt (Trigger Condition) | Ví dụ minh họa |
| :---: | :--- | :--- | :--- |
| **Score = 100** | `ExactMatch` | Toàn bộ chuỗi chuẩn hóa của trường mục tiêu (`Name`, `Address`, hoặc `City`) trùng khớp 100% với $Q_{norm}$. | Tìm `"Đà Nẵng"`, trường `City` là `"Đà Nẵng"` $\rightarrow$ Trùng khớp tuyệt đối trên City. |
| **Score = 90** | `PrefixMatch` | Chuỗi chuẩn hóa của trường mục tiêu bắt đầu bằng $Q_{norm}$. | Tìm `"Hà Nội"`, trường `Name` là `"Hà Nội Melody"` $\rightarrow$ Prefix match trên Name. |
| **Score = 80** | `SubstringMatch` | $Q_{norm}$ là một chuỗi con liên tiếp nằm trong trường mục tiêu. | Tìm `"Central"`, trường `Name` là `"Khách Sạn Central Đà Nẵng"` $\rightarrow$ Substring match. |
| **Score = 75** | `AllTokensExactMatch` | Mọi token trong $Q_{norm}$ đều xuất hiện chính xác như một token riêng biệt trong trường mục tiêu (không phân biệt thứ tự). | Tìm `"biển đà nẵng"`, các trường chứa đầy đủ các token `["bien", "da", "nang"]`. |
| **Score = 60** | `TypoTolerantMatchTier1` | Tất cả token trong $Q_{norm}$ đều khớp (token ngắn $\le 2$ ký tự khớp Exact/Prefix, token $\ge 3$ ký tự có OSA distance $\le 1$) HOẶC condensed string có OSA distance = 1. | Tìm `"Danag"` (condensed dist = 1 tới `"danang"`), hoặc tìm `"da nag"` (token `"da"` exact, token `"nag"` dist = 1). |
| **Score = 50** | `TypoTolerantMatchTier2` | TẤT CẢ các token trong $Q_{norm}$ đều đạt ngưỡng OSA distance (với token $\ge 6$ ký tự đạt distance = 2), HOẶC condensed string (độ dài $\ge 7$) có OSA distance = 2. (Lưu ý: condensed string có distance = 1 luôn đạt Score = 60). | Tìm `"Nhatranggg"` (OSA dist = 2 tới `"nhatrang"`). |
| **Score = 0** | `NoMatch` | Không thỏa mãn bất kỳ điều kiện nào ở trên. Loại bỏ khỏi danh sách trả về (`[]`). | Tìm `"xyz999"` hoặc `"Tokyo"`. |

### 6.3. Công Thức Tính Điểm Tối Đa Trên Các Trường (Max Score per Field)
Với mỗi Property $P$, điểm liên quan của Property được tính bằng giá trị lớn nhất giữa các trường có tìm kiếm:
$$\text{RelevanceScore}(P) = \max \Big( \text{Score}(P.\text{Name}), \text{Score}(P.\text{City}), \text{Score}(P.\text{Address}) \Big)$$

### 6.4. Quy Tắc Xử Lý Token Ngắn & Truy Vấn Hỗn Hợp (Short-token & Typo Mixed Cases)
Khi người dùng nhập chuỗi gồm nhiều token $Q_{norm} = \{t_1, t_2, \dots, t_k\}$:
1. **Token ngắn ($\text{length}(t_i) \le 2$ ký tự):**
   - **BẮT BUỘC KHỚP EXACT HOẶC PREFIX** với một token mục tiêu.
   - **TUYỆT ĐỐI KHÔNG ÁP DỤNG TYPO TOLERANCE** để tránh false-positive (ví dụ: gõ `"Ha"` không được phép nhảy sang `"Da"` hay `"Ba"`).
2. **Token trung bình ($\text{length}(t_i) \in [3, 5]$ ký tự):**
   - Cho phép OSA distance $\le 1$.
3. **Token dài ($\text{length}(t_i) \ge 6$ ký tự):**
   - Cho phép OSA distance $\le 2$.
4. **Quy tắc khớp toàn bộ (All-Query-Tokens):**
   - Mọi token $t_i$ trong truy vấn đều phải tìm được một token tương ứng trong chuỗi mục tiêu thỏa mãn điều kiện độ dài của nó.
   - **Trường hợp hỗn hợp `"da nag"`:**
     - Token `"da"` (độ dài 2): Khớp exact với `"da"` trong `"da nang"`.
     - Token `"nag"` (độ dài 3): Khớp typo với `"nang"` (OSA distance = 1).
     - Cả 2 token đều thỏa mãn $\rightarrow$ Điểm gán là **Score = 60** (`TypoTolerantMatchTier1`).

### 6.5. Biên Độ Áp Dụng Condensed String Matching (Condensed Boundaries)
- **Điều kiện kích hoạt:** Chỉ áp dụng Condensed String Matching khi truy vấn $Q_{norm}$ là **một từ đơn duy nhất (1 token, không chứa khoảng trắng)** và có độ dài $\ge 4$ ký tự (ví dụ: `"danag"`, `"saigpn"`, `"haoni"`).
- **Cơ chế so khớp:** So khớp $Q_{condensed}$ với $T_{condensed}$ (chuỗi mục tiêu loại bỏ toàn bộ khoảng trắng):
  - Độ dài 4–6 ký tự: Cho phép OSA distance $\le 1$ $\rightarrow$ Score = 60.
  - Độ dài $\ge 7$ ký tự: Cho phép OSA distance $\le 2$ (nếu distance = 1 $\rightarrow$ Score = 60; nếu distance = 2 $\rightarrow$ Score = 50).
- Nếu truy vấn đã có khoảng trắng (nhiều token như `"da nag"`), thuật toán sử dụng quy tắc token-level matching tại mục 6.4 và không chạy condensed string matching.

### 6.6. Quy Tắc Tie-Breaking Xác Định Tuyệt Đối (Strict Deterministic Order)
Khi nhiều cơ sở lưu trú có cùng điểm số liên quan, thứ tự sắp xếp được quy định bằng bộ so sánh rõ ràng:
1. `RelevanceScore` Giảm dần (`DESC`)
2. `Name` Tăng dần theo thứ tự từ điển (`StringComparer.OrdinalIgnoreCase`) (`ASC`)
3. `Id` Tăng dần (`Guid.CompareTo`) (`ASC`)

### 6.7. Bảo Toàn Các Hành Vi Bất Biến (System Invariants)
- **Bảo toàn Existing Substring:** Tìm kiếm chuỗi con hiện hữu (ví dụ: gõ `"biển"` tìm ra `"Khách Sạn Biển Đông"`) luôn đạt Score = 80, tuyệt đối không bị mất kết quả hay bị xếp sau các kết quả typo match.
- **Loại trừ Inactive:** Chỉ truy vấn các cơ sở có `Status == PropertyStatus.Active`. Các cơ sở `Inactive` tuyệt đối không bao giờ được trả về.
- **Không fuzzy Ngày & Số khách:** Trường ngày nhận/trả phòng và số khách tuyệt đối không áp dụng fuzzy logic.

### 6.8. Bảng Dữ Liệu Fixtures Mẫu & Kết Quả Xếp Hạng Kỳ Vọng (Exact Fixture Calculation)
Xét tập dữ liệu 5 cơ sở lưu trú mẫu:
- **P1:** `Khách Sạn Biển Đông Đà Nẵng` (City: `Đà Nẵng`, Address: `Võ Nguyên Giáp, Sơn Trà`, Id: `00000000-0000-0000-0000-000000000001`)
- **P2:** `Khách Sạn Central Đà Nẵng` (City: `Đà Nẵng`, Address: `Nguyễn Văn Linh, Hải Châu`, Id: `00000000-0000-0000-0000-000000000002`)
- **P3:** `Khách Sạn Sài Gòn Central` (City: `Hồ Chí Minh`, Address: `Lê Lợi, Quận 1`, Id: `00000000-0000-0000-0000-000000000003`)
- **P4:** `Khách Sạn Hà Nội Melody` (City: `Hà Nội`, Address: `Hoàn Kiếm`, Id: `00000000-0000-0000-0000-000000000004`)
- **P5:** `Khách Sạn Hạ Long Bay` (City: `Quảng Ninh`, Address: `Bãi Cháy`, Id: `00000000-0000-0000-0000-000000000005`)

| Từ khóa nhập ($Q$) | Cơ sở khớp & Điểm số tính toán | Phân tầng & Mức điểm | Thứ tự xếp hạng kết quả (Expected Order) | Lý do xếp hạng & Tie-Break |
| :--- | :--- | :--- | :--- | :--- |
| `"Đà Nẵng"` | P1: City exact (100)<br>P2: City exact (100) | `ExactMatch`<br>(Score = 100) | **1. P1 (Khách Sạn Biển Đông Đà Nẵng)**<br>**2. P2 (Khách Sạn Central Đà Nẵng)** | Cùng Score = 100. Tie-break theo `Name` A-Z: *"Khách Sạn Biển Đông Đà Nẵng"* (B) đứng trước *"Khách Sạn Central Đà Nẵng"* (C). |
| `"Danag"` | P1: City condensed dist=1 (60)<br>P2: City condensed dist=1 (60) | `TypoTolerantMatchTier1`<br>(Score = 60) | **1. P1 (Khách Sạn Biển Đông Đà Nẵng)**<br>**2. P2 (Khách Sạn Central Đà Nẵng)** | Cùng Score = 60 (Condensed dist=1 tới "danang"). Tie-break theo `Name` A-Z. |
| `"da nag"` | P1: da exact + nag dist=1 (60)<br>P2: da exact + nag dist=1 (60) | `TypoTolerantMatchTier1`<br>(Score = 60) | **1. P1 (Khách Sạn Biển Đông Đà Nẵng)**<br>**2. P2 (Khách Sạn Central Đà Nẵng)** | Truy vấn hỗn hợp: "da" exact, "nag" dist=1. Cùng Score = 60, tie-break `Name` A-Z. |
| `"Central"` | P2: Name substring (80)<br>P3: Name substring (80) | `SubstringMatch`<br>(Score = 80) | **1. P2 (Khách Sạn Central Đà Nẵng)**<br>**2. P3 (Khách Sạn Sài Gòn Central)** | Cùng Score = 80. Tie-break `Name` A-Z: *"Khách Sạn Central Đà Nẵng"* (C) đứng trước *"Khách Sạn Sài Gòn Central"* (S). |
| `"Ha"` | P4: City prefix "ha noi" (90)<br>P5: Name substring "ha" trong "ha long" (80) | P4: `PrefixMatch` (90)<br>P5: `SubstringMatch` (80) | **1. P4 (Khách Sạn Hà Nội Melody)**<br>**2. P5 (Khách Sạn Hạ Long Bay)** | Token ngắn 2 ký tự: P4 đạt Prefix match trên City (Score 90), P5 đạt SubstringMatch trên Name (Score 80). Score 90 > Score 80. |
| `"Haoni"` | P4: City condensed dist=1 (60) | `TypoTolerantMatchTier1`<br>(Score = 60) | **1. P4 (Khách Sạn Hà Nội Melody)** | Hoán vị 'on' $\leftrightarrow$ 'no' tới "hanoi" (OSA dist = 1). Score = 60. |
| `"biển"` | P1: Name substring (80) | `SubstringMatch`<br>(Score = 80) | **1. P1 (Khách Sạn Biển Đông Đà Nẵng)** | Bảo toàn tìm kiếm chuỗi con tiếng Việt có dấu. |
| `"xyz999"` | Không cơ sở nào khớp | `NoMatch`<br>(Score = 0) | **`[]` (Mảng rỗng)** | Không tìm thấy kết quả nào, trả về mảng rỗng `[]`. |

---

## 7. Deliverable 6: Ma Trận Tiêu Chí Chấp Nhận & Trường Hợp Kiểm Thử (Acceptance Matrix)

| STT | Trường hợp kiểm thử (Test Case) | Đầu vào (Search Query) | Dữ liệu mục tiêu trong hệ thống | Kết quả mong đợi | Mức điểm (Score) | Tiêu chí đạt (Pass Criteria) |
| :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC01** | Khớp tiếng Việt có dấu | `"Đà Nẵng"` | Khách Sạn Biển Đông Đà Nẵng | Tìm thấy khách sạn tại Đà Nẵng | Score = 100 | City exact match, top 1 |
| **TC02** | Khớp tiếng Việt không dấu | `"da nang"` | Khách Sạn Biển Đông Đà Nẵng | Tìm thấy khách sạn tại Đà Nẵng | Score = 100 | City exact match sau chuẩn hóa |
| **TC03** | Khớp ký tự đ/Đ | `"Đồng Hới"` / `"dong hoi"` | Khách Sạn Central Đồng Hới | Tìm thấy chính xác | Score = 100 | Không phân biệt đ và d |
| **TC04** | Unicode chuẩn hóa NFD vs NFC | `"Đà Nẵng"` (NFD) | `"Đà Nẵng"` (NFC) | Khớp thành công 100% | Score = 100 | Chuẩn hóa Unicode Canonical |
| **TC05** | Typo 1 ký tự (Condensed string) | `"Danag"` (thiếu n) | Đà Nẵng / Danang | Gợi ý tìm thấy Đà Nẵng | Score = 60 | OSA distance = 1 trên condensed string |
| **TC06** | Typo 1 ký tự (6+ chars) | `"Saigpn"` (gõ nhầm o->p) | Sài Gòn / Saigon | Gợi ý tìm thấy Sài Gòn | Score = 60 | OSA distance = 1 trên condensed string |
| **TC07** | Hoán vị 2 ký tự liền kề | `"Haoni"` (thay vì Hanoi) | Hà Nội / Hanoi | Gợi ý tìm thấy Hà Nội | Score = 60 | OSA transposition distance = 1 |
| **TC08** | Từ khóa ngắn ($\le 2$ ký tự) | `"Ha"` | Hà Nội, Hạ Long | Khớp Prefix/Exact/Substring | Score = 90 / 80 | Tránh bùng nổ false-positive |
| **TC09** | Từ khóa rỗng / khoảng trắng | `""` hoặc `"   "` | Toàn bộ cơ sở lưu trú Active | Trả về 100% cơ sở Active | Mặc định | Giữ nguyên hành vi đã nghiệm thu |
| **TC10** | Không tìm thấy (No match) | `"Tokyo"` / `"xyz999"` | Cơ sở tại VN (HN, SG, ĐN) | Trả về mảng rỗng `[]` | Score = 0 | Hiển thị Empty State |
| **TC11** | Tính ổn định & Tie-breaking | `"Đà Nẵng"` | Biển Đông ĐN, Central ĐN | Xếp hạng: Score DESC $\rightarrow$ Name ASC $\rightarrow$ Id ASC | Hierarchy | Hoàn toàn xác định (Deterministic) |
| **TC12** | Race condition & Debounce | Gõ nhanh 5 ký tự liên tiếp | Các truy vấn trung gian | Chỉ request cuối cùng được thực thi sau 300ms | Client | Hủy request cũ |
| **TC13** | Đổi cơ sở lưu trú | Chuyển từ ĐN sang HN | Phòng cũ của ĐN | Reset ngay quote và selection về null | Client | Không để sót trạng thái phòng cũ |
| **TC14** | Responsive & Không tràn ngang | Màn hình 375px, 768px, 1440px | Giao diện toàn trang | Thiết kế không cuộn ngang, touch target $\ge 44$px | Layout | Đáp ứng các breakpoint CSS px |
| **TC15** | Bảo toàn Substring hiện hữu | `"biển"` | Khách Sạn Biển Đông | Khớp chính xác chuỗi con | Score = 80 | Không mất kết quả substring |
| **TC16** | Loại trừ cơ sở Inactive | `"Central"` | Cơ sở Central Inactive | Tuyệt đối không trả về cơ sở Inactive | Bộ lọc | `Status == PropertyStatus.Active` |
| **TC17** | Truy vấn hỗn hợp (Short + Typo) | `"da nag"` | Đà Nẵng / Danang | Khớp: "da" exact, "nag" dist=1 | Score = 60 | Hỗ trợ cụm từ gõ sai 1 phần |

---

## 8. Deliverable 7: Kế Hoạch Triển Khai Lát Cắt Nhỏ Nhất (Smallest Implementation Plan)

### 8.1. Phân Chia Các Bước Triển Khai Khi Được Duyệt Code
- **Bước 1 — Backend Utility & Query Handler:**
  - Tạo tệp `backend/src/HotelSaas.Application/Common/Utils/FuzzyMatcher.cs` triển khai thuật toán OSA Distance, tokenization và các hằng số điểm theo đúng bảng mục 6.2.
  - Tích hợp vào `GetPublicPropertiesQueryHandler.cs`: Lọc và sắp xếp danh sách `PublicPropertyDto`.
  - Viết Unit Tests `FuzzyMatcherTests.cs` (kiểm tra đầy đủ 17 test cases trong ma trận).
- **Bước 2 — Frontend UI Redesign:**
  - Nâng cấp `frontend/src/app/features/public-booking/booking.page.ts` theo bố cục Hero Search Bar và Hotel Cards hiện đại.
  - Bổ sung Fallback SVG Placeholder khi `imageUrl` là null.
  - Bổ sung Sticky Bottom Bar tóm tắt đặt phòng và thời gian giữ chỗ 15 phút.
  - Cập nhật test suite `public-booking.page.spec.ts` để kiểm chứng các trạng thái tương tác mới.
- **Bước 3 — Thu thập bằng chứng nghiệm thu (Evidence Verification):**
  - Chạy `vitest run` kiểm tra toàn bộ suite frontend.
  - Chạy `dotnet test` cho các test suite backend.

### 8.2. Ranh Giới Sở Hữu Tệp Tin (File Ownership Boundaries)
- **Được phép can thiệp (Trong vòng triển khai code sau khi PO/Codex duyệt):**
  - `backend/src/HotelSaas.Application/Common/Utils/FuzzyMatcher.cs` (mới)
  - `backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`
  - `frontend/src/app/features/public-booking/booking.page.ts`
  - `frontend/src/app/features/public-booking/public-booking.page.spec.ts`
  - `backend/tests/HotelSaas.Application.Tests/Public/FuzzyMatcherTests.cs` (mới)
- **TUYỆT ĐỐI KHÔNG CAN THIỆP:**
  - Các module của đồng đội: `Rooms`, `RoomTypes` (Nguyên - accessibility/responsive), `Housekeeping` (Tân - UX error/retry).
  - Không sửa database schema, không tạo migration, không kết nối database ngoài.
  - Không thay đổi cơ chế JWT, Auth, Tenant Middleware, Payment Gateway.

---

## 9. Các Cổng Quyết Định Của Product Owner (PO Gates)

Các cổng quyết định mang tính chiến lược dài hạn được bảo toàn nguyên vẹn:
1. **PO Gate 1 (Hợp đồng API tìm kiếm):** Giữ endpoint hiện tại `GET /api/public/properties?search=` hay tạo endpoint mới `GET /api/public/search/properties`? *(Khuyến nghị: Giữ endpoint hiện tại để bảo toàn tương thích ngược 100%)*.
2. **PO Gate 2 (Chính sách xuất bản):** Đồng bộ enforce `IsPublished == true` trên toàn bộ public discovery hay tiếp tục giữ `Status == Active`?
3. **PO Gate 3 (Nguồn Dataset Hành chính Việt Nam):** Cơ quan có thẩm quyền, phiên bản và ngày hiệu lực của danh mục Tỉnh/Thành/Quận/Huyện.
4. **PO Gate 4 (Kế hoạch Migration dữ liệu):** Bổ sung `ProvinceCode`, `Ward`, `WardCode`, `LandmarkTags` cho `Property`.
5. **PO Gate 5 (Cơ chế tìm kiếm phòng trống xuyên cơ sở):** Quy trình 2 bước hiện tại (Tìm cơ sở $\rightarrow$ Kiểm tra phòng trống cơ sở) so với cơ chế Aggregated search phòng trống toàn bộ cơ sở trong một Tỉnh/Thành.
