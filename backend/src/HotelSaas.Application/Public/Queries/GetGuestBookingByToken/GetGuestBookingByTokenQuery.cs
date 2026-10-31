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
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Queries.GetGuestBookingByToken;

public sealed record GetGuestBookingByTokenQuery(string LookupToken) : IRequest<GuestBookingDetailDto>;

public sealed class GetGuestBookingByTokenQueryHandler : IRequestHandler<GetGuestBookingByTokenQuery, GuestBookingDetailDto>
{
    private readonly IApplicationDbContext _context;

    public GetGuestBookingByTokenQueryHandler(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<GuestBookingDetailDto> Handle(GetGuestBookingByTokenQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.LookupToken))
            throw new BadRequestException("ERR_INVALID_TOKEN", "Mã tra cứu không hợp lệ.");

        var token = request.LookupToken.Trim();

        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(r =>
                (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == token.ToUpper()) ||
                (r.Notes != null && r.Notes.Contains(token)), cancellationToken);

        if (reservation == null)
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");

        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        bool isTokenMatch = snapshot != null && string.Equals(snapshot.LookupToken, token, StringComparison.OrdinalIgnoreCase);
        bool isCodeMatch = string.Equals(reservation.ConfirmationCode, token, StringComparison.OrdinalIgnoreCase);

        if (snapshot == null || (!isTokenMatch && !isCodeMatch))
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");

        // Decision D21: Fail-closed if token is revoked, missing TTL, or expired
        if (snapshot.IsTokenRevoked)
            throw new NotFoundException("Mã tra cứu đã bị thu hồi hoặc không còn hiệu lực.");

        if (!snapshot.TokenExpiresAtUtc.HasValue || snapshot.TokenExpiresAtUtc.Value <= DateTime.UtcNow)
            throw new NotFoundException("Mã tra cứu đặt phòng đã hết hạn hoặc không có thời hạn hợp lệ.");

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == reservation.PropertyId, cancellationToken);

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

        var nowUtc = DateTime.UtcNow;
        int? secondsRemaining = null;
        if (snapshot.HoldExpiresAtUtc.HasValue)
        {
            secondsRemaining = Math.Max(0, (int)(snapshot.HoldExpiresAtUtc.Value - nowUtc).TotalSeconds);
        }

        bool isHoldExpired = reservation.Status == ReservationStatus.PendingPayment &&
                             snapshot.HoldExpiresAtUtc.HasValue &&
                             snapshot.HoldExpiresAtUtc.Value <= nowUtc;

        var statusDisplay = isHoldExpired ? "Expired" : reservation.Status.ToString();
        var depositRequired = snapshot.DepositRequired ?? Math.Round(reservation.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero);
        var remainingBalance = Math.Max(0m, reservation.TotalAmount - paidAmount);
        var isFullyPaid = paidAmount >= reservation.TotalAmount && reservation.TotalAmount > 0;

        // Security / IoT Policy: Only disclose door PIN when reservation is Confirmed or CheckedIn AND smart lock is Active
        bool isPinPermitted = (reservation.Status == ReservationStatus.Confirmed || reservation.Status == ReservationStatus.CheckedIn) &&
                              string.Equals(reservation.SmartLockStatus, "Active", StringComparison.OrdinalIgnoreCase);

        // Authoritative hold state: Once confirmed/checked-in/checked-out/cancelled, temporary hold is fulfilled and not active.
        // For PendingPayment, preserve hold timestamp and clamp secondsRemaining to 0 if expired (per T04 contract).
        bool isSettled = reservation.Status == ReservationStatus.Confirmed ||
                         reservation.Status == ReservationStatus.CheckedIn ||
                         reservation.Status == ReservationStatus.CheckedOut ||
                         reservation.Status == ReservationStatus.Cancelled;

        DateTime? effectiveHoldExpiresAtUtc = isSettled ? null : snapshot.HoldExpiresAtUtc;
        int? effectiveSecondsRemaining = isSettled ? null : secondsRemaining;

        decimal? cancellationFee = null;
        decimal? refundableAmount = null;
        string? refundStatus = null;

        if (reservation.Status == ReservationStatus.Cancelled)
        {
            var refundPayment = await _context.Payments
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.ReservationId == reservation.Id &&
                            p.TransactionRef != null &&
                            p.TransactionRef.Contains("REFUND"))
                .OrderByDescending(p => p.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (refundPayment != null)
            {
                refundableAmount = refundPayment.Amount;
                refundStatus = refundPayment.Status == PaymentStatus.Completed
                    ? "Refunded"
                    : (refundPayment.Status == PaymentStatus.Pending ? "PendingApproval" : refundPayment.Status.ToString());
            }
            else
            {
                refundStatus = "None";
            }

            if (paidAmount == 0)
            {
                cancellationFee = 0m;
                refundableAmount = 0m;
                refundStatus = "None";
            }
            else if (refundableAmount.HasValue)
            {
                cancellationFee = Math.Max(0m, paidAmount - refundableAmount.Value);
            }
        }

        return new GuestBookingDetailDto
        {
            ReservationId = reservation.Id,
            ConfirmationCode = reservation.ConfirmationCode,
            LookupToken = snapshot.LookupToken ?? string.Empty,
            PropertyId = reservation.PropertyId,
            PropertyName = property?.Name ?? string.Empty,
            PropertyAddress = property?.Address ?? string.Empty,
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
            Status = statusDisplay,
            MaskedGuestName = PiiMaskingHelper.MaskName(reservation.GuestName),
            MaskedGuestEmail = PiiMaskingHelper.MaskEmail(reservation.GuestEmail),
            MaskedGuestPhone = PiiMaskingHelper.MaskPhone(reservation.GuestPhone),
            HoldExpiresAtUtc = effectiveHoldExpiresAtUtc,
            SecondsRemaining = effectiveSecondsRemaining,
            HoldExtensionCount = snapshot.HoldExtensionCount,
            HoldExtendedAtUtc = snapshot.HoldExtendedAtUtc,
            CanExtendHold = !isSettled && !isHoldExpired && snapshot.IsOnlineHold && snapshot.HoldExtensionCount < 1 && effectiveSecondsRemaining.HasValue && effectiveSecondsRemaining.Value > 0 && effectiveSecondsRemaining.Value <= 180,
            SmartLockPin = isPinPermitted ? reservation.SmartLockPin : null,
            SmartLockStatus = reservation.SmartLockStatus,
            CreatedAtUtc = reservation.CreatedAtUtc,
            CancelledAtUtc = reservation.CancelledAtUtc,
            CancellationReason = reservation.CancellationReason,
            CancellationFee = cancellationFee,
            RefundableAmount = refundableAmount,
            RefundStatus = refundStatus,
            Breakdown = snapshot.Breakdown ?? Array.Empty<QuoteBreakdownItemDto>()
        };
    }
}
