using System;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reservations.Commands.RegenerateSmartLockPin;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reservations.Commands.RevokeSmartLockPin;

/// <summary>
/// Handles revoking a reservation's Smart Lock PIN with fail-closed scoping and audit logging.
/// </summary>
public sealed class RevokeSmartLockPinCommandHandler : IRequestHandler<RevokeSmartLockPinCommand, ReservationDetailDto>
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

    public RevokeSmartLockPinCommandHandler(
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

    public async Task<ReservationDetailDto> Handle(RevokeSmartLockPinCommand request, CancellationToken cancellationToken)
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

        if (string.Equals(reservation.SmartLockStatus, "Revoked", StringComparison.OrdinalIgnoreCase))
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_SMART_LOCK_ALREADY_REVOKED",
                "Mã PIN Smart Lock của đơn đặt phòng này đã được thu hồi trước đó.");
        }

        bool isEligibleStatus = reservation.Status == ReservationStatus.Confirmed ||
                                reservation.Status == ReservationStatus.CheckedIn ||
                                string.Equals(reservation.SmartLockStatus, "Active", StringComparison.OrdinalIgnoreCase);

        if (!isEligibleStatus)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                $"Không thể thu hồi mã PIN Smart Lock khi đơn đặt phòng đang ở trạng thái {reservation.Status}.");
        }

        var oldStatus = reservation.SmartLockStatus;
        var utcNow = DateTime.UtcNow;

        reservation.SmartLockStatus = "Revoked";
        reservation.UpdatedAtUtc = utcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var trimmedReason = string.IsNullOrWhiteSpace(request.Reason)
            ? "Nhân viên thu hồi mã PIN Smart Lock"
            : request.Reason.Trim();

        var oldJson = JsonSerializer.Serialize(new
        {
            SmartLockStatus = oldStatus,
            PinMasked = string.IsNullOrEmpty(reservation.SmartLockPin) ? null : "******"
        }, AuditJsonOptions);

        var newJson = JsonSerializer.Serialize(new
        {
            SmartLockStatus = "Revoked",
            RevokedAtUtc = utcNow,
            Reason = trimmedReason
        }, AuditJsonOptions);

        await SmartLockCommandGuard.WriteAuditAsync(
            _context,
            _auditLogService,
            tenantId,
            request.PropertyId,
            userId,
            "RevokeSmartLockPin",
            reservation.Id,
            oldJson,
            newJson,
            utcNow,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return ReservationSnapshotHelper.MapToDetailDto(reservation, property);
    }
}
