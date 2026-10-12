# Submission: P7-CI-FRONTEND-REHEARSAL-01 (Round 1)

- **TaskId:** P7-CI-FRONTEND-REHEARSAL-01
- **Round:** 1
- **SubmissionId:** sub-p7-ci-frontend-rehearsal-01-r1-20261010
- **ReviewedSubmissionId:** sub-p7-search-ui-evidence-01-r2-20261010
- **Workspace:** C:\Dev\hotel-saas-v2
- **SubmittedAt:** 2026-10-10T23:58:00+07:00
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Mục Tiêu & Phạm Vi Lát Cắt (Scope & Objectives)

Thực hiện nhiệm vụ bàn giao từ Reviewer (Codex) sau khi nghiệm thu `P7-SEARCH-UI-EVIDENCE-01 (Round 2 Approved)`, Antigravity đã triển khai lát cắt **P7-CI-FRONTEND-REHEARSAL-01 (Round 1)** nhằm diễn tập thực tế cục bộ (local rehearsal) quy trình CI Frontend được định nghĩa trong `.github/workflows/ci.yml`, đối chiếu với cấu hình scripts thực tế trong `frontend/package.json`, thu thập execution logs thực tế và phân tích các khoảng cách (gaps) trong kịch bản CI:

1. **Ranh giới an toàn nghiêm ngặt (Strict Boundaries):**
   - **0 sửa đổi mã nguồn nghiệp vụ:** Không can thiệp mã nguồn trong `frontend/src/` hay `backend/src/`.
   - **0 thay đổi dependencies / network:** Không chạy `npm install` hay `npm ci` để bảo toàn node_modules và môi trường hiện hành.
   - **Không tự ý thêm scripts hoặc sửa CI workflow:** Giữ nguyên vẹn `.github/workflows/ci.yml` và `frontend/package.json` để phản ánh đúng hiện trạng kỹ thuật thực tế.
   - **0 kết nối database:** Hoàn toàn không kết nối hay gửi truy vấn tới bất kỳ database nào (dev, staging, prod).
   - **Không trigger cloud actions:** Không push/trigger GitHub Actions Cloud, không commit/deploy.

---

## 2. Kết Quả Diễn Tập Thực Tế (Execution Rehearsal Results)

### 2.1. Lệnh Build Production Frontend (CI Step: `npm run build -- --configuration production`)
- **Lệnh thực thi:** `npm run build -- --configuration production`
- **Thư mục làm việc:** `C:\Dev\hotel-saas-v2\frontend`
- **Kết quả:** **Exit Code: 0** (Thành công 100%)
- **Thời gian biên dịch:** 8.226 giây
- **Kích thước bundle khởi tạo:** 888.45 kB raw (ước tính 203.08 kB transfer)
- **Cảnh báo ghi nhận:** `▲ [WARNING] Module 'sweetalert2' used by 'src/app/core/services/alert.service.ts' is not ESM` (CommonJS optimization bailout).
- **Thư mục đầu ra:** `frontend/dist/frontend/browser` (40 tệp tin)
- **Tệp log thực tế lưu trong repo:** [`docs/agent-coordination/evidence/ci-frontend/frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/ci-frontend/frontend-build.log)

### 2.2. Kiểm Thử Unit Test Thực Tế Cục Bộ (`npx vitest run`)
- **Lệnh thực thi:** `npx vitest run`
- **Thư mục làm việc:** `C:\Dev\hotel-saas-v2\frontend`
- **Kết quả:** **Exit Code: 0** (11/11 test files passed, 160/160 tests passed, 0 failures)
- **Thời gian chạy:** 4.24 giây
- **Phân bổ bài test:**
  - `date-time.util.spec.ts`: 28 tests PASS
  - `public-booking.service.spec.ts`: 8 tests PASS
  - `rates.page.spec.ts`: 16 tests PASS
  - `policies.page.spec.ts`: 20 tests PASS
  - `payment.service.spec.ts`: 4 tests PASS
  - `housekeeping.page.spec.ts`: 14 tests PASS
  - `public-booking.page.spec.ts`: 22 tests PASS
  - `reservations.page.spec.ts`: 38 tests PASS
  - `rate.service.spec.ts`: 3 tests PASS
  - `app.spec.ts`: 1 test PASS
  - `date-range-filter.component.spec.ts`: 6 tests PASS
- **Tệp log thực tế lưu trong repo:** [`docs/agent-coordination/evidence/ci-frontend/frontend-vitest.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/ci-frontend/frontend-vitest.log)

---

## 3. Phân Tích Khoảng Cách Kịch Bản CI (Workflow Script Gaps Analysis)

Đối chiếu giữa khai báo trong `.github/workflows/ci.yml` (Stage 2: frontend) và `frontend/package.json`:

