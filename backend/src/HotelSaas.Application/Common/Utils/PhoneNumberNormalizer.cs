using System.Text.RegularExpressions;

namespace HotelSaas.Application.Common.Utils;

/// <summary>
/// Normalizes international and local phone numbers into standardized E.164 format (e.g., +84901234567).
/// </summary>
public static class PhoneNumberNormalizer
{
    public static string Normalize(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return string.Empty;

        var cleaned = Regex.Replace(phone.Trim(), @"[^\d+]", "");
        if (cleaned.StartsWith("0") && cleaned.Length >= 10)
        {
            return "+84" + cleaned[1..];
        }
        if (!cleaned.StartsWith("+"))
        {
            return "+84" + cleaned;
        }
        return cleaned;
    }
}
