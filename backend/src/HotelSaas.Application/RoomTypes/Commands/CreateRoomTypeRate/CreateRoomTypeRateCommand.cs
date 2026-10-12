using System;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;

namespace HotelSaas.Application.RoomTypes.Commands.CreateRoomTypeRate;

/// <summary>
/// Command to create or interval-split a versioned rate schedule for a room type.
/// </summary>
public sealed record CreateRoomTypeRateCommand(
    Guid RoomTypeId,
    Guid? PropertyId,
    int FirstHours,
    decimal FirstHoursPrice,
    decimal AdditionalHourPrice,
    decimal NightlyPrice,
    DateOnly EffectiveFrom,
    DateOnly EffectiveTo,
    string Currency = "VND",
    string? ChangeReason = null
) : IRequest<RoomTypeRateDto>;
