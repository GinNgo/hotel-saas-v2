# Submission: P7-SEARCH-UI-EVIDENCE-01 (Round 2)

- **TaskId:** P7-SEARCH-UI-EVIDENCE-01
- **Round:** 2
- **SubmissionId:** sub-p7-search-ui-evidence-01-r2-20261010
- **ReviewedSubmissionId:** sub-p7-search-ui-evidence-01-r1-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T23:47:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Mục Tiêu & Phạm Vi Resubmit Round 2 (Scope & Reviewer Findings Resolution)

Thực hiện yêu cầu tại **Review P7-SEARCH-UI-EVIDENCE-01 (Round 1 ChangesRequested)** từ Reviewer (Codex), Antigravity đã hoàn tất điều chỉnh toàn bộ metadata, manifest, logs và ma trận truy xuất nguồn gốc mà **không sửa mã nguồn nghiệp vụ (0 production code changes)** và **giữ nguyên toàn bộ 7 tệp ảnh gốc**:

1. **Khắc phục Finding 1 [P2] — Kê khai chính xác kích thước pixel thực tế và ghi nhận viewport unknown:**
   - Kê khai chính xác kích thước pixel thực tế của 7 tệp PNG: 5 ảnh desktop có kích thước thực tế **1600x915 px**, 2 ảnh mobile có kích thước thực tế **628x915 px** (đã đối chiếu trực tiếp qua header ảnh PNG).
   - Bổ sung cấu hình công cụ chụp (`captureToolSettings`): ghi rõ tham số mục tiêu khi gọi `resize_page` là 1280x800 (desktop) và 375x812 (mobile).
   - Ghi nhận `deviceScaleFactor` là **unknown** và `effectiveCssViewport` là **unknown** (không tự suy diễn CSS viewport từ kích thước pixel ảnh; ghi nhận thiếu CDP metrics trace độc lập; không tuyên bố đã kiểm chứng 375px CSS viewport thực tế).
   - Tuyệt đối không can thiệp resize hay sửa đổi 7 tệp ảnh gốc trong `docs/agent-coordination/evidence/search-ui/`.

