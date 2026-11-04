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
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public UpdateRoleCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<RoleDetailDto> Handle(
        UpdateRoleCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;

        var role = await _context.AccessRoles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (role == null)
        {
            throw new NotFoundException(nameof(AccessRole), request.Id);
        }

        if (role.IsSystemRole)
        {
            throw new InvalidOperationException("Không thể chỉnh sửa chức vụ mặc định của hệ thống.");
        }

        if (tenantId.HasValue && role.TenantId.HasValue && role.TenantId.Value != tenantId.Value)
        {
            throw new UnauthorizedAccessException("Bạn không có quyền chỉnh sửa chức vụ của tổ chức khác.");
        }

        role.Name = request.Name.Trim();
        role.Description = request.Description?.Trim();
        role.UpdatedAtUtc = DateTime.UtcNow;

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
                CreatedAtUtc = DateTime.UtcNow
            };
            newRolePermissions.Add(rp);
            _context.RolePermissions.Add(rp);
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
