# 🏛️ Architecture Overview & Technology Justification

> **Tài liệu:** SDD-02 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.1 Mức 5 (giải thích phương án đã cân nhắc)

---

## 1. Clean Architecture — Tại sao?

### Các phương án đã cân nhắc

| Kiến trúc | Ưu điểm | Nhược điểm | Quyết định |
|----------|---------|-----------|-----------|
| **Clean Architecture (4 layers)** | Tách biệt concerns rõ ràng, testable, domain-centric | Nhiều project/folder hơn, boilerplate | ✅ **CHỌN** |
| N-Layer (3 tiers) | Đơn giản, ít code | Domain logic lẫn infrastructure | ❌ |
| Vertical Slice | Feature-centric, ít coupling | Khó enforce consistency, unfamiliar | ❌ |
| Microservices | Scale tốt, tech diversity | Quá phức tạp cho đồ án, ops overhead | ❌ |

### Lý do chọn Clean Architecture

```mermaid
flowchart TD
    subgraph Domain["📦 Domain Layer<br/>(Innermost — no dependencies)"]
        E["Entities"]
        VO["Value Objects"]
        EN["Enums"]
        IF["Interfaces"]
    end

    subgraph Application["⚙️ Application Layer"]
        CMD["Commands (CQRS)"]
        QRY["Queries (CQRS)"]
        DTO["DTOs"]
        VAL["Validators"]
    end

    subgraph Infra["🔧 Infrastructure Layer"]
        DB["EF Core + PostgreSQL"]
        SVC["External Services"]
        BG["Background Jobs"]
    end

    subgraph API["🌐 WebAPI Layer<br/>(Outermost)"]
        CTR["Controllers"]
        MW["Middleware"]
        HUB["SignalR Hubs"]
    end

    API -->|depends on| Application
    API -->|depends on| Infra
    Application -->|depends on| Domain
    Infra -->|depends on| Application
    Infra -.->|implements| Domain

    style Domain fill:#e8f5e9
    style Application fill:#e3f2fd
    style Infra fill:#fff3e0
    style API fill:#fce4ec
```

**Dependency Rule:** Dependencies chỉ đi vào trong (API → Application → Domain). Infrastructure implements interfaces của Domain/Application — **không** phụ thuộc ngược.

---

## 2. CQRS + MediatR — Tại sao?

| Phương án | Ưu điểm | Nhược điểm | Quyết định |
|----------|---------|-----------|-----------|
| **CQRS + MediatR** | Tách read/write, pipeline behaviors (validation, logging), thin controllers | Learning curve, boilerplate | ✅ **CHỌN** |
| Service Layer (truyền thống) | Đơn giản, quen thuộc | Fat services, khó test riêng | ❌ |
| Repository + Unit of Work | Abstraction tốt | Thêm layer không cần (EF Core đã là UoW) | ❌ |

### Flow: Controller → MediatR → Handler

```mermaid
sequenceDiagram
    participant C as Controller
    participant M as MediatR
    participant V as ValidationBehavior
    participant H as CommandHandler
    participant DB as DbContext

    C->>M: Send(CreateReservationCommand)
    M->>V: Pipeline: Validate command
    V-->>V: FluentValidation rules
    alt Validation fails
        V-->>C: 400 Bad Request
    end
    V->>H: Pass to handler
    H->>DB: Save reservation
    DB-->>H: Success
    H-->>C: ReservationDto
```

---

## 3. Technology Justification — Bảng so sánh đầy đủ

