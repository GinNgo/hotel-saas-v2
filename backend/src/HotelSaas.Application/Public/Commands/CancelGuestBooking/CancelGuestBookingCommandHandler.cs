using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Services;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Commands.CancelGuestBooking;

public sealed class CancelGuestBookingCommandHandler : IRequestHandler<CancelGuestBookingCommand, GuestBookingDetailDto>
{
    private static readonly JsonSerializerOptions AuditJsonOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;
    private readonly ILoyaltyLedgerService _loyaltyLedgerService;
    private readonly ICancellationPolicyService _cancellationPolicyService;
    private readonly ICurrentTenantService? _tenantService;
    private readonly ICurrentPropertyService? _propertyService;
    private readonly INotificationDispatcher? _notificationDispatcher;

    public CancelGuestBookingCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext,
        ILoyaltyLedgerService? loyaltyLedgerService = null,
        ICancellationPolicyService? cancellationPolicyService = null,
        ICurrentTenantService? tenantService = null,
        ICurrentPropertyService? propertyService = null,
        INotificationDispatcher? notificationDispatcher = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _loyaltyLedgerService = loyaltyLedgerService ?? new LoyaltyLedgerService(_context);
        _cancellationPolicyService = cancellationPolicyService ?? new CancellationPolicyService();
        _tenantService = tenantService;
        _propertyService = propertyService;
        _notificationDispatcher = notificationDispatcher;
    }

    public async Task<GuestBookingDetailDto> Handle(CancelGuestBookingCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.LookupToken))
        {
            throw new BadRequestException("ERR_INVALID_TOKEN", "Mã tra cứu không hợp lệ.");
        }

        var token = request.LookupToken.Trim();

        // 1. Initial lookup (NoTracking) to locate target reservation and assigned room
        var initialRes = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r =>
                (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == token.ToUpper()) ||
                (r.Notes != null && r.Notes.Contains(token)))
            .Select(r => new
            {
                r.Id,
                r.RoomId,
                r.TenantId,
                r.PropertyId,
                r.ConfirmationCode,
                r.Notes,
                r.GuestEmail,
                r.GuestPhone,
                r.GuestUserId
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (initialRes == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");
        }

        var initialSnap = ReservationSnapshotHelper.TryDeserialize(initialRes.Notes);
        if (initialSnap == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");
        }

        bool isSecretTokenMatch = string.Equals(initialSnap.LookupToken, token, StringComparison.OrdinalIgnoreCase);
        bool isOnlyConfirmationCode = string.Equals(initialRes.ConfirmationCode, token, StringComparison.OrdinalIgnoreCase);

        // Security Guardrail: ConfirmationCode alone cannot authorize cancellation (Section 5)
        if (!isSecretTokenMatch && isOnlyConfirmationCode)
        {
            throw new ForbiddenException("ERR_AUTHORIZATION_REQUIRED",
                "Mã xác nhận (ConfirmationCode) chỉ dùng để tra cứu trạng thái. Thao tác hủy yêu cầu truy cập qua liên kết bảo mật (Secure Lookup Token) hoặc đăng nhập tài khoản khách.");
        }

        if (!isSecretTokenMatch)
        {
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");
        }

        if (initialSnap.IsTokenRevoked)
        {
            throw new NotFoundException("Mã tra cứu đã bị thu hồi hoặc không còn hiệu lực.");
        }

        if (!initialSnap.TokenExpiresAtUtc.HasValue || initialSnap.TokenExpiresAtUtc.Value <= DateTime.UtcNow)
        {
            throw new NotFoundException("Mã tra cứu đặt phòng đã hết hạn hoặc không có thời hạn hợp lệ.");
        }

        // 2. Identity Verification (if verification info is provided or user authenticated)
        if (!string.IsNullOrWhiteSpace(request.VerificationEmailOrPhone))
        {
            var verifyInput = request.VerificationEmailOrPhone.Trim();
            bool emailMatches = !string.IsNullOrWhiteSpace(initialRes.GuestEmail) &&
                string.Equals(initialRes.GuestEmail.Trim(), verifyInput, StringComparison.OrdinalIgnoreCase);

            var normalizedInputPhone = new string(verifyInput.Where(char.IsDigit).ToArray());
            var normalizedResPhone = new string((initialRes.GuestPhone ?? string.Empty).Where(char.IsDigit).ToArray());
            bool phoneMatches = !string.IsNullOrEmpty(normalizedInputPhone) &&
                !string.IsNullOrEmpty(normalizedResPhone) &&
                normalizedInputPhone == normalizedResPhone;

            if (!emailMatches && !phoneMatches)
            {
                throw new ForbiddenException("ERR_VERIFICATION_FAILED",
                    "Thông tin xác minh (Email hoặc Số điện thoại) không khớp với thông tin đơn đặt phòng.");
            }
        }

        // 3. Begin transaction and acquire exclusive row-level lock on the assigned room
        await using var tx = await _context.BeginTransactionAsync(cancellationToken);
        await _context.LockRoomRowAsync(initialRes.RoomId, initialRes.TenantId, initialRes.PropertyId, cancellationToken);

        // 4. Load fresh tracked reservation under exclusive lock
        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .Include(r => r.Room)
                .ThenInclude(room => room!.RoomType)
            .FirstOrDefaultAsync(r => r.Id == initialRes.Id, cancellationToken);

        if (reservation == null)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng.");
        }

        // 5. FSM Transition Validation
        if (reservation.Status == ReservationStatus.Cancelled)
        {
            // Idempotent retry: return detail view without repeating mutations
            await tx.RollbackAsync(cancellationToken);
            var prop = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == reservation.PropertyId, cancellationToken);

            return await MapToDetailDtoAsync(reservation, prop, initialSnap, cancellationToken);
        }

        if (reservation.Status == ReservationStatus.CheckedIn)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                "Không thể hủy đặt phòng khi khách đang lưu trú (CheckedIn). Vui lòng liên hệ trực tiếp quầy lễ tân để thực hiện thủ tục trả phòng.");
        }

        if (reservation.Status == ReservationStatus.CheckedOut)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                "Không thể hủy đặt phòng đã hoàn tất thời gian lưu trú (CheckedOut).");
        }

        if (reservation.Status != ReservationStatus.Confirmed && reservation.Status != ReservationStatus.PendingPayment)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                $"Không thể hủy đặt phòng khi đang ở trạng thái {reservation.Status}.");
        }

        // Check if hold has expired
        if (reservation.Status == ReservationStatus.PendingPayment &&
            initialSnap.IsOnlineHold &&
            initialSnap.HoldExpiresAtUtc.HasValue &&
            initialSnap.HoldExpiresAtUtc.Value <= DateTime.UtcNow)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_HOLD_EXPIRED",
                "Thời gian giữ phòng đã hết hạn. Lượt giữ phòng đã tự động được giải phóng.");
        }

        // 6. Calculate cancellation fee and refundable amount based on immutable snapshot policies
        var nowUtc = DateTime.UtcNow;
        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == reservation.PropertyId, cancellationToken);

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
            nowUtc,
            paidAmount,
            hasPendingPayments,
            pendingPaymentAmount);

        if (!estimate.CanCancel)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INELIGIBLE_FOR_CANCELLATION",
                estimate.IneligibilityReason ?? "Đơn đặt phòng không đủ điều kiện để thực hiện hủy.");
        }

        // 7. Update Reservation FSM State
        var oldStatus = reservation.Status;
        reservation.Status = ReservationStatus.Cancelled;
        reservation.CancelledAtUtc = nowUtc;
        reservation.CancellationReason = !string.IsNullOrWhiteSpace(request.Reason)
            ? request.Reason.Trim()
            : "Khách tự hủy qua cổng trực tuyến";
        reservation.SmartLockStatus = "Revoked";

        // 8. Rule C: Automatic, idempotent points refund on cancellation via LoyaltyLedgerService
        if (reservation.PointsRedeemed > 0 && reservation.PointsRefunded == 0)
        {
            await _loyaltyLedgerService.RefundPointsAsync(reservation.Id, cancellationToken);
            reservation.PointsRefunded = reservation.PointsRedeemed;
        }

        // 8.5. Decision D23: Create pending refund record if refund is due, awaiting Owner/Manager approval.
        // ARCHITECTURAL BOUNDARY (T04 Scope Clarification):
        // In this architecture, guest cancellation initiates an asynchronous refund request, NOT an automatic gateway disbursement.
        // The Payment record is persisted in Status = PaymentStatus.Pending (TransactionRef: REFUND-PENDING-...).
        // Money has NOT been disbursed or transferred yet; hotel management must audit and execute the transfer
        // before marking the refund as Completed. The guest is informed of "Chờ khách sạn duyệt chuyển khoản", never "Đã hoàn tiền".
        if (estimate.RefundableAmount > 0)
        {
            var pendingRefund = new Payment
            {
                Id = Guid.NewGuid(),
                TenantId = reservation.TenantId,
                PropertyId = reservation.PropertyId,
                ReservationId = reservation.Id,
                Amount = estimate.RefundableAmount,
                Method = PaymentMethod.BankTransfer,
                Status = PaymentStatus.Pending,
                TransactionRef = $"REFUND-PENDING-{reservation.ConfirmationCode}",
                CreatedAtUtc = nowUtc
            };
            _context.Payments.Add(pendingRefund);
        }

        // 9. System Audit Log (T03)
        try
        {
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = reservation.TenantId,
                PropertyId = reservation.PropertyId,
                UserId = reservation.GuestUserId,
                Action = AuditActions.Update,
                EntityName = nameof(Reservation),
                EntityId = reservation.Id,
                OldValues = JsonSerializer.Serialize(new { Status = oldStatus.ToString() }),
                NewValues = JsonSerializer.Serialize(new
                {
                    Status = ReservationStatus.Cancelled.ToString(),
                    CancellationFee = estimate.CancellationFee,
                    RefundableAmount = estimate.RefundableAmount,
                    PointsRefunded = reservation.PointsRefunded,
                    Reason = reservation.CancellationReason
                }, AuditJsonOptions),
                IpAddress = _userContext?.IpAddress ?? "GuestPortal",
                CreatedAtUtc = nowUtc
            };
            _context.AuditLogs.Add(auditLog);
        }
        catch (NotImplementedException)
        {
            // Fallback for mocked contexts during unit testing
        }

        // Establish tenant & property scope on ambient services for interceptor validation
        if (_tenantService != null)
        {
            _tenantService.TenantId = reservation.TenantId;
        }
        if (_propertyService != null)
        {
            _propertyService.PropertyId = reservation.PropertyId;
            _propertyService.IsTenantWide = false;
        }

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        if (_notificationDispatcher != null)
        {
            try
            {
                await _notificationDispatcher.NotifyReservationStatusChangedAsync(
                    reservation.PropertyId.ToString(),
                    reservation.Id.ToString(),
                    reservation.ConfirmationCode,
                    oldStatus.ToString(),
                    ReservationStatus.Cancelled.ToString(),
                    cancellationToken);
            }
            catch
            {
                // Dispatch failure should never fail an already committed transaction
            }
        }

        var dto = await MapToDetailDtoAsync(reservation, property, initialSnap, cancellationToken);
        dto.CancellationFee = estimate.CancellationFee;
        dto.RefundableAmount = estimate.RefundableAmount;
        dto.RefundStatus = estimate.RefundableAmount > 0 ? "PendingApproval" : "None";
        return dto;
    }

    private async Task<GuestBookingDetailDto> MapToDetailDtoAsync(
        Reservation reservation,
        Property? property,
        ReservationSnapshot snapshot,
        CancellationToken cancellationToken)
    {
        var paidAmount = await _context.Payments
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.ReservationId == reservation.Id && p.Status == PaymentStatus.Completed)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;

        var depositRequired = snapshot.DepositRequired ?? Math.Round(reservation.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero);
        var remainingBalance = Math.Max(0m, reservation.TotalAmount - paidAmount);
        var isFullyPaid = paidAmount >= reservation.TotalAmount && reservation.TotalAmount > 0;

        string roomTypeName = snapshot.RoomTypeName;
        if (string.IsNullOrWhiteSpace(roomTypeName))
        {
            var roomType = await _context.RoomTypes
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(rt => rt.Id == snapshot.RoomTypeId, cancellationToken);
            roomTypeName = roomType?.Name ?? "Tiêu chuẩn";
        }

        return new GuestBookingDetailDto
        {
            ReservationId = reservation.Id,
            ConfirmationCode = reservation.ConfirmationCode,
            LookupToken = snapshot.LookupToken ?? string.Empty,
            PropertyId = reservation.PropertyId,
            PropertyName = property?.Name ?? "LuxeStay",
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
            Status = reservation.Status.ToString(),
            MaskedGuestName = PiiMaskingHelper.MaskName(reservation.GuestName),
            MaskedGuestEmail = PiiMaskingHelper.MaskEmail(reservation.GuestEmail),
            MaskedGuestPhone = PiiMaskingHelper.MaskPhone(reservation.GuestPhone),
            HoldExpiresAtUtc = snapshot.HoldExpiresAtUtc,
            SecondsRemaining = 0,
            SmartLockPin = null, // Always masked/null on Cancelled
            SmartLockStatus = reservation.SmartLockStatus,
            CreatedAtUtc = reservation.CreatedAtUtc,
            CancelledAtUtc = reservation.CancelledAtUtc,
            CancellationReason = reservation.CancellationReason,
            Breakdown = snapshot.Breakdown ?? Array.Empty<QuoteBreakdownItemDto>()
        };
    }
}
