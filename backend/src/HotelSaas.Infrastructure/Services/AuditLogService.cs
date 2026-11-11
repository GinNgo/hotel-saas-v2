using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Production audit logging service for tracking administrative and user actions across properties and branches.
/// Enforces fail-closed multi-tenant scoping, automatic sensitive field redaction, and immutable persistence.
/// </summary>
public sealed class AuditLogService : IAuditLogService
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

    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;

    public AuditLogService(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    /// <inheritdoc />
    public async Task<AuditLog> RecordActionAsync(
        string action,
        string entityName,
        Guid entityId,
        object? oldValues = null,
        object? newValues = null,
        Guid? propertyId = null,
        CancellationToken cancellationToken = default)
    {
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Không thể ghi nhật ký kiểm toán khi thiếu ngữ cảnh Tenant.");
        }

        var effectivePropertyId = propertyId ?? _propertyService.PropertyId;
        var userId = _userContext.UserId != Guid.Empty ? (Guid?)_userContext.UserId : null;
        var ipAddress = ResolveTrustedIpAddress(_userContext.IpAddress);

        return await RecordActionExplicitAsync(
            tenantId.Value,
            effectivePropertyId,
            userId,
            action,
            entityName,
            entityId,
            oldValues,
            newValues,
            ipAddress,
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task<AuditLog> RecordActionExplicitAsync(
        Guid tenantId,
        Guid? propertyId,
        Guid? userId,
        string action,
        string entityName,
        Guid entityId,
        object? oldValues = null,
        object? newValues = null,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "TenantId bắt buộc phải hợp lệ khi ghi nhật ký kiểm toán.");
        }

        var sanitizedOldJson = SerializeAndSanitize(oldValues);
        var sanitizedNewJson = SerializeAndSanitize(newValues);

        var auditLog = new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PropertyId = propertyId,
            UserId = userId,
            Action = NormalizeAction(action),
            EntityName = string.IsNullOrWhiteSpace(entityName) ? "Unknown" : entityName.Trim(),
            EntityId = entityId,
            OldValues = sanitizedOldJson,
            NewValues = sanitizedNewJson,
            IpAddress = ResolveTrustedIpAddress(ipAddress),
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.AuditLogs.Add(auditLog);
        await _context.SaveChangesAsync(cancellationToken);

        return auditLog;
    }

    private static string NormalizeAction(string rawAction)
    {
        if (string.IsNullOrWhiteSpace(rawAction))
        {
            return AuditActions.Update;
        }

        var trimmed = rawAction.Trim();
        if (string.Equals(trimmed, AuditActions.Create, StringComparison.OrdinalIgnoreCase))
            return AuditActions.Create;
        if (string.Equals(trimmed, AuditActions.Update, StringComparison.OrdinalIgnoreCase))
            return AuditActions.Update;
        if (string.Equals(trimmed, AuditActions.Delete, StringComparison.OrdinalIgnoreCase))
            return AuditActions.Delete;

        return trimmed;
    }

    private static string? SerializeAndSanitize(object? value)
    {
        if (value == null)
        {
            return null;
        }

        if (value is string strVal)
        {
            if (string.IsNullOrWhiteSpace(strVal))
            {
                return null;
            }

            try
            {
                using var doc = JsonDocument.Parse(strVal);
                return SanitizeJsonElement(doc.RootElement);
            }
            catch (JsonException)
            {
                return JsonSerializer.Serialize(new { Message = ScrubSensitiveString(strVal) }, JsonOptions);
            }
        }

        try
        {
            var rawJson = JsonSerializer.Serialize(value, JsonOptions);
            using var doc = JsonDocument.Parse(rawJson);
            return SanitizeJsonElement(doc.RootElement);
        }
        catch
        {
            return null;
        }
    }

    private static string SanitizeJsonElement(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object)
        {
            return root.GetRawText();
        }

        var dict = new Dictionary<string, object?>(StringComparer.Ordinal);
        foreach (var prop in root.EnumerateObject())
        {
            if (IsSensitiveProperty(prop.Name))
            {
                continue;
            }

            dict[prop.Name] = ExtractSafeValue(prop.Value);
        }

        return JsonSerializer.Serialize(dict, JsonOptions);
    }

    private static object? ExtractSafeValue(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            JsonValueKind.String => ScrubSensitiveString(element.GetString() ?? string.Empty),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : (element.TryGetDecimal(out var d) ? d : element.GetRawText()),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Object => SanitizeJsonElement(element),
            _ => ScrubSensitiveString(element.GetRawText())
        };
    }

    private static bool IsSensitiveProperty(string propertyName)
    {
        if (string.IsNullOrWhiteSpace(propertyName))
        {
            return false;
        }

        return SensitivePropertyNames.Contains(propertyName) ||
               SensitivePropertyTokenRegex.IsMatch(propertyName);
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

    private static string? ResolveTrustedIpAddress(string? rawIp)
    {
        if (string.IsNullOrWhiteSpace(rawIp))
        {
            return null;
        }

        var trimmed = rawIp.Trim();
        if (IPAddress.TryParse(trimmed, out var parsed))
        {
            var normalized = parsed.ToString();
            return normalized.Length <= 64 ? normalized : normalized[..64];
        }

        return null;
    }
}
