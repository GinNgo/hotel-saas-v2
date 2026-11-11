using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Staff.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Queries.GetStaffMembers;

/// <summary>
/// Query to retrieve paginated list of staff members within the current tenant.
/// </summary>
public sealed record GetStaffMembersQuery : IRequest<PagedResult<StaffMemberDto>>
{
    public string? Search { get; init; }
    public Guid? PropertyId { get; init; }
    public StaffRole? StaffRole { get; init; }
    public bool? IsActive { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed class GetStaffMembersQueryHandler : IRequestHandler<GetStaffMembersQuery, PagedResult<StaffMemberDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _currentTenantService;
    private readonly ICurrentUserContext _currentUserContext;

    public GetStaffMembersQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService currentTenantService,
        ICurrentUserContext currentUserContext)
    {
        _context = context;
        _currentTenantService = currentTenantService;
        _currentUserContext = currentUserContext;
    }

    public async Task<PagedResult<StaffMemberDto>> Handle(
        GetStaffMembersQuery request,
        CancellationToken cancellationToken)
    {
        var isSuperAdmin = _currentUserContext.GlobalRole == GlobalUserRole.SuperAdmin;
        var tenantId = _currentTenantService.TenantId;

        if (!isSuperAdmin && (!tenantId.HasValue || tenantId.Value == Guid.Empty))
        {
            return new PagedResult<StaffMemberDto>(Array.Empty<StaffMemberDto>(), 0, request.Page, request.PageSize);
        }

        var query = _context.TenantStaffMembers
            .AsNoTracking()
            .Include(s => s.User)
            .Include(s => s.Property)
            .Include(s => s.Role)
            .AsQueryable();

        if (tenantId.HasValue && tenantId.Value != Guid.Empty)
        {
            query = query.Where(s => s.TenantId == tenantId.Value);
        }

        if (request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty)
        {
            query = query.Where(s => s.PropertyId == request.PropertyId.Value);
        }

        if (request.StaffRole.HasValue)
        {
            query = query.Where(s => s.StaffRole == request.StaffRole.Value);
        }

        if (request.IsActive.HasValue)
        {
            query = query.Where(s => s.IsActive == request.IsActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLower();
            query = query.Where(s =>
                (s.User != null && (s.User.FullName.ToLower().Contains(search) || s.User.Email.ToLower().Contains(search) || (s.User.PhoneNumber != null && s.User.PhoneNumber.Contains(search)))) ||
                (s.Role != null && s.Role.Name.ToLower().Contains(search)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var items = await query
            .OrderByDescending(s => s.StaffRole == StaffRole.Owner)
            .ThenByDescending(s => s.StaffRole == StaffRole.Manager)
            .ThenBy(s => s.User != null ? s.User.FullName : string.Empty)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new StaffMemberDto
            {
                Id = s.Id,
                UserId = s.UserId,
                FullName = s.User != null ? s.User.FullName : "—",
                Email = s.User != null ? s.User.Email : string.Empty,
                PhoneNumber = s.User != null ? s.User.PhoneNumber : null,
                PropertyId = s.PropertyId,
                PropertyName = s.Property != null ? s.Property.Name : null,
                IsTenantWide = s.PropertyId == null,
                RoleId = s.RoleId,
                RoleCode = s.Role != null ? s.Role.Code : s.StaffRole.ToString().ToUpperInvariant(),
                RoleName = s.Role != null ? s.Role.Name : s.StaffRole.ToString(),
                StaffRole = s.StaffRole,
                StaffRoleName = s.StaffRole.ToString(),
                IsActive = s.IsActive,
                CreatedAtUtc = s.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        return new PagedResult<StaffMemberDto>(items, totalCount, page, pageSize);
    }
}
