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

namespace HotelSaas.Application.Housekeeping.Commands.StartHousekeepingTask;

public sealed record StartHousekeepingTaskCommand(
    Guid TaskId,
    Guid PropertyId
) : IRequest<HousekeepingTaskDto>;

public sealed class StartHousekeepingTaskCommandValidator : AbstractValidator<StartHousekeepingTaskCommand>
{
    public StartHousekeepingTaskCommandValidator()
    {
        RuleFor(x => x.TaskId)
            .NotEmpty()
            .WithMessage("Mã công việc (TaskId) là bắt buộc.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh (PropertyId) là bắt buộc.");
    }
}

public sealed class StartHousekeepingTaskCommandHandler : IRequestHandler<StartHousekeepingTaskCommand, HousekeepingTaskDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly ICurrentPropertyService _propertyService;
    private readonly IMembershipLookupService _membershipLookupService;

    public StartHousekeepingTaskCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        ICurrentPropertyService propertyService,
        IMembershipLookupService membershipLookupService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
    }

    public async Task<HousekeepingTaskDto> Handle(StartHousekeepingTaskCommand request, CancellationToken cancellationToken)
    {
        var (tenantId, userId, membership) = await HousekeepingAccessHelper.ValidatePropertyAccessAsync(
            _tenantService, _userContext, _propertyService, _membershipLookupService,
            request.PropertyId, cancellationToken);

        var (task, room, property) = await HousekeepingAccessHelper.LoadTaskWithRoomAndPropertyAsync(
            _context, request.TaskId, request.PropertyId, tenantId, cancellationToken);

        if (task.Status != HousekeepingTaskStatus.Pending && task.Status != HousekeepingTaskStatus.Claimed)
        {
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                $"Không thể bắt đầu công việc ở trạng thái {task.Status}.");
        }

        if (task.AssignedToUserId.HasValue &&
            task.AssignedToUserId.Value != userId &&
            membership.StaffRole is not (StaffRole.Owner or StaffRole.Manager))
        {
            throw new ForbiddenException("ERR_TASK_ASSIGNED_TO_OTHER",
                "Công việc này đã được giao cho nhân viên khác.");
        }

        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);
        await _context.LockRoomRowAsync(room.Id, tenantId, request.PropertyId, cancellationToken);

        if (room.Status is RoomStatus.Occupied or RoomStatus.OutOfService)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_ROOM_UNAVAILABLE",
                $"Phòng {room.RoomNumber} đang ở trạng thái {room.Status}, không thể bắt đầu dọn.");
        }

        var utcNow = DateTime.UtcNow;
        if (room.Status == RoomStatus.Dirty)
        {
            room.Status = RoomStatus.Cleaning;
            room.UpdatedAtUtc = utcNow;
        }

        task.AssignedToUserId ??= userId;
        task.Status = HousekeepingTaskStatus.InProgress;
        task.StartedAtUtc ??= utcNow;
        task.UpdatedAtUtc = utcNow;

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await HousekeepingAccessHelper.BuildSingleDtoAsync(
            _context, task, room, property, tenantId, cancellationToken);
    }
}
