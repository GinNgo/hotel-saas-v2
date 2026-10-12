# Submission ROOM-AI-DEMO-PACK-01 — Round 2

- **TaskId:** `ROOM-AI-DEMO-PACK-01`
- **Round:** 2
- **SubmissionId:** `sub-room-ai-demo-pack-01-r2-20261012`
- **ReviewedSubmissionId:** `sub-room-ai-demo-pack-01-r1-20261012`
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** `2026-10-12T19:25:00+07:00` (UTC: `2026-10-12T12:25:00Z` — Đồng hồ cục bộ, không xác thực độc lập)
- **Actor:** `antigravity`
- **ConversationId:** `b24752d6-e881-4372-b79e-186db67e5233`
- **Status:** `Submitted`

---

## 1. Khắc Phục Ý Kiến Đánh Giá Vòng 1 (Resolution of Round 1 Findings)

Báo cáo Vòng 2 giải quyết toàn diện 3 điểm lưu ý từ nhận xét của Codex Reviewer (`review.md`):

1. **Khắc phục [P2] — Loại bỏ suy diễn về sức chứa vật lý cho 3 người và kích thước giường thực tế:**
   - Trong thẻ phòng Executive Suite (`gallery.html` dòng 411) và báo cáo, đã loại bỏ hoàn toàn nhận định suy diễn cho rằng không gian phòng "đủ cho 3 người lưu trú".
   - **Xác định ranh giới chuẩn xác:** `MaxOccupancy = 3` là quy ước số liệu kiểm thử từ mã nguồn seed (`LocalDevDataSeeder.cs`). Bức ảnh tổng hợp AI chỉ mô tả bố cục phòng khách suite minh họa; **sự đầy đủ của chỗ ngủ thứ 3 (như tính năng gập mở thành giường của sofa) là HOÀN TOÀN CHƯA ĐƯỢC XÁC MINH (NOT VERIFIED)**.
   - Toàn bộ các thẻ phòng khác cũng được cập nhật để tránh mọi khẳng định về kích thước giường đo đạc thực tế hay tính phù hợp phòng thực (kích thước nệm thực tế đánh dấu rõ `NOT VERIFIED`).