2. **Khắc phục Finding 2 [P2] — Tách bạch các phần tử nhìn thấy trên ảnh tĩnh khỏi kiểm chứng dynamic behavior/source/tests:**
   - Trong `manifest.json`, `docs/p7-evidence-traceability-matrix.md` (Mục 4.2) và `submission.md`, mục `visibleElements` chỉ liệt kê những gì trực quan quan sát được trên ảnh tĩnh.
   - Các hành vi động (hủy debounce timer, không gửi request trùng lặp sau 300ms, dropdown chứa 3 options, reset state nội bộ `selectedRoomTypeId=null`/`currentQuote=null`, các cờ loading, hoặc hành vi retry HTTP 500 thành công) được tách riêng thành phần cơ sở kiểm chứng từ mã nguồn và automated unit tests (P5 Round 4, 30/30 passed trong `public-booking.page.spec.ts` + `public-booking.service.spec.ts`) hoặc quy trình thao tác của writer (unverified).
   - Xác định rõ bản chất của [`search-ui-capture.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-capture.log) là **narrative log** ghi lại các bước tương tác của writer, không phải là network trace hay timing trace độc lập từ CDP.
   - Ghi nhận chính xác giới hạn thẻ phòng trên Mobile (`search-ui-keyword-mobile.png`): ảnh chụp chỉ bao gồm form tìm kiếm và dropdown; các thẻ loại phòng chi tiết nằm cuộn bên dưới viewport và không xuất hiện trong ảnh.
   - Phân định rõ ràng từ khóa có dấu vs không dấu: 2 ảnh chụp keyword (`search-ui-keyword-diacritics-desktop.png` với "Đà Nẵng" và `search-ui-keyword-mobile.png` với "Sài Gòn") là bằng chứng trực quan cho truy vấn **có dấu tiếng Việt**; khả năng tìm kiếm không dấu ("Da Nang", "Sai Gon") được bảo đảm bằng backend test suite `VietnameseTextNormalizerTests` (47/47 PASS) và frontend unit tests, không gọi 2 ảnh này là bằng chứng trực quan của truy vấn không dấu.

---

## 2. Ranh Giới Kỹ Thuật & Giới Hạn Cô Lập (Boundaries & Provenance)

- **0 Production Code Changes:** Toàn bộ mã nguồn nghiệp vụ trong `frontend/src/` và `backend/src/` được giữ nguyên vẹn 100%. Checkout làm việc là dirty baseline chứa các thay đổi chưa commit từ các phase trước.
- **0 Database Connections:** Hoàn toàn không kết nối hay gửi truy vấn tới bất kỳ cơ sở dữ liệu nào (dev, staging, production).
- **Môi trường Synthetic Fixture:** Dữ liệu phục vụ bởi in-memory fixture server (`127.0.0.1:5283`) với 3 cơ sở lưu trú tổng hợp; không đại diện cho kho phòng hay tích hợp trực tiếp cloud. Mức độ cô lập mạng ngoại vi tổng thể của trình duyệt trong phiên capture ghi nhận là unverified.
- **Bảo toàn các cổng PO:** 7 cổng chính sách PO (D21 lookup TTL, price pinning, PO Gates 1–5 về search/publication/dataset) tiếp tục được giữ nguyên trạng thái `NeedsPO` trong `decisions.md` và `task.json`.

---

## 3. Danh Mục Bằng Chứng Trực Quan Thực Tế (Evidence Inventory Round 2)

| STT | Kịch bản kiểm chứng | Tệp ảnh thực tế trong repo | Kích thước ảnh thực tế (PNG) / Viewport | Nội dung nhìn thấy trên ảnh tĩnh (Visible Elements) | Cơ sở kiểm chứng nghiệp vụ & Giới hạn |
|:---:|---|---|---|---|---|
| 1 | **Từ khóa có dấu** | [`search-ui-keyword-diacritics-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-keyword-diacritics-desktop.png) | 1600x915 px (Target: 1280x800; CSS Viewport: unknown) | Ô tìm kiếm chứa chuỗi có dấu "Đà Nẵng"; nút "✕" hiển thị; dropdown hiển thị "Khách Sạn Biển Đông Đà Nẵng (Đà Nẵng)"; thẻ phòng "Ocean Front Suite (Đà Nẵng)" render bên dưới. | Bằng chứng trực quan cho từ khóa có dấu "Đà Nẵng". Khả năng tìm kiếm không dấu ("Da Nang") được bảo đảm bởi test suite backend `VietnameseTextNormalizerTests` (47/47 PASS) và `public-booking.service.spec.ts`. Dữ liệu synthetic fixture. |
| 2 | **Xóa ô tìm kiếm** | [`search-ui-clear-debounce-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-clear-debounce-desktop.png) | 1600x915 px (Target: 1280x800; CSS Viewport: unknown) | Ô tìm kiếm rỗng sau khi click "✕"; nút "✕" tự ẩn; dropdown hiển thị cơ sở đã chọn trước đó. Dropdown đóng nên không nhìn thấy danh sách bên trong. | Hành vi hủy pending debounce timer và không phát sinh request trùng lặp sau 300ms được chứng minh qua unit tests P5 round 4 (30/30 passed trong `public-booking.page.spec.ts`) và writer procedure (unverified), không phải điều nhìn thấy trên ảnh tĩnh. |
| 3 | **Empty State** | [`search-ui-empty-state-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-empty-state-desktop.png) | 1600x915 px (Target: 1280x800; CSS Viewport: unknown) | Ô tìm kiếm chứa "Vũng Tàu"; banner màu vàng: "Không tìm thấy cơ sở lưu trú nào phù hợp với 'Vũng Tàu'"; nút "Xem tất cả khách sạn"; dropdown hiển thị "-- Chọn khách sạn (0 kết quả) --"; khu vực phòng hiển thị trống. | Kiểm chứng kết xuất giao diện Empty State client-side trên phản hồi fixture []. Logic reset selection/availability được chứng minh qua test suite. |
| 4 | **Error & Retry** | [`search-ui-error-retry-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-error-retry-desktop.png) | 1600x915 px (Target: 1280x800; CSS Viewport: unknown) | Ô tìm kiếm chứa "trigger-error"; khung cảnh báo màu đỏ: "Lỗi máy chủ mô phỏng khi tìm kiếm cơ sở lưu trú"; nút "Thử lại"; toast thông báo lỗi màu đỏ. | Ảnh tĩnh ghi nhận giao diện cảnh báo lỗi và sự hiện diện của nút "Thử lại". Hành vi thử lại thành công sau đó là chứng minh từ unit test (`public-booking.page.spec.ts`) và writer procedure (unverified). |
| 5 | **Đổi cơ sở & Reset state** | [`search-ui-property-change-reset-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-property-change-reset-desktop.png) | 1600x915 px (Target: 1280x800; CSS Viewport: unknown) | Dropdown chuyển sang "Hà Nội Grand Boutique Hotel (Hà Nội)"; thẻ phòng mới nạp tự động: "Classic Heritage Room (Hà Nội)". | Việc reset state nội bộ (`selectedRoomTypeId=null`, `currentQuote=null`, loading flags) và hủy in-flight requests là logic kiểm chứng qua unit test (`resetSelectionAndAvailability`), không phải điều nhìn thấy trên ảnh tĩnh. |
| 6 | **Mobile Search** | [`search-ui-keyword-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-keyword-mobile.png) | 628x915 px (Target: 375x812; CSS Viewport: unknown) | Bố cục dọc responsive; ô tìm kiếm chứa từ khóa có dấu "Sài Gòn"; dropdown hiển thị "Khách Sạn Sài Gòn Central (Hồ Chí Minh)". | Ảnh chỉ hiển thị form tìm kiếm; các thẻ phòng chi tiết nằm cuộn bên dưới viewport (không có trong ảnh). Viewport CSS 375px unverified. Từ khóa có dấu (không chứng minh không dấu). |
| 7 | **Mobile Empty State** | [`search-ui-empty-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-empty-mobile.png) | 628x915 px (Target: 375x812; CSS Viewport: unknown) | Thẻ cảnh báo vàng không có kết quả với "Nha Trang"; nút "Xem tất cả khách sạn"; dropdown 0 kết quả; thông báo chưa có phòng hiển thị trên bố cục dọc. | Kiểm chứng render empty state trên bố cục dọc hẹp. Viewport CSS 375px unverified. |

