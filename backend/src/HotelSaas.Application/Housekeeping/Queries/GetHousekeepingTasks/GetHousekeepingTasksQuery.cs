using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Housekeeping.Common;
using HotelSaas.Application.Housekeeping.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Housekeeping.Queries.GetHousekeepingTasks;

public sealed record GetHousekeepingTasksQuery(
    Guid PropertyId,
    HousekeepingTaskStatus? Status = null,
    HousekeepingPriority? Priority = null,
    bool? AssignedToMe = null
) : IRequest<IReadOnlyList<HousekeepingTaskDto>>;

public sealed class GetHousekeepingTasksQueryValidator : AbstractValidator<GetHousekeepingTasksQuery>
{
    public GetHousekeepingTasksQueryValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh (PropertyId) là bắt buộc.");
    }
}

public sealed class GetHousekeepingTasksQueryHandler : IRequestHandler<GetHousekeepingTasksQuery, IReadOnlyList<HousekeepingTaskDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly ICurrentPropertyService _propertyService;
    private readonly IMembershipLookupService _membershipLookupService;

    public GetHousekeepingTasksQueryHandler(
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

    public async Task<IReadOnlyList<HousekeepingTaskDto>> Handle(GetHousekeepingTasksQuery request, CancellationToken cancellationToken)
    {
        var (tenantId, userId, _) = await HousekeepingAccessHelper.ValidatePropertyAccessAsync(
            _tenantService, _userContext, _propertyService, _membershipLookupService,
            request.PropertyId, cancellationToken);

        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        // Load rooms for the target property first to scope HousekeepingTasks accurately without using shadow FK navigation
        var propertyRooms = await _context.Rooms
            .AsNoTracking()
            .Include(r => r.RoomType)
            .Where(r => r.TenantId == tenantId && r.PropertyId == request.PropertyId)
            .ToListAsync(cancellationToken);

        if (propertyRooms.Count == 0)
        {
            return Array.Empty<HousekeepingTaskDto>();
        }

        var roomLookup = propertyRooms.ToDictionary(r => r.Id);
        var roomIds = roomLookup.Keys.ToList();

        var tasksQuery = _context.HousekeepingTasks
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && roomIds.Contains(t.RoomId));

        if (request.Status.HasValue)
        {
            tasksQuery = tasksQuery.Where(t => t.Status == request.Status.Value);
        }

        if (request.AssignedToMe == true)
        {
            tasksQuery = tasksQuery.Where(t => t.AssignedToUserId == userId);
        }

        var tasks = await tasksQuery.ToListAsync(cancellationToken);
        if (tasks.Count == 0)
        {
            return Array.Empty<HousekeepingTaskDto>();
        }

        // Explicitly join _context.Users via AssignedToUserId (never t.AssignedTo navigation shadow FK)
        var assigneeIds = tasks
            .Where(t => t.AssignedToUserId.HasValue)
            .Select(t => t.AssignedToUserId!.Value)
            .Distinct()
            .ToList();

        var userNames = assigneeIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _context.Users
                .AsNoTracking()
                .Where(u => assigneeIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);

        var vnTz = ReservationTimeHelper.GetVietnamTimeZone();
        var todayLocal = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz));
        var taskRoomIds = tasks.Select(t => t.RoomId).Distinct().ToList();

        var todayConfirmedReservations = await _context.Reservations
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId &&
                        r.PropertyId == request.PropertyId &&
                        r.Status == ReservationStatus.Confirmed &&
                        r.CheckInDate == todayLocal &&
                        taskRoomIds.Contains(r.RoomId))
            .ToListAsync(cancellationToken);

        var reservationsByRoom = todayConfirmedReservations
            .GroupBy(r => r.RoomId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Reservation>)g.ToList());

        var dtos = new List<HousekeepingTaskDto>(tasks.Count);
        foreach (var task in tasks)
        {
            if (!roomLookup.TryGetValue(task.RoomId, out var room))
            {
                continue;
            }

            string? assignedName = null;
            if (task.AssignedToUserId.HasValue)
            {
                userNames.TryGetValue(task.AssignedToUserId.Value, out assignedName);
            }

            reservationsByRoom.TryGetValue(room.Id, out var roomRes);
            var dto = HousekeepingAccessHelper.MapDto(
                task,
                room,
                assignedName,
                property,
                roomRes ?? Array.Empty<Reservation>());

            if (request.Priority.HasValue && dto.EffectivePriority != request.Priority.Value)
            {
                continue;
            }

            dtos.Add(dto);
        }

        return dtos
            .OrderBy(d => d.Status == HousekeepingTaskStatus.Completed ? 1 : 0)
            .ThenByDescending(d => (int)d.EffectivePriority)
            .ThenBy(d => d.NextCheckInAtUtc ?? DateTime.MaxValue)
            .ThenBy(d => d.CreatedAtUtc)
            .ToList();
    }
}
