using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Rooms.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Rooms.Queries.GetRoomById;

/// <summary>
/// Handles the retrieval of a single room by identifier.
/// </summary>
public sealed class GetRoomByIdQueryHandler : IRequestHandler<GetRoomByIdQuery, RoomDto?>
{
    private readonly IApplicationDbContext _context;

    /// <summary>
    /// Initializes a new instance of <see cref="GetRoomByIdQueryHandler"/>.
    /// </summary>
    /// <param name="context">Database context.</param>
    public GetRoomByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<RoomDto?> Handle(GetRoomByIdQuery request, CancellationToken cancellationToken)
    {
        var room = await _context.Rooms
            .AsNoTracking()
            .Include(r => r.RoomType)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);

        if (room is null)
        {
            return null;
        }

        return new RoomDto(
            room.Id,
            room.PropertyId,
            room.RoomNumber,
            room.Floor,
            room.Status.ToString(),
            room.Notes,
            room.IsActive,
            room.RoomTypeId,
            room.RoomType?.Name ?? string.Empty,
            room.RoomType?.Code ?? string.Empty,
            room.RoomType?.BasePrice ?? 0m,
            room.CreatedAtUtc);
    }
}
