using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Rooms.Queries.GetRooms;

/// <summary>
/// Handles the retrieval of a paginated list of rooms with optional filters.
/// </summary>
public sealed class GetRoomsQueryHandler : IRequestHandler<GetRoomsQuery, PagedResult<RoomDto>>
{
    private readonly IApplicationDbContext _context;

    /// <summary>
    /// Initializes a new instance of <see cref="GetRoomsQueryHandler"/>.
    /// </summary>
    /// <param name="context">Database context.</param>
    public GetRoomsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<PagedResult<RoomDto>> Handle(GetRoomsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Rooms
            .AsNoTracking()
            .Include(r => r.RoomType)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLower();
            query = query.Where(r => r.RoomNumber.ToLower().Contains(search));
        }

        if (request.PropertyId.HasValue)
        {
            query = query.Where(r => r.PropertyId == request.PropertyId.Value);
        }

        if (request.RoomTypeId.HasValue)
        {
            query = query.Where(r => r.RoomTypeId == request.RoomTypeId.Value);
        }

        if (request.Status.HasValue)
        {
            query = query.Where(r => r.Status == request.Status.Value);
        }

        if (request.Floor.HasValue)
        {
            query = query.Where(r => r.Floor == request.Floor.Value);
        }

        if (request.IsActive.HasValue)
        {
            query = query.Where(r => r.IsActive == request.IsActive.Value);
        }

        if (request.CreatedFromUtc.HasValue)
        {
            var fromUtc = DateTime.SpecifyKind(request.CreatedFromUtc.Value, DateTimeKind.Utc);
            query = query.Where(r => r.CreatedAtUtc >= fromUtc);
        }

        if (request.CreatedToUtc.HasValue)
        {
            var toUtc = DateTime.SpecifyKind(request.CreatedToUtc.Value, DateTimeKind.Utc);
            query = query.Where(r => r.CreatedAtUtc < toUtc);
        }

        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderBy(r => r.Floor)
            .ThenBy(r => r.RoomNumber)
            .ThenBy(r => r.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new RoomDto(
                r.Id,
                r.PropertyId,
                r.RoomNumber,
                r.Floor,
                r.Status.ToString(),
                r.Notes,
                r.IsActive,
                r.RoomTypeId,
                r.RoomType != null ? r.RoomType.Name : string.Empty,
                r.RoomType != null ? r.RoomType.Code : string.Empty,
                r.RoomType != null ? r.RoomType.BasePrice : 0m,
                r.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return new PagedResult<RoomDto>(items, totalCount, page, pageSize);
    }
}
