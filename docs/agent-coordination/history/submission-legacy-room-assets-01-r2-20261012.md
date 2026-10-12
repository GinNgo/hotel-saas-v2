# Submission LEGACY-ROOM-ASSETS-01 — Round 2

- **TaskId:** `LEGACY-ROOM-ASSETS-01`
- **Round:** 2
- **SubmissionId:** `sub-legacy-room-assets-01-r2-20261012`
- **ReviewedSubmissionId:** `sub-legacy-room-assets-01-r1-20261012`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-12T18:15:00+07:00`
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Khắc Phục Ý Kiến Đánh Giá Vòng 1 (Resolution of Round 1 Findings)

Báo cáo Vòng 2 khắc phục toàn bộ 3 điểm phát hiện trong nhận xét của Codex Reviewer (`review.md`):

1. **Khắc phục [P1] — Tách bạch tuyệt đối Dữ liệu Seeder thực tế và Đề xuất minh họa:**
   - Đối chiếu trực tiếp mã nguồn `LocalDevDataSeeder.cs` (dòng 668–683):
     - Chỉ có các trường dữ liệu thực tế được seed vào database: `TenantId`, `PropertyId`, `Code`, `Name`, `BasePrice`, `MaxOccupancy` cho `RoomType`; và `RoomNumber`, `Floor`, `Status` (`Clean`, `Dirty`, `Cleaning`) cho `Room`.
     - **Không có bất kỳ trường nào** quy định kích thước giường (King/Queen/Twin), loại cửa sổ, hướng nhìn (view thành phố, view hoàng hôn), tiện nghi chi tiết, diện tích m², hoặc phong cách trang trí nội thất.
     - Vòng 2 đã loại bỏ hoàn toàn các nhận định suy diễn trong bản mô tả; các thuộc tính ngoài seeder được đánh dấu minh bạch: `CHƯA XÁC MINH TRONG SEED / ĐỀ XUẤT MINH HỌA (NOT VERIFIED)`.
     - Tuyệt đối không tuyên bố hai bức ảnh cũ (`double-room-01.webp` và `double-room-02.webp`, hoặc `suite-room-01.webp` và `suite-room-02.webp`) là "góc nhìn 2 của cùng một phòng vật lý". Khảo sát mã nguồn SQL migration cũ (`V7` và `V8`) xác nhận đây chỉ là các tệp ảnh stock được gán luân phiên (`sort_order % 2`). Mối quan hệ liên kết góc nhìn giữa các ảnh được đánh dấu: `KHÔNG CÓ CƠ SỞ XÁC MINH / ẢNH STOCK ĐỘC LẬP (NOT VERIFIED)`.

2. **Khắc phục [P2] — Bảng kê 37 tài sản minh bạch, định danh nguồn gốc và giới hạn pháp lý:**
   - Toàn bộ 37 tệp ảnh trong thư mục bằng chứng `docs/agent-coordination/evidence/legacy-room-assets-01/` được lập bảng kê chi tiết có thể tái lập (Reproducible Source Manifest): đường dẫn tương đối, kích thước byte, mã băm bitwise SHA256, đường dẫn gốc tại repo cũ gắn với commit pinned `7e7ed12c0f4149527d46c78aa764b4c2ec88bab9` hoặc siêu dữ liệu sinh ảnh AI.
   - **Tình trạng bản quyền (Licensing Limitation):** Khảo sát có giới hạn (bounded survey) xác nhận repo cũ `https://github.com/GinNgo/He-thong-quan-ly-khach-san` **không có tệp LICENSE**. Trạng thái public trên GitHub không cấp quyền tái sử dụng hay thương mại hóa. Toàn bộ 33 tài sản trích xuất từ repo cũ được gắn cờ: `CÁCH LY / CHỈ DÙNG THAM CHIẾU NỘI BỘ (QUARANTINED / REFERENCE ONLY)`. Tuyệt đối không import vào mã nguồn sản xuất (`src/assets`) hay cơ sở dữ liệu.
   - Bổ sung siêu dữ liệu sinh ảnh AI đã khử khuẩn (Sanitized AI Generation Provenance): Ghi nhận model, endpoint nội bộ, thời điểm sinh, kích thước, và toàn bộ văn bản prompt gốc mà không để lộ credential hay secret.

3. **Khắc phục [P2] — Bổ sung tệp thiếu `destination-default.webp` và phân nhóm trùng lặp đầy đủ:**
   - Đã bổ sung `destination-default.webp` (215,344 bytes, SHA256: `5274A24BEBD147C59C608F5DC7AD55DB2160AEC3F916F2D08B2046D2EAD07213`) vào danh mục fallback, nâng tổng số tệp fallback lên 14 (tổng toàn bộ evidence là đúng 37 tệp).
   - Xác định rõ ràng 13 cặp trùng lặp bitwise SHA256 (26 tệp) cùng 11 tệp độc bản.
   - Ghi nhận đánh giá tính phù hợp thị giác (Visual Suitability Review): Tính khác biệt của mã băm SHA256 không chứng minh nội thất khác nhau hay tính nhất quán thị giác của cùng một căn phòng.

