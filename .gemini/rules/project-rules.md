# Hotel SaaS Platform v2 — Project Rules

> Rules này áp dụng cho TẤT CẢ agent/session làm việc trên project này.
> Đọc docs/ trước khi implement bất kỳ feature nào.

---

## Architecture

- **Clean Architecture 4 layers:** Domain → Application → Infrastructure → WebAPI
- **Dependency rule:** Chỉ đi VÀO TRONG. WebAPI → Application → Domain. Infrastructure implements interfaces.
- **CQRS via MediatR:** Mỗi use case = 1 Command/Query + 1 Handler. Controllers chỉ gọi `_mediator.Send()`.
- **No business logic in Controllers.** Zero. Nada.
- **DTOs only qua API boundary.** Không bao giờ expose Domain entities.

## Backend (.NET 10)

- 1 class/file. File name = class name.
- File-scoped namespaces (`namespace X;`).
- `nullable` enabled mọi project.
- Entities inherit `BaseEntity` (Id, CreatedAtUtc, UpdatedAtUtc).
- Tenant-scoped entities implement `ITenantScopedEntity`.
- Use `record` for DTOs, `sealed class` for handlers/services.
- FluentValidation cho mọi Command — không Data Annotations.
- Logging via Serilog — KHÔNG log PII (password, token, CCCD).

## Frontend (Angular 22)

- Standalone components (no NgModules).
- Signals cho state management.
- `inject()` thay vì constructor injection.
- Feature folder structure: `features/{name}/`.
- HTTP calls CHỈ TRONG services, không trong components.
- Route guards dùng functional guards.
- i18n: mọi UI string phải trong file i18n (vi.json, en.json).

## Multi-tenant

- LUÔN scope by TenantId. EF Core Global Query Filters đảm bảo điều này.
- CurrentTenantService lấy TenantId từ JWT claim.
- Khi viết raw query hoặc migration, PHẢI có WHERE TenantId filter.
- SuperAdmin bypass tenant filter — nhưng audit log mọi cross-tenant access.

## RBAC

- Mọi API endpoint PHẢI có `[Authorize]` + `[RequirePermission("FUNCTION", Action)]`.
- Bitmask: Read=1, Create=2, Update=4, Delete=8, Export=16, Approve=32, Execute=64.
- Frontend: Route guards check permission, `*hasPermission` directive ẩn/hiện UI elements.
- 17 permission functions — xem docs/sdd/05-rbac-design.md.

## Database

- PostgreSQL 17 via Npgsql.
- Code-first migrations. Chạy `dotnet ef migrations add <Name>` khi thay đổi model.
- Index strategy: composite index cho multi-tenant queries.
- No raw SQL trừ khi performance critical (và phải có comment giải thích).

## Security

- Passwords: bcrypt ≥ 10 rounds.
- JWT: Access 30 min, Refresh 7 days, rotation on use.
- 0 secrets trong code/repo. Dùng .env (gitignored) + dotnet user-secrets.
- Input validation: FluentValidation trên Application layer.
- CORS: whitelist origins only.

## Testing

- Mỗi feature PHẢI có unit tests cho handlers.
- Coverage target: ≥ 70% core modules (Domain + Application).
- Test project tương ứng: HotelSaas.Domain.Tests, HotelSaas.Application.Tests, HotelSaas.WebApi.Tests.
- E2E tests cho core flows (login, booking, check-in/out).

## Real-time (SignalR)

- 5 hubs: RoomStatus, Notification, Pricing, Booking, Dashboard.
- Khi thay đổi room status, PHẢI broadcast qua RoomStatusHub.
- Khi giá thay đổi, PHẢI broadcast qua PricingHub.
- Khi có booking/payment mới, PHẢI broadcast + tạo Notification record.

## AI Integration

- Gemini API qua google-genai SDK.
- Mọi AI call PHẢI log vào AiUsageLog table.
- AI fail → graceful degradation (feature disable, không crash).
- AI response PHẢI có disclaimer.

## Git

- Conventional commits: `feat(scope): message`, `fix(scope): message`.
- Branch: `feature/TASK-ID-description`, `bugfix/TASK-ID-description`.
- Mọi thay đổi qua PR. ≥1 reviewer approve.
- Squash merge to develop.

## Docs

- Cập nhật docs/ khi thay đổi architecture/API/model.
- Log AI usage vào docs/ai-usage-log/.
- Mỗi PR ghi trong description: AI tool used? What was verified?

## Project paths

- Backend: `C:\Dev\hotel-saas-v2\backend\`
- Frontend: `C:\Dev\hotel-saas-v2\frontend\`
- Docs: `C:\Dev\hotel-saas-v2\docs\`
- Docker: `C:\Dev\hotel-saas-v2\docker\`
