# Submission ROOM-AI-DEMO-PACK-01 — Round 1

- **TaskId:** `ROOM-AI-DEMO-PACK-01`
- **Round:** 1
- **SubmissionId:** `sub-room-ai-demo-pack-01-r1-20261012`
- **ReviewedSubmissionId:** `sub-legacy-room-assets-01-r3-20261012`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-12T18:45:00+07:00` (UTC: `2026-10-12T11:45:00Z` — Đồng hồ cục bộ, không xác thực độc lập)
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Tổng Quan Gói Bằng Chứng Phòng Minh Họa AI Độc Lập (Package Overview)

Nhiệm vụ `ROOM-AI-DEMO-PACK-01` thực hiện chuẩn bị bộ trưng bày hình ảnh phòng minh họa AI độc lập (Offline AI Demo Package) phục vụ đối chiếu nghiệp vụ và thẩm định demo theo đúng chỉ đạo của PO và bàn giao từ Codex Reviewer:

1. **Loại bỏ hoàn toàn tài sản cũ chưa đủ bản quyền:**
   - Không sử dụng bất kỳ tệp ảnh nào trong số 33 tài sản trích xuất từ kho cũ (`He-thong-quan-ly-khach-san`) do tình trạng bản quyền toàn repo chưa được xác minh (vắng mặt LICENSE). Toàn bộ 33 ảnh cũ tiếp tục được giữ nguyên trạng thái cách ly (`QUARANTINED / REFERENCE ONLY`).
2. **Sử dụng 4 ảnh minh họa AI độc lập:**
   - Sử dụng 4 tệp ảnh minh họa đồ họa photorealistic đã được nghiệm thu scoped evidence trong nhiệm vụ `LEGACY-ROOM-ASSETS-01`:
     - `ai-illustrative-deluxe-double-q1.png`
     - `ai-illustrative-standard-twin-q1.png`
     - `ai-illustrative-executive-suite-pn.png`
     - `ai-illustrative-superior-king-pn.png`
3. **Bộ trưng bày Contact Sheet Offline (`gallery.html`):**
   - Đã tạo trang trưng bày tự chứa (standalone, không phụ thuộc CDN hay mạng bên ngoài) tại:
     [`docs/agent-coordination/evidence/room-ai-demo-pack-01/gallery.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/room-ai-demo-pack-01/gallery.html).
   - Mỗi thẻ phòng (card) hiển thị đầy đủ: nhãn bắt buộc `[AI MINH HỌA - KHÔNG PHẢI ẢNH THẬT]`, bảng đối chiếu dữ liệu Seeder thực tế, báo cáo kiểm tra thị giác, và cảnh báo rủi ro về góc nhìn/nội thất giả định.

---

## 2. Bảng Kê 4 Tài Sản & Ánh Xạ Dữ Liệu Seeder Thực Tế (Source Manifest & Seed Mapping)

> **Căn cứ dữ liệu nguồn:** Các trường dữ liệu phòng và cơ sở được trích xuất trực tiếp từ mã nguồn C# [`LocalDevDataSeeder.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs#L668-L683). Toàn bộ giá cả và trạng thái là quy ước kiểm thử môi trường phát triển (demo mock), không phản ánh giá thương mại hay tình trạng phòng thực tế.

| STT | Tệp Bằng Chứng | Kích Thước | SHA256 (Tệp nhị phân) | Cơ Sở Lưu Trú | Mã Loại Phòng | Tên Loại Phòng (Seed) | Giá Cơ Sở Demo (Seed) | Sức Chứa (Seed) | Phòng Gán Trong Seed (Tầng / Trạng Thái) | Thuộc Tính Ngoài Seed (Giường / View / Tiện Nghi) |
|:---:|---|:---:|---|---|:---:|---|:---:|:---:|---|---|
| 1 | `ai-illustrative-deluxe-double-q1.png` | 763,542 B | `C4EA851FE57DE4319C37EF2E95503DC27F6C1139C12C535D7C3971E3AEED09C3` | Grand Hotel Sài Gòn (`CN-Q1`) | `DLX-Q1` | `Deluxe Double (Q1)` | 1.200.000 VNĐ | 2 người | Phòng 101 (T1, Clean)<br>Phòng 201 (T2, Clean) | **UNKNOWN / NOT IN SEED**<br>(Kích thước đệm, view, diện tích chưa có) |
| 2 | `ai-illustrative-standard-twin-q1.png` | 710,887 B | `01F8F513B3CC9F9D45967793E5C3B5BFBD5218BD6E1C6CF891AFCFE87EC58FF1` | Grand Hotel Sài Gòn (`CN-Q1`) | `STD-Q1` | `Standard Twin (Q1)` | 800.000 VNĐ | 2 người | Phòng 102 (T1, Dirty) | **UNKNOWN / NOT IN SEED**<br>(Kích thước giường đơn, tiện nghi chưa có) |
| 3 | `ai-illustrative-executive-suite-pn.png` | 782,929 B | `AECC2B853A3FE3A3C088F117A709114FEFC91CB0EFC940C96CFE5CDBEA08938C` | Grand Hotel Phú Nhuận (`CN-PN`) | `SUI-PN` | `Executive Suite (PN)` | 2.000.000 VNĐ | 3 người | Phòng 301 (T3, Clean)<br>Phòng 401 (T4, Clean) | **UNKNOWN / NOT IN SEED**<br>(Sofa bed, ban công, diện tích chưa có) |
| 4 | `ai-illustrative-superior-king-pn.png` | 764,526 B | `F5E5AEF3C4F6573C4898696A570185670B0DC07934A6453DC459D60AA0C2DA10` | Grand Hotel Phú Nhuận (`CN-PN`) | `SUP-PN` | `Superior King (PN)` | 1.000.000 VNĐ | 2 người | Phòng 302 (T3, Cleaning) | **UNKNOWN / NOT IN SEED**<br>(Kích thước nệm King, view chưa có) |

