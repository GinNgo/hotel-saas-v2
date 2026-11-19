using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Notifications.DTOs;
using HotelSaas.Application.Notifications.Queries.GetNotifications;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Notifications.Commands.MarkAllNotificationsRead;

public sealed record MarkAllNotificationsReadCommand : IRequest<MarkAllNotificationsReadResultDto>;

public sealed class MarkAllNotificationsReadCommandValidator
    : AbstractValidator<MarkAllNotificationsReadCommand>
{
    public MarkAllNotificationsReadCommandValidator()
    {
    }
}

public sealed class MarkAllNotificationsReadCommandHandler
    : IRequestHandler<MarkAllNotificationsReadCommand, MarkAllNotificationsReadResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public MarkAllNotificationsReadCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<MarkAllNotificationsReadResultDto> Handle(
        MarkAllNotificationsReadCommand request,
        CancellationToken cancellationToken)
    {
        var (userId, tenantId) = NotificationScopingHelper.EnsureScopedUser(_currentUser, _tenantService);

        var unread = await _context.Notifications
            .Where(n => n.TenantId == tenantId && n.UserId == userId && !n.IsRead)
            .ToListAsync(cancellationToken);

        if (unread.Count == 0)
        {
            return new MarkAllNotificationsReadResultDto(0);
        }

        var now = DateTime.UtcNow;
        foreach (var item in unread)
        {
            item.IsRead = true;
            item.ReadAtUtc = now;
            item.UpdatedAtUtc = now;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return new MarkAllNotificationsReadResultDto(unread.Count);
    }
}
