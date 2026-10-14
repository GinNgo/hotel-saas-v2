# ⚙️ Yêu cầu phi chức năng (Non-Functional Requirements)

> **Tài liệu:** SRS-07 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 Mức 5 (≥5 NFR có ràng buộc định lượng)

---

## Tổng quan

Tài liệu này xác định các yêu cầu phi chức năng (NFR) với **ràng buộc định lượng đo được**, là cơ sở để kiểm thử và nghiệm thu hệ thống.

---

## NFR-01: Performance (Hiệu năng)

| Chỉ số | Ràng buộc | Cách đo |
|--------|-----------|---------|
| API response time P50 | ≤ 150ms | APM monitoring (Serilog + metrics) |
| API response time P95 | ≤ 300ms | APM monitoring |
| API response time P99 | ≤ 1000ms | APM monitoring |
| Page load time (First Contentful Paint) | ≤ 2s | Lighthouse CI |
| Time to Interactive (TTI) | ≤ 3s | Lighthouse CI |
| Database query time P95 | ≤ 100ms | EF Core logging |

**Điều kiện test:** Network 4G (1.6 Mbps down, 0.75 Mbps up, 150ms RTT)

---

## NFR-02: Scalability (Khả năng mở rộng)

| Chỉ số | Ràng buộc | Cách đo |
|--------|-----------|---------|
| Concurrent users | ≥ 50 users đồng thời | Load testing (k6 / Artillery) |
| Concurrent tenants | ≥ 20 tenants hoạt động | Load testing |
| Database size | ≥ 100,000 reservations | Seed data + performance test |
| API throughput | ≥ 100 req/s (read endpoints) | Load testing |

---

## NFR-03: Security (Bảo mật)

| Chỉ số | Ràng buộc | Cách đo |
|--------|-----------|---------|
| OWASP Top 10 | 0 critical/high vulnerabilities | OWASP ZAP scan |
| Secrets in repo | 0 leaked secrets | Gitleaks CI scan |
| Password hashing | bcrypt ≥ 10 rounds | Code review |
| JWT expiry | Access: 30 min, Refresh: 7 days | Configuration audit |
| CORS | Whitelist origins only | Config review |
| Input validation | 100% endpoints validated | FluentValidation + review |
| SQL Injection | 0 raw SQL queries | EF Core parameterized + review |
| XSS | 0 unescaped user input | Angular auto-sanitize + review |
| Rate limiting | ≤ 100 req/min per IP on auth endpoints | Middleware + test |
| Data encryption | TLS 1.2+ in transit | SSL Labs test |

---

## NFR-04: Availability (Khả dụng)

| Chỉ số | Ràng buộc | Cách đo |
|--------|-----------|---------|
| Uptime (staging) | ≥ 99% (measured weekly) | Health check endpoint monitoring |
| Recovery time | ≤ 30 phút từ failure | DR drill |
| Data backup | Daily automated | Docker volume backup |
| Health check endpoint | `/health` returns 200 within 5s | Monitoring |

---

## NFR-05: Usability (Tính dùng được)

| Chỉ số | Ràng buộc | Cách đo |
|--------|-----------|---------|
| System Usability Scale (SUS) | ≥ 68 (target ≥ 80) | SUS questionnaire (≥10 users) |
| Task success rate | ≥ 85% | Usability testing |
| Check-in time | ≤ 2 phút | Task timing |
| Booking creation time | ≤ 3 phút | Task timing |
| Error rate per task | ≤ 1 error/task | Observation |
| Learnability | Hoàn thành task đầu tiên ≤ 5 phút | First-use testing |

---

## NFR-06: Accessibility (Khả năng tiếp cận)

| Chỉ số | Ràng buộc | Cách đo |
|--------|-----------|---------|
| WCAG compliance | Level AA | axe-core audit |
| Keyboard navigation | 100% features accessible | Manual testing |
| Color contrast | ≥ 4.5:1 (normal text) | Contrast checker |
| Screen reader | Semantic HTML + ARIA labels | Manual testing |
| Lighthouse Accessibility score | ≥ 80 | Lighthouse CI |

---

## NFR-07: Internationalization (Đa ngôn ngữ)

| Chỉ số | Ràng buộc | Cách đo |
|--------|-----------|---------|
| Languages supported | Vietnamese (vi) + English (en) | i18n file check |
| Translation coverage | 100% UI strings in i18n files | Lint check |
| Date/time format | Locale-aware (dd/MM/yyyy VN, MM/dd/yyyy EN) | Unit test |
| Currency format | VND (đ) + USD ($) | Unit test |
| Search | Hỗ trợ tìm kiếm không dấu tiếng Việt | Integration test |

---

## NFR-08: Maintainability (Khả năng bảo trì)

| Chỉ số | Ràng buộc | Cách đo |
|--------|-----------|---------|
| Code test coverage | ≥ 70% (core modules) | Coverage report |
| Lint errors | ≤ 5/1000 LOC | ESLint + Roslyn analyzers |
| Cyclomatic complexity | ≤ 15 per method | SonarQube |
| Code duplication | ≤ 3% | SonarQube |
| Documentation | 100% public API docstrings | Build warnings |
| Git commit frequency | ≥ 75% weeks with commits | Git log analysis |
| PR review rate | ≥ 60% changes via reviewed PR | GitHub stats |

---

## NFR-09: Reliability (Độ tin cậy)

| Chỉ số | Ràng buộc | Cách đo |
|--------|-----------|---------|
| Error rate | ≤ 0.1% of requests return 5xx | APM monitoring |
| Data consistency | 0 double bookings | Concurrency test |
| Idempotency | Payment operations idempotent | Integration test |
| Graceful degradation | AI features fail → system vẫn hoạt động | Manual test |

---

## Traceability Matrix: NFR → Test

| NFR | Loại test | Giai đoạn test | Tool |
|-----|----------|---------------|------|
| NFR-01 | Performance | Phase 5 | k6, Lighthouse CI |
| NFR-02 | Load | Phase 5 | k6, Artillery |
| NFR-03 | Security | Phase 5 | OWASP ZAP, Gitleaks |
| NFR-04 | Monitoring | Phase 5 | Health checks, Docker |
| NFR-05 | Usability | Phase 5 | SUS questionnaire |
| NFR-06 | Accessibility | Phase 3+ | axe-core, Lighthouse |
| NFR-07 | i18n | Phase 2+ | Unit tests, lint |
| NFR-08 | Quality | Continuous | SonarQube, coverage |
| NFR-09 | Reliability | Phase 4+ | Concurrency tests |

---

*Tài liệu này là phần của bộ SRS, phục vụ tiêu chí TC2.1 Mức 5 (≥5 NFR có ràng buộc định lượng). Đã liệt kê 9 NFR với tổng 40+ ràng buộc đo được.*