---

## 2. Bảng Kê Toàn Bộ 37 Tài Sản (Reproducible 37-Asset Source Manifest)

> **Phạm vi khảo sát (Bounded Inventory):** Khảo sát giới hạn trong 33 tệp ảnh webp trích xuất từ `SOURCE/frontend/public/assets/` của kho lưu trữ `https://github.com/GinNgo/He-thong-quan-ly-khach-san` (Commit: `7e7ed12c0f4149527d46c78aa764b4c2ec88bab9`) và 4 tệp ảnh PNG minh họa sinh qua AI endpoint cục bộ.

| STT | Đường dẫn tương đối trong Evidence | Kích thước | Mã băm SHA256 | Nguồn trích xuất gốc / Định danh | Tình trạng pháp lý & Cách ly | Đánh giá phù hợp thị giác (Visual Suitability) |
|:---:|---|:---:|---|---|---|---|
| **I** | **Nhóm Loại Phòng Cũ (`legacy-room-types/` - 7 tệp)** | | | | | |
| 1 | `legacy-room-types/double-room-01.webp` | 170,450 B | `27B6811A55DCD88958687BE601845CD56DE24A275DF61B70B8FA5D23B7AB44E8` | Repo cũ: `.../assets/room-types/double-room-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock phòng 1 giường đôi. Trùng bitwise với fallback `double-room-default.webp`. |
| 2 | `legacy-room-types/double-room-02.webp` | 115,494 B | `191DE520A3B72AD406B77746B3A20681017CF4EA97892A896EDDE2700B04D4F6` | Repo cũ: `.../assets/room-types/double-room-02.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock phòng đôi độc lập. **NOT VERIFIED** là góc nhìn 2 của cùng phòng với file 01. |
| 3 | `legacy-room-types/family-room-01.webp` | 173,378 B | `A4986798E391C86A5ECD99695639574FC9135D78764D7DBC4CF2A1F454D4D16E` | Repo cũ: `.../assets/room-types/family-room-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock phòng gia đình. Trùng bitwise với fallback `family-room-default.webp`. |
| 4 | `legacy-room-types/single-room-01.webp` | 120,510 B | `0AA22C3E90F54EF05661E681DE317CB7D963E1ED48773085D345C9CCE59CEED5` | Repo cũ: `.../assets/room-types/single-room-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock phòng đơn. Trùng bitwise với fallback `single-room-default.webp`. |
| 5 | `legacy-room-types/suite-room-01.webp` | 113,008 B | `92270077C9A0E05445A981B35B1DC2C89F3B4CF76D8D148627F1E31E3073349C` | Repo cũ: `.../assets/room-types/suite-room-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock phòng khách suite. Trùng bitwise với fallback `suite-default.webp`. |
| 6 | `legacy-room-types/suite-room-02.webp` | 120,968 B | `DDB82B48E7DE09EB72A76FE3754D6C6A0F1C2AD8A035A4D464E563D485A05385` | Repo cũ: `.../assets/room-types/suite-room-02.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock phòng ngủ suite. **NOT VERIFIED** là cùng căn suite với file 01. |
| 7 | `legacy-room-types/twin-room-01.webp` | 219,022 B | `2BCD6BF622AE8CFB1E2457319C2ED01AFA379132B55A180417F6AB60295D466C` | Repo cũ: `.../assets/room-types/twin-room-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock phòng 2 giường đơn. Trùng bitwise với fallback `twin-room-default.webp`. |
| **II** | **Nhóm Cơ Sở Khách Sạn Cũ (`legacy-properties/` - 12 tệp)** | | | | | |
| 8 | `legacy-properties/apartment-01.webp` | 124,836 B | `ED1EB22041979D05CC1E16C4CFDF871788C71B2EDA9A8C0B1035AEBD2DB6F524` | Repo cũ: `.../assets/properties/apartment-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock căn hộ. Trùng bitwise với `apartment-default.webp`. |
| 9 | `legacy-properties/guest-house-01.webp` | 181,612 B | `562A6FC37C76DE018E39F1B282F1D3D949380E30F561195903E4057348BCE5DD` | Repo cũ: `.../assets/properties/guest-house-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock nhà khách. Trùng bitwise với `guest-house-default.webp`. |
| 10 | `legacy-properties/homestay-01.webp` | 129,200 B | `0DC8B0747EC35A08C222BBAD72B4FA6BA75D9EF53F601760ADD75BC4358851F9` | Repo cũ: `.../assets/properties/homestay-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock homestay. Trùng bitwise với `homestay-default.webp`. |
| 11 | `legacy-properties/hostel-01.webp` | 210,294 B | `384C3FF15A343A19BFF65155813B9999785B29DE65B24D99A21DC360E18D5A7F` | Repo cũ: `.../assets/properties/hostel-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock giường tầng hostel. Trùng bitwise với `hostel-default.webp`. |
| 12 | `legacy-properties/hotel-beach-01.webp` | 124,564 B | `0239733772817D3CD35B5516E414C2E8BBDC9DB08F09803D6C91C209B2FCB94B` | Repo cũ: `.../assets/properties/hotel-beach-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock khách sạn bãi biển nhiệt đới. Không có bản trùng fallback. |
| 13 | `legacy-properties/hotel-city-01.webp` | 139,342 B | `3F93CB42EDA897E49021898380ADA0C5CBB0E40D1CF7F5A0066A0CF890C038F8` | Repo cũ: `.../assets/properties/hotel-city-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock mặt tiền khách sạn đô thị. Trùng bitwise với `hotel-default.webp`. |
| 14 | `legacy-properties/hotel-city-02.webp` | 244,716 B | `8D2DC185A043B0DC55FCA18046AB263A150262982E02A3E4882F98C581290D0B` | Repo cũ: `.../assets/properties/hotel-city-02.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock sảnh khách sạn. Độc bản trong tập hợp. |
| 15 | `legacy-properties/hotel-room-01.webp` | 264,324 B | `956CB8B2164A2102E3E467AE222C53504A71C2343DF92F93F18F82449E7F89FB` | Repo cũ: `.../assets/properties/hotel-room-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock phòng khách sạn tổng quan. Độc bản trong tập hợp. |
| 16 | `legacy-properties/hotel-room-02.webp` | 154,308 B | `5FCDEC9FCD7AD2B53E06DFDA264561A6AC53D5020A8EDA70B8BDB37080C474B8` | Repo cũ: `.../assets/properties/hotel-room-02.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock phòng khách sạn góc ấm cúng. Độc bản trong tập hợp. |
| 17 | `legacy-properties/motel-01.webp` | 161,124 B | `34C500A673B49D1724A790F01E856ACEC599F787F9133CABF4E1FAB77803BB25` | Repo cũ: `.../assets/properties/motel-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock nhà nghỉ motel. Trùng bitwise với `motel-default.webp`. |
| 18 | `legacy-properties/resort-01.webp` | 324,434 B | `86BA63DD4E57EE95BAB59C57E3CFA4903D7885AC53D9897970B090E2EB2016C7` | Repo cũ: `.../assets/properties/resort-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock khu nghỉ dưỡng resort hồ bơi. Trùng bitwise với `resort-default.webp`. |
| 19 | `legacy-properties/villa-01.webp` | 182,512 B | `4BA39E77DB7B75118E285F437D6202597E7AEA7E30D2F6EDFE57A5B60176E970` | Repo cũ: `.../assets/properties/villa-01.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock biệt thự villa. Trùng bitwise với `villa-default.webp`. |
| **III** | **Nhóm Ảnh Fallback Cũ (`legacy-fallbacks/` - 14 tệp)** | | | | | |
| 20 | `legacy-fallbacks/apartment-default.webp` | 124,836 B | `ED1EB22041979D05CC1E16C4CFDF871788C71B2EDA9A8C0B1035AEBD2DB6F524` | Repo cũ: `.../assets/fallbacks/apartment-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `apartment-01.webp`. |
| 21 | `legacy-fallbacks/destination-default.webp` | 215,344 B | `5274A24BEBD147C59C608F5DC7AD55DB2160AEC3F916F2D08B2046D2EAD07213` | Repo cũ: `.../assets/fallbacks/destination-default.webp` | Quarantined / Reference Only (No LICENSE) | Ảnh stock cảnh quan điểm đến đô thị. Độc bản trong tập hợp (không trùng ảnh phòng/cơ sở). |
| 22 | `legacy-fallbacks/double-room-default.webp` | 170,450 B | `27B6811A55DCD88958687BE601845CD56DE24A275DF61B70B8FA5D23B7AB44E8` | Repo cũ: `.../assets/fallbacks/double-room-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `double-room-01.webp`. |
| 23 | `legacy-fallbacks/family-room-default.webp` | 173,378 B | `A4986798E391C86A5ECD99695639574FC9135D78764D7DBC4CF2A1F454D4D16E` | Repo cũ: `.../assets/fallbacks/family-room-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `family-room-01.webp`. |
| 24 | `legacy-fallbacks/guest-house-default.webp` | 181,612 B | `562A6FC37C76DE018E39F1B282F1D3D949380E30F561195903E4057348BCE5DD` | Repo cũ: `.../assets/fallbacks/guest-house-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `guest-house-01.webp`. |
| 25 | `legacy-fallbacks/homestay-default.webp` | 129,200 B | `0DC8B0747EC35A08C222BBAD72B4FA6BA75D9EF53F601760ADD75BC4358851F9` | Repo cũ: `.../assets/fallbacks/homestay-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `homestay-01.webp`. |
| 26 | `legacy-fallbacks/hostel-default.webp` | 210,294 B | `384C3FF15A343A19BFF65155813B9999785B29DE65B24D99A21DC360E18D5A7F` | Repo cũ: `.../assets/fallbacks/hostel-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `hostel-01.webp`. |
| 27 | `legacy-fallbacks/hotel-default.webp` | 139,342 B | `3F93CB42EDA897E49021898380ADA0C5CBB0E40D1CF7F5A0066A0CF890C038F8` | Repo cũ: `.../assets/fallbacks/hotel-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `hotel-city-01.webp`. |
| 28 | `legacy-fallbacks/motel-default.webp` | 161,124 B | `34C500A673B49D1724A790F01E856ACEC599F787F9133CABF4E1FAB77803BB25` | Repo cũ: `.../assets/fallbacks/motel-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `motel-01.webp`. |
| 29 | `legacy-fallbacks/resort-default.webp` | 324,434 B | `86BA63DD4E57EE95BAB59C57E3CFA4903D7885AC53D9897970B090E2EB2016C7` | Repo cũ: `.../assets/fallbacks/resort-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `resort-01.webp`. |
| 30 | `legacy-fallbacks/single-room-default.webp` | 120,510 B | `0AA22C3E90F54EF05661E681DE317CB7D963E1ED48773085D345C9CCE59CEED5` | Repo cũ: `.../assets/fallbacks/single-room-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `single-room-01.webp`. |
| 31 | `legacy-fallbacks/suite-default.webp` | 113,008 B | `92270077C9A0E05445A981B35B1DC2C89F3B4CF76D8D148627F1E31E3073349C` | Repo cũ: `.../assets/fallbacks/suite-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `suite-room-01.webp`. |
| 32 | `legacy-fallbacks/twin-room-default.webp` | 219,022 B | `2BCD6BF622AE8CFB1E2457319C2ED01AFA379132B55A180417F6AB60295D466C` | Repo cũ: `.../assets/fallbacks/twin-room-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `twin-room-01.webp`. |
| 33 | `legacy-fallbacks/villa-default.webp` | 182,512 B | `4BA39E77DB7B75118E285F437D6202597E7AEA7E30D2F6EDFE57A5B60176E970` | Repo cũ: `.../assets/fallbacks/villa-default.webp` | Quarantined / Reference Only (No LICENSE) | Trùng bitwise 100% với `villa-01.webp`. |
| **IV** | **Nhóm Ảnh Minh Họa AI Sinh Mới (`ai-illustrative/` - 4 tệp)** | | | | | |
| 34 | `ai-illustrative/ai-illustrative-deluxe-double-q1.png` | 763,542 B | `C4EA851FE57DE4319C37EF2E95503DC27F6C1139C12C535D7C3971E3AEED09C3` | Sinh qua Local AI (`gemini-3.1-flash-image`) lúc 2026-10-12T08:54Z | Synthetic Mock (No real property rights) | Ảnh minh họa AI mô phỏng phòng Deluxe Double. |
| 35 | `ai-illustrative/ai-illustrative-standard-twin-q1.png` | 710,887 B | `01F8F513B3CC9F9D45967793E5C3B5BFBD5218BD6E1C6CF891AFCFE87EC58FF1` | Sinh qua Local AI (`gemini-3.1-flash-image`) lúc 2026-10-12T08:54Z | Synthetic Mock (No real property rights) | Ảnh minh họa AI mô phỏng phòng Standard Twin (2 giường tách biệt). |
| 36 | `ai-illustrative/ai-illustrative-executive-suite-pn.png` | 782,929 B | `AECC2B853A3FE3A3C088F117A709114FEFC91CB0EFC940C96CFE5CDBEA08938C` | Sinh qua Local AI (`gemini-3.1-flash-image`) lúc 2026-10-12T08:54Z | Synthetic Mock (No real property rights) | Ảnh minh họa AI mô phỏng phòng Suite tiếp khách sang trọng. |
| 37 | `ai-illustrative/ai-illustrative-superior-king-pn.png` | 764,526 B | `F5E5AEF3C4F6573C4898696A570185670B0DC07934A6453DC459D60AA0C2DA10` | Sinh qua Local AI (`gemini-3.1-flash-image`) lúc 2026-10-12T08:54Z | Synthetic Mock (No real property rights) | Ảnh minh họa AI mô phỏng phòng Superior giường King đầu giường gỗ. |

---

## 3. Phân Nhóm Trùng Lặp Bitwise & Báo Cáo Phù Hợp Thị Giác (Duplicate Groups & Perceptual Review)

### 3.1. Phân Tích 13 Cặp Trùng Lặp Bitwise (26 Tệp)
Kiểm tra mã băm SHA256 cho thấy 13 tệp trong thư mục `legacy-fallbacks/` trùng khớp 100% từng byte với tệp tương ứng trong `legacy-room-types/` hoặc `legacy-properties/`:

1. `ED1EB22041979D05CC1E16C4CFDF871788C71B2EDA9A8C0B1035AEBD2DB6F524`: `legacy-properties/apartment-01.webp` ≡ `legacy-fallbacks/apartment-default.webp`
2. `562A6FC37C76DE018E39F1B282F1D3D949380E30F561195903E4057348BCE5DD`: `legacy-properties/guest-house-01.webp` ≡ `legacy-fallbacks/guest-house-default.webp`
3. `0DC8B0747EC35A08C222BBAD72B4FA6BA75D9EF53F601760ADD75BC4358851F9`: `legacy-properties/homestay-01.webp` ≡ `legacy-fallbacks/homestay-default.webp`
4. `384C3FF15A343A19BFF65155813B9999785B29DE65B24D99A21DC360E18D5A7F`: `legacy-properties/hostel-01.webp` ≡ `legacy-fallbacks/hostel-default.webp`
5. `3F93CB42EDA897E49021898380ADA0C5CBB0E40D1CF7F5A0066A0CF890C038F8`: `legacy-properties/hotel-city-01.webp` ≡ `legacy-fallbacks/hotel-default.webp`
6. `34C500A673B49D1724A790F01E856ACEC599F787F9133CABF4E1FAB77803BB25`: `legacy-properties/motel-01.webp` ≡ `legacy-fallbacks/motel-default.webp`
7. `86BA63DD4E57EE95BAB59C57E3CFA4903D7885AC53D9897970B090E2EB2016C7`: `legacy-properties/resort-01.webp` ≡ `legacy-fallbacks/resort-default.webp`
8. `4BA39E77DB7B75118E285F437D6202597E7AEA7E30D2F6EDFE57A5B60176E970`: `legacy-properties/villa-01.webp` ≡ `legacy-fallbacks/villa-default.webp`
9. `27B6811A55DCD88958687BE601845CD56DE24A275DF61B70B8FA5D23B7AB44E8`: `legacy-room-types/double-room-01.webp` ≡ `legacy-fallbacks/double-room-default.webp`
10. `A4986798E391C86A5ECD99695639574FC9135D78764D7DBC4CF2A1F454D4D16E`: `legacy-room-types/family-room-01.webp` ≡ `legacy-fallbacks/family-room-default.webp`
11. `0AA22C3E90F54EF05661E681DE317CB7D963E1ED48773085D345C9CCE59CEED5`: `legacy-room-types/single-room-01.webp` ≡ `legacy-fallbacks/single-room-default.webp`
12. `92270077C9A0E05445A981B35B1DC2C89F3B4CF76D8D148627F1E31E3073349C`: `legacy-room-types/suite-room-01.webp` ≡ `legacy-fallbacks/suite-default.webp`
13. `2BCD6BF622AE8CFB1E2457319C2ED01AFA379132B55A180417F6AB60295D466C`: `legacy-room-types/twin-room-01.webp` ≡ `legacy-fallbacks/twin-room-default.webp`

**Nguyên nhân kỹ thuật:** Thiết kế seed của dự án cũ sao chép chính các tệp ảnh chính làm tệp dự phòng mặc định (fallback) cho từng loại phòng/loại cơ sở để tránh lỗi thiếu ảnh khi render UI.

### 3.2. Danh Sách 11 Tệp Độc Bản (Không Trùng Bitwise)
- `legacy-fallbacks/destination-default.webp` (215,344 B) — SHA256: `5274A24B...` (Ảnh phong cảnh đại diện điểm đến đô thị).
- `legacy-properties/hotel-beach-01.webp` (124,564 B) — SHA256: `02397337...`
- `legacy-properties/hotel-city-02.webp` (244,716 B) — SHA256: `8D2DC185...`
- `legacy-properties/hotel-room-01.webp` (264,324 B) — SHA256: `956CB8B2...`
- `legacy-properties/hotel-room-02.webp` (154,308 B) — SHA256: `5FCDEC9F...`
- `legacy-room-types/double-room-02.webp` (115,494 B) — SHA256: `191DE520...`
- `legacy-room-types/suite-room-02.webp` (120,968 B) — SHA256: `DDB82B48...`
- `ai-illustrative/ai-illustrative-deluxe-double-q1.png` (763,542 B) — SHA256: `C4EA851F...`
- `ai-illustrative/ai-illustrative-standard-twin-q1.png` (710,887 B) — SHA256: `01F8F513...`
- `ai-illustrative/ai-illustrative-executive-suite-pn.png` (782,929 B) — SHA256: `AECC2B85...`
- `ai-illustrative/ai-illustrative-superior-king-pn.png` (764,526 B) — SHA256: `F5E5AEF3...`

### 3.3. Đánh Giá Phù Hợp Thị Giác & Giới Hạn Bộ Sưu Tập Cùng Phòng (Perceptual Limitations)
- **Tính độc lập của ảnh stock:** Mã băm SHA256 khác nhau giữa `double-room-01.webp` và `double-room-02.webp` chỉ chứng minh đây là hai tệp tin nhị phân khác nhau, **không chứng minh** chúng cùng mô tả một căn phòng vật lý hay một góc chụp khác của cùng một không gian. Hai bức ảnh có phong cách trang trí giường, ánh sáng và tường hoàn toàn khác nhau.
- Tương tự, `suite-room-01.webp` (phòng khách) và `suite-room-02.webp` (phòng ngủ) không có bằng chứng nào thể hiện chúng thuộc về cùng một căn suite.
- **Kết luận:** Nếu hiển thị thành một gallery ảnh cho một loại phòng trong ứng dụng thực tế, người dùng sẽ nhận thấy sự không đồng nhất về mặt nội thất. Vì vậy, các tệp này **chỉ phù hợp làm tài liệu khảo sát kỹ thuật hoặc demo card đơn lẻ**, không đủ điều kiện làm gallery đa góc nhìn cho cùng một phòng thực tế.

---

## 4. Ma Trận Đối Chiếu: Dữ Liệu Seeder Thực Tế vs Đề Xuất Minh Họa

Toàn bộ thông tin dưới đây phân chia rạch ròi giữa **Dữ liệu Seeder thực tế** (được kiểm chứng từ mã nguồn C# `LocalDevDataSeeder.cs`, dòng 410–475 và dòng 669–683) và **Đề xuất minh họa ảnh**.

### 4.1. Chi Nhánh 1: `CN-Q1` — Grand Hotel Sài Gòn (Quận 1)

- **Thông tin cơ sở được Seeder xác minh:**
  - `Code`: `CN-Q1` | `Name`: `Grand Hotel Sài Gòn (Quận 1)` | `Slug`: `grand-hotel-saigon-q1`
  - `Address`: `123 Lê Lợi, Phường Bến Nghé, Quận 1` | `City`: `Hồ Chí Minh`
  - `PropertyType`: `Hotel` | `StarRating`: 5 | `Status`: `Active` | `IsPublished`: `true`
  - `CheckInTime`: `14:00` | `CheckOutTime`: `12:00` | `TaxRatePercent`: `8.00%` | `ServiceFeeRatePercent`: `5.00%`

#### A. Loại phòng `DLX-Q1` (Deluxe Double Q1)
- **Dữ liệu Seeder thực tế (Verified Seed Facts):**
  - `Code`: `DLX-Q1`
  - `Name`: `Deluxe Double (Q1)`
  - `BasePrice`: `1,200,000 VND`
  - `MaxOccupancy`: `2 người`
  - **Danh sách phòng gán trong Seeder:**
    - Phòng `101`: Tầng 1, Trạng thái `Clean`
    - Phòng `201`: Tầng 2, Trạng thái `Clean`
- **Các thuộc tính chưa có trong Seeder (Unknown / Not in Seed):**
  - Kích thước giường: *Chưa xác minh trong seed (Đề xuất ý niệm: 1 Giường đôi)*.
  - Cửa sổ / Hướng nhìn (View): *Chưa xác minh trong seed (Đề xuất ý niệm: View thành phố)*.
  - Tiện nghi / Diện tích: *Chưa xác minh trong seed (Không có trường dữ liệu)*.
- **Đề xuất tài sản ảnh minh họa:**
  - Ảnh 1 (Ảnh cũ tham chiếu): `legacy-room-types/double-room-01.webp` (Stock phòng đôi - Quarantined)
  - Ảnh 2 (Ảnh cũ tham chiếu phụ): `legacy-room-types/double-room-02.webp` (**NOT VERIFIED** cùng phòng với Ảnh 1)
  - Ảnh 3 (Ảnh AI sinh minh họa): `ai-illustrative/ai-illustrative-deluxe-double-q1.png` (AI Illustrative Mock - Không phải ảnh thật)

#### B. Loại phòng `STD-Q1` (Standard Twin Q1)
- **Dữ liệu Seeder thực tế (Verified Seed Facts):**
  - `Code`: `STD-Q1`
  - `Name`: `Standard Twin (Q1)`
  - `BasePrice`: `800,000 VND`
  - `MaxOccupancy`: `2 người`
  - **Danh sách phòng gán trong Seeder:**
    - Phòng `102`: Tầng 1, Trạng thái `Dirty`
- **Các thuộc tính chưa có trong Seeder (Unknown / Not in Seed):**
  - Kích thước giường: *Chưa xác minh trong seed (Đề xuất ý niệm: 2 Giường đơn)*.
  - Cửa sổ / Hướng nhìn / Tiện nghi: *Chưa xác minh trong seed (Không có trường dữ liệu)*.
- **Đề xuất tài sản ảnh minh họa:**
  - Ảnh 1 (Ảnh cũ tham chiếu): `legacy-room-types/twin-room-01.webp` (Stock phòng 2 giường - Quarantined)
  - Ảnh 2 (Ảnh AI sinh minh họa): `ai-illustrative/ai-illustrative-standard-twin-q1.png` (AI Illustrative Mock - Minh họa 2 giường riêng biệt)

#### C. Ảnh đại diện cơ sở `CN-Q1` (Đề xuất minh họa)
- `legacy-properties/hotel-city-01.webp` (Stock tòa nhà khách sạn thành phố - Quarantined)
- `legacy-properties/hotel-city-02.webp` (Stock sảnh tiếp tân - Quarantined)

---

### 4.2. Chi Nhánh 2: `CN-PN` — Grand Hotel Phú Nhuận

- **Thông tin cơ sở được Seeder xác minh:**
  - `Code`: `CN-PN` | `Name`: `Grand Hotel Phú Nhuận` | `Slug`: `grand-hotel-phu-nhuan`
  - `Address`: `456 Phan Xích Long, Phường 2, Quận Phú Nhuận` | `City`: `Hồ Chí Minh`
  - `PropertyType`: `Hotel` | `StarRating`: 4 | `Status`: `Active` | `IsPublished`: `true`
  - `CheckInTime`: `14:00` | `CheckOutTime`: `12:00` | `TaxRatePercent`: `8.00%` | `ServiceFeeRatePercent`: `5.00%`

#### A. Loại phòng `SUI-PN` (Executive Suite PN)
- **Dữ liệu Seeder thực tế (Verified Seed Facts):**
  - `Code`: `SUI-PN`
  - `Name`: `Executive Suite (PN)`
  - `BasePrice`: `2,000,000 VND`
  - `MaxOccupancy`: `3 người`
  - **Danh sách phòng gán trong Seeder:**
    - Phòng `301`: Tầng 3, Trạng thái `Clean`
    - Phòng `401`: Tầng 4, Trạng thái `Clean`
- **Các thuộc tính chưa có trong Seeder (Unknown / Not in Seed):**
  - Bố cục phòng / Giường / Sofa: *Chưa xác minh trong seed (Đề xuất ý niệm: 1 Giường lớn + 1 Sofa bed)*.
  - Hướng nhìn / Hoàng hôn / Tiện nghi: *Chưa xác minh trong seed (Không có trường dữ liệu)*.
- **Đề xuất tài sản ảnh minh họa:**
  - Ảnh 1 (Ảnh cũ tham chiếu): `legacy-room-types/suite-room-01.webp` (Stock phòng khách suite - Quarantined)
  - Ảnh 2 (Ảnh cũ tham chiếu phụ): `legacy-room-types/suite-room-02.webp` (**NOT VERIFIED** cùng phòng với Ảnh 1)
  - Ảnh 3 (Ảnh AI sinh minh họa): `ai-illustrative/ai-illustrative-executive-suite-pn.png` (AI Illustrative Mock)

#### B. Loại phòng `SUP-PN` (Superior King PN)
- **Dữ liệu Seeder thực tế (Verified Seed Facts):**
  - `Code`: `SUP-PN`
  - `Name`: `Superior King (PN)`
  - `BasePrice`: `1,000,000 VND`
  - `MaxOccupancy`: `2 người`
  - **Danh sách phòng gán trong Seeder:**
    - Phòng `302`: Tầng 3, Trạng thái `Cleaning`
- **Các thuộc tính chưa có trong Seeder (Unknown / Not in Seed):**
  - Kích thước giường / Vật liệu nội thất: *Chưa xác minh trong seed (Đề xuất ý niệm: 1 Giường King, nội thất gỗ)*.
  - Cửa sổ / Hướng nhìn / Tiện nghi: *Chưa xác minh trong seed (Không có trường dữ liệu)*.
- **Đề xuất tài sản ảnh minh họa:**
  - Ảnh 1 (Ảnh cũ tham chiếu): `legacy-room-types/double-room-01.webp` (Stock phòng đôi - Quarantined)
  - Ảnh 2 (Ảnh cũ tham chiếu phụ): `legacy-properties/hotel-room-01.webp` (Stock phòng ngủ - Quarantined)
  - Ảnh 3 (Ảnh AI sinh minh họa): `ai-illustrative/ai-illustrative-superior-king-pn.png` (AI Illustrative Mock)

#### C. Ảnh đại diện cơ sở `CN-PN` (Đề xuất minh họa)
- `legacy-properties/hotel-room-02.webp` (Stock phòng ấm cúng - Quarantined)
- `legacy-properties/apartment-01.webp` (Stock căn hộ - Quarantined)

---

## 5. Siêu Dữ Liệu Sinh Ảnh AI Đã Khử Khuẩn (Sanitized AI Generation Provenance)

Toàn bộ 4 tệp ảnh minh họa AI được khởi tạo bằng công cụ sinh ảnh cục bộ, ghi nhận siêu dữ liệu an toàn và đã khử khuẩn hoàn toàn thông tin xác thực:

- **Inference Server:** `http://localhost:20128/v1/images/generations` (Cục bộ nội bộ)
- **Engine / Model:** `ag/gemini-3.1-flash-image`
- **Thời điểm sinh tệp:** `2026-10-12T08:54:49Z` (15:54:49 UTC+7)
- **Bảo mật:** Script sinh ảnh đã xóa khỏi workspace; mã xác thực Bearer token không được ghi lại trong tài liệu này hay bất kỳ tệp log nào.
- **Bảng chi tiết Prompt & Tham số:**