---

## 4. Danh Mục Tệp Cập Nhật Trong Round 2 (Touched Files Manifest)

| Tệp | Hành động | Mục đích |
|---|---|---|
| [`docs/agent-coordination/evidence/search-ui/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/manifest.json) | Cập nhật | Cập nhật kích thước pixel thực tế (1600x915 px, 628x915 px), captureToolSettings, ghi nhận viewport unknown, sửa visibleElements và tách rõ ràng proof sources |
| [`docs/agent-coordination/evidence/search-ui/search-ui-capture.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-capture.log) | Cập nhật | Ghi rõ bản chất narrative execution log của writer (unverified trace), kích thước thực tế và giới hạn từng kịch bản |
| [`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md) | Cập nhật | Sửa bảng Mục 4.2 với kích thước pixel thực tế, viewport unknown và tách biệt nội dung nhìn thấy trên ảnh tĩnh khỏi kiểm chứng source/test |
| [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) | Cập nhật | Báo cáo chi tiết giải quyết toàn bộ các điểm phản hồi từ Reviewer Round 1 |
| [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) | Cập nhật | Chuyển sang `Submitted`, round 2, `submissionId: sub-p7-search-ui-evidence-01-r2-20261010`, giải phóng writer lock về `none` |

---

## 5. Bàn Giao & Đề Xuất Tiếp Theo (Handoff)

- Toàn bộ các yêu cầu của Reviewer Codex trong **Review P7-SEARCH-UI-EVIDENCE-01 (Round 1 ChangesRequested)** đã được giải quyết trọn vẹn, chính xác và minh bạch.
- Khóa ghi (`writer`) được giải phóng về `none` trong [`task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json).
- Kính chuyển Reviewer (Codex) thẩm định Round 2!
