using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Services;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Commands.ExtendGuestHold;

/// <summary>
/// T02.4: Extends an active online room hold by 5 minutes (maximum 1 extension per hold, allowed when &lt;= 3 minutes remain).
/// Enforces row-level room locking to prevent concurrent double-extension and race conditions at expiration boundary.
/// </summary>
public sealed record ExtendGuestHoldCommand(string LookupToken) : IRequest<GuestBookingDetailDto>;

public sealed class ExtendGuestHoldCommandHandler : IRequestHandler<ExtendGuestHoldCommand, GuestBookingDetailDto>
{
    public const int ExtensionMinutes = 5;
    public const int WarningWindowSeconds = 180;
    public const int ClockSkewToleranceSeconds = 5;
    public const int MaxExtensionsPerHold = 1;

    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;

    public ExtendGuestHoldCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
    }

    public async Task<GuestBookingDetailDto> Handle(ExtendGuestHoldCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.LookupToken))
        {
            throw new BadRequestException("ERR_INVALID_TOKEN", "Mã tra cứu giữ phòng không hợp lệ.");
        }

        var token = request.LookupToken.Trim();

        // 1. Initial lookup (NoTracking) to locate target reservation and room for locking
        var initialRes = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r =>
                (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == token.ToUpper()) ||
                (r.Notes != null && r.Notes.Contains(token)))
            .Select(r => new { r.Id, r.RoomId, r.TenantId, r.PropertyId, r.ConfirmationCode, r.Notes })
            .FirstOrDefaultAsync(cancellationToken);

        if (initialRes == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin giữ phòng với mã tra cứu này.");
        }

        var initialSnap = ReservationSnapshotHelper.TryDeserialize(initialRes.Notes);
        if (initialSnap == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin giữ phòng với mã tra cứu này.");
        }

        bool isTokenMatch = string.Equals(initialSnap.LookupToken, token, StringComparison.OrdinalIgnoreCase);
        bool isCodeMatch = string.Equals(initialRes.ConfirmationCode, token, StringComparison.OrdinalIgnoreCase);

        // Security Guardrail: ConfirmationCode alone cannot authorize hold extension (prevents secret token leak)
        if (!isTokenMatch && isCodeMatch)
        {
            throw new ForbiddenException("ERR_AUTHORIZATION_REQUIRED",
                "Mã xác nhận (ConfirmationCode) chỉ dùng để tra cứu trạng thái. Thao tác gia hạn giữ phòng yêu cầu sử dụng liên kết bảo mật (Secure Lookup Token).");
        }

        if (!isTokenMatch)
        {
            throw new NotFoundException("Không tìm thấy thông tin giữ phòng với mã tra cứu này.");
        }

        if (initialSnap.IsTokenRevoked)
        {
            throw new NotFoundException("Mã tra cứu đã bị thu hồi hoặc không còn hiệu lực.");
        }

        if (!initialSnap.TokenExpiresAtUtc.HasValue || initialSnap.TokenExpiresAtUtc.Value <= DateTime.UtcNow)
        {
            throw new NotFoundException("Mã tra cứu đặt phòng đã hết hạn hoặc không có thời hạn hợp lệ.");
        }

        // 2. Begin transaction and acquire exclusive row-level lock on the assigned room
        await using var tx = await _context.BeginTransactionAsync(cancellationToken);

        await _context.LockRoomRowAsync(initialRes.RoomId, initialRes.TenantId, initialRes.PropertyId, cancellationToken);

        // 3. Re-load tracked reservation under lock to serialize concurrent extension / confirm / cancel requests
        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.Id == initialRes.Id, cancellationToken);

        if (reservation == null)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy thông tin giữ phòng.");
        }

        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        if (snapshot == null)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy chi tiết giữ phòng.");
        }

        // Verify secret token under lock to ensure no concurrent tampering
        if (!string.Equals(snapshot.LookupToken, token, StringComparison.OrdinalIgnoreCase))
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ForbiddenException("ERR_AUTHORIZATION_REQUIRED",
                "Mã tra cứu bảo mật không khớp hoặc đã bị thay đổi.");
        }

        // 4. Authoritative FSM & T02.4 Guard Checks under Lock
        if (reservation.Status == ReservationStatus.Confirmed ||
            reservation.Status == ReservationStatus.CheckedIn ||
            reservation.Status == ReservationStatus.CheckedOut)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_HOLD_ALREADY_CONFIRMED",
                "Đơn đặt phòng đã được xác nhận, không thể gia hạn thời gian giữ phòng.");
        }

        if (reservation.Status == ReservationStatus.Cancelled)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_RESERVATION_CANCELLED",
                "Đơn đặt phòng đã bị hủy, không thể gia hạn thời gian giữ phòng.");
        }

        if (!snapshot.IsOnlineHold || !snapshot.HoldExpiresAtUtc.HasValue)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new BadRequestException("ERR_NOT_ONLINE_HOLD",
                "Đơn đặt phòng này không thuộc diện giữ phòng tạm thời trực tuyến.");
        }

        var nowUtc = DateTime.UtcNow;
        if (snapshot.HoldExpiresAtUtc.Value <= nowUtc)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_HOLD_EXPIRED",
                "Thời gian giữ phòng đã hết. Vui lòng tìm và chọn phòng lại.");
        }

        if (snapshot.HoldExtensionCount >= MaxExtensionsPerHold)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_HOLD_EXTENSION_LIMIT_REACHED",
                "Mỗi lượt giữ phòng chỉ được gia hạn tối đa 1 lần (5 phút).");
        }

        var remainingSecondsBeforeExtend = (snapshot.HoldExpiresAtUtc.Value - nowUtc).TotalSeconds;
        if (remainingSecondsBeforeExtend > WarningWindowSeconds + ClockSkewToleranceSeconds)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new BadRequestException("ERR_HOLD_EXTENSION_TOO_EARLY",
                "Chỉ có thể yêu cầu gia hạn thêm 5 phút khi thời gian giữ phòng còn từ 3 phút trở xuống.");
        }

        // 5. Verify physical room is still available for the stay interval under lock
        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == reservation.PropertyId, cancellationToken);

        if (property == null || property.Status != PropertyStatus.Active)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_PROPERTY_UNAVAILABLE", "Cơ sở lưu trú hiện không còn khả dụng để gia hạn.");
        }

        var bufferMinutes = Math.Max(ReservationTimeHelper.MinimumTurnoverBufferMinutes, property.BufferMinutes);
        var otherRoomReservations = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.PropertyId == reservation.PropertyId &&
                        r.RoomId == reservation.RoomId &&
                        r.Id != reservation.Id &&
                        (r.Status == ReservationStatus.PendingPayment ||
                         r.Status == ReservationStatus.Confirmed ||
                         r.Status == ReservationStatus.CheckedIn))
            .ToListAsync(cancellationToken);

        foreach (var other in otherRoomReservations)
        {
            if (!ReservationTimeHelper.IsBlockingReservation(other, nowUtc))
            {
                continue;
            }

            var (otherStart, otherEnd) = ReservationTimeHelper.GetEffectiveStayUtcInterval(other, property);
            if (ReservationTimeHelper.HasOverlap(snapshot.StartAtUtc, snapshot.EndAtUtc, otherStart, otherEnd, bufferMinutes))
            {
                await tx.RollbackAsync(cancellationToken);
                throw new ConflictException("ERR_ROOM_UNAVAILABLE_FOR_EXTENSION",
                    "Phòng không còn khả dụng để gia hạn do xung đột lịch lưu trú. Vui lòng chọn phòng khác.");
            }
        }

        // 6. Apply atomic +5 minutes extension to existing hold record
        _tenantService.TenantId = reservation.TenantId;
        _propertyService.PropertyId = reservation.PropertyId;

        var newHoldExpiresAtUtc = snapshot.HoldExpiresAtUtc.Value.AddMinutes(ExtensionMinutes);
        snapshot.HoldExpiresAtUtc = newHoldExpiresAtUtc;
        snapshot.HoldExtensionCount += 1;
        snapshot.HoldExtendedAtUtc = nowUtc;

        reservation.Notes = ReservationSnapshotHelper.Serialize(snapshot);
        reservation.UpdatedAtUtc = nowUtc;

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        // 7. Build updated GuestBookingDetailDto
        string roomTypeName = snapshot.RoomTypeName;
        if (string.IsNullOrWhiteSpace(roomTypeName))
        {
            var roomType = await _context.RoomTypes
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(rt => rt.Id == snapshot.RoomTypeId, cancellationToken);
            roomTypeName = roomType?.Name ?? "Tiêu chuẩn";
        }

        var paidAmount = await _context.Payments
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.ReservationId == reservation.Id && p.Status == PaymentStatus.Completed)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;

        var depositRequired = snapshot.DepositRequired ?? Math.Round(reservation.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero);
        var remainingBalance = Math.Max(0m, reservation.TotalAmount - paidAmount);
        var isFullyPaid = paidAmount >= reservation.TotalAmount && reservation.TotalAmount > 0;
        var updatedSecondsRemaining = Math.Max(0, (int)(newHoldExpiresAtUtc - DateTime.UtcNow).TotalSeconds);

        return new GuestBookingDetailDto
        {
            ReservationId = reservation.Id,
            ConfirmationCode = reservation.ConfirmationCode,
            LookupToken = snapshot.LookupToken ?? string.Empty,
            PropertyId = reservation.PropertyId,
            PropertyName = property.Name,
            PropertyAddress = property.Address,
            RoomTypeName = roomTypeName,
            RentalType = snapshot.RentalType.ToString(),
            StartAtUtc = snapshot.StartAtUtc,
            EndAtUtc = snapshot.EndAtUtc,
            CheckInDate = reservation.CheckInDate,
            CheckOutDate = reservation.CheckOutDate,
            NumberOfGuests = reservation.NumberOfGuests,
            TotalAmount = reservation.TotalAmount,
            DepositRequired = depositRequired,
            PaidAmount = paidAmount,
            RemainingBalance = remainingBalance,
            IsFullyPaid = isFullyPaid,
            Status = reservation.Status.ToString(),
            MaskedGuestName = PiiMaskingHelper.MaskName(reservation.GuestName),
            MaskedGuestEmail = PiiMaskingHelper.MaskEmail(reservation.GuestEmail),
            MaskedGuestPhone = PiiMaskingHelper.MaskPhone(reservation.GuestPhone),
            HoldExpiresAtUtc = newHoldExpiresAtUtc,
            SecondsRemaining = updatedSecondsRemaining,
            HoldExtensionCount = snapshot.HoldExtensionCount,
            HoldExtendedAtUtc = snapshot.HoldExtendedAtUtc,
            CanExtendHold = false,
            SmartLockPin = null,
            SmartLockStatus = reservation.SmartLockStatus,
            CreatedAtUtc = reservation.CreatedAtUtc,
            Breakdown = snapshot.Breakdown ?? Array.Empty<QuoteBreakdownItemDto>()
        };
    }
}

