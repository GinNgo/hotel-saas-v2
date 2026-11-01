using System;
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

namespace HotelSaas.Application.Reservations.Commands.CheckInReservation;

/// <summary>
/// Handles checking in a reservation: validates FSM status, locks the physical room,
/// verifies the room is Clean, transitions the reservation to CheckedIn and the room to Occupied.
/// </summary>
public sealed class CheckInReservationCommandHandler : IRequestHandler<CheckInReservationCommand, ReservationDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly INotificationDispatcher? _notificationDispatcher;

    public CheckInReservationCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ICurrentPropertyService propertyService,
        INotificationDispatcher? notificationDispatcher = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _notificationDispatcher = notificationDispatcher;
    }

    public async Task<ReservationDetailDto> Handle(CheckInReservationCommand request, CancellationToken cancellationToken)
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

        // Branch context header / token validation
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

        // Authoritative membership check - fail-closed
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

        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);

        // 1. Fetch reservation metadata with NoTracking to identify target room
        var resHeader = await _context.Reservations
            .AsNoTracking()
            .Where(r => r.Id == request.ReservationId &&
                        r.PropertyId == request.PropertyId &&
                        r.TenantId == tenantId.Value)
            .Select(r => new { r.Id, r.RoomId })
            .FirstOrDefaultAsync(cancellationToken);

        if (resHeader == null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy đơn đặt phòng.");
        }

        // 2. Lock room row first to serialize all lifecycle operations on this room
        await _context.LockRoomRowAsync(resHeader.RoomId, tenantId.Value, request.PropertyId, cancellationToken);

        // 3. Load fresh tracked reservation and room under the exclusive lock
        var reservation = await _context.Reservations
            .Include(r => r.Room)
                .ThenInclude(room => room!.RoomType)
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId &&
                                      r.PropertyId == request.PropertyId &&
                                      r.TenantId == tenantId.Value, cancellationToken);

        if (reservation == null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy đơn đặt phòng.");
        }

        // 4. Validate FSM transition under lock
        if (reservation.Status == ReservationStatus.CheckedIn)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION", "Đặt phòng này đã được nhận phòng trước đó.");
        }

        if (reservation.Status == ReservationStatus.CheckedOut)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION", "Đặt phòng này đã hoàn tất trả phòng, không thể nhận phòng lại.");
        }

        if (reservation.Status == ReservationStatus.Cancelled)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION", "Đặt phòng này đã bị hủy, không thể thực hiện nhận phòng.");
        }

        if (reservation.Status != ReservationStatus.Confirmed && reservation.Status != ReservationStatus.PendingPayment)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION", $"Không thể nhận phòng khi đặt phòng đang ở trạng thái {reservation.Status}.");
        }

        // Shared Invariant: Online Hold Guard (Finding 1)
        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        if (snapshot != null && snapshot.IsOnlineHold)
        {
            // Online hold that is still PendingPayment can NEVER be checked in
            if (reservation.Status == ReservationStatus.PendingPayment)
            {
                await transaction.RollbackAsync(cancellationToken);
                if (!snapshot.HoldExpiresAtUtc.HasValue || snapshot.HoldExpiresAtUtc.Value <= DateTime.UtcNow)
                {
                    throw new ConflictException("ERR_HOLD_EXPIRED",
                        "Đơn giữ chỗ trực tuyến đã hết hạn, không thể thực hiện nhận phòng.");
                }

                throw new ConflictException("ERR_HOLD_NOT_CONFIRMED",
                    "Đơn giữ chỗ trực tuyến chưa được xác nhận đặt cọc (chưa ở trạng thái Confirmed), không thể nhận phòng.");
            }
        }

        var room = reservation.Room;
        if (room == null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new NotFoundException("Phòng tương ứng không tồn tại.");
        }

        // 5. Verify room readiness under lock
        if (room.Status == RoomStatus.Occupied)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_ROOM_OCCUPIED",
                $"Phòng {room.RoomNumber} hiện đang có khách lưu trú (Occupied).");
        }

        if (room.Status == RoomStatus.Dirty || room.Status == RoomStatus.Cleaning)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_ROOM_NOT_CLEAN",
                $"Phòng {room.RoomNumber} chưa được dọn dẹp sạch sẽ (trạng thái hiện tại: {room.Status}). Cần hoàn thành dọn phòng trước khi nhận phòng.");
        }

        if (room.Status == RoomStatus.OutOfService)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_ROOM_OUT_OF_SERVICE",
                $"Phòng {room.RoomNumber} đang tạm ngưng phục vụ.");
        }

        if (room.Status != RoomStatus.Clean)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_ROOM_UNAVAILABLE",
                $"Phòng {room.RoomNumber} không ở trạng thái sẵn sàng để nhận phòng (trạng thái: {room.Status}).");
        }

        // 6. Execute atomic state transitions
        reservation.Status = ReservationStatus.CheckedIn;
        if (string.IsNullOrWhiteSpace(reservation.SmartLockPin))
        {
            reservation.SmartLockPin = System.Security.Cryptography.RandomNumberGenerator.GetInt32(100000, 999999).ToString();
        }
        reservation.SmartLockStatus = "Active";
        reservation.SmartLockActivatedAtUtc = DateTime.UtcNow;

        room.Status = RoomStatus.Occupied;
        room.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        if (_notificationDispatcher != null)
        {
            try
            {
                await _notificationDispatcher.NotifyReservationStatusChangedAsync(
                    reservation.PropertyId.ToString(),
                    reservation.Id.ToString(),
                    reservation.ConfirmationCode,
                    ReservationStatus.Confirmed.ToString(),
                    ReservationStatus.CheckedIn.ToString(),
                    cancellationToken);
            }
            catch
            {
                // Dispatch failure should never fail an already committed transaction
            }
        }

        return ReservationSnapshotHelper.MapToDetailDto(reservation, property);
    }
}
