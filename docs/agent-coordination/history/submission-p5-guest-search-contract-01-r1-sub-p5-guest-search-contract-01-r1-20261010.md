# Submission: P5-GUEST-SEARCH-CONTRACT-01 (Round 1)

- **TaskId:** P5-GUEST-SEARCH-CONTRACT-01
- **Round:** 1
- **SubmissionId:** sub-p5-guest-search-contract-01-r1-20261010
- **ReviewedSubmissionId:** sub-p7-visual-evidence-01-r3-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T22:20:30+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Mục Tiêu & Căn Cứ Điều Phối (Context & Objectives)

Thực hiện đúng chỉ đạo của PO trong kênh trao đổi và phân công điều phối tại [`docs/agent-coordination/assignment.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/assignment.md):
- **Ưu tiên hàng đầu:** Luồng giao diện khách hàng và tính năng tìm kiếm thông thường (Ordinary Guest Search) trước khi triển khai AI Search (P6) hay tích hợp Google Maps.
- **Phạm vi Task Round 1:** Hoàn thành khảo sát kỹ thuật toàn diện (Technical Survey), phân rã yêu cầu doanh nghiệp (`requirements-analysis-enterprise`), thiết kế hệ thống (`system-design-enterprise`) và lập đề xuất hợp đồng API (Contract Proposal) cùng lát cắt triển khai nhỏ nhất (Smallest Implementation Slice).
- **Ranh giới an toàn (Safety Guard):** Tuyệt đối **không thực hiện sửa đổi mã nguồn nghiệp vụ, không thêm migration schema, không can thiệp database dev/staging/prod**, không đụng chạm module của đồng đội (Nguyên & Tân).

Tài liệu đặc tả chi tiết đã được lập và lưu tại:  
📄 **[`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md)**

---

## 2. Tóm Tắt Kết Quả Khảo Sát Hiện Trạng (Key Survey Findings)

### 2.1. Khoảng trống giữa Tài liệu Đặc tả và Triển khai Thực tế (Gap Audit)
1. **Thực trạng Entity `Property`:**
   - Đang có: `Name`, `Code`, `Slug`, `Address` (chuỗi tự do), `City` (thành phố/tỉnh), `Latitude`, `Longitude`, `IsPublished` (bool), `Status` (PropertyStatus).
   - Chưa có: Các trường `ProvinceCode`, `Ward`, `WardCode` (dù đã được ghi chú planned trong `docs/srs/06-data-dictionary.md:59-61`), và chưa có trường nhãn khu vực/địa danh `Landmarks`.
   - **Chưa có Dataset Hành chính:** Repository hoàn toàn chưa có bảng hoặc tệp dữ liệu danh mục đơn vị hành chính Việt Nam (Tỉnh/Thành, Xã/Phường).
2. **Quy tắc về Chuỗi Địa chỉ (Address Parsing Guard):**
   - Không thể và không được phép dùng regex/substring bóc tách Tỉnh/Thành hay Xã/Phường từ trường `Address` tự do, vì dữ liệu người dùng nhập không đồng nhất và dễ dẫn đến sai lệch nghiêm trọng.
3. **Hiện trạng API `GET /api/public/properties?search={keyword}`:**
   - Handler hiện tại (`GetPublicPropertiesQueryHandler.cs`) chỉ tìm kiếm chuỗi con đơn giản `.ToLower().Contains(search)`.
   - **Hạn chế lớn:** Không hỗ trợ tiếng Việt không dấu (gõ `sai gon` không tìm thấy `Khách sạn Sài Gòn`), chưa lọc điều kiện `IsPublished == true` (nguy cơ rò rỉ cơ sở chưa duyệt), và chưa có bộ lọc ngày/khách/phòng trống thực tế.
4. **Hiện trạng Giao diện (`booking.page.ts`):**
   - Chỉ có một thẻ dropdown tĩnh chọn cơ sở lưu trú. Chưa có Search Bar, bộ lọc Tỉnh/Thành hay lưới thẻ khách sạn hiển thị kết quả.

---

## 3. Bốn Trục Tìm Kiếm Doanh Nghiệp (4 Search Dimensions)

