using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Contracts.Common;
using HotelSaas.Application.Contracts.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Contracts.Queries.GetAdminContractById;

public sealed class GetAdminContractByIdQueryHandler : IRequestHandler<GetAdminContractByIdQuery, AdminContractDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminContractByIdQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<AdminContractDetailDto> Handle(GetAdminContractByIdQuery request, CancellationToken cancellationToken)
    {
        AdminContractHelper.EnsureSuperAdmin(_currentUser);

        var contract = await _context.TenantContracts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(c => c.Tenant)
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        if (contract == null)
        {
            throw new NotFoundException("Không tìm thấy hợp đồng.");
        }

        var propertiesCount = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(p => p.TenantId == contract.TenantId, cancellationToken);

        var roomsCount = await _context.Rooms
            .IgnoreQueryFilters()
            .AsNoTracking()
            .CountAsync(r => r.TenantId == contract.TenantId, cancellationToken);

        return AdminContractHelper.ToDetailDto(
            contract,
            contract.Tenant?.Name ?? "Đối tác",
            contract.Tenant?.Code ?? string.Empty,
            propertiesCount,
            roomsCount);
    }
}
