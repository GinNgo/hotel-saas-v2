# Submission LEGACY-ROOM-ASSETS-01 — Round 1

- **TaskId:** `LEGACY-ROOM-ASSETS-01`
- **Round:** 1
- **SubmissionId:** `sub-legacy-room-assets-01-r1-20261012`
- **ReviewedSubmissionId:** null
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-12T15:56:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Nguồn Gốc & Khảo Sát Kho Lưu Trữ Cũ (Provenance & Source Verification)

- **Kho lưu trữ cũ tham chiếu (Legacy Repository):** `https://github.com/GinNgo/He-thong-quan-ly-khach-san`
- **Commit SHA đã xác minh:** `7e7ed12c0f4149527d46c78aa764b4c2ec88bab9`
- **Đường dẫn tệp khảo sát thực tế:**
  - `LuxeStay_Git_Nhom/LuxeStay/SOURCE/frontend/public/assets/room-types/`
  - `LuxeStay_Git_Nhom/LuxeStay/SOURCE/frontend/public/assets/properties/`
  - `LuxeStay_Git_Nhom/LuxeStay/SOURCE/frontend/public/assets/fallbacks/`
  - `backend/src/main/resources/db/migration/V7__demo_media_pricing_quality.sql`
  - `backend/src/main/resources/db/migration/V8__classify_legacy_demo_properties.sql`
- **Cam kết an toàn dữ liệu & bảo mật:**
  - Không truy cập hoặc trích xuất bất kỳ cơ sở dữ liệu thật (production DB), dữ liệu khách hàng (PII), thông tin đặt phòng, thẻ thanh toán hay secrets nào.
- **Tình trạng bản quyền & Giới hạn pháp lý (License Limitation):**
  - Khảo sát toàn bộ kho cũ cho thấy **không có tệp LICENSE** mã nguồn mở (MIT, Apache, CC-BY,...).
  - Việc kho lưu trữ ở chế độ Public trên GitHub **không đồng nghĩa** với việc được cấp phép tái phân phối thương mại tự do.
  - **Giới hạn được ghi nhận rõ:** Toàn bộ tư liệu ảnh trích xuất chỉ được lưu trữ cô lập trong thư mục evidence (`docs/agent-coordination/evidence/legacy-room-assets-01/`) nhằm phục vụ đối chiếu, kiểm thử và demo nội bộ. Tuyệt đối không import/seed trực tiếp vào production hoặc phát hành thương mại khi chưa có văn bản cấp phép chính thức từ tác giả.

---

## 2. Bảng Kê Tài Sản Dữ Liệu Cũ (Asset Manifest)

### 2.1. Nhóm Ảnh Loại Phòng Bản Cũ (`legacy-room-types/`)

| Tên tệp | Kích thước | Mã băm SHA256 | Vai trò & Loại phòng | Nguồn trích xuất |
|---|---|---|---|---|
| `single-room-01.webp` | 120,510 B | `0AA22C3E90F54EF05661E681DE317CB7D963E1ED48773085D345C9CCE59CEED5` | Phòng đơn (1 giường đơn) | Legacy `room-types/` |
| `double-room-01.webp` | 170,450 B | `27B6811A55DCD88958687BE601845CD56DE24A275DF61B70B8FA5D23B7AB44E8` | Phòng đôi chính (1 giường đôi) | Legacy `room-types/` |
| `double-room-02.webp` | 115,494 B | `191DE520A3B72AD406B77746B3A20681017CF4EA97892A896EDDE2700B04D4F6` | Phòng đôi phụ (góc nhìn 2) | Legacy `room-types/` |
| `twin-room-01.webp` | 219,022 B | `2BCD6BF622AE8CFB1E2457319C2ED01AFA379132B55A180417F6AB60295D466C` | Phòng 2 giường đơn tách biệt | Legacy `room-types/` |
| `family-room-01.webp` | 173,378 B | `A4986798E391C86A5ECD99695639574FC9135D78764D7DBC4CF2A1F454D4D16E` | Phòng gia đình (1 đôi + 1 đơn) | Legacy `room-types/` |
| `suite-room-01.webp` | 113,008 B | `92270077C9A0E05445A981B35B1DC2C89F3B4CF76D8D148627F1E31E3073349C` | Phòng Suite cao cấp (khu khách) | Legacy `room-types/` |
| `suite-room-02.webp` | 120,968 B | `DDB82B48E7DE09EB72A76FE3754D6C6A0F1C2AD8A035A4D464E563D485A05385` | Phòng Suite góc nhìn giường ngủ | Legacy `room-types/` |

