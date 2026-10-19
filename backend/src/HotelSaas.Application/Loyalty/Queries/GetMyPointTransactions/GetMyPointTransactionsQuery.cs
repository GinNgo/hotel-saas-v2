using System.Collections.Generic;
using HotelSaas.Application.Loyalty.DTOs;
using MediatR;

namespace HotelSaas.Application.Loyalty.Queries.GetMyPointTransactions;

public sealed record GetMyPointTransactionsQuery(string? FilterType = null) : IRequest<List<LoyaltyPointLedgerItemDto>>;
