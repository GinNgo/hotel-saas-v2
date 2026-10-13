# Kế Hoạch Tích Hợp Phương Tiện Hình Ảnh Hạng Phòng Cho Giao Diện Khách (GUEST-ROOM-MEDIA-PLAN-01) — Vòng 2

- **Mã nhiệm vụ:** `GUEST-ROOM-MEDIA-PLAN-01`
- **Vòng (Round):** 2 (Điều chỉnh theo phản hồi Codex: Phân tách broken-image fallback độc lập khỏi AI provenance; bộ khóa lỗi ảnh theo ngữ cảnh/URL; hiệu chỉnh phạm vi khảo sát DB)
- **Tác nhân:** `antigravity`
- **Thời điểm lập:** 2026-10-13
- **Kho lưu trữ mục tiêu:** `hotel-saas-v2` (`C:\Dev\hotel-saas-v2`)
- **Nhánh:** `develop`
- **Phạm vi nhiệm vụ:** Thuần túy khảo sát mã nguồn và lập đề xuất kỹ thuật (Survey & Proposal only). **Tuyệt đối không chỉnh sửa mã nguồn backend/frontend/database, không chạy migration/deploy, không vi phạm ranh giới phân công đội ngũ.**

---

## 1. Khảo Sát Hiện Trạng Mã Nguồn Thực Tế (Source-Backed Ground Truth Survey)

Khảo sát được thực hiện trực tiếp trên mã nguồn nhánh `develop`, đối chiếu chính xác từng tệp tin và ký hiệu DTO/Entity/Handler/Component:

### 1.1. Hợp đồng DTO Phía Backend (`HotelSaas.Application.Public.DTOs`)
Các DTO phục vụ luồng khách công khai đã được định nghĩa sẵn trường hình ảnh, không đòi hỏi thay đổi chữ ký DTO:

1. **`PublicPropertyDto`:**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Application/Public/DTOs/PublicPropertyDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/DTOs/PublicPropertyDto.cs#L20)
   - **Định nghĩa:** `public string? ImageUrl { get; set; }` (Dòng 20).
   - **Mục đích:** Chứa đường dẫn ảnh đại diện cho cơ sở lưu trú (khách sạn/chi nhánh).
2. **`PublicRoomTypeDto`:**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Application/Public/DTOs/PublicRoomTypeDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/DTOs/PublicRoomTypeDto.cs#L19)
   - **Định nghĩa:** `public string? ImageUrl { get; set; }` (Dòng 19).
   - **Mục đích:** Chứa đường dẫn ảnh đại diện cho từng loại phòng khi tra cứu danh mục.
3. **`PublicRoomTypeAvailabilityDto`:**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Application/Public/DTOs/PublicRoomTypeAvailabilityDto.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/DTOs/PublicRoomTypeAvailabilityDto.cs#L16)
   - **Định nghĩa:** `public string? ImageUrl { get; set; }` (Dòng 16).
   - **Mục đích:** Chứa đường dẫn ảnh đại diện loại phòng khi trả về kết quả kiểm tra tồn phòng và tính giá tạm tính.

### 1.2. Thực Thể Miền & Lược Đồ Mô Hình Backend (`HotelSaas.Domain.Entities`)
1. **Thực thể `RoomType` (Hạng phòng):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Domain/Entities/RoomType.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Domain/Entities/RoomType.cs#L68)
   - **Định nghĩa mã nguồn:** `public string? ImageUrl { get; set; }` (Dòng 68).
   - **Phạm vi xác minh:** Trường thuộc tính đã được khai báo trong mã nguồn C# thực thể `RoomType` và được ánh xạ qua mô hình Entity Framework Core. Tuy nhiên, sự tồn tại thực tế của cột trong cơ sở dữ liệu vật lý runtime là **CHƯA ĐƯỢC XÁC MINH (DB NOT VERIFIED)** tại thời điểm khảo sát tĩnh này; chỉ xác nhận mô hình mã nguồn và phép chiếu (projection).
