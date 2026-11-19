using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Notifications.Queries.GetNotifications;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Notifications.Commands.DeleteNotification;

public sealed record DeleteNotificationCommand(Guid Id) : IRequest<Unit>;

public sealed class DeleteNotificationCommandValidator : AbstractValidator<DeleteNotificationCommand>
{
    public DeleteNotificationCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Mã thông báo là bắt buộc.");
    }
}

public sealed class DeleteNotificationCommandHandler : IRequestHandler<DeleteNotificationCommand, Unit>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;

    public DeleteNotificationCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<Unit> Handle(
        DeleteNotificationCommand request,
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

        _context.Notifications.Remove(notification);
        await _context.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
