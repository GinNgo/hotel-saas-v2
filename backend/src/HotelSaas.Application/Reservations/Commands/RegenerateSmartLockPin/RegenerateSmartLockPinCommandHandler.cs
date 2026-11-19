using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reservations.Commands.RegenerateSmartLockPin;

/// <summary>
/// Handles regenerating an active 6-digit Smart Lock PIN for Confirmed or CheckedIn reservations with fail-closed scoping and audit logging.
/// </summary>
public sealed class RegenerateSmartLockPinCommandHandler : IRequestHandler<RegenerateSmartLockPinCommand, ReservationDetailDto>
{
    private static readonly JsonSerializerOptions AuditJsonOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService? _membershipLookupService;
    private readonly IAuditLogService? _auditLogService;

    public RegenerateSmartLockPinCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext,
        IMembershipLookupService? membershipLookupService = null,
        IAuditLogService? auditLogService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService;
        _auditLogService = auditLogService;
    }

    public async Task<ReservationDetailDto> Handle(RegenerateSmartLockPinCommand request, CancellationToken cancellationToken)
    {
        var (tenantId, userId, property) = await SmartLockCommandGuard.AuthorizeScopeAndLoadPropertyAsync(
            _context,
            _tenantService,
            _propertyService,
            _userContext,
            _membershipLookupService,
            request.PropertyId,
            cancellationToken);

        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);

        var resHeader = await _context.Reservations
            .AsNoTracking()
            .Where(r => r.Id == request.ReservationId &&
                        r.PropertyId == request.PropertyId &&
                        r.TenantId == tenantId)
            .Select(r => new { r.Id, r.RoomId })
            .FirstOrDefaultAsync(cancellationToken);

        if (resHeader == null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy đơn đặt phòng.");
        }

        await SmartLockCommandGuard.TryLockRowAsync(() => _context.LockRoomRowAsync(resHeader.RoomId, tenantId, request.PropertyId, cancellationToken));
        await SmartLockCommandGuard.TryLockRowAsync(() => _context.LockReservationRowAsync(resHeader.Id, tenantId, request.PropertyId, cancellationToken));

        var reservation = await _context.Reservations
            .Include(r => r.Room)
                .ThenInclude(room => room!.RoomType)
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId &&
                                      r.PropertyId == request.PropertyId &&
                                      r.TenantId == tenantId, cancellationToken);

        if (reservation == null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy đơn đặt phòng.");
        }

        if (reservation.Status != ReservationStatus.Confirmed && reservation.Status != ReservationStatus.CheckedIn)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                $"Chỉ có thể cấp lại mã PIN Smart Lock cho đơn đã xác nhận (Confirmed) hoặc đang lưu trú (CheckedIn). Trạng thái hiện tại: {reservation.Status}.");
        }

        var oldPin = reservation.SmartLockPin;
        var oldStatus = reservation.SmartLockStatus;
        string newPin;
        do
        {
            newPin = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
        } while (string.Equals(newPin, oldPin, StringComparison.Ordinal));

        var utcNow = DateTime.UtcNow;
        reservation.SmartLockPin = newPin;
        reservation.SmartLockStatus = "Active";
        reservation.SmartLockActivatedAtUtc = utcNow;
        reservation.UpdatedAtUtc = utcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var trimmedReason = string.IsNullOrWhiteSpace(request.Reason)
            ? "Nhân viên cấp lại mã PIN Smart Lock mới"
            : request.Reason.Trim();

        var oldJson = JsonSerializer.Serialize(new
        {
            SmartLockStatus = oldStatus,
            PinMasked = string.IsNullOrEmpty(oldPin) ? null : "******"
        }, AuditJsonOptions);

        var newJson = JsonSerializer.Serialize(new
        {
            SmartLockStatus = "Active",
            PinMasked = "******",
            ActivatedAtUtc = utcNow,
            Reason = trimmedReason
        }, AuditJsonOptions);

        await SmartLockCommandGuard.WriteAuditAsync(
            _context,
            _auditLogService,
            tenantId,
            request.PropertyId,
            userId,
            "RegenerateSmartLockPin",
            reservation.Id,
            oldJson,
            newJson,
            utcNow,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return ReservationSnapshotHelper.MapToDetailDto(reservation, property);
    }
}
