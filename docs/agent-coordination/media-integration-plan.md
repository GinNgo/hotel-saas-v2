# Kế Hoạch Tích Hợp Phương Tiện Hình Ảnh Hạng Phòng Cho Giao Diện Khách (GUEST-ROOM-MEDIA-PLAN-01) — Vòng 1

- **Mã nhiệm vụ:** `GUEST-ROOM-MEDIA-PLAN-01`
- **Vòng (Round):** 1 (Khảo sát mã nguồn thực tế & Đề xuất lát cắt tích hợp tối thiểu)
- **Tác nhân:** `antigravity`
- **Thời điểm lập:** 2026-10-12
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

### 1.2. Thực Thể Miền & Lược Đồ Cơ Sở Dữ Liệu (`HotelSaas.Domain.Entities`)
1. **Thực thể `RoomType` (Hạng phòng):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Domain/Entities/RoomType.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Domain/Entities/RoomType.cs#L68)
   - **Định nghĩa:** `public string? ImageUrl { get; set; }` (Dòng 68).
   - **Trạng thái:** **ĐÃ CÓ SẴN** trong lược đồ bảng `RoomTypes`. Cột đã được tạo trong cơ sở dữ liệu và ánh xạ vào Entity Framework Core.
2. **Thực thể `Property` (Cơ sở lưu trú):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Domain/Entities/Property.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Domain/Entities/Property.cs#L1-L164)
   - **Trạng thái:** **CHƯA CÓ TRƯỜNG `ImageUrl`**.
   - **Khoảng cách kỹ thuật (Gap):** Thực thể `Property` không có cột lưu trữ URL ảnh đại diện cho khách sạn. Bất kỳ nỗ lực đọc ảnh cơ sở trực tiếp từ DB hiện tại đều trả về giá trị trống.

### 1.3. Bộ Xử Lý Truy Vấn Backend (`HotelSaas.Application.Public.Queries`)
1. **Truy vấn danh sách cơ sở (`GetPublicPropertiesQuery`):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicProperties/GetPublicPropertiesQuery.cs#L57)
   - **Hình thái chiếu DTO:** Chiếu cứng `ImageUrl = null` (Dòng 57).
   - **Lý do:** Do thực thể `Property` chưa có trường `ImageUrl`, truy vấn chủ động gán null để bảo toàn tính toàn vẹn DTO.
2. **Truy vấn tồn phòng công khai (`GetPublicAvailabilityQuery`):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Application/Public/Queries/GetPublicAvailability/GetPublicAvailabilityQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicAvailability/GetPublicAvailabilityQuery.cs#L175)
   - **Hình thái chiếu DTO:** Chiếu trực tiếp `ImageUrl = rt.ImageUrl` từ thực thể `RoomType` (Dòng 175).
   - **Trạng thái:** Sẵn sàng 100% để truyền tải URL ảnh phòng tới client ngay khi dữ liệu được nạp vào DB.
