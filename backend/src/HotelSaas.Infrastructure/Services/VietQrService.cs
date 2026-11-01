using System;
using System.Collections.Generic;
using System.Net;
using System.Text.RegularExpressions;
using HotelSaas.Application.Common.Interfaces;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Authoritative implementation of VietQR payment generation adhering to NAPAS 247 specification (Task A02).
/// Supports instant bank transfers with pre-filled amount and encoded booking confirmation codes.
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
        ["970403"] = "Sacombank (Ngân hàng Sài Gòn Thương Tín)"
    };

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

        var rawDesc = !string.IsNullOrWhiteSpace(payload.Description) 
            ? payload.Description 
            : $"DAT PHONG {cleanCode}";

        // Normalize description: ASCII only, max 25 chars for strict bank QR compatibility
        var normalizedDesc = NormalizeAscii(rawDesc);
        if (!string.IsNullOrWhiteSpace(cleanCode) && !normalizedDesc.Contains(cleanCode, StringComparison.OrdinalIgnoreCase))
        {
            var maxPrefixLen = Math.Max(0, 24 - cleanCode.Length);
            var prefix = normalizedDesc.Length > maxPrefixLen ? normalizedDesc[..maxPrefixLen].Trim() : normalizedDesc;
            normalizedDesc = string.IsNullOrWhiteSpace(prefix) ? cleanCode : $"{prefix} {cleanCode}";
        }
        else if (normalizedDesc.Length > 25)
        {
            normalizedDesc = normalizedDesc[..25].Trim();
        }

        long roundedAmount = (long)Math.Max(0, Math.Round(payload.Amount, 0, MidpointRounding.AwayFromZero));

        // Format official VietQR image URL with compact2 template
        var encodedDesc = WebUtility.UrlEncode(normalizedDesc);
        var encodedName = WebUtility.UrlEncode(accountName);
        var qrImageUrl = $"https://img.vietqr.io/image/{bankBin}-{accountNumber}-compact2.png?amount={roundedAmount}&addInfo={encodedDesc}&accountName={encodedName}";

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

    private static string NormalizeAscii(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        
        // Remove diacritics
        var normalized = text.Normalize(System.Text.NormalizationForm.FormD);
        var regex = new Regex(@"\p{IsCombiningDiacriticalMarks}+");
        var ascii = regex.Replace(normalized, string.Empty)
                         .Replace('đ', 'd')
                         .Replace('Đ', 'D');

        // Keep alphanumeric and space only
        var clean = Regex.Replace(ascii, @"[^a-zA-Z0-9\s]", " ");
        return Regex.Replace(clean, @"\s+", " ").Trim();
    }
}
