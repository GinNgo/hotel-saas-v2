using System;
using HotelSaas.Application.Print.DTOs;
using MediatR;

namespace HotelSaas.Application.Print.Queries.GetPrintableContract;

public sealed record GetPrintableContractQuery(Guid ContractId) : IRequest<PrintableContractDto>;