### 2.2. Nhóm Ảnh Cơ Sở Khách Sạn Bản Cũ (`legacy-properties/`)

| Tên tệp | Kích thước | Mã băm SHA256 | Loại hình cơ sở |
|---|---|---|---|
| `hotel-city-01.webp` | 139,342 B | `3F93CB42EDA897E49021898380ADA0C5CBB0E40D1CF7F5A0066A0CF890C038F8` | Khách sạn trung tâm thành phố (Mặt tiền) |
| `hotel-city-02.webp` | 244,716 B | `8D2DC185A043B0DC55FCA18046AB263A150262982E02A3E4882F98C581290D0B` | Khách sạn trung tâm thành phố (Sảnh đón) |
| `hotel-beach-01.webp` | 124,564 B | `0239733772817D3CD35B5516E414C2E8BBDC9DB08F09803D6C91C209B2FCB94B` | Khách sạn ven biển |
| `hotel-room-01.webp` | 264,324 B | `956CB8B2164A2102E3E467AE222C53504A71C2343DF92F93F18F82449E7F89FB` | Phòng khách sạn tiêu chuẩn tổng thể |
| `hotel-room-02.webp` | 154,308 B | `5FCDEC9FCD7AD2B53E06DFDA264561A6AC53D5020A8EDA70B8BDB37080C474B8` | Phòng khách sạn nội thất ấm cúng |
| `motel-01.webp` | 161,124 B | `34C500A673B49D1724A790F01E856ACEC599F787F9133CABF4E1FAB77803BB25` | Nhà nghỉ / Motel tiện lợi |
| `homestay-01.webp` | 129,200 B | `0DC8B0747EC35A08C222BBAD72B4FA6BA75D9EF53F601760ADD75BC4358851F9` | Homestay ấm cúng |
| `hostel-01.webp` | 210,294 B | `384C3FF15A343A19BFF65155813B9999785B29DE65B24D99A21DC360E18D5A7F` | Hostel giường tầng / du lịch bụi |
| `apartment-01.webp` | 124,836 B | `ED1EB22041979D05CC1E16C4CFDF871788C71B2EDA9A8C0B1035AEBD2DB6F524` | Căn hộ dịch vụ |
| `villa-01.webp` | 182,512 B | `4BA39E77DB7B75118E285F437D6202597E7AEA7E30D2F6EDFE57A5B60176E970` | Biệt thự nghỉ dưỡng |
| `resort-01.webp` | 324,434 B | `86BA63DD4E57EE95BAB59C57E3CFA4903D7885AC53D9897970B090E2EB2016C7` | Khu nghỉ dưỡng resort ven biển |
| `guest-house-01.webp` | 181,612 B | `562A6FC37C76DE018E39F1B282F1D3D949380E30F561195903E4057348BCE5DD` | Nhà khách du lịch |

### 2.3. Nhóm Ảnh AI Illustrative Sinh Bổ Sung (`ai-illustrative/`)

> **Ghi chú bắt buộc:** Các ảnh dưới đây được sinh tự động qua Local AI Endpoint chuyên dụng (`http://localhost:20128/v1/images/generations` - Model `ag/gemini-3.1-flash-image`) nhằm minh họa cho các loại phòng cao cấp còn thiếu góc nhìn chân thực. Đây là **ảnh AI mang tính minh họa (AI Illustrative)**, tuyệt đối không phải ảnh chụp thực tế của cơ sở lưu trú.

| Tên tệp | Kích thước | Mã băm SHA256 | Phục vụ loại phòng mục tiêu |
|---|---|---|---|
| `ai-illustrative-deluxe-double-q1.png` | 763,542 B | `C4EA851FE57DE4319C37EF2E95503DC27F6C1139C12C535D7C3971E3AEED09C3` | `DLX-Q1` (Deluxe Double - Grand Hotel Sài Gòn Q1) |
| `ai-illustrative-standard-twin-q1.png` | 710,887 B | `01F8F513B3CC9F9D45967793E5C3B5BFBD5218BD6E1C6CF891AFCFE87EC58FF1` | `STD-Q1` (Standard Twin - Grand Hotel Sài Gòn Q1) |
| `ai-illustrative-executive-suite-pn.png` | 782,929 B | `AECC2B853A3FE3A3C088F117A709114FEFC91CB0EFC940C96CFE5CDBEA08938C` | `SUI-PN` (Executive Suite - Grand Hotel Phú Nhuận) |
| `ai-illustrative-superior-king-pn.png` | 764,526 B | `F5E5AEF3C4F6573C4898696A570185670B0DC07934A6453DC459D60AA0C2DA10` | `SUP-PN` (Superior King - Grand Hotel Phú Nhuận) |

