using System;
using HotelSaas.Application.Contracts.DTOs;
using MediatR;

namespace HotelSaas.Application.Contracts.Queries.GetAdminContractById;

public sealed record GetAdminContractByIdQuery(Guid Id) : IRequest<AdminContractDetailDto>;
