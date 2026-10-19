using System;
using HotelSaas.Application.Loyalty.DTOs;
using MediatR;

namespace HotelSaas.Application.Loyalty.Queries.GetGuestInvoicePrintView;

public sealed record GetGuestInvoicePrintViewQuery(Guid InvoiceOrReservationId) : IRequest<GuestInvoiceRecordDto>;
