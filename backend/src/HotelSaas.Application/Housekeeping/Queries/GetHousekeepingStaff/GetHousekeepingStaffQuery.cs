using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Housekeeping.Common;
using HotelSaas.Application.Housekeeping.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Housekeeping.Queries.GetHousekeepingStaff;

public sealed record GetHousekeepingStaffQuery(Guid PropertyId) : IRequest<IReadOnlyList<HousekeepingStaffOptionDto>>;

public sealed class GetHousekeepingStaffQueryValidator : AbstractValidator<GetHousekeepingStaffQuery>
{
    public GetHousekeepingStaffQueryValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh (PropertyId) là bắt buộc.");
    }
}

public sealed class GetHousekeepingStaffQueryHandler : IRequestHandler<GetHousekeepingStaffQuery, IReadOnlyList<HousekeepingStaffOptionDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly ICurrentPropertyService _propertyService;
    private readonly IMembershipLookupService _membershipLookupService;

    public GetHousekeepingStaffQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        ICurrentPropertyService propertyService,
        IMembershipLookupService membershipLookupService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
    }

    public async Task<IReadOnlyList<HousekeepingStaffOptionDto>> Handle(GetHousekeepingStaffQuery request, CancellationToken cancellationToken)
    {
        var (tenantId, _, _) = await HousekeepingAccessHelper.ValidatePropertyAccessAsync(
            _tenantService, _userContext, _propertyService, _membershipLookupService,
            request.PropertyId, cancellationToken);

        var staffRows = await _context.TenantStaffMembers
            .AsNoTracking()
            .Where(ts => ts.TenantId == tenantId &&
                         ts.IsActive &&
                         (ts.PropertyId == null || ts.PropertyId == request.PropertyId))
            .Select(ts => new { ts.UserId, ts.StaffRole })
            .ToListAsync(cancellationToken);

        if (staffRows.Count == 0)
        {
            return Array.Empty<HousekeepingStaffOptionDto>();
        }

        var distinctStaff = staffRows
            .GroupBy(x => x.UserId)
            .Select(g => g.First())
            .ToList();

        var userIds = distinctStaff.Select(s => s.UserId).ToList();
        var activeUsers = await _context.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id) && u.IsActive)
            .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);

        return distinctStaff
            .Where(s => activeUsers.ContainsKey(s.UserId))
            .Select(s => new HousekeepingStaffOptionDto
            {
                UserId = s.UserId,
                FullName = activeUsers[s.UserId],
                StaffRole = s.StaffRole
            })
            .OrderBy(s => s.StaffRole == Domain.Enums.StaffRole.Housekeeper ? 0 : 1)
            .ThenBy(s => s.FullName)
            .ToList();
    }
}
