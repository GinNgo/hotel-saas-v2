using System;
using System.Collections.Generic;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Result returned after creating a signed VNPay checkout URL.
/// </summary>
public sealed record VnpayCreateUrlResult(
    string PaymentUrl,
    string TransactionRef,
    decimal AmountVnd
);

/// <summary>
/// Result of verifying VNPay callback / IPN signature and transaction status.
/// </summary>
public sealed record VnpayVerificationResult(
    bool IsValid,
    string? ResponseCode,
    string? TransactionStatus,
    string? TransactionNo,
    string? TxnRef,
    decimal Amount,
    string? Message
);

/// <summary>
/// Service interface for VNPay online payment integration.
/// Enforces HMAC-SHA512 checksum validation, canonical parameter sorting, and GMT+7 timestamps.
/// </summary>
public interface IVnpayPaymentService
{
    VnpayCreateUrlResult CreatePaymentUrl(
        Guid reservationId,
        string confirmationCode,
        decimal amountVnd,
        string orderInfo,
        string clientIp,
        string? returnUrl = null);

    VnpayVerificationResult VerifyCallback(IDictionary<string, string> queryParams);
}
