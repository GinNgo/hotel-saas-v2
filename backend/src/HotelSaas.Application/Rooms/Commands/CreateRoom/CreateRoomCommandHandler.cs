using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Rooms.Commands.CreateRoom;

/// <summary>
/// Handles the creation of a new physical room with fail-closed security and mandatory membership resolution.
/// </summary>
public sealed class CreateRoomCommandHandler : IRequestHandler<CreateRoomCommand, RoomDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    /// <summary>
    /// Initializes a new instance of <see cref="CreateRoomCommandHandler"/>.
    /// </summary>
    /// <param name="context">Database context.</param>
    /// <param name="tenantService">Current tenant service.</param>
    /// <param name="propertyService">Current property service.</param>
    /// <param name="userContext">Current user context.</param>
    /// <param name="membershipLookupService">Membership lookup service.</param>
    public CreateRoomCommandHandler(
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
    public async Task<RoomDto> Handle(CreateRoomCommand request, CancellationToken cancellationToken)
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

        // 1. Validate Header vs Body directly if PropertyId was provided in request body
        if (_propertyService.HeaderPropertyId.HasValue && request.PropertyId.HasValue &&
            _propertyService.HeaderPropertyId.Value != request.PropertyId.Value)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh trong nội dung yêu cầu (body).");
        }

        // 2. Query RoomType with IgnoreQueryFilters to discover room type even across properties of tenant
        var roomType = await _context.RoomTypes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(rt => rt.TenantId == tenantId.Value && rt.Id == request.RoomTypeId, cancellationToken);

        if (roomType is null)
        {
            throw new NotFoundException("Loại phòng không tồn tại.");
        }

        var targetPropertyId = roomType.PropertyId;

        // 3. Validate Body PropertyId vs RoomType PropertyId
        if (request.PropertyId.HasValue && request.PropertyId.Value != targetPropertyId)
        {
            throw new ConflictException("ERR_PROPERTY_MISMATCH", "Phòng phải thuộc cùng chi nhánh với loại phòng được chọn.");
        }

        // 4. Validate Header PropertyId vs Target PropertyId
        if (_propertyService.HeaderPropertyId.HasValue &&
            _propertyService.HeaderPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh trong nội dung yêu cầu (body).");
        }

        // 5. Token check for property-scoped staff
        if (!_propertyService.IsTenantWide &&
            _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong nội dung yêu cầu không khớp với chi nhánh trong token xác thực.");
        }

        // 6. Mandatory Authoritative Membership Resolver Validation for target write (Fail-Closed)
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

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Id == targetPropertyId, cancellationToken);

        if (property is null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        if (property.TenantId != tenantId.Value)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chi nhánh không thuộc quyền quản lý của Tenant hiện tại.");
        }

        if (property.Status != PropertyStatus.Active)
        {
            throw new ConflictException("ERR_PROPERTY_INACTIVE", "Chi nhánh hiện không ở trạng thái hoạt động.");
        }

        var normalizedRoomNumber = request.RoomNumber.Trim();
        var roomNumberExists = await _context.Rooms
            .IgnoreQueryFilters()
            .AnyAsync(r => r.TenantId == tenantId.Value && r.PropertyId == targetPropertyId && r.RoomNumber == normalizedRoomNumber, cancellationToken);

        if (roomNumberExists)
        {
            throw new ConflictException("ERR_CONFLICT", "Số phòng đã tồn tại trong chi nhánh này.");
        }

        var room = new Room
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            PropertyId = targetPropertyId,
            RoomTypeId = request.RoomTypeId,
            RoomNumber = normalizedRoomNumber,
            Floor = request.Floor,
            Status = RoomStatus.Clean,
            Notes = request.Notes?.Trim(),
            IsActive = true
        };

        _context.Rooms.Add(room);
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
