# Submission: P7-VISUAL-EVIDENCE-01 (Round 1)

- **TaskId:** P7-VISUAL-EVIDENCE-01
- **Round:** 1
- **SubmissionId:** sub-p7-visual-evidence-01-r1-20261010
- **ReviewedSubmissionId:** sub-p7-repro-evidence-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T20:42:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Mục Tiêu & Phạm Vi Lát Cắt (Scope & Objective)

Thực hiện nhiệm vụ **P7-VISUAL-EVIDENCE-01** (Round 1) theo điều phối của PO và Reviewer trong `docs/agent-coordination/review.md` và `docs/agent-coordination/assignment.md`:
- Thu thập và lưu trữ đầy đủ **8 ảnh chụp màn hình trình duyệt thực tế (Real Browser Screenshots)** cho cả 4 luồng giao diện còn thiếu:
  1. **Public Booking Search Page (`/booking`):** Desktop (1280x800) & Mobile (375x812).
  2. **Public Booking Hold Instructions Page (`/booking/hold/:token`):** Desktop (1280x800) & Mobile (375x812).
  3. **Public Booking Status Lookup Page (`/booking/status/:token`):** Desktop (1280x800) & Mobile (375x812).
  4. **Receptionist Folio Statement Modal (`/reservations`):** Desktop (1280x800) & Mobile (375x812).
- Tạo tệp đặc tả chi tiết [`docs/agent-coordination/evidence/visual/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/manifest.json) ghi nhận đầy đủ route, viewport, timestamp, actor, git checkout/commit và nguồn gốc dữ liệu (data provenance).
- Cập nhật tài liệu [`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md) Mục 4, xóa bỏ các khoảng trống "❌ Chưa có ảnh chụp" và thay bằng bảng kiểm kê bằng chứng trực quan thực tế.

---

## 2. Nguồn Gốc Dữ Liệu & Tuân Thủ An Toàn (Data Provenance & Safety Guardrails)

Tuân thủ nghiêm ngặt chỉ đạo của PO và Reviewer:
1. **Cô lập môi trường & Zero Database Access:**
   - Ứng dụng frontend Angular chạy trên máy chủ cục bộ (`http://localhost:4200`).
   - Dữ liệu API được cung cấp thông qua **Browser fixture responses** từ máy chủ Node.js in-memory mock server tại cổng 5283 khớp 100% contracts API của hệ thống.
   - **Hoàn toàn không kết nối cơ sở dữ liệu** (zero database connections); không kết nối vào database `hotel_saas_dev`, staging hoặc production.
   - **Không sửa đổi bất kỳ dòng mã nguồn nào** của frontend (`frontend/src/`) hay backend (`backend/src/`).
2. **Bảo vệ PII & Bảo mật:**
   - Toàn bộ thông tin khách hàng trên giao diện là dữ liệu kiểm thử tổng hợp (synthetic data) tuân thủ quy tắc mã hóa/che giấu PII theo SDD-06 Mục 2.5 và Quyết định D21 (`ng***@gmail.com`, `Ng*** V** A**`, `090***678`).
   - Không chứa bất kỳ secret, token production, hay thông tin đăng nhập nhạy cảm nào trong ảnh hay manifest.
3. **Phạm vi bảo toàn (Boundary Safeguards):**
   - Không thêm dependency mới nào vào repo.
   - Module của đồng đội (Nguyên: Rooms/RoomTypes, Tân: Housekeeping) được giữ nguyên vẹn 100%.
   - Các quyết định chính sách P5 (`D21 lookup TTL anchor/reissue` và `Quote 5m / Hold 15m price pinning`) giữ nguyên trạng thái `NeedsPO` trong `decisions.md` và `task.json`.
   - Phân kỳ P6 (AI Search) chưa được mở.

---

## 3. Kiểm Kê Bằng Chứng Trực Quan Thực Tế (`docs/agent-coordination/evidence/visual/`)

