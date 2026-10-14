using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Rooms.Commands.DeleteRoom;

/// <summary>
/// Handles the deletion or soft-deactivation of a room with active booking checks and membership resolution.
/// </summary>
public sealed class DeleteRoomCommandHandler : IRequestHandler<DeleteRoomCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    /// <summary>
    /// Initializes a new instance of <see cref="DeleteRoomCommandHandler"/>.
    /// </summary>
    public DeleteRoomCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
    }

    /// <inheritdoc />
    public async Task<bool> Handle(DeleteRoomCommand request, CancellationToken cancellationToken)
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

        // 1. Discover room under tenant
        var room = await _context.Rooms
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId.Value && r.Id == request.Id, cancellationToken);

        if (room is null)
        {
            throw new NotFoundException("Không tìm thấy phòng.");
        }

        var targetPropertyId = room.PropertyId;

        // 2. Header vs target property
        if (_propertyService.HeaderPropertyId.HasValue &&
            _propertyService.HeaderPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh của phòng.");
        }

        // 3. Token check for property-scoped staff
        if (!_propertyService.IsTenantWide &&
            _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh của phòng không khớp với chi nhánh trong token xác thực.");
        }

        // 4. Mandatory Authoritative Membership Resolver Validation for target property (Fail-Closed)
        var membership = await _membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            targetPropertyId,
            cancellationToken);

        switch (membership.Status)
        {
            case MembershipLookupStatus.MembershipRevoked:
                throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED",
                    membership.ErrorMessage ?? "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi.");

            case MembershipLookupStatus.PropertyNotFound:
                throw new NotFoundException(membership.ErrorMessage ?? "Chi nhánh không tồn tại.");

            case MembershipLookupStatus.PropertyInactive:
                throw new ConflictException("ERR_PROPERTY_INACTIVE",
                    membership.ErrorMessage ?? "Chi nhánh hiện không ở trạng thái hoạt động.");

            case MembershipLookupStatus.PropertyForbidden:
                throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN",
                    membership.ErrorMessage ?? "Bạn không có quyền truy cập vào chi nhánh này.");

            case MembershipLookupStatus.TenantNotFoundOrInactive:
                throw new ForbiddenException("ERR_TENANT_INACTIVE",
                    membership.ErrorMessage ?? "Doanh nghiệp hiện đang bị tạm ngưng hoạt động.");

            case MembershipLookupStatus.UserNotFoundOrInactive:
                throw new UnauthorizedAccessException("ERR_USER_DEACTIVATED: " + (membership.ErrorMessage ?? "Tài khoản người dùng đã bị vô hiệu hóa."));

            case MembershipLookupStatus.PropertyRequired:
                throw new ForbiddenException("ERR_PROPERTY_REQUIRED",
                    membership.ErrorMessage ?? "Yêu cầu chọn chi nhánh làm việc để tiếp tục.");

            case MembershipLookupStatus.Success:
                break;

            default:
                throw new ForbiddenException("ERR_FORBIDDEN",
                    membership.ErrorMessage ?? "Không có quyền thực hiện thao tác trên chi nhánh này.");
        }

        // 5. Active reservations check (Confirmed, CheckedIn, PendingPayment) -> Prohibit deletion
        var hasActiveReservations = await _context.Reservations
            .IgnoreQueryFilters()
            .AnyAsync(r => r.TenantId == tenantId.Value &&
                           r.PropertyId == targetPropertyId &&
                           r.RoomId == request.Id &&
                           (r.Status == ReservationStatus.Confirmed ||
                            r.Status == ReservationStatus.CheckedIn ||
                            r.Status == ReservationStatus.PendingPayment),
                      cancellationToken);

        if (hasActiveReservations)
        {
            throw new ConflictException("ERR_ROOM_HAS_ACTIVE_BOOKINGS",
                "Không thể xóa phòng đang có đặt phòng đang hoạt động.");
        }

        // 6. Check historical reservations (CheckedOut, Cancelled, NoShow)
        var hasHistoricalReservations = await _context.Reservations
            .IgnoreQueryFilters()
            .AnyAsync(r => r.TenantId == tenantId.Value &&
                           r.PropertyId == targetPropertyId &&
                           r.RoomId == request.Id,
                      cancellationToken);

        if (hasHistoricalReservations)
        {
            // Soft delete to protect relational FK constraints and accounting history
            room.IsActive = false;
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        // 7. No reservations at all -> Hard delete
        _context.Rooms.Remove(room);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}
