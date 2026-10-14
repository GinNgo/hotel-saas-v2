using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Properties.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Properties.Queries.GetPropertyPolicies;

/// <summary>
/// Handler for retrieving branch operational policies with fail-closed membership validation.
/// </summary>
public sealed class GetPropertyPoliciesQueryHandler : IRequestHandler<GetPropertyPoliciesQuery, PropertyPoliciesDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    public GetPropertyPoliciesQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
    }

    public async Task<PropertyPoliciesDto> Handle(GetPropertyPoliciesQuery request, CancellationToken cancellationToken)
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

        var membership = await _membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            request.PropertyId,
            cancellationToken);

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
        }

        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId.Value, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        var surcharges = await _context.PropertySurchargePolicies
            .AsNoTracking()
            .Where(sp => sp.PropertyId == request.PropertyId && sp.TenantId == tenantId.Value)
            .OrderBy(sp => sp.SurchargeType)
            .ThenBy(sp => sp.FromTime)
            .Select(sp => new SurchargePolicyDto
            {
                Id = sp.Id,
                SurchargeType = sp.SurchargeType,
                FromTime = sp.FromTime,
                ToTime = sp.ToTime,
                CalculationMethod = sp.CalculationMethod,
                Percentage = sp.Percentage,
                FlatAmount = sp.FlatAmount,
                IsActive = sp.IsActive
            })
            .ToListAsync(cancellationToken);

        return new PropertyPoliciesDto
        {
            PropertyId = property.Id,
            CheckInTime = property.CheckInTime,
            CheckOutTime = property.CheckOutTime,
            BufferMinutes = property.BufferMinutes,
            MaxHourlyHours = property.MaxHourlyHours,
            Surcharges = surcharges
        };
    }
}
