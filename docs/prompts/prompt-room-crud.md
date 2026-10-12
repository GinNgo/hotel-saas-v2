# Prompt: Implement Room + RoomType CRUD — Hotel SaaS Platform

## Bạn là .NET backend developer. Implement CRUD cho RoomType và Room theo đúng pattern Clean Architecture + CQRS đã có sẵn trong project.

---

## PROJECT CONTEXT

- **.NET 10**, PostgreSQL, MediatR 14.2.0, FluentValidation 12.1.1, EF Core 10.0.12
- **Multi-tenant SaaS** — mỗi entity có `TenantId`, EF Core Global Query Filter tự động lọc
- **CQRS pattern** — Commands (ghi) và Queries (đọc) tách riêng, mỗi cái có Handler riêng
- Project path: `C:\Dev\hotel-saas-v2\backend\src\`

## CODING STYLE RULES (BẮT BUỘC tuân theo)

1. File-scoped namespaces: `namespace HotelSaas.Application.RoomTypes.Commands.CreateRoomType;`
2. XML doc comments trên mọi public member
3. `= string.Empty` cho required string properties
4. `sealed` cho tất cả class (record thì không cần)
5. Record cho Command/Query/DTO: `public sealed record CreateRoomTypeCommand(...) : IRequest<RoomTypeDto>;`
6. 1 class/record per file
7. Navigation property nullable: `public Tenant? Tenant { get; set; }`
8. Collection init: `= new List<T>()`

---

## EXISTING ENTITIES (ĐÃ CÓ, KHÔNG SỬA)

### RoomType.cs
```csharp
public class RoomType : BaseEntity, ITenantScopedEntity
{
    public Guid TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;      // unique per tenant, e.g. "DLX"
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public int MaxOccupancy { get; set; }
    public string? BedType { get; set; }
    public decimal? SquareMeters { get; set; }
    public string? ImageUrl { get; set; }
    public ICollection<Room> Rooms { get; set; } = new List<Room>();
}
```

### Room.cs
```csharp
public class Room : BaseEntity, ITenantScopedEntity
{
    public Guid TenantId { get; set; }
    public Tenant? Tenant { get; set; }
    public Guid RoomTypeId { get; set; }
    public RoomType? RoomType { get; set; }
    public string RoomNumber { get; set; } = string.Empty;  // unique per tenant
    public int Floor { get; set; }
    public RoomStatus Status { get; set; } = RoomStatus.Clean;
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}
```

### RoomStatus enum (đã có)
```csharp
public enum RoomStatus { Clean = 0, Dirty = 1, Inspected = 2, OutOfOrder = 3, Occupied = 4 }
```

### BaseEntity (đã có)
```csharp
public abstract class BaseEntity { public Guid Id; public DateTime CreatedAtUtc; public DateTime UpdatedAtUtc; }
```

---

## EXISTING INTERFACES (ĐÃ CÓ, KHÔNG SỬA)

### IApplicationDbContext.cs
```csharp
public interface IApplicationDbContext
{
    DbSet<RoomType> RoomTypes { get; }
    DbSet<Room> Rooms { get; }
    DbSet<Reservation> Reservations { get; }
    // ... other DbSets
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
```

### ICurrentTenantService.cs
```csharp
public interface ICurrentTenantService { Guid? TenantId { get; set; } }
```

---

## REFERENCE: EXISTING AUTH PATTERN (làm theo pattern này)

### Command example — RegisterCommand.cs
```csharp
using HotelSaas.Application.Auth.DTOs;
using MediatR;

namespace HotelSaas.Application.Auth.Commands.Register;

public sealed record RegisterCommand(string Email, string Password, string FullName)
    : IRequest<RegisterResponse>;
```

### Validator example — RegisterCommandValidator.cs
```csharp
using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.Register;

public sealed class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(100);
    }
}
```

### Handler example — RegisterCommandHandler.cs
```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.Register;

public sealed class RegisterCommandHandler : IRequestHandler<RegisterCommand, RegisterResponse>
{
    private readonly IApplicationDbContext _context;

    public RegisterCommandHandler(IApplicationDbContext context) { _context = context; }

