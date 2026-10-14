# 📚 THƯ VIỆN TÀI LIỆU KỸ THUẬT DỰ ÁN (DOCUMENTATION INDEX)

> **Đề tài:** Nền Tảng Quản Lý Khách Sạn Đa Chi Nhánh (Hotel SaaS Platform)  
> **Đơn vị:** Khoa Công Nghệ Thông Tin — Trường Đại Học Sư Phạm Kỹ Thuật TP.HCM (HCMUTE)  
> **Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân  
> **Nhóm thực hiện:** Nhóm Đồ Án 578 (Ngô Võ Tuấn An, Nguyễn Khởi Nguyên, Trần Trọng Tân)

---

## 🗺️ SƠ ĐỒ CÂY THƯ MỤC TÀI LIỆU (DOCUMENTATION TREE)

Toàn bộ tài liệu kỹ thuật của dự án đã được quy hoạch khoa học thành **10 chuyên mục chuyên biệt**, không để file trôi nổi ngoài thư mục gốc:

```
docs/
├── 📂 srs/              # 1. Đặc tả Yêu cầu Phần mềm (8 tài liệu chuẩn HCMUTE)
├── 📂 sdd/              # 2. Thiết kế Kiến trúc Hệ thống (11 tài liệu C4, ERD, API...)
├── 📂 reports/          # 3. Báo cáo Tiến độ Cá nhân & Tổng hợp Nhóm (Tuần 1, Tuần 2...)
├── 📂 weekly-reports/   # 4. Sổ Theo Dõi Tiến Độ Hằng Tuần nộp GVHD
├── 📂 specs/            # 5. Đặc tả Kỹ thuật Phân kỳ Chi tiết (P0, P1A, P1B, P2A, P3A, P5)
├── 📂 guidelines/       # 6. Quy chuẩn Lập trình, Git Workflow & Rubric Đánh Giá
├── 📂 team/             # 7. Kế hoạch Làm Việc Nhóm, Roadmap & Đặc Tả Từng Phân Hệ
├── 📂 ai-usage-log/     # 8. Nhật ký Sử dụng Trí tuệ Nhân tạo Minh bạch
├── 📂 test-plan/        # 9. Kế hoạch & Chiến lược Kiểm thử Tự động
└── 📂 resources/        # 10. Dữ liệu Tham chiếu Nghiệp vụ (Địa giới hành chính 2 cấp)
```

---

## 📋 1. ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS - SOFTWARE REQUIREMENTS SPECIFICATION)

Thư mục: [`docs/srs/`](srs/) — Bộ hồ sơ phân tích nghiệp vụ chuẩn học thuật:

| STT | Tài Liệu | Nội Dung Chính |
|:---:|:---|:---|
| 01 | [`01-market-research.md`](srs/01-market-research.md) | Nghiên cứu thị trường phần mềm khách sạn tại Việt Nam, phân tích đối thủ cạnh tranh. |
| 02 | [`02-actors-personas.md`](srs/02-actors-personas.md) | Định nghĩa các tác nhân: System Admin, Hotel Owner, Receptionist, Housekeeper, Guest. |
| 03 | [`03-user-stories.md`](srs/03-user-stories.md) | Danh sách User Stories chi tiết theo từng vai trò người dùng kèm tiêu chí chấp nhận (DoD). |
| 04 | [`04-business-processes.md`](srs/04-business-processes.md) | Sơ đồ BPMN luồng nghiệp vụ: Đặt phòng quầy, Đặt OTA, Check-in/out, Điều phối buồng phòng. |
| 05 | [`05-business-rules.md`](srs/05-business-rules.md) | Bộ quy tắc nghiệp vụ: Đặt cọc, hủy phòng, tính giá theo giờ/đêm, phụ thu nhận sớm/trả trễ. |
| 06 | [`06-data-dictionary.md`](srs/06-data-dictionary.md) | Từ điển dữ liệu chuẩn hóa toàn bộ các trường, kiểu dữ liệu, ràng buộc và ý nghĩa nghiệp vụ. |
| 07 | [`07-non-functional-requirements.md`](srs/07-non-functional-requirements.md) | Yêu cầu phi chức năng: Hiệu năng (<200ms), An toàn bảo mật (Multi-tenant, Bitmask RBAC), Tính sẵn sàng. |
| 08 | [`08-kpi-commitment.md`](srs/08-kpi-commitment.md) | Cam kết chỉ số KPI kỹ thuật và chỉ số nghiệp vụ của đồ án. |

