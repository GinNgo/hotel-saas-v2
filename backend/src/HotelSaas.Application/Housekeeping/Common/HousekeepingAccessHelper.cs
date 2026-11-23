using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Housekeeping.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Housekeeping.Common;

internal static class HousekeepingAccessHelper
{
    public static async Task<(Guid TenantId, Guid UserId, MembershipLookupResult Membership)> ValidatePropertyAccessAsync(
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        ICurrentPropertyService propertyService,
        IMembershipLookupService membershipLookupService,
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var tenantId = tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant context is required.");
        }

        var userId = userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("User identity context is required.");
        }

        if (propertyId == Guid.Empty)
        {
            throw new BadRequestException("ERR_PROPERTY_REQUIRED", "Vui lòng chọn chi nhánh làm việc.");
        }

        if (propertyService.HeaderPropertyId.HasValue && propertyService.HeaderPropertyId.Value != propertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh trong nội dung yêu cầu.");
        }

        if (!propertyService.IsTenantWide &&
            propertyService.TokenPropertyId.HasValue &&
            propertyService.TokenPropertyId.Value != propertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong nội dung yêu cầu không khớp với chi nhánh trong token xác thực.");
        }

        var membership = await membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            propertyId,
            cancellationToken);

        if (membership.Status != MembershipLookupStatus.Success)
        {
            switch (membership.Status)
            {
                case MembershipLookupStatus.MembershipRevoked:
                    throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED",
                        membership.ErrorMessage ?? "Quyền nhân sự tại chi nhánh đã bị thu hồi.");
                case MembershipLookupStatus.PropertyNotFound:
                    throw new NotFoundException(membership.ErrorMessage ?? "Chi nhánh không tồn tại.");
                case MembershipLookupStatus.PropertyInactive:
                    throw new ConflictException("ERR_PROPERTY_INACTIVE",
                        membership.ErrorMessage ?? "Chi nhánh hiện không hoạt động.");
                case MembershipLookupStatus.PropertyForbidden:
                    throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN",
                        membership.ErrorMessage ?? "Bạn không có quyền truy cập chi nhánh này.");
                case MembershipLookupStatus.TenantNotFoundOrInactive:
                    throw new ForbiddenException("ERR_TENANT_INACTIVE",
                        membership.ErrorMessage ?? "Doanh nghiệp hiện bị tạm ngưng.");
                case MembershipLookupStatus.UserNotFoundOrInactive:
                    throw new UnauthorizedAccessException("ERR_USER_DEACTIVATED: " +
                        (membership.ErrorMessage ?? "Tài khoản người dùng đã bị vô hiệu hóa."));
                case MembershipLookupStatus.PropertyRequired:
                    throw new ForbiddenException("ERR_PROPERTY_REQUIRED",
                        membership.ErrorMessage ?? "Yêu cầu chọn chi nhánh làm việc để tiếp tục.");
                default:
                    throw new ForbiddenException("ERR_FORBIDDEN",
                        membership.ErrorMessage ?? "Không có quyền thực hiện thao tác trên chi nhánh này.");
            }
        }

        return (tenantId.Value, userId, membership);
    }

    public static async Task<(HousekeepingTask Task, Room Room, Property Property)> LoadTaskWithRoomAndPropertyAsync(
        IApplicationDbContext context,
        Guid taskId,
        Guid propertyId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var property = await context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == propertyId && p.TenantId == tenantId, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        var task = await context.HousekeepingTasks
            .FirstOrDefaultAsync(t => t.Id == taskId && t.TenantId == tenantId, cancellationToken);

        if (task == null)
        {
            throw new NotFoundException("Không tìm thấy công việc dọn phòng.");
        }

        var room = await context.Rooms
            .Include(r => r.RoomType)
            .FirstOrDefaultAsync(r => r.Id == task.RoomId && r.TenantId == tenantId && r.PropertyId == propertyId, cancellationToken);

        if (room == null)
        {
            throw new NotFoundException("Không tìm thấy phòng thuộc chi nhánh hiện tại.");
        }

        return (task, room, property);
    }

    public static async Task ValidateActiveStaffAssigneeAsync(
        IApplicationDbContext context,
        Guid tenantId,
        Guid propertyId,
        Guid assignedToUserId,
        CancellationToken cancellationToken)
    {
        var userExists = await context.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == assignedToUserId && u.IsActive, cancellationToken);

        if (!userExists)
        {
            throw new NotFoundException("Nhân viên được phân công không tồn tại hoặc đã bị vô hiệu hóa.");
        }

        var hasStaffMembership = await context.TenantStaffMembers
            .AsNoTracking()
            .AnyAsync(ts => ts.TenantId == tenantId &&
                            ts.UserId == assignedToUserId &&
                            ts.IsActive &&
                            (ts.PropertyId == null || ts.PropertyId == propertyId), cancellationToken);

        if (!hasStaffMembership)
        {
            throw new BadRequestException("ERR_INVALID_ASSIGNEE",
                "Nhân viên được chọn không có quyền làm việc tại chi nhánh này.");
        }
    }

    public static async Task<HousekeepingTaskDto> BuildSingleDtoAsync(
        IApplicationDbContext context,
        HousekeepingTask task,
        Room room,
        Property property,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var vnTz = ReservationTimeHelper.GetVietnamTimeZone();
        var todayLocal = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTz));

        string? assignedToName = null;
        if (task.AssignedToUserId.HasValue)
        {
            assignedToName = await context.Users
                .AsNoTracking()
                .Where(u => u.Id == task.AssignedToUserId.Value)
                .Select(u => u.FullName)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var upcomingReservations = await context.Reservations
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId &&
                        r.PropertyId == property.Id &&
                        r.RoomId == room.Id &&
                        r.Status == ReservationStatus.Confirmed &&
                        r.CheckInDate == todayLocal)
            .ToListAsync(cancellationToken);

        return MapDto(task, room, assignedToName, property, upcomingReservations);
    }

    public static HousekeepingTaskDto MapDto(
        HousekeepingTask task,
        Room room,
        string? assignedToName,
        Property property,
        IReadOnlyList<Reservation> roomTodayConfirmedReservations)
    {
        DateTime? nextCheckInAtUtc = null;
        if (roomTodayConfirmedReservations.Count > 0)
        {
            nextCheckInAtUtc = roomTodayConfirmedReservations
                .Select(r => ReservationTimeHelper.GetEffectiveStayUtcInterval(r, property).StartAtUtc)
                .OrderBy(dt => dt)
                .First();
        }

        var hasUpcomingCheckIn = nextCheckInAtUtc.HasValue;
        var effectivePriority = hasUpcomingCheckIn && task.Status != HousekeepingTaskStatus.Completed
            ? HousekeepingPriority.Urgent
            : task.Priority;

        return new HousekeepingTaskDto
        {
            Id = task.Id,
            RoomId = room.Id,
            RoomNumber = room.RoomNumber,
            Floor = room.Floor,
            RoomTypeName = room.RoomType?.Name ?? string.Empty,
            RoomStatus = room.Status,
            Status = task.Status,
            Priority = task.Priority,
            EffectivePriority = effectivePriority,
            HasUpcomingCheckIn = hasUpcomingCheckIn,
            NextCheckInAtUtc = nextCheckInAtUtc,
            AssignedToUserId = task.AssignedToUserId,
            AssignedToName = assignedToName,
            Notes = task.Notes,
            StartedAtUtc = task.StartedAtUtc,
            CompletedAtUtc = task.CompletedAtUtc,
            CreatedAtUtc = task.CreatedAtUtc,
            UpdatedAtUtc = task.UpdatedAtUtc == default ? task.CreatedAtUtc : task.UpdatedAtUtc
        };
    }
}
