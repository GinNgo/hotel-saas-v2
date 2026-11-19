using System;
using System.Collections.Generic;
using HotelSaas.Application.Contracts.DTOs;
using MediatR;

namespace HotelSaas.Application.Contracts.Queries.GetAdminContracts;

public sealed record GetAdminContractsQuery(
    string? Status = null,
    string? Search = null,
    Guid? TenantId = null
) : IRequest<List<AdminContractSummaryDto>>;
