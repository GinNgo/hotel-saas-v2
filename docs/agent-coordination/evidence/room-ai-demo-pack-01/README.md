# Gói Tài Sản Minh Họa AI Phòng Nghỉ — ROOM-AI-DEMO-PACK-01
# (Offline AI Room Demo Package & Durable Manifest)

- **Gói bằng chứng (Package Location):** `docs/agent-coordination/evidence/room-ai-demo-pack-01/`
- **Nhiệm vụ liên quan:** `ROOM-AI-DEMO-PACK-01`
- **Phiên bản:** Round 2 (Bàn giao bền vững - Durable Package Handoff)
- **Tệp trưng bày thị giác (Contact Sheet):** [`gallery.html`](gallery.html)
- **Mã nguồn dữ liệu hạt giống (Seed Reference):** `backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs` (dòng 668–683)

---

## 1. Mục Đích & Phạm Vi Gói Tài Sản (Package Purpose & Scope)

Gói tài sản này là một tập hợp bằng chứng độc lập, tự chứa (self-contained), được chuẩn bị để trưng bày và thẩm định kỹ thuật ngoại tuyến (offline) cho 4 loại phòng của hệ thống khách sạn, tuân thủ nghiêm ngặt các nguyên tắc:

1. **Độc lập hoàn toàn khỏi tài sản cũ chưa có bản quyền:**
   - Không chứa bất kỳ tệp ảnh nào trong số 33 tài sản từ kho lưu trữ cũ (`He-thong-quan-ly-khach-san`). Toàn bộ 33 tài sản cũ tiếp tục bị cách ly tại `evidence/legacy-room-assets-01/` do giấy phép bản quyền trên toàn repo chưa được xác minh (`Rights NOT VERIFIED / QUARANTINED`).
2. **Ảnh minh họa AI tổng hợp (Synthetic Illustrative Mocks):**
   - Sử dụng 4 tệp ảnh định dạng PNG độ phân giải cao được sinh qua công cụ AI cục bộ nhằm minh họa cho 4 loại phòng khác nhau.
   - **Tuyên bố minh bạch:** Toàn bộ ảnh là sản phẩm đồ họa mô phỏng, không phải ảnh chụp thực tế của bất kỳ phòng ốc hay cơ sở khách sạn ngoài đời.
3. **Cô lập kỹ thuật (Zero Production Impact):**
   - Gói tài sản chỉ lưu trữ trong thư mục bằng chứng điều phối.
   - Không sao chép vào `frontend/src/assets` sản xuất.
   - Không tạo migration hay chèn dữ liệu vào cơ sở dữ liệu (No DB seeding).

---

## 2. Bảng Kê Toàn Bộ 4 Tài Sản & Dữ Liệu Seeder Xác Minh (Full Manifest & Seed Facts)

| Tệp Hình Ảnh | Kích Thước | Mã Băm SHA-256 (Tệp Nhị Phân) | Cơ Sở Mục Tiêu | Mã Phòng | Tên Loại Phòng (Seed) | Giá Cơ Sở Demo (Seed) | Sức Chứa (Seed) | Phòng Gán Trong Seed |
|---|:---:|---|---|:---:|---|:---:|:---:|---|
| `ai-illustrative-deluxe-double-q1.png` | 763,542 B | `C4EA851FE57DE4319C37EF2E95503DC27F6C1139C12C535D7C3971E3AEED09C3` | Grand Hotel Sài Gòn (`CN-Q1`) | `DLX-Q1` | `Deluxe Double (Q1)` | 1.200.000 VNĐ | 2 người | Phòng 101 (T1, Clean)<br>Phòng 201 (T2, Clean) |
| `ai-illustrative-standard-twin-q1.png` | 710,887 B | `01F8F513B3CC9F9D45967793E5C3B5BFBD5218BD6E1C6CF891AFCFE87EC58FF1` | Grand Hotel Sài Gòn (`CN-Q1`) | `STD-Q1` | `Standard Twin (Q1)` | 800.000 VNĐ | 2 người | Phòng 102 (T1, Dirty) |
| `ai-illustrative-executive-suite-pn.png` | 782,929 B | `AECC2B853A3FE3A3C088F117A709114FEFC91CB0EFC940C96CFE5CDBEA08938C` | Grand Hotel Phú Nhuận (`CN-PN`) | `SUI-PN` | `Executive Suite (PN)` | 2.000.000 VNĐ | 3 người | Phòng 301 (T3, Clean)<br>Phòng 401 (T4, Clean) |
| `ai-illustrative-superior-king-pn.png` | 764,526 B | `F5E5AEF3C4F6573C4898696A570185670B0DC07934A6453DC459D60AA0C2DA10` | Grand Hotel Phú Nhuận (`CN-PN`) | `SUP-PN` | `Superior King (PN)` | 1.000.000 VNĐ | 2 người | Phòng 302 (T3, Cleaning) |

