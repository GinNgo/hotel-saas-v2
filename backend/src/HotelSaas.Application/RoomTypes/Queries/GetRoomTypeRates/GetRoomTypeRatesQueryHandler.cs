using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.RoomTypes.Queries.GetRoomTypeRates;

/// <summary>
/// Handler for retrieving active room type pricing rates.
/// </summary>
public sealed class GetRoomTypeRatesQueryHandler : IRequestHandler<GetRoomTypeRatesQuery, IReadOnlyList<RoomTypeRateDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    public GetRoomTypeRatesQueryHandler(
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

    public async Task<IReadOnlyList<RoomTypeRateDto>> Handle(GetRoomTypeRatesQuery request, CancellationToken cancellationToken)
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

        var roomType = await _context.RoomTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(rt => rt.Id == request.RoomTypeId && rt.TenantId == tenantId.Value, cancellationToken);

        if (roomType == null)
        {
            throw new NotFoundException("Loại phòng không tồn tại.");
        }

        var targetPropertyId = request.PropertyId ?? roomType.PropertyId;
        if (targetPropertyId != roomType.PropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH", "Loại phòng không thuộc chi nhánh được yêu cầu.");
        }

        var membership = await _membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            targetPropertyId,
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

        var rates = await _context.RoomTypeRates
            .AsNoTracking()
            .Where(r => r.RoomTypeId == request.RoomTypeId && r.PropertyId == targetPropertyId && r.TenantId == tenantId.Value && r.IsActive)
            .OrderBy(r => r.EffectiveFrom)
            .Select(r => new RoomTypeRateDto
            {
                Id = r.Id,
                PropertyId = r.PropertyId,
                RoomTypeId = r.RoomTypeId,
                FirstHours = r.FirstHours,
                FirstHoursPrice = r.FirstHoursPrice,
                AdditionalHourPrice = r.AdditionalHourPrice,
                NightlyPrice = r.NightlyPrice,
                Currency = r.Currency,
                EffectiveFrom = r.EffectiveFrom,
                EffectiveTo = r.EffectiveTo,
                ChangeReason = r.ChangeReason,
                IsActive = r.IsActive,
                CreatedAtUtc = r.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        return rates;
    }
}
