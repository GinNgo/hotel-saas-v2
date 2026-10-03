# 🎯 KPI nghiệp vụ & Bản cam kết sản phẩm

> **Tài liệu:** SRS-08 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC1 Mức 5 (≥5 KPI định lượng) + Quy trình Bước 3

---

## 1. KPI nghiệp vụ (≥6 KPI)

### KPI đo hiệu quả hệ thống

| # | KPI | Mục tiêu | Cách đo | Tần suất |
|---|-----|----------|---------|---------|
| K1 | **Thời gian check-in** | ≤ 2 phút | Timestamp (click Check-in - mở booking) | Mỗi lần check-in |
| K2 | **Thời gian tạo booking** | ≤ 3 phút | UX testing (from search to confirmed) | User testing |
| K3 | **Độ chính xác inventory** | ≥ 99% | So sánh room status hệ thống vs thực tế | Weekly audit |
| K4 | **API response time P95** | ≤ 300ms | APM monitoring (Serilog metrics) | Continuous |
| K5 | **Task success rate** | ≥ 85% | Usability testing (hoàn thành task / tổng task) | User testing |
| K6 | **SUS score** | ≥ 68 (target 80) | System Usability Scale questionnaire (≥10 users) | Phase 5 |
| K7 | **Booking conversion rate** | ≥ 60% | (Bookings confirmed / Search sessions) × 100 | Weekly |
| K8 | **Housekeeping turnaround** | ≤ 30 phút | Timestamp (task created → completed) | Mỗi task |

### KPI đo chất lượng phát triển

| # | KPI | Mục tiêu | Cách đo |
|---|-----|----------|---------|
| D1 | **Test coverage** | ≥ 70% core modules | Coverage report (dotnet test + Istanbul) |
| D2 | **Lint errors** | ≤ 5/1000 LOC | ESLint + Roslyn analyzers |
| D3 | **CI build success rate** | ≥ 90% | GitHub Actions stats |
| D4 | **PR merge time** | ≤ 24h | GitHub PR metrics |
| D5 | **Commit frequency** | ≥ 75% weeks | Git log analysis |

---

## 2. Bản cam kết sản phẩm

> ⚠️ **Lưu ý:** Bản cam kết chính thức phải nộp trước mốc 50% thời gian
> (Quy trình Bước 3 trong rubric). Bản dưới đây là draft.

### 2.1 Danh sách chức năng cam kết

| # | Chức năng | Mức cam kết | Phase | Metric thành công |
|---|----------|:----------:|:-----:|-------------------|
| F1 | Đăng ký / Đăng nhập / Quên MK | ✅ Hoàn thành | 1 | Login < 3s, Email verification hoạt động |
| F2 | RBAC: Quản lý Role + Permission | ✅ Hoàn thành | 1 | Owner tạo được custom role, assign staff |
| F3 | Quản lý Property | ✅ Hoàn thành | 2 | CRUD + cấu hình policies |
| F4 | Quản lý Room Type + Room | ✅ Hoàn thành | 2 | CRUD + status tracking |
| F5 | Đặt phòng (Staff + Guest online) | ✅ Hoàn thành | 2 | Overlap check hoạt động, ConfirmationCode |
| F6 | Check-in / Check-out | ✅ Hoàn thành | 2 | ≤ 2 phút, auto housekeeping task |
| F7 | Room Status Board (realtime) | ✅ Hoàn thành | 2 | SignalR update ≤ 2s |
| F8 | Housekeeping task management | ✅ Hoàn thành | 3 | Assign → Complete → Room Clean |
| F9 | Thanh toán (VNPay sandbox) | ✅ Hoàn thành | 3 | Idempotent, callback xử lý đúng |
| F10 | Invoice PDF | ✅ Hoàn thành | 3 | PDF đúng format, downloadable |
| F11 | Revenue Dashboard | ✅ Hoàn thành | 3 | Charts đúng data, date filter |
| F12 | AI Concierge Chatbot | ⚠️ 80% | 3 | Response ≤ 5s, tiếng Việt |
| F13 | Notification (in-app) | ✅ Hoàn thành | 3 | Realtime via SignalR |
| F14 | AI Dynamic Pricing | ⚠️ Prototype | 4 | Suggestion hiển thị, accept/reject |
| F15 | Review & Rating | ⚠️ 80% | 4 | Guest viết review, hiển thị rating |
| F16 | Đa ngôn ngữ (VI/EN) | ✅ Hoàn thành | 2+ | 100% UI strings in i18n |
| F17 | CI/CD Pipeline (≥4 stages) | ✅ Hoàn thành | 5 | Build → Test → Scan → Deploy |
| F18 | Deploy staging | ✅ Hoàn thành | 5 | Accessible từ Internet |

### 2.2 Scope ngoài cam kết (nice-to-have)

| # | Chức năng | Lý do không cam kết |
|---|----------|-------------------|
| N1 | Channel Manager (OTA integration) | Cần API partner, phức tạp |
| N2 | Mobile App (React Native) | Ngoài scope, đã có responsive web |
| N3 | Stripe payment | VNPay đủ cho thị trường VN |
| N4 | Multi-branch management | Enterprise tier, phức tạp |
| N5 | Offline mode | Phức tạp, ít priority |

### 2.3 Mẫu bản cam kết (để ký)

```
╔══════════════════════════════════════════════════════════════╗
║                    BẢN CAM KẾT SẢN PHẨM                    ║
║                                                              ║
║  Đề tài: Hệ thống quản lý khách sạn / nhà nghỉ SaaS + RBAC ║
║  Nhóm:   [TÊN NHÓM]                                         ║
║  GVHD:   [TÊN GIẢNG VIÊN]                                   ║
║  Ngày:   [NGÀY KÝ]                                          ║
║                                                              ║
║  Nhóm cam kết hoàn thành:                                    ║
║  • 18 chức năng chính (F1-F18)                              ║
║  • 8 KPI nghiệp vụ đạt mục tiêu                            ║
║  • Test coverage ≥ 70% core modules                          ║
║  • CI/CD pipeline ≥ 4 stages                                ║
║  • User testing ≥ 10 người                                   ║
║  • Deploy staging accessible                                 ║
║                                                              ║
║  Ký tên:                                                     ║
║  [Thành viên 1] ___________                                  ║
║  [Thành viên 2] ___________                                  ║
║  [Thành viên 3] ___________                                  ║
║  [Thành viên 4] ___________                                  ║
╚══════════════════════════════════════════════════════════════╝
```

---

*Tài liệu này phục vụ TC1 Mức 5 (≥5 KPI) và Quy trình Bước 3 (bản cam kết sản phẩm).*
