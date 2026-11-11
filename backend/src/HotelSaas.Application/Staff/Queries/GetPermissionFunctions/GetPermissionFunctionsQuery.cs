using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Staff.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Staff.Queries.GetPermissionFunctions;

public sealed record GetPermissionFunctionsQuery : IRequest<IReadOnlyList<PermissionFunctionDto>>;

public sealed class GetPermissionFunctionsQueryHandler : IRequestHandler<GetPermissionFunctionsQuery, IReadOnlyList<PermissionFunctionDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPermissionFunctionsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PermissionFunctionDto>> Handle(
        GetPermissionFunctionsQuery request,
        CancellationToken cancellationToken)
    {
        var functions = await _context.PermissionFunctions
            .AsNoTracking()
            .Where(f => f.IsActive)
            .OrderBy(f => f.ModuleCode)
            .ThenBy(f => f.Name)
            .Select(f => new PermissionFunctionDto
            {
                Id = f.Id,
                Code = f.Code,
                Name = f.Name,
                ModuleCode = f.ModuleCode,
                SupportedActionMask = f.SupportedActionMask
            })
            .ToListAsync(cancellationToken);

        return functions;
    }
}
