# 📋 Sổ theo dõi tiến độ hằng tuần

> **Rubric mapping:** Quy trình Bước 3 (báo cáo ≥1 lần/tuần), TC2.4 Mức 5
> **Yêu cầu:** Tần suất ≥ 1.0 lần/tuần để đạt Mức 5

---

## Mẫu báo cáo tuần

Mỗi tuần, nhóm sử dụng template dưới đây để báo cáo cho GVHD:

```
╔══════════════════════════════════════════════════════════════╗
║              BÁO CÁO TIẾN ĐỘ TUẦN [SỐ TUẦN]               ║
╠══════════════════════════════════════════════════════════════╣
║ Đề tài: Hệ thống quản lý khách sạn / nhà nghỉ SaaS + RBAC ║
║ Nhóm:   [TÊN NHÓM]                                         ║
║ Tuần:   [DD/MM] → [DD/MM/YYYY]                             ║
║ GVHD:   [TÊN GIẢNG VIÊN]                                   ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Tuần 1: [DD/MM] → [DD/MM/YYYY]

### Công việc đã hoàn thành

| # | Task | Người thực hiện | Trạng thái | Commit/PR |
|---|------|----------------|:----------:|-----------|
| 1 | Phân tích rubric, lập execution plan | [Tên] | ✅ Done | — |
| 2 | Tạo SRS: Market Research (01) | [Tên] | ✅ Done | — |
| 3 | Tạo SRS: Actors & Personas (02) | [Tên] | ✅ Done | — |
| 4 | Tạo SRS: User Stories (03) | [Tên] | ✅ Done | — |
| 5 | Tạo SRS: Business Processes BPMN (04) | [Tên] | ✅ Done | — |
| 6 | Tạo SRS: Business Rules & Policies (05) | [Tên] | ✅ Done | — |
| 7 | Tạo SRS: Data Dictionary (06) | [Tên] | ✅ Done | — |
| 8 | Tạo SRS: NFR (07) | [Tên] | ✅ Done | — |
| 9 | Tạo SRS: KPI & Commitment (08) | [Tên] | ✅ Done | — |
| 10 | Tạo SDD: ERD (01) | [Tên] | ✅ Done | — |
| 11 | Tạo SDD: Architecture Overview + 5 ADR (02) | [Tên] | ✅ Done | — |
| 12 | Tạo SDD: C4 Diagrams (03) | [Tên] | ✅ Done | — |
| 13 | Tạo SDD: Sequence Diagrams (04) | [Tên] | ✅ Done | — |
| 14 | Tạo SDD: RBAC Design (05) | [Tên] | ✅ Done | — |
| 15 | Tạo SDD: API Design 80 endpoints (06) | [Tên] | ✅ Done | — |
| 16 | Tạo SDD: UI/UX Design Direction (07) | [Tên] | ✅ Done | — |
| 17 | Tạo SDD: Deployment + CI/CD (08) | [Tên] | ✅ Done | — |
| 18 | Tạo SDD: Security Design + OWASP (09) | [Tên] | ✅ Done | — |
| 19 | Tạo SDD: Payment & Subscription (10) | [Tên] | ✅ Done | — |
| 20 | Scaffold backend .NET 10 (7 projects, build OK) | [Tên] | ✅ Done | — |
| 21 | Scaffold frontend Angular 22 | [Tên] | ✅ Done | — |
| 22 | Tạo Docker Compose (PostgreSQL, Redis, Seq, pgAdmin) | [Tên] | ✅ Done | — |
| 23 | Tạo CI/CD pipeline 6 stages | [Tên] | ✅ Done | — |
| 24 | Tạo Agent Rules (.gemini/rules/) | [Tên] | ✅ Done | — |
| 25 | Tạo Coding Convention + Git Workflow | [Tên] | ✅ Done | — |
| 26 | Tạo References (43 nguồn thực) | [Tên] | ✅ Done | — |

### AI Usage Log (Tuần 1)

| Thời gian | Công cụ | Phạm vi | Prompt chính | Output | Đã kiểm chứng? |
|----------|---------|---------|-------------|--------|:--------------:|
| 03/10 | Google Antigravity (Gemini) | Phân tích rubric | "Đọc rubric, phân tích yêu cầu, lập execution plan" | Execution plan 4 phases | ✅ Review & adjust |
| 03/10 | Google Antigravity (Gemini) | SRS documents | "Tạo market research, personas, user stories..." | 8 SRS documents | ✅ Review nội dung |
| 03/10 | Google Antigravity (Gemini) | SDD documents | "Tạo ERD, C4, sequence diagrams, API design..." | 10 SDD documents | ✅ Đối chiếu code |
| 03/10 | Google Antigravity (Gemini) | Code scaffold | "Scaffold .NET 10 backend Clean Architecture" | 7 projects, build OK | ✅ Build & verify |
| 03/10 | Web Search | References | Search VNPay, Cloudbeds, Mews, OWASP, PostgreSQL... | 43 verified links | ✅ Click kiểm tra |

### Vướng mắc

| # | Vấn đề | Giải quyết |
|---|--------|-----------|
| 1 | OneDrive junction path không tạo được folder mới | Chuyển project ra C:\Dev\hotel-saas-v2 |
| 2 | PrimeNG v22 chuyển sang commercial license | Cân nhắc OpenNG (Optimus UI) hoặc Angular Material |

### Kế hoạch tuần tiếp theo

| # | Task | Người thực hiện | Ước lượng |
|---|------|----------------|----------|
| 1 | Init Git repo, first commit | [Tên] | 0.5h |
| 2 | Implement Auth module (Register, Login, JWT, Refresh) | [Tên] | 8h |
| 3 | Implement RBAC (Roles, Permissions, Middleware) | [Tên] | 8h |
| 4 | Unit tests cho Auth + RBAC | [Tên] | 4h |
| 5 | Frontend: Auth pages (Login, Register) | [Tên] | 6h |

### Tiến độ tổng thể

```
Phase 0A (Phân tích): ████████████████████ 100%
Phase 0B (Thiết kế):  ████████████████████ 100%
Phase 0C (Rules):     ████████████████████ 100%
Phase 1 (Auth+RBAC):  ░░░░░░░░░░░░░░░░░░░░   0%
Phase 2 (Core):       ░░░░░░░░░░░░░░░░░░░░   0%
Phase 3 (Advanced):   ░░░░░░░░░░░░░░░░░░░░   0%
Phase 4 (AI+Polish):  ░░░░░░░░░░░░░░░░░░░░   0%
Phase 5 (Deploy+UAT): ░░░░░░░░░░░░░░░░░░░░   0%
```

### Xác nhận

```
Sinh viên: _________________ (ký)     Ngày: ___/___/______

