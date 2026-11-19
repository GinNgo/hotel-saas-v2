using System;
using HotelSaas.Application.Reports.DTOs;
using MediatR;

namespace HotelSaas.Application.Reports.Queries.ExportReservationInvoicePdf;

public sealed record ExportReservationInvoicePdfQuery(Guid ReservationId) : IRequest<ExportedReportFileDto?>;
