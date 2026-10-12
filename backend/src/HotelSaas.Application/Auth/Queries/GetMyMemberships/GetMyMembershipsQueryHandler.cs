using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Queries.GetMyMemberships;

/// <summary>
/// Handles retrieval of valid, active tenant and branch contexts for the authenticated user.
/// </summary>
public sealed class GetMyMembershipsQueryHandler : IRequestHandler<GetMyMembershipsQuery, IReadOnlyList<UserMembershipDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    /// <summary>
    /// Initializes a new instance of <see cref="GetMyMembershipsQueryHandler"/>.
    /// </summary>
    public GetMyMembershipsQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext)
    {
        _context = context;
        _userContext = userContext;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<UserMembershipDto>> Handle(
        GetMyMembershipsQuery request,
        CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu xác thực danh tính.");
        }

        // Retrieve all explicit active memberships for this user where Tenant and Property (if set) are active
        var activeMemberships = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(ts => ts.Tenant)
            .Include(ts => ts.Property)
            .Include(ts => ts.Role)
            .Where(ts => ts.UserId == userId && ts.IsActive)
            .Where(ts => ts.Tenant != null && ts.Tenant.Status == TenantStatus.Active)
            .Where(ts => ts.PropertyId == null || (ts.Property != null && ts.Property.Status == PropertyStatus.Active))
            .ToListAsync(cancellationToken);

        // Retrieve any explicitly inactive/revoked memberships for this user to respect PO exclusions
        var revokedPropertyIds = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(ts => ts.UserId == userId && !ts.IsActive && ts.PropertyId != null)
            .Select(ts => ts.PropertyId!.Value)
            .ToListAsync(cancellationToken);

        var result = new List<UserMembershipDto>();
        var seenPropertyIds = new HashSet<Guid>();

        // 1. Add explicit active memberships
        foreach (var m in activeMemberships)
        {
            if (m.PropertyId.HasValue)
            {
                seenPropertyIds.Add(m.PropertyId.Value);
            }

            result.Add(new UserMembershipDto(
                m.Id,
                m.TenantId,
                m.Tenant?.Name ?? string.Empty,
                m.Tenant?.Code ?? string.Empty,
                m.PropertyId,
                m.Property?.Name,
                m.Property?.Code,
                m.StaffRole.ToString(),
                m.Role?.Name ?? m.StaffRole.ToString(),
                m.PropertyId == null));
        }

        // 2. For tenant-wide memberships (e.g. Owner), expand available active properties in that tenant
        var tenantWideMemberships = activeMemberships.Where(m => m.PropertyId == null).ToList();
        foreach (var twm in tenantWideMemberships)
        {
            var properties = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.TenantId == twm.TenantId && p.Status == PropertyStatus.Active)
                .ToListAsync(cancellationToken);

            foreach (var prop in properties)
            {
                // Exclude properties where user has an explicit revoked membership or already included
                if (revokedPropertyIds.Contains(prop.Id) || seenPropertyIds.Contains(prop.Id))
                {
                    continue;
                }

                seenPropertyIds.Add(prop.Id);
                result.Add(new UserMembershipDto(
                    twm.Id,
                    twm.TenantId,
                    twm.Tenant?.Name ?? string.Empty,
                    twm.Tenant?.Code ?? string.Empty,
                    prop.Id,
                    prop.Name,
                    prop.Code,
                    twm.StaffRole.ToString(),
                    twm.Role?.Name ?? twm.StaffRole.ToString(),
                    IsTenantWide: false));
            }
        }

        return result;
    }
}
