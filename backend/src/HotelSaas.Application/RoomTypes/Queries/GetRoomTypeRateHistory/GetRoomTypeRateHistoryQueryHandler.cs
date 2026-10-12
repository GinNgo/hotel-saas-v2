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

namespace HotelSaas.Application.RoomTypes.Queries.GetRoomTypeRateHistory;

/// <summary>
/// Handler for retrieving rate audit history.
/// </summary>
public sealed class GetRoomTypeRateHistoryQueryHandler : IRequestHandler<GetRoomTypeRateHistoryQuery, IReadOnlyList<RoomTypeRateAuditDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    public GetRoomTypeRateHistoryQueryHandler(
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

    public async Task<IReadOnlyList<RoomTypeRateAuditDto>> Handle(GetRoomTypeRateHistoryQuery request, CancellationToken cancellationToken)
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

        var audits = await _context.RoomTypeRateAudits
            .AsNoTracking()
            .Where(a => a.RoomTypeId == request.RoomTypeId && a.PropertyId == targetPropertyId && a.TenantId == tenantId.Value)
            .OrderByDescending(a => a.ChangedAtUtc)
            .Select(a => new RoomTypeRateAuditDto
            {
                Id = a.Id,
                PropertyId = a.PropertyId,
                RoomTypeId = a.RoomTypeId,
                RateId = a.RateId,
                OldEffectiveFrom = a.OldEffectiveFrom,
                OldEffectiveTo = a.OldEffectiveTo,
                OldNightlyPrice = a.OldNightlyPrice,
                NewEffectiveFrom = a.NewEffectiveFrom,
                NewEffectiveTo = a.NewEffectiveTo,
                NewNightlyPrice = a.NewNightlyPrice,
                ActionType = a.ActionType,
                ChangedByUserId = a.ChangedByUserId,
                ChangedAtUtc = a.ChangedAtUtc,
                ChangeReason = a.ChangeReason
            })
            .ToListAsync(cancellationToken);

        return audits;
    }
}