GVHD:      _________________ (ký)     Ngày: ___/___/______
```

---

## Template tuần trống (copy để dùng)

<details>
<summary>📋 Click để mở template</summary>

```markdown
## Tuần [N]: [DD/MM] → [DD/MM/YYYY]

### Công việc đã hoàn thành

| # | Task | Người thực hiện | Trạng thái | Commit/PR |
|---|------|----------------|:----------:|-----------|
| 1 | ... | [Tên] | ✅/🔄/❌ | PR #... |

### AI Usage Log (Tuần N)

| Thời gian | Công cụ | Phạm vi | Prompt chính | Output | Đã kiểm chứng? |
|----------|---------|---------|-------------|--------|:--------------:|
| ... | ... | ... | ... | ... | ✅/❌ |

### Vướng mắc

| # | Vấn đề | Giải quyết |
|---|--------|-----------|
| 1 | ... | ... |

### Kế hoạch tuần tiếp theo

| # | Task | Người thực hiện | Ước lượng |
|---|------|----------------|----------|
| 1 | ... | [Tên] | ...h |

### Tiến độ tổng thể

Phase 0: ████████████████████ 100%
Phase 1: ██████░░░░░░░░░░░░░░  30%
...

### Xác nhận
Sinh viên: _________________ Ngày: ___/___/______
GVHD:      _________________ Ngày: ___/___/______
```

</details>

---

*Tài liệu này phục vụ Quy trình Bước 3 (sổ theo dõi hằng tuần) và TC2.3 (AI Usage Log tích hợp).*