---

## 3. Kiểm Tra Tính Độc Bản & Trùng Lặp (Uniqueness & Duplicate Analysis)

Đối chiếu mã băm bitwise SHA256 giữa thư mục `legacy-fallbacks/` và `legacy-room-types/`, `legacy-properties/`:

| Tệp tại `legacy-fallbacks/` | Tệp gốc trùng mã băm SHA256 | Kết quả đối chiếu SHA256 | Nhận xét kỹ thuật |
|---|---|---|---|
| `double-room-default.webp` | `legacy-room-types/double-room-01.webp` | `27B6811A...` (Khớp 100%) | Dự án cũ tái sử dụng làm ảnh mặc định cho phòng đôi |
| `family-room-default.webp` | `legacy-room-types/family-room-01.webp` | `A4986798...` (Khớp 100%) | Tái sử dụng làm fallback cho phòng gia đình |
| `single-room-default.webp` | `legacy-room-types/single-room-01.webp` | `0AA22C3E...` (Khớp 100%) | Tái sử dụng làm fallback cho phòng đơn |
| `suite-default.webp` | `legacy-room-types/suite-room-01.webp` | `92270077...` (Khớp 100%) | Tái sử dụng làm fallback cho phòng suite |
| `twin-room-default.webp` | `legacy-room-types/twin-room-01.webp` | `2BCD6BF6...` (Khớp 100%) | Tái sử dụng làm fallback cho phòng 2 giường đơn |
| `apartment-default.webp` | `legacy-properties/apartment-01.webp` | `ED1EB220...` (Khớp 100%) | Tái sử dụng làm fallback cho căn hộ |
| `guest-house-default.webp` | `legacy-properties/guest-house-01.webp` | `562A6FC3...` (Khớp 100%) | Tái sử dụng làm fallback cho nhà khách |
| `homestay-default.webp` | `legacy-properties/homestay-01.webp` | `0DC8B074...` (Khớp 100%) | Tái sử dụng làm fallback cho homestay |
| `hostel-default.webp` | `legacy-properties/hostel-01.webp` | `384C3FF1...` (Khớp 100%) | Tái sử dụng làm fallback cho hostel |
| `hotel-default.webp` | `legacy-properties/hotel-city-01.webp` | `3F93CB42...` (Khớp 100%) | Tái sử dụng làm fallback cho khách sạn |
| `motel-default.webp` | `legacy-properties/motel-01.webp` | `34C500A6...` (Khớp 100%) | Tái sử dụng làm fallback cho motel |
| `resort-default.webp` | `legacy-properties/resort-01.webp` | `86BA63DD...` (Khớp 100%) | Tái sử dụng làm fallback cho resort |
| `villa-default.webp` | `legacy-properties/villa-01.webp` | `4BA39E77...` (Khớp 100%) | Tái sử dụng làm fallback cho biệt thự |

- **Minh bạch thông tin:** Không có hiện tượng đổi tên file để ngụy tạo ảnh mới. Sự trùng lặp này phản ánh đúng thiết kế seed ban đầu của dự án cũ (dùng cùng 1 ảnh minh họa đại diện cho cả loại phòng cụ thể và fallback dự phòng).

---

## 4. Ma Trận Ánh Xạ Dữ Liệu (Property → RoomType → Asset Mapping)

Ánh xạ chi tiết từ các cơ sở & loại phòng thực tế trong `LocalDevDataSeeder.cs` của hệ thống mới sang bộ tài sản ảnh:

### 4.1. Chi Nhánh 1: Grand Hotel Sài Gòn (Quận 1) — Mã `CN-Q1`
- **Địa chỉ:** 123 Đồng Khởi, Bến Nghé, Quận 1, TP. Hồ Chí Minh
- **Loại phòng `DLX-Q1` (Deluxe Double Q1):**
  - Số khách tối đa: 2 người | Giá cơ sở tham chiếu: 1.200.000 VNĐ/đêm
  - Cấu hình giường: 1 Giường đôi King-size, cửa sổ lớn ngắm thành phố.
  - **Tài sản ảnh ánh xạ:**
    - Ảnh 1 (Chính): `legacy-room-types/double-room-01.webp`
    - Ảnh 2 (Phụ): `legacy-room-types/double-room-02.webp`
    - Ảnh 3 (Minh họa AI): `ai-illustrative/ai-illustrative-deluxe-double-q1.png`
