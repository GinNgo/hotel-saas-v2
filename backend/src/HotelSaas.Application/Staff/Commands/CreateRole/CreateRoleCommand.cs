using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Staff.DTOs;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Commands.CreateRole;

public sealed record CreateRoleCommand : IRequest<RoleDetailDto>
{
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public IReadOnlyList<RolePermissionInput> Permissions { get; init; } = Array.Empty<RolePermissionInput>();
}

public sealed class CreateRoleCommandValidator : AbstractValidator<CreateRoleCommand>
{
    public CreateRoleCommandValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50).Matches(@"^[A-Z0-9_]+$")
            .WithMessage("Mã chức vụ chỉ gồm chữ cái in hoa, số và dấu gạch dưới (VD: ACCOUNTANT).");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
    }
}

public sealed class CreateRoleCommandHandler : IRequestHandler<CreateRoleCommand, RoleDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public CreateRoleCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<RoleDetailDto> Handle(
        CreateRoleCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;
        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        // Check uniqueness within tenant or system
        var exists = await _context.AccessRoles
            .AnyAsync(r => r.Code == normalizedCode && (r.IsSystemRole || (tenantId.HasValue && r.TenantId == tenantId.Value)), cancellationToken);

        if (exists)
        {
            throw new InvalidOperationException($"Mã chức vụ '{normalizedCode}' đã tồn tại trong hệ thống.");
        }

        var role = new AccessRole
        {
            Id = Guid.NewGuid(),
            Code = normalizedCode,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            IsSystemRole = false,
            TenantId = tenantId,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.AccessRoles.Add(role);

        // Add permissions
        var rolePermissions = new List<RolePermission>();
        var functionIds = request.Permissions.Select(p => p.FunctionId).Distinct().ToList();
        var functions = await _context.PermissionFunctions
            .Where(f => functionIds.Contains(f.Id))
            .ToDictionaryAsync(f => f.Id, cancellationToken);

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
            rolePermissions.Add(rp);
            _context.RolePermissions.Add(rp);
        }

        await _context.SaveChangesAsync(cancellationToken);

        var permissionDtos = rolePermissions.Select(rp =>
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
            StaffCount = 0,
            Permissions = permissionDtos
        };
    }
}
