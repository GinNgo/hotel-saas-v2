using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Properties.DTOs;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Properties.Commands.UpdatePropertyPolicies;

/// <summary>
/// Command handler for updating branch operational policies and surcharges.
/// Strictly enforces fail-closed membership authorization and cross-scope partitioning.
/// </summary>
public sealed class UpdatePropertyPoliciesCommandHandler : IRequestHandler<UpdatePropertyPoliciesCommand, PropertyPoliciesDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    public UpdatePropertyPoliciesCommandHandler(
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

    public async Task<PropertyPoliciesDto> Handle(UpdatePropertyPoliciesCommand request, CancellationToken cancellationToken)
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

        // Header check
        if (_propertyService.HeaderPropertyId.HasValue && _propertyService.HeaderPropertyId.Value != request.PropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh trong nội dung yêu cầu.");
        }

        // Token check for property-scoped staff
        if (!_propertyService.IsTenantWide &&
            _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != request.PropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong nội dung yêu cầu không khớp với chi nhánh trong token xác thực.");
        }

        // Authoritative membership validation
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
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId.Value, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        if (request.CheckInTime.HasValue)
            property.CheckInTime = request.CheckInTime.Value;

        if (request.CheckOutTime.HasValue)
            property.CheckOutTime = request.CheckOutTime.Value;

        if (request.BufferMinutes.HasValue)
            property.BufferMinutes = request.BufferMinutes.Value;

        if (request.MaxHourlyHours.HasValue)
            property.MaxHourlyHours = request.MaxHourlyHours.Value;

        if (request.Surcharges != null)
        {
            var existingPolicies = await _context.PropertySurchargePolicies
                .Where(sp => sp.PropertyId == request.PropertyId && sp.TenantId == tenantId.Value)
                .ToListAsync(cancellationToken);

            var requestedIds = request.Surcharges
                .Where(s => s.Id.HasValue)
                .Select(s => s.Id!.Value)
                .ToHashSet();

            // Deactivate any existing policies not present in request
            foreach (var ep in existingPolicies)
            {
                if (!requestedIds.Contains(ep.Id))
                {
                    ep.IsActive = false;
                }
            }

            foreach (var s in request.Surcharges)
            {
                if (s.Id.HasValue)
                {
                    var existing = existingPolicies.FirstOrDefault(ep => ep.Id == s.Id.Value);
                    if (existing != null)
                    {
                        existing.SurchargeType = s.SurchargeType;
                        existing.FromTime = s.FromTime;
                        existing.ToTime = s.ToTime;
                        existing.CalculationMethod = s.CalculationMethod;
                        existing.Percentage = s.Percentage;
                        existing.FlatAmount = s.FlatAmount;
                        existing.IsActive = s.IsActive;
                    }
                }
                else
                {
                    var newPolicy = new PropertySurchargePolicy
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId.Value,
                        PropertyId = request.PropertyId,
                        SurchargeType = s.SurchargeType,
                        FromTime = s.FromTime,
                        ToTime = s.ToTime,
                        CalculationMethod = s.CalculationMethod,
                        Percentage = s.Percentage,
                        FlatAmount = s.FlatAmount,
                        IsActive = s.IsActive
                    };
                    _context.PropertySurchargePolicies.Add(newPolicy);
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        var activeSurcharges = await _context.PropertySurchargePolicies
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
            Surcharges = activeSurcharges
        };
    }
}
