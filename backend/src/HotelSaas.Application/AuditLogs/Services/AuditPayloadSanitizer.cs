using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Domain.Entities;

namespace HotelSaas.Application.AuditLogs.Services;

/// <summary>
/// Read-time sanitizer and formatter for <see cref="AuditLog"/> JSON payloads.
/// Guarantees that no sensitive fields (passwords, JWTs, tokens, CCCD/Passports, PINs, card numbers, secrets)
/// are ever exposed in list summaries or detail responses, even if legacy or raw JSON records exist.
/// </summary>
public static class AuditPayloadSanitizer
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false
    };

    private static readonly HashSet<string> SensitivePropertyNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Password",
        "PasswordHash",
        "Jwt",
        "AccessToken",
        "RefreshToken",
        "Token",
        "TokenHash",
        "LookupToken",
        "IdToken",
        "ApiKey",
        "Secret",
        "SecretKey",
        "PrivateKey",
        "ClientSecret",
        "HashSecret",
        "Otp",
        "SmartLockPin",
        "Pin",
        "PinCode",
        "Passcode",
        "CardNumber",
        "CreditCard",
        "Cvv",
        "Cvc",
        "CardExpiry",
        "Cookie",
        "Authorization",
        "ConnectionString",
        "GuestIdNumber",
        "IdNumber",
        "IdentityNumber",
        "Passport",
        "PassportNumber",
        "Cccd",
        "NationalId",
        "CitizenId",
        "DigitalSignatureHash"
    };

    private static readonly Regex SensitivePropertyTokenRegex = new(
        @"(password|passwd|secret|privatekey|apikey|accesstoken|refreshtoken|lookuptoken|smartlockpin|passcode|cardnumber|cvv|cvc|cookie|authorization|connectionstring|guestidnumber|passport|cccd)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex SensitiveValuePatternRegex = new(
        @"(Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+|\beyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\b|(?i)(password|pwd|secret|apikey|token)\s*=\s*[^;\s]+)",
        RegexOptions.Compiled);

    /// <summary>
    /// Result of sanitizing and summarizing an <see cref="AuditLog"/> entry's JSON payloads.
    /// </summary>
    public sealed record SanitizedAuditPayload(
        string? SanitizedOldValuesJson,
        string? SanitizedNewValuesJson,
        IReadOnlyList<string> ChangedFields,
        IReadOnlyList<AuditFieldChangeDto> Changes,
        string ChangeSummary);

    /// <summary>
    /// Inspects, filters, and formats the OldValues and NewValues JSON strings of an <see cref="AuditLog"/>.
    /// </summary>
    public static SanitizedAuditPayload SanitizeAndSummarize(
        string action,
        string entityName,
        string? rawOldValuesJson,
        string? rawNewValuesJson)
    {
        var oldDict = ParseAndSanitizeDictionary(rawOldValuesJson, out var oldElementDict);
        var newDict = ParseAndSanitizeDictionary(rawNewValuesJson, out var newElementDict);

        var sanitizedOldJson = oldElementDict != null
            ? JsonSerializer.Serialize(oldElementDict, JsonOptions)
            : null;

        var sanitizedNewJson = newElementDict != null
            ? JsonSerializer.Serialize(newElementDict, JsonOptions)
            : null;

        var allKeys = new List<string>();
        var seenKeys = new HashSet<string>(StringComparer.Ordinal);

        if (oldDict != null)
        {
            foreach (var key in oldDict.Keys)
            {
                if (seenKeys.Add(key))
                {
                    allKeys.Add(key);
                }
            }
        }

        if (newDict != null)
        {
            foreach (var key in newDict.Keys)
            {
                if (seenKeys.Add(key))
                {
                    allKeys.Add(key);
                }
            }
        }

        var changes = new List<AuditFieldChangeDto>(allKeys.Count);
        foreach (var key in allKeys)
        {
            var oldVal = oldDict != null && oldDict.TryGetValue(key, out var ov) ? ov : null;
            var newVal = newDict != null && newDict.TryGetValue(key, out var nv) ? nv : null;
            changes.Add(new AuditFieldChangeDto(key, oldVal, newVal));
        }

        var summary = BuildSafeSummary(action, entityName, changes);

        return new SanitizedAuditPayload(
            sanitizedOldJson,
            sanitizedNewJson,
            allKeys,
            changes,
            summary);
    }

    public static bool IsSensitiveField(string propertyName)
    {
        if (string.IsNullOrWhiteSpace(propertyName))
        {
            return false;
        }

        return SensitivePropertyNames.Contains(propertyName) ||
               SensitivePropertyTokenRegex.IsMatch(propertyName);
    }

    private static Dictionary<string, string?>? ParseAndSanitizeDictionary(
        string? rawJson,
        out Dictionary<string, object?>? sanitizedObjectMap)
    {
        sanitizedObjectMap = null;
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(rawJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            var displayMap = new Dictionary<string, string?>(StringComparer.Ordinal);
            sanitizedObjectMap = new Dictionary<string, object?>(StringComparer.Ordinal);

            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (IsSensitiveField(prop.Name))
                {
                    continue;
                }

                var (sanitizedObj, displayStr) = ExtractSanitizedJsonValue(prop.Value);
                sanitizedObjectMap[prop.Name] = sanitizedObj;
                displayMap[prop.Name] = displayStr;
            }

            return displayMap;
        }
        catch (JsonException)
        {
            sanitizedObjectMap = null;
            return null;
        }
    }

    private static (object? RawObject, string? DisplayText) ExtractSanitizedJsonValue(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
                return (null, null);

            case JsonValueKind.String:
            {
                var str = element.GetString() ?? string.Empty;
                var scrubbed = ScrubSensitiveString(str);
                return (scrubbed, scrubbed);
            }

            case JsonValueKind.Number:
            {
                if (element.TryGetInt64(out var lVal))
                {
                    return (lVal, lVal.ToString(CultureInfo.InvariantCulture));
                }

                if (element.TryGetDecimal(out var dVal))
                {
                    return (dVal, dVal.ToString("0.##", CultureInfo.InvariantCulture));
                }

                var rawNum = element.GetRawText();
                return (rawNum, rawNum);
            }

            case JsonValueKind.True:
                return (true, "true");

            case JsonValueKind.False:
                return (false, "false");

            default:
            {
                var raw = ScrubSensitiveString(element.GetRawText());
                return (raw, raw);
            }
        }
    }

    private static string ScrubSensitiveString(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return value;
        }

        if (SensitiveValuePatternRegex.IsMatch(value))
        {
            return SensitiveValuePatternRegex.Replace(value, "[REDACTED]");
        }

        return value;
    }

    private static string BuildSafeSummary(
        string action,
        string entityName,
        IReadOnlyList<AuditFieldChangeDto> changes)
    {
        if (changes.Count == 0)
        {
            return $"{action} {entityName}";
        }

        if (string.Equals(action, AuditActions.Update, StringComparison.OrdinalIgnoreCase))
        {
            var diffParts = changes
                .Take(5)
                .Select(c => $"{c.FieldName}: {FormatDisplayValue(c.OldValue)} -> {FormatDisplayValue(c.NewValue)}")
                .ToList();

            var suffix = changes.Count > 5 ? $" (+{changes.Count - 5} trường khác)" : string.Empty;
            return $"Cập nhật {entityName}: {string.Join("; ", diffParts)}{suffix}";
        }

        if (string.Equals(action, AuditActions.Create, StringComparison.OrdinalIgnoreCase))
        {
            var createParts = changes
                .Where(c => c.NewValue != null)
                .Take(4)
                .Select(c => $"{c.FieldName}={FormatDisplayValue(c.NewValue)}")
                .ToList();

            return createParts.Count > 0
                ? $"Tạo mới {entityName} ({string.Join(", ", createParts)})"
                : $"Tạo mới {entityName}";
        }

        if (string.Equals(action, AuditActions.Delete, StringComparison.OrdinalIgnoreCase))
        {
            var deleteParts = changes
                .Where(c => c.OldValue != null)
                .Take(4)
                .Select(c => $"{c.FieldName}={FormatDisplayValue(c.OldValue)}")
                .ToList();

            return deleteParts.Count > 0
                ? $"Xóa {entityName} ({string.Join(", ", deleteParts)})"
                : $"Xóa {entityName}";
        }

        return $"{action} {entityName}";
    }

    private static string FormatDisplayValue(string? value)
    {
        if (value is null)
        {
            return "null";
        }

        return value.Length > 80 ? value[..80] + "..." : value;
    }
}

