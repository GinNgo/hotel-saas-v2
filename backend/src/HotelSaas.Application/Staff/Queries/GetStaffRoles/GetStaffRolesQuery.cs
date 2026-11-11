using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Staff.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Queries.GetStaffRoles;

/// <summary>
/// Query to retrieve available access roles (system-defined and tenant-specific).
/// </summary>
public sealed record GetStaffRolesQuery : IRequest<IReadOnlyList<AccessRoleDto>>;

public sealed class GetStaffRolesQueryHandler : IRequestHandler<GetStaffRolesQuery, IReadOnlyList<AccessRoleDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;

    public GetStaffRolesQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService)
    {
        _context = context;
        _currentTenantService = currentTenantService;
    }

    public async Task<IReadOnlyList<AccessRoleDto>> Handle(
        GetStaffRolesQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _currentTenantService.TenantId;

        var roles = await _context.AccessRoles
            .AsNoTracking()
            .Where(r => r.IsSystemRole || (tenantId.HasValue && r.TenantId == tenantId.Value))
            .OrderBy(r => r.IsSystemRole ? 0 : 1)
            .ThenBy(r => r.Name)
            .Select(r => new AccessRoleDto
            {
                Id = r.Id,
                Code = r.Code,
                Name = r.Name,
                Description = r.Description,
                IsSystemRole = r.IsSystemRole
            })
            .ToListAsync(cancellationToken);

        return roles;
    }
}
