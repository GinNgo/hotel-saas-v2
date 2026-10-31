using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Queries.GetFolio;

/// <summary>
/// Handles retrieving the financial folio for a reservation within the active property scope.
/// </summary>
public sealed class GetFolioQueryHandler : IRequestHandler<GetFolioQuery, FolioDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService? _propertyService;
    private readonly ICancellationPolicyService _cancellationPolicyService;

    public GetFolioQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ICurrentPropertyService? propertyService = null,
        ICancellationPolicyService? cancellationPolicyService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _propertyService = propertyService;
        _cancellationPolicyService = cancellationPolicyService ?? new CancellationPolicyService();
    }

    public async Task<FolioDto> Handle(GetFolioQuery request, CancellationToken cancellationToken)
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

        // Branch header / token isolation
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
                default:
                    throw new UnauthorizedAccessException(membership.ErrorMessage ?? "Không đủ quyền truy cập.");
            }
        }

        var reservation = await _context.Reservations
            .AsNoTracking()
            .Include(r => r.Payments)
            .FirstOrDefaultAsync(r =>
                r.Id == request.ReservationId &&
                r.PropertyId == request.PropertyId &&
                r.TenantId == tenantId.Value,
                cancellationToken);

        if (reservation == null)
        {
            throw new NotFoundException("Đơn đặt phòng không tồn tại.");
        }

        Room? room = null;
        RoomType? roomType = null;
        if (reservation.RoomId != Guid.Empty)
        {
            room = await _context.Rooms
                .AsNoTracking()
                .FirstOrDefaultAsync(rm => rm.Id == reservation.RoomId && rm.PropertyId == request.PropertyId, cancellationToken);

            if (room != null && room.RoomTypeId != Guid.Empty)
            {
                roomType = await _context.RoomTypes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(rt => rt.Id == room.RoomTypeId && rt.PropertyId == request.PropertyId, cancellationToken);
            }
        }

        var payments = reservation.Payments
            .OrderBy(p => p.CreatedAtUtc)
            .Select(PaymentDto.FromEntity)
            .ToList();

        var paidAmount = payments
            .Where(p => p.Status == PaymentStatus.Completed)
            .Sum(p => p.Amount);

        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        var rentalType = snapshot?.RentalType ?? RentalType.Overnight;
        var startUtc = snapshot?.StartAtUtc ?? reservation.CheckInDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var endUtc = snapshot?.EndAtUtc ?? reservation.CheckOutDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        decimal remainingBalance;
        bool isFullyPaid;
        decimal? cancellationFee = null;
        decimal? refundableAmount = null;
        string? refundStatus = null;
        decimal? netCollectibleAmount = null;
        string? financialSettlementStatus = null;

        if (reservation.Status == ReservationStatus.Cancelled)
        {
            var property = await _context.Properties
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId.Value, cancellationToken);

            var cancelEstimate = _cancellationPolicyService.CalculateEstimate(
                reservation,
                property,
                reservation.CancelledAtUtc ?? DateTime.UtcNow,
                paidAmount);

            cancellationFee = cancelEstimate.CancellationFee;
            refundableAmount = cancelEstimate.RefundableAmount;

            var refundPayment = payments
                .FirstOrDefault(p => !string.IsNullOrEmpty(p.TransactionRef) &&
                                     p.TransactionRef.Contains("REFUND", StringComparison.OrdinalIgnoreCase));

            if (refundPayment != null)
            {
                if (refundPayment.Status == PaymentStatus.Completed)
                    refundStatus = "Refunded";
                else if (refundPayment.Status == PaymentStatus.Pending)
                    refundStatus = "PendingApproval";
                else if (refundPayment.Status == PaymentStatus.Failed)
                    refundStatus = "Failed";
                else
                    refundStatus = refundPayment.Status.ToString();
            }
            else if (refundableAmount > 0)
            {
                refundStatus = "PendingApproval";
            }
            else
            {
                refundStatus = "None";
            }

            if (paidAmount == 0)
            {
                netCollectibleAmount = 0m;
                remainingBalance = 0m;
                isFullyPaid = false;
                financialSettlementStatus = "CancelledNoDebt";
            }
            else
            {
                if (cancellationFee > paidAmount)
                {
                    netCollectibleAmount = cancellationFee.Value - paidAmount;
                    remainingBalance = netCollectibleAmount.Value;
                    financialSettlementStatus = "CancelledDebtDue";
                }
                else
                {
                    netCollectibleAmount = 0m;
                    remainingBalance = 0m;
                    financialSettlementStatus = refundStatus == "Refunded" ? "CancelledSettled" : "CancelledPendingRefund";
                }
                isFullyPaid = false;
            }
        }
        else
        {
            remainingBalance = reservation.TotalAmount - paidAmount;
            isFullyPaid = remainingBalance <= 0;
            netCollectibleAmount = Math.Max(0m, remainingBalance);
            financialSettlementStatus = isFullyPaid ? "ActiveSettled" : "ActiveOutstanding";
        }

        var breakdown = snapshot?.Breakdown ?? Array.Empty<QuoteBreakdownItemDto>();
        decimal? baseRoomAmount = null;
        decimal? surchargesAmount = null;
        decimal? servicesAmount = null;

        // Phân loại có cấu trúc: Chỉ tính toán khi breakdown có trường Category rõ ràng
        if (breakdown.Count > 0 && breakdown.Any(b => !string.IsNullOrWhiteSpace(b.Category)))
        {
            baseRoomAmount = breakdown
                .Where(b => string.Equals(b.Category, "Room", StringComparison.OrdinalIgnoreCase))
                .Sum(b => b.Amount);

            surchargesAmount = breakdown
                .Where(b => string.Equals(b.Category, "Surcharge", StringComparison.OrdinalIgnoreCase))
                .Sum(b => b.Amount);

            servicesAmount = breakdown
                .Where(b => string.Equals(b.Category, "Service", StringComparison.OrdinalIgnoreCase))
                .Sum(b => b.Amount);
        }
        // Nếu không có breakdown có cấu trúc, không suy đoán TotalAmount thành tiền phòng mà để null

        var depositRequired = snapshot?.DepositRequired;
        decimal? depositPaid = null;

        var depositPayments = payments
            .Where(p => p.Status == PaymentStatus.Completed &&
                        !string.IsNullOrEmpty(p.TransactionRef) &&
                        p.TransactionRef.StartsWith("[PURPOSE:DEPOSIT]", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (depositPayments.Count > 0)
        {
            depositPaid = depositPayments.Sum(p => p.Amount);
        }
        else if (paidAmount == 0)
        {
            depositPaid = 0m;
        }
        else if (depositRequired != null && depositRequired > 0)
        {
            // Đã có thanh toán nhưng không có giao dịch nào được gắn thẻ cọc có cấu trúc [PURPOSE:DEPOSIT]
            // Không suy đoán khoản nào là cọc; đánh dấu null để UI hiển thị "Chưa xác định"
            depositPaid = null;
        }
        else
        {
            depositPaid = 0m;
        }

        return new FolioDto(
            reservation.Id,
            reservation.ConfirmationCode,
            reservation.GuestName,
            reservation.GuestEmail,
            reservation.GuestPhone,
            reservation.RoomId,
            room?.RoomNumber,
            room?.RoomTypeId,
            roomType?.Name,
            reservation.Status,
            reservation.Status.ToString(),
            rentalType,
            reservation.CheckInDate,
            reservation.CheckOutDate,
            startUtc,
            endUtc,
            reservation.TotalAmount,
            paidAmount,
            remainingBalance,
            isFullyPaid,
            payments,
            breakdown,
            baseRoomAmount,
            surchargesAmount,
            servicesAmount,
            depositRequired,
            depositPaid,
            cancellationFee,
            refundableAmount,
            refundStatus,
            netCollectibleAmount,
            financialSettlementStatus
        );
    }
}