2. **Thực thể `Property` (Cơ sở lưu trú):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Domain/Entities/Property.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Domain/Entities/Property.cs#L1-L164)
   - **Trạng thái:** **CHƯA CÓ TRƯỜNG `ImageUrl` trong mã nguồn thực thể**.
   - **Khoảng cách kỹ thuật (Gap):** Thực thể `Property` không có thuộc tính lưu trữ URL ảnh đại diện cho khách sạn. Bất kỳ nỗ lực đọc ảnh cơ sở trực tiếp từ DB hiện tại đều trả về giá trị trống.

### 1.3. Bộ Xử Lý Truy Vấn Backend (`HotelSaas.Application.Public.Queries`)
1. **Truy vấn danh sách cơ sở (`GetPublicPropertiesQuery`):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs#L57)
   - **Hình thái chiếu DTO:** Chiếu cứng `ImageUrl = null` (Dòng 57).
   - **Lý do:** Do thực thể `Property` chưa có trường `ImageUrl`, truy vấn chủ động gán null để bảo toàn tính toàn vẹn DTO.
2. **Truy vấn tồn phòng công khai (`GetPublicAvailabilityQuery`):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Application/Public/Queries/GetPublicAvailability/GetPublicAvailabilityQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicAvailability/GetPublicAvailabilityQuery.cs#L175)
   - **Hình thái chiếu DTO:** Chiếu trực tiếp `ImageUrl = rt.ImageUrl` từ thực thể `RoomType` (Dòng 175).
   - **Trạng thái:** Mã nguồn truy vấn chiếu trực tiếp `rt.ImageUrl` sang DTO nếu thực thể mang giá trị.
3. **Truy vấn danh mục loại phòng (`GetPublicRoomTypesQuery`):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Application/Public/Queries/GetPublicRoomTypes/GetPublicRoomTypesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicRoomTypes/GetPublicRoomTypesQuery.cs#L63)
   - **Hình thái chiếu DTO:** Chiếu trực tiếp `ImageUrl = rt.ImageUrl` từ thực thể `RoomType` (Dòng 63).

