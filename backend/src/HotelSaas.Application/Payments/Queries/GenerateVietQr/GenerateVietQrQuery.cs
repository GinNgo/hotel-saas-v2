using System;
using HotelSaas.Application.Common.Interfaces;
using MediatR;

namespace HotelSaas.Application.Payments.Queries.GenerateVietQr;

public sealed record GenerateVietQrQuery(
    decimal Amount,
    string? ConfirmationCode = null,
    Guid? ReservationId = null,
    string? BankBin = null,
    string? AccountNumber = null,
    string? AccountName = null,
    string? Description = null,
    Guid? PropertyId = null
) : IRequest<VietQrResult>;
