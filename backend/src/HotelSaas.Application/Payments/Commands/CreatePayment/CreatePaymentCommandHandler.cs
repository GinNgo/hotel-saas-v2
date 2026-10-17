using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Commands.CreatePayment;

/// <summary>
/// Handles manual payment collection for a reservation with advisory idempotency locks,
/// reservation row-level locking, balance reconciliation, and immutable audit recording.
/// </summary>
public sealed class CreatePaymentCommandHandler : IRequestHandler<CreatePaymentCommand, PaymentDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService? _propertyService;

    public CreatePaymentCommandHandler(
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

    public async Task<PaymentDto> Handle(CreatePaymentCommand request, CancellationToken cancellationToken)
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

        // Amount validation
        if (request.Amount <= 0)
        {
            throw new BadRequestException("ERR_INVALID_AMOUNT", "Số tiền thanh toán phải lớn hơn 0.");
        }

        // Method validation (Manual payment slice: Cash, BankTransfer only)
        if (request.Method != PaymentMethod.Cash &&
            request.Method != PaymentMethod.BankTransfer)
        {
            throw new BadRequestException("ERR_INVALID_PAYMENT_METHOD",
                "Chỉ hỗ trợ phương thức thanh toán tiền mặt (Cash) và chuyển khoản (BankTransfer) tại quầy.");
        }

        var normalizedKey = request.IdempotencyKey?.Trim();
        var hasIdempotencyKey = !string.IsNullOrEmpty(normalizedKey);

        if (hasIdempotencyKey)
        {
            if (normalizedKey!.Length < 8 || normalizedKey.Length > 128 ||
                !Regex.IsMatch(normalizedKey, @"^[a-zA-Z0-9_\-]+$"))
            {
                throw new BadRequestException("ERR_INVALID_IDEMPOTENCY_KEY",
                    "Khóa Idempotency-Key không hợp lệ. Chỉ chấp nhận các ký tự chữ, số, gạch nối và gạch dưới (độ dài 8-128 ký tự).");
            }
        }

        var userRef = !string.IsNullOrWhiteSpace(request.TransactionRef) ? request.TransactionRef.Trim() : string.Empty;
        var safeUserRef = userRef.Replace("[", "(").Replace("]", ")");

        // Transactional execution: advisory idempotency lock + room-first row lock
        await using var tx = await _context.BeginTransactionAsync(cancellationToken);

        // 1. Transactional advisory lock & cross-reservation idempotency replay check
        if (hasIdempotencyKey)
        {
            await _context.LockIdempotencyKeyAsync(request.PropertyId, normalizedKey!, cancellationToken);

            var ikTag = $"[IK:{normalizedKey}]";
            var directPrefix = $"[IK:{normalizedKey}][BY:";
            var depositPrefix = $"[PURPOSE:DEPOSIT][IK:{normalizedKey}][BY:";

            var existingReplay = await _context.Payments
                .AsNoTracking()
                .FirstOrDefaultAsync(p =>
                    p.TenantId == tenantId.Value &&
                    p.PropertyId == request.PropertyId &&
                    p.Status == PaymentStatus.Completed &&
                    p.TransactionRef != null &&
                    (p.TransactionRef.StartsWith(directPrefix) ||
                     p.TransactionRef.StartsWith(depositPrefix) ||
                     p.TransactionRef.Contains(ikTag)),
                    cancellationToken);

            if (existingReplay != null)
            {
                var storedUserRef = ExtractUserRef(existingReplay.TransactionRef);
                var existingIsDeposit = HasDepositTag(existingReplay.TransactionRef);

                // Strict payload mismatch validation: same key with different payload (including IsDeposit) must fail with 409 Conflict
                if (existingReplay.ReservationId != request.ReservationId ||
                    existingReplay.Amount != request.Amount ||
                    existingReplay.Method != request.Method ||
                    existingIsDeposit != request.IsDeposit ||
                    storedUserRef != safeUserRef)
                {
                    throw new ConflictException("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH",
                        "Khóa Idempotency đã được sử dụng cho một giao dịch khác với thông tin không trùng khớp.");
                }

                await tx.CommitAsync(cancellationToken);
                return PaymentDto.FromEntity(existingReplay);
            }
        }

        // 2. Fetch target room id metadata with NoTracking to synchronize lock order with lifecycle operations
        var resHeader = await _context.Reservations
            .AsNoTracking()
            .Where(r => r.Id == request.ReservationId &&
                        r.PropertyId == request.PropertyId &&
                        r.TenantId == tenantId.Value)
            .Select(r => new { r.Id, r.RoomId })
            .FirstOrDefaultAsync(cancellationToken);

        if (resHeader == null)
        {
            throw new NotFoundException("Đơn đặt phòng không tồn tại.");
        }

        // 3. Lock Room row FIRST to match lifecycle (CheckIn / Cancel) lock hierarchy, avoiding deadlocks & race revival
        await _context.LockRoomRowAsync(resHeader.RoomId, tenantId.Value, request.PropertyId, cancellationToken);

        // 4. Lock Reservation row
        await _context.LockReservationRowAsync(request.ReservationId, tenantId.Value, request.PropertyId, cancellationToken);

        // 5. Load fresh tracked reservation under exclusive lock
        var reservation = await _context.Reservations
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

        // FSM guard: strictly forbid payments on cancelled reservations
        if (reservation.Status == ReservationStatus.Cancelled)
        {
            throw new ConflictException("ERR_RESERVATION_CANCELLED",
                "Không thể thu tiền cho đơn đặt phòng đã bị hủy.");
        }

        if (reservation.Status == ReservationStatus.CheckedOut)
        {
            throw new ConflictException("ERR_RESERVATION_SETTLED",
                "Đơn đặt phòng đã hoàn tất trả phòng.");
        }

        // 6. Double-check idempotency under reservation lock
        if (hasIdempotencyKey)
        {
            var ikTag = $"[IK:{normalizedKey}]";
            var directPrefix = $"[IK:{normalizedKey}][BY:";
            var depositPrefix = $"[PURPOSE:DEPOSIT][IK:{normalizedKey}][BY:";

            var existingUnderLock = reservation.Payments
                .FirstOrDefault(p =>
                    p.Status == PaymentStatus.Completed &&
                    p.TransactionRef != null &&
                    (p.TransactionRef.StartsWith(directPrefix, StringComparison.Ordinal) ||
                     p.TransactionRef.StartsWith(depositPrefix, StringComparison.Ordinal) ||
                     p.TransactionRef.Contains(ikTag, StringComparison.Ordinal)));

            if (existingUnderLock != null)
            {
                var storedUserRef = ExtractUserRef(existingUnderLock.TransactionRef);
                var existingIsDeposit = HasDepositTag(existingUnderLock.TransactionRef);

                if (existingUnderLock.ReservationId != request.ReservationId ||
                    existingUnderLock.Amount != request.Amount ||
                    existingUnderLock.Method != request.Method ||
                    existingIsDeposit != request.IsDeposit ||
                    storedUserRef != safeUserRef)
                {
                    throw new ConflictException("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH",
                        "Khóa Idempotency đã được sử dụng cho một giao dịch khác với thông tin không trùng khớp.");
                }

                await tx.CommitAsync(cancellationToken);
                return PaymentDto.FromEntity(existingUnderLock);
            }
        }

        // 7. Folio balance calculation and reconciliation
        var existingPaid = reservation.Payments
            .Where(p => p.Status == PaymentStatus.Completed)
            .Sum(p => p.Amount);

        var remainingBalance = reservation.TotalAmount - existingPaid;

        if (remainingBalance <= 0)
        {
            throw new ConflictException("ERR_FOLIO_ALREADY_PAID",
                "Đơn đặt phòng đã được thanh toán đầy đủ, không còn dư nợ.");
        }

        if (request.Amount > remainingBalance)
        {
            throw new BadRequestException("ERR_AMOUNT_EXCEEDS_BALANCE",
                $"Số tiền thanh toán ({request.Amount:N0} đ) vượt quá số dư công nợ còn lại ({remainingBalance:N0} đ).");
        }

        // Shared Invariant: Online Hold Guard (Finding 1)
        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        if (snapshot != null && snapshot.IsOnlineHold)
        {
            // Hold TTL and minimum deposit only govern unconfirmed PendingPayment online holds
            if (reservation.Status == ReservationStatus.PendingPayment)
            {
                // If the 15-minute online hold has expired or missing TTL, reject payment to prevent reviving expired hold / inventory overlap
                if (!snapshot.HoldExpiresAtUtc.HasValue || snapshot.HoldExpiresAtUtc.Value <= DateTime.UtcNow)
                {
                    throw new ConflictException("ERR_HOLD_EXPIRED",
                        "Thời gian giữ phòng 15 phút của đơn đặt phòng trực tuyến đã hết hạn.");
                }

                // Verify minimum deposit requirement (Decision D15: >= 30%)
                var depositRequired = snapshot.DepositRequired ?? Math.Round(reservation.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero);
                if (existingPaid + request.Amount < depositRequired)
                {
                    throw new BadRequestException("ERR_INSUFFICIENT_DEPOSIT",
                        $"Số tiền cọc ({request.Amount:N0} đ) không đủ mức cọc tối thiểu theo chính sách ({depositRequired:N0} đ).");
                }
            }
        }

        // Authoritative actor audit and idempotency metadata formatting
        var depositTag = request.IsDeposit ? "[PURPOSE:DEPOSIT]" : string.Empty;
        var formattedRef = hasIdempotencyKey
            ? (string.IsNullOrEmpty(safeUserRef) ? $"{depositTag}[IK:{normalizedKey}][BY:{userId}]" : $"{depositTag}[IK:{normalizedKey}][BY:{userId}] {safeUserRef}")
            : (string.IsNullOrEmpty(safeUserRef) ? $"{depositTag}[BY:{userId}]" : $"{depositTag}[BY:{userId}] {safeUserRef}");

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            PropertyId = request.PropertyId,
            ReservationId = reservation.Id,
            Amount = request.Amount,
            Method = request.Method,
            Status = PaymentStatus.Completed,
            TransactionRef = formattedRef,
            PaidAtUtc = DateTime.UtcNow,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.Payments.Add(payment);

        // Transition PendingPayment -> Confirmed upon receiving valid deposit/payment
        if (reservation.Status == ReservationStatus.PendingPayment)
        {
            reservation.Status = ReservationStatus.Confirmed;
            reservation.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return PaymentDto.FromEntity(payment);
    }

    private static bool HasDepositTag(string? transactionRef)
    {
        return !string.IsNullOrEmpty(transactionRef) &&
               transactionRef.Contains("[PURPOSE:DEPOSIT]", StringComparison.OrdinalIgnoreCase);
    }

    private static string ExtractUserRef(string? transactionRef)
    {
        if (string.IsNullOrEmpty(transactionRef)) return string.Empty;
        var byIndex = transactionRef.IndexOf("][BY:", StringComparison.Ordinal);
        if (byIndex >= 0)
        {
            var closingBracket = transactionRef.IndexOf(']', byIndex + 5);
            if (closingBracket >= 0)
            {
                return transactionRef[(closingBracket + 1)..].Trim();
            }
        }
        else if (transactionRef.StartsWith("[BY:", StringComparison.Ordinal))
        {
            var closingBracket = transactionRef.IndexOf(']');
            if (closingBracket >= 0)
            {
                return transactionRef[(closingBracket + 1)..].Trim();
            }
        }
        return transactionRef.Trim();
    }
}
