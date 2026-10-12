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
| K6 | **SUS score** | ≥ 68 (target 80) | System Usability Scale questionnaire (≥10 users) | P7 |
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

### 2.1 Phạm vi MVP và các phase thực hiện

> Cập nhật 2026-10-05 theo yêu cầu người dùng. Lộ trình này thay thế đề xuất catalog-first trước đó. Đây là kế hoạch, không phải báo cáo hoàn thành.
> Chi tiết task, dependency, write scope, exit gate và traceability: [Lộ trình thực hiện](../implementation-phases.md).

MVP ưu tiên vận hành nội bộ, thuê theo giờ và theo đêm, doanh nghiệp một/nhiều cơ sở; online dùng chung tồn phòng; AI tìm phòng thuộc MVP đồ án.

| Phase | Phạm vi | Điều kiện hoàn thành |
|---|---|---|
| P0 | Chốt Tenant/Property, quyền, giờ/đêm, giá/hold và đồng bộ SRS/SDD | Rule/API/ERD thống nhất, không blocker P1–P3 |
| P1 | Tenant doanh nghiệp, chi nhánh, membership, fail-closed, migration/CI | Hai tenant/nhiều branch cách ly đúng; upgrade/recovery có evidence |
| P2 | Phòng/loại phòng theo branch, giá giờ/đêm và lịch sử | CRUD UI/API thật; fixture giá đúng, không ghi đè lịch sử |
| P3 | Booking nội bộ, shared availability, snapshot, check-in/out | Giờ/đêm end-to-end; concurrency không double-book |
| P4 | Thu tiền/công nợ/audit và dashboard thật | Đối chiếu được, retry không thu trùng, báo cáo đúng scope |
| P5 | Online tối giản, hold/expiry/confirm chung inventory | Race online/internal một bên thắng; hết hold trả tồn |
| P6 | AI tìm phòng tiếng Việt qua search backend | Không bịa giá/tồn, hỏi lại thiếu dữ liệu, fallback khi AI lỗi |
| P7 | E2E, security/accessibility, backup/restore, nghiệm thu | Demo tái lập, CI chạy thật, evidence và hạn chế công khai |

#### Quy tắc triển khai

- Tenant = doanh nghiệp, Property = chi nhánh; khách sạn độc lập có một Property. Tài khoản cá nhân có membership scope, không tài khoản branch chung.
- Giờ/đêm cùng lịch phòng theo thời điểm và timezone cơ sở; khác pricing policy, lưu snapshot. DateOnly-only không đủ cho thuê giờ.
- Đã duyệt phân phòng online sớm, guest checkout, hold 15 phút; không mặc định quota riêng online. Hold/booking hai kênh dùng chung concurrency/idempotency. Xem [quyết định P0](../p0-decisions.md) cho D01–D10 và acceptance criteria.
- Index/unique/FK phản ánh tenant/branch và truy vấn thật. Đo trên fixture an toàn trước tối ưu; không partition/cache mặc định.
- Mọi phase có test/evidence; không coi config hoặc test rỗng là chức năng đã xác minh. Migration phải thử dữ liệu cũ và recovery.
- Đã duyệt gói đầu 2 giờ, thêm giờ làm tròn lên 60 phút; giờ đêm 12:00–12:00 ngày kế tiếp và buffer tối thiểu 30 phút, chi nhánh được cấu hình tăng, vẫn xác nhận đã dọn. Timezone Asia/Ho_Chi_Minh, VND; quote 5 phút/hold 15 phút; Standard demo 150.000đ/gói + 50.000đ/giờ thêm, 400.000đ/đêm. Online cọc 30% xác nhận thủ công, nội bộ không bắt buộc cọc; hủy miễn phí trước 2 giờ/24 giờ, muộn phí 30%, no-show thủ công theo snapshot; refund manager/admin duyệt; lookup email TTL 7 ngày sau checkout; platform support cấp có hạn. D14 chưa chọn; các contract còn mở xem p0-decisions.md. AI cả online/nội bộ.

### 2.2 Danh sách chức năng và traceability phase

| ID | Chức năng | Phase | Trạng thái kế hoạch |
|---|---|---|---|
| F1 | Owner đăng ký/đăng nhập, doanh nghiệp | P1 | MVP, chưa nghiệm thu |
| F2 | Platform tenant administration | P1 | MVP, chưa nghiệm thu |
| F3 | Chi nhánh, membership/quyền và xuất bản cơ sở | P1/P5 | MVP, chưa nghiệm thu |
| F4 | Phòng/loại phòng theo chi nhánh | P2 | MVP, chưa nghiệm thu |
| F5 | Giá giờ/đêm, lịch sử và snapshot | P2/P3 | MVP, chưa nghiệm thu |
| F6 | Tìm phòng tại cơ sở, tồn và giá thật | P3/P5 | MVP; catalog toàn nền tảng sau MVP |
| F7 | Bản đồ toàn nền tảng | Sau P7 | Sau MVP/theo rubric |
| F8 | Online hold/booking, chống trùng | P5 | MVP, chưa nghiệm thu |
| F9 | Booking nội bộ/check-in/out | P3 | MVP, chưa nghiệm thu |
| F10 | Readiness sau dọn; phân công housekeeping | P3 / sau P7 | Readiness MVP; phân công sau MVP |
| F11 | Ghi nhận thu tiền/công nợ; gateway/refund automation | P4 / sau P7 | Thủ công MVP; gateway theo rubric |
| F12 | Dashboard cơ bản; báo cáo nâng cao | P4 / sau P7 | Cơ bản MVP; nâng cao sau MVP |
| F13 | AI tìm phòng tiếng Việt | P6 | MVP, chưa nghiệm thu |
| F14 | Subscription billing/feature gating | Sau P7 | Sau MVP |
| F15 | AI dynamic pricing/reports | Sau P7 | Chưa cam kết |
| F16 | Review/rating | Sau P7 | Sau MVP |
| F17 | CI/test/recovery/evidence | Xuyên suốt/P7 | Bắt buộc, chưa nghiệm thu |
| F18 | Đa chi nhánh và quyền theo phạm vi | P0/P1 | MVP, chưa nghiệm thu |

### 2.3 Scope ngoài MVP (nice-to-have)

| # | Chức năng | Lý do không cam kết |
|---|----------|-------------------|
| N1 | Channel Manager (OTA integration) | Cần API partner, phức tạp |
| N2 | Mobile App (React Native) | Ngoài scope, đã có responsive web |
| N3 | Stripe payment | Gateway không bắt buộc trong MVP vận hành; đối chiếu rubric trước tích hợp |
| N4 | Tối ưu phân phòng muộn | Đa chi nhánh đã thuộc P1; phân phòng muộn để sau khi tồn phòng chung ổn định |
| N5 | Offline mode | Phức tạp, ít priority |
| N6 | Tự động geocoding/chuẩn hóa địa chỉ bằng dịch vụ ngoài | Cần so sánh dữ liệu địa giới Việt Nam, quota, phí và giấy phép |
| N7 | AI cá nhân hóa nâng cao | AI tìm phòng cơ bản thuộc P6; cá nhân hóa nâng cao sau MVP |

### 2.4 Mẫu bản cam kết (để ký)

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
