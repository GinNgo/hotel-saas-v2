using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reservations.Commands.CheckOutReservation;

/// <summary>
/// Handles checking out a reservation: validates FSM status is CheckedIn, locks the physical room,
/// transitions the reservation to CheckedOut, and transitions the room status to Dirty.
/// </summary>
public sealed class CheckOutReservationCommandHandler : IRequestHandler<CheckOutReservationCommand, ReservationDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService _propertyService;

    public CheckOutReservationCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ICurrentPropertyService propertyService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
    }

    public async Task<ReservationDetailDto> Handle(CheckOutReservationCommand request, CancellationToken cancellationToken)
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

        // 2. Lock room row first to serialize all lifecycle operations on this room
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
        if (reservation.Status == ReservationStatus.CheckedOut)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION", "Đặt phòng này đã được trả phòng trước đó.");
        }

        if (reservation.Status == ReservationStatus.Cancelled)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION", "Đặt phòng này đã bị hủy, không thể làm thủ tục trả phòng.");
        }

        if (reservation.Status != ReservationStatus.CheckedIn)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_INVALID_STATUS_TRANSITION",
                "Khách chưa thực hiện nhận phòng (CheckedIn), không thể làm thủ tục trả phòng.");
        }

        // 4b. Enforce POL-IO03: Settle all outstanding balance before checkout
        var paidAmount = await _context.Payments
            .Where(p => p.ReservationId == reservation.Id &&
                        p.PropertyId == request.PropertyId &&
                        p.TenantId == tenantId.Value &&
                        p.Status == PaymentStatus.Completed)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;

        var remainingBalance = reservation.TotalAmount - paidAmount;
        if (remainingBalance > 0m)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new ConflictException("ERR_OUTSTANDING_BALANCE",
                $"Đơn đặt phòng còn dư nợ chưa thanh toán ({remainingBalance:N0} đ). Vui lòng thu đủ thanh toán trước khi trả phòng.");
        }

        var room = reservation.Room;
        if (room == null)
        {
            await transaction.RollbackAsync(cancellationToken);
            throw new NotFoundException("Phòng tương ứng không tồn tại.");
        }

        // 5. Execute atomic state transitions: Reservation -> CheckedOut, Room -> Dirty
        reservation.Status = ReservationStatus.CheckedOut;
        room.Status = RoomStatus.Dirty;
        room.UpdatedAtUtc = DateTime.UtcNow;

        // Rule D: Earn points on checkout for registered guest members
        if (reservation.GuestUserId.HasValue && reservation.PointsEarned == 0)
        {
            var loyaltyMembership = await _context.GuestLoyaltyMemberships
                .FirstOrDefaultAsync(m => m.TenantId == tenantId.Value && m.UserId == reservation.GuestUserId.Value, cancellationToken);

            if (loyaltyMembership != null)
            {
                var earnRate = loyaltyMembership.Tier switch
                {
                    LoyaltyTier.Diamond => 0.06m,
                    LoyaltyTier.Gold => 0.04m,
                    _ => 0.02m
                };

                var earnedPoints = (int)Math.Floor(reservation.TotalAmount * earnRate / 1000m);
                if (earnedPoints < 1 && reservation.TotalAmount > 0)
                {
                    earnedPoints = 1;
                }

                loyaltyMembership.PointsBalance += earnedPoints;
                loyaltyMembership.LifetimePoints += earnedPoints;
                loyaltyMembership.CompletedStaysCount += 1;

                if (loyaltyMembership.CompletedStaysCount >= 15)
                {
                    loyaltyMembership.Tier = LoyaltyTier.Diamond;
                }
                else if (loyaltyMembership.CompletedStaysCount >= 5)
                {
                    loyaltyMembership.Tier = LoyaltyTier.Gold;
                }

                loyaltyMembership.UpdatedAtUtc = DateTime.UtcNow;

                var earnTx = new LoyaltyPointTransaction
                {
                    Id = Guid.NewGuid(),
                    MembershipId = loyaltyMembership.Id,
                    TenantId = tenantId.Value,
                    PropertyId = request.PropertyId,
                    ReservationId = reservation.Id,
                    TransactionType = LoyaltyPointTransactionType.EarnedOnCheckout,
                    PointsDelta = earnedPoints,
                    BalanceAfter = loyaltyMembership.PointsBalance,
                    Description = $"Cộng {earnedPoints} điểm thưởng tích lũy sau khi Check-out {reservation.ConfirmationCode} (Hạng {loyaltyMembership.Tier})",
                    CreatedAtUtc = DateTime.UtcNow
                };
                _context.LoyaltyPointTransactions.Add(earnTx);

                reservation.PointsEarned = earnedPoints;

                var invoice = await _context.Invoices
                    .FirstOrDefaultAsync(i => i.ReservationId == reservation.Id && i.TenantId == tenantId.Value, cancellationToken);
                if (invoice != null)
                {
                    invoice.PointsEarned = earnedPoints;
                    invoice.PointsRedeemed = reservation.PointsRedeemed;
                    invoice.PointsDiscountAmount = reservation.PointsDiscountAmount;
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return ReservationSnapshotHelper.MapToDetailDto(reservation, property);
    }
}
