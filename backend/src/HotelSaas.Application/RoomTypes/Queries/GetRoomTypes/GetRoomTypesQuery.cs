using HotelSaas.Application.Common.Models;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;

namespace HotelSaas.Application.RoomTypes.Queries.GetRoomTypes;

/// <summary>
/// Query to retrieve a paginated list of room types with optional filtering.
/// </summary>
/// <param name="Search">Optional search keyword to match room type name or code.</param>
/// <param name="PropertyId">Optional filter by property identifier.</param>
/// <param name="Page">1-based page number (defaults to 1).</param>
/// <param name="PageSize">Number of items per page (defaults to 20).</param>
public sealed record GetRoomTypesQuery(
    string? Search = null,
    int Page = 1,
    int PageSize = 20,
    Guid? PropertyId = null) : IRequest<PagedResult<RoomTypeDto>>;