2. **Khắc phục [P2] — Bổ sung tài liệu bền vững `README.md` trực tiếp vào gói bằng chứng:**
   - Đã tạo tệp tài liệu bền vững tự chứa [`docs/agent-coordination/evidence/room-ai-demo-pack-01/README.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/room-ai-demo-pack-01/README.md) ngay trong gói bằng chứng để đảm bảo khả năng bàn giao lâu dài không bị phụ thuộc vào tệp tạm thời `submission.md`.
   - `README.md` cung cấp đầy đủ: bảng kê đường dẫn, kích thước byte, mã băm SHA-256, đối chiếu dữ liệu seeder nguồn, các yếu tố chưa xác minh (unknown facts), giới hạn pháp lý (rights limitations), và hướng dẫn tích hợp tương lai.
   - Đã bổ sung liên kết hai chiều từ [`gallery.html`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/room-ai-demo-pack-01/gallery.html) tới `README.md` (tại thanh tiêu đề và chân trang).

3. **Khắc phục [P2] — Loại bỏ tuyên bố bản quyền/quyền sở hữu không có căn cứ:**
   - Đã loại bỏ hoàn toàn câu chữ khẳng định quyền sở hữu bản quyền tác giả (`© 2026 Hotel SaaS System...`) tại chân trang `gallery.html` (dòng 477).
   - **Ghi nhận minh bạch:** Nguồn gốc ảnh là `Writer-reported` qua công cụ sinh ảnh AI cục bộ (`gemini-3.1-flash-image`). Quyền sở hữu độc quyền cũng như quyền phân phối sản xuất **CHƯA ĐƯỢC XÁC MINH (Rights/Production-use NOT VERIFIED)**. Ảnh chỉ được sử dụng thuần túy làm tài liệu minh họa ý niệm trong thư mục bằng chứng.

---

## 2. Bảng Kê Toàn Bộ Gói Bằng Chứng (Durable Evidence Package Manifest)

Toàn bộ gói bằng chứng tại thư mục [`docs/agent-coordination/evidence/room-ai-demo-pack-01/`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/room-ai-demo-pack-01/) bao gồm 6 tệp tự chứa hoàn chỉnh:

| STT | Tên Tệp Bằng Chứng | Loại Tệp | Dung Lượng | Mã Băm SHA-256 (Tệp Nhị Phân) | Vai Trò & Đối Tượng Ánh Xạ |
|:---:|---|:---:|:---:|---|---|
| 1 | `README.md` | Markdown | 6,979 B | `AB52535CF8C8FA003C1C9DEF0DD67E246CD8CD6C3DB4FBA1099134ACFAD8D425` | Tài liệu bàn giao bền vững, bảng kê chi tiết và hướng dẫn tích hợp. |
| 2 | `gallery.html` | HTML | 20,593 B | `AB859D5AF58043107C3F91C29061EE67FB62795F4FB327BEA473D3BBF9A6CB96` | Trang trưng bày Contact Sheet offline, nhãn AI rõ ràng, không script/CDN ngoài. |
| 3 | `ai-illustrative-deluxe-double-q1.png` | PNG | 763,542 B | `C4EA851FE57DE4319C37EF2E95503DC27F6C1139C12C535D7C3971E3AEED09C3` | Minh họa phòng `DLX-Q1` (Deluxe Double Q1 - Grand Hotel Sài Gòn). |
| 4 | `ai-illustrative-standard-twin-q1.png` | PNG | 710,887 B | `01F8F513B3CC9F9D45967793E5C3B5BFBD5218BD6E1C6CF891AFCFE87EC58FF1` | Minh họa phòng `STD-Q1` (Standard Twin Q1 - Grand Hotel Sài Gòn). |
| 5 | `ai-illustrative-executive-suite-pn.png` | PNG | 782,929 B | `AECC2B853A3FE3A3C088F117A709114FEFC91CB0EFC940C96CFE5CDBEA08938C` | Minh họa phòng `SUI-PN` (Executive Suite PN - Grand Hotel Phú Nhuận). |
| 6 | `ai-illustrative-superior-king-pn.png` | PNG | 764,526 B | `F5E5AEF3C4F6573C4898696A570185670B0DC07934A6453DC459D60AA0C2DA10` | Minh họa phòng `SUP-PN` (Superior King PN - Grand Hotel Phú Nhuận). |

---

## 3. Ma Trận Dữ Liệu Seeder Nguồn & Giới Hạn Xác Thực Thực Tế

Trích xuất trực tiếp từ mã nguồn C# [`LocalDevDataSeeder.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Persistence/LocalDevDataSeeder.cs#L668-L683):

| Cơ Sở | Mã Phòng | Tên Loại Phòng (Seed) | Giá Demo (Seed) | Sức Chứa (Seed) | Phòng Gán Trong Seed | Bố Cục Thị Giác Quan Sát Được | Đánh Giá Chỗ Ngủ & Yếu Tố Chưa Xác Minh |
|---|:---:|---|:---:|:---:|---|---|---|
| **CN-Q1** | `DLX-Q1` | `Deluxe Double (Q1)` | 1.200.000 đ | 2 | Phòng 101 (T1, Clean)<br>Phòng 201 (T2, Clean) | 1 Giường đôi lớn, 2 tab, cửa kính lớn đón nắng sớm. | **Bố cục 1 giường đôi minh họa**. Sức chứa 2 người theo seed; kích thước đệm đo đạc thực tế là **NOT VERIFIED**. View phố là hư cấu AI. |
| **CN-Q1** | `STD-Q1` | `Standard Twin (Q1)` | 800.000 đ | 2 | Phòng 102 (T1, Dirty) | 2 Giường đơn tách biệt, lối đi ở giữa, đèn đọc sách. | **Bố cục 2 giường đơn minh họa**. Sức chứa 2 người theo seed; kích thước giường đơn thực tế là **NOT VERIFIED**. Decor là hư cấu AI. |
| **CN-PN** | `SUI-PN` | `Executive Suite (PN)` | 2.000.000 đ | 3 | Phòng 301 (T3, Clean)<br>Phòng 401 (T4, Clean) | Không gian tiếp khách với sofa lớn, giường ngủ phía sau. | **Bố cục suite minh họa**. Sức chứa 3 người là quy ước seed; sự đầy đủ của chỗ ngủ thứ 3 là **NOT VERIFIED**. View hoàng hôn là hư cấu AI. |
| **CN-PN** | `SUP-PN` | `Superior King (PN)` | 1.000.000 đ | 2 | Phòng 302 (T3, Cleaning) | 1 Giường nệm lớn ấm cúng, ốp đầu giường gỗ, ghế bành. | **Bố cục 1 giường lớn minh họa**. Sức chứa 2 người theo seed; kích thước nệm King thực tế là **NOT VERIFIED**. Nội thất là hư cấu AI. |

---

## 4. Hướng Dẫn Tích Hợp Tương Lai & Ràng Buộc Pháp Lý (Future Integration Guidance)

1. **Vị trí đề xuất khi được PO chấp thuận đưa vào mã nguồn:**
   - Thư mục tĩnh frontend: `frontend/src/assets/demo-rooms/` (tách riêng khỏi assets giao diện).
   - Lưu trữ đám mây: `/public/demo-assets/rooms/`.
2. **Quy tắc hiển thị giao diện:**
   - Bắt buộc gắn watermark hoặc badge phụ trợ: `"Ảnh minh họa AI / AI Illustrative Mock"`.
   - Không được trình bày như ảnh chụp thực tế của cơ sở khách sạn.
3. **Ranh giới hiện tại:**
   - Không copy vào `src/assets` sản xuất trong lát cắt này.
   - Không seed vào database.

---

## 5. Ranh Giới Kỹ Thuật & Bảo Toàn 7 Cổng Quyết Định Của PO

1. **Cam kết tuân thủ ranh giới:**
   - **Zero C# backend changes:** Không can thiệp bất kỳ tệp C# nào.
   - **Zero DB migrations/DML:** Không tạo migration, không chạy DML.
   - **Zero Teammate domain modifications:** Không sửa đổi module của Nguyên (`Rooms`, `RoomTypes`) và Tân (`Housekeeping`).
   - Không thêm dependencies mới hay thư viện mạng runtime/CDN.
2. **Bảo lưu nguyên vẹn 7 Cổng Quyết Định Của PO (`decisions.md`):**
   - 7 cổng nghiệp vụ (D21 lookup TTL, Quote hold/pinning, Search API contract, Publication policy, Nguồn dữ liệu hành chính VN, Kế hoạch migration địa bàn, Cơ chế kiểm tra tồn phòng xuyên cơ sở) tiếp tục ở trạng thái `NeedsPO`.
   - Giai đoạn 6 (Phase 6 - AI) chưa mở.