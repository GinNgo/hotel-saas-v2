using System;
using HotelSaas.Application.Payments.DTOs;
using MediatR;

namespace HotelSaas.Application.Payments.Commands.AddFolioItem;

/// <summary>
/// Command to post an extra service charge (Minibar, Laundry, Extra Bed, F&B) to a reservation's folio.
/// </summary>
public sealed record AddFolioItemCommand(
    Guid ReservationId,
    Guid PropertyId,
    string ItemCode,
    string Description,
    int Quantity,
    decimal UnitPrice,
    string Category = "Service"
) : IRequest<FolioDto>;
