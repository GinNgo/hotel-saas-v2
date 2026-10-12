using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Scoped implementation of <see cref="ICurrentUserContext"/>.
/// Stores verified user, tenant, property and staff context for the request lifecycle.
/// </summary>
public sealed class CurrentUserContext : ICurrentUserContext
{
    private readonly ICurrentTenantService _currentTenantService;
    private readonly ICurrentPropertyService _currentPropertyService;

    /// <summary>
    /// Initializes a new instance of <see cref="CurrentUserContext"/>.
    /// </summary>
    public CurrentUserContext(
        ICurrentTenantService currentTenantService,
        ICurrentPropertyService currentPropertyService)
    {
        _currentTenantService = currentTenantService;
        _currentPropertyService = currentPropertyService;
    }

    /// <inheritdoc />
    public Guid UserId { get; set; }

    /// <inheritdoc />
    public string Email { get; set; } = string.Empty;

    /// <inheritdoc />
    public GlobalUserRole GlobalRole { get; set; } = GlobalUserRole.Customer;

    /// <inheritdoc />
    public Guid? TenantId
    {
        get => _currentTenantService.TenantId;
        set => _currentTenantService.TenantId = value;
    }

    /// <inheritdoc />
    public TenantStatus? TenantStatus { get; set; }

    /// <inheritdoc />
    public Guid? PropertyId
    {
        get => _currentPropertyService.PropertyId;
        set => _currentPropertyService.PropertyId = value;
    }

    /// <inheritdoc />
    public PropertyStatus? PropertyStatus { get; set; }

    /// <inheritdoc />
    public StaffRole? StaffRole { get; set; }

    /// <inheritdoc />
    public Guid? RoleId { get; set; }

    /// <inheritdoc />
    public bool IsTenantWide
    {
        get => _currentPropertyService.IsTenantWide;
        set => _currentPropertyService.IsTenantWide = value;
    }

    /// <inheritdoc />
    public bool IsAuthenticated => UserId != Guid.Empty;

    /// <inheritdoc />
    public IReadOnlyList<Guid> ExcludedPropertyIds => _currentPropertyService.ExcludedPropertyIds;

    /// <inheritdoc />
    public void EnsureTenantContext()
    {
        if (!TenantId.HasValue || TenantId == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Không thể thực hiện thao tác khi thiếu Tenant context.");
        }

        if (TenantStatus.HasValue && TenantStatus.Value != Domain.Enums.TenantStatus.Active)
        {
            throw new ForbiddenException("ERR_TENANT_INACTIVE", "Doanh nghiệp hiện đang bị tạm ngưng hoạt động.");
        }
    }

    /// <inheritdoc />
    public void EnsurePropertyContext()
    {
        EnsureTenantContext();

        if (!IsTenantWide && (!PropertyId.HasValue || PropertyId == Guid.Empty))
        {
            throw new ForbiddenException("ERR_PROPERTY_REQUIRED", "Yêu cầu chỉ định chi nhánh hợp lệ để thực hiện thao tác này.");
        }

        if (PropertyId.HasValue && ExcludedPropertyIds.Contains(PropertyId.Value))
        {
            throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi.");
        }
    }

    /// <inheritdoc />
    public void SetUser(Guid userId, string email, GlobalUserRole globalRole)
    {
        UserId = userId;
        Email = email;
        GlobalRole = globalRole;
    }

    /// <inheritdoc />
    public void SetMembershipContext(
        Guid tenantId,
        TenantStatus tenantStatus,
        Guid? propertyId,
        PropertyStatus? propertyStatus,
        StaffRole? staffRole,
        Guid? roleId,
        bool isTenantWide)
    {
        TenantId = tenantId;
        TenantStatus = tenantStatus;
        PropertyId = propertyId;
        PropertyStatus = propertyStatus;
        StaffRole = staffRole;
        RoleId = roleId;
        IsTenantWide = isTenantWide;
    }
}
