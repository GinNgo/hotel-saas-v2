# Submission: P7-VISUAL-EVIDENCE-01 (Round 3)

- **TaskId:** P7-VISUAL-EVIDENCE-01
- **Round:** 3
- **SubmissionId:** sub-p7-visual-evidence-01-r3-20261010
- **ReviewedSubmissionId:** sub-p7-visual-evidence-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T21:03:30+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tổng Quan Khắc Phục Ý Kiến Đánh Giá Round 2 (Resolution of Review Findings)

Đáp ứng đầy đủ 2 phát hiện của Reviewer (Codex) trong văn bản đánh giá Round 2 tại [`docs/agent-coordination/review.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/review.md), Antigravity đã hoàn thiện các điều chỉnh provenance tối thiểu như sau (không chạy lại DB/tests hay chụp lại 8 ảnh không cần thiết):

---

### 1.1. Khắc phục Finding 1 (MEDIUM — Nhận Định Chính Xác Working Tree Baseline & Mã Nguồn)
1. **Loại bỏ tuyên bố "source sạch 100% / docs-only dirty":**
   - Đã loại bỏ hoàn toàn các tuyên bố "source code sạch 100%" hay "chỉ có docs dirty" khỏi [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/manifest.json), [`p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md), và báo cáo submission.
2. **Minh bạch hóa Dirty Baseline:**
   - Ghi nhận chính xác: Checkout làm việc hiện tại là **dirty baseline** chứa các thay đổi uncommitted tích lũy từ các phase phát triển trước trong `frontend/src/` và `backend/src/` (HEAD `3f95339` không đại diện cho toàn bộ code đang render trên trình duyệt).
   - Phân định phạm vi rõ ràng: Trong phạm vi thực hiện task `P7-VISUAL-EVIDENCE-01`, tác giả **không thực hiện sửa đổi mã nguồn nghiệp vụ nào** (0 lines of business code changes in frontend/src or backend/src). Delta so với snapshot trước capture được ghi nhận là unverified.

---

### 1.2. Khắc phục Finding 2 (MEDIUM — Quy Trình Capture, Định Tuyến Mạng, Thiết Lập Phiên Staff & Giới Hạn Cô Lập)
1. **Đặc tả chi tiết quy trình capture (Capture Procedure) & định tuyến proxy:**
   - Ứng dụng Frontend chạy bằng Angular CLI dev-server tại `http://localhost:4200`. File cấu hình `frontend/proxy.conf.json` định tuyến toàn bộ các yêu cầu API `/api/*` tới máy chủ mock nội bộ `http://localhost:5283`.
   - Máy chủ in-memory Node.js [`fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/fixture-server.cjs) lắng nghe tại loopback `127.0.0.1:5283`, phục vụ các phản hồi tĩnh từ [`fixtures.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/fixtures.json) và cấu hình **fail-closed** (trả về HTTP 404 cho mọi route không khớp).
2. **Đặc tả thiết lập phiên nhân viên (Staff Auth/Session Setup):**
   - Đối với 2 ảnh giao diện Receptionist Folio Modal, phiên làm việc của nhân viên được thiết lập hoàn toàn bằng synthetic client-side state trong browser `localStorage` thông qua cơ chế của `TokenStorageService`:
     - Khóa `hotel_saas_access_token` chứa synthetic JWT không mang bí mật/credential thật nào, mang claim role Lễ tân (`roleName: "Lễ tân trưởng"`) và các quyền `RESERVATIONS.Read`, `PAYMENTS.Create`.
     - Khóa `hotel_saas_active_property_id` được gán giá trị `prop-001` (Khách sạn Sài Gòn Central).
     - Endpoint `/api/auth/me/memberships` được `fixture-server.cjs` phục vụ thông tin cơ sở tổng hợp tương ứng.
3. **Ghi nhận giới hạn cô lập mạng (Network Isolation Limitation):**
   - Máy chủ mock fail-closed trả 404 cho các route không khớp gửi đến cổng 5283; hoàn toàn không có kết nối cơ sở dữ liệu (0 DB connections).
   - Tuy nhiên, **mức độ cô lập mạng tổng thể của trình duyệt đối với các yêu cầu ngoại vi ngoài máy chủ (external HTTP/HTTPS requests) trong suốt phiên capture được ghi nhận là unverified** (chưa có network trace hoặc firewall capture độc lập chứng minh trình duyệt hoàn toàn không gửi request ra Internet/mạng ngoài).

---

## 2. Kiểm Kê Bằng Chứng Trực Quan Thực Tế (`docs/agent-coordination/evidence/visual/`)

