using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Loyalty.Services;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reservations.Commands.CancelReservation;

/// <summary>
/// Handles cancelling a reservation before check-in: validates FSM status, records cancellation timestamp and reason,
/// and updates the reservation status to Cancelled.
/// </summary>
public sealed class CancelReservationCommandHandler : IRequestHandler<CancelReservationCommand, ReservationDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ILoyaltyLedgerService _loyaltyLedgerService;

    public CancelReservationCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ICurrentPropertyService propertyService,
        ILoyaltyLedgerService? loyaltyLedgerService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _loyaltyLedgerService = loyaltyLedgerService ?? new LoyaltyLedgerService(_context);
    }

    public async Task<ReservationDetailDto> Handle(CancelReservationCommand request, CancellationToken cancellationToken)
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

        // Branch context header / token validation
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

        // Authoritative membership check - fail-closed
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

        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId.Value, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);

        // 1. Fetch reservation metadata with NoTracking to identify target room
        var resHeader = await _context.Reservations
            .AsNoTracking()
            .Where(r => r.Id == request.ReservationId &&
                        r.PropertyId == request.PropertyId &&
                        r.TenantId == tenantId.Value)
            .Select(r => new { r.Id, r.RoomId })
            .FirstOrDefaultAsync(cancellationToken);

        if (resHeader == null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy đơn đặt phòng.");
        }

        // 2. Lock room row first to serialize all lifecycle operations on this room (including concurrent check-in)
        await _context.LockRoomRowAsync(resHeader.RoomId, tenantId.Value, request.PropertyId, cancellationToken);

        // 3. Load fresh tracked reservation and room under the exclusive lock
        var reservation = await _context.Reservations
            .Include(r => r.Room)
                .ThenInclude(room => room!.RoomType)
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId &&
                                      r.PropertyId == request.PropertyId &&
                                      r.TenantId == tenantId.Value, cancellationToken);

        if (reservation == null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new NotFoundException("Không tìm thấy đơn đặt phòng.");
        }

        // 4. Validate FSM transition under lock
        if (reservation.Status == ReservationStatus.Cancelled)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_ALREADY_CANCELLED", "Đặt phòng này đã bị hủy trước đó.");
        }

        if (reservation.Status == ReservationStatus.CheckedIn)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                "Không thể hủy đặt phòng khi khách đang lưu trú (CheckedIn). Vui lòng thực hiện Trả phòng.");
        }

        if (reservation.Status == ReservationStatus.CheckedOut)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION", "Không thể hủy đặt phòng đã hoàn tất trả phòng.");
        }

        if (reservation.Status != ReservationStatus.Confirmed && reservation.Status != ReservationStatus.PendingPayment)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION", $"Không thể hủy đặt phòng khi đang ở trạng thái {reservation.Status}.");
        }

        var reason = !string.IsNullOrWhiteSpace(request.Reason)
            ? request.Reason.Trim()
            : "Khách yêu cầu hủy đặt phòng";

        reservation.Status = ReservationStatus.Cancelled;
        reservation.CancelledAtUtc = DateTime.UtcNow;
        reservation.CancellationReason = reason;
        reservation.SmartLockStatus = "Revoked";

        // Rule C: Automatic, idempotent points refund on reservation cancellation via LoyaltyLedgerService
        if (reservation.PointsRedeemed > 0 && reservation.PointsRefunded == 0)
        {
            await _loyaltyLedgerService.RefundPointsAsync(reservation.Id, cancellationToken);
            reservation.PointsRefunded = reservation.PointsRedeemed;
        }

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return ReservationSnapshotHelper.MapToDetailDto(reservation, property);
    }
}