| Tệp Đầu Ra | Kích Thước | SHA-256 | Tham số cấu hình | Văn bản Prompt gốc (Đã khử khuẩn) |
|---|:---:|---|---|---|
| `ai-illustrative-deluxe-double-q1.png` | 763,542 B | `C4EA851FE57DE4319C37EF2E95503DC27F6C1139C12C535D7C3971E3AEED09C3` | `n=1, size="auto", quality="auto"` | *"Photorealistic luxury deluxe double hotel room in Saigon, king size bed with crisp white linens, large floor-to-ceiling window overlooking city skyline with warm morning sunlight, modern elegant wooden furniture, boutique hospitality photography, 8k resolution"* |
| `ai-illustrative-standard-twin-q1.png` | 710,887 B | `01F8F513B3CC9F9D45967793E5C3B5BFBD5218BD6E1C6CF891AFCFE87EC58FF1` | `n=1, size="auto", quality="auto"` | *"Photorealistic clean standard twin hotel room, two separate twin beds with neat bedding, warm ambient reading lights, minimalist modern interior design, bright natural lighting, professional interior photography, 8k resolution"* |
| `ai-illustrative-executive-suite-pn.png` | 782,929 B | `AECC2B853A3FE3A3C088F117A709114FEFC91CB0EFC940C96CFE5CDBEA08938C` | `n=1, size="auto", quality="auto"` | *"Photorealistic luxury executive hotel suite in Phu Nhuan Saigon, spacious living room area with plush sofa, separate king bedroom, panoramic city view at golden hour sunset, warm ambient architectural lighting, high-end hospitality interior, 8k resolution"* |
| `ai-illustrative-superior-king-pn.png` | 764,526 B | `F5E5AEF3C4F6573C4898696A570185670B0DC07934A6453DC459D60AA0C2DA10` | `n=1, size="auto", quality="auto"` | *"Photorealistic superior king hotel bedroom, premium wooden headboard, soft accent wall lighting, cozy armchair, clean contemporary boutique hotel decor, natural daylight, architectural photography, 8k resolution"* |

