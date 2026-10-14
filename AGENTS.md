# 🤖 CẨM NANG PHÁT TRIỂN & QUY CHUẨN DÀNH CHO AI AGENT (AGENTS.md)

> **Dành cho mọi AI Agent (Antigravity, Cursor, Claude Code, GitHub Copilot...) và Lập trình viên:**  
> Bắt buộc đọc kỹ và tuân thủ 100% các quy định dưới đây trước khi đọc hiểu, thiết kế, sinh mã nguồn hoặc thao tác Git trong kho lưu trữ **Hotel SaaS Platform** (`hotel-saas-v2`).

---

## 🎯 1. NGUYÊN TẮC VÀNG #1: TÁI SỬ DỤNG TRƯỚC TIÊN (REUSE-FIRST & ANTI-FRAGMENTATION)

### ⚠️ Banned Pattern (Hành vi bị nghiêm cấm):
1. **CẤM tạo file lẻ tẻ rải rác:** Mỗi khi thêm tính năng mới, tuyệt đối không tự tiện tạo các file util 10–20 dòng nằm rải rác hay tự viết lại component UI riêng rẽ mà không kiểm tra kho dùng chung.
2. **CẤM Duplicate UI Code:** Tuyệt đối không tự viết lại inline HTML/CSS cho Badge trạng thái, Thẻ KPI, Nút phân trang, Header trang, Trạng thái rỗng (Empty state) hay Bảng dữ liệu.
3. **CẤM Inline HTTP calls:** Không gọi `HttpClient` trực tiếp trong component; bắt buộc đi qua tầng Service (`src/app/core/services/`).

### 📋 Quy trình 3 bước bắt buộc trước khi tạo bất kỳ file nào (Pre-Creation Checklist):
```
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│  1. TRA CỨU     │  ───> │  2. MỞ RỘNG (EXTEND) │  ───> │  3. ĐƯA RA DÙNG CHUNG  │
│  (Lookup First) │       │  (Tái sử dụng tối đa)│       │  (Elevate to Common)   │
└─────────────────┘       └──────────────────────┘       └────────────────────────┘
```
1. **TRA CỨU (Lookup):** Kiểm tra xem component, utility, helper, DTO hoặc service tương tự đã tồn tại trong `@shared`, `@core` (Frontend) hoặc `Application.Common`, `WebApi.Controllers.BaseApiController` (Backend) chưa.
2. **MỞ RỘNG (Extend):** Nếu đã có thứ tương tự, ưu tiên tái sử dụng và mở rộng bằng `optional input` / `parameter` thay vì tạo file mới.
3. **ĐƯA RA DÙNG CHUNG (Elevate to Common):** Nếu một thành phần UI hoặc một hàm logic được dùng ở $\ge 2$ màn hình/tính năng, **BẮT BUỘC đưa ra thư mục dùng chung** và xuất ra qua barrel file (`index.ts`).

---

## 🧩 2. DANH MỤC THÀNH PHẦN DÙNG CHUNG (SHARED & COMMON REGISTRY)

### 2.1. Frontend Angular (Standalone Components & Signals)

Toàn bộ các component dùng chung được tập trung tại `frontend/src/app/shared/` và xuất qua barrel file `src/app/shared/index.ts`:

