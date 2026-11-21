using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using HotelSaas.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Authoritative implementation of VietQR payment generation adhering to NAPAS 247 specification (Task A02).
/// Supports instant bank transfers with pre-filled amount and encoded booking confirmation codes,
/// with optional SePay QR image URL rendering when <c>Payment:Sepay:UseSepayQrImage</c> is enabled.
/// </summary>
public sealed class VietQrService : IVietQrService
{
    private static readonly Dictionary<string, string> PopularBankNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["970422"] = "MB Bank (Ngân hàng Quân Đội)",
        ["970415"] = "VietinBank (Ngân hàng Công Thương)",
        ["970436"] = "Vietcombank (Ngân hàng Ngoại Thương)",
        ["970407"] = "Techcombank (Ngân hàng Kỹ Thương)",
        ["970418"] = "BIDV (Ngân hàng Đầu tư và Phát triển)",
        ["970423"] = "TPBank (Ngân hàng Tiên Phong)",
        ["970432"] = "VPBank (Ngân hàng Việt Nam Thịnh Vượng)",
        ["970448"] = "OCB (Ngân hàng Phương Đông)",
        ["970405"] = "Agribank (Ngân hàng Nông nghiệp)",
        ["970403"] = "Sacombank (Ngân hàng Sài Gòn Thương Tín)",
        ["970416"] = "ACB (Ngân hàng Á Châu)",
        ["970441"] = "VIB (Ngân hàng Quốc Tế)",
        ["970426"] = "MSB (Ngân hàng Hàng Hải)",
        ["970437"] = "HDBank (Ngân hàng Phát triển TP.HCM)",
        ["970443"] = "SHB (Ngân hàng Sài Gòn - Hà Nội)",
        ["970440"] = "SeABank (Ngân hàng Đông Nam Á)",
        ["970431"] = "Eximbank (Ngân hàng Xuất Nhập Khẩu)"
    };

    private static readonly Dictionary<string, string> BinToSepayBankCode = new(StringComparer.OrdinalIgnoreCase)
    {
        ["970422"] = "MBBank",
        ["970415"] = "VietinBank",
        ["970436"] = "Vietcombank",
        ["970407"] = "Techcombank",
        ["970418"] = "BIDV",
        ["970423"] = "TPBank",
        ["970432"] = "VPBank",
        ["970448"] = "OCB",
        ["970405"] = "Agribank",
        ["970403"] = "Sacombank",
        ["970416"] = "ACB",
        ["970441"] = "VIB",
        ["970426"] = "MSB",
        ["970437"] = "HDBank",
        ["970443"] = "SHB",
        ["970440"] = "SeABank",
        ["970431"] = "Eximbank"
    };

    private static readonly Regex DiacriticsRegex = new(@"\p{IsCombiningDiacriticalMarks}+", RegexOptions.Compiled);
    private static readonly Regex NonAlnumOrSpaceRegex = new(@"[^a-zA-Z0-9\s]", RegexOptions.Compiled);
    private static readonly Regex NonAlnumRegex = new(@"[^a-zA-Z0-9]", RegexOptions.Compiled);
    private static readonly Regex MultiSpaceRegex = new(@"\s+", RegexOptions.Compiled);

    private readonly bool _useSepayQrImage;

    public VietQrService(IConfiguration? configuration = null)
    {
        _useSepayQrImage = bool.TryParse(configuration?["Payment:Sepay:UseSepayQrImage"], out var useSepay) && useSepay;
    }

    public VietQrResult GenerateDynamicQr(VietQrPayload payload)
    {
        if (payload == null) throw new ArgumentNullException(nameof(payload));

        var bankBin = string.IsNullOrWhiteSpace(payload.BankBin) ? "970422" : payload.BankBin.Trim();
        var accountNumber = string.IsNullOrWhiteSpace(payload.AccountNumber) ? "0345678910" : payload.AccountNumber.Trim();
        var accountName = string.IsNullOrWhiteSpace(payload.AccountName)
            ? "HOTEL SAAS RESORT"
            : NormalizeAscii(payload.AccountName).ToUpperInvariant();

        var bankName = PopularBankNames.TryGetValue(bankBin, out var knownName)
            ? knownName
            : $"Ngân hàng liên kết (BIN: {bankBin})";

        var cleanCode = !string.IsNullOrWhiteSpace(payload.ConfirmationCode)
            ? payload.ConfirmationCode.Trim()
            : (payload.ReservationId.HasValue ? payload.ReservationId.Value.ToString("N")[..8].ToUpperInvariant() : "HOTEL");

        var compactCode = NormalizeCompactToken(cleanCode);

        var rawDesc = !string.IsNullOrWhiteSpace(payload.Description)
            ? payload.Description.Trim()
            : $"DATPHONG {compactCode}";

        // Replace hyphenated/spaced confirmation code occurrences with clean separator-free alphanumeric token
        // (e.g., "DATPHONG RES-ABC123" -> "DATPHONG RESABC123") for reliable SePay/NAPAS matching.
        if (!string.IsNullOrWhiteSpace(cleanCode) && !string.IsNullOrWhiteSpace(compactCode))
        {
            rawDesc = rawDesc.Replace(cleanCode, compactCode, StringComparison.OrdinalIgnoreCase);
            var spacedCode = NormalizeAscii(cleanCode);
            if (!string.IsNullOrWhiteSpace(spacedCode) &&
                !string.Equals(spacedCode, compactCode, StringComparison.OrdinalIgnoreCase))
            {
                rawDesc = rawDesc.Replace(spacedCode, compactCode, StringComparison.OrdinalIgnoreCase);
            }
        }

        // Normalize description: ASCII only, max 25 chars for strict bank QR compatibility
        var normalizedDesc = NormalizeAscii(rawDesc);
        if (!string.IsNullOrWhiteSpace(compactCode))
        {
            if (!normalizedDesc.Contains(compactCode, StringComparison.OrdinalIgnoreCase))
            {
                var maxPrefixLen = Math.Max(0, 24 - compactCode.Length);
                var prefix = normalizedDesc.Length > maxPrefixLen ? normalizedDesc[..maxPrefixLen].Trim() : normalizedDesc;
                normalizedDesc = string.IsNullOrWhiteSpace(prefix) ? compactCode : $"{prefix} {compactCode}";
            }
            else if (normalizedDesc.Length > 25)
            {
                var strippedPrefix = Regex.Replace(
                    normalizedDesc,
                    Regex.Escape(compactCode),
                    string.Empty,
                    RegexOptions.IgnoreCase);
                strippedPrefix = MultiSpaceRegex.Replace(strippedPrefix, " ").Trim();
                var maxPrefixLen = Math.Max(0, 24 - compactCode.Length);
                var prefix = strippedPrefix.Length > maxPrefixLen ? strippedPrefix[..maxPrefixLen].Trim() : strippedPrefix;
                normalizedDesc = string.IsNullOrWhiteSpace(prefix) ? compactCode : $"{prefix} {compactCode}";
            }
        }
        else if (normalizedDesc.Length > 25)
        {
            normalizedDesc = normalizedDesc[..25].Trim();
        }

        long roundedAmount = (long)Math.Max(0, Math.Round(payload.Amount, 0, MidpointRounding.AwayFromZero));

        var encodedDesc = WebUtility.UrlEncode(normalizedDesc);
        var encodedName = WebUtility.UrlEncode(accountName);
        string qrImageUrl;
        if (_useSepayQrImage)
        {
            var sepayBank = BinToSepayBankCode.TryGetValue(bankBin, out var bankCode) ? bankCode : bankBin;
            qrImageUrl = $"https://qr.sepay.vn/img?acc={WebUtility.UrlEncode(accountNumber)}&bank={WebUtility.UrlEncode(sepayBank)}&amount={roundedAmount}&des={encodedDesc}";
        }
        else
        {
            qrImageUrl = $"https://img.vietqr.io/image/{bankBin}-{accountNumber}-compact2.png?amount={roundedAmount}&addInfo={encodedDesc}&accountName={encodedName}";
        }

        // Deep link syntax for banking apps
        var quickPayDeepLink = $"vietqr://pay?bank={bankBin}&account={accountNumber}&amount={roundedAmount}&desc={encodedDesc}";

        return new VietQrResult(
            QrImageUrl: qrImageUrl,
            BankBin: bankBin,
            BankName: bankName,
            AccountNumber: accountNumber,
            AccountName: accountName,
            Amount: roundedAmount,
            Description: normalizedDesc,
            ConfirmationCode: cleanCode,
            QuickPayDeepLink: quickPayDeepLink
        );
    }

    private static string RemoveDiacritics(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        return DiacriticsRegex.Replace(normalized, string.Empty)
                              .Replace('đ', 'd')
                              .Replace('Đ', 'D');
    }

    private static string NormalizeCompactToken(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var ascii = RemoveDiacritics(text);
        return NonAlnumRegex.Replace(ascii, string.Empty).ToUpperInvariant();
    }

    private static string NormalizeAscii(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;

        var ascii = RemoveDiacritics(text);
        var clean = NonAlnumOrSpaceRegex.Replace(ascii, " ");
        return MultiSpaceRegex.Replace(clean, " ").Trim();
    }
}
