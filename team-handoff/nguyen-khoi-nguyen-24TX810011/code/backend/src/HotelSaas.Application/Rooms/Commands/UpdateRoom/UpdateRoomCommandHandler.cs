using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Rooms.Commands.UpdateRoom;

/// <summary>
/// Handles updating an existing room with fail-closed security, branch uniqueness, and membership resolution.
/// </summary>
public sealed class UpdateRoomCommandHandler : IRequestHandler<UpdateRoomCommand, RoomDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    /// <summary>
    /// Initializes a new instance of <see cref="UpdateRoomCommandHandler"/>.
    /// </summary>
    public UpdateRoomCommandHandler(
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
    public async Task<RoomDto> Handle(UpdateRoomCommand request, CancellationToken cancellationToken)
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

        // 1. Direct header vs body check if PropertyId was provided in request body
        if (_propertyService.HeaderPropertyId.HasValue && request.PropertyId.HasValue &&
            _propertyService.HeaderPropertyId.Value != request.PropertyId.Value)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh trong nội dung yêu cầu (body).");
        }

        // 2. Discover room under tenant
        var room = await _context.Rooms
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(r => r.TenantId == tenantId.Value && r.Id == request.Id, cancellationToken);

        if (room is null)
        {
            throw new NotFoundException("Không tìm thấy phòng.");
        }

        var targetPropertyId = room.PropertyId;

        // 3. Immutable branch scope validation
        if (request.PropertyId.HasValue && request.PropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong body không khớp với chi nhánh của phòng.");
        }

        // 4. Header vs target property
        if (_propertyService.HeaderPropertyId.HasValue &&
            _propertyService.HeaderPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh của phòng.");
        }

        // 5. Token check for property-scoped staff
        if (!_propertyService.IsTenantWide &&
            _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh của phòng không khớp với chi nhánh trong token xác thực.");
        }

        // 6. Mandatory Authoritative Membership Resolver Validation for target property (Fail-Closed)
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

        // 7. Verify branch room number uniqueness
        var normalizedRoomNumber = request.RoomNumber.Trim();
        var roomNumberExists = await _context.Rooms
            .IgnoreQueryFilters()
            .AnyAsync(r => r.TenantId == tenantId.Value &&
                           r.PropertyId == targetPropertyId &&
                           r.RoomNumber == normalizedRoomNumber &&
                           r.Id != request.Id, cancellationToken);

        if (roomNumberExists)
        {
            throw new ConflictException("ERR_CONFLICT", "Số phòng đã tồn tại trong chi nhánh này.");
        }

        // 8. Verify RoomType exists and belongs to same tenant and branch
        var roomType = await _context.RoomTypes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(rt => rt.TenantId == tenantId.Value && rt.Id == request.RoomTypeId, cancellationToken);

        if (roomType is null)
        {
            throw new NotFoundException("Loại phòng không tồn tại.");
        }

        if (roomType.PropertyId != targetPropertyId)
        {
            throw new ConflictException("ERR_PROPERTY_MISMATCH", "Loại phòng mới phải thuộc cùng chi nhánh với phòng.");
        }

        // 9. Update room fields without altering room status
        room.RoomNumber = normalizedRoomNumber;
        room.RoomTypeId = request.RoomTypeId;
        room.Floor = request.Floor;
        room.Notes = request.Notes?.Trim();
        room.IsActive = request.IsActive;

        await _context.SaveChangesAsync(cancellationToken);

        return new RoomDto(
            room.Id,
            room.PropertyId,
            room.RoomNumber,
            room.Floor,
            room.Status.ToString(),
            room.Notes,
            room.IsActive,
            roomType.Id,
            roomType.Name,
            roomType.Code,
            roomType.BasePrice,
            room.CreatedAtUtc);
    }
}
