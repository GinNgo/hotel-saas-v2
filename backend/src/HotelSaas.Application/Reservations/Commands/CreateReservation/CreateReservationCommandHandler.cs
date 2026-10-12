using System;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Quotes.Queries.CalculateQuote;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reservations.Commands.CreateReservation;

/// <summary>
/// Handles atomic internal booking creation with row-level room locking,
/// quote engine verification, non-overlapping interval validation, and snapshot immutability.
/// </summary>
public sealed class CreateReservationCommandHandler : IRequestHandler<CreateReservationCommand, ReservationDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService? _propertyService;
    private readonly ISender _mediator;

    public CreateReservationCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ISender mediator,
        ICurrentPropertyService? propertyService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _propertyService = propertyService;
    }

    public async Task<ReservationDetailDto> Handle(CreateReservationCommand request, CancellationToken cancellationToken)
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
                case MembershipLookupStatus.UserNotFoundOrInactive:
                    throw new UnauthorizedAccessException("ERR_USER_DEACTIVATED: " + (membership.ErrorMessage ?? "Tài khoản người dùng đã bị vô hiệu hóa."));
                case MembershipLookupStatus.PropertyRequired:
                    throw new ForbiddenException("ERR_PROPERTY_REQUIRED", membership.ErrorMessage ?? "Yêu cầu chọn chi nhánh làm việc để tiếp tục.");
                default:
                    throw new ForbiddenException("ERR_FORBIDDEN", membership.ErrorMessage ?? "Không có quyền thực hiện thao tác trên chi nhánh này.");
            }
        }

        // Validate Property exists
        // Validate Property exists
        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId.Value, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        // Determine normalized stay dates and UTC boundaries
        DateTime effectiveStartUtc;
        DateTime effectiveEndUtc;
        DateOnly checkInDate;
        DateOnly checkOutDate;
        var tz = ReservationTimeHelper.GetVietnamTimeZone();

        if (request.RentalType == RentalType.Hourly)
        {
            effectiveStartUtc = request.StartAtUtc;
            effectiveEndUtc = request.EndAtUtc;
            var localDates = ReservationTimeHelper.GetHourlyLocalDates(effectiveStartUtc, effectiveEndUtc);
            checkInDate = request.CheckInDate ?? localDates.CheckInDate;
            checkOutDate = request.CheckOutDate ?? localDates.CheckOutDate;
        }
        else
        {
            // Finding 1: Authoritative interval alignment between Quote, Inventory, Overlap and Snapshot
            if (request.StartAtUtc != default && request.EndAtUtc != default && request.EndAtUtc > request.StartAtUtc)
            {
                effectiveStartUtc = request.StartAtUtc;
                effectiveEndUtc = request.EndAtUtc;
                var startLocal = TimeZoneInfo.ConvertTimeFromUtc(effectiveStartUtc, tz);
                var endLocal = TimeZoneInfo.ConvertTimeFromUtc(effectiveEndUtc, tz);
                checkInDate = request.CheckInDate ?? DateOnly.FromDateTime(startLocal);
                checkOutDate = request.CheckOutDate ?? DateOnly.FromDateTime(endLocal);
            }
            else
            {
                checkInDate = request.CheckInDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
                checkOutDate = request.CheckOutDate ?? checkInDate.AddDays(1);
                var overnightInterval = ReservationTimeHelper.GetOvernightUtcInterval(checkInDate, checkOutDate, property.CheckInTime, property.CheckOutTime);
                effectiveStartUtc = overnightInterval.StartAtUtc;
                effectiveEndUtc = overnightInterval.EndAtUtc;
            }
        }

        // ── PRE-TRANSACTION IDEMPOTENCY CHECK (BEFORE live quote calculation) ──
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existingByKey = await _context.Reservations
                .Include(r => r.Room)!.ThenInclude(rm => rm!.RoomType)
                .Where(r => r.TenantId == tenantId.Value &&
                            r.PropertyId == request.PropertyId &&
                            r.Notes != null &&
                            r.Notes.Contains(request.IdempotencyKey))
                .ToListAsync(cancellationToken);

            foreach (var ex in existingByKey)
            {
                var snap = ReservationSnapshotHelper.TryDeserialize(ex.Notes);
                if (snap != null && snap.IdempotencyKey == request.IdempotencyKey)
                {
                    if (IsExactPayloadMatch(ex, snap, request, effectiveStartUtc, effectiveEndUtc, checkInDate, checkOutDate))
                    {
                        return MapToDetailDto(ex, snap);
                    }
                    else
                    {
                        throw new ConflictException("ERR_IDEMPOTENCY_CONFLICT",
                            "Khóa IdempotencyKey đã được sử dụng với thông tin đặt phòng khác.");
                    }
                }
            }
        }

        var bufferMinutes = Math.Max(ReservationTimeHelper.MinimumTurnoverBufferMinutes, property.BufferMinutes);

        // ── ATOMIC TRANSACTION ──
        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);

        // 1. Serialize by Idempotency Key across different rooms using PostgreSQL advisory xact lock
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            await _context.LockIdempotencyKeyAsync(request.PropertyId, request.IdempotencyKey, cancellationToken);

            var existingByKey = await _context.Reservations
                .Include(r => r.Room)!.ThenInclude(rm => rm!.RoomType)
                .Where(r => r.TenantId == tenantId.Value &&
                            r.PropertyId == request.PropertyId &&
                            r.Notes != null &&
                            r.Notes.Contains(request.IdempotencyKey))
                .ToListAsync(cancellationToken);

            foreach (var ex in existingByKey)
            {
                var snap = ReservationSnapshotHelper.TryDeserialize(ex.Notes);
                if (snap != null && snap.IdempotencyKey == request.IdempotencyKey)
                {
                    await transaction.RollbackAsync(cancellationToken);
                    if (IsExactPayloadMatch(ex, snap, request, effectiveStartUtc, effectiveEndUtc, checkInDate, checkOutDate))
                    {
                        return MapToDetailDto(ex, snap);
                    }
                    else
                    {
                        throw new ConflictException("ERR_IDEMPOTENCY_CONFLICT",
                            "Khóa IdempotencyKey đã được sử dụng với thông tin đặt phòng khác.");
                    }
                }
            }
        }

        // 2. Validate Room exists and belongs to Property and Tenant
        var room = await _context.Rooms
            .Include(r => r.RoomType)
            .FirstOrDefaultAsync(r => r.Id == request.RoomId &&
                                      r.PropertyId == request.PropertyId &&
                                      r.TenantId == tenantId.Value, cancellationToken);

        if (room == null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new NotFoundException("Phòng không tồn tại trong chi nhánh này.");
        }

        if (!room.IsActive)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new BadRequestException("ERR_ROOM_INACTIVE", "Phòng này hiện đang tạm ngưng hoạt động.");
        }

        // 3. Acquire exclusive row lock on Room to serialize concurrent bookings on the same physical room
        await _context.LockRoomRowAsync(room.Id, tenantId.Value, request.PropertyId, cancellationToken);

        // 4. Query all active reservations on this room
        var activeReservations = await _context.Reservations
            .Where(r => r.TenantId == tenantId.Value &&
                        r.PropertyId == request.PropertyId &&
                        r.RoomId == room.Id &&
                        (r.Status == ReservationStatus.PendingPayment ||
                         r.Status == ReservationStatus.Confirmed ||
                         r.Status == ReservationStatus.CheckedIn))
            .ToListAsync(cancellationToken);

        // 5. Evaluate non-overlapping availability with turnover buffer
        var nowUtc = DateTime.UtcNow;
        foreach (var existing in activeReservations)
        {
            if (!ReservationTimeHelper.IsBlockingReservation(existing, nowUtc))
            {
                continue;
            }

            var (extStart, extEnd) = ReservationTimeHelper.GetEffectiveStayUtcInterval(existing, property);
            if (ReservationTimeHelper.HasOverlap(effectiveStartUtc, effectiveEndUtc, extStart, extEnd, bufferMinutes))
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new ConflictException("ERR_ROOM_UNAVAILABLE",
                    $"Phòng {room.RoomNumber} đã có người đặt trong khoảng thời gian này hoặc vi phạm khoảng đệm dọn phòng {bufferMinutes} phút.");
            }
        }

        // 6. Calculate verified Quote from authoritative Quote Engine under transaction
        var quote = await _mediator.Send(new CalculateQuoteQuery(
            PropertyId: request.PropertyId,
            RoomTypeId: room.RoomTypeId,
            RentalType: request.RentalType,
            StartAtUtc: request.StartAtUtc,
            EndAtUtc: request.EndAtUtc,
            CheckInDate: request.CheckInDate,
            CheckOutDate: request.CheckOutDate
        ), cancellationToken);

        if (request.ExpectedTotalAmount.HasValue && request.ExpectedTotalAmount.Value != quote.TotalAmount)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new BadRequestException("ERR_QUOTE_MISMATCH",
                $"Tổng tiền dự kiến ({request.ExpectedTotalAmount.Value:N0} VND) không khớp với báo giá chính sách hiện hành ({quote.TotalAmount:N0} VND).");
        }

        // 7. Generate unique confirmation code: RES-XXXXXX
        var confirmationCode = await GenerateUniqueConfirmationCodeAsync(tenantId.Value, cancellationToken);

        // 8. Build immutable pricing & policy snapshot
        var snapshot = new ReservationSnapshot
        {
            RentalType = request.RentalType,
            StartAtUtc = effectiveStartUtc,
            EndAtUtc = effectiveEndUtc,
            BufferMinutes = bufferMinutes,
            RoomTypeId = room.RoomTypeId,
            RoomTypeName = room.RoomType?.Name ?? quote.RoomTypeName,
            TotalAmount = quote.TotalAmount,
            Currency = quote.Currency,
            Breakdown = quote.Breakdown,
            AppliedPolicies = quote.AppliedPolicies,
            CustomerNotes = request.CustomerNotes,
            IdempotencyKey = request.IdempotencyKey
        };

        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            PropertyId = request.PropertyId,
            RoomId = room.Id,
            GuestName = request.GuestName.Trim(),
            GuestEmail = request.GuestEmail.Trim(),
            GuestPhone = request.GuestPhone?.Trim(),
            CheckInDate = checkInDate,
            CheckOutDate = checkOutDate,
            NumberOfGuests = request.NumberOfGuests,
            TotalAmount = quote.TotalAmount,
            Status = ReservationStatus.Confirmed,
            Notes = ReservationSnapshotHelper.Serialize(snapshot),
            ConfirmationCode = confirmationCode,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.Reservations.Add(reservation);
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new ReservationDetailDto
        {
            Id = reservation.Id,
            TenantId = reservation.TenantId,
            PropertyId = reservation.PropertyId,
            RoomId = reservation.RoomId,
            RoomNumber = room.RoomNumber,
            RoomTypeId = room.RoomTypeId,
            RoomTypeName = snapshot.RoomTypeName,
            RentalType = request.RentalType,
            StartAtUtc = effectiveStartUtc,
            EndAtUtc = effectiveEndUtc,
            CheckInDate = reservation.CheckInDate,
            CheckOutDate = reservation.CheckOutDate,
            GuestName = reservation.GuestName,
            GuestEmail = reservation.GuestEmail,
            GuestPhone = reservation.GuestPhone,
            NumberOfGuests = reservation.NumberOfGuests,
            TotalAmount = reservation.TotalAmount,
            Currency = snapshot.Currency,
            Status = reservation.Status,
            ConfirmationCode = reservation.ConfirmationCode,
            Notes = request.CustomerNotes,
            CreatedAtUtc = reservation.CreatedAtUtc,
            Breakdown = snapshot.Breakdown,
            AppliedPolicies = snapshot.AppliedPolicies
        };
    }

    private static bool IsExactPayloadMatch(
        Reservation ex,
        ReservationSnapshot snap,
        CreateReservationCommand request,
        DateTime effectiveStartUtc,
        DateTime effectiveEndUtc,
        DateOnly checkInDate,
        DateOnly checkOutDate)
    {
        if (ex.RoomId != request.RoomId) return false;
        if (snap.RentalType != request.RentalType) return false;
        if (snap.StartAtUtc != effectiveStartUtc) return false;
        if (snap.EndAtUtc != effectiveEndUtc) return false;
        if (ex.CheckInDate != checkInDate) return false;
        if (ex.CheckOutDate != checkOutDate) return false;
        if (!string.Equals(ex.GuestName.Trim(), request.GuestName.Trim(), StringComparison.OrdinalIgnoreCase)) return false;
        if (!string.Equals(ex.GuestEmail.Trim(), request.GuestEmail.Trim(), StringComparison.OrdinalIgnoreCase)) return false;
        if (!string.Equals(ex.GuestPhone?.Trim() ?? string.Empty, request.GuestPhone?.Trim() ?? string.Empty, StringComparison.OrdinalIgnoreCase)) return false;
        if (ex.NumberOfGuests != request.NumberOfGuests) return false;
        if (!string.Equals(snap.CustomerNotes?.Trim() ?? string.Empty, request.CustomerNotes?.Trim() ?? string.Empty, StringComparison.Ordinal)) return false;
        if (request.ExpectedTotalAmount.HasValue && ex.TotalAmount != request.ExpectedTotalAmount.Value) return false;
        return true;
    }

    private static ReservationDetailDto MapToDetailDto(Reservation reservation, ReservationSnapshot snapshot)
    {
        return new ReservationDetailDto
        {
            Id = reservation.Id,
            TenantId = reservation.TenantId,
            PropertyId = reservation.PropertyId,
            RoomId = reservation.RoomId,
            RoomNumber = reservation.Room?.RoomNumber ?? string.Empty,
            RoomTypeId = reservation.Room?.RoomTypeId ?? snapshot.RoomTypeId,
            RoomTypeName = snapshot.RoomTypeName,
            RentalType = snapshot.RentalType,
            StartAtUtc = snapshot.StartAtUtc,
            EndAtUtc = snapshot.EndAtUtc,
            CheckInDate = reservation.CheckInDate,
            CheckOutDate = reservation.CheckOutDate,
            GuestName = reservation.GuestName,
            GuestEmail = reservation.GuestEmail,
            GuestPhone = reservation.GuestPhone,
            NumberOfGuests = reservation.NumberOfGuests,
            TotalAmount = reservation.TotalAmount,
            Currency = snapshot.Currency,
            Status = reservation.Status,
            ConfirmationCode = reservation.ConfirmationCode,
            Notes = snapshot.CustomerNotes,
            CreatedAtUtc = reservation.CreatedAtUtc,
            Breakdown = snapshot.Breakdown,
            AppliedPolicies = snapshot.AppliedPolicies
        };
    }

    private async Task<string> GenerateUniqueConfirmationCodeAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        for (int attempt = 0; attempt < 10; attempt++)
        {
            var bytes = RandomNumberGenerator.GetBytes(6);
            var codeChars = new char[6];
            for (int i = 0; i < 6; i++)
            {
                codeChars[i] = chars[bytes[i] % chars.Length];
            }
            var code = $"RES-{new string(codeChars)}";

            var exists = await _context.Reservations
                .AnyAsync(r => r.TenantId == tenantId && r.ConfirmationCode == code, cancellationToken);

            if (!exists)
            {
                return code;
            }
        }

        return $"RES-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
    }
}
