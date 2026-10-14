using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Reservations.DTOs;
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

    public GetFolioQueryHandler(
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

        var remainingBalance = reservation.TotalAmount - paidAmount;
        var isFullyPaid = remainingBalance <= 0;

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
            payments
        );
    }
}