3. **Truy vấn danh mục loại phòng (`GetPublicRoomTypesQuery`):**
   - **Tệp nguồn:** [`backend/src/HotelSaas.Application/Public/Queries/GetPublicRoomTypes/GetPublicRoomTypesQuery.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Public/Queries/GetPublicRoomTypes/GetPublicRoomTypesQuery.cs#L63)
   - **Hình thái chiếu DTO:** Chiếu trực tiếp `ImageUrl = rt.ImageUrl` từ thực thể `RoomType` (Dòng 63).

### 1.4. Dữ Liệu Khởi Tạo Cục Bộ (`LocalDevDataSeeder.cs`)
- **Tệp nguồn:** [`backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs#L626-L637)
- **Phương thức:** `EnsureRoomTypeAsync` chỉ khởi tạo `Id`, `TenantId`, `PropertyId`, `Code`, `Name`, `BasePrice`, `MaxOccupancy`.
- **Trạng thái:** Không thiết lập `ImageUrl` cho bất kỳ phòng mẫu nào (`DLX-Q1`, `STD-Q1`, `SUI-PN`, `SUP-PN`). Mọi bản ghi loại phòng trong môi trường seed đều có `ImageUrl == null`.

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
    - Tăng request ID: `this.availabilityRequestId++` (loại bỏ hoàn toàn bất kỳ phản hồi nào đến muộn).
    - Hủy HTTP subscription: `this.availabilitySub?.unsubscribe()`.
  - **Đánh giá:** Đã ngăn chặn tuyệt đối tình trạng rò rỉ ảnh hoặc dữ liệu phòng của cơ sở cũ sang cơ sở mới.

---

## 2. Khoảng Cách Kỹ Thuật & Yêu Cầu Cải Tiến (Gap Analysis)

Mặc dù khung kiến trúc hiện tại đã sẵn sàng, việc tích hợp phương tiện hình ảnh thực tế cần giải quyết 4 khoảng cách sau:

| STT | Vấn Đề Kỹ Thuật | Hiện Trạng Thực Tế | Nguy Cơ Tiềm Ẩn | Giải Pháp Đề Xuất |
|:---:|---|---|---|---|
| 1 | **Thiếu xử lý lỗi tải ảnh (`onError`)** | Thẻ `<img>` chỉ kiểm tra `*ngIf="rt.imageUrl"`. Nếu URL hỏng, 404, hoặc mạng chặn, thẻ ảnh giữ nguyên URL lỗi. | Trình duyệt hiển thị biểu tượng ảnh vỡ (broken image icon) gây mất thẩm mỹ và giảm uy tín hệ thống. | Bổ sung bộ bắt sự kiện `(error)="onRoomImageError(rt.roomTypeId)"` và tự động chuyển về khối SVG dự phòng. |
| 2 | **Thiếu nhãn công bố minh họa AI động** | Nhãn `"Hình minh họa"` hiện chỉ xuất hiện trên khối SVG fallback. Khi `rt.imageUrl` có ảnh sinh bởi AI, không có nhãn công bố trên ảnh. | Người dùng hiểu nhầm ảnh do AI tạo là ảnh chụp thực tế của phòng khách sạn, vi phạm tính trung thực và đạo đức AI. | Bổ sung huy hiệu công bố bán trong suốt: `"Ảnh minh họa AI"` hoặc `"Ảnh phòng mẫu"` nổi trên góc ảnh khi là ảnh mock. |
| 3 | **Chính sách Text thay thế (`alt`) chưa tối ưu** | Thuộc tính `[alt]="rt.roomTypeName"` chỉ đọc tên phòng đơn thuần. | Trình đọc màn hình (Screen Reader) không phân biệt được đây là ảnh chụp thật hay ảnh mô phỏng kiến trúc. | Chuẩn hóa chính sách `alt`: `[alt]="rt.roomTypeName + (isIllustrative ? ' (Ảnh minh họa)' : '')"`. |
| 4 | **Thực thể `Property` thiếu cột `ImageUrl`** | `Property.cs` không có cột `ImageUrl`; `GetPublicPropertiesQuery` phải hardcode chiếu `null`. | Không thể hiển thị ảnh khách sạn thật qua database trừ khi có schema migration. | Giữ nguyên chiếu `null` và SVG twilight fallback cho `Property`; trình PO việc bổ sung schema trong đợt migration tương lai. |

---

## 3. Ranh Giới Định Danh & Ánh Xạ Dữ Liệu (Source-Backed Identity & Mapping Boundaries)

### 3.1. Phân Tách Dữ Liệu Thực Tế (Live Facts) & Dữ Liệu Demo (Demo-Only)
- **Quy tắc bất biến:** Tuyệt đối **KHÔNG** ánh xạ cứng (hardcode) tên hoặc mã phòng trong mã nguồn live booking để gán ảnh demo.
  - *Hành vi bị cấm:* `if (rt.roomTypeName.includes('Deluxe')) return '/assets/ai-deluxe.png';` $\implies$ Vi phạm tính toàn vẹn multi-tenancy và giả mạo dữ liệu thật.
- **Ranh giới:**
  - Bộ 4 ảnh AI (`ROOM-AI-DEMO-PACK-01`) được sinh ra thuần túy dựa theo các mã quy ước trong file seed kiểm thử (`DLX-Q1`, `STD-Q1`, `SUI-PN`, `SUP-PN`).
  - Dữ liệu production và seed hiện tại: `ImageUrl` là **`null`**.
  - Hệ thống booking phải vận hành chuẩn mực và tự nhiên với giá trị `null` này bằng cách kích hoạt khối SVG dự phòng.

### 3.2. Bảng Đối Chiếu Hiện Trạng Ánh Xạ Dữ Liệu

| Thực Thể | Thuộc Tính Định Danh | Trường Media Hiện Tại | Trạng Thái Trong DB/Seed | Hành Vi Client Hiện Tại | Hành Vi Đề Xuất (Smallest Slice) |
|---|---|:---:|:---:|---|---|
| **Property** | `Id` (GUID), `Slug`, `Code` | `ImageUrl` (DTO only) | Không có cột trong Entity; DTO = `null` | Hiển thị SVG Kiến trúc ban đêm | Giữ nguyên SVG fallback; ghi nhận Gap schema cho PO |
| **RoomType (DLX-Q1)** | `Id` (GUID), `Code: DLX-Q1` | `ImageUrl` (Entity + DTO) | `null` trong seed | Hiển thị SVG Bố trí phòng mẫu | Nếu `null` hoặc tải lỗi $\to$ SVG fallback; nếu có ảnh mock $\to$ Thêm badge AI |
| **RoomType (STD-Q1)** | `Id` (GUID), `Code: STD-Q1` | `ImageUrl` (Entity + DTO) | `null` trong seed | Hiển thị SVG Bố trí phòng mẫu | Nếu `null` hoặc tải lỗi $\to$ SVG fallback; nếu có ảnh mock $\to$ Thêm badge AI |
| **RoomType (SUI-PN)** | `Id` (GUID), `Code: SUI-PN` | `ImageUrl` (Entity + DTO) | `null` trong seed | Hiển thị SVG Bố trí phòng mẫu | Nếu `null` hoặc tải lỗi $\to$ SVG fallback; nếu có ảnh mock $\to$ Thêm badge AI |
| **RoomType (SUP-PN)** | `Id` (GUID), `Code: SUP-PN` | `ImageUrl` (Entity + DTO) | `null` trong seed | Hiển thị SVG Bố trí phòng mẫu | Nếu `null` hoặc tải lỗi $\to$ SVG fallback; nếu có ảnh mock $\to$ Thêm badge AI |

---

## 4. Đề Xuất Lát Cắt Triển Khai Tối Thiểu (Smallest Implementation Slice Proposal)

Lát cắt triển khai tối thiểu được thiết kế với tiêu chí: **Không sửa backend API, không sửa database schema, không cấp quyền mới, không thêm remote CDN hay thư viện ngoài.**

### 4.1. Chi Tiết Lát Cắt Phía Frontend (`booking.page.ts`)

#### 1. Bổ sung Quản lý Lỗi Tải Ảnh Theo Tín Hiệu (Signal-based Image Error State):
Trong component `BookingPage`:
```typescript
// Quản lý danh sách ID loại phòng bị lỗi tải ảnh để kích hoạt fallback tức thì
failedRoomImageIds = signal<Set<string>>(new Set<string>());

onRoomImageError(roomTypeId: string): void {
  const currentSet = new Set(this.failedRoomImageIds());
  currentSet.add(roomTypeId);
  this.failedRoomImageIds.set(currentSet);
}

isImageAvailable(rt: PublicRoomTypeAvailabilityDto): boolean {
  return !!rt.imageUrl && !this.failedRoomImageIds().has(rt.roomTypeId);
}
```

#### 2. Cập Nhật Template Thẻ Phòng:
```html
<!-- Khối hiển thị ảnh với bộ bắt lỗi và huy hiệu minh họa -->
<div class="relative bg-slate-100 h-36 flex items-center justify-center overflow-hidden rounded-2xl mb-4">
  <!-- 1. Ảnh phòng thật / mock nếu có URL và chưa bị lỗi tải -->
  <img
    *ngIf="isImageAvailable(rt)"
    [src]="rt.imageUrl"
    [alt]="rt.roomTypeName + ' (Hình minh họa)'"
    (error)="onRoomImageError(rt.roomTypeId)"
    class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
  />

  <!-- 2. Khối SVG Dự phòng nếu ImageUrl null hoặc tải thất bại -->
  <svg
    *ngIf="!isImageAvailable(rt)"
    class="w-full h-full"
    viewBox="0 0 320 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="xMidYMid slice"
  >
    <!-- SVG Isometric Room Architecture Fallback -->
    <rect width="320" height="140" fill="#f8fafc"/>
    <rect x="30" y="25" width="260" height="95" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="80" y="40" width="160" height="20" rx="3" fill="#cbd5e1"/>
    <rect x="90" y="55" width="65" height="50" rx="4" fill="#6366f1" opacity="0.85"/>
    <rect x="165" y="55" width="65" height="50" rx="4" fill="#6366f1" opacity="0.85"/>
    <text x="160" y="125" font-family="system-ui, sans-serif" font-size="8.5" font-weight="600" letter-spacing="1" fill="#94a3b8" text-anchor="middle">HÌNH MINH HỌA HẠNG PHÒNG</text>
  </svg>

  <!-- 3. Huy hiệu công bố AI minh họa chuẩn mực -->
  <div class="absolute bottom-2.5 right-2.5 bg-slate-900/80 backdrop-blur-xs text-slate-200 text-[10px] font-semibold px-2.5 py-0.5 rounded-md border border-slate-700/70 shadow-2xs pointer-events-none select-none">
    {{ isImageAvailable(rt) ? 'Ảnh minh họa AI' : 'Hình minh họa — bố trí phòng mẫu' }}
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
  this.failedRoomImageIds.set(new Set<string>()); // Reset triệt để trạng thái lỗi ảnh
  this.isLoadingAvailability.set(false);
  this.isLoadingQuote.set(false);
  this.availabilityRequestId++;
  this.quoteRequestId++;
  this.availabilitySub?.unsubscribe();
  this.quoteSub?.unsubscribe();
}
```
**Bảo đảm:** Khi chuyển từ cơ sở này sang cơ sở khác, danh sách các phòng bị lỗi ảnh được xóa sạch, không gây ảnh hưởng sai lệch đến kết quả tải ảnh của cơ sở mới.

---

## 5. Ranh Giới Quyền Sở Hữu, Tuân Thủ Bản Quyền & Câu Hỏi Cần Quyết Định PO

### 5.1. Ranh Giới Quyền Sử Dụng Tài Nguyên (Rights & Compliance Boundaries)
1. **33 Tài nguyên ảnh Legacy (`LEGACY-ROOM-ASSETS-01`):**
   - Nguồn từ kho lưu trữ công khai của bên thứ ba (`He-thong-quan-ly-khach-san`).
   - **Tình trạng pháp lý:** **CHƯA ĐƯỢC XÁC MINH BẢN QUYỀN THƯƠNG MẠI (Rights NOT VERIFIED)**.
   - **Biện pháp thực hiện:** Tiếp tục duy trì cách ly nghiêm ngặt (**Quarantine**). Tuyệt đối không sao chép vào `frontend/src/assets` hoặc nhúng vào môi trường production.
2. **4 Tài nguyên ảnh sinh bởi AI (`ROOM-AI-DEMO-PACK-01`):**
   - Sinh bởi mô hình AI cục bộ (`gemini-3.1-flash-image`).
   - **Tình trạng pháp lý:** Thuần túy là tài liệu ý niệm phục vụ kiểm thử và tiếp cận môn học. Quyền thương mại trong sản xuất **CHƯA ĐƯỢC XÁC MINH (Commercial Rights NOT VERIFIED)**.
   - Việc Codex Reviewer phê duyệt `ROOM-AI-DEMO-PACK-01` ở vòng 2 là nghiệm thu tính đầy đủ của gói tài liệu tĩnh offline, **KHÔNG ĐỒNG NGHĨA VỚI VIỆC CẤP PHÉP ĐƯA ẢNH VÀO PRODUCTION**.
3. **Chính sách Lưu trữ & Mạng (Storage & Network Policy):**
   - Tuyệt đối không cấu hình remote CDN, cloud storage (AWS S3, Google Cloud Storage, Cloudinary) hoặc bất kỳ phụ thuộc runtime mạng bên ngoài nào trong giai đoạn này.

### 5.2. Các Quyết Định Nghiệp Vụ Cần Product Owner (PO) Phê Duyệt

| STT | Vấn Đề Quyết Định | Nội Dung Chi Tiết & Tác Động Nghiệp Vụ | Đề Xuất Của Kỹ Thuật |
|:---:|---|---|---|
| **Q1** | **Bản quyền ảnh thực tế** | Khi nào doanh nghiệp / cơ sở khách sạn cung cấp bộ ảnh chụp thực tế có đầy đủ văn bản xác nhận quyền sở hữu tác quyền? | Trong giai đoạn kiểm thử, duy trì ảnh mô phỏng kèm huy hiệu minh họa rõ ràng. Khi lên production, yêu cầu PO cung cấp bộ ảnh chụp thực tế được cấp phép. |
| **Q2** | **Chính sách nhãn công bố AI** | Có bắt buộc hiển thị nhãn `"Ảnh minh họa AI"` trên mọi hình ảnh được sinh tự động bởi AI khi hiển thị cho khách vãng lai hay không? | **Khuyến nghị BẮT BUỘC hiển thị** để tuân thủ quy tắc ứng xử có trách nhiệm của AI và bảo vệ uy tín thương hiệu đối với khách đặt phòng. |
| **Q3** | **Kế hoạch di chuyển lược đồ `Property.ImageUrl`** | Có phê duyệt tạo Migration bổ sung cột `ImageUrl` (kiểu chuỗi, nullable) cho bảng `Properties` trong đợt cập nhật schema tiếp theo hay không? | Đề xuất gộp vào một đợt Migration tổng thể (cùng các trường địa lý hành chính PO Gate 4) để giảm thiểu số lần thay đổi cấu trúc bảng. |
| **Q4** | **Phương án lưu trữ media production** | Khi hỗ trợ tải ảnh thực tế lên hệ thống (tính năng Admin upload), hệ thống sẽ dùng phương án lưu trữ tệp cục bộ (`wwwroot/uploads`) hay Blob Storage tương thích S3? | Tạm thời duy trì Static Local Storage phục vụ kiểm thử nội bộ. Chỉ thiết lập Blob Storage khi có quyết định chính thức và hạ tầng được phê duyệt từ PO. |

---

## 6. Bảo Toàn 7 Cổng Quyết Định PO Hiện Hữu & Ranh Giới Đội Ngũ

1. **Bảo Toàn 7 Cổng Quyết Định PO (`decisions.md`):**
   - `D21`: Lookup token TTL, mốc dự kiến/thực tế, và cơ chế revoke/reissue hợp đồng.
   - `Quote 5 phút / Hold 15 phút`: Cơ chế ghim giá (price pinning) và xác nhận báo giá cũ (stale-quote acknowledgement).
   - `PO Gate 1`: Hợp đồng API tìm kiếm công khai (`GET /api/public/properties?search` vs endpoint tìm kiếm chuyên biệt).
   - `PO Gate 2`: Chính sách xuất bản cơ sở (`IsPublished == true` vs `Active-only`).
   - `PO Gate 3`: Nguồn dữ liệu hành chính Việt Nam có thẩm quyền, phiên bản và giấy phép.
   - `PO Gate 4`: Kế hoạch Migration bổ sung mã tỉnh, phường/xã cho `Property`.
   - `PO Gate 5`: Cơ chế tìm kiếm phòng trống xuyên cơ sở (Two-step discovery vs Aggregated search).
2. **Đóng Chặt Phase 6 (AI Search):**
   - Không kích hoạt AI Search runtime, không gọi Gemini API bên ngoài từ client/server cho luồng tìm kiếm, không tạo dependency AI mới.
3. **Bảo Toàn Ranh Giới Đội Ngũ (Team Ownership Boundaries):**
   - Không can thiệp vào mã nguồn quản lý phòng của Nguyên (`Rooms`, `RoomTypes`).
   - Không can thiệp vào mã nguồn buồng phòng của Tân (`Housekeeping`).

---

## 7. Tiêu Chí Chấp Nhận Hành Vi & Kịch Bản Kiểm Thử Đề Xuất (Acceptance Criteria & Proposed Tests)

Khi được phê duyệt triển khai, lát cắt tối thiểu sẽ được kiểm chứng bằng bộ tiêu chí chấp nhận cụ thể:

- **AC-MEDIA-01 (Null Image Graceful Fallback):**
  - *Điều kiện:* Dữ liệu `rt.imageUrl` trả về là `null`, `undefined` hoặc chuỗi rỗng `""`.
  - *Hành vi:* Giao diện hiển thị ngay đồ họa SVG dự phòng; không có thẻ `<img>` rỗng và không phát sinh bất kỳ yêu cầu mạng lỗi nào.
- **AC-MEDIA-02 (Runtime Broken Image Fallback):**
  - *Điều kiện:* `rt.imageUrl` có đường dẫn nhưng tài nguyên bị lỗi 404 hoặc mạng chặn kết nối.
  - *Hành vi:* Sự kiện `(error)` kích hoạt hàm `onRoomImageError(roomTypeId)`; component tự động chuyển đổi hiển thị sang khối SVG dự phòng mà không làm xô lệch bố cục trang.
- **AC-MEDIA-03 (AI Disclosure Labeling):**
  - *Điều kiện:* Hiển thị hình ảnh có tính chất minh họa.
  - *Hành vi:* Góc dưới ảnh hiển thị huy hiệu bán trong suốt có độ tương phản cao với chữ `"Ảnh minh họa AI"` hoặc `"Hình minh họa — bố trí phòng mẫu"`.
- **AC-MEDIA-04 (Zero Stale Image Leak on Branch Switch):**
  - *Điều kiện:* Người dùng chọn Khách sạn A, sau đó chuyển sang Khách sạn B trong khi yêu cầu tồn phòng của A đang xử lý dở dang.
  - *Hành vi:* Hàm `resetSelectionAndAvailability()` xóa sạch `availabilityList`, hủy subscription và reset `failedRoomImageIds`; ảnh hoặc trạng thái phòng của Khách sạn A tuyệt đối không bao giờ hiển thị trên Khách sạn B.
- **AC-MEDIA-05 (Accessible Alt Text):**
  - *Điều kiện:* Kiểm tra cây accessibility của DOM.
  - *Hành vi:* Thẻ ảnh có văn bản thay thế rõ ràng, cung cấp thông tin ngữ cảnh cho thiết bị đọc màn hình mà không để trống.

---

## 8. Định Nghĩa Hoàn Thành (Definition of Done — DoD)
- [x] Khảo sát toàn diện mã nguồn thực tế backend DTOs, Domain Entities, Handlers, Seeder và Frontend Component với đầy đủ tham chiếu dòng code.
- [x] Phân định ranh giới rõ ràng giữa dữ liệu thực tế (Live Facts) và dữ liệu mô phỏng (Demo-Only).
- [x] Đề xuất lát cắt triển khai tối thiểu bảo toàn 100% hợp đồng API và lược đồ DB hiện hữu.
- [x] Làm rõ trạng thái pháp lý của tài nguyên ảnh Legacy (Quarantine) và ảnh AI (Demo-only).
- [x] Formulate danh sách câu hỏi cụ thể, trọng tâm cần Product Owner (PO) quyết định.
- [x] Bảo toàn nguyên vẹn 7 Cổng quyết định PO, Phase 6 tiếp tục đóng, và không vi phạm ranh giới phân công đội ngũ.
