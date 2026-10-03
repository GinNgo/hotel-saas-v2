# Coding Convention — Hotel SaaS Platform v2

## 1. C# (.NET 10)

### Naming
- **PascalCase**: Classes, Methods, Properties, Enums
- **camelCase**: Local variables, parameters
- **_camelCase**: Private fields (prefix underscore)
- **UPPER_SNAKE_CASE**: Constants

### Tổ chức code
- 1 class/interface per file
- File-scoped namespaces (`namespace X;` thay vì `namespace X { }`)
- Entities trong `Domain/Entities/`, mỗi entity 1 file
- DTOs dùng `record` thay vì `class`
- Enums trong `Domain/Enums/`, mỗi enum 1 file

### Quy tắc
- `nullable` enabled — mọi project
- Dùng `var` khi type rõ ràng
- Ưu tiên `async/await` cho I/O operations
- Không expose Domain Entities qua API — luôn dùng DTOs
- Business logic trong Application layer (Commands/Queries), **KHÔNG** trong Controller
- Mỗi Controller method chỉ gọi 1 MediatR Send/Request

### Ví dụ

```csharp
// ✅ Good — CQRS pattern
[HttpPost]
public async Task<ActionResult<ReservationDto>> Create(
    [FromBody] CreateReservationCommand command)
{
    var result = await _mediator.Send(command);
    return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
}

// ❌ Bad — Business logic in controller
[HttpPost]
public async Task<ActionResult> Create([FromBody] CreateReservationDto dto)
{
    var room = await _dbContext.Rooms.FindAsync(dto.RoomId);
    if (room == null) return NotFound();
    room.Status = RoomStatus.Occupied;  // Logic should be in domain/service
    // ... 50 more lines of business logic ...
}
```

## 2. TypeScript (Angular 22)

### Naming
- **PascalCase**: Components, Services, Interfaces, Types
- **camelCase**: Variables, functions, properties
- **kebab-case**: File names (`user-list.component.ts`)
- **UPPER_SNAKE_CASE**: Constants

### Tổ chức code
- Feature-based folder structure: `features/{feature-name}/`
- Standalone components (no NgModules)
- Services trong `core/services/`
- Guards trong `core/guards/`
- Shared components trong `shared/`

### Quy tắc
- `strict: true` trong tsconfig
- Dùng signals cho state management (Angular 22)
- Dùng `inject()` thay vì constructor injection
- Route guards dùng functional guards
- HTTP calls chỉ trong services, **KHÔNG** trong components

## 3. Git

### Branch naming
```
feature/TASK-ID-short-description
bugfix/TASK-ID-description
hotfix/critical-fix-name
docs/document-name
```

### Commit message (Conventional Commits)
```
<type>(<scope>): <subject>

Types: feat | fix | docs | style | refactor | test | chore | ci
Scope: auth | rbac | room | reservation | payment | housekeeping | ui | api | infra
```

### PR Rules
- Mọi thay đổi qua PR
- ≥1 reviewer approve trước khi merge
- CI pipeline phải pass
- Squash merge to develop

## 4. API Design

- RESTful conventions
- URL: `kebab-case` (`/api/room-types`)
- JSON: `camelCase`
- Pagination: `?page=1&pageSize=20`
- Versioning: URL prefix `/api/v1/`
- Always return proper HTTP status codes