- **Loại phòng `STD-Q1` (Standard Twin Q1):**
  - Số khách tối đa: 2 người | Giá cơ sở tham chiếu: 800.000 VNĐ/đêm
  - Cấu hình giường: 2 Giường đơn tiêu chuẩn.
  - **Tài sản ảnh ánh xạ:**
    - Ảnh 1 (Chính): `legacy-room-types/twin-room-01.webp`
    - Ảnh 2 (Minh họa AI): `ai-illustrative/ai-illustrative-standard-twin-q1.png`
- **Ảnh đại diện cơ sở `CN-Q1`:**
  - `legacy-properties/hotel-city-01.webp` (Mặt tiền khách sạn trung tâm)
  - `legacy-properties/hotel-city-02.webp` (Sảnh tiếp tân)

### 4.2. Chi Nhánh 2: Grand Hotel Phú Nhuận — Mã `CN-PN`
- **Địa chỉ:** 456 Phan Xích Long, Phường 2, Quận Phú Nhuận, TP. Hồ Chí Minh
- **Loại phòng `SUI-PN` (Executive Suite PN):**
  - Số khách tối đa: 3 người | Giá cơ sở tham chiếu: 2.000.000 VNĐ/đêm
  - Cấu hình giường: 1 Giường King lớn + 1 Sofa bed phòng khách, view toàn cảnh hoàng hôn.
  - **Tài sản ảnh ánh xạ:**
    - Ảnh 1 (Chính): `legacy-room-types/suite-room-01.webp`
    - Ảnh 2 (Phụ): `legacy-room-types/suite-room-02.webp`
    - Ảnh 3 (Minh họa AI): `ai-illustrative/ai-illustrative-executive-suite-pn.png`
- **Loại phòng `SUP-PN` (Superior King PN):**
  - Số khách tối đa: 2 người | Giá cơ sở tham chiếu: 1.000.000 VNĐ/đêm
  - Cấu hình giường: 1 Giường King, nội thất gỗ ấm áp hiện đại.
  - **Tài sản ảnh ánh xạ:**
    - Ảnh 1 (Chính): `legacy-room-types/double-room-01.webp`
    - Ảnh 2 (Phụ): `legacy-properties/hotel-room-01.webp`
    - Ảnh 3 (Minh họa AI): `ai-illustrative/ai-illustrative-superior-king-pn.png`
- **Ảnh đại diện cơ sở `CN-PN`:**
  - `legacy-properties/hotel-room-02.webp`
  - `legacy-properties/apartment-01.webp`

> **Tuyên bố dữ liệu:** Mọi thông tin giá phòng, loại phòng, số lượng giường và tồn phòng nêu trên là dữ liệu quy ước phục vụ kiểm thử môi trường phát triển (mock/seeder), **không phản ánh** giá niêm yết thương mại thực tế hay tình trạng phòng thực của bất kỳ pháp nhân khách sạn nào.

---

## 5. Ranh Giới Nhiệm Vụ & Khoảng Cách Kỹ Thuật (Boundaries & Gaps)

1. **Khoảng cách kỹ thuật (Gaps):**
   - Kho lưu trữ cũ chỉ sở hữu 7 ảnh phòng kích thước vừa phải (~110-219 KB) theo định dạng `.webp`. Các góc nhìn đặc thù (ban công, bồn tắm suite cao cấp, ánh sáng sáng sớm) bị thiếu, đã được bù đắp bằng 4 ảnh AI Illustrative chất lượng cao lưu cô lập tại `ai-illustrative/`.
2. **Tuân thủ ranh giới nhóm:**
   - **Zero backend C# / DB changes:** Không tạo migration, không sửa `LocalDevDataSeeder.cs`, không can thiệp database.
   - **Zero team domain modifications:** Không sửa đổi các module thuộc thẩm quyền của Nguyên (`Rooms`, `RoomTypes`) hoặc Tân (`Housekeeping`).
   - Toàn bộ tài sản được lưu trữ cô lập trong `docs/agent-coordination/evidence/legacy-room-assets-01/`. Không import vào thư mục `src/assets` production của frontend trong Round 1.
3. **Bảo lưu 7 Cổng Quyết Định Của PO:**
   - Cả 7 cổng kiến trúc/nghiệp vụ trong `decisions.md` giữ nguyên trạng thái `NeedsPO`. Phase 6 (AI) chưa mở.