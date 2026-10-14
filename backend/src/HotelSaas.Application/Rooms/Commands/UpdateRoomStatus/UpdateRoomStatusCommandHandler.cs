using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.DTOs;
using HotelSaas.Application.Rooms.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Rooms.Commands.UpdateRoomStatus;

/// <summary>
/// Handles updating the status of a room with atomic raw SQL optimistic concurrency and transition validation.
/// </summary>
public sealed class UpdateRoomStatusCommandHandler : IRequestHandler<UpdateRoomStatusCommand, RoomDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    /// <summary>
    /// Initializes a new instance of <see cref="UpdateRoomStatusCommandHandler"/>.
    /// </summary>
    public UpdateRoomStatusCommandHandler(
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
    public async Task<RoomDto> Handle(UpdateRoomStatusCommand request, CancellationToken cancellationToken)
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

        // 1. Load room with IgnoreQueryFilters to safely discover target property under the tenant
        var room = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.RoomType)
            .FirstOrDefaultAsync(r => r.TenantId == tenantId.Value && r.Id == request.Id, cancellationToken);

        if (room is null)
        {
            throw new NotFoundException("Không tìm thấy phòng.");
        }

        var targetPropertyId = room.PropertyId;

        // 2. Validate header vs target property
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

        // 5. Check expected old status: MUST be provided, no fallback to DB state
        if (!request.ExpectedOldStatus.HasValue)
        {
            throw new BadRequestException("ERR_VALIDATION", "Trạng thái mong đợi cũ (ExpectedOldStatus) là bắt buộc.");
        }

        var expectedOldStatus = request.ExpectedOldStatus.Value;

        if (expectedOldStatus != room.Status)
        {
            throw new ConflictException("ERR_STALE_STATE",
                "Trạng thái phòng đã thay đổi trước đó. Vui lòng làm mới trang.");
        }

        // 6. Validate state machine transition matrix
        RoomStatusTransitionValidator.Validate(expectedOldStatus, request.Status);

        // 7. Atomic update using raw SQL bound to TenantId, PropertyId, and ExpectedOldStatus
        var nowUtc = DateTime.UtcNow;
        var rowsAffected = await _context.UpdateRoomStatusAtomicAsync(
            room.Id,
            tenantId.Value,
            targetPropertyId,
            expectedOldStatus,
            request.Status,
            nowUtc,
            cancellationToken);

        if (rowsAffected == 0)
        {
            var freshRoom = await _context.Rooms
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(r => r.TenantId == tenantId.Value && r.PropertyId == targetPropertyId && r.Id == room.Id, cancellationToken);

            if (freshRoom is null)
            {
                throw new NotFoundException("Không tìm thấy phòng.");
            }

            throw new ConflictException("ERR_STALE_STATE",
                "Trạng thái phòng đã thay đổi trước đó bởi người dùng khác. Vui lòng làm mới trang.");
        }

        return new RoomDto(
            room.Id,
            room.PropertyId,
            room.RoomNumber,
            room.Floor,
            request.Status.ToString(),
            room.Notes,
            room.IsActive,
            room.RoomTypeId,
            room.RoomType?.Name ?? string.Empty,
            room.RoomType?.Code ?? string.Empty,
            room.RoomType?.BasePrice ?? 0m,
            room.CreatedAtUtc);
    }
}