---

## 6. Ranh Giới Kỹ Thuật, Quyền Bản Quyền & 7 Cổng Quyết Định Của PO

1. **Giới hạn bản quyền (Licensing Limitation) & Cách ly tuyệt đối:**
   - Kho lưu trữ cũ `He-thong-quan-ly-khach-san` không có tệp cấp phép `LICENSE`.
   - Toàn bộ 33 tài sản từ kho cũ bị **cách ly nghiêm ngặt** trong thư mục bằng chứng `docs/agent-coordination/evidence/legacy-room-assets-01/`. Không được phép nhập vào cây thư mục sản phẩm `src/assets`, không seed vào cơ sở dữ liệu và không phát hành ra ngoài.
2. **Tuân thủ cam kết không can thiệp mã nguồn:**
   - **Zero C# changes:** Không sửa đổi bất kỳ tệp backend hay seeder nào.
   - **Zero DB changes:** Không tạo migration, không chạy câu lệnh DML nào lên cơ sở dữ liệu.
   - **Zero Team domain modifications:** Không can thiệp module của Nguyên (`Rooms`, `RoomTypes`) và Tân (`Housekeeping`).
3. **Bảo toàn 7 Cổng Quyết Định Của PO (`decisions.md`):**
   - Cả 7 cổng kiến trúc/nghiệp vụ (TTL token D21, Quote hold/pinning, Search API contract, Publication policy, Nguồn dữ liệu hành chính VN, Kế hoạch migration địa bàn, Cơ chế kiểm tra tồn phòng xuyên cơ sở) tiếp tục được bảo toàn ở trạng thái `NeedsPO`.
   - Giai đoạn 6 (Phase 6 - AI) chưa được kích hoạt.