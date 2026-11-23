using HotelSaas.Application.Print.DTOs;
using HotelSaas.Domain.Entities;

namespace HotelSaas.Application.Print.Common;

internal static class PrintHelper
{
    internal static PrintTemplateSettingsDto MapTemplateConfigDto(PrintTemplateConfig config) => new()
    {
        Id = config.Id,
        TenantId = config.TenantId,
        PropertyId = config.PropertyId,
        HeaderCompanyName = config.HeaderCompanyName,
        HeaderAddress = config.HeaderAddress,
        TaxNumber = config.TaxNumber,
        Hotline = config.Hotline,
        LogoUrl = config.LogoUrl,
        BankName = config.BankName,
        BankAccountNumber = config.BankAccountNumber,
        BankAccountHolder = config.BankAccountHolder,
        FooterNote = config.FooterNote,
        CheckInPolicyText = config.CheckInPolicyText,
        ShowVietQrCode = config.ShowVietQrCode,
        DefaultPaperSize = config.DefaultPaperSize,
        HasSepayApiKey = !string.IsNullOrWhiteSpace(config.SepayApiKey),
        SepayApiKey = !string.IsNullOrWhiteSpace(config.SepayApiKey) ? "********" : string.Empty
    };

    internal static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return string.Empty;
        }

        var trimmed = email.Trim();
        var atIndex = trimmed.IndexOf('@');
        if (atIndex <= 0)
        {
            return "***";
        }

        return $"{trimmed[0]}***{trimmed[atIndex..]}";
    }

    internal static string MaskPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return string.Empty;
        }

        var trimmed = phone.Trim();
        if (trimmed.Length <= 4)
        {
            return new string('*', trimmed.Length);
        }

        if (trimmed.Length <= 6)
        {
            return $"{trimmed[..2]}***{trimmed[^1..]}";
        }

        return $"{trimmed[..3]}****{trimmed[^3..]}";
    }
}
