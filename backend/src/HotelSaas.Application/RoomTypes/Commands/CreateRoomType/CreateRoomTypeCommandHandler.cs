using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.RoomTypes.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.RoomTypes.Commands.CreateRoomType;

/// <summary>
/// Handles the creation of a new room type with fail-closed security and mandatory membership resolution.
/// </summary>
public sealed class CreateRoomTypeCommandHandler : IRequestHandler<CreateRoomTypeCommand, RoomTypeDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    /// <summary>
    /// Initializes a new instance of <see cref="CreateRoomTypeCommandHandler"/>.
    /// </summary>
    /// <param name="context">Database context.</param>
    /// <param name="tenantService">Current tenant service.</param>
    /// <param name="propertyService">Current property service.</param>
    /// <param name="userContext">Current user context.</param>
    /// <param name="membershipLookupService">Membership lookup service.</param>
    public CreateRoomTypeCommandHandler(
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
    public async Task<RoomTypeDto> Handle(CreateRoomTypeCommand request, CancellationToken cancellationToken)
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

        // 1. Unification check between Header and Body before mutation
        if (_propertyService.HeaderPropertyId.HasValue && request.PropertyId.HasValue &&
            _propertyService.HeaderPropertyId.Value != request.PropertyId.Value)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh trong nội dung yêu cầu (body).");
        }

        Guid targetPropertyId;
        if (request.PropertyId.HasValue)
        {
            targetPropertyId = request.PropertyId.Value;
        }
        else if (_propertyService.HeaderPropertyId.HasValue)
        {
            targetPropertyId = _propertyService.HeaderPropertyId.Value;
        }
        else
        {
            // Backward-compatibility resolution:
            // Only infer when tenant has exactly 1 property total, AND that single property is Active.
            // If tenant has multiple properties (even if only 1 is active), do NOT infer!
            var tenantProperties = await _context.Properties
                .Where(p => p.TenantId == tenantId.Value)
                .ToListAsync(cancellationToken);

            if (tenantProperties.Count == 0)
            {
                throw new ConflictException("ERR_PROPERTY_REQUIRED", "Tenant chưa có chi nhánh nào được cấu hình.");
            }

            if (tenantProperties.Count > 1)
            {
                throw new ConflictException("ERR_PROPERTY_REQUIRED", "Tenant có nhiều chi nhánh. Bắt buộc phải chỉ định PropertyId cụ thể.");
            }

            var singleProperty = tenantProperties[0];
            if (singleProperty.Status != PropertyStatus.Active)
            {
                throw new ConflictException("ERR_PROPERTY_INACTIVE", "Chi nhánh duy nhất của Tenant hiện không ở trạng thái hoạt động.");
            }

            targetPropertyId = singleProperty.Id;
        }

        // Token check for property-scoped staff
        if (!_propertyService.IsTenantWide &&
            _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != targetPropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong nội dung yêu cầu không khớp với chi nhánh trong token xác thực.");
        }

        // 2. Mandatory Authoritative Membership Resolver Validation for target write (Fail-Closed)
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

        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var codeExists = await _context.RoomTypes
            .IgnoreQueryFilters()
            .AnyAsync(rt => rt.TenantId == tenantId.Value && rt.PropertyId == targetPropertyId && rt.Code == normalizedCode, cancellationToken);

        if (codeExists)
        {
            throw new ConflictException("ERR_CONFLICT", "Mã loại phòng đã tồn tại trong chi nhánh này.");
        }

        var roomType = new RoomType
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            PropertyId = targetPropertyId,
            Name = request.Name.Trim(),
            Code = normalizedCode,
            Description = request.Description?.Trim(),
            BasePrice = request.BasePrice,
            MaxOccupancy = request.MaxOccupancy,
            BedType = request.BedType?.Trim(),
            SquareMeters = request.SquareMeters,
            ImageUrl = request.ImageUrl?.Trim()
        };

        _context.RoomTypes.Add(roomType);
        await _context.SaveChangesAsync(cancellationToken);

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
            RoomCount: 0,
            roomType.CreatedAtUtc);
    }
}
