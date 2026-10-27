# AI Agent Development Guidelines & Engineering Standards (AGENTS.md)
## Hotel SaaS Platform v2 (.NET 10 + Angular 22 + PostgreSQL 17)

This document establishes the technical specifications, coding standards, and architectural constraints for AI coding assistants and software engineers contributing to the **Hotel SaaS Platform** repository.

---

## 1. Architectural Foundation & Layering Constraints

The system adheres strictly to **Clean Architecture** and **Domain-Driven Design (DDD)** principles across four isolated layers:

`
[ Domain Layer ]  <-- Core entities, enums, domain exceptions, domain events (Zero dependencies)
       ^
[ Application Layer ] <-- CQRS Commands/Queries, MediatR Handlers, FluentValidation, Interfaces
       ^
[ Infrastructure Layer ] <-- EF Core, DbContext, Migrations, External Integrations, Background Jobs
       ^
[ WebApi / Presentation Layer ] <-- ASP.NET Core Minimal APIs / Controllers, Middlewares, Auth
`

### Invariant Architectural Rules:
1. **Dependency Inversion:** Outer layers depend on inner layers; inner layers never depend on outer layers.
2. **Interface Isolation:** The Application layer defines interfaces (IApplicationDbContext, ICurrentTenantService, etc.); the Infrastructure layer implements them.
3. **CQRS Pattern:**
   - Every mutation is handled by a Command (IRequest<ApiResponse<T>>) validated via FluentValidation.
   - Every data read is handled by a Query (IRequest<ApiResponse<T>>) optimized with AsNoTracking().
4. **Thin Controllers:** WebApi controllers only dispatch requests via MediatR and return standard HTTP responses (ApiResponse<T>).

---

## 2. Multi-Tenant SaaS Isolation (Fail-Closed)

The platform is an enterprise-grade multi-tenant PMS & booking engine. Cross-tenant data leakage is a critical security violation.

1. **Entity Scoping:** Every tenant-specific domain entity must implement ITenantScopedEntity (Guid TenantId { get; set; }). Property-specific entities implement IPropertyScopedEntity (Guid PropertyId { get; set; }).
2. **Global Query Filters:** All queries executed via EF Core automatically apply tenant and property filters at the DbContext level.
3. **Audit & Save Interceptor:** TenantPropertySaveChangesInterceptor automatically assigns and validates TenantId and PropertyId on entities during SaveChangesAsync().
4. **Context Injection:** Never accept TenantId or PropertyId as parameters from user payloads. Always resolve them from authenticated claims and verified request context headers (X-Tenant-Id, X-Property-Id).
5. **Fail-Closed Principle:** If a scoped request arrives without valid tenant context, the middleware must immediately reject it with HTTP 401 Unauthorized or HTTP 403 Forbidden.

---

## 3. Frontend Standards (Angular 22 Standalone Signals)

1. **Component Architecture:**
   - 100% Standalone components (standalone: true).
   - Use Angular Signals (signal(), computed(), effect()) for state management. Avoid imperative manual subscriptions.
   - Use ChangeDetectionStrategy.OnPush across all feature components.
2. **Component Reuse & Shared Registry:**
   - Always check src/app/shared/ before creating new UI elements.
   - Reuse core shared components:
     - <app-page-header> for standard page titles and action button slots.
     - <app-stat-card> for KPI and operational metric cards.
     - <app-status-badge> for lifecycle and operational status badges.
     - <app-pagination> for table/grid pagination controls.
     - <app-empty-state> for empty data placeholders.
     - {{ date | businessDate }} pipe for business timezone dates.
3. **Service Layer Isolation:**
   - Never inject HttpClient directly into components.
   - All network operations must be encapsulated in dedicated services in src/app/core/services/.
4. **Type Safety:** Maintain strict TypeScript typing. Do not use ny.

---

## 4. Git Workflow & Conventional Commits

Contributions follow a standard **Trunk-based Development Workflow**:

`
feature/<feature-name>  ──>  Pull Request  ──>  Code Review  ──>  develop  ──>  main
`

### Commit Message Convention:
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
* eat(<scope>): <description> — New feature implementation.
* ix(<scope>): <description> — Bug fix.
* efactor(<scope>): <description> — Code reorganization without functional changes.
* 	est(<scope>): <description> — Adding or updating test suites.
* docs(<scope>): <description> — Documentation updates.
* chore(<scope>): <description> — Tooling, dependencies, or configuration changes.

---

## 5. Verification & Pre-Commit Quality Gates

Before committing any changes, verify that the solution passes all automated quality gates:

`ash
# 1. Backend Verification (.NET 10)
dotnet build backend/HotelSaas.slnx --verbosity minimal
dotnet test backend/HotelSaas.slnx --no-build

# 2. Frontend Verification (Angular 22)
npm --prefix frontend run build
`

**Quality Acceptance Criteria:**
- 0 Build Errors, 0 Build Warnings.
- 100% of unit tests must pass.
- No debug scripts, temporary logs, or scratch artifacts committed.

---

## 6. Zero-Secrets Policy & Human-in-the-Loop Confirmation (Security Guardrail)

### Invariant Security Rules for AI Agents & Developers:
1. **Absolute Ban on Plaintext Secrets in Git:**
   - NEVER commit plaintext passwords, database connection strings, JWT secret keys, cloud API keys, private tokens, or sensitive credentials into any file tracked by Git.
   - All sensitive configurations must strictly use environment variables (`STAGING_DB_CONNECTION`, `ConnectionStrings__DefaultConnection`), .NET User-Secrets (`dotnet user-secrets`), or local untracked files (`appsettings.Local.json`, `.env.local`).
2. **Pre-Commit Secret Scanning:**
   - Before executing `git commit` or `git push`, the agent must verify via `git diff` that no credentials, passwords, or private connection strings are staged.
3. **Mandatory Human Confirmation (Ask Before Action):**
   - The agent MUST ALWAYS ASK AND RECEIVE EXPLICIT USER CONFIRMATION BEFORE executing any action that:
     * Rotates, modifies, or alters database passwords, API credentials, or secret keys.
     * Alters database users, permissions, access roles, or drops/resets database structures.
     * Shares or persists sensitive configuration outside local developer machines.

