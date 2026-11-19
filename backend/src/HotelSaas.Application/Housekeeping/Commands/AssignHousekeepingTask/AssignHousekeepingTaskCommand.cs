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

namespace HotelSaas.Application.Housekeeping.Commands.AssignHousekeepingTask;

public sealed record AssignHousekeepingTaskCommand(
    Guid TaskId,
    Guid PropertyId,
    Guid AssignedToUserId
) : IRequest<HousekeepingTaskDto>;

public sealed class AssignHousekeepingTaskCommandValidator : AbstractValidator<AssignHousekeepingTaskCommand>
{
    public AssignHousekeepingTaskCommandValidator()
    {
        RuleFor(x => x.TaskId)
            .NotEmpty()
            .WithMessage("Mã công việc (TaskId) là bắt buộc.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh (PropertyId) là bắt buộc.");

        RuleFor(x => x.AssignedToUserId)
            .NotEmpty()
            .WithMessage("Nhân viên được phân công là bắt buộc.");
    }
}

public sealed class AssignHousekeepingTaskCommandHandler : IRequestHandler<AssignHousekeepingTaskCommand, HousekeepingTaskDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly ICurrentPropertyService _propertyService;
    private readonly IMembershipLookupService _membershipLookupService;

    public AssignHousekeepingTaskCommandHandler(
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

    public async Task<HousekeepingTaskDto> Handle(AssignHousekeepingTaskCommand request, CancellationToken cancellationToken)
    {
        var (tenantId, _, _) = await HousekeepingAccessHelper.ValidatePropertyAccessAsync(
            _tenantService, _userContext, _propertyService, _membershipLookupService,
            request.PropertyId, cancellationToken);

        var (task, room, property) = await HousekeepingAccessHelper.LoadTaskWithRoomAndPropertyAsync(
            _context, request.TaskId, request.PropertyId, tenantId, cancellationToken);

        if (task.Status == HousekeepingTaskStatus.Completed)
        {
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                "Công việc dọn phòng đã hoàn tất, không thể phân công lại.");
        }

        await HousekeepingAccessHelper.ValidateActiveStaffAssigneeAsync(
            _context, tenantId, request.PropertyId, request.AssignedToUserId, cancellationToken);

        task.AssignedToUserId = request.AssignedToUserId;
        task.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return await HousekeepingAccessHelper.BuildSingleDtoAsync(
            _context, task, room, property, tenantId, cancellationToken);
    }
}
