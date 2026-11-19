using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Notifications.DTOs;
using HotelSaas.Application.Notifications.Queries.GetNotifications;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Notifications.Queries.GetUnreadNotificationCount;

public sealed record GetUnreadNotificationCountQuery : IRequest<UnreadNotificationCountDto>;

public sealed class GetUnreadNotificationCountQueryHandler
    : IRequestHandler<GetUnreadNotificationCountQuery, UnreadNotificationCountDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public GetUnreadNotificationCountQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<UnreadNotificationCountDto> Handle(
        GetUnreadNotificationCountQuery request,
        CancellationToken cancellationToken)
    {
        var (userId, tenantId) = NotificationScopingHelper.EnsureScopedUser(_currentUser, _tenantService);

        var count = await _context.Notifications
            .AsNoTracking()
            .CountAsync(n => n.TenantId == tenantId && n.UserId == userId && !n.IsRead, cancellationToken);

        return new UnreadNotificationCountDto(count);
    }
}
