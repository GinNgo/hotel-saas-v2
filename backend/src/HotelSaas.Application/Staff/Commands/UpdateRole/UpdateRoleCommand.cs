using System.Text.Json;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Staff.DTOs;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Commands.UpdateRole;

public sealed record UpdateRoleCommand : IRequest<RoleDetailDto>
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public IReadOnlyList<RolePermissionInput> Permissions { get; init; } = Array.Empty<RolePermissionInput>();
}

public sealed class UpdateRoleCommandValidator : AbstractValidator<UpdateRoleCommand>
{
    public UpdateRoleCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}

public sealed class UpdateRoleCommandHandler : IRequestHandler<UpdateRoleCommand, RoleDetailDto>
{
    private static readonly JsonSerializerOptions AuditJsonOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;
    private readonly ICurrentUserContext? _currentUserContext;

    public UpdateRoleCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService,
        ICurrentUserContext? currentUserContext = null)
    {
        _context = context;
        _currentTenantService = currentTenantService;
        _currentUserContext = currentUserContext;
    }

    public async Task<RoleDetailDto> Handle(
        UpdateRoleCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;

        var role = await _context.AccessRoles
            .Include(r => r.Permissions)
                .ThenInclude(p => p.Function)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (role == null)
        {
            throw new NotFoundException(nameof(AccessRole), request.Id);
        }

        if (role.IsSystemRole)
        {
            throw new BadRequestException("ERR_SYSTEM_ROLE_IMMUTABLE", "Không thể chỉnh sửa chức vụ mặc định của hệ thống.");
        }

        if (tenantId.HasValue && role.TenantId.HasValue && role.TenantId.Value != tenantId.Value)
        {
            throw new UnauthorizedAccessException("Bạn không có quyền chỉnh sửa chức vụ của tổ chức khác.");
        }

        var oldName = role.Name;
        var oldDescription = role.Description;
        var oldPermissionSummary = role.Permissions
            .Select(rp => $"{rp.Function?.Code ?? rp.FunctionId.ToString("N")}:{rp.ActionMask}")
            .OrderBy(s => s, StringComparer.Ordinal)
            .ToList();

        var nowUtc = DateTime.UtcNow;
        role.Name = request.Name.Trim();
        role.Description = request.Description?.Trim();
        role.UpdatedAtUtc = nowUtc;

        // Remove old permissions
        _context.RolePermissions.RemoveRange(role.Permissions);

        // Add updated permissions
        var functionIds = request.Permissions.Select(p => p.FunctionId).Distinct().ToList();
        var functions = await _context.PermissionFunctions
            .Where(f => functionIds.Contains(f.Id))
            .ToDictionaryAsync(f => f.Id, cancellationToken);

        var newRolePermissions = new List<RolePermission>();
        foreach (var p in request.Permissions)
        {
            if (!functions.TryGetValue(p.FunctionId, out var func)) continue;
            var mask = p.ToActionMask();
            if (mask <= 0) continue;

            var rp = new RolePermission
            {
                Id = Guid.NewGuid(),
                RoleId = role.Id,
                FunctionId = func.Id,
                ActionMask = mask,
                CreatedAtUtc = nowUtc
            };
            newRolePermissions.Add(rp);
            _context.RolePermissions.Add(rp);
        }

        var newPermissionSummary = newRolePermissions
            .Select(rp => $"{functions[rp.FunctionId].Code}:{rp.ActionMask}")
            .OrderBy(s => s, StringComparer.Ordinal)
            .ToList();

        var metadataChanged = !string.Equals(oldName, role.Name, StringComparison.Ordinal) ||
                              !string.Equals(oldDescription, role.Description, StringComparison.Ordinal);
        var permissionsChanged = !oldPermissionSummary.SequenceEqual(newPermissionSummary, StringComparer.Ordinal);

        if (metadataChanged || permissionsChanged)
        {
            var auditTenantId = role.TenantId ?? tenantId ?? Guid.Empty;
            if (auditTenantId != Guid.Empty)
            {
                try
                {
                    var actorId = _currentUserContext?.UserId is Guid uid && uid != Guid.Empty ? uid : (Guid?)null;
                    _context.AuditLogs.Add(new AuditLog
                    {
                        Id = Guid.NewGuid(),
                        TenantId = auditTenantId,
                        PropertyId = null,
                        UserId = actorId,
                        Action = AuditActions.Update,
                        EntityName = nameof(AccessRole),
                        EntityId = role.Id,
                        OldValues = JsonSerializer.Serialize(new
                        {
                            Name = oldName,
                            Description = oldDescription,
                            Permissions = string.Join(", ", oldPermissionSummary)
                        }, AuditJsonOptions),
                        NewValues = JsonSerializer.Serialize(new
                        {
                            Name = role.Name,
                            Description = role.Description,
                            Permissions = string.Join(", ", newPermissionSummary)
                        }, AuditJsonOptions),
                        IpAddress = _currentUserContext?.IpAddress,
                        CreatedAtUtc = nowUtc
                    });
                }
                catch (NotImplementedException)
                {
                    // Optional AuditLogs DbSet in minimal test stubs
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        var count = await _context.TenantStaffMembers
            .CountAsync(s => s.RoleId == role.Id, cancellationToken);

        var permissionDtos = newRolePermissions.Select(rp =>
        {
            var func = functions[rp.FunctionId];
            return new RolePermissionDto
            {
                FunctionId = func.Id,
                FunctionCode = func.Code,
                FunctionName = func.Name,
                ModuleCode = func.ModuleCode,
                ActionMask = rp.ActionMask
            };
        }).ToList();

        return new RoleDetailDto
        {
            Id = role.Id,
            Code = role.Code,
            Name = role.Name,
            Description = role.Description,
            IsSystemRole = false,
            TenantId = role.TenantId,
            StaffCount = count,
            Permissions = permissionDtos
        };
    }
}
