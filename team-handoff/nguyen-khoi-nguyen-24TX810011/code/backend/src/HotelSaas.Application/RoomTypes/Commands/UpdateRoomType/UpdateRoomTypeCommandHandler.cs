using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.RoomTypes.Commands.UpdateRoomType;

/// <summary>
/// Handles updating an existing room type with fail-closed security, branch uniqueness, and membership resolution.
/// </summary>
public sealed class UpdateRoomTypeCommandHandler : IRequestHandler<UpdateRoomTypeCommand, RoomTypeDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    /// <summary>
    /// Initializes a new instance of <see cref="UpdateRoomTypeCommandHandler"/>.
    /// </summary>
    public UpdateRoomTypeCommandHandler(
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
    public async Task<RoomTypeDto> Handle(UpdateRoomTypeCommand request, CancellationToken cancellationToken)
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

        // 2. Discover room type under tenant
        var roomType = await _context.RoomTypes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(rt => rt.TenantId == tenantId.Value && rt.Id == request.Id, cancellationToken);

        if (roomType is null)
        {
            throw new NotFoundException("Không tìm thấy loại phòng.");
        }

        var targetPropertyId = roomType.PropertyId;

        // 3. Immutable branch scope validation
        if (request.PropertyId.HasValue && request.PropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong body không khớp với chi nhánh của loại phòng.");
        }

        // 4. Header vs target property
        if (_propertyService.HeaderPropertyId.HasValue &&
            _propertyService.HeaderPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh của loại phòng.");
        }

        // 5. Token check for property-scoped staff
        if (!_propertyService.IsTenantWide &&
            _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh của loại phòng không khớp với chi nhánh trong token xác thực.");
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

        // 7. Verify branch Code uniqueness
        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var codeExists = await _context.RoomTypes
            .IgnoreQueryFilters()
            .AnyAsync(rt => rt.TenantId == tenantId.Value &&
                            rt.PropertyId == targetPropertyId &&
                            rt.Code == normalizedCode &&
                            rt.Id != request.Id, cancellationToken);

        if (codeExists)
        {
            throw new ConflictException("ERR_CONFLICT", "Mã loại phòng đã tồn tại trong chi nhánh này.");
        }

        // 8. Update room type fields
        roomType.Name = request.Name.Trim();
        roomType.Code = normalizedCode;
        roomType.Description = request.Description?.Trim();
        roomType.BasePrice = request.BasePrice;
        roomType.MaxOccupancy = request.MaxOccupancy;
        roomType.BedType = request.BedType?.Trim();
        roomType.SquareMeters = request.SquareMeters;
        roomType.ImageUrl = request.ImageUrl?.Trim();

        await _context.SaveChangesAsync(cancellationToken);

        var roomCount = await _context.Rooms
            .IgnoreQueryFilters()
            .CountAsync(r => r.TenantId == tenantId.Value &&
                             r.PropertyId == targetPropertyId &&
                             r.RoomTypeId == roomType.Id, cancellationToken);

        return new RoomTypeDto(
            roomType.Id,
            roomType.PropertyId,
            roomType.Name,
            roomType.Code,
            roomType.Description,
            roomType.BasePrice,
            roomType.MaxOccupancy,
            roomType.BedType,
            roomType.SquareMeters,
            roomType.ImageUrl,
            roomCount,
            roomType.CreatedAtUtc);
    }
}
