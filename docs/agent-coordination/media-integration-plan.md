# Kế Hoạch Tích Hợp Phương Tiện Hình Ảnh Hạng Phòng Cho Giao Diện Khách (GUEST-ROOM-MEDIA-PLAN-01) — Vòng 3

- **Mã nhiệm vụ:** `GUEST-ROOM-MEDIA-PLAN-01`
- **Vòng (Round):** 3 (Hiệu chỉnh tối thiểu: Ảnh chụp ngữ cảnh render bất biến `RoomImageRenderContext`, đóng chặt khi thiếu Property, kiểm thử sự kiện DOM thực tế)
- **Tác nhân:** `antigravity`
- **Thời điểm lập:** 2026-10-13
- **Kho lưu trữ mục tiêu:** `hotel-saas-v2` (`C:\Dev\hotel-saas-v2`)
- **Nhánh:** `develop`
- **Phạm vi nhiệm vụ:** Thuần túy khảo sát mã nguồn và lập đề xuất kỹ thuật (Survey & Proposal only). **Tuyệt đối không chỉnh sửa mã nguồn backend/frontend/database, không chạy migration/deploy, không vi phạm ranh giới phân công đội ngũ.**

---

## 1. Khảo Sát Hiện Trạng Mã Nguồn Thực Tế (Source-Backed Ground Truth Survey)