---

## 📐 2. THIẾT KẾ KIẾN TRÚC HỆ THỐNG (SDD - SOFTWARE DESIGN DESCRIPTION)

Thư mục: [`docs/sdd/`](sdd/) — Thiết kế hệ thống theo chuẩn quốc tế C4 Model & IEEE:

| STT | Tài Liệu | Nội Dung Chính |
|:---:|:---|:---|
| 01 | [`01-erd.md`](sdd/01-erd.md) | Sơ đồ quan hệ thực thể cơ sở dữ liệu PostgreSQL (20 Entities, quan hệ 1-N, N-N, khóa ngoại). |
| 02 | [`02-architecture-overview.md`](sdd/02-architecture-overview.md) | Tổng quan kiến trúc Clean Architecture 4 tầng (.NET 10 WebApi $\leftarrow$ Infrastructure $\leftarrow$ Application $\leftarrow$ Domain). |
| 03 | [`03-c4-diagrams.md`](sdd/03-c4-diagrams.md) | Biểu đồ kiến trúc C4 Model: Context (C1), Container (C2), Component (C3). |
| 04 | [`04-sequence-diagrams.md`](sdd/04-sequence-diagrams.md) | Sơ đồ tuần tự (Sequence Diagram) các luồng: Đăng nhập đa chi nhánh, Đặt phòng, Đổi trạng thái buồng phòng. |
| 05 | [`05-rbac-design.md`](sdd/05-rbac-design.md) | Kiến trúc phân quyền Bitmask RBAC 64-bit tối ưu tốc độ kiểm tra quyền O(1) không cần join bảng. |
| 06 | [`06-api-design.md`](sdd/06-api-design.md) | Đặc tả danh mục RESTful API endpoints, Request/Response payload, HTTP status codes. |
| 07 | [`07-ui-ux-design.md`](sdd/07-ui-ux-design.md) | Hệ thống Design System Luxury Minimalist, bảng mã màu, Typography, Responsive breakpoint. |
| 08 | [`08-deployment-diagram.md`](sdd/08-deployment-diagram.md) | Mô hình triển khai hạ tầng Docker Compose (PostgreSQL 17, Redis Cache, Backend API, Frontend SPA). |
| 09 | [`09-security-design.md`](sdd/09-security-design.md) | Thiết kế an toàn thông tin: JWT Token Rotation chống Replay Attack, EF Core Interceptor cách ly Tenant. |
| 10 | [`10-payment-subscription.md`](sdd/10-payment-subscription.md) | Kiến trúc cổng thanh toán, thanh toán gói SaaS Tenant và bảng kê hóa đơn Folio. |
| 11 | [`11-speckit-ai-reports-subscription-plan.md`](sdd/11-speckit-ai-reports-subscription-plan.md) | Đặc tả tích hợp SpecKit: AI Concierge Assistant, Báo cáo KPI nâng cao và Quản lý hạn ngạch SaaS. |

---

## 📊 3. HỒ SƠ BÁO CÁO TIẾN ĐỘ & SỔ THEO DÕI TUẦN

