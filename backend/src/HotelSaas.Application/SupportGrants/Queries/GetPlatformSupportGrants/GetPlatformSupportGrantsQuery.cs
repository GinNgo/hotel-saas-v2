using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.SupportGrants.Commands.CreateSupportGrant;
using HotelSaas.Application.SupportGrants.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.SupportGrants.Queries.GetPlatformSupportGrants;

public sealed record GetPlatformSupportGrantsQuery(
    Guid? TenantId = null,
    bool OnlyActive = false
) : IRequest<IReadOnlyList<SupportAccessGrantDto>>;

public sealed class GetPlatformSupportGrantsQueryHandler
    : IRequestHandler<GetPlatformSupportGrantsQuery, IReadOnlyList<SupportAccessGrantDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetPlatformSupportGrantsQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<IReadOnlyList<SupportAccessGrantDto>> Handle(
        GetPlatformSupportGrantsQuery request,
        CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền xem danh sách Support Access Grants.");
        }

        var now = DateTime.UtcNow;
        var query = _context.SupportAccessGrants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AsQueryable();

        if (request.TenantId.HasValue && request.TenantId.Value != Guid.Empty)
        {
            query = query.Where(g => g.TenantId == request.TenantId.Value);
        }

        if (request.OnlyActive)
        {
            query = query.Where(g => g.RevokedAtUtc == null && g.ExpiresAtUtc > now);
        }

        var grants = await query
            .OrderByDescending(g => g.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var tenantIds = grants.Select(g => g.TenantId).Distinct().ToList();
        var tenantNames = await _context.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(t => tenantIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.Name, cancellationToken);

        var userIds = grants
            .SelectMany(g => new[] { g.GrantedByUserId, g.TargetSupportUserId })
            .Distinct()
            .ToList();

        var users = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Email, u.FullName })
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        return grants.Select(g =>
        {
            tenantNames.TryGetValue(g.TenantId, out var tenantName);
            users.TryGetValue(g.GrantedByUserId, out var grantedBy);
            users.TryGetValue(g.TargetSupportUserId, out var target);
            return SupportGrantRules.MapToDto(
                g,
                tenantName ?? "Unknown Tenant",
                grantedBy?.Email ?? string.Empty,
                target?.Email ?? string.Empty,
                target?.FullName ?? "Platform Support",
                now);
        }).ToList();
    }
}