| Bước trong CI Workflow | Lệnh khai báo trong CI | Trạng thái trong `frontend/package.json` | Kết quả diễn tập cục bộ | Gap kỹ thuật ghi nhận |
|---|---|---|---|---|
| **1. Install dependencies** | `npm ci` | `package-lock.json` hiện diện; `packageManager: "npm@11.13.0"` | Bỏ qua trong local rehearsal (bảo toàn node_modules hiện tại) | Không có gap cấu trúc |
| **2. Lint** | `npm run lint --if-present` | **KHÔNG CÓ** (scripts chỉ có `ng`, `start`, `build`, `watch`, `test`) | Exit code 0, không có output (silent skip) | **GAP:** CI Cloud bỏ qua hoàn toàn bước lint mà vẫn báo pass do cờ `--if-present`. |
| **3. Build** | `npm run build -- --configuration production` | **CÓ** (`"build": "ng build"`) | Exit code 0, build thành công trong 8.226s | Hoạt động bình thường. Có 1 cảnh báo CommonJS bailout với `sweetalert2`. |
| **4. Unit tests** | `npm run test:unit:ci --if-present` | **KHÔNG CÓ** (scripts không có `test:unit:ci`) | Exit code 0, không có output (silent skip) | **GAP:** CI Cloud hoàn toàn **KHÔNG CHẠY** bất kỳ unit test nào của frontend nhưng vẫn báo xanh. Bộ test 160 unit tests chỉ chạy khi gõ `npx vitest run`. |

---

## 4. Bảng Băm SHA-256 Các Tệp Bundle Chính (`frontend/dist/frontend/browser/`)

| Tên tệp bundle | Kích thước (bytes) | Mã băm SHA-256 |
|---|---|---|
| `main-EVLWMPPA.js` | 298,525 | `A4BE87DEBB43643F3C7BDEFF68EE813ABB0DC8BD80181B89C0836DF5F30A999F` |
| `polyfills-LVNOU2XZ.js` | 35,876 | `F1B35A3B4DB37B73CA0281D6B6247701465FF9E56A7A7B3AFF9784518DC2C30A` |
| `styles-TTNAGAG2.css` | 57,163 | `D08A53D01F4E65B7057CA910257FA5A5894CFF05B60279F56DCC7C8179BF583D` |
| `index.html` | 14,454 | `AA0790385BA146A9B9A3B44967D8627C0A13EC8EA3912DD19130EB6C9966B17A` |
| `favicon.ico` | 15,086 | `F9102BE80297C0529207607BE5277B4F90BCA89D65988FA1771B91C7894E815F` |

*(Chi tiết đầy đủ toàn bộ 40 tệp bundle được lưu trong [`manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/ci-frontend/manifest.json)).*

---

## 5. Danh Mục Tệp Tạo Mới / Cập Nhật (Touched Files Manifest)

| Tệp | Hành động | Mục đích |
|---|---|---|
| [`docs/agent-coordination/evidence/ci-frontend/frontend-build.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/ci-frontend/frontend-build.log) | Tạo mới | Log thực tế quá trình chạy lệnh build production frontend (exit 0) |
| [`docs/agent-coordination/evidence/ci-frontend/frontend-vitest.log`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/ci-frontend/frontend-vitest.log) | Tạo mới | Log thực tế quá trình chạy 160 unit tests Vitest (exit 0, 11 files) |
| [`docs/agent-coordination/evidence/ci-frontend/manifest.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/ci-frontend/manifest.json) | Tạo mới | Bản kê khai kỹ thuật chi tiết phân tích kịch bản CI, log mapping và bảng băm SHA-256 |
| [`docs/p7-evidence-traceability-matrix.md`](file:///C:/Dev/hotel-saas-v2/docs/p7-evidence-traceability-matrix.md) | Cập nhật | Cập nhật Mục 5 với bằng chứng diễn tập frontend và phân tích script gaps |
| [`docs/agent-coordination/submission.md`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/submission.md) | Cập nhật | Báo cáo chi tiết kết quả thực hiện lát cắt P7-CI-FRONTEND-REHEARSAL-01 Round 1 |
| [`docs/agent-coordination/task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json) | Cập nhật | Chuyển sang `Submitted`, round 1, giải phóng khóa ghi `writer: "none"` |

---

## 6. Giới Hạn & Bàn Giao (Limitations & Handoff)

- **Local Rehearsal Only:** Đây là kiểm thử diễn tập cục bộ, không phải bằng chứng chạy thành công trên GitHub Actions Cloud (trạng thái Cloud CI thực tế vẫn là Unknown do chưa có run trace trong repo).
- **Cổng PO bảo lưu:** 7 cổng chính sách PO (D21 lookup TTL, price pinning, PO Gates 1–5 về search/publication/dataset) tiếp tục được giữ nguyên trạng thái `NeedsPO` trong `decisions.md` và `task.json`; P6 chưa mở.
- Khóa ghi (`writer`) được giải phóng về `none` trong [`task.json`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/task.json).
- Kính chuyển Reviewer (Codex) thẩm định!