1. **Trục 1 — Tên khách sạn:** Hỗ trợ tìm kiếm không phân biệt chữ hoa/thường và **không phân biệt dấu tiếng Việt (diacritics-insensitive)** (VD: `sai gon`, `Sài Gòn`, `sai gòn` đều khớp).
2. **Trục 2 — Địa giới hành chính 2 cấp chuẩn hóa:** Tỉnh/Thành phố trực thuộc TW → Xã/Phường/Thị trấn theo danh mục hành chính Việt Nam có thẩm quyền.
3. **Trục 3 — Khu vực / Địa danh du lịch nổi tiếng:** Tách rời hoàn toàn khỏi cây hành chính 2 cấp (VD: "Bãi Cháy", "Phố Cổ", "Hồ Gươm", "Bến Thành", "Sân bay"), quản lý dưới dạng nhãn địa danh liên kết với Property.
4. **Trục 4 — Thời gian lưu trú, Số lượng khách & Phòng trống thực tế:** Lọc cơ sở còn phòng thực tế, thỏa mãn sức chứa tối đa (`MaxOccupancy >= guests`) và đã xuất bản (`IsPublished == true` & `Status == Active`).

---

## 4. Hợp Đồng API Đề Xuất (Proposed API Contracts)

### 4.1. `GET /api/public/properties` (Nâng cấp)
- **Tham số:** `keyword`, `city`, `rentalType`, `checkInDate`, `checkOutDate`, `guests`, `page`, `pageSize`.
- **Phản hồi:** Danh sách phân trang các cơ sở phù hợp kèm thông tin tóm tắt tiện ích, mức giá ước tính thấp nhất (`minPrice`) và số loại phòng còn trống (`availableRoomTypesCount`).

### 4.2. `GET /api/public/destinations` (Mới)
- **Mục đích:** Cung cấp danh sách các Tỉnh/Thành phố hiện có cơ sở hoạt động để nạp vào bộ lọc dropdown trên Frontend.

---

## 5. Lộ Trình Phân Rã Lát Cắt Triển Khai (Implementation Slices Roadmap)

### Phase A: Smallest Implementation Slice (Zero-Schema Migration — Sẵn sàng cho Vòng sau)
- **Ưu tiên tái sử dụng (Reuse-First):** Tận dụng 100% schema và database hiện có, không chạy migration, không import dữ liệu ngoài.
- **Backend:**
  - Bổ sung helper chuẩn hóa tiếng Việt không dấu (`VietnameseTextNormalizer.RemoveDiacritics`).
  - Mở rộng `GetPublicPropertiesQuery` hỗ trợ `keyword`, `city`, bảo vệ `IsPublished == true`.
  - Tạo endpoint `GET /api/public/destinations` lấy danh sách `DISTINCT City` của các cơ sở active/published.
- **Frontend:** Thêm Search Bar, Dropdown chọn Tỉnh/Thành, và Lưới thẻ khách sạn trên `booking.page.ts`.
- **Kiểm thử:** Viết unit test cho Unaccent helper và integration test cho search query.

### Phase B: Enterprise Administrative Hierarchy & Landmark Search (Cần PO Phê duyệt)
- Bổ sung migration schema `Properties` (`ProvinceCode`, `Ward`, `WardCode`, `LandmarkTags`).
- Nạp danh mục hành chính 2 cấp chính thức do PO cung cấp/duyệt.
- Mở rộng tìm kiếm phòng trống tổng hợp (Cross-property real-time availability aggregation).

---

## 6. Các Quyết Định Cần PO Phê Duyệt (PO Gates / NeedsPO)

Hệ thống ghi nhận minh bạch 3 câu hỏi mở tại Mục 7 của [`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md):
1. **PO Gate 1 (Nguồn Dataset Hành chính):** Chốt phương án danh mục Tỉnh/Thành động từ DB hiện có (Phase A) hay bổ sung bảng `AdministrativeUnits` toàn quốc (Phase B).
2. **PO Gate 2 (Mở rộng Schema `Property`):** Phê duyệt kế hoạch migration thêm các cột `ProvinceCode`, `Ward`, `WardCode`, `Landmarks` ở phase sau.
3. **PO Gate 3 (Chiến lược Phòng trống Xuyên Cơ sở):** Bắt buộc khách chọn địa bàn/khách sạn trước khi quét tồn phòng để tối ưu hóa hiệu năng và tránh quá tải DB.

---

## 7. Bàn Giao Thẩm Định Round 1

- Hồ sơ khảo sát và đề xuất hợp đồng hoàn chỉnh: [`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md).
- Trạng thái mã nguồn: **0 dòng mã nguồn nghiệp vụ bị sửa đổi, 0 migration, 0 database mutation**.
- Trạng thái điều phối: Chuyển `task.json` sang `status: "Submitted"`, `writer: "none"`.

Kính chuyển Reviewer (Codex) thẩm định!
