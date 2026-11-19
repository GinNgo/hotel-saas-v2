using HotelSaas.Application.Print.DTOs;
using MediatR;

namespace HotelSaas.Application.Print.Queries.GetPrintableVoucher;

public sealed record GetPrintableVoucherQuery(string ConfirmationCode) : IRequest<PrintableVoucherDto>;