---

## 3. Các Yếu Tố Chưa Xác Minh & Giới Hạn Nghiệp Vụ (Unknown Facts & Honesty Disclaimers)

1. **Quy ước sức chứa vs Chỗ ngủ thực tế:**
   - Trường `MaxOccupancy = 3` của phòng `SUI-PN` là một quy ước số liệu kiểm thử trong seeder.
   - Bức ảnh `ai-illustrative-executive-suite-pn.png` hiển thị một bố cục phòng Suite minh họa với khu sofa và giường ngủ lớn. **Sự đầy đủ của chỗ ngủ thứ 3 (như tính năng gập mở thành giường của ghế sofa) là HOÀN TOÀN CHƯA ĐƯỢC XÁC MINH (NOT VERIFIED)**.
2. **Kích thước giường & Tiện nghi phòng:**
   - Kích thước đệm (King/Queen/Twin), loại đệm, số lượng gối, thiết bị vệ sinh, tiện nghi minibar/TV, diện tích m² và sơ đồ phòng là **CHƯA CÓ TRONG SEED / CHƯA XÁC MINH (UNKNOWN / NOT IN SEED)**.
3. **Cảnh quan & Tính hiện hữu của phòng thực:**
   - Cảnh quan thành phố (nắng sớm Q1 hay hoàng hôn Phú Nhuận) ngoài cửa kính là cảnh giả lập do AI tạo dựng.
   - Không khẳng định các bức ảnh này chụp tại cùng một căn phòng hay mô tả bất kỳ phòng vật lý nào tại số 123 Lê Lợi hay 456 Phan Xích Long.
4. **Giá cả & Tình trạng phòng:**
   - Mức giá (800.000đ – 2.000.000đ) và trạng thái phòng (`Clean`, `Dirty`, `Cleaning`) là dữ liệu seed cho môi trường phát triển cục bộ, không đại diện cho giá niêm yết thương mại hay tồn phòng thực tế.

---

## 4. Nguồn Gốc Sinh Ảnh & Tình Trạng Bản Quyền (Provenance & Rights Status)

- **Trạng thái nguồn gốc:** `WRITER-REPORTED / SYNTHETIC LOCAL GENERATION (NOT INDEPENDENTLY AUTHENTICATED)`.
- **Thông số kỹ thuật:**
  - Inference endpoint: `http://localhost:20128/v1/images/generations` (Proxy cục bộ).
  - Model: `ag/gemini-3.1-flash-image`.
  - Thời điểm tạo tệp: `2026-10-12T08:54:49Z`.
  - Tham số: `n=1, size="auto", quality="auto"`.
- **Tình trạng bản quyền (Rights & Production Use Status):**
  - **Quyền sử dụng thương mại / quyền phân phối: CHƯA ĐƯỢC XÁC MINH (NOT VERIFIED).**
  - Không tuyên bố quyền sở hữu độc quyền hay bản quyền tác giả đối với các hình ảnh do AI sinh ra.
  - Các tệp này được sử dụng thuần túy như tư liệu minh họa ý niệm (Illustrative Mocks) trong nội bộ nhóm phát triển.

---

## 5. Hướng Dẫn Tích Hợp Tương Lai (Future Integration Guidance)

Khi Product Owner (PO) phê duyệt đưa hình ảnh minh họa vào giao diện thử nghiệm:

1. **Vị trí tệp đề xuất:**
   - Frontend tĩnh: `frontend/src/assets/demo-rooms/` (tách riêng khỏi assets giao diện chính).
   - Dịch vụ đám mây (S3/Cloud Storage): `/public/demo-assets/rooms/`.
2. **Gắn nhãn giao diện bắt buộc (Mandatory UI Badging):**
   - Mọi nơi hiển thị 4 bức ảnh này trên Web/App phải kèm nhãn phụ trợ hoặc watermark: `"Ảnh minh họa AI / AI Illustrative Mock"`.
   - Tuyệt đối không được quảng bá như ảnh chụp thực tế của cơ sở khách sạn khi phục vụ khách hàng thật.
3. **Ranh giới hiện tại:**
   - Không import vào `src/assets` sản xuất.
   - Không tích hợp vào database sản xuất.