| Tên Component | Selector / Export | Vị Trí File | Mục Đích Tái Sử Dụng |
|:---|:---|:---|:---|
| **StatusBadgeComponent** | `<app-status-badge>` | `shared/components/status-badge/` | Hiển thị huy hiệu trạng thái chuẩn Luxury cho Buồng phòng (Clean, Dirty, Cleaning, Occupied, OutOfService), Đơn đặt phòng (Pending, Confirmed, CheckedIn, CheckedOut, Cancelled), Thanh toán và Boolean (Active/Inactive). |
| **StatCardComponent** | `<app-stat-card>` | `shared/components/stat-card/` | Thẻ thống kê chỉ số KPI / Metrics có icon container, trend biến động (↑/↓ %), đa dạng màu sắc (indigo, emerald, amber, rose, sky, purple). Dùng chung cho Dashboard, Buồng phòng, Báo cáo, Thu ngân. |
| **PageHeaderComponent** | `<app-page-header>` | `shared/components/page-header/` | Tiêu đề trang chuẩn, phụ đề và khu vực đặt nút bấm hành động (Action Buttons). |
| **PaginationComponent** | `<app-pagination>` | `shared/components/pagination/` | Phân trang danh sách, chọn số bản ghi trên trang (10, 25, 50, 100), nút Prev/Next đồng bộ. |
| **EmptyStateComponent** | `<app-empty-state>` | `shared/components/empty-state/` | Hiển thị trạng thái rỗng khi danh sách/bảng không có dữ liệu kèm icon và nút tạo mới. |
| **LoadingSpinnerComponent** | `<app-loading-spinner>` | `shared/components/loading-spinner/` | Vòng xoay tải dữ liệu đồng bộ giao diện PrimeNG. |
| **SkeletonTableComponent** | `<app-skeleton-table>` | `shared/components/skeleton-table/` | Hiệu ứng khung chờ tải bảng dữ liệu (chống giật layout CLS). |
| **DateRangeFilterComponent**| `<app-date-range-filter>` | `shared/components/date-range-filter/` | Bộ lọc khoảng ngày chọn nhanh (Hôm nay, 7 ngày qua, Tháng này...). |
| **PhotoGalleryModalComponent** | `<app-photo-gallery-modal>` | `shared/components/photo-gallery-modal/` | Modal Lightbox xem bộ sưu tập ảnh độ nét cao (Phòng ngủ, Phòng tắm, Ban công, View, Tiện ích), phím mũi tên & thanh thumbnail cuộn. |
| **RoomDetailModalComponent** | `<app-room-detail-modal>` | `shared/components/room-detail-modal/` | Modal chi tiết hạng phòng: đầy đủ thông số m², sức chứa, loại giường, danh mục tiện nghi, chính sách lưu trú & nút chọn phòng. |
| **BusinessDatePipe** | `{{ date \| businessDate }}` | `shared/pipes/business-date.pipe.ts` | Pipe định dạng ngày giờ chuẩn múi giờ nghiệp vụ Việt Nam (`Asia/Ho_Chi_Minh` UTC+7). |

#### 📦 Barrel Export Tiện ích Core (`frontend/src/app/core/utils/index.ts`):
Không import rải rác từng file util riêng rẽ. Luôn import tập trung từ `src/app/core/utils`:
```typescript
import {
  formatBusinessDate,
  calculateHousekeepingKpis,
  handleRoomStatusConcurrencyError,
  filterRoomTypes,
  validateRoomNumberWithFloor
} from '../../../core/utils';
```

---

### 2.2. Backend .NET 10 (Clean Architecture & CQRS)

Toàn bộ các thành phần dùng chung được tập trung tại các vị trí quy chuẩn:

| Thành Phần Dùng Chung | Vị Trí Quy Chuẩn | Mô Tả & Hướng Dẫn Sử Dụng |
|:---|:---|:---|
| **BaseApiController** | `HotelSaas.WebApi/Controllers/BaseApiController.cs` | Controller cha kế thừa `ControllerBase`. Tự động cung cấp `ISender Mediator`, `CurrentTenantId`, `CurrentPropertyId`, các phương thức `OkResponse<T>()` và `CreatedResponse<T>()`. |
| **ApiResponse\<T\>** | `HotelSaas.Application/Common/Models/ApiResponse.cs` | Khuôn mẫu phản hồi JSON chuẩn: `{ success, data, message, errorCode, errors, timestamp }`. Dùng `ApiResponse.Ok(data)` hoặc `ApiResponse.Fail(msg)`. |
| **PagedResult\<T\>** | `HotelSaas.Application/Common/Models/PagedResult.cs` | Dữ liệu phân trang chuẩn: `{ items, totalCount, pageNumber, pageSize, totalPages }`. |
| **Application Exceptions** | `HotelSaas.Application/Common/Exceptions/` | Bộ lỗi chuẩn: `NotFoundException`, `ConflictException`, `ValidationException`, `ForbiddenException`, `BadRequestException`. Tự động được `ExceptionHandlingMiddleware` chuyển thành mã HTTP chuẩn. |
| **Context Interfaces** | `HotelSaas.Application/Common/Interfaces/` | `ICurrentTenantService`, `ICurrentPropertyService`, `ICurrentUserContext`, `IApplicationDbContext`. |
| **Domain Common** | `HotelSaas.Domain/Common/` | `BaseEntity`, `ITenantScopedEntity`, `ISoftDelete`. |

#### Ví dụ tạo Controller mới kế thừa chuẩn dùng chung:
```csharp
[Authorize]
public sealed class RatesController : BaseApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<RoomRateDto>>>> GetRates(
        [FromQuery] GetRoomRatesQuery query, CancellationToken ct)
    {
        var result = await Mediator.Send(query, ct);
        return OkResponse(result);
    }
}
```

