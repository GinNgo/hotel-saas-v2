using System;

namespace HotelSaas.Application.Public.Services;

/// <summary>
/// Helper to mask personally identifiable information (PII) on public-facing responses (Decision D02, D21).
/// </summary>
public static class PiiMaskingHelper
{
    public static string MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return string.Empty;

        var parts = email.Trim().Split('@');
        if (parts.Length != 2) return "***";

        var user = parts[0];
        var domain = parts[1];

        if (user.Length <= 2)
        {
            return $"{user[0]}***@{domain}";
        }

        return $"{user[0]}***{user[^1]}@{domain}";
    }

    public static string MaskPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return string.Empty;

        var clean = phone.Trim();
        if (clean.Length <= 4) return "****";

        var prefix = clean[..Math.Min(3, clean.Length - 3)];
        var suffix = clean[^3..];
        return $"{prefix}****{suffix}";
    }

    public static string MaskName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return string.Empty;
        var trimmed = name.Trim();
        var words = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 1)
        {
            return words[0].Length <= 2 ? $"{words[0][0]}*" : $"{words[0][0]}***{words[0][^1]}";
        }
        return $"{words[0][0]}*** {words[^1]}";
    }
}
