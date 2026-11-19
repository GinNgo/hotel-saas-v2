using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Contracts.Common;
using HotelSaas.Application.Contracts.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Contracts.Queries.GetAdminContracts;

public sealed class GetAdminContractsQueryHandler : IRequestHandler<GetAdminContractsQuery, List<AdminContractSummaryDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminContractsQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<List<AdminContractSummaryDto>> Handle(GetAdminContractsQuery request, CancellationToken cancellationToken)
    {
        AdminContractHelper.EnsureSuperAdmin(_currentUser);

        var query = _context.TenantContracts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(c => c.Tenant)
            .AsQueryable();

        if (request.TenantId.HasValue && request.TenantId != Guid.Empty)
        {
            query = query.Where(c => c.TenantId == request.TenantId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Status) &&
            Enum.TryParse<TenantContractStatus>(request.Status, true, out var parsedStatus) &&
            Enum.IsDefined(typeof(TenantContractStatus), parsedStatus))
        {
            query = query.Where(c => c.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim().ToLower();
            query = query.Where(c =>
                c.ContractNumber.ToLower().Contains(s) ||
                c.RepresentativeName.ToLower().Contains(s) ||
                c.RepresentativeEmail.ToLower().Contains(s) ||
                (c.Tenant != null && c.Tenant.Name.ToLower().Contains(s)));
        }

        var contracts = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return contracts.Select(AdminContractHelper.ToSummaryDto).ToList();
    }
}
