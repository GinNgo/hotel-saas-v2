using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Staff.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Queries.GetRolesWithPermissions;

public sealed record GetRolesWithPermissionsQuery : IRequest<IReadOnlyList<RoleDetailDto>>;

public sealed class GetRolesWithPermissionsQueryHandler : IRequestHandler<GetRolesWithPermissionsQuery, IReadOnlyList<RoleDetailDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public GetRolesWithPermissionsQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<IReadOnlyList<RoleDetailDto>> Handle(
        GetRolesWithPermissionsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;

        var roles = await _context.AccessRoles
            .AsNoTracking()
            .Include(r => r.Permissions)
                .ThenInclude(rp => rp.Function)
            .Where(r => r.IsSystemRole || (tenantId.HasValue && r.TenantId == tenantId.Value))
            .OrderBy(r => r.IsSystemRole ? 0 : 1)
            .ThenBy(r => r.Name)
            .ToListAsync(cancellationToken);

        // Get staff counts per role for this tenant
        var staffCounts = await _context.TenantStaffMembers
            .AsNoTracking()
            .Where(s => !tenantId.HasValue || s.TenantId == tenantId.Value)
            .GroupBy(s => s.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, cancellationToken);

        var result = roles.Select(r =>
        {
            var count = staffCounts.TryGetValue(r.Id, out var c) ? c : 0;
            var perms = r.Permissions.Select(p => new RolePermissionDto
            {
                FunctionId = p.FunctionId,
                FunctionCode = p.Function?.Code ?? string.Empty,
                FunctionName = p.Function?.Name ?? string.Empty,
                ModuleCode = p.Function?.ModuleCode ?? string.Empty,
                ActionMask = p.ActionMask
            }).ToList();

            return new RoleDetailDto
            {
                Id = r.Id,
                Code = r.Code,
                Name = r.Name,
                Description = r.Description,
                IsSystemRole = r.IsSystemRole,
                TenantId = r.TenantId,
                StaffCount = count,
                Permissions = perms
            };
        }).ToList();

        return result;
    }
}
