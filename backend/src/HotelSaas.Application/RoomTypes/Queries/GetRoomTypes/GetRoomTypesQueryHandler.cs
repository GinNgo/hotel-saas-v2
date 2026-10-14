using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.RoomTypes.Queries.GetRoomTypes;

/// <summary>
/// Handles the retrieval of a paginated list of room types.
/// </summary>
public sealed class GetRoomTypesQueryHandler : IRequestHandler<GetRoomTypesQuery, PagedResult<RoomTypeDto>>
{
    private readonly IApplicationDbContext _context;

    /// <summary>
    /// Initializes a new instance of <see cref="GetRoomTypesQueryHandler"/>.
    /// </summary>
    /// <param name="context">Database context.</param>
    public GetRoomTypesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<PagedResult<RoomTypeDto>> Handle(GetRoomTypesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.RoomTypes
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLower();
            query = query.Where(rt =>
                rt.Name.ToLower().Contains(search) ||
                rt.Code.ToLower().Contains(search));
        }

        if (request.PropertyId.HasValue)
        {
            query = query.Where(rt => rt.PropertyId == request.PropertyId.Value);
        }

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(rt => rt.Name)
            .ThenBy(rt => rt.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(rt => new RoomTypeDto(
                rt.Id,
                rt.PropertyId,
                rt.Name,
                rt.Code,
                rt.Description,
                rt.BasePrice,
                rt.MaxOccupancy,
                rt.BedType,
                rt.SquareMeters,
                rt.ImageUrl,
                rt.Rooms.Count,
                rt.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return new PagedResult<RoomTypeDto>(items, totalCount, page, pageSize);
    }
}