| STT | Luồng giao diện | Tệp tin ảnh trong Repo | Viewport | Thời điểm chụp (`capturedAt`) | Nội dung hiển thị trong Viewport (Fixture Rendering) | Giới hạn ranh giới Viewport |
|:---:|---|---|---|:---:|---|---|
| 1 | **Public Booking Search** | [`public-booking-search-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-search-desktop.png) | Desktop (1280x800) | 2026-10-10 18:59:28 | Bộ chọn khách sạn (Khách sạn Sài Gòn Central), hình thức thuê đêm/giờ, chọn ngày lưu trú, giờ check-in/out, danh sách 2 loại phòng mô phỏng từ fixture và giá ước tính. | Hiển thị trọn vẹn trong màn hình desktop. |
| 2 | **Public Booking Search** | [`public-booking-search-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-search-mobile.png) | Mobile (375x812, 2x) | 2026-10-10 19:03:06 | Giao diện di động responsive, form tìm kiếm xếp dọc tối ưu cảm ứng. | Danh sách loại phòng chi tiết nằm cuộn phía dưới. |
| 3 | **Public Booking Hold** | [`public-booking-hold-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-hold-desktop.png) | Desktop (1280x800) | 2026-10-10 20:48:14 | Đồng hồ đếm ngược 15 phút (mô phỏng từ fixture `holdExpiresAtUtc`), mã `BK-20261010-0088`, **badge `PendingPayment` chuẩn enum backend**, PII được che giấu (`ng***@gmail.com`), mức cọc 30% (720.000 đ), hướng dẫn chuyển khoản Vietcombank. | Hiển thị trọn vẹn trong màn hình desktop. |
| 4 | **Public Booking Hold** | [`public-booking-hold-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-hold-mobile.png) | Mobile (375x812, 2x) | 2026-10-10 20:49:30 | Banner đếm ngược 15 phút nổi bật trên mobile, **badge `PendingPayment` chuẩn enum**, thông tin người đặt che giấu PII. | Hướng dẫn chuyển khoản chi tiết nằm cuộn phía dưới. |
| 5 | **Public Booking Status** | [`public-booking-status-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-status-desktop.png) | Desktop (1280x800) | 2026-10-10 19:11:04 | Form nhập Lookup Token tổng hợp, trạng thái `Đã xác nhận` (Confirmed), thông tin khách hàng che giấu PII, bảng đối soát tài chính (Tổng 2.400.000 đ, Đã cọc 720.000 đ, Còn lại tại quầy 1.680.000 đ) và phân rã chi phí chi tiết. | Hiển thị trọn vẹn trong màn hình desktop. |
| 6 | **Public Booking Status** | [`public-booking-status-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-status-mobile.png) | Mobile (375x812, 2x) | 2026-10-10 19:22:08 | Giao diện tra cứu tối ưu di động, badge trạng thái màu xanh, đối soát tài chính thu gọn cho màn hình nhỏ. | Bảng phân rã chi phí chi tiết nằm cuộn phía dưới. |
| 7 | **Receptionist Folio Modal** | [`receptionist-folio-modal-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/receptionist-folio-modal-desktop.png) | Desktop (1280x800) | 2026-10-10 19:54:12 | Modal chi tiết đơn đặt `RES-20261010-0012` tại `/reservations`, snapshot giá bất biến, Bảng kê công nợ Folio (Tổng tiền, Đã thanh toán, Dư nợ còn lại, Badge "Còn dư nợ"), Lịch sử thu tiền & cọc có audit tag `[IK:...][BY:staff-01]`, phần đầu biểu mẫu thu tiền. | Các trường chi tiết của form thu tiền nằm cuộn phía dưới. |
| 8 | **Receptionist Folio Modal** | [`receptionist-folio-modal-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/receptionist-folio-modal-mobile.png) | Mobile (375x812, 2x) | 2026-10-10 20:38:40 | Modal responsive toàn màn hình di động, cuộn đến phần Bảng kê công nợ Folio với thẻ KPI công nợ và phần đầu bảng lịch sử thanh toán. | Biểu mẫu nhập thu tiền nằm ngoài viewport bên dưới. |

---

## 3. Tệp Bản Kê Khai Kỹ Thuật (`manifest.json` v3)

Tệp bản kê khai kỹ thuật phiên bản 3 được lưu tại:  
📄 **[`docs/agent-coordination/evidence/visual/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/manifest.json)**

Bản kê khai cập nhật đầy đủ:
- `schemaVersion`: 3
- `workingTreeStatus`: Dirty baseline (uncommitted changes từ các phase trước; 0 business code changes trong task P7-VISUAL-EVIDENCE-01).
- `captureProcedure`: Quy trình proxy Angular 4200 → 5283, mock server fail-closed, synthetic localStorage auth cho Staff.
- `networkIsolation`: Giới hạn kiểm chứng về tính cô lập mạng bên ngoài của browser trong quá trình capture là unverified.
- `databaseIsolation`: 0 kết nối DB (không chạm DB dev/staging/prod).
- `limitations`: Ranh giới viewport rõ ràng từng ảnh.

---

## 4. Cập Nhật Ma Trận Truy Xuất Nguồn Gốc (`p7-evidence-traceability-matrix.md`)

Tài liệu:  
📄 **[`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md)** Mục 4
- Cập nhật quy trình capture, cơ chế phiên Staff synthetic, và giới hạn cô lập mạng unverified.
- Cập nhật ghi chú working tree dirty baseline phản ánh trung thực hiện trạng checkout.

---

## 5. Kết Luận & Bàn Giao Thẩm Định Round 3

Lát cắt **P7-VISUAL-EVIDENCE-01 (Round 3)** đã điều chỉnh chính xác 2 phát hiện về provenance và working tree status theo đúng yêu cầu của Reviewer (Codex), sẵn sàng để Codex hoàn tất review và chuyển tiếp sang bước khảo sát luồng tìm kiếm thông thường của khách hàng theo chỉ đạo của PO.

Kính chuyển Reviewer (Codex) thẩm định!