    public async Task<RegisterResponse> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        // business logic here
        await _context.SaveChangesAsync(cancellationToken);
        return new RegisterResponse(...);
    }
}
```

### Controller example — AuthController.cs
```csharp
[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly ISender _mediator;
    public AuthController(ISender mediator) { _mediator = mediator; }

    [HttpPost("register")]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Register([FromBody] RegisterCommand command)
    {
        var result = await _mediator.Send(command);
        return CreatedAtAction(nameof(Register), new { id = result.UserId }, result);
    }
}
```

---

## TASK: TẠO CÁC FILES SAU

### Phần 1: Common — PagedResult<T>

**File:** `Application/Common/Models/PagedResult.cs`
```
namespace HotelSaas.Application.Common.Models;

public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
}
```

---

### Phần 2: RoomType CRUD (10 files)

#### DTOs
**File:** `Application/RoomTypes/DTOs/RoomTypeDto.cs`
- Record: Id, Name, Code, Description, BasePrice, MaxOccupancy, BedType, SquareMeters, ImageUrl, RoomCount (int — số Room thuộc loại này), CreatedAtUtc

#### Commands

**File:** `Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommand.cs`
- Record(Name, Code, Description?, BasePrice, MaxOccupancy, BedType?, SquareMeters?, ImageUrl?) : IRequest<RoomTypeDto>

**File:** `Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommandValidator.cs`
- Name: NotEmpty, MaxLength(100)
- Code: NotEmpty, MaxLength(20), Matches("^[A-Z0-9_]+$") — chỉ uppercase + số + underscore
- BasePrice: GreaterThan(0)
- MaxOccupancy: InclusiveBetween(1, 20)
- Description: MaxLength(500) khi có giá trị
- BedType: MaxLength(50) khi có giá trị

**File:** `Application/RoomTypes/Commands/CreateRoomType/CreateRoomTypeCommandHandler.cs`
- Inject IApplicationDbContext, ICurrentTenantService
- Check Code unique trong cùng tenant: `_context.RoomTypes.AnyAsync(rt => rt.Code == request.Code)`
  (KHÔNG cần filter TenantId vì EF Global Query Filter tự động lọc)
- Nếu trùng → throw InvalidOperationException("Mã loại phòng đã tồn tại.")
- Tạo RoomType mới, gán TenantId = _tenantService.TenantId!.Value
- SaveChangesAsync
- Return RoomTypeDto (RoomCount = 0)

**File:** `Application/RoomTypes/Commands/UpdateRoomType/UpdateRoomTypeCommand.cs`
- Record(Guid Id, Name, Code, Description?, BasePrice, MaxOccupancy, BedType?, SquareMeters?, ImageUrl?) : IRequest<RoomTypeDto>

**File:** `Application/RoomTypes/Commands/UpdateRoomType/UpdateRoomTypeCommandValidator.cs`
- Giống CreateRoomType + Id NotEmpty

**File:** `Application/RoomTypes/Commands/UpdateRoomType/UpdateRoomTypeCommandHandler.cs`
- Find by Id, nếu null → throw KeyNotFoundException("Không tìm thấy loại phòng.")
- Check Code unique (exclude self): AnyAsync(rt => rt.Code == request.Code && rt.Id != request.Id)
- Update fields, SaveChangesAsync
- Return RoomTypeDto

**File:** `Application/RoomTypes/Commands/DeleteRoomType/DeleteRoomTypeCommand.cs`
- Record(Guid Id) : IRequest<bool>

**File:** `Application/RoomTypes/Commands/DeleteRoomType/DeleteRoomTypeCommandHandler.cs`
- Find by Id, nếu null → throw KeyNotFoundException
- Check có Room nào thuộc RoomType này: `_context.Rooms.AnyAsync(r => r.RoomTypeId == request.Id)`
- Nếu có → throw InvalidOperationException("Không thể xóa loại phòng đang có phòng sử dụng.")
- Remove, SaveChangesAsync, return true

#### Queries

**File:** `Application/RoomTypes/Queries/GetRoomTypes/GetRoomTypesQuery.cs`
- Record(string? Search, int Page = 1, int PageSize = 20) : IRequest<PagedResult<RoomTypeDto>>

**File:** `Application/RoomTypes/Queries/GetRoomTypes/GetRoomTypesQueryHandler.cs`
- Query _context.RoomTypes, Include Rooms (for count)
- Filter by Search (Name or Code contains, case insensitive)
- OrderBy Name
- Project to RoomTypeDto (RoomCount = rt.Rooms.Count)
- Apply paging: Skip((Page-1)*PageSize).Take(PageSize)
- Return PagedResult<RoomTypeDto>

**File:** `Application/RoomTypes/Queries/GetRoomTypeById/GetRoomTypeByIdQuery.cs`
- Record(Guid Id) : IRequest<RoomTypeDto?>

**File:** `Application/RoomTypes/Queries/GetRoomTypeById/GetRoomTypeByIdQueryHandler.cs`
- Find by Id with Include(Rooms), project to RoomTypeDto
- Return null nếu không tìm thấy

---

### Phần 3: Room CRUD (12 files)

#### DTOs
**File:** `Application/Rooms/DTOs/RoomDto.cs`
- Record: Id, RoomNumber, Floor, Status (string), Notes, IsActive, RoomTypeId, RoomTypeName, RoomTypeCode, BasePrice, CreatedAtUtc

#### Commands

**File:** `Application/Rooms/Commands/CreateRoom/CreateRoomCommand.cs`
- Record(RoomNumber, Guid RoomTypeId, int Floor, string? Notes) : IRequest<RoomDto>

**File:** `Application/Rooms/Commands/CreateRoom/CreateRoomCommandValidator.cs`
- RoomNumber: NotEmpty, MaxLength(20)
- RoomTypeId: NotEmpty
- Floor: GreaterThanOrEqualTo(0)
- Notes: MaxLength(500) khi có giá trị

**File:** `Application/Rooms/Commands/CreateRoom/CreateRoomCommandHandler.cs`
- Check RoomNumber unique trong tenant: `_context.Rooms.AnyAsync(r => r.RoomNumber == request.RoomNumber)`
- Nếu trùng → throw InvalidOperationException("Số phòng đã tồn tại.")
- Check RoomTypeId exists: `_context.RoomTypes.AnyAsync(rt => rt.Id == request.RoomTypeId)`
- Nếu không → throw KeyNotFoundException("Loại phòng không tồn tại.")
- Tạo Room mới, gán TenantId, Status = RoomStatus.Clean
- SaveChangesAsync
- Load RoomType cho response, return RoomDto

**File:** `Application/Rooms/Commands/UpdateRoom/UpdateRoomCommand.cs`
- Record(Guid Id, RoomNumber, Guid RoomTypeId, int Floor, string? Notes, bool IsActive) : IRequest<RoomDto>

**File:** `Application/Rooms/Commands/UpdateRoom/UpdateRoomCommandValidator.cs`
- Giống Create + Id NotEmpty

**File:** `Application/Rooms/Commands/UpdateRoom/UpdateRoomCommandHandler.cs`
- Find by Id, null → KeyNotFoundException
- Check RoomNumber unique (exclude self)
- Check RoomTypeId exists
- Update fields, SaveChangesAsync, return RoomDto

**File:** `Application/Rooms/Commands/DeleteRoom/DeleteRoomCommand.cs`
- Record(Guid Id) : IRequest<bool>

**File:** `Application/Rooms/Commands/DeleteRoom/DeleteRoomCommandHandler.cs`
- Find by Id, null → KeyNotFoundException
- Check active reservations: `_context.Reservations.AnyAsync(r => r.RoomId == request.Id && (r.Status == ReservationStatus.Confirmed || r.Status == ReservationStatus.CheckedIn))`
- Nếu có → throw InvalidOperationException("Không thể xóa phòng đang có đặt phòng.")
- Remove, SaveChangesAsync, return true

**File:** `Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommand.cs`
- Record(Guid Id, RoomStatus Status) : IRequest<RoomDto>
- using HotelSaas.Domain.Enums;

**File:** `Application/Rooms/Commands/UpdateRoomStatus/UpdateRoomStatusCommandHandler.cs`
- Find by Id, null → KeyNotFoundException
- Update Status only, SaveChangesAsync, return RoomDto

#### Queries

**File:** `Application/Rooms/Queries/GetRooms/GetRoomsQuery.cs`
- Record(string? Search, Guid? RoomTypeId, RoomStatus? Status, int? Floor, bool? IsActive, int Page = 1, int PageSize = 20) : IRequest<PagedResult<RoomDto>>
- using HotelSaas.Domain.Enums;

**File:** `Application/Rooms/Queries/GetRooms/GetRoomsQueryHandler.cs`
- Query _context.Rooms.Include(r => r.RoomType)
- Filter by: Search (RoomNumber contains), RoomTypeId, Status, Floor, IsActive
- OrderBy Floor then RoomNumber
- Project to RoomDto
- Apply paging, return PagedResult<RoomDto>

**File:** `Application/Rooms/Queries/GetRoomById/GetRoomByIdQuery.cs`
- Record(Guid Id) : IRequest<RoomDto?>

**File:** `Application/Rooms/Queries/GetRoomById/GetRoomByIdQueryHandler.cs`
- Find by Id with Include(RoomType), project to RoomDto
- Return null nếu không tìm thấy

---

### Phần 4: WebApi Controllers (2 files)

**File:** `WebApi/Controllers/RoomTypesController.cs`
```
[ApiController]
[Route("api/room-types")]
[Authorize]
```
- `POST /` → [RequirePermission("ROOM_TYPES", PermissionAction.Create)] → 201 Created
- `GET /` → [RequirePermission("ROOM_TYPES", PermissionAction.Read)] → 200 OK
- `GET /{id}` → [RequirePermission("ROOM_TYPES", PermissionAction.Read)] → 200 OK hoặc 404
- `PUT /{id}` → [RequirePermission("ROOM_TYPES", PermissionAction.Update)] → 200 OK
- `DELETE /{id}` → [RequirePermission("ROOM_TYPES", PermissionAction.Delete)] → 204 NoContent

**File:** `WebApi/Controllers/RoomsController.cs`
```
[ApiController]
[Route("api/rooms")]
[Authorize]
```
- `POST /` → [RequirePermission("ROOMS", PermissionAction.Create)] → 201 Created
- `GET /` → [RequirePermission("ROOMS", PermissionAction.Read)] → 200 OK
- `GET /{id}` → [RequirePermission("ROOMS", PermissionAction.Read)] → 200 OK hoặc 404
- `PUT /{id}` → [RequirePermission("ROOMS", PermissionAction.Update)] → 200 OK
- `DELETE /{id}` → [RequirePermission("ROOMS", PermissionAction.Delete)] → 204 NoContent
- `PATCH /{id}/status` → [RequirePermission("ROOMS", PermissionAction.Update)] → 200 OK

**Import cho Controllers:**
```csharp
using HotelSaas.WebApi.Authorization; // for RequirePermission, PermissionAction
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
```

---

### Phần 5: Update ExceptionHandlingMiddleware

Thêm catch cho `KeyNotFoundException`:
```csharp
catch (KeyNotFoundException ex)
{
    context.Response.StatusCode = StatusCodes.Status404NotFound;
    context.Response.ContentType = "application/json";
    var response = new { type = "NotFound", title = ex.Message, status = 404 };
    await context.Response.WriteAsync(JsonSerializer.Serialize(response, _jsonOptions));
}
```
Thêm TRƯỚC catch `Exception ex` (catch-all).

---

## LƯU Ý QUAN TRỌNG

1. **KHÔNG SỬA** file entity (Room.cs, RoomType.cs) — chúng đã hoàn chỉnh
2. **KHÔNG CẦN** filter theo TenantId trong query — EF Global Query Filter tự động lọc
3. **CẦN** gán `TenantId = _tenantService.TenantId!.Value` khi CREATE entity mới
4. **CẦN** inject `ICurrentTenantService` vào các Create handler
5. Namespace format: `HotelSaas.Application.{Feature}.{Commands|Queries|DTOs}.{Action}`
6. **DTO mapping** — map thủ công bằng object initializer, KHÔNG dùng AutoMapper
7. Dùng `ISender` (không phải `IMediator`) trong Controller
8. **Reservation entity** có property `RoomId` (Guid) và `Status` (ReservationStatus enum) — dùng khi check delete Room

## SAU KHI TẠO XONG

Chạy lệnh build:
```
dotnet build C:\Dev\hotel-saas-v2\backend --verbosity minimal
```
Fix mọi error cho đến khi `Build succeeded. 0 Warning(s) 0 Error(s)`.

Báo lại danh sách file đã tạo + kết quả build.