---

## 🧹 3. NGUYÊN TẮC VÀNG #2: VỆ SINH MÃ NGUỒN & QUẢN LÝ GIT (GIT HYGIENE)

### 🚫 Danh sách BẮT BUỘC KHÔNG ĐƯỢC ĐẨY LÊN GIT:
1. **Không commit test scripts chạy thử:** Tuyệt đối không commit các file như `test-guid.js`, `test-*.js`, `.py` chạy thử. Mọi kiểm thử phải nằm trong dự án kiểm thử chính thức: `backend/tests/` (xUnit) hoặc `frontend/src/**/*.spec.ts`.
2. **Không commit file kịch bản chụp ảnh màn hình / scratchpad:** Các file sinh dữ liệu tạm, file chụp màn hình Playwright tự chế, file ghi chú nháp phải được đặt trong thư mục bị ignore (`scratch/`, `temp/`).
3. **Không commit file zip, file backup, file log:** Đã được chặn tự động trong `.gitignore`.
4. **Không để file trôi nổi ngoài thư mục gốc (Root Clutter):** Gốc repository chỉ chứa các file cấu hình chuẩn: `.gitignore`, `.editorconfig`, `.env.example`, `README.md`, `AGENTS.md`.

### 🛡️ Tiêu chuẩn kiểm tra trước khi Commit (Build Gate):
Trước khi tạo bất kỳ commit nào, Agent **BẮT BUỘC** chạy và xác nhận 2 lệnh build thành công 100%:
```bash
# 1. Backend Build Gate
dotnet build backend/HotelSaas.slnx --verbosity minimal
# YÊU CẦU: Build succeeded. 0 Warning(s), 0 Error(s)

# 2. Frontend Build Gate
npm --prefix frontend run build
# YÊU CẦU: Application bundle generation complete. 0 Errors.
```

### 📝 Chuẩn Commit Message (Conventional Commits):
* `feat(<scope>): <mô tả>`: Tính năng mới theo kế hoạch phân kỳ.
* `fix(<scope>): <mô tả>`: Sửa lỗi nghiệp vụ hoặc kỹ thuật.
* `refactor(<scope>): <mô tả>`: Tái cấu trúc, đưa code vào module dùng chung.
* `docs(<scope>): <mô tả>`: Cập nhật tài liệu SRS/SDD/Báo cáo tuần.
* `test(<scope>): <mô tả>`: Thêm unit/integration tests chính thức.

---

## 🔒 4. NGUYÊN TẮC VÀNG #3: BẢO VỆ ĐA CHI NHÁNH & AN TOÀN DỮ LIỆU (FAIL-CLOSED)

1. **Multi-tenant Data Isolation:** Mọi entity dữ liệu khách sạn bắt buộc kế thừa `ITenantScopedEntity`.
2. **Tự động áp TenantId:** Trong các Command Handler tạo dữ liệu mới, bắt buộc gán `TenantId = _currentTenantService.TenantId!.Value`. Không nhận `tenantId` từ client payload.
3. **Fail-Closed Principle:** Nếu một request đòi hỏi ngữ cảnh Tenant/Property mà thiếu header `X-Tenant-Id` hoặc `X-Property-Id`, hệ thống phải từ chối ngay lập tức (HTTP 401 hoặc 403), không cho phép thực thi ở trạng thái mở.
4. **Bảo toàn cơ sở dữ liệu:** Không chạy migration hoặc sửa schema database đang chạy của các thành viên khác khi chưa có sự thống nhất trong kế hoạch phân kỳ.

---

## 🎨 5. QUY CHUẨN SINH HÌNH ẢNH TRỰC QUAN (IMAGE GENERATION STANDARD)

Khi cần sinh hình ảnh đồ họa, banner, phối cảnh phòng khách sạn hoặc tư liệu trực quan cho hệ thống, sử dụng Local AI Endpoint chuyên dụng:

* **Endpoint:** `http://localhost:20128/v1/images/generations`
* **Method:** `POST`
* **Header:** `Authorization: Bearer sk-b3a81036624ac7f5-l0yjhu-6d5d0d22`
* **Model:** `ag/gemini-3.1-flash-image`
* **Phong cách prompt:** Luxury hotel architecture, photorealistic, elegant warm ambient lighting, 8k resolution.
