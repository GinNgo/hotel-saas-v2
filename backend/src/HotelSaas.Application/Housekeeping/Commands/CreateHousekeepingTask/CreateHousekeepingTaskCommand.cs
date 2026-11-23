using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Housekeeping.Common;
using HotelSaas.Application.Housekeeping.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Housekeeping.Commands.CreateHousekeepingTask;

public sealed record CreateHousekeepingTaskCommand(
    Guid PropertyId,
    Guid RoomId,
    HousekeepingPriority Priority = HousekeepingPriority.Normal,
    string? Notes = null,
    Guid? AssignedToUserId = null
) : IRequest<HousekeepingTaskDto>;

public sealed class CreateHousekeepingTaskCommandValidator : AbstractValidator<CreateHousekeepingTaskCommand>
{
    public CreateHousekeepingTaskCommandValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh (PropertyId) là bắt buộc.");

        RuleFor(x => x.RoomId)
            .NotEmpty()
            .WithMessage("Phòng (RoomId) là bắt buộc.");

        RuleFor(x => x.Priority)
            .IsInEnum()
            .WithMessage("Mức độ ưu tiên không hợp lệ.");

        RuleFor(x => x.Notes)
            .MaximumLength(1000)
            .WithMessage("Ghi chú tối đa 1000 ký tự.");
    }
}

public sealed class CreateHousekeepingTaskCommandHandler : IRequestHandler<CreateHousekeepingTaskCommand, HousekeepingTaskDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly ICurrentPropertyService _propertyService;
    private readonly IMembershipLookupService _membershipLookupService;

    public CreateHousekeepingTaskCommandHandler(
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

    public async Task<HousekeepingTaskDto> Handle(CreateHousekeepingTaskCommand request, CancellationToken cancellationToken)
    {
        var (tenantId, _, _) = await HousekeepingAccessHelper.ValidatePropertyAccessAsync(
            _tenantService, _userContext, _propertyService, _membershipLookupService,
            request.PropertyId, cancellationToken);

        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        var room = await _context.Rooms
            .AsNoTracking()
            .Include(r => r.RoomType)
            .FirstOrDefaultAsync(r => r.Id == request.RoomId && r.TenantId == tenantId && r.PropertyId == request.PropertyId, cancellationToken);

        if (room == null)
        {
            throw new NotFoundException("Không tìm thấy phòng thuộc chi nhánh hiện tại.");
        }

        if (request.AssignedToUserId.HasValue)
        {
            await HousekeepingAccessHelper.ValidateActiveStaffAssigneeAsync(
                _context, tenantId, request.PropertyId, request.AssignedToUserId.Value, cancellationToken);
        }

        var utcNow = DateTime.UtcNow;
        var task = new HousekeepingTask
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoomId = room.Id,
            AssignedToUserId = request.AssignedToUserId,
            Status = HousekeepingTaskStatus.Pending,
            Priority = request.Priority,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAtUtc = utcNow,
            UpdatedAtUtc = utcNow
        };

        _context.HousekeepingTasks.Add(task);
        await _context.SaveChangesAsync(cancellationToken);

        return await HousekeepingAccessHelper.BuildSingleDtoAsync(
            _context, task, room, property, tenantId, cancellationToken);
    }
}
