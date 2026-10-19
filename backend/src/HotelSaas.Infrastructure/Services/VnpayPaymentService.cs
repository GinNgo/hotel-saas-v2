using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using HotelSaas.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Authoritative implementation of VNPay Payment Gateway with HMAC-SHA512 checksum signing and IPN verification.
/// Compatible with VNPay Sandbox credentials reused from LuxeStay reference.
/// </summary>
public sealed class VnpayPaymentService : IVnpayPaymentService
{
    private static readonly TimeZoneInfo VietnamTimeZone = GetVietnamTimeZone();

    private readonly string _tmnCode;
    private readonly string _hashSecret;
    private readonly string _paymentUrl;
    private readonly string _defaultReturnUrl;

    public VnpayPaymentService(IConfiguration configuration)
    {
        _tmnCode = configuration["Payment:Vnpay:TmnCode"] ?? string.Empty;
        _hashSecret = configuration["Payment:Vnpay:HashSecret"] ?? string.Empty;
        _paymentUrl = configuration["Payment:Vnpay:Url"] ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        _defaultReturnUrl = configuration["Payment:Vnpay:ReturnUrl"] ?? "http://localhost:4200/booking/vnpay-return";
    }

    private static TimeZoneInfo GetVietnamTimeZone()
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tz)) return tz;
        if (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out tz)) return tz;
        return TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "ICT", "ICT");
    }

    public VnpayCreateUrlResult CreatePaymentUrl(
        Guid reservationId,
        string confirmationCode,
        decimal amountVnd,
        string orderInfo,
        string clientIp,
        string? returnUrl = null)
    {
        if (string.IsNullOrWhiteSpace(_tmnCode) || string.IsNullOrWhiteSpace(_hashSecret))
            throw new InvalidOperationException("VNPay requires Payment:Vnpay:TmnCode and Payment:Vnpay:HashSecret configuration.");

        var nowVietnam = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, VietnamTimeZone);
        var createDate = nowVietnam.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture);
        var expireDate = nowVietnam.AddMinutes(15).ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture);

        long vnpAmount = (long)Math.Round(amountVnd * 100m, 0, MidpointRounding.AwayFromZero);
        var targetReturnUrl = !string.IsNullOrWhiteSpace(returnUrl) ? returnUrl : _defaultReturnUrl;
        var txnRef = !string.IsNullOrWhiteSpace(confirmationCode) ? confirmationCode : reservationId.ToString("N");

        var paramsMap = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_Version"] = "2.1.0",
            ["vnp_Command"] = "pay",
            ["vnp_TmnCode"] = _tmnCode,
            ["vnp_Amount"] = vnpAmount.ToString(CultureInfo.InvariantCulture),
            ["vnp_CurrCode"] = "VND",
            ["vnp_TxnRef"] = txnRef,
            ["vnp_OrderInfo"] = WebUtility.UrlEncode(orderInfo ?? $"Thanh toan don dat phong {confirmationCode}"),
            ["vnp_OrderType"] = "other",
            ["vnp_Locale"] = "vn",
            ["vnp_ReturnUrl"] = targetReturnUrl,
            ["vnp_IpAddr"] = string.IsNullOrWhiteSpace(clientIp) ? "127.0.0.1" : clientIp,
            ["vnp_CreateDate"] = createDate,
            ["vnp_ExpireDate"] = expireDate
        };

        var rawData = BuildQueryString(paramsMap, urlEncodeValues: false);
        var secureHash = HmacSha512(_hashSecret, rawData);
        var queryString = BuildQueryString(paramsMap, urlEncodeValues: true);
        var fullUrl = $"{_paymentUrl}?{queryString}&vnp_SecureHash={secureHash}";

        return new VnpayCreateUrlResult(fullUrl, txnRef, amountVnd);
    }

    public VnpayVerificationResult VerifyCallback(IDictionary<string, string> queryParams)
    {
        if (string.IsNullOrWhiteSpace(_tmnCode) || string.IsNullOrWhiteSpace(_hashSecret))
            return new VnpayVerificationResult(false, "99", null, null, null, 0, "VNPay is not configured.");

        if (queryParams == null || queryParams.Count == 0)
        {
            return new VnpayVerificationResult(false, "99", null, null, null, 0, "Dữ liệu callback rỗng.");
        }

        var sortedParams = new SortedDictionary<string, string>(StringComparer.Ordinal);
        string? incomingHash = null;

        foreach (var (k, v) in queryParams)
        {
            if (string.IsNullOrWhiteSpace(k) || string.IsNullOrWhiteSpace(v)) continue;

            if (k.Equals("vnp_SecureHash", StringComparison.OrdinalIgnoreCase))
            {
                incomingHash = v;
                continue;
            }

            if (k.Equals("vnp_SecureHashType", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (k.StartsWith("vnp_", StringComparison.OrdinalIgnoreCase))
            {
                sortedParams[k] = v;
            }
        }

        if (string.IsNullOrWhiteSpace(incomingHash))
        {
            return new VnpayVerificationResult(false, "97", null, null, null, 0, "Thiếu chữ ký kiểm thực vnp_SecureHash.");
        }

        var rawData = BuildQueryString(sortedParams, urlEncodeValues: false);
        var calculatedHash = HmacSha512(_hashSecret, rawData);

        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(calculatedHash.ToUpperInvariant()),
            Encoding.UTF8.GetBytes(incomingHash.ToUpperInvariant())))
        {
            return new VnpayVerificationResult(false, "97", null, null, null, 0, "Chữ ký kiểm thực không hợp lệ (Invalid Checksum).");
        }

        sortedParams.TryGetValue("vnp_ResponseCode", out var responseCode);
        sortedParams.TryGetValue("vnp_TransactionStatus", out var transactionStatus);
        sortedParams.TryGetValue("vnp_TransactionNo", out var transactionNo);
        sortedParams.TryGetValue("vnp_TxnRef", out var txnRef);
        sortedParams.TryGetValue("vnp_Amount", out var rawAmountStr);

        decimal amount = 0m;
        if (decimal.TryParse(rawAmountStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedVnpAmount))
        {
            amount = parsedVnpAmount / 100m;
        }

        bool isSuccessful = responseCode == "00" && (transactionStatus == null || transactionStatus == "00");

        return new VnpayVerificationResult(
            IsValid: isSuccessful,
            ResponseCode: responseCode,
            TransactionStatus: transactionStatus,
            TransactionNo: transactionNo,
            TxnRef: txnRef,
            Amount: amount,
            Message: isSuccessful ? "Giao dịch VNPay thành công." : $"Giao dịch không thành công với mã lỗi: {responseCode}"
        );
    }

    private static string BuildQueryString(SortedDictionary<string, string> data, bool urlEncodeValues)
    {
        var sb = new StringBuilder();
        foreach (var (key, value) in data)
        {
            if (sb.Length > 0) sb.Append('&');
            sb.Append(key);
            sb.Append('=');
            sb.Append(urlEncodeValues ? WebUtility.UrlEncode(value) : value);
        }
        return sb.ToString();
    }

    private static string HmacSha512(string key, string inputData)
    {
        var keyBytes = Encoding.UTF8.GetBytes(key);
        var inputBytes = Encoding.UTF8.GetBytes(inputData);
        using var hmac = new HMACSHA512(keyBytes);
        var hashValue = hmac.ComputeHash(inputBytes);
        return Convert.ToHexStringLower(hashValue);
    }
}