| Thành phần | **Chọn** | Thay thế 1 | Thay thế 2 | Lý do chọn |
|-----------|---------|-----------|-----------|-----------|
| Backend | **.NET 10** | Spring Boot | NestJS | Type-safe, hiệu năng, EF Core mạnh, đề tài yêu cầu |
| Frontend | **Angular 22** | React 19 | Vue 3 | DI system, built-in routing/forms/i18n, enterprise SPA, đề tài yêu cầu |
| Database | **PostgreSQL 17** | SQL Server Express | MySQL 8 | Free mọi feature, JSONB, free hosting (Supabase/Neon), Docker nhẹ |
| ORM | **EF Core 10** | Dapper | Raw SQL | Code-first, Global Query Filter (multi-tenant), LINQ, migrations |
| CQRS | **MediatR 14** | Custom mediator | No CQRS | Mature, pipeline behaviors, thin controllers |
| Validation | **FluentValidation 12** | Data Annotations | Custom | Fluent API, testable, complex rules |
| Auth | **JWT + Refresh Token** | Cookie session | Keycloak | Stateless, SPA-friendly, simple, đã proven |
| RBAC | **Custom Bitmask** | ASP.NET Identity Roles | Casbin | O(1) check, tenant-scoped, linh hoạt |
| Realtime | **SignalR** | Socket.io | SSE | Native .NET, auto-reconnect, Hub pattern |
| UI Library | **PrimeNG 21** | Angular Material | Tailwind UI | 90+ components, theming, enterprise-grade |
| Charts | **Chart.js** | D3.js | ApexCharts | Đơn giản, đẹp, có Angular wrapper |
| Maps | **Leaflet** | Google Maps | Mapbox | Free, open source, nhẹ |
| i18n | **ngx-translate** | Angular i18n | Transloco | Runtime switching, JSON files, dễ dùng |
| Testing BE | **xUnit** | NUnit | MSTest | .NET standard, fixture-based, assertive |
| Testing FE | **Playwright** | Cypress | Selenium | Cross-browser, auto-wait, codegen, Microsoft |
| CI/CD | **GitHub Actions** | GitLab CI | Jenkins | Free, native GitHub, marketplace |
| Container | **Docker Compose** | Podman | K8s | Đơn giản, phù hợp team nhỏ |
| Logging | **Serilog → Seq** | NLog | log4net | Structured logging, rich UI, .NET standard |
| AI | **Gemini API** | OpenAI GPT | Claude API | Free tier generous, multimodal, Google ecosystem |

---

## 4. Multi-tenant Strategy

| Strategy | Ưu điểm | Nhược điểm | Quyết định |
|----------|---------|-----------|-----------|
| **Shared DB + Shared Schema** | Đơn giản, cost-effective, 1 deployment | Data isolation qua code | ✅ **CHỌN** |
| Shared DB + Separate Schema | Isolation tốt hơn | Migration phức tạp | ❌ |
| Separate DB per Tenant | Isolation tốt nhất | Cost cao, ops phức tạp | ❌ |

**Implementation:** EF Core Global Query Filters tự động append `WHERE TenantId = @current` cho mọi query trên ITenantScopedEntity.

---

## 5. ADR (Architecture Decision Records)

### ADR-001: Clean Architecture

| Mục | Nội dung |
|-----|---------|
| **Status** | Accepted |
| **Context** | Cần kiến trúc tách biệt business logic khỏi infrastructure |
| **Decision** | Áp dụng Clean Architecture 4 layers: Domain → Application → Infrastructure → WebAPI |
| **Consequences** | (+) Testable, maintainable, domain-centric. (−) Nhiều project, boilerplate |

### ADR-002: PostgreSQL over SQL Server

| Mục | Nội dung |
|-----|---------|
| **Status** | Accepted |
| **Context** | Cần database cho staging deploy miễn phí, Docker CI nhanh |
| **Decision** | PostgreSQL 17 qua Npgsql provider |
| **Consequences** | (+) Free hosting (Supabase), Docker nhẹ 200MB, JSONB. (−) Team cần học pgAdmin |

### ADR-003: Bitmask RBAC

| Mục | Nội dung |
|-----|---------|
| **Status** | Accepted |
| **Context** | Cần RBAC linh hoạt, tenant-scoped, hiệu năng cao |
| **Decision** | Custom bitmask permissions (14 functions × 7 actions = int mask) |
| **Consequences** | (+) O(1) check, tùy biến, proven từ v1. (−) Custom code, không dùng Identity Roles |

### ADR-004: CQRS + MediatR

| Mục | Nội dung |
|-----|---------|
| **Status** | Accepted |
| **Context** | Controllers v1 quá fat, business logic trong controller |
| **Decision** | MediatR cho CQRS pattern, 1 handler per use case |
| **Consequences** | (+) Thin controllers, testable, pipeline behaviors. (−) Boilerplate, learning curve |

### ADR-005: Gemini API for AI

| Mục | Nội dung |
|-----|---------|
| **Status** | Accepted |
| **Context** | Cần AI cho chatbot + dynamic pricing, budget hạn chế |
| **Decision** | Gemini 2.5 Flash qua google-genai SDK |
| **Consequences** | (+) Free tier generous, function calling, multimodal. (−) Google dependency |

---

*Tài liệu này phục vụ TC2.1 Mức 5 (giải thích phương án đã cân nhắc) + 5 ADR records.*
