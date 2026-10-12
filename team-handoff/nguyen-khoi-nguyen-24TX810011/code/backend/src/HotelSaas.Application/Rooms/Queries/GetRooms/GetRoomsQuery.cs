using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Rooms.Queries.GetRooms;

/// <summary>
/// Query to retrieve a paginated list of rooms with optional filtering.
/// </summary>
/// <param name="Search">Optional keyword to match room number.</param>
/// <param name="RoomTypeId">Optional filter by room type identifier.</param>
/// <param name="Status">Optional filter by room status.</param>
/// <param name="Floor">Optional filter by floor number.</param>
/// <param name="PropertyId">Optional filter by property identifier.</param>
/// <param name="Page">1-based page number (defaults to 1).</param>
/// <param name="PageSize">Number of items per page (defaults to 20).</param>
public sealed record GetRoomsQuery(
    string? Search = null,
    Guid? RoomTypeId = null,
    RoomStatus? Status = null,
    int? Floor = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 20,
    Guid? PropertyId = null,
    DateTime? CreatedFromUtc = null,
    DateTime? CreatedToUtc = null) : IRequest<PagedResult<RoomDto>>;