- **Tình trạng xác thực nguồn gốc sinh ảnh (Provenance Status):** `WRITER-REPORTED / SYNTHETIC LOCAL GENERATION (NOT INDEPENDENTLY AUTHENTICATED)`.
- **Thông tin engine sinh ảnh:** Local proxy `http://localhost:20128/v1/images/generations` với model `ag/gemini-3.1-flash-image` (thực thi lúc `2026-10-12T08:54:49Z`). Không có chữ ký số bên thứ ba; dữ liệu xác thực dựa trên nhật ký tiến trình cục bộ và mã băm nhị phân đã kiểm chứng.

---

## 3. Khảo Sát Bố Cục Thị Giác & Kiểm Tra Giường Thực Tế (Visual Layout & Bed Audit)

Mỗi bức ảnh đã được kiểm tra thực tế từng chi tiết thị giác đối chiếu với định nghĩa loại phòng trong hệ thống:

### 3.1. Loại phòng `DLX-Q1` (`ai-illustrative-deluxe-double-q1.png`)
- **Khảo sát thị giác:** Ảnh hiển thị 1 giường đôi lớn với đệm dày và bộ chăn ga trắng tinh, 2 tab đầu giường cân xứng, cửa sổ kính chạm sàn hướng ra khung cảnh đô thị tràn ngập ánh nắng sớm, bàn ghế làm việc và sàn gỗ hiện đại.
- **Mức độ tương thích:** Hoàn toàn phù hợp với ý niệm phòng đôi cao cấp (Deluxe Double) dành cho 2 khách (`MaxOccupancy = 2`).
- **Ghi nhận Mismatch / Rủi ro:** Khung cảnh nhà cao tầng bên ngoài cửa sổ là cảnh giả lập do AI tạo dựng, không phải góc nhìn thực tế từ cơ sở số 123 Lê Lợi, Bến Nghé, Quận 1.
- **Thuộc tính Unknown:** Kích thước nệm cụ thể (1.6m hay 1.8m), tiện nghi minibar, buồng tắm đứng/bồn tắm nằm.

### 3.2. Loại phòng `STD-Q1` (`ai-illustrative-standard-twin-q1.png`)
- **Khảo sát thị giác:** Ảnh hiển thị chính xác **2 giường đơn tách biệt hoàn toàn** với lối đi ở giữa, đầu giường gắn đèn đọc sách riêng, ánh sáng ban ngày tự nhiên, thiết kế tối giản, sạch sẽ.
- **Mức độ tương thích:** Hoàn toàn phù hợp với ý niệm phòng 2 giường đơn (Standard Twin) dành cho 2 khách (`MaxOccupancy = 2`). Không gặp lỗi AI vẽ nhầm thành 1 giường lớn.
- **Ghi nhận Mismatch / Rủi ro:** Không có lỗi sai lệch số lượng giường. Toàn bộ họa tiết tường và đồ decor là thiết kế hư cấu.
- **Thuộc tính Unknown:** Kích thước chính xác từng giường đơn (1m x 2m hay 1.2m x 2m), diện tích phòng.

