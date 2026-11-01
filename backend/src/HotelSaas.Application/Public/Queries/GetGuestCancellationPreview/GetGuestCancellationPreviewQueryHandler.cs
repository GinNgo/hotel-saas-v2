using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Queries.GetGuestCancellationPreview;

public sealed class GetGuestCancellationPreviewQueryHandler : IRequestHandler<GetGuestCancellationPreviewQuery, GuestCancellationPreviewDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICancellationPolicyService _cancellationPolicyService;

    public GetGuestCancellationPreviewQueryHandler(
        IApplicationDbContext context,
        ICancellationPolicyService? cancellationPolicyService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _cancellationPolicyService = cancellationPolicyService ?? new CancellationPolicyService();
    }

    public async Task<GuestCancellationPreviewDto> Handle(GetGuestCancellationPreviewQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.LookupToken))
        {
            throw new BadRequestException("ERR_INVALID_TOKEN", "Mã tra cứu không hợp lệ.");
        }

        var token = request.LookupToken.Trim();

        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(r =>
                (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == token.ToUpper()) ||
                (r.Notes != null && r.Notes.Contains(token)), cancellationToken);

        if (reservation == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");
        }

        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        if (snapshot == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");
        }

        bool isSecretTokenMatch = string.Equals(snapshot.LookupToken, token, StringComparison.OrdinalIgnoreCase);
        bool isOnlyConfirmationCode = string.Equals(reservation.ConfirmationCode, token, StringComparison.OrdinalIgnoreCase);

        // Security Guardrail: ConfirmationCode alone cannot authorize cancellation preview or execution
        if (!isSecretTokenMatch && isOnlyConfirmationCode)
        {
            throw new ForbiddenException("ERR_AUTHORIZATION_REQUIRED",
                "Mã xác nhận (ConfirmationCode) chỉ dùng để tra cứu trạng thái. Thao tác hủy yêu cầu truy cập qua liên kết bảo mật (Secure Lookup Token) hoặc đăng nhập tài khoản khách.");
        }

        if (!isSecretTokenMatch)
        {
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");
        }

        if (snapshot.IsTokenRevoked)
        {
            throw new NotFoundException("Mã tra cứu đã bị thu hồi hoặc không còn hiệu lực.");
        }

        if (!snapshot.TokenExpiresAtUtc.HasValue || snapshot.TokenExpiresAtUtc.Value <= DateTime.UtcNow)
        {
            throw new NotFoundException("Mã tra cứu đặt phòng đã hết hạn hoặc không có thời hạn hợp lệ.");
        }

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == reservation.PropertyId, cancellationToken);

        // Retrieve all payments to analyze actual received and pending gateway transactions
        var payments = await _context.Payments
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.ReservationId == reservation.Id)
            .ToListAsync(cancellationToken);

        var paidAmount = payments
            .Where(p => p.Status == PaymentStatus.Completed)
            .Sum(p => p.Amount);

        var hasPendingPayments = payments
            .Any(p => p.Status == PaymentStatus.Pending);

        var pendingPaymentAmount = payments
            .Where(p => p.Status == PaymentStatus.Pending)
            .Sum(p => p.Amount);

        var estimate = _cancellationPolicyService.CalculateEstimate(
            reservation,
            property,
            DateTime.UtcNow,
            paidAmount,
            hasPendingPayments,
            pendingPaymentAmount);

        return new GuestCancellationPreviewDto
        {
            ReservationId = estimate.ReservationId,
            ConfirmationCode = estimate.ConfirmationCode,
            Status = estimate.Status,
            RentalType = estimate.RentalType,
            StartAtUtc = estimate.StartAtUtc,
            EndAtUtc = estimate.EndAtUtc,
            CheckInDate = estimate.CheckInDate,
            CheckOutDate = estimate.CheckOutDate,
            TotalAmount = estimate.TotalAmount,
            PaidAmount = estimate.PaidAmount,
            DepositRequired = estimate.DepositRequired,
            CancellationFee = estimate.CancellationFee,
            RefundableAmount = estimate.RefundableAmount,
            PointsRedeemed = estimate.PointsRedeemed,
            PointsRefundable = estimate.PointsRefundable,
            IsFreeCancellation = estimate.IsFreeCancellation,
            HoursUntilCheckIn = estimate.HoursUntilCheckIn,
            FreeCancellationThresholdHours = estimate.FreeCancellationThresholdHours,
            PolicyDescription = estimate.PolicyDescription,
            CanCancel = estimate.CanCancel,
            IneligibilityReason = estimate.IneligibilityReason,
            IsHold = estimate.IsHold,
            HasPendingPayment = estimate.HasPendingPayment,
            PendingPaymentAmount = estimate.PendingPaymentAmount
        };
    }
}
