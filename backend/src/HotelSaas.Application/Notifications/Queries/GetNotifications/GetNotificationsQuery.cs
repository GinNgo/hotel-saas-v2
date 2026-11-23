using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Notifications.DTOs;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Notifications.Queries.GetNotifications;

internal static class NotificationScopingHelper
{
    internal static (Guid UserId, Guid TenantId) EnsureScopedUser(
        ICurrentUserContext currentUser,
        ICurrentTenantService tenantService)
    {
        if (currentUser.UserId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("ERR_UNAUTHORIZED: Yêu cầu danh tính người dùng hợp lệ.");
        }

        var tenantId = tenantService.TenantId ?? currentUser.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Yêu cầu ngữ cảnh doanh nghiệp (Tenant) hợp lệ.");
        }

        return (currentUser.UserId, tenantId.Value);
    }

    internal static NotificationDto ToDto(Notification n) => new(
        n.Id,
        n.TenantId,
        n.UserId,
        n.Type,
        n.Type.ToString(),
        n.Title,
        n.Message,
        n.IsRead,
        n.ReadAtUtc,
        n.Data,
        n.RelatedEntityId,
        n.RelatedEntityType,
        n.CreatedAtUtc
    );
}

public sealed record GetNotificationsQuery(
    int Page = 1,
    int PageSize = 20,
    bool UnreadOnly = false
) : IRequest<PagedResult<NotificationDto>>;

public sealed class GetNotificationsQueryHandler
    : IRequestHandler<GetNotificationsQuery, PagedResult<NotificationDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public GetNotificationsQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<PagedResult<NotificationDto>> Handle(
        GetNotificationsQuery request,
        CancellationToken cancellationToken)
    {
        var (userId, tenantId) = NotificationScopingHelper.EnsureScopedUser(_currentUser, _tenantService);

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var query = _context.Notifications
            .AsNoTracking()
            .Where(n => n.TenantId == tenantId && n.UserId == userId);

        if (request.UnreadOnly)
        {
            query = query.Where(n => !n.IsRead);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(n => n.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<NotificationDto>(
            items.Select(NotificationScopingHelper.ToDto).ToList(),
            totalCount,
            page,
            pageSize);
    }
}
