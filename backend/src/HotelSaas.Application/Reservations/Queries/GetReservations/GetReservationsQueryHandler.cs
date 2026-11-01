using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reservations.Queries.GetReservations;

public sealed class GetReservationsQueryHandler : IRequestHandler<GetReservationsQuery, PagedResult<ReservationDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService? _propertyService;

    public GetReservationsQueryHandler(
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

    public async Task<PagedResult<ReservationDto>> Handle(GetReservationsQuery request, CancellationToken cancellationToken)
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

        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId.Value, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        var query = _context.Reservations
            .AsNoTracking()
            .Include(r => r.Room)
                .ThenInclude(room => room!.RoomType)
            .Where(r => r.TenantId == tenantId.Value && r.PropertyId == request.PropertyId);

        if (request.Status.HasValue)
        {
            query = query.Where(r => r.Status == request.Status.Value);
        }

        if (request.DateFrom.HasValue)
        {
            query = query.Where(r => r.CheckOutDate >= request.DateFrom.Value);
        }

        if (request.DateTo.HasValue)
        {
            query = query.Where(r => r.CheckInDate <= request.DateTo.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLower();
            query = query.Where(r =>
                r.GuestName.ToLower().Contains(search) ||
                (r.GuestPhone != null && r.GuestPhone.ToLower().Contains(search)) ||
                r.ConfirmationCode.ToLower().Contains(search) ||
                (r.Room != null && r.Room.RoomNumber.ToLower().Contains(search)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 20 : (request.PageSize > 100 ? 100 : request.PageSize);

        var items = await query
            .OrderByDescending(r => r.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(r =>
        {
            var snapshot = ReservationSnapshotHelper.TryDeserialize(r.Notes);
            var (startUtc, endUtc) = ReservationTimeHelper.GetEffectiveStayUtcInterval(r, property);
            var rentalType = snapshot?.RentalType ?? RentalType.Overnight;

            return new ReservationDto
            {
                Id = r.Id,
                TenantId = r.TenantId,
                PropertyId = r.PropertyId,
                RoomId = r.RoomId,
                RoomNumber = r.Room?.RoomNumber ?? string.Empty,
                RoomTypeId = r.Room?.RoomTypeId ?? Guid.Empty,
                RoomTypeName = r.Room?.RoomType?.Name ?? snapshot?.RoomTypeName ?? string.Empty,
                RentalType = rentalType,
                StartAtUtc = startUtc,
                EndAtUtc = endUtc,
                CheckInDate = r.CheckInDate,
                CheckOutDate = r.CheckOutDate,
                GuestName = r.GuestName,
                GuestEmail = r.GuestEmail,
                GuestPhone = r.GuestPhone,
                NumberOfGuests = r.NumberOfGuests,
                TotalAmount = r.TotalAmount,
                Currency = snapshot?.Currency ?? "VND",
                Status = r.Status,
                ConfirmationCode = r.ConfirmationCode,
                Notes = snapshot?.CustomerNotes ?? r.Notes,
                HoldExpiresAtUtc = snapshot?.IsOnlineHold == true ? snapshot.HoldExpiresAtUtc : null,
                HoldExtensionCount = snapshot?.HoldExtensionCount ?? 0,
                IsHoldExpired = r.Status == ReservationStatus.PendingPayment && snapshot?.IsOnlineHold == true && snapshot.HoldExpiresAtUtc.HasValue && snapshot.HoldExpiresAtUtc.Value <= DateTime.UtcNow,
                CreatedAtUtc = r.CreatedAtUtc
            };
        }).ToList();

        return new PagedResult<ReservationDto>(dtos, totalCount, page, pageSize);
    }
}
