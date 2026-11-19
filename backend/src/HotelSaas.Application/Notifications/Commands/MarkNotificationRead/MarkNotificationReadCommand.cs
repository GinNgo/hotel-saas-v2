using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Notifications.DTOs;
using HotelSaas.Application.Notifications.Queries.GetNotifications;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Notifications.Commands.MarkNotificationRead;

public sealed record MarkNotificationReadCommand(Guid Id) : IRequest<NotificationDto>;

public sealed class MarkNotificationReadCommandValidator : AbstractValidator<MarkNotificationReadCommand>
{
    public MarkNotificationReadCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Mã thông báo là bắt buộc.");
    }
}

public sealed class MarkNotificationReadCommandHandler
    : IRequestHandler<MarkNotificationReadCommand, NotificationDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public MarkNotificationReadCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<NotificationDto> Handle(
        MarkNotificationReadCommand request,
        CancellationToken cancellationToken)
    {
        var (userId, tenantId) = NotificationScopingHelper.EnsureScopedUser(_currentUser, _tenantService);

        var notification = await _context.Notifications
            .FirstOrDefaultAsync(
                n => n.Id == request.Id && n.TenantId == tenantId && n.UserId == userId,
                cancellationToken);

        if (notification == null)
        {
            throw new NotFoundException(nameof(Notification), request.Id);
        }

        if (!notification.IsRead)
        {
            var now = DateTime.UtcNow;
            notification.IsRead = true;
            notification.ReadAtUtc = now;
            notification.UpdatedAtUtc = now;
            await _context.SaveChangesAsync(cancellationToken);
        }

        return NotificationScopingHelper.ToDto(notification);
    }
}