| STT | Luồng giao diện | Tệp tin ảnh trong Repo | Viewport & Chế độ | Nội dung & Tính năng hiển thị nổi bật |
|:---:|---|---|:---:|---|
| 1 | **Public Booking Search** | [`public-booking-search-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-search-desktop.png) | Desktop (1280x800) | Bộ chọn khách sạn (Khách sạn Sài Gòn Central), hình thức thuê đêm/giờ, chọn ngày lưu trú, giờ check-in 14:00/check-out 12:00, thẻ loại phòng khả dụng (Deluxe Double Room, Executive Suite) và giá ước tính. |
| 2 | **Public Booking Search** | [`public-booking-search-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-search-mobile.png) | Mobile (375x812, 2x) | Giao diện di động responsive, form tìm kiếm xếp dọc tối ưu cảm ứng, hiển thị phòng trống thời gian thực. |
| 3 | **Public Booking Hold** | [`public-booking-hold-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-hold-desktop.png) | Desktop (1280x800) | Banner đồng hồ đếm ngược 15 phút thời gian thực, mã xác nhận `BK-20261010-0088`, trạng thái `PendingHold`, thông tin người đặt che giấu PII, phân tích tài chính & tỷ lệ cọc 30% (720.000 đ / 2.400.000 đ), hướng dẫn chuyển khoản Vietcombank kèm cú pháp và mã tra cứu bảo mật. |
| 4 | **Public Booking Hold** | [`public-booking-hold-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-hold-mobile.png) | Mobile (375x812, 2x) | Banner đếm ngược 15 phút nổi bật trên mobile, thẻ thông tin đặt phòng xếp tầng và thông tin tiền cọc 30% rõ ràng. |
| 5 | **Public Booking Status** | [`public-booking-status-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-status-desktop.png) | Desktop (1280x800) | Form nhập Lookup Token và nút Tra cứu; trạng thái "Đã xác nhận" (Confirmed); thông tin khách hàng che giấu PII (`ng***@gmail.com`); đối soát tài chính (Tổng 2.400.000 đ, Đã cọc 720.000 đ, Còn lại tại quầy 1.680.000 đ); bảng phân rã chi phí chi tiết và nút sao chép mã bảo mật. |
| 6 | **Public Booking Status** | [`public-booking-status-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/public-booking-status-mobile.png) | Mobile (375x812, 2x) | Giao diện tra cứu tối ưu di động, badge "Đã xác nhận" màu xanh, đối soát tài chính thu gọn cho màn hình nhỏ. |
| 7 | **Receptionist Folio Modal** | [`receptionist-folio-modal-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/receptionist-folio-modal-desktop.png) | Desktop (1280x800) | Modal chi tiết đơn đặt `RES-20261010-0012` tại `/reservations`, snapshot giá bất biến, Bảng kê công nợ & Thanh toán (Folio) với badge "Còn dư nợ", KPI Tổng tiền (2.400.000 đ), Đã thanh toán (720.000 đ), Dư nợ còn lại (1.680.000 đ), bảng Lịch sử thu tiền & đặt cọc với tag audit `[IK:hold-deposit-20261010][BY:staff-01]`, và biểu mẫu thu tiền thủ công (Tiền mặt/Chuyển khoản). |
| 8 | **Receptionist Folio Modal** | [`receptionist-folio-modal-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/receptionist-folio-modal-mobile.png) | Mobile (375x812, 2x) | Modal responsive toàn màn hình di động, hiển thị đầy đủ thẻ KPI Bảng kê công nợ Folio, bảng lịch sử thanh toán và nút đóng modal. |

---

## 4. Tệp Bản Kê Khai Chi Tiết (Visual Evidence Manifest)

Tệp bản kê khai kỹ thuật được lưu tại:  
📄 **[`docs/agent-coordination/evidence/visual/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/visual/manifest.json)**

Bản kê khai xác nhận:
- `schemaVersion`: 1
- `taskId`: `P7-VISUAL-EVIDENCE-01` (Round 1)
- `actor`: `antigravity`
- `git`: Branch `develop`, Commit `3f95339`
- `environment`: Headless/Emulated Chrome via `chrome-devtools-mcp`
- `dataProvenance`: Khai báo rõ ràng là browser fixture responses, không claim live cloud booking hay live production integration.
- `screenshots`: 8 mục cấu hình chi tiết kèm kích thước viewport và mô tả tính năng.

---

## 5. Cập Nhật Ma Trận Truy Xuất Nguồn Gốc (Traceability Matrix)

Tài liệu:  
📄 **[`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md)** Mục 4
- Đã loại bỏ các khoảng trống "❌ Chưa có ảnh chụp thực tế giao diện Đặt phòng Trực tuyến" và "❌ Chưa có ảnh chụp thực tế Modal Thu tiền Folio".
- Bổ sung bảng kiểm kê bằng chứng trực quan mới với 8 đường dẫn ảnh và bản kê khai `manifest.json`.

---

## 6. Kết Luận & Bàn Giao Thẩm Định

Lát cắt **P7-VISUAL-EVIDENCE-01 (Round 1)** đã hoàn thành trọn vẹn mục tiêu bổ sung bằng chứng trực quan thực tế, đáp ứng đầy đủ các tiêu chí an toàn, tính minh bạch về nguồn gốc dữ liệu, và tuân thủ các quy định bảo mật/PII.

Kính chuyển Reviewer (Codex) thẩm định!