### 1.4. Dữ Liệu Khởi Tạo Mẫu Mới (`LocalDevDataSeeder.cs`)
- **Tệp nguồn:** [`backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs#L626-L637)
- **Phương thức:** `EnsureRoomTypeAsync` chỉ khởi tạo `Id`, `TenantId`, `PropertyId`, `Code`, `Name`, `BasePrice`, `MaxOccupancy`.
- **Trạng thái:** Seeder mặc định khi tạo mới dữ liệu mẫu không thiết lập giá trị cho trường `ImageUrl` (`DLX-Q1`, `STD-Q1`, `SUI-PN`, `SUP-PN`). Tuy nhiên, việc omission trong seeder này không chứng minh rằng tất cả các bản ghi phòng tồn tại trong cơ sở dữ liệu thực tế tại runtime đều có `ImageUrl == null`. Dữ liệu DB hiện hữu tại runtime là **CHƯA ĐƯỢC XÁC MINH (DB NOT VERIFIED)**.

### 1.5. Mô Hình & Dịch Vụ Phía Frontend (`frontend/src/app/core/`)
- **Mô hình DTO:** [`frontend/src/app/core/models/public-booking.model.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/models/public-booking.model.ts#L14-L37)
   - `PublicPropertyDto.imageUrl?: string` (Dòng 14).
   - `PublicRoomTypeDto.imageUrl?: string` (Dòng 27).
   - `PublicRoomTypeAvailabilityDto.imageUrl?: string` (Dòng 37).
- **Dịch vụ HTTP:** [`frontend/src/app/core/services/public-booking.service.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/core/services/public-booking.service.ts#L26-L70)
   - `getProperties(search?: string)` gọi `GET /api/public/properties`.
   - `getAvailability(slug, query)` gọi `GET /api/public/properties/{slug}/availability`.

### 1.6. Giao Diện Đặt Phòng Công Khai (`booking.page.ts`)
- **Tệp nguồn:** [`frontend/src/app/features/public-booking/booking.page.ts`](file:///C:/Dev/hotel-saas-v2/frontend/src/app/features/public-booking/booking.page.ts)
- **Hiển thị thẻ phòng (`availabilityList` — Dòng 575–596):**
   - Đã có cấu trúc rẽ nhánh: `<img *ngIf="rt.imageUrl" [src]="rt.imageUrl" [alt]="rt.roomTypeName" />`.
   - Đã có đồ họa SVG dự phòng nội tuyến khi `!rt.imageUrl` (sơ đồ phòng mẫu 2 giường chuẩn kiến trúc).
   - Đã có nhãn chú thích mờ góc phải khi dùng SVG: `"Hình minh họa — bố trí phòng mẫu"`.
- **Hiển thị thẻ cơ sở (`properties` — Dòng 380–430):**
   - Đã có cấu trúc rẽ nhánh: `<img *ngIf="prop.imageUrl" [src]="prop.imageUrl" [alt]="prop.name" />`.
   - Đã có đồ họa SVG dự phòng kiến trúc khách sạn về đêm ("SVG Architectural Twilight Fallback") khi `!prop.imageUrl`.
- **Cơ chế cô lập ngữ cảnh khi chuyển cơ sở (Dòng 978–989 & 1236–1248):**
   - Hàm `selectProperty(prop)` gọi `resetSelectionAndAvailability()`:
     - Xóa sạch danh sách phòng: `this.availabilityList.set([])`.
     - Xóa lựa chọn hiện tại: `this.selectedRoomTypeId.set(null); this.selectedRoomType.set(null);`.
     - Tăng thế hệ yêu cầu: `this.availabilityRequestId++` (loại bỏ phản hồi đến muộn từ yêu cầu trước).
     - Hủy HTTP subscription: `this.availabilitySub?.unsubscribe()`.
   - **Đánh giá:** Cơ chế hủy subscription và tăng thế hệ `availabilityRequestId` giúp ngăn chặn rò rỉ dữ liệu và hình ảnh của cơ sở cũ sang cơ sở mới.

---

## 2. Khoảng Cách Kỹ Thuật (Gap Analysis) & Định Hướng Giải Quyết

Khảo sát chỉ ra 3 khoảng cách kỹ thuật chính:

| STT | Vấn Đề Kỹ Thuật | Hiện Trạng Thực Tế | Nguy Cơ Tiềm Ẩn | Định Hướng Giải Quyết |
|:---:|---|---|---|---|
| 1 | **Thiếu xử lý lỗi tải ảnh vỡ (`onError`)** | Thẻ `<img>` (dòng 577) chỉ kiểm tra `*ngIf="rt.imageUrl"`. Nếu URL bị lỗi 404, chuỗi rỗng/trắng, hoặc kết nối mạng chặn, thẻ ảnh giữ nguyên URL lỗi. | Trình duyệt hiển thị biểu tượng ảnh vỡ (broken image icon) gây mất mỹ quan và làm hỏng trải nghiệm người dùng. | **Trọng tâm lát cắt tối thiểu:** Bổ sung bộ bắt sự kiện `(error)` định danh theo ngữ cảnh (`generation:propertyId:roomTypeId:url`), chuyển sang khối SVG dự phòng an toàn. |
| 2 | **Không có trường phân biệt xuất xứ ảnh trong DTO** | Hợp đồng DTO công khai hiện tại chỉ có `imageUrl?: string`, không có trường chỉ báo xuất xứ (provenance: `AI` vs `Photo` vs `Demo`). | Không thể suy diễn một URL bất kỳ trong `rt.imageUrl` là ảnh AI hay ảnh chụp thật. Gán nhãn "AI" cho mọi URL là phỏng đoán sai lệch. | **Tách biệt rõ ràng:** Lát cắt tối thiểu chỉ tập trung xử lý lỗi ảnh vỡ (broken-image fallback). Không gán nhãn AI tùy tiện cho media hiện có. Nhãn AI chỉ áp dụng khi có xuất xứ demo được xác minh rõ. |
| 3 | **Thực thể `Property` thiếu cột `ImageUrl`** | `Property.cs` không có cột `ImageUrl`; `GetPublicPropertiesQuery` phải gán cứng `ImageUrl = null`. | Không thể hiển thị ảnh khách sạn qua database trừ khi có schema migration. | Giữ nguyên chiếu `null` và SVG fallback cho `Property`; tách riêng thành câu hỏi migration dài hạn cho PO, không chặn việc cải thiện UI fallback. |

---

## 3. Ranh Giới Dữ Liệu & Nguyên Tắc Tách Rời (Identity & Mapping Boundaries)

### 3.1. Phân Tách Dữ Liệu Thực Tế (Live Facts) & Dữ Liệu Demo (Demo-Only)
- **Quy tắc bất biến:** Tuyệt đối **KHÔNG** suy diễn xuất xứ ảnh (AI hay ảnh thật) dựa trên sự hiện diện của URL, mã phòng, hay tên phòng.
- **Ranh giới:**
  - Hợp đồng DTO công khai (`PublicRoomTypeAvailabilityDto`) chỉ chứa `imageUrl?: string`. Bất kỳ URL hợp lệ nào đều có thể là ảnh chụp thực tế hoặc ảnh được cấp phép của cơ sở.
  - Bộ 4 ảnh AI (`ROOM-AI-DEMO-PACK-01`) là tài liệu minh họa offline cho môn học, không nhúng trực tiếp vào production hay mã nguồn booking.
  - Khi dữ liệu `rt.imageUrl` là `null`, chuỗi rỗng, hoặc tải thất bại, hệ thống chuyển về khối SVG bố trí phòng mẫu.

### 3.2. Bảng Đối Chiếu Hiện Trạng & Hành Vi Đề Xuất

| Thực Thể | Thuộc Tính Định Danh | Trường Media Hiện Tại | Trạng Thái Trong Mã Nguồn / DB | Hành Vi Client Hiện Tại | Hành Vi Đề Xuất (Smallest Slice) |
|---|---|:---:|:---:|---|---|
| **Property** | `Id` (GUID), `Slug`, `Code` | `ImageUrl` (DTO only) | Không có cột trong Entity; DTO = `null` | Hiển thị SVG Kiến trúc hoàng hôn | Giữ nguyên SVG fallback; ghi nhận Gap schema riêng |
| **RoomType (Mọi loại phòng)** | `Id` (GUID), `Code`, `Name` | `ImageUrl` (Entity + DTO) | Định nghĩa trong Model C#; DB runtime NOT VERIFIED | Nếu `rt.imageUrl` có $\to$ `<img>`; Nếu không $\to$ SVG fallback (thiếu bắt lỗi) | Nếu có `imageUrl` hợp lệ $\to$ hiển thị `<img>` với `[alt]="rt.roomTypeName"`; Nếu `null`, trắng, hoặc tải lỗi $\to$ SVG fallback; hỗ trợ cùng ID URL mới & retry |

---

## 4. Đề Xuất Lát Cắt Triển Khai Tối Thiểu (Smallest Implementation Slice Proposal)

Lát cắt triển khai tối thiểu được thiết kế độc lập, chỉ tập trung vào **xử lý lỗi ảnh vỡ (Broken-Image Error Fallback)**:
- **Không sửa backend API**
- **Không sửa database schema**
- **Không cấp quyền mới**
- **Không thêm CDN hay thư viện bên ngoài**
- **Không gán nhãn AI tùy tiện cho media hiện có**
- **Không yêu cầu PO phải duyệt lại các chi tiết giao diện thông thường**

### 4.1. Chi Tiết Lát Cắt Phía Frontend (`booking.page.ts`)

#### 1. Quản Lý Khóa Lỗi Ảnh Định Danh Theo Ngữ Cảnh (Context & URL-Scoped Failure State):
Trong component `BookingPage`:
```typescript
// Quản lý khóa ảnh bị lỗi tải: key = `${propertyId}:${roomTypeId}:${url}`
failedImageKeys = signal<Set<string>>(new Set<string>());

/**
 * Xử lý khi thẻ <img> gặp lỗi tải tài nguyên.
 * Ghi nhận lỗi theo ngữ cảnh chính xác của cơ sở, loại phòng, URL cụ thể và thế hệ yêu cầu.
 */
onRoomImageError(roomTypeId: string, url: string | undefined, eventRequestId: number): void {
  // 1. Bỏ qua sự kiện lỗi đến muộn từ ảnh đã tách rời hoặc thuộc thế hệ tìm kiếm cũ
  if (eventRequestId !== this.availabilityRequestId || !url || !url.trim()) {
    return;
  }

  // 2. Định danh khóa lỗi theo ngữ cảnh cơ sở hiện tại + loại phòng + URL cụ thể
  const propertyId = this.selectedProperty()?.id ?? 'global';
  const key = `${propertyId}:${roomTypeId}:${url.trim()}`;

  const currentSet = new Set(this.failedImageKeys());
  currentSet.add(key);
  this.failedImageKeys.set(currentSet);
}

/**
 * Kiểm tra xem ảnh của loại phòng có sẵn sàng để render không.
 * Nếu url rỗng hoặc đã nằm trong danh sách lỗi của ngữ cảnh hiện tại -> trả về false để hiển thị SVG fallback.
 */
isImageAvailable(rt: PublicRoomTypeAvailabilityDto): boolean {
  if (!rt.imageUrl || !rt.imageUrl.trim()) {
    return false;
  }
  const propertyId = this.selectedProperty()?.id ?? 'global';
  const key = `${propertyId}:${rt.roomTypeId}:${rt.imageUrl.trim()}`;
  return !this.failedImageKeys().has(key);
}

/**
 * Thao tác thử lại tải ảnh (Retry) cho cùng một URL khi cần thiết.
 */
retryRoomImage(roomTypeId: string, url: string | undefined): void {
  if (!url || !url.trim()) return;
  const propertyId = this.selectedProperty()?.id ?? 'global';
  const key = `${propertyId}:${roomTypeId}:${url.trim()}`;
  const currentSet = new Set(this.failedImageKeys());
  if (currentSet.delete(key)) {
    this.failedImageKeys.set(currentSet);
  }
}
```

#### 2. Cập Nhật Template Thẻ Phòng (`booking.page.ts`):
```html
<div class="relative bg-slate-100 h-36 flex items-center justify-center overflow-hidden rounded-2xl mb-4">
  <!-- 1. Ảnh phòng hiện có: Bảo toàn [alt]="rt.roomTypeName" nguyên bản cho media bất kỳ -->
  <img
    *ngIf="isImageAvailable(rt)"
    [src]="rt.imageUrl"
    [alt]="rt.roomTypeName"
    (error)="onRoomImageError(rt.roomTypeId, rt.imageUrl, availabilityRequestId)"
    class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
  />

  <!-- 2. Khối SVG Dự phòng khi ImageUrl rỗng/null hoặc tải thất bại -->
  <svg
    *ngIf="!isImageAvailable(rt)"
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
    *ngIf="!isImageAvailable(rt)"
    class="absolute bottom-2.5 right-2.5 bg-slate-900/80 backdrop-blur-xs text-slate-200 text-[10px] font-semibold px-2.5 py-0.5 rounded-md border border-slate-700/70 shadow-2xs pointer-events-none select-none"
  >
    Hình minh họa — bố trí phòng mẫu
  </div>
</div>
```

#### 3. Đồng Bộ Hóa Xóa Trạng Thái Khi Đổi Chi Nhánh (`resetSelectionAndAvailability`):
Trong `resetSelectionAndAvailability()` (dòng 978):
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

### 4.2. Lợi Ích Kỹ Thuật Của Cơ Chế Khóa Theo Ngữ Cảnh:
1. **Hỗ trợ URL mới cho cùng loại phòng:** Nếu API trả về một URL mới được cập nhật cho cùng `roomTypeId`, URL mới sẽ có key khác nên được phép render ngay lập tức, không bị kẹt ở trạng thái lỗi vĩnh viễn.
2. **Kháng sự kiện lỗi đến muộn:** Nếu một thẻ ảnh cũ phát sinh lỗi sau khi người dùng đã chuyển cơ sở hoặc gửi yêu cầu tìm kiếm mới, việc kiểm tra `eventRequestId !== this.availabilityRequestId` sẽ loại bỏ sự kiện lỗi này, không làm sai lệch kết quả hiển thị của cơ sở mới.
3. **Cung cấp cơ chế Retry tường minh:** Cho phép gọi `retryRoomImage(roomTypeId, url)` để xóa khóa lỗi và thử tải lại ảnh khi có nhu cầu (ví dụ khi kết nối mạng phục hồi).

---

## 5. Ranh Giới Quyền Tác Giả & Tách Biệt Các Vấn Đề Dài Hạn

### 5.1. Phân Tách Rõ Ràng Các Vấn Đề
- **Lát cắt Broken-Image Fallback (Ngắn hạn / Độc lập):** Là việc cải thiện độ tin cậy và thẩm mỹ của giao diện thông thường khi tài nguyên web bị lỗi. Không làm thay đổi nghiệp vụ, không thêm cơ sở hạ tầng, và không đòi hỏi phê duyệt hợp đồng mới.
- **Nguồn ảnh thực tế & Bản quyền (Dài hạn / Tách biệt):**
  - 33 ảnh Legacy (`LEGACY-ROOM-ASSETS-01`) tiếp tục duy trì cách ly (**Quarantine**, `Rights NOT VERIFIED`).
  - 4 ảnh AI (`ROOM-AI-DEMO-PACK-01`) là tài liệu minh họa offline (`Commercial Rights NOT VERIFIED`), không cấp phép sản xuất.
  - Việc cung cấp ảnh thực tế được cấp phép, bổ sung cột `Property.ImageUrl` qua migration, hay thiết lập lưu trữ Blob Storage là các nội dung tách biệt, không phải điều kiện tiên quyết (non-blocking) đối với lát cắt broken-image fallback này.

### 5.2. Bảo Toàn Quyết Định PO & Ranh Giới Đội Ngũ
1. **7 Cổng Quyết Định PO (`decisions.md`):** Tiếp tục bảo toàn nguyên vẹn ở trạng thái `NeedsPO` (D21 lookup TTL, Quote/Hold price pinning, Gate 1 Search API contract, Gate 2 Publish policy, Gate 3 Administrative dataset, Gate 4 Property administrative migration, Gate 5 Cross-property availability).
2. **Phase 6 Đóng Chặt:** Không kích hoạt AI Search runtime, không gọi API Gemini từ client/server.
3. **Ranh giới phân công:** Không chỉnh sửa mã nguồn thuộc module Quản lý phòng của Nguyên hay Buồng phòng của Tân.

---

## 6. Tiêu Chí Chấp Nhận Hành Vi Dựa Trên Nguồn (Source-Backed Acceptance Criteria)

Khi lát cắt được triển khai, các hành vi sẽ được kiểm chứng bằng bộ tiêu chí chấp nhận cụ thể:

- **AC-MEDIA-01 (Null / Blank URL Fallback):**
  - *Điều kiện:* Dữ liệu `rt.imageUrl` là `null`, `undefined`, chuỗi rỗng `""` hoặc chỉ chứa khoảng trắng `"   "`.
  - *Hành vi:* `isImageAvailable(rt)` trả về `false`. Giao diện hiển thị ngay đồ họa SVG dự phòng; không sinh thẻ `<img>` và không phát sinh bất kỳ yêu cầu mạng nào.

- **AC-MEDIA-02 (Runtime Broken Image Fallback):**
  - *Điều kiện:* `rt.imageUrl` có đường dẫn hợp lệ nhưng tài nguyên bị lỗi HTTP 404 hoặc mạng chặn.
  - *Hành vi:* Sự kiện `(error)` kích hoạt `onRoomImageError(rt.roomTypeId, rt.imageUrl, availabilityRequestId)`. Khóa `${propertyId}:${roomTypeId}:${url}` được thêm vào `failedImageKeys()`. Thẻ `<img>` bị gỡ bỏ và khối SVG dự phòng được hiển thị thay thế mà không làm xô lệch bố cục trang.

- **AC-MEDIA-03 (Same-ID New URL Rendering):**
  - *Điều kiện:* Một loại phòng `roomTypeId` trước đó có URL bị lỗi, sau đó dữ liệu availability được làm mới và trả về một `imageUrl` mới khác với URL đã lỗi.
  - *Hành vi:* Do URL mới có khóa `${propertyId}:${roomTypeId}:${newUrl}` chưa nằm trong `failedImageKeys()`, hàm `isImageAvailable(rt)` trả về `true`. Thẻ `<img>` được phép render với URL mới bình thường.

- **AC-MEDIA-04 (Late Error Event Discarded on Context Switch):**
  - *Điều kiện:* Người dùng chọn Khách sạn A, sau đó chuyển sang Khách sạn B; thẻ ảnh cũ của Khách sạn A sau đó mới phát sinh sự kiện lỗi `(error)`.
  - *Hành vi:* Do `eventRequestId < this.availabilityRequestId`, sự kiện lỗi bị bỏ qua hoàn toàn; không có khóa lỗi nào bị ghi nhận cho Khách sạn B.

- **AC-MEDIA-05 (Same-URL Explicit Retry):**
  - *Điều kiện:* Một ảnh bị lỗi tải và đã rơi về SVG fallback. Người dùng kích hoạt thao tác thử lại hoặc hàm `retryRoomImage(roomTypeId, url)` được gọi.
  - *Hành vi:* Khóa lỗi tương ứng được xóa khỏi `failedImageKeys()`. Thẻ `<img>` được render lại để thử tải lại tài nguyên.

- **AC-MEDIA-06 (Preserved Alt Text for Existing Media):**
  - *Điều kiện:* Thẻ `<img>` hiển thị media hiện có.
  - *Hành vi:* Thuộc tính `[alt]` mang giá trị chính xác `rt.roomTypeName`. Không tự ý chèn thêm chuỗi `"(Hình minh họa)"` vào thẻ ảnh khi chưa có siêu dữ liệu xuất xứ. Nhãn minh họa chỉ gắn kèm khối đồ họa SVG.

- **AC-MEDIA-07 (Context Isolation on Property Switch):**
  - *Điều kiện:* Người dùng chuyển cơ sở lưu trú.
  - *Hành vi:* Hàm `resetSelectionAndAvailability()` xóa sạch `availabilityList`, hủy subscription, tăng `availabilityRequestId`, và đặt lại `failedImageKeys` về tập rỗng `new Set<string>()`.

---

## 7. Định Nghĩa Hoàn Thành (Definition of Done — DoD)

- [x] Phân tách độc lập lát cắt broken-image error fallback khỏi các yêu cầu xuất xứ AI.
- [x] Xóa bỏ việc gắn nhãn AI vô điều kiện lên media hiện có; bảo toàn `[alt]="rt.roomTypeName"`.
- [x] Thiết kế bộ khóa lỗi ảnh định danh theo ngữ cảnh (`generation:propertyId:roomTypeId:url`), kháng sự kiện lỗi đến muộn và hỗ trợ URL mới cho cùng loại phòng.
- [x] Bổ sung phương thức retry tường minh cho cùng URL.
- [x] Hiệu chỉnh khảo sát mã nguồn: xác định rõ mô hình/projection mã nguồn, ghi nhận tình trạng cơ sở dữ liệu runtime là `DB NOT VERIFIED`.
- [x] Loại bỏ các tuyên bố tuyệt đối không có bằng chứng hành vi (100% race-proof).
- [x] Tách biệt các câu hỏi dài hạn (bản quyền ảnh, schema migration, storage) khỏi lát cắt UI fallback thông thường, không ép PO duyệt lại chi tiết UI.
- [x] Bổ sung đầy đủ 7 tiêu chí chấp nhận hành vi (AC-MEDIA-01 đến 07).
