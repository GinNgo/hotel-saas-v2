using System.Collections.Generic;
using HotelSaas.Application.Loyalty.DTOs;
using MediatR;

namespace HotelSaas.Application.Loyalty.Queries.GetMyInvoices;

public sealed record GetMyInvoicesQuery : IRequest<List<GuestInvoiceRecordDto>>;
