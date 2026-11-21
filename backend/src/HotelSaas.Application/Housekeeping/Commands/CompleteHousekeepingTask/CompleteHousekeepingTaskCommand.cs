using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Housekeeping.Common;
using HotelSaas.Application.Housekeeping.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Housekeeping.Commands.CompleteHousekeepingTask;

public sealed record CompleteHousekeepingTaskCommand(
    Guid TaskId,
    Guid PropertyId,
    string? Notes = null
) : IRequest<HousekeepingTaskDto>;

public sealed class CompleteHousekeepingTaskCommandValidator : AbstractValidator<CompleteHousekeepingTaskCommand>
{
    public CompleteHousekeepingTaskCommandValidator()
    {
        RuleFor(x => x.TaskId)
            .NotEmpty()
            .WithMessage("Mã công việc (TaskId) là bắt buộc.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh (PropertyId) là bắt buộc.");

        RuleFor(x => x.Notes)
            .MaximumLength(1000)
            .WithMessage("Ghi chú tối đa 1000 ký tự.");
    }
}

public sealed class CompleteHousekeepingTaskCommandHandler : IRequestHandler<CompleteHousekeepingTaskCommand, HousekeepingTaskDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly ICurrentPropertyService _propertyService;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly INotificationDispatcher? _notificationDispatcher;

    public CompleteHousekeepingTaskCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        ICurrentPropertyService propertyService,
        IMembershipLookupService membershipLookupService,
        INotificationDispatcher? notificationDispatcher = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _notificationDispatcher = notificationDispatcher;
    }

    public async Task<HousekeepingTaskDto> Handle(CompleteHousekeepingTaskCommand request, CancellationToken cancellationToken)
    {
        var (tenantId, userId, membership) = await HousekeepingAccessHelper.ValidatePropertyAccessAsync(
            _tenantService, _userContext, _propertyService, _membershipLookupService,
            request.PropertyId, cancellationToken);

        var (task, room, property) = await HousekeepingAccessHelper.LoadTaskWithRoomAndPropertyAsync(
            _context, request.TaskId, request.PropertyId, tenantId, cancellationToken);

        if (task.Status == HousekeepingTaskStatus.Completed)
        {
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                "Công việc dọn phòng này đã được hoàn tất trước đó.");
        }

        if (task.AssignedToUserId.HasValue &&
            task.AssignedToUserId.Value != userId &&
            membership.StaffRole is not (StaffRole.Owner or StaffRole.Manager or StaffRole.Receptionist))
        {
            throw new ForbiddenException("ERR_TASK_ASSIGNED_TO_OTHER",
                "Công việc này đã được giao cho nhân viên khác.");
        }

        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);
        await _context.LockRoomRowAsync(room.Id, tenantId, request.PropertyId, cancellationToken);

        var utcNow = DateTime.UtcNow;
        if (room.Status is RoomStatus.Cleaning or RoomStatus.Dirty)
        {
            room.Status = RoomStatus.Clean;
            room.UpdatedAtUtc = utcNow;
        }

        task.AssignedToUserId ??= userId;
        task.Status = HousekeepingTaskStatus.Completed;
        task.StartedAtUtc ??= utcNow;
        task.CompletedAtUtc = utcNow;
        task.UpdatedAtUtc = utcNow;

        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            var trimmedNotes = request.Notes.Trim();
            task.Notes = string.IsNullOrWhiteSpace(task.Notes)
                ? trimmedNotes
                : $"{task.Notes} | {trimmedNotes}";
        }

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        if (_notificationDispatcher != null)
        {
            try
            {
                await _notificationDispatcher.NotifyHousekeepingAlertAsync(
                    request.PropertyId.ToString(),
                    room.RoomNumber,
                    RoomStatus.Clean.ToString(),
                    $"Phòng {room.RoomNumber} đã dọn sạch và sẵn sàng đón khách.",
                    cancellationToken);
            }
            catch
            {
                // SignalR delivery must never roll back completed housekeeping work
            }
        }

        return await HousekeepingAccessHelper.BuildSingleDtoAsync(
            _context, task, room, property, tenantId, cancellationToken);
    }
}