Khảo sát được giữ nguyên căn cứ từ các vòng trước, đối chiếu chính xác các tệp mã nguồn hiện hữu trên nhánh `develop`:
- **Backend DTOs:** [`PublicPropertyDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/DTOs/PublicPropertyDto.cs#L20) (dòng 20), [`PublicRoomTypeDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/DTOs/PublicRoomTypeDto.cs#L19) (dòng 19), [`PublicRoomTypeAvailabilityDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/DTOs/PublicRoomTypeAvailabilityDto.cs#L16) (dòng 16) đều đã có trường `public string? ImageUrl { get; set; }`. Hợp đồng DTO công khai hoàn chỉnh, không đòi hỏi thay đổi.
- **Domain Entities & Lược đồ:** Mã nguồn C# [`RoomType.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Domain/Entities/RoomType.cs#L68) (dòng 68) định nghĩa `ImageUrl`. Sự tồn tại vật lý của cột trong DB runtime là **`DB NOT VERIFIED`**. Thực thể [`Property.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Domain/Entities/Property.cs) chưa có trường `ImageUrl` (khoảng cách kỹ thuật / Gap).
- **Backend Handlers:** [`GetPublicAvailabilityQuery.cs#L175`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicAvailability/GetPublicAvailabilityQuery.cs#L175) chiếu trực tiếp `ImageUrl = rt.ImageUrl`. [`GetPublicPropertiesQuery.cs#L57`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs#L57) chiếu cứng `null`.
- **Seeder Mẫu:** [`LocalDevDataSeeder.cs#L626-L637`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs#L626-L637) khi khởi tạo mới bỏ qua `ImageUrl`. Tình trạng dữ liệu tồn tại trong DB thực tế runtime là **`DB NOT VERIFIED`**.
- **Frontend Template:** [`booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts) đã có rẽ nhánh `*ngIf="rt.imageUrl"` (dòng 577) và khối SVG dự phòng khi `null` (dòng 578–591) kèm nhãn minh họa (dòng 594). Thiếu bộ bắt lỗi tải ảnh `(error)` khi tài nguyên ảnh bị hỏng (broken image).

---

## 2. Ranh Giới Dữ Liệu & Phân Tách Quyền Hạn (Identity & Rights Separation)

1. **Phân Tách Độc Lập Lát Cắt Broken-Image Fallback:**
   - Lát cắt tối thiểu chỉ tập trung vào **xử lý lỗi ảnh vỡ (Broken-Image Error Fallback)** trên giao diện cho phương tiện hiện có.
   - Không gán nhãn AI vô điều kiện lên `rt.imageUrl`. DTO không có trường chỉ báo xuất xứ; một URL có thể là ảnh chụp thật.
   - Bảo toàn nguyên vẹn thuộc tính `[alt]="rt.roomTypeName"` cho thẻ `<img>`.
   - Nhãn minh họa chỉ hiển thị trên khối đồ họa SVG dự phòng.
2. **Quyền Tài Nguyên Dài Hạn (Non-blocking):**
   - 33 ảnh Legacy (`LEGACY-ROOM-ASSETS-01`) tiếp tục duy trì cách ly (**Quarantine**, `Rights NOT VERIFIED`).
   - 4 ảnh AI (`ROOM-AI-DEMO-PACK-01`) là tài liệu minh họa offline môn học (`Commercial Rights NOT VERIFIED`), không cấp phép sản xuất.
   - Việc cung cấp ảnh thực tế, migration lược đồ `Property.ImageUrl`, và hạ tầng Blob Storage là các vấn đề tách biệt, không phải điều kiện tiên quyết (non-blocking) cho lát cắt xử lý lỗi ảnh vỡ trên giao diện này.
   - Bảo toàn 7 Cổng quyết định PO trong `decisions.md` (`NeedsPO`), Phase 6 tiếp tục đóng, và bảo toàn phân công đội ngũ.

---

## 3. Đề Xuất Lát Cắt Triển Khai Tối Thiểu (Smallest Implementation Slice Proposal)

### 3.1. Vấn Đề Kỹ Thuật Đã Được Nhận Diện (Vòng 2 Finding):
Nếu template Angular truyền trực tiếp biến trạng thái của component như:
```html
(error)="onRoomImageError(rt.roomTypeId, rt.imageUrl, availabilityRequestId)"
```
thì khi sự kiện `error` của thẻ `<img>` kích hoạt bất đồng bộ, Angular sẽ **tính toán lại biểu thức theo trạng thái hiện tại của component**. Nếu người dùng đã chuyển cơ sở hoặc gửi yêu cầu tìm kiếm mới, `availabilityRequestId` được truyền vào handler sẽ là ID mới, khiến phép so sánh `eventRequestId !== this.availabilityRequestId` so sánh ID mới với chính nó và **không thể nhận diện sự kiện muộn của ảnh cũ**. Đồng thời, việc fallback sang `'global'` khi thiếu `propertyId` làm mất tính cô lập dữ liệu chi nhánh.

### 3.2. Giải Pháp Vòng 3: Chụp Ngữ Cảnh Render Bất Biến (Immutable Render Identity Snapshot)

#### 1. Định nghĩa Kiểu Dữ Liệu Ngữ Cảnh Bất Biến (`RoomImageRenderContext`):
```typescript
/**
 * Ảnh chụp bất biến của ngữ cảnh hiển thị ảnh tại thời điểm render.
 * Đóng băng thông tin cơ sở, thế hệ yêu cầu, loại phòng và URL chính xác.
 */
export interface RoomImageRenderContext {
  readonly propertyId: string;
  readonly generation: number;
  readonly roomTypeId: string;
  readonly url: string;
}
```

#### 2. Xây Dựng View Model Hoặc Khởi Tạo Ngữ Cảnh Lúc Nhận Dữ Liệu:
Khi nhận phản hồi dữ liệu availability cho cơ sở hiện tại:
```typescript
// Trong hàm xử lý kết quả availability:
const currentProp = this.selectedProperty();
// Fail closed nếu thiếu property: không khởi tạo ngữ cảnh hiển thị ảnh
if (!currentProp) {
  this.roomImageViewModels.set([]);
  return;
}

const currentGeneration = this.availabilityRequestId;

// Gắn ngữ cảnh bất biến cho từng mục phòng hiển thị:
const viewModels = availabilityData.map(rt => ({
  ...rt,
  imageContext: rt.imageUrl && rt.imageUrl.trim() ? {
    propertyId: currentProp.id,
    generation: currentGeneration,
    roomTypeId: rt.roomTypeId,
    url: rt.imageUrl.trim()
  } as RoomImageRenderContext : null
}));
```

#### 3. Bộ Bắt Lỗi và Kiểm Tra Sẵn Sàng (Fail Closed, Kháng Sự Kiện Muộn):
Trong `BookingPage`:
```typescript
// Quản lý khóa ảnh bị lỗi tải: key = `${propertyId}:${roomTypeId}:${url}`
failedImageKeys = signal<Set<string>>(new Set<string>());

/**
 * Xử lý khi thẻ <img> gặp lỗi tải tài nguyên.
 * Nhận ảnh chụp bất biến được truyền từ template tại thời điểm render.
 */
onRoomImageError(ctx: RoomImageRenderContext | null): void {
  if (!ctx) return;

  const currentProperty = this.selectedProperty();

  // 1. Fail closed nếu không có cơ sở hiện tại
  if (!currentProperty) {
    return;
  }

  // 2. Loại bỏ sự kiện muộn từ thẻ ảnh cũ:
  // Nếu propertyId đã đổi (A -> B) hoặc generation đã đổi (yêu cầu mới),
  // sự kiện lỗi thuộc về phần tử DOM cũ đã bị hủy ngữ cảnh -> BỎ QUA HOÀN TOÀN!
  if (currentProperty.id !== ctx.propertyId || this.availabilityRequestId !== ctx.generation) {
    return;
  }

  // 3. Kiểm tra tính hợp lệ của URL
  if (!ctx.url || !ctx.url.trim()) {
    return;
  }

  // 4. Ghi nhận lỗi theo đúng khóa ngữ cảnh được cô lập
  const key = `${ctx.propertyId}:${ctx.roomTypeId}:${ctx.url.trim()}`;
  const currentSet = new Set(this.failedImageKeys());
  currentSet.add(key);
  this.failedImageKeys.set(currentSet);
}

/**
 * Kiểm tra xem ảnh có sẵn sàng để hiển thị không.
 * Trả về false (kích hoạt SVG fallback) nếu thiếu context, thiếu property,
 * thế hệ bị lệch, hoặc khóa ảnh đã nằm trong danh sách lỗi.
 */
isImageAvailable(ctx: RoomImageRenderContext | null): boolean {
  if (!ctx) return false;

  const currentProperty = this.selectedProperty();
  // Fail closed nếu thiếu cơ sở hoặc cơ sở không khớp
  if (!currentProperty || currentProperty.id !== ctx.propertyId) {
    return false;
  }

  // Thế hệ không khớp với yêu cầu hiện hành
  if (this.availabilityRequestId !== ctx.generation) {
    return false;
  }

  const key = `${ctx.propertyId}:${ctx.roomTypeId}:${ctx.url.trim()}`;
  return !this.failedImageKeys().has(key);
}

/**
 * Thao tác thử lại tải ảnh (Retry) cho cùng một URL.
 */
retryRoomImage(ctx: RoomImageRenderContext | null): void {
  if (!ctx) return;
  const currentProperty = this.selectedProperty();
  if (!currentProperty || currentProperty.id !== ctx.propertyId) return;

  const key = `${ctx.propertyId}:${ctx.roomTypeId}:${ctx.url.trim()}`;
  const currentSet = new Set(this.failedImageKeys());
  if (currentSet.delete(key)) {
    this.failedImageKeys.set(currentSet);
  }
}
```

#### 4. Cập Nhật Template Thẻ Phòng:
```html
<div class="relative bg-slate-100 h-36 flex items-center justify-center overflow-hidden rounded-2xl mb-4">
  <!-- 1. Ảnh phòng hiện có: Truyền snapshot bất biến ctx vào hàm bắt lỗi -->
  <img
    *ngIf="isImageAvailable(item.imageContext)"
    [src]="item.imageContext!.url"
    [alt]="item.roomTypeName"
    (error)="onRoomImageError(item.imageContext)"
    class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
  />

  <!-- 2. Khối SVG Dự phòng khi ImageUrl rỗng/null, thiếu property, hoặc tải lỗi -->
  <svg
    *ngIf="!isImageAvailable(item.imageContext)"
    class="w-full h-full"
    viewBox="0 0 320 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid slice"
    role="img"
    aria-label="Hình minh họa sơ đồ bố trí phòng mẫu"
  >
    <rect width="320" height="140" fill="#f8fafc"/>
    <rect x="30" y="25" width="260" height="95" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="80" y="40" width="160" height="20" rx="3" fill="#cbd5e1"/>
    <rect x="90" y="55" width="65" height="50" rx="4" fill="#6366f1" opacity="0.85"/>
    <rect x="165" y="55" width="65" height="50" rx="4" fill="#6366f1" opacity="0.85"/>
    <text x="160" y="125" font-family="system-ui, sans-serif" font-size="8.5" font-weight="600" letter-spacing="1" fill="#94a3b8" text-anchor="middle">HÌNH MINH HỌA HẠNG PHÒNG</text>
  </svg>

  <!-- 3. Chú thích minh họa SVG: Chỉ hiển thị khi đang dùng đồ họa SVG fallback -->
  <div
    *ngIf="!isImageAvailable(item.imageContext)"
    class="absolute bottom-2.5 right-2.5 bg-slate-900/80 backdrop-blur-xs text-slate-200 text-[10px] font-semibold px-2.5 py-0.5 rounded-md border border-slate-700/70 shadow-2xs pointer-events-none select-none"
  >
    Hình minh họa — bố trí phòng mẫu
  </div>
</div>
```

#### 5. Đồng Bộ Hóa Xóa Trạng Thái Khi Đổi Chi Nhánh (`resetSelectionAndAvailability`):
```typescript
private resetSelectionAndAvailability(): void {
  this.selectedRoomTypeId.set(null);
  this.selectedRoomType.set(null);
  this.currentQuote.set(null);
  this.availabilityList.set([]);
  this.failedImageKeys.set(new Set<string>()); // Reset triệt để trạng thái lỗi ảnh
  this.isLoadingAvailability.set(false);
  this.isLoadingQuote.set(false);
  this.availabilityRequestId++;
  this.quoteRequestId++;
  this.availabilitySub?.unsubscribe();
  this.quoteSub?.unsubscribe();
}
```

---

## 4. Tiêu Chí Chấp Nhận Hành Vi Dựa Trên Nguồn (Source-Backed Acceptance Criteria)

Khi lát cắt được triển khai, các hành vi sẽ được kiểm chứng bằng bộ tiêu chí chấp nhận và ca kiểm thử sự kiện DOM thực tế:

- **AC-MEDIA-01 (Fail Closed on Missing Property):**
  - *Điều kiện:* `selectedProperty()` là `null` hoặc `undefined`.
  - *Hành vi:* `isImageAvailable` trả về `false`, không sử dụng chuỗi `'global'` làm fallback, giao diện hiển thị SVG an toàn.

- **AC-MEDIA-02 (Null / Blank / Whitespace Image Fallback):**
  - *Điều kiện:* `rt.imageUrl` là `null`, `""`, hoặc `"   "`.
  - *Hành vi:* `imageContext` là `null`. Giao diện hiển thị ngay đồ họa SVG dự phòng; không render thẻ `<img>`, không kích hoạt mạng lỗi.

- **AC-MEDIA-03 (Runtime Broken Image Fallback with Exact Snapshot):**
  - *Điều kiện:* `ctx` mang `{ propertyId: 'prop-1', generation: 1, roomTypeId: 'rt-1', url: 'https://hotel.vn/broken.jpg' }`. Thẻ `<img>` kích hoạt sự kiện `(error)`.
  - *Hành vi:* Khóa `'prop-1:rt-1:https://hotel.vn/broken.jpg'` được thêm vào `failedImageKeys()`. Thẻ `<img>` bị gỡ bỏ và khối SVG dự phòng được hiển thị thay thế mà không xô lệch bố cục trang.

- **AC-MEDIA-04 (Same-ID New URL Rendering):**
  - *Điều kiện:* Loại phòng `rt-1` tại `prop-1` trước đó bị lỗi URL cũ. Sau đó dữ liệu availability trả về URL mới `https://hotel.vn/new.jpg`.
  - *Hành vi:* `ctx.url` mới tạo khóa chưa nằm trong `failedImageKeys()`. `isImageAvailable(ctx)` trả về `true`. Thẻ `<img>` được render bình thường với URL mới.

- **AC-MEDIA-05 (Mounted DOM Late Event Discarded on Property Switch A $\to$ B):**
  - *Điều kiện:*
    1. Đang ở Cơ sở A (`propertyId: 'prop-A'`), thẻ `<img>` được gắn vào DOM với `ctx = { propertyId: 'prop-A', generation: 1, roomTypeId: 'rt-1', url: 'url-A' }`.
    2. Người dùng chuyển sang Cơ sở B: `selectedProperty` chuyển thành `prop-B`, `availabilityRequestId` tăng lên 2.
    3. Thẻ `<img>` cũ của Cơ sở A phát sinh sự kiện lỗi `error` thực tế trên DOM: `imgElementA.dispatchEvent(new Event('error'))`.
  - *Hành vi:* Handler đối chiếu `ctx.propertyId ('prop-A') !== currentProperty.id ('prop-B')` và `ctx.generation (1) !== 2`. Sự kiện lỗi bị **BỎ QUA HOÀN TOÀN**; không có khóa lỗi nào bị ghi nhận cho Cơ sở B.

- **AC-MEDIA-06 (Mounted DOM Late Event Discarded on Search Refresh Generation):**
  - *Điều kiện:*
    1. Cơ sở A đang ở `generation: 1`. Thẻ `<img>` gắn trên DOM với `ctx.generation = 1`.
    2. Người dùng thay đổi ngày nhận/trả phòng, kích hoạt tìm kiếm mới làm tăng `availabilityRequestId` lên 2.
    3. Thẻ `<img>` cũ của generation 1 phát sinh lỗi muộn: `imgElement.dispatchEvent(new Event('error'))`.
  - *Hành vi:* Do `ctx.generation (1) !== this.availabilityRequestId (2)`, sự kiện lỗi bị bỏ qua; không ảnh hưởng đến dữ liệu hiển thị của thế hệ mới.

- **AC-MEDIA-07 (Same-ID / Same-URL Cross-Property Isolation):**
  - *Điều kiện:* Cơ sở A và Cơ sở B tình cờ có cùng `roomTypeId` hoặc cùng `url` ảnh. Ảnh ở Cơ sở A bị lỗi tải.
  - *Hành vi:* Do khóa lỗi có tiền tố `${propertyId}`, chỉ Cơ sở A bị ghi nhận lỗi; Cơ sở B vẫn render ảnh bình thường nếu ảnh tại B tải thành công.

- **AC-MEDIA-08 (Explicit Same-URL Retry on Mounted Element):**
  - *Điều kiện:* Một ảnh bị lỗi tải và đã rơi về SVG fallback. Người dùng kích hoạt thao tác thử lại hoặc hàm `retryRoomImage(ctx)` được gọi.
  - *Hành vi:* Khóa lỗi tương ứng được xóa khỏi `failedImageKeys()`. Thẻ `<img>` được render lại để thử tải lại tài nguyên.

- **AC-MEDIA-09 (Preserved Alt Text Integrity):**
  - *Điều kiện:* Thẻ `<img>` render media hiện có.
  - *Hành vi:* Thuộc tính `[alt]` mang giá trị chính xác `item.roomTypeName`. Không tự ý gán nhãn AI khi chưa có siêu dữ liệu xuất xứ. Nhãn minh họa chỉ gắn kèm khối đồ họa SVG fallback.

---

## 5. Định Nghĩa Hoàn Thành (Definition of Done — DoD)

- [x] Chụp ảnh ngữ cảnh render bất biến `RoomImageRenderContext` (gồm `propertyId`, `generation`, `roomTypeId`, `exactURL`).
- [x] Đóng chặt cơ chế khi thiếu cơ sở (Fail closed without property, loại bỏ hoàn toàn `'global'` fallback).
- [x] So sánh ngữ cảnh snapshot với trạng thái hiện hành của component, kháng hoàn toàn sự kiện lỗi đến muộn từ DOM cũ.
- [x] Bổ sung đầy đủ kịch bản kiểm thử sự kiện DOM thực tế (AC-MEDIA-01 đến AC-MEDIA-09): chuyển cơ sở A $\to$ B, làm mới thế hệ tìm kiếm, cùng ID URL mới, cùng URL xuyên cơ sở, và retry.
- [x] Giữ nguyên các cải tiến đã đóng: bảo toàn `[alt]`, phân tách AI provenance, SVG minh họa, khảo sát mã nguồn chuẩn xác với `DB NOT VERIFIED`.
- [x] Bảo toàn nguyên vẹn 7 Cổng quyết định PO, Phase 6 đóng, và ranh giới phân công đội ngũ.
