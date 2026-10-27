using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Quotes.Services;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Commands.CreateGuestHold;

public sealed record CreateGuestHoldCommand(
    string PropertySlug,
    Guid RoomTypeId,
    RentalType RentalType,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string GuestName,
    string GuestEmail,
    string? GuestPhone = null,
    int NumberOfGuests = 1,
    DateOnly? CheckInDate = null,
    DateOnly? CheckOutDate = null,
    decimal? ExpectedTotalAmount = null,
    string? IdempotencyKey = null,
    int? PointsToRedeem = null,
    Guid? GuestUserId = null
) : IRequest<GuestHoldDto>;

public sealed class CreateGuestHoldCommandHandler : IRequestHandler<CreateGuestHoldCommand, GuestHoldDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IPricingCalculator _pricingCalculator;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;

    public CreateGuestHoldCommandHandler(
        IApplicationDbContext context,
        IPricingCalculator pricingCalculator,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _pricingCalculator = pricingCalculator ?? throw new ArgumentNullException(nameof(pricingCalculator));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
    }

    public async Task<GuestHoldDto> Handle(CreateGuestHoldCommand request, CancellationToken cancellationToken)
    {
        // 1. Basic validation
        if (string.IsNullOrWhiteSpace(request.PropertySlug))
            throw new BadRequestException("ERR_INVALID_SLUG", "Mã đường dẫn cơ sở không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.GuestName))
            throw new BadRequestException("ERR_INVALID_GUEST_NAME", "Họ tên khách hàng không được để trống.");

        if (string.IsNullOrWhiteSpace(request.GuestEmail) || !request.GuestEmail.Contains('@'))
            throw new BadRequestException("ERR_INVALID_GUEST_EMAIL", "Email khách hàng không hợp lệ.");

        if (request.NumberOfGuests < 1)
            throw new BadRequestException("ERR_INVALID_GUESTS", "Số lượng khách phải lớn hơn hoặc bằng 1.");

        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var key = request.IdempotencyKey.Trim();
            if (key.Length < 8 || key.Length > 128 || !Regex.IsMatch(key, @"^[a-zA-Z0-9_\-]+$"))
            {
                throw new BadRequestException("ERR_INVALID_IDEMPOTENCY_KEY",
                    "Khóa Idempotency-Key không hợp lệ. Chỉ chấp nhận các ký tự chữ, số, gạch nối và gạch dưới (độ dài 8-128 ký tự).");
            }
        }

        var normalizedSlug = request.PropertySlug.Trim().ToLowerInvariant();

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Status == PropertyStatus.Active &&
                                     (p.Slug.ToLower() == normalizedSlug || p.Id.ToString() == normalizedSlug),
                                 cancellationToken);

        if (property == null)
            throw new NotFoundException("Không tìm thấy cơ sở lưu trú.");

        var roomType = await _context.RoomTypes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(rt => rt.Id == request.RoomTypeId && rt.PropertyId == property.Id, cancellationToken);

        if (roomType == null)
            throw new NotFoundException("Loại phòng không tồn tại trong cơ sở này.");

        if (request.NumberOfGuests > roomType.MaxOccupancy)
        {
            throw new BadRequestException("ERR_OCCUPANCY_EXCEEDED",
                $"Số lượng khách ({request.NumberOfGuests}) vượt quá sức chứa tối đa của loại phòng ({roomType.MaxOccupancy} người).");
        }

        DateTime effectiveStartUtc;
        DateTime effectiveEndUtc;
        DateOnly checkInDate;
        DateOnly checkOutDate;

        if (request.RentalType == RentalType.Hourly)
        {
            if (request.StartAtUtc == default || request.EndAtUtc == default || request.EndAtUtc <= request.StartAtUtc)
                throw new BadRequestException("ERR_INVALID_SCHEDULE", "Thời gian bắt đầu và kết thúc thuê giờ không hợp lệ.");

            effectiveStartUtc = request.StartAtUtc;
            effectiveEndUtc = request.EndAtUtc;
            var localDates = ReservationTimeHelper.GetHourlyLocalDates(effectiveStartUtc, effectiveEndUtc);
            checkInDate = localDates.CheckInDate;
            checkOutDate = localDates.CheckOutDate;
        }
        else if (request.RentalType == RentalType.Overnight)
        {
            if (request.StartAtUtc != default && request.EndAtUtc != default && request.EndAtUtc > request.StartAtUtc)
            {
                effectiveStartUtc = request.StartAtUtc;
                effectiveEndUtc = request.EndAtUtc;
                var tz = ReservationTimeHelper.GetVietnamTimeZone();
                checkInDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(effectiveStartUtc, tz));
                checkOutDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(effectiveEndUtc, tz));
            }
            else if (request.CheckInDate.HasValue && request.CheckOutDate.HasValue)
            {
                checkInDate = request.CheckInDate.Value;
                checkOutDate = request.CheckOutDate.Value;
                var overnightInterval = ReservationTimeHelper.GetOvernightUtcInterval(
                    checkInDate, checkOutDate, property.CheckInTime, property.CheckOutTime);
                effectiveStartUtc = overnightInterval.StartAtUtc;
                effectiveEndUtc = overnightInterval.EndAtUtc;
            }
            else
            {
                throw new BadRequestException("ERR_INVALID_SCHEDULE", "Vui lòng chỉ định ngày nhận và trả phòng hợp lệ.");
            }
        }
        else
        {
            throw new BadRequestException("ERR_INVALID_RENTAL_TYPE", "Hình thức thuê không hợp lệ. Chỉ chấp nhận Hourly hoặc Overnight.");
        }

        // Establish tenant & property context for change tracker & interceptors
        _tenantService.TenantId = property.TenantId;
        _propertyService.PropertyId = property.Id;
        _propertyService.IsTenantWide = false;

        var bufferMinutes = Math.Max(ReservationTimeHelper.MinimumTurnoverBufferMinutes, property.BufferMinutes);

        // Validate Idempotency-Key grammar if provided
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

        // 2. Transactional execution with advisory key lock and row-level room lock (Decision D01, Finding 3)
        await using var tx = await _context.BeginTransactionAsync(cancellationToken);

        // Idempotency replay check under advisory lock
        if (normalizedKey != null)
        {
            await _context.LockIdempotencyKeyAsync(property.Id, normalizedKey, cancellationToken);

            var existingWithKey = await _context.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(r => r.PropertyId == property.Id &&
                            r.Notes != null &&
                            r.Notes.Contains(normalizedKey))
                .ToListAsync(cancellationToken);

            foreach (var ex in existingWithKey)
            {
                var snap = ReservationSnapshotHelper.TryDeserialize(ex.Notes);
                if (snap != null && snap.IdempotencyKey == normalizedKey)
                {
                    // Full normalized payload compare (Finding 3: schedule, dates, guest details, expected total)
                    bool isMatch =
                        ex.RoomId != Guid.Empty &&
                        snap.RoomTypeId == request.RoomTypeId &&
                        snap.RentalType == request.RentalType &&
                        snap.StartAtUtc == effectiveStartUtc &&
                        snap.EndAtUtc == effectiveEndUtc &&
                        ex.CheckInDate == checkInDate &&
                        ex.CheckOutDate == checkOutDate &&
                        string.Equals(ex.GuestName.Trim(), request.GuestName.Trim(), StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(ex.GuestEmail.Trim(), request.GuestEmail.Trim(), StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(ex.GuestPhone?.Trim() ?? string.Empty, request.GuestPhone?.Trim() ?? string.Empty, StringComparison.OrdinalIgnoreCase) &&
                        ex.NumberOfGuests == request.NumberOfGuests &&
                        (!request.ExpectedTotalAmount.HasValue || ex.TotalAmount == request.ExpectedTotalAmount.Value);

                    if (isMatch)
                    {
                        await tx.RollbackAsync(cancellationToken);

                        var roomNumber = await _context.Rooms
                            .IgnoreQueryFilters()
                            .Where(rm => rm.Id == ex.RoomId)
                            .Select(rm => rm.RoomNumber)
                            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

                        var remainingSeconds = snap.HoldExpiresAtUtc.HasValue
                            ? Math.Max(0, (int)(snap.HoldExpiresAtUtc.Value - DateTime.UtcNow).TotalSeconds)
                            : 0;

                        return new GuestHoldDto
                        {
                            ReservationId = ex.Id,
                            ConfirmationCode = ex.ConfirmationCode,
                            LookupToken = snap.LookupToken ?? string.Empty,
                            PropertyId = property.Id,
                            PropertyName = property.Name,
                            RoomTypeId = roomType.Id,
                            RoomTypeName = roomType.Name,
                            AssignedRoomId = ex.RoomId,
                            AssignedRoomNumber = roomNumber,
                            RentalType = request.RentalType.ToString(),
                            StartAtUtc = snap.StartAtUtc,
                            EndAtUtc = snap.EndAtUtc,
                            CheckInDate = ex.CheckInDate,
                            CheckOutDate = ex.CheckOutDate,
                            TotalAmount = ex.TotalAmount,
                            DepositRequired = snap.DepositRequired ?? Math.Round(ex.TotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero),
                            Currency = snap.Currency,
                            HoldExpiresAtUtc = snap.HoldExpiresAtUtc ?? DateTime.UtcNow,
                            SecondsRemaining = remainingSeconds,
                            Status = ex.Status.ToString(),
                            Breakdown = snap.Breakdown
                        };
                    }
                    else
                    {
                        await tx.RollbackAsync(cancellationToken);
                        throw new ConflictException("ERR_IDEMPOTENCY_CONFLICT",
                            "Khóa Idempotency-Key đã được sử dụng cho một yêu cầu đặt phòng khác với thông tin không trùng khớp.");
                    }
                }
            }
        }

        // 3. Find physical rooms for room type ordered by floor and room number
        var rooms = await _context.Rooms
            .IgnoreQueryFilters()
            .Where(r => r.PropertyId == property.Id && r.RoomTypeId == roomType.Id && r.IsActive)
            .OrderBy(r => r.Floor)
            .ThenBy(r => r.RoomNumber)
            .ToListAsync(cancellationToken);

        if (rooms.Count == 0)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_ROOM_TYPE_UNAVAILABLE",
                "Hiện tại cơ sở chưa có phòng vật lý nào được kích hoạt cho loại phòng này.");
        }

        var roomIds = rooms.Select(r => r.Id).ToList();

        var activeReservations = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(r => r.PropertyId == property.Id &&
                        roomIds.Contains(r.RoomId) &&
                        (r.Status == ReservationStatus.PendingPayment ||
                         r.Status == ReservationStatus.Confirmed ||
                         r.Status == ReservationStatus.CheckedIn))
            .ToListAsync(cancellationToken);

        var nowUtc = DateTime.UtcNow;
        var reservationsByRoom = activeReservations.ToLookup(r => r.RoomId);

        // Find candidate rooms that do not have blocking overlapping reservations
        Room? assignedRoom = null;

        foreach (var candidate in rooms)
        {
            var roomRes = reservationsByRoom[candidate.Id];
            bool hasConflict = false;

            foreach (var existing in roomRes)
            {
                if (!ReservationTimeHelper.IsBlockingReservation(existing, nowUtc))
                {
                    continue; // Expired online hold does not block (Decision D03)
                }

                var (extStart, extEnd) = ReservationTimeHelper.GetEffectiveStayUtcInterval(existing, property);
                if (ReservationTimeHelper.HasOverlap(effectiveStartUtc, effectiveEndUtc, extStart, extEnd, bufferMinutes))
                {
                    hasConflict = true;
                    break;
                }
            }

            if (!hasConflict)
            {
                // Lock this specific room to serialize against concurrent online & internal booking attempts
                await _context.LockRoomRowAsync(candidate.Id, property.TenantId, property.Id, cancellationToken);

                // Re-verify under lock
                var freshRes = await _context.Reservations
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(r => r.PropertyId == property.Id &&
                                r.RoomId == candidate.Id &&
                                (r.Status == ReservationStatus.PendingPayment ||
                                 r.Status == ReservationStatus.Confirmed ||
                                 r.Status == ReservationStatus.CheckedIn))
                    .ToListAsync(cancellationToken);

                bool recheckConflict = false;
                foreach (var fresh in freshRes)
                {
                    if (!ReservationTimeHelper.IsBlockingReservation(fresh, DateTime.UtcNow))
                        continue;

                    var (extStart, extEnd) = ReservationTimeHelper.GetEffectiveStayUtcInterval(fresh, property);
                    if (ReservationTimeHelper.HasOverlap(effectiveStartUtc, effectiveEndUtc, extStart, extEnd, bufferMinutes))
                    {
                        recheckConflict = true;
                        break;
                    }
                }

                if (!recheckConflict)
                {
                    assignedRoom = candidate;
                    break;
                }
            }
        }

        if (assignedRoom == null)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_ROOM_TYPE_UNAVAILABLE",
                $"Loại phòng '{roomType.Name}' đã hết phòng trống trong khoảng thời gian đã chọn.");
        }

        // 4. Calculate authoritative Quote from PricingCalculator
        var quote = await _pricingCalculator.CalculateAsync(
            property,
            roomType,
            request.RentalType,
            effectiveStartUtc,
            effectiveEndUtc,
            checkInDate,
            checkOutDate,
            cancellationToken);

        if (request.ExpectedTotalAmount.HasValue && request.ExpectedTotalAmount.Value != quote.TotalAmount)
        {
            await tx.RollbackAsync(cancellationToken);
            throw new BadRequestException("ERR_QUOTE_MISMATCH",
                $"Tổng tiền dự kiến ({request.ExpectedTotalAmount.Value:N0} đ) không khớp với báo giá chính sách hiện hành ({quote.TotalAmount:N0} đ).");
        }

        // 5. Setup 15-minute hold parameters (Decision D03, D15, D02, D21)
        var pointsToRedeem = request.PointsToRedeem.GetValueOrDefault(0);
        decimal pointsDiscount = 0m;
        GuestLoyaltyMembership? membership = null;

        if (pointsToRedeem > 0)
        {
            if (!request.GuestUserId.HasValue || request.GuestUserId.Value == Guid.Empty)
            {
                await tx.RollbackAsync(cancellationToken);
                throw new BadRequestException("ERR_POINTS_AUTH_REQUIRED", "Yêu cầu đăng nhập tài khoản để sử dụng điểm thưởng thành viên.");
            }

            pointsDiscount = pointsToRedeem * 1000m;
            var maxDiscount = Math.Round(quote.TotalAmount * 0.50m, 0, MidpointRounding.AwayFromZero);
            if (pointsDiscount > maxDiscount)
            {
                await tx.RollbackAsync(cancellationToken);
                throw new BadRequestException("ERR_POINTS_EXCEEDS_LIMIT", $"Số điểm quy đổi ({pointsToRedeem:N0} điểm = {pointsDiscount:N0} đ) vượt quá 50% tổng giá trị đơn ({maxDiscount:N0} đ).");
            }

            membership = await _context.GuestLoyaltyMemberships
                .FirstOrDefaultAsync(m => m.TenantId == property.TenantId && m.UserId == request.GuestUserId.Value, cancellationToken);

            if (membership == null || membership.PointsBalance < pointsToRedeem)
            {
                await tx.RollbackAsync(cancellationToken);
                throw new BadRequestException("ERR_INSUFFICIENT_LOYALTY_POINTS", $"Số dư điểm thưởng không đủ (Hiện có: {membership?.PointsBalance ?? 0} điểm, yêu cầu: {pointsToRedeem} điểm).");
            }

            membership.PointsBalance -= pointsToRedeem;
            membership.UpdatedAtUtc = DateTime.UtcNow;
        }

        var finalTotalAmount = Math.Max(0m, quote.TotalAmount - pointsDiscount);
        var holdExpiresAtUtc = DateTime.UtcNow.AddMinutes(15);
        var depositRequired = Math.Round(finalTotalAmount * 0.30m, 0, MidpointRounding.AwayFromZero);
        var lookupToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var confirmationCode = await GenerateUniqueConfirmationCodeAsync(property.TenantId, cancellationToken);

        var snapshot = new ReservationSnapshot
        {
            RentalType = request.RentalType,
            StartAtUtc = effectiveStartUtc,
            EndAtUtc = effectiveEndUtc,
            BufferMinutes = bufferMinutes,
            RoomTypeId = roomType.Id,
            RoomTypeName = roomType.Name,
            TotalAmount = finalTotalAmount,
            Currency = quote.Currency,
            Breakdown = quote.Breakdown,
            AppliedPolicies = quote.AppliedPolicies,
            CustomerNotes = "Guest online reservation (15-min hold)",
            IdempotencyKey = request.IdempotencyKey?.Trim(),
            HoldExpiresAtUtc = holdExpiresAtUtc,
            LookupToken = lookupToken,
            DepositRequired = depositRequired,
            IsOnlineHold = true,
            TokenExpiresAtUtc = (effectiveEndUtc > DateTime.UtcNow ? effectiveEndUtc : DateTime.UtcNow).AddDays(30),
            IsTokenRevoked = false
        };

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = property.TenantId,
            PropertyId = property.Id,
            RoomId = assignedRoom.Id,
            GuestUserId = request.GuestUserId,
            GuestName = request.GuestName.Trim(),
            GuestEmail = request.GuestEmail.Trim(),
            GuestPhone = request.GuestPhone?.Trim(),
            CheckInDate = checkInDate,
            CheckOutDate = checkOutDate,
            NumberOfGuests = request.NumberOfGuests,
            TotalAmount = finalTotalAmount,
            PointsRedeemed = pointsToRedeem,
            PointsDiscountAmount = pointsDiscount,
            Status = ReservationStatus.PendingPayment,
            Notes = ReservationSnapshotHelper.Serialize(snapshot),
            ConfirmationCode = confirmationCode,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.Reservations.Add(reservation);

        if (pointsToRedeem > 0 && membership != null)
        {
            var holdTx = new LoyaltyPointTransaction
            {
                Id = Guid.NewGuid(),
                MembershipId = membership.Id,
                TenantId = property.TenantId,
                PropertyId = property.Id,
                ReservationId = reservation.Id,
                TransactionType = LoyaltyPointTransactionType.HeldForBooking,
                PointsDelta = -pointsToRedeem,
                BalanceAfter = membership.PointsBalance,
                Description = $"Khóa tạm {pointsToRedeem} điểm thưởng cho đơn giữ chỗ {confirmationCode}",
                CreatedAtUtc = DateTime.UtcNow
            };
            _context.LoyaltyPointTransactions.Add(holdTx);
        }

        await _context.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return new GuestHoldDto
        {
            ReservationId = reservation.Id,
            ConfirmationCode = reservation.ConfirmationCode,
            LookupToken = lookupToken,
            PropertyId = property.Id,
            PropertyName = property.Name,
            RoomTypeId = roomType.Id,
            RoomTypeName = roomType.Name,
            AssignedRoomId = assignedRoom.Id,
            AssignedRoomNumber = assignedRoom.RoomNumber,
            RentalType = request.RentalType.ToString(),
            StartAtUtc = effectiveStartUtc,
            EndAtUtc = effectiveEndUtc,
            CheckInDate = reservation.CheckInDate,
            CheckOutDate = reservation.CheckOutDate,
            TotalAmount = finalTotalAmount,
            DepositRequired = depositRequired,
            Currency = quote.Currency,
            HoldExpiresAtUtc = holdExpiresAtUtc,
            SecondsRemaining = 900, // 15 minutes = 900 seconds
            Status = ReservationStatus.PendingPayment.ToString(),
            PointsRedeemed = pointsToRedeem,
            PointsDiscountAmount = pointsDiscount,
            Breakdown = quote.Breakdown
        };
    }

    private async Task<string> GenerateUniqueConfirmationCodeAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (int i = 0; i < 10; i++)
        {
            var bytes = RandomNumberGenerator.GetBytes(6);
            var code = new string(bytes.Select(b => chars[b % chars.Length]).ToArray());
            var fullCode = $"RES-{code}";

            var exists = await _context.Reservations
                .IgnoreQueryFilters()
                .AnyAsync(r => r.TenantId == tenantId && r.ConfirmationCode == fullCode, cancellationToken);

            if (!exists) return fullCode;
        }

        return $"RES-{Guid.NewGuid():N}"[..10].ToUpperInvariant();
    }
}
