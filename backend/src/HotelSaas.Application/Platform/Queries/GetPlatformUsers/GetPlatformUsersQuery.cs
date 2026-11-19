using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Queries.GetPlatformUsers;

/// <summary>
/// SuperAdmin query returning global user KPIs and a filtered, paginated directory of platform accounts.
/// </summary>
public sealed record GetPlatformUsersQuery(
    string? Search = null,
    GlobalUserRole? Role = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 50
) : IRequest<PlatformUsersResponseDto>;

/// <summary>
/// Handles <see cref="GetPlatformUsersQuery"/> with fail-closed SuperAdmin verification and sanitized projections.
/// </summary>
public sealed class GetPlatformUsersQueryHandler
    : IRequestHandler<GetPlatformUsersQuery, PlatformUsersResponseDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUserContext;

    public GetPlatformUsersQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUserContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUserContext = currentUserContext ?? throw new ArgumentNullException(nameof(currentUserContext));
    }

    public async Task<PlatformUsersResponseDto> Handle(
        GetPlatformUsersQuery request,
        CancellationToken cancellationToken)
    {
        PlatformUserMapper.EnsureSuperAdmin(_currentUserContext);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 50 : Math.Min(request.PageSize, 200);

        var usersSet = _context.Users;
        if (usersSet == null)
        {
            return new PlatformUsersResponseDto(
                Summary: new PlatformUserSummaryDto(0, 0, 0, 0, 0, 0),
                Items: Array.Empty<PlatformUserDto>(),
                TotalCount: 0,
                Page: page,
                PageSize: pageSize);
        }

        var allUsersQuery = usersSet
            .IgnoreQueryFilters()
            .AsNoTracking();

        var allUserStats = await allUsersQuery
            .Select(u => new { u.GlobalRole, u.IsActive })
            .ToListAsync(cancellationToken);

        var totalUsers = allUserStats.Count;
        var superAdminCount = allUserStats.Count(u => u.GlobalRole == GlobalUserRole.SuperAdmin);
        var tenantStaffCount = allUserStats.Count(u => u.GlobalRole == GlobalUserRole.TenantStaff);
        var customerCount = allUserStats.Count(u => u.GlobalRole == GlobalUserRole.Customer);
        var activeCount = allUserStats.Count(u => u.IsActive);
        var lockedCount = totalUsers - activeCount;

        var summary = new PlatformUserSummaryDto(
            TotalUsers: totalUsers,
            SuperAdminCount: superAdminCount,
            TenantStaffCount: tenantStaffCount,
            CustomerCount: customerCount,
            ActiveCount: activeCount,
            LockedCount: lockedCount);

        var filteredQuery = allUsersQuery;

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLowerInvariant();
            filteredQuery = filteredQuery.Where(u =>
                (u.Email != null && u.Email.ToLower().Contains(term)) ||
                (u.FullName != null && u.FullName.ToLower().Contains(term)) ||
                (u.Username != null && u.Username.ToLower().Contains(term)) ||
                (u.PhoneNumber != null && u.PhoneNumber.ToLower().Contains(term)));
        }

        if (request.Role.HasValue)
        {
            var role = request.Role.Value;
            filteredQuery = filteredQuery.Where(u => u.GlobalRole == role);
        }

        if (request.IsActive.HasValue)
        {
            var isActive = request.IsActive.Value;
            filteredQuery = filteredQuery.Where(u => u.IsActive == isActive);
        }

        var totalCount = await filteredQuery.CountAsync(cancellationToken);

        var pageRows = await filteredQuery
            .OrderBy(u => u.GlobalRole == GlobalUserRole.SuperAdmin ? 0 : 1)
            .ThenByDescending(u => u.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.Username,
                u.FullName,
                u.PhoneNumber,
                u.GlobalRole,
                u.IsActive,
                u.EmailVerifiedAtUtc,
                u.PhoneVerifiedAtUtc,
                u.TenantId,
                u.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        var membershipCountByUser = new Dictionary<Guid, int>();
        var fallbackTenantIdByUser = new Dictionary<Guid, Guid>();

        if (pageRows.Count > 0)
        {
            var userIds = pageRows.Select(u => u.Id).ToList();

            try
            {
                var staffSet = _context.TenantStaffMembers;
                if (staffSet != null)
                {
                    var memberships = await staffSet
                        .IgnoreQueryFilters()
                        .AsNoTracking()
                        .Where(m => m.IsActive && userIds.Contains(m.UserId))
                        .Select(m => new { m.UserId, m.TenantId })
                        .ToListAsync(cancellationToken);

                    foreach (var group in memberships.GroupBy(m => m.UserId))
                    {
                        membershipCountByUser[group.Key] = group.Count();
                        fallbackTenantIdByUser[group.Key] = group.First().TenantId;
                    }
                }
            }
            catch (NotImplementedException)
            {
                // Optional DbSet in isolated minimal test stubs
            }
        }

        var tenantIds = pageRows
            .Select(u => u.TenantId ?? (fallbackTenantIdByUser.TryGetValue(u.Id, out var fallbackTid) ? fallbackTid : (Guid?)null))
            .Where(tid => tid.HasValue)
            .Select(tid => tid!.Value)
            .Distinct()
            .ToList();

        var tenantNameById = new Dictionary<Guid, string>();
        if (tenantIds.Count > 0)
        {
            try
            {
                var tenantSet = _context.Tenants;
                if (tenantSet != null)
                {
                    var tenants = await tenantSet
                        .IgnoreQueryFilters()
                        .AsNoTracking()
                        .Where(t => tenantIds.Contains(t.Id))
                        .Select(t => new { t.Id, t.Name })
                        .ToListAsync(cancellationToken);

                    foreach (var tenant in tenants)
                    {
                        tenantNameById[tenant.Id] = tenant.Name;
                    }
                }
            }
            catch (NotImplementedException)
            {
                // Optional DbSet in isolated minimal test stubs
            }
        }

        var items = pageRows
            .Select(u =>
            {
                var defaultTenantId = u.TenantId ?? (fallbackTenantIdByUser.TryGetValue(u.Id, out var fallbackTid) ? fallbackTid : (Guid?)null);
                var defaultTenantName = defaultTenantId.HasValue && tenantNameById.TryGetValue(defaultTenantId.Value, out var tName)
                    ? tName
                    : null;
                var membershipsCount = membershipCountByUser.TryGetValue(u.Id, out var mCount) ? mCount : 0;

                return new PlatformUserDto(
                    Id: u.Id,
                    Email: u.Email ?? string.Empty,
                    Username: u.Username ?? string.Empty,
                    FullName: u.FullName ?? string.Empty,
                    PhoneNumber: u.PhoneNumber,
                    GlobalRole: u.GlobalRole,
                    GlobalRoleName: PlatformUserMapper.GetGlobalRoleName(u.GlobalRole),
                    IsActive: u.IsActive,
                    EmailVerified: u.EmailVerifiedAtUtc.HasValue,
                    PhoneVerified: u.PhoneVerifiedAtUtc.HasValue,
                    DefaultTenantId: defaultTenantId,
                    DefaultTenantName: defaultTenantName,
                    MembershipsCount: membershipsCount,
                    CreatedAtUtc: u.CreatedAtUtc);
            })
            .ToList();

        return new PlatformUsersResponseDto(
            Summary: summary,
            Items: items,
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize);
    }
}
