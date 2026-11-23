using System;
using HotelSaas.Application.Print.DTOs;
using MediatR;

namespace HotelSaas.Application.Print.Queries.GetPrintableInvoice;

public sealed record GetPrintableInvoiceQuery(
    Guid ReservationId,
    string? Code = null
) : IRequest<PrintableInvoiceDto>;
