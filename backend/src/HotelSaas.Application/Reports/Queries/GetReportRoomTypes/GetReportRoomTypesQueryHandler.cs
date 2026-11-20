using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reports.Common;
using HotelSaas.Application.Reports.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reports.Queries.GetReportRoomTypes;

public sealed class GetReportRoomTypesQueryHandler : IRequestHandler<GetReportRoomTypesQuery, List<ReportRoomTypeItemDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetReportRoomTypesQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<List<ReportRoomTypeItemDto>> Handle(GetReportRoomTypesQuery request, CancellationToken cancellationToken)
    {
        var tenantId = ReportScopeHelper.EnsureTenantId(_currentUser);
        var effectivePropertyId = ReportScopeHelper.ResolveScopedPropertyId(_currentUser, request.PropertyId);

        var query = _context.RoomTypes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(type => type.TenantId == tenantId);

        if (effectivePropertyId.HasValue)
        {
            query = query.Where(type => type.PropertyId == effectivePropertyId.Value);
        }

        return await query
            .OrderBy(type => type.Name)
            .Select(type => new ReportRoomTypeItemDto(type.Id, type.Name))
            .ToListAsync(cancellationToken);
    }
}