### 3.3. Loại phòng `SUI-PN` (`ai-illustrative-executive-suite-pn.png`)
- **Khảo sát thị giác:** Ảnh hiển thị không gian mở phong cách Suite: tiền cảnh là khu vực tiếp khách sang trọng với ghế sofa nhung lớn, bàn trà; hậu cảnh là khu vực giường ngủ lớn; cửa kính nhìn ra toàn cảnh hoàng hôn.
- **Mức độ tương thích:** Phù hợp với ý niệm phòng Suite tiếp khách, sức chứa 3 khách (`MaxOccupancy = 3`).
- **Ghi nhận Mismatch / Rủi ro:** Chưa thể xác minh ghế sofa trong ảnh có cơ chế gập mở thành giường phụ (sofa bed) hay không (database seed không có trường mô tả này). Cảnh quan hoàng hôn là hình ảnh AI, không phải view từ đường Phan Xích Long, Phú Nhuận.
- **Thuộc tính Unknown:** Số lượng phòng tắm, phân tách vách ngăn phòng ngủ và phòng khách, tiện nghi bếp/bar.

### 3.4. Loại phòng `SUP-PN` (`ai-illustrative-superior-king-pn.png`)
- **Khảo sát thị giác:** Ảnh hiển thị 1 giường ngủ đệm lớn với đầu giường ốp gỗ cao cấp, đèn hắt tường nghệ thuật, ghế bành thư giãn bên góc phòng, ánh sáng tự nhiên ấm cúng.
- **Mức độ tương thích:** Phù hợp với ý niệm phòng Superior 1 giường King cho 2 khách (`MaxOccupancy = 2`).
- **Ghi nhận Mismatch / Rủi ro:** Bố cục và đồ gỗ là giả định đồ họa, không tương ứng với trang thiết bị thực tế của bất kỳ phòng nào.
- **Thuộc tính Unknown:** Kích thước giường King (1.8m x 2m hay 2m x 2.2m), ban công, hướng nhìn.

---

## 4. Hướng Dẫn Vị Trí Lưu Trữ Tương Lai & Ràng Buộc Pháp Lý (Future Integration Guidance)

Nhằm chuẩn bị cho bước triển khai tương lai (khi PO phê duyệt đưa ảnh vào giao diện), tài liệu này xác lập quy tắc tích hợp rõ ràng:

1. **Đề xuất vị trí lưu trữ khi tích hợp vào mã nguồn sản xuất:**
   - Nếu lưu trữ nội bộ frontend: Đề xuất thư mục riêng biệt `frontend/src/assets/demo-rooms/` (tách biệt khỏi các assets tĩnh hệ thống).
   - Nếu triển khai qua dịch vụ lưu trữ đám mây (Cloud Storage/S3/MinIO): Đề xuất đặt dưới bucket tiền tố `/public/demo-assets/rooms/`.
2. **Quy tắc gắn nhãn hiển thị bắt buộc (Watermark & UI Badging):**
   - Trên mọi giao diện người dùng (Thẻ loại phòng, Chi tiết phòng, Popup đặt phòng), nếu sử dụng 4 ảnh này, **bắt buộc** phải hiển thị nhãn phụ trợ hoặc watermark: `"Ảnh minh họa AI / AI Illustrative Mock"`.
   - Không được trình bày các ảnh này như ảnh chụp thực tế của cơ sở khách sạn khi cung cấp dịch vụ thương mại cho khách hàng thật.
3. **Ràng buộc phạm vi tuyệt đối trong lát cắt hiện hành:**
   - **Không sao chép vào frontend sản xuất:** Không copy các tệp này vào `frontend/src/assets` trong lát cắt này.
   - **Không chèn vào cơ sở dữ liệu (No DB Seeding):** Không tạo migration hay chèn URL ảnh vào database dev/staging/prod.
   - Toàn bộ tệp ảnh được cô lập tại: [`docs/agent-coordination/evidence/room-ai-demo-pack-01/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/room-ai-demo-pack-01/).

---

## 5. Ranh Giới Kỹ Thuật & Bảo Toàn 7 Cổng Quyết Định Của PO

1. **Cam kết tuân thủ ranh giới mã nguồn:**
   - **Zero C# changes:** Không can thiệp bất kỳ tệp mã nguồn backend C# nào.
   - **Zero DB migrations/DML:** Không tạo migration, không thực thi DML lên cơ sở dữ liệu.
   - **Zero Teammate domain modifications:** Không sửa đổi các module thuộc quyền sở hữu của Nguyên (`Rooms`, `RoomTypes`) và Tân (`Housekeeping`).
   - Không thêm bất kỳ thư viện ngoài (dependencies) hay kết nối mạng runtime/CDN mới nào.
2. **Bảo lưu nguyên vẹn 7 Cổng Quyết Định Của PO (`decisions.md`):**
   - Cả 7 cổng kiến trúc/nghiệp vụ (D21 lookup TTL, Quote hold/pinning, Search API contract, Publication policy, Nguồn dữ liệu hành chính VN, Kế hoạch migration địa bàn, Cơ chế kiểm tra tồn phòng xuyên cơ sở) tiếp tục được bảo toàn ở trạng thái `NeedsPO`.
   - Giai đoạn 6 (Phase 6 - AI) chưa mở.