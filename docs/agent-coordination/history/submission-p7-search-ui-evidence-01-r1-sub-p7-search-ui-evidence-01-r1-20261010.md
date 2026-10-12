# Submission: P7-SEARCH-UI-EVIDENCE-01 (Round 1)

- **TaskId:** P7-SEARCH-UI-EVIDENCE-01
- **Round:** 1
- **SubmissionId:** sub-p7-search-ui-evidence-01-r1-20261010
- **ReviewedSubmissionId:** sub-p5-guest-search-reuse-01-r4-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T23:38:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Mục Tiêu & Phạm Vi Lát Cắt (Scope & Objectives)

Thực hiện nhiệm vụ bàn giao từ Reviewer (Codex) sau khi nghiệm thu `P5-GUEST-SEARCH-REUSE-01 (Round 4 Approved)`, Antigravity đã triển khai lát cắt **P7-SEARCH-UI-EVIDENCE-01 (Round 1)** nhằm kiểm chứng trực quan giao diện tìm kiếm khách hàng mới trên môi trường cô lập, hoàn toàn không lặp lại các ảnh chụp P7 cũ:

1. **Tập trung độc quyền vào các tính năng Search UI mới:**
   - Tìm kiếm từ khóa tiếng Việt có dấu / không dấu (`normalizeVn` matching trên Tên, Địa chỉ, Tỉnh/Thành phố).
   - Xóa từ khóa tìm kiếm (`clearPropertySearch`) và hủy pending debounce timer (`cancelPendingSearchDebounce`).
   - Trạng thái tìm kiếm không có kết quả phù hợp (Empty State banner + nút "Xem tất cả khách sạn").
   - Trạng thái lỗi máy chủ & thử lại (Error alert banner + toast + nút "Thử lại").
   - Chuyển cơ sở lưu trú và reset đồng bộ selection & availability mới (`resetSelectionAndAvailability`).
   - Kiểm chứng hiển thị responsive chuẩn tỉ lệ trên giao diện di động (Mobile Viewport 375x812, 2x).

2. **Ranh giới an toàn nghiêm ngặt (Strict Boundaries):**
   - **0 sửa đổi mã nguồn nghiệp vụ:** Không chạm vào mã nguồn nghiệp vụ trong `frontend/src/` hay `backend/src/`.
   - **Không truy cập cơ sở dữ liệu:** 0 DB connection, không kết nối hay gửi lệnh tới database dev, staging hay production.
   - **Môi trường fixture độc lập:** Sử dụng máy chủ Node.js in-memory fixture server độc lập (`127.0.0.1:5283`) với dữ liệu tổng hợp tĩnh (synthetic data) có gắn nhãn rõ ràng. Không tuyên bố mock là kho phòng hay đặt phòng trực tiếp cloud.
   - Các cổng chính sách P5 và Phase B search tiếp tục giữ nguyên trạng thái `NeedsPO` trong `decisions.md`; P6 chưa mở; không can thiệp các module của đồng đội (Nguyên, Tân).

---

## 2. Quy Trình Thu Thập Bằng Chứng & Kiến Trúc Cô Lập (Capture Procedure & Isolation)

