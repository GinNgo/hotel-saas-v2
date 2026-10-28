using System;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Payload request for generating a standard dynamic VietQR code conforming to NAPAS 247 specification.
/// </summary>
public sealed record VietQrPayload(
    string BankBin,
    string AccountNumber,
    string AccountName,
    decimal Amount,
    string Description,
    string ConfirmationCode,
    Guid? ReservationId = null
);

/// <summary>
/// Result containing dynamic image URL, deep links, and formatted metadata for banking apps.
/// </summary>
public sealed record VietQrResult(
    string QrImageUrl,
    string BankBin,
    string BankName,
    string AccountNumber,
    string AccountName,
    decimal Amount,
    string Description,
    string ConfirmationCode,
    string QuickPayDeepLink
);

/// <summary>
/// Generates dynamic VietQR codes for instant 24/7 bank transfer payment in Vietnam.
/// </summary>
public interface IVietQrService
{
    VietQrResult GenerateDynamicQr(VietQrPayload payload);
}