### 3.1. Thư mục Báo Cáo Chi Tiết: [`docs/reports/`](reports/)
* [`BAO-CAO-TONG-HOP-TUAN-1-NHOM-HCMUTE.md`](reports/BAO-CAO-TONG-HOP-TUAN-1-NHOM-HCMUTE.md): Báo cáo tổng hợp toàn bộ kết quả Tuần 1 của nhóm 3 thành viên kèm link GitHub blob và commit verbatim.
* [`BAO-CAO-TUAN-1-NGO-VO-TUAN-AN-24TX810001.md`](reports/BAO-CAO-TUAN-1-NGO-VO-TUAN-AN-24TX810001.md): Báo cáo cá nhân Ngô Võ Tuấn An (Nhóm trưởng - Kiến trúc Clean Architecture, Auth RBAC, CI/CD).
* [`BAO-CAO-TUAN-1-NGUYEN-KHOI-NGUYEN-24TX810011.md`](reports/BAO-CAO-TUAN-1-NGUYEN-KHOI-NGUYEN-24TX810011.md): Báo cáo cá nhân Nguyễn Khởi Nguyên (CRUD Hạng phòng, Phòng vật lý, Utilities).
* [`BAO-CAO-TUAN-1-TRAN-TRONG-TAN-24TX810025.md`](reports/BAO-CAO-TUAN-1-TRAN-TRONG-TAN-24TX810025.md): Báo cáo cá nhân Trần Trọng Tân (FSM Buồng phòng, Khóa đồng thời Concurrency, Housekeeping Board).
* [`BAO_CAO_CHAM_DIEM_UI_UX_13_MAN_HINH.md`](reports/BAO_CAO_CHAM_DIEM_UI_UX_13_MAN_HINH.md): Bảng đánh giá và chấm điểm giao diện 13 màn hình toàn hệ thống.

### 3.2. Sổ Theo Dõi Tiến Độ Hằng Tuần: [`docs/weekly-reports/`](weekly-reports/)
* [`week-01.md`](weekly-reports/week-01.md): Sổ theo dõi tiến độ Tuần 01 nộp Giảng viên hướng dẫn ký duyệt.

---

## ⚙️ 4. ĐẶC TẢ KỸ THUẬT PHÂN KỲ (PHASE SPECIFICATIONS)

Thư mục: [`docs/specs/`](specs/) — Hồ sơ kỹ thuật phục vụ triển khai code qua các phân kỳ:

| Phân Kỳ | Tài Liệu | Nội Dung Triển Khai |
|:---:|:---|:---|
| **Phase 0** | [`p0-decisions.md`](specs/p0-decisions.md) | Biên bản quyết định công nghệ: .NET 10, PostgreSQL 17, Redis, Angular 22 Signals, Tailwind. |
| **Phase 1A** | [`p1a-foundation-architecture-design.md`](specs/p1a-foundation-architecture-design.md) | Thiết kế kiến trúc nền tảng, Data Isolation, Bitmask RBAC. |
| **Phase 1A** | [`p1a-reviewer-findings-resolution.md`](specs/p1a-reviewer-findings-resolution.md) | Báo cáo rà soát và khắc phục các phát hiện phản biện kiến trúc nền tảng. |
| **Phase 1B** | [`p1b-01a-migration-plan.md`](specs/p1b-01a-migration-plan.md) | Kế hoạch di trú dữ liệu và nâng cấp schema EF Core. |
| **Phase 1B** | [`p1b-02a-context-authorization-design.md`](specs/p1b-02a-context-authorization-design.md) | Thiết kế middleware phân giải ngữ cảnh Tenant/Property đa chi nhánh. |
| **Phase 2A** | [`p2a-room-pricing-design.md`](specs/p2a-room-pricing-design.md) | Đặc tả công thức tính giá phòng đa tầng (theo giờ, theo đêm, ngày lễ, phụ thu). |
| **Phase 3A** | [`p3a-reservation-change-spec.md`](specs/p3a-reservation-change-spec.md) | Đặc tả luồng thay đổi đơn đặt phòng, hoàn hủy và hoàn tiền. |
| **Phase 5** | [`p5-guest-search-contract-proposal.md`](specs/p5-guest-search-contract-proposal.md) | Hợp đồng API tìm kiếm phòng công khai cho khách vãng lai (Public OTA Search). |

---

## 📖 5. QUY CHUẨN LẬP TRÌNH & QUY TRÌNH (GUIDELINES & CONVENTIONS)

Thư mục: [`docs/guidelines/`](guidelines/):