1. **Quy trình triển khai:**
   - Ứng dụng frontend được build trực tiếp từ mã nguồn mới nhất (`frontend/dist/frontend/browser`, tạo lúc 23:30:12 ngày 10/10/2026).
   - Máy chủ phục vụ tĩnh [`local-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/local-server.cjs) lắng nghe tại loopback `127.0.0.1:4200`, định tuyến toàn bộ yêu cầu `/api/*` sang máy chủ mock API [`fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/fixture-server.cjs) tại `127.0.0.1:5283`.
   - Máy chủ `fixture-server.cjs` chứa bộ dữ liệu tổng hợp gồm 3 cơ sở lưu trú tại TP.HCM, Đà Nẵng, Hà Nội cùng phòng khả dụng tương ứng, cấu hình **fail-closed** (trả về HTTP 404 cho mọi route không khớp).
   - Trình duyệt Chrome Headless được điều khiển qua DevTools MCP để thực thi các kịch bản tương tác và chụp ảnh viewport thực tế.

2. **Ghi nhận minh bạch các giới hạn (Limitations & Working Tree Status):**
   - **Working Tree Baseline:** Checkout làm việc là dirty baseline chứa các thay đổi uncommitted tích lũy từ các phase trước (HEAD `3f95339` không đại diện cho toàn bộ code đang render). Trong task này chỉ tạo mới các file evidence, fixture server và manifest.
   - **Cô lập mạng:** Máy chủ fixture lắng nghe loopback 127.0.0.1; mức độ cô lập mạng tổng thể của trình duyệt đối với các yêu cầu ngoại vi trong suốt phiên capture được ghi nhận là unverified.
   - **Dữ liệu giả lập:** Toàn bộ dữ liệu hiển thị trong các ảnh chụp là dữ liệu tổng hợp (synthetic fixture data); không đại diện cho kho phòng hay tích hợp trực tiếp cloud.

---

## 3. Danh Mục Bằng Chứng Trực Quan Thực Tế (`docs/agent-coordination/evidence/search-ui/`)

Toàn bộ 7 ảnh chụp thực tế đã được lưu trực tiếp trong repository:

| STT | Kịch bản kiểm chứng | Tệp ảnh thực tế trong repo | Viewport | Thời điểm chụp (`capturedAt`) | Nội dung hiển thị trong Viewport (Fixture Rendering) | Ranh giới Viewport |
|:---:|---|---|---|:---:|---|---|
| 1 | **Từ khóa có dấu** | [`search-ui-keyword-diacritics-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-keyword-diacritics-desktop.png) | Desktop (1280x800) | 2026-10-10 23:33:00 | Ô tìm kiếm chứa "Đà Nẵng", nút "✕"; dropdown tự chọn "Khách Sạn Biển Đông Đà Nẵng (Đà Nẵng)"; phòng "Ocean Front Suite (Đà Nẵng)" nạp tự động. | Trọn vẹn viewport desktop |
| 2 | **Xóa & Hủy debounce** | [`search-ui-clear-debounce-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-clear-debounce-desktop.png) | Desktop (1280x800) | 2026-10-10 23:33:20 | Ô tìm kiếm rỗng, nút "✕" tự ẩn; danh sách đầy đủ 3 cơ sở lưu trú khôi phục trong dropdown; timer debounce pending bị hủy hoàn toàn, không có request tái áp "Đà Nẵng" sau 300ms. | Trọn vẹn viewport desktop |
| 3 | **Empty State** | [`search-ui-empty-state-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-empty-state-desktop.png) | Desktop (1280x800) | 2026-10-10 23:33:43 | Banner màu vàng: "Không tìm thấy cơ sở lưu trú nào phù hợp với 'Vũng Tàu'"; nút "Xem tất cả khách sạn"; dropdown hiển thị "(0 kết quả)"; selection và availability được reset sạch sẽ. | Trọn vẹn viewport desktop |
| 4 | **Error State & Retry** | [`search-ui-error-retry-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-error-retry-desktop.png) | Desktop (1280x800) | 2026-10-10 23:34:09 | Khung cảnh báo màu đỏ: "Lỗi máy chủ mô phỏng khi tìm kiếm cơ sở lưu trú"; nút "Thử lại"; toast thông báo lỗi hiển thị rõ ràng. | Trọn vẹn viewport desktop |
| 5 | **Đổi cơ sở & Reset state** | [`search-ui-property-change-reset-desktop.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-property-change-reset-desktop.png) | Desktop (1280x800) | 2026-10-10 23:34:45 | Chuyển dropdown sang "Hà Nội Grand Boutique Hotel"; lựa chọn phòng và báo giá cũ bị xóa sạch (`selectedRoomTypeId=null`); danh sách phòng mới ("Classic Heritage Room") nạp tự động. | Trọn vẹn viewport desktop |
| 6 | **Mobile Search** | [`search-ui-keyword-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-keyword-mobile.png) | Mobile (375x812, 2x) | 2026-10-10 23:35:09 | Layout responsive dọc tối ưu màn hình di động; tìm kiếm từ khóa "Sài Gòn"; hiển thị cơ sở Sài Gòn Central và danh sách phòng chuẩn mobile. | Danh sách phòng chi tiết cuộn bên dưới |
| 7 | **Mobile Empty State** | [`search-ui-empty-mobile.png`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-empty-mobile.png) | Mobile (375x812, 2x) | 2026-10-10 23:35:32 | Thẻ cảnh báo không có kết quả responsive vừa vặn màn hình mobile; nút "Xem tất cả khách sạn" hiển thị rõ ràng, dễ thao tác chạm/vuốt. | Danh sách trống cuộn dọc màn hình nhỏ |

---

## 4. Tệp Kê Khai Kỹ Thuật & Log Thực Tế

- **Bản kê khai kỹ thuật:** [`docs/agent-coordination/evidence/search-ui/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/manifest.json)
- **Tập dữ liệu fixture:** [`docs/agent-coordination/evidence/search-ui/fixtures.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/fixtures.json)
- **Mã nguồn fixture server:** [`docs/agent-coordination/evidence/search-ui/fixture-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/fixture-server.cjs)
- **Mã nguồn máy chủ tĩnh local:** [`docs/agent-coordination/evidence/search-ui/local-server.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/local-server.cjs)
- **Log phiên capture thực tế:** [`docs/agent-coordination/evidence/search-ui/search-ui-capture.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/search-ui/search-ui-capture.log)
- **Ma trận truy xuất nguồn gốc cập nhật:** [`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md) (Mục 4.2)

---

## 5. Danh Mục Tệp Thay Đổi (Touched Files Manifest)

| Tệp | Hành động | Mục đích |
|---|---|---|
| `docs/agent-coordination/evidence/search-ui/*.png` (7 tệp) | Tạo mới | 7 ảnh chụp thực tế màn hình Desktop & Mobile kiểm chứng 5 hành vi search UI mới |
| `docs/agent-coordination/evidence/search-ui/fixtures.json` | Tạo mới | Khai báo cấu trúc dữ liệu tổng hợp phục vụ kiểm chứng giao diện tìm kiếm |
| `docs/agent-coordination/evidence/search-ui/fixture-server.cjs` | Tạo mới | Máy chủ Node.js in-memory mock API port 5283 hỗ trợ search diacritics/empty/error |
| `docs/agent-coordination/evidence/search-ui/local-server.cjs` | Tạo mới | Máy chủ phục vụ static Angular build port 4200 và proxy `/api/*` sang 5283 |
| `docs/agent-coordination/evidence/search-ui/search-ui-capture.log` | Tạo mới | Log thực tế quá trình kiểm thử endpoint và các bước capture trình duyệt |
| `docs/agent-coordination/evidence/search-ui/manifest.json` | Tạo mới | Bản kê khai kỹ thuật viewport, thời điểm, ranh giới và giới hạn cô lập |
| [`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md) | Chỉnh sửa | Bổ sung Mục 4.2 liên kết 7 bằng chứng trực quan mới của Search UI |
| [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) | Cập nhật | Báo cáo chi tiết kết quả thực hiện lát cắt P7-SEARCH-UI-EVIDENCE-01 Round 1 |
| [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) | Cập nhật | Chuyển sang `Submitted`, round 1, giải phóng writer lock về `none` |

---

## 6. Bàn Giao & Đề Xuất Tiếp Theo (Handoff & Next Steps)

- Lát cắt **P7-SEARCH-UI-EVIDENCE-01 (Round 1)** đã hoàn thành trọn vẹn theo đúng phân công và yêu cầu của Reviewer (Codex).
- Writer lock được giải phóng về `none` trong `task.json`.
- Kính chuyển Reviewer (Codex) thẩm định!
