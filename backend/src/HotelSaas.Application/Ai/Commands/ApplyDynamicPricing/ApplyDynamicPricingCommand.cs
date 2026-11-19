using System;
using HotelSaas.Application.RoomTypes.DTOs;
using MediatR;

namespace HotelSaas.Application.Ai.Commands.ApplyDynamicPricing;

public sealed record ApplyDynamicPricingCommand(
    Guid RoomTypeId,
    decimal NightlyPrice,
    Guid? PropertyId = null,
    DateOnly? EffectiveFrom = null,
    DateOnly? EffectiveTo = null,
    int? FirstHours = null,
    decimal? FirstHoursPrice = null,
    decimal? AdditionalHourPrice = null,
    string? Currency = null,
    string? ChangeReason = null
) : IRequest<RoomTypeRateDto>;
