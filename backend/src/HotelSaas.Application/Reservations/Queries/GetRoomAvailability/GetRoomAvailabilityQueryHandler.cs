using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reservations.Queries.GetRoomAvailability;

public sealed class GetRoomAvailabilityQueryHandler : IRequestHandler<GetRoomAvailabilityQuery, IReadOnlyList<RoomAvailabilityDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService? _propertyService;

    public GetRoomAvailabilityQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ICurrentPropertyService? propertyService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _propertyService = propertyService;
    }

    public async Task<IReadOnlyList<RoomAvailabilityDto>> Handle(GetRoomAvailabilityQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant context is required.");
        }

        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("User identity context is required.");
        }

        if (_propertyService != null)
        {
            if (_propertyService.HeaderPropertyId.HasValue && _propertyService.HeaderPropertyId.Value != request.PropertyId)
            {
                throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                    "Chi nhánh trong header X-Property-Id không khớp với chi nhánh trong nội dung yêu cầu.");
            }

            if (!_propertyService.IsTenantWide &&
                _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != request.PropertyId)
            {
                throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                    "Chi nhánh trong nội dung yêu cầu không khớp với chi nhánh trong token xác thực.");
            }
        }

        // Authoritative membership check - ONLY Success proceeds
        var membership = await _membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            request.PropertyId,
            cancellationToken);

        if (membership.Status != MembershipLookupStatus.Success)
        {
            switch (membership.Status)
            {
                case MembershipLookupStatus.MembershipRevoked:
                    throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", membership.ErrorMessage ?? "Quyền nhân sự tại chi nhánh đã bị thu hồi.");
                case MembershipLookupStatus.PropertyNotFound:
                    throw new NotFoundException(membership.ErrorMessage ?? "Chi nhánh không tồn tại.");
                case MembershipLookupStatus.PropertyInactive:
                    throw new ConflictException("ERR_PROPERTY_INACTIVE", membership.ErrorMessage ?? "Chi nhánh hiện không hoạt động.");
                case MembershipLookupStatus.PropertyForbidden:
                    throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", membership.ErrorMessage ?? "Bạn không có quyền truy cập chi nhánh này.");
                case MembershipLookupStatus.TenantNotFoundOrInactive:
                    throw new ForbiddenException("ERR_TENANT_INACTIVE", membership.ErrorMessage ?? "Doanh nghiệp hiện bị tạm ngưng.");
                case MembershipLookupStatus.UserNotFoundOrInactive:
                    throw new UnauthorizedAccessException("ERR_USER_DEACTIVATED: " + (membership.ErrorMessage ?? "Tài khoản người dùng đã bị vô hiệu hóa."));
                case MembershipLookupStatus.PropertyRequired:
                    throw new ForbiddenException("ERR_PROPERTY_REQUIRED", membership.ErrorMessage ?? "Yêu cầu chọn chi nhánh làm việc để tiếp tục.");
                default:
                    throw new ForbiddenException("ERR_FORBIDDEN", membership.ErrorMessage ?? "Không có quyền thực hiện thao tác trên chi nhánh này.");
            }
        }

        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId.Value, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        DateTime effectiveStartUtc;
        DateTime effectiveEndUtc;

        if (request.RentalType == RentalType.Hourly)
        {
            effectiveStartUtc = request.StartAtUtc;
            effectiveEndUtc = request.EndAtUtc;
        }
        else
        {
            // Finding 1: Authoritative interval alignment between Quote and Availability
            // Preserves quoted early check-in or late check-out times without premature normalization
            if (request.StartAtUtc != default && request.EndAtUtc != default && request.EndAtUtc > request.StartAtUtc)
            {
                effectiveStartUtc = request.StartAtUtc;
                effectiveEndUtc = request.EndAtUtc;
            }
            else if (request.CheckInDate.HasValue && request.CheckOutDate.HasValue)
            {
                var overnightInterval = ReservationTimeHelper.GetOvernightUtcInterval(
                    request.CheckInDate.Value, request.CheckOutDate.Value, property.CheckInTime, property.CheckOutTime);
                effectiveStartUtc = overnightInterval.StartAtUtc;
                effectiveEndUtc = overnightInterval.EndAtUtc;
            }
            else
            {
                effectiveStartUtc = request.StartAtUtc;
                effectiveEndUtc = request.EndAtUtc;
            }
        }

        var bufferMinutes = Math.Max(ReservationTimeHelper.MinimumTurnoverBufferMinutes, property.BufferMinutes);

        var roomsQuery = _context.Rooms
            .AsNoTracking()
            .Include(r => r.RoomType)
            .Where(r => r.TenantId == tenantId.Value && r.PropertyId == request.PropertyId && r.IsActive);

        if (request.RoomTypeId.HasValue)
        {
            roomsQuery = roomsQuery.Where(r => r.RoomTypeId == request.RoomTypeId.Value);
        }

        var rooms = await roomsQuery
            .OrderBy(r => r.Floor)
            .ThenBy(r => r.RoomNumber)
            .ToListAsync(cancellationToken);

        var roomIds = rooms.Select(r => r.Id).ToList();

        var activeReservations = await _context.Reservations
            .AsNoTracking()
            .Where(r => r.TenantId == tenantId.Value &&
                        r.PropertyId == request.PropertyId &&
                        roomIds.Contains(r.RoomId) &&
                        (r.Status == ReservationStatus.PendingPayment ||
                         r.Status == ReservationStatus.Confirmed ||
                         r.Status == ReservationStatus.CheckedIn))
            .ToListAsync(cancellationToken);

        var reservationsByRoom = activeReservations.ToLookup(r => r.RoomId);

        var nowUtc = DateTime.UtcNow;
        var results = new List<RoomAvailabilityDto>();
        foreach (var room in rooms)
        {
            var roomReservations = reservationsByRoom[room.Id];
            bool isConflict = false;
            string? conflictReason = null;

            foreach (var existing in roomReservations)
            {
                if (!ReservationTimeHelper.IsBlockingReservation(existing, nowUtc))
                {
                    continue;
                }

                var (extStart, extEnd) = ReservationTimeHelper.GetEffectiveStayUtcInterval(existing, property);
                if (ReservationTimeHelper.HasOverlap(effectiveStartUtc, effectiveEndUtc, extStart, extEnd, bufferMinutes))
                {
                    isConflict = true;
                    conflictReason = $"Đã có đơn đặt #{existing.ConfirmationCode} trùng lịch hoặc vi phạm đệm dọn phòng {bufferMinutes} phút.";
                    break;
                }
            }

            results.Add(new RoomAvailabilityDto
            {
                RoomId = room.Id,
                RoomNumber = room.RoomNumber,
                Floor = room.Floor,
                RoomTypeId = room.RoomTypeId,
                RoomTypeName = room.RoomType?.Name ?? string.Empty,
                HousekeepingStatus = room.Status,
                IsAvailable = !isConflict,
                ConflictReason = conflictReason
            });
        }

        return results;
    }
}
