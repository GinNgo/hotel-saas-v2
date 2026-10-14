using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.RoomTypes.Queries.GetRoomTypeById;

/// <summary>
/// Handles the retrieval of a single room type by identifier.
/// </summary>
public sealed class GetRoomTypeByIdQueryHandler : IRequestHandler<GetRoomTypeByIdQuery, RoomTypeDto?>
{
    private readonly IApplicationDbContext _context;

    /// <summary>
    /// Initializes a new instance of <see cref="GetRoomTypeByIdQueryHandler"/>.
    /// </summary>
    /// <param name="context">Database context.</param>
    public GetRoomTypeByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<RoomTypeDto?> Handle(GetRoomTypeByIdQuery request, CancellationToken cancellationToken)
    {
        var roomType = await _context.RoomTypes
            .AsNoTracking()
            .Include(rt => rt.Rooms)
            .FirstOrDefaultAsync(rt => rt.Id == request.Id, cancellationToken);

        if (roomType is null)
        {
            return null;
        }

        return new RoomTypeDto(
            roomType.Id,
            roomType.PropertyId,
            roomType.Name,
            roomType.Code,
            roomType.Description,
            roomType.BasePrice,
            roomType.MaxOccupancy,
            roomType.BedType,
            roomType.SquareMeters,
            roomType.ImageUrl,
            roomType.Rooms.Count,
            roomType.CreatedAtUtc);
    }
}
