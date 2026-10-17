using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Services;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Commands.ConfirmGuestBooking;

/// <summary>
/// Confirms a guest online hold upon receiving authorized manual deposit collection by staff.
/// Implements Decisions D08, D15, D21 with strict room locking, FSM state verification, and idempotency.
/// </summary>
public sealed record ConfirmGuestBookingCommand(
    string? LookupToken,
    Guid? ReservationId,
    Guid PropertyId,
    decimal PaymentAmount,
    PaymentMethod PaymentMethod,
    string TransactionRef,
    string? IdempotencyKey = null
) : IRequest<GuestBookingDetailDto>;

public sealed class ConfirmGuestBookingCommandHandler : IRequestHandler<ConfirmGuestBookingCommand, GuestBookingDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;

    public ConfirmGuestBookingCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    public async Task<GuestBookingDetailDto> Handle(ConfirmGuestBookingCommand request, CancellationToken cancellationToken)
    {
        // 1. Authoritative Staff Actor & Scope Verification (Decision D08)
        if (_userContext.UserId == Guid.Empty)
        {
            throw new ForbiddenException("Yêu cầu nhân viên đăng nhập có thẩm quyền để xác nhận thanh toán đặt cọc.");
        }

        if (request.PropertyId == Guid.Empty)
        {
            throw new BadRequestException("ERR_PROPERTY_REQUIRED", "Yêu cầu cung cấp thông tin chi nhánh khách sạn.");
        }

        if (_propertyService.PropertyId.HasValue && _propertyService.PropertyId.Value != request.PropertyId)
        {
            throw new BadRequestException("ERR_BRANCH_MISMATCH", "Chi nhánh thao tác không khớp với ngữ cảnh làm việc.");
        }

        if (_userContext.PropertyId.HasValue && !_userContext.IsTenantWide && _userContext.PropertyId.Value != request.PropertyId)
        {
            throw new ForbiddenException("Nhân viên không có quyền thao tác trên chi nhánh này.");
        }

        // 2. Financial & Input Validation (Finding 1)
        if (request.PaymentAmount <= 0m)
        {
            throw new BadRequestException("ERR_INVALID_PAYMENT_AMOUNT", "Số tiền thanh toán phải lớn hơn 0.");
        }

        if (request.PaymentMethod != PaymentMethod.Cash && request.PaymentMethod != PaymentMethod.BankTransfer)
        {
            throw new BadRequestException("ERR_INVALID_PAYMENT_METHOD", "Chỉ chấp nhận phương thức thanh toán Tiền mặt (Cash) hoặc Chuyển khoản (BankTransfer).");
        }

        if (string.IsNullOrWhiteSpace(request.TransactionRef))
        {
            throw new BadRequestException("ERR_TRANSACTION_REF_REQUIRED", "Yêu cầu mã giao dịch hoặc chứng từ nộp cọc hợp lệ (biên lai/UNC).");
        }

        string? normalizedKey = null;
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            normalizedKey = request.IdempotencyKey.Trim();
            if (normalizedKey.Length < 8 || normalizedKey.Length > 128 || !Regex.IsMatch(normalizedKey, @"^[a-zA-Z0-9_\-]+$"))
            {
                throw new BadRequestException("ERR_INVALID_IDEMPOTENCY_KEY",
                    "Khóa Idempotency-Key không hợp lệ. Chỉ chấp nhận các ký tự chữ, số, gạch nối và gạch dưới (độ dài 8-128 ký tự).");
            }
        }

        var token = request.LookupToken?.Trim();
        if (string.IsNullOrWhiteSpace(token) && !request.ReservationId.HasValue)
        {
            throw new BadRequestException("ERR_INVALID_REQUEST", "Cần cung cấp mã tra cứu (LookupToken) hoặc mã đặt phòng (ReservationId).");
        }

        // 3. Initial Metadata Lookup (No-Tracking per Finding 2)
        var initialRes = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => (request.ReservationId.HasValue && r.Id == request.ReservationId.Value) ||
                        (!string.IsNullOrWhiteSpace(token) && r.Notes != null && r.Notes.Contains(token)))
            .Select(r => new { r.Id, r.RoomId, r.TenantId, r.PropertyId, r.Status, r.Notes, r.TotalAmount })
            .FirstOrDefaultAsync(cancellationToken);

        if (initialRes == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng.");
        }

        if (initialRes.PropertyId != request.PropertyId)
        {
            throw new BadRequestException("ERR_BRANCH_MISMATCH", "Chi nhánh đặt phòng không khớp với chi nhánh thao tác.");
        }

        var initialSnap = ReservationSnapshotHelper.TryDeserialize(initialRes.Notes);
        if (initialSnap == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin chi tiết đặt phòng.");
        }

        if (!string.IsNullOrWhiteSpace(token))
        {
            if (!string.Equals(initialSnap.LookupToken, token, StringComparison.OrdinalIgnoreCase))
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
        }

        // 4. Transaction & Locks: Advisory Key Lock + Row-level Room Lock (Finding 2)
        await using var tx = await _context.BeginTransactionAsync(cancellationToken);

        if (normalizedKey != null)
        {
            await _context.LockIdempotencyKeyAsync(initialRes.PropertyId, normalizedKey, cancellationToken);

            var ikTag = $"[IK:{normalizedKey}]";
            var directPrefix = $"[IK:{normalizedKey}][BY:";
            var depositPrefix = $"[PURPOSE:DEPOSIT][IK:{normalizedKey}][BY:";

            var crossResPayment = await _context.Payments
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(p =>
                    p.TenantId == initialRes.TenantId &&
                    p.PropertyId == initialRes.PropertyId &&
                    p.Status == PaymentStatus.Completed &&
                    p.TransactionRef != null &&
                    (p.TransactionRef.StartsWith(directPrefix) ||
                     p.TransactionRef.StartsWith(depositPrefix) ||
                     p.TransactionRef.Contains(ikTag)),
                    cancellationToken);

            if (crossResPayment != null && crossResPayment.ReservationId != initialRes.Id)
            {
                await tx.RollbackAsync(cancellationToken);
                throw new ConflictException("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH",
                    "Khóa Idempotency-Key đã được sử dụng cho một đơn đặt phòng khác.");
            }
        }

        await _context.LockRoomRowAsync(initialRes.RoomId, initialRes.TenantId, initialRes.PropertyId, cancellationToken);

        // 5. Fresh-state Query under Room Lock (Finding 2)
        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .Include(r => r.Payments)
            .FirstOrDefaultAsync(r => r.Id == initialRes.Id, cancellationToken);

        if (reservation == null)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng.");
        }

        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        if (snapshot == null)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy thông tin chi tiết đặt phòng.");
        }

        // 6. FSM State Guards under Lock
        if (reservation.Status == ReservationStatus.Cancelled)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_RESERVATION_CANCELLED", "Không thể xác nhận đơn đặt phòng đã bị hủy.");
        }

        if (reservation.Status == ReservationStatus.CheckedOut)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_RESERVATION_SETTLED", "Đơn đặt phòng đã hoàn tất trả phòng.");
        }

        // Idempotent Replay under Lock
        if (reservation.Status == ReservationStatus.Confirmed || reservation.Status == ReservationStatus.CheckedIn)
        {
            if (normalizedKey != null)
            {
                var ikTag = $"[IK:{normalizedKey}]";
                var directPrefix = $"[IK:{normalizedKey}][BY:";
                var depositPrefix = $"[PURPOSE:DEPOSIT][IK:{normalizedKey}][BY:";

                var existingPayment = reservation.Payments
                    .FirstOrDefault(p => p.Status == PaymentStatus.Completed &&
                                         p.TransactionRef != null &&
                                         (p.TransactionRef.StartsWith(directPrefix, StringComparison.Ordinal) ||
                                          p.TransactionRef.StartsWith(depositPrefix, StringComparison.Ordinal) ||
                                          p.TransactionRef.Contains(ikTag, StringComparison.Ordinal)));

                if (existingPayment != null)
                {
                    var storedUserRef = ExtractUserRef(existingPayment.TransactionRef);
                    var safeUserRef = request.TransactionRef.Trim();
                    var existingIsDeposit = HasDepositTag(existingPayment.TransactionRef);

                    if (!existingIsDeposit ||
                        existingPayment.Amount != request.PaymentAmount ||
                        existingPayment.Method != request.PaymentMethod ||
                        storedUserRef != safeUserRef)
                    {
                        await tx.RollbackAsync(cancellationToken);
                        throw new ConflictException("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH",
                            "Khóa Idempotency-Key đã được sử dụng với thông tin giao dịch không trùng khớp.");
                    }
                }
            }

            await tx.CommitAsync(cancellationToken);
            return await BuildDetailDtoAsync(reservation, snapshot, cancellationToken);
        }

        // 7. Verify Hold Expiration under Lock (Decision D03)
        var nowUtc = DateTime.UtcNow;
        if (snapshot.IsOnlineHold && (!snapshot.HoldExpiresAtUtc.HasValue || snapshot.HoldExpiresAtUtc.Value <= nowUtc))
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_HOLD_EXPIRED", "Thời gian giữ phòng 15 phút đã hết hạn. Vui lòng thực hiện đặt phòng mới.");
        }

        // 8. Deposit Amount & Folio Reconciliation (Decision D15)
        var depositRequired = snapshot.DepositRequired ?? Math.Round(reservation.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero);
        if (request.PaymentAmount < depositRequired)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new BadRequestException("ERR_INSUFFICIENT_DEPOSIT",
                $"Số tiền cọc ({request.PaymentAmount:N0} đ) không đủ mức cọc tối thiểu theo chính sách ({depositRequired:N0} đ).");
        }

        var existingPaid = reservation.Payments
            .Where(p => p.Status == PaymentStatus.Completed)
            .Sum(p => p.Amount);

        var remainingBalance = reservation.TotalAmount - existingPaid;
        if (request.PaymentAmount > remainingBalance)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new BadRequestException("ERR_AMOUNT_EXCEEDS_BALANCE",
                $"Số tiền nạp ({request.PaymentAmount:N0} đ) vượt quá tổng tiền còn lại của đơn ({remainingBalance:N0} đ).");
        }

        // 9. Check Existing Idempotent Payment Record under Lock
        if (normalizedKey != null)
        {
            var ikTag = $"[IK:{normalizedKey}]";
            var directPrefix = $"[IK:{normalizedKey}][BY:";
            var depositPrefix = $"[PURPOSE:DEPOSIT][IK:{normalizedKey}][BY:";

            var existingPayment = reservation.Payments
                .FirstOrDefault(p => p.Status == PaymentStatus.Completed &&
                                     p.TransactionRef != null &&
                                     (p.TransactionRef.StartsWith(directPrefix, StringComparison.Ordinal) ||
                                      p.TransactionRef.StartsWith(depositPrefix, StringComparison.Ordinal) ||
                                      p.TransactionRef.Contains(ikTag, StringComparison.Ordinal)));

            if (existingPayment != null)
            {
                var storedUserRef = ExtractUserRef(existingPayment.TransactionRef);
                var safeUserRef = request.TransactionRef.Trim();
                var existingIsDeposit = HasDepositTag(existingPayment.TransactionRef);

                if (!existingIsDeposit ||
                    existingPayment.Amount != request.PaymentAmount ||
                    existingPayment.Method != request.PaymentMethod ||
                    storedUserRef != safeUserRef)
                {
                    await tx.RollbackAsync(cancellationToken);
                    throw new ConflictException("ERR_IDEMPOTENCY_PAYLOAD_MISMATCH",
                        "Khóa Idempotency-Key đã được sử dụng với thông tin giao dịch không trùng khớp.");
                }

                await tx.CommitAsync(cancellationToken);
                return await BuildDetailDtoAsync(reservation, snapshot, cancellationToken);
            }
        }

        // 10. Record Authorized Deposit Payment with Actor Audit (Finding 1 & 2)
        _tenantService.TenantId = reservation.TenantId;
        _propertyService.PropertyId = reservation.PropertyId;

        var userId = _userContext.UserId;
        var cleanRef = request.TransactionRef.Trim();
        var formattedRef = normalizedKey != null
            ? $"[PURPOSE:DEPOSIT][IK:{normalizedKey}][BY:{userId}] {cleanRef}"
            : $"[PURPOSE:DEPOSIT][BY:{userId}] {cleanRef}";

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            TenantId = reservation.TenantId,
            PropertyId = reservation.PropertyId,
            ReservationId = reservation.Id,
            Amount = request.PaymentAmount,
            Method = request.PaymentMethod,
            Status = PaymentStatus.Completed,
            TransactionRef = formattedRef,
            PaidAtUtc = nowUtc,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc
        };

        _context.Payments.Add(payment);

        reservation.Status = ReservationStatus.Confirmed;
        reservation.UpdatedAtUtc = nowUtc;

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return await BuildDetailDtoAsync(reservation, snapshot, cancellationToken);
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
            var closeBracket = transactionRef.IndexOf(']', byIndex + 5);
            if (closeBracket >= 0 && closeBracket + 1 < transactionRef.Length)
            {
                return transactionRef[(closeBracket + 1)..].Trim();
            }
            return string.Empty;
        }

        var bareByIndex = transactionRef.IndexOf("[BY:", StringComparison.Ordinal);
        if (bareByIndex >= 0)
        {
            var closeBracket = transactionRef.IndexOf(']', bareByIndex + 4);
            if (closeBracket >= 0 && closeBracket + 1 < transactionRef.Length)
            {
                return transactionRef[(closeBracket + 1)..].Trim();
            }
            return string.Empty;
        }

        return transactionRef.Trim();
    }

    private async Task<GuestBookingDetailDto> BuildDetailDtoAsync(
        Reservation reservation,
        ReservationSnapshot snapshot,
        CancellationToken cancellationToken)
    {
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

        var depositRequired = snapshot.DepositRequired ?? Math.Round(reservation.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero);
        var remainingBalance = Math.Max(0m, reservation.TotalAmount - paidAmount);
        var isFullyPaid = paidAmount >= reservation.TotalAmount && reservation.TotalAmount > 0;

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
            Status = reservation.Status.ToString(),
            MaskedGuestName = PiiMaskingHelper.MaskName(reservation.GuestName),
            MaskedGuestEmail = PiiMaskingHelper.MaskEmail(reservation.GuestEmail),
            MaskedGuestPhone = PiiMaskingHelper.MaskPhone(reservation.GuestPhone),
            HoldExpiresAtUtc = snapshot.HoldExpiresAtUtc,
            SecondsRemaining = 0,
            CreatedAtUtc = reservation.CreatedAtUtc,
            Breakdown = snapshot.Breakdown ?? Array.Empty<QuoteBreakdownItemDto>()
        };
    }
}
