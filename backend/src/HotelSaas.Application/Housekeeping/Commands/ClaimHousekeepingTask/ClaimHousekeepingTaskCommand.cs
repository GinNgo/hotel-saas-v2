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

namespace HotelSaas.Application.Housekeeping.Commands.ClaimHousekeepingTask;

public sealed record ClaimHousekeepingTaskCommand(
    Guid TaskId,
    Guid PropertyId
) : IRequest<HousekeepingTaskDto>;

public sealed class ClaimHousekeepingTaskCommandValidator : AbstractValidator<ClaimHousekeepingTaskCommand>
{
    public ClaimHousekeepingTaskCommandValidator()
    {
        RuleFor(x => x.TaskId)
            .NotEmpty()
            .WithMessage("Mã công việc (TaskId) là bắt buộc.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh (PropertyId) là bắt buộc.");
    }
}

public sealed class ClaimHousekeepingTaskCommandHandler : IRequestHandler<ClaimHousekeepingTaskCommand, HousekeepingTaskDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly ICurrentPropertyService _propertyService;
    private readonly IMembershipLookupService _membershipLookupService;

    public ClaimHousekeepingTaskCommandHandler(
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

    public async Task<HousekeepingTaskDto> Handle(ClaimHousekeepingTaskCommand request, CancellationToken cancellationToken)
    {
        var (tenantId, userId, _) = await HousekeepingAccessHelper.ValidatePropertyAccessAsync(
            _tenantService, _userContext, _propertyService, _membershipLookupService,
            request.PropertyId, cancellationToken);

        var (task, room, property) = await HousekeepingAccessHelper.LoadTaskWithRoomAndPropertyAsync(
            _context, request.TaskId, request.PropertyId, tenantId, cancellationToken);

        // BR-HK06: Only Pending tasks can be self-claimed, and never steal another staff member's claimed/assigned task
        if (task.Status != HousekeepingTaskStatus.Pending)
        {
            throw new ConflictException("ERR_TASK_ALREADY_CLAIMED",
                "Công việc này đã có nhân viên khác nhận hoặc đang thực hiện.");
        }

        if (task.AssignedToUserId.HasValue && task.AssignedToUserId.Value != userId)
        {
            throw new ConflictException("ERR_TASK_ALREADY_ASSIGNED",
                "Công việc này đã được phân công cho nhân viên khác.");
        }

        task.AssignedToUserId = userId;
        task.Status = HousekeepingTaskStatus.Claimed;
        task.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return await HousekeepingAccessHelper.BuildSingleDtoAsync(
            _context, task, room, property, tenantId, cancellationToken);
    }
}
