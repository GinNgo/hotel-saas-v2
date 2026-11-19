using System;
using HotelSaas.Application.Contracts.DTOs;
using MediatR;

namespace HotelSaas.Application.Contracts.Commands.UpdateAdminContractStatus;

public sealed record UpdateAdminContractStatusCommand(
    Guid Id,
    string Status,
    string? Note = null,
    string? Notes = null
) : IRequest<AdminContractSummaryDto>;
