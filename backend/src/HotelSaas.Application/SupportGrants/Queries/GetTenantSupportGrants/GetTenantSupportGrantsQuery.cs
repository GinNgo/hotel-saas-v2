using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.SupportGrants.Commands.CreateSupportGrant;
using HotelSaas.Application.SupportGrants.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.SupportGrants.Queries.GetTenantSupportGrants;

public sealed record GetTenantSupportGrantsQuery : IRequest<IReadOnlyList<SupportAccessGrantDto>>;

public sealed class GetTenantSupportGrantsQueryHandler
    : IRequestHandler<GetTenantSupportGrantsQuery, IReadOnlyList<SupportAccessGrantDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public GetTenantSupportGrantsQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<IReadOnlyList<SupportAccessGrantDto>> Handle(
        GetTenantSupportGrantsQuery request,
        CancellationToken cancellationToken)
    {
        SupportGrantRules.EnsureTenantOwnerAccess(_currentUser, _tenantService, out var tenantId);

        var grants = await _context.SupportAccessGrants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(g => g.TenantId == tenantId)
            .OrderByDescending(g => g.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var tenantName = await _context.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.Name)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

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

        var now = DateTime.UtcNow;
        return grants.Select(g =>
        {
            users.TryGetValue(g.GrantedByUserId, out var grantedBy);
            users.TryGetValue(g.TargetSupportUserId, out var target);
            return SupportGrantRules.MapToDto(
                g,
                tenantName,
                grantedBy?.Email ?? string.Empty,
                target?.Email ?? string.Empty,
                target?.FullName ?? "Platform Support",
                now);
        }).ToList();
    }
}

public sealed record GetTenantSupportAuditLogsQuery(Guid? GrantId = null)
    : IRequest<IReadOnlyList<SupportAuditLogDto>>;

public sealed class GetTenantSupportAuditLogsQueryHandler
    : IRequestHandler<GetTenantSupportAuditLogsQuery, IReadOnlyList<SupportAuditLogDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public GetTenantSupportAuditLogsQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<IReadOnlyList<SupportAuditLogDto>> Handle(
        GetTenantSupportAuditLogsQuery request,
        CancellationToken cancellationToken)
    {
        SupportGrantRules.EnsureTenantOwnerAccess(_currentUser, _tenantService, out var tenantId);

        var query = _context.SupportAuditLogs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(l => l.TenantId == tenantId);

        if (request.GrantId.HasValue && request.GrantId.Value != Guid.Empty)
        {
            query = query.Where(l => l.SupportAccessGrantId == request.GrantId.Value);
        }

        var logs = await query
            .OrderByDescending(l => l.CreatedAtUtc)
            .Take(100)
            .ToListAsync(cancellationToken);

        var actorIds = logs.Select(l => l.ActorUserId).Distinct().ToList();
        var actorEmails = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => actorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Email, cancellationToken);

        return logs.Select(l => new SupportAuditLogDto(
            l.Id,
            l.TenantId,
            l.SupportAccessGrantId,
            l.ActorUserId,
            actorEmails.TryGetValue(l.ActorUserId, out var email) ? email : string.Empty,
            l.Action,
            l.ResourcePath,
            l.DetailsJson,
            l.IpAddress,
            l.CreatedAtUtc
        )).ToList();
    }
}

public sealed record GetAvailableSupportUsersQuery : IRequest<IReadOnlyList<SupportUserOptionDto>>;

public sealed class GetAvailableSupportUsersQueryHandler
    : IRequestHandler<GetAvailableSupportUsersQuery, IReadOnlyList<SupportUserOptionDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public GetAvailableSupportUsersQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<IReadOnlyList<SupportUserOptionDto>> Handle(
        GetAvailableSupportUsersQuery request,
        CancellationToken cancellationToken)
    {
        SupportGrantRules.EnsureTenantOwnerAccess(_currentUser, _tenantService, out _);

        return await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(u => u.IsActive && u.GlobalRole == GlobalUserRole.SuperAdmin)
            .OrderBy(u => u.FullName)
            .Select(u => new SupportUserOptionDto(u.Id, u.FullName, u.Email))
            .ToListAsync(cancellationToken);
    }
}
