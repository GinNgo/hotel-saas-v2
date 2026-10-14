using System;
using System.Collections.Generic;
using HotelSaas.Application.Properties.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Properties.Commands.UpdatePropertyPolicies;

/// <summary>
/// Individual surcharge item specification within the update payload.
/// </summary>
public sealed record UpdateSurchargeItemCommand(
    Guid? Id,
    SurchargeType SurchargeType,
    TimeOnly FromTime,
    TimeOnly ToTime,
    SurchargeCalculationMethod CalculationMethod,
    decimal? Percentage,
    decimal? FlatAmount,
    bool IsActive = true
);

/// <summary>
/// Command to update the operational policies and surcharges of a property branch.
/// </summary>
public sealed record UpdatePropertyPoliciesCommand(
    Guid PropertyId,
    TimeOnly? CheckInTime,
    TimeOnly? CheckOutTime,
    int? BufferMinutes,
    int? MaxHourlyHours,
    IReadOnlyList<UpdateSurchargeItemCommand>? Surcharges = null
) : IRequest<PropertyPoliciesDto>;