* [`coding-convention.md`](guidelines/coding-convention.md): Quy chuẩn viết mã C# .NET 10 (File-scoped namespace, XML doc, sealed class) và TypeScript Angular.
* [`git-workflow.md`](guidelines/git-workflow.md): Quy trình phân nhánh Git Flow chuẩn mực (`main`, `develop`, `feature/*`), quy tắc Pull Request và Merge commit.
* [`implementation-phases.md`](guidelines/implementation-phases.md): Lộ trình triển khai tổng thể từ Phase 0 đến Phase 5.
* [`rubric-self-assessment.md`](guidelines/rubric-self-assessment.md): Bảng tự đánh giá đồ án đối chiếu theo thang điểm Rubric của Khoa CNTT - HCMUTE.
* [`references.md`](guidelines/references.md): Danh mục tài liệu tham khảo học thuật và tiêu chuẩn kỹ thuật quốc tế.

---

## 👥 6. HỒ SƠ PHỐI HỢP NHÓM (TEAM WORKSPACE)

Thư mục: [`docs/team/`](team/):

* [`KE-HOACH-CHI-TIET-TUAN-2.md`](team/KE-HOACH-CHI-TIET-TUAN-2.md): Kế hoạch phân công nhiệm vụ chi tiết Tuần 2 cho 3 thành viên (An, Nguyên, Tân).
* [`ROADMAP-CHI-TIET-3-THANH-VIEN.md`](team/ROADMAP-CHI-TIET-3-THANH-VIEN.md): Lộ trình làm việc song song 3 nhánh trong suốt 10 tuần đồ án.
* [`PHAN_TICH_DOI_CHIEU_HE_THONG_CU_SANG_SAAS_V2.md`](team/PHAN_TICH_DOI_CHIEU_HE_THONG_CU_SANG_SAAS_V2.md): Bảng đối chiếu nâng cấp tính năng từ đồ án cũ sang kiến trúc SaaS v2.
* [`task-board.md`](team/task-board.md): Bảng theo dõi trạng thái công việc (To Do, In Progress, In Review, Done).
* [`review-checklist.md`](team/review-checklist.md): Danh mục kiểm tra chéo (Peer Review) trước khi merge code.
* **Thư mục Phân Hệ Chuyên Sâu ([`docs/team/modules/`](team/modules/)):**
  * [`rooms.md`](team/modules/rooms.md): Phân hệ Quản lý Phòng vật lý.
  * [`room-types.md`](team/modules/room-types.md): Phân hệ Quản lý Hạng phòng.
  * [`housekeeping.md`](team/modules/housekeeping.md): Phân hệ Điều phối Buồng phòng.
  * [`room-type-rates.md`](team/modules/room-type-rates.md): Phân hệ Bảng giá phòng.
  * [`property-policies.md`](team/modules/property-policies.md): Phân hệ Chính sách chi nhánh.
  * [`staff-management.md`](team/modules/staff-management.md): Phân hệ Quản lý Nhân sự & Phân quyền.

---

## 🤖 7. NHẬT KÝ SỬ DỤNG AI & KIỂM THỬ

* [`docs/ai-usage-log/ai-usage-log.md`](ai-usage-log/ai-usage-log.md): Nhật ký kiểm toán sử dụng AI (AI Usage Audit Log) chi tiết từng prompt, output, phản biện và khắc phục ảo giác của cả 3 thành viên.
* [`docs/test-plan/01-test-strategy.md`](test-plan/01-test-strategy.md): Chiến lược kiểm thử phần mềm 4 tầng: Unit Test, Integration Test, WebApi Pipeline Test, Frontend Spec.
* [`docs/legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md`](legacy-analysis/TONG-HOP-NGHIEP-VU-TU-DU-AN-CU.md): Báo cáo trích xuất và kế thừa các nghiệp vụ cốt lõi từ dự án cũ.

---

## 📦 8. TÀI NGUYÊN NGHIỆP VỤ THAM CHIẾU (RESOURCES & DATA)

Thư mục: [`docs/resources/`](resources/):

* `DMTinhThanh_2Cap.csv`: Danh mục 63 Tỉnh/Thành phố trực thuộc Trung ương chuẩn hóa 2 cấp Việt Nam.
* `DMXaPhuong_2Cap.csv`: Danh mục 10.051 Xã/Phường/Thị trấn chuẩn hóa 2 cấp Việt Nam.
* *(Ghi chú: Bản nhúng chính thức cho runtime đã được nạp tự động vào `backend/src/HotelSaas.Infrastructure/Resources/Locations/`)*.
