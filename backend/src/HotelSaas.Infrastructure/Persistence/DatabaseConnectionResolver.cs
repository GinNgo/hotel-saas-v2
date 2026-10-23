using System;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace HotelSaas.Infrastructure.Persistence;

/// <summary>
/// Resolves and sanitizes database connection strings from standard configuration,
/// environment variables (including Cloud DATABASE_URL URI format), and enforces safety.
/// </summary>
public static class DatabaseConnectionResolver
{
    private static readonly Regex PasswordMaskRegex = new(
        @"(Password|pwd)\s*=\s*([^;]+)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex UriPasswordMaskRegex = new(
        @":([^:@]+)@",
        RegexOptions.Compiled);

    /// <summary>
    /// Resolves the effective PostgreSQL connection string from configuration.
    /// Checks:
    /// 1. ConnectionStrings:DefaultConnection
    /// 2. ConnectionStrings__DefaultConnection (environment variable)
    /// 3. DATABASE_URL (standard cloud postgres URI format)
    /// </summary>
    public static string ResolveConnectionString(IConfiguration configuration)
    {
        if (configuration == null)
            return string.Empty;

        // 1. Standard config & env variable
        var connStr = configuration.GetConnectionString("DefaultConnection")
            ?? configuration["ConnectionStrings__DefaultConnection"]
            ?? configuration["DATABASE_URL"];

        if (string.IsNullOrWhiteSpace(connStr))
            return string.Empty;

        return NormalizeConnectionString(connStr.Trim());
    }

    /// <summary>
    /// Normalizes a connection string, converting postgres:// or postgresql:// URI format to standard Npgsql format.
    /// </summary>
    public static string NormalizeConnectionString(string rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput))
            return string.Empty;

        var trimmed = rawInput.Trim();

        // If it's a URI format e.g. postgres://user:pass@host:5432/dbname?sslmode=require
        if (trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return ParsePostgresUri(trimmed);
        }

        return trimmed;
    }

    /// <summary>
    /// Converts a postgresql:// URI into an Npgsql key-value connection string.
    /// </summary>
    public static string ParsePostgresUri(string uriString)
    {
        if (!Uri.TryCreate(uriString, UriKind.Absolute, out var uri))
        {
            throw new FormatException("Định dạng chuỗi kết nối DATABASE_URL không phải là một URI hợp lệ.");
        }

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/')
        };

        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            var parts = uri.UserInfo.Split(':', 2);
            builder.Username = Uri.UnescapeDataString(parts[0]);
            if (parts.Length > 1)
            {
                builder.Password = Uri.UnescapeDataString(parts[1]);
            }
        }

        if (!string.IsNullOrEmpty(uri.Query))
        {
            var query = uri.Query.TrimStart('?');
            var parameters = query.Split('&', StringSplitOptions.RemoveEmptyEntries);
            foreach (var param in parameters)
            {
                var kvp = param.Split('=', 2);
                var key = kvp[0].Trim().ToLowerInvariant();
                var value = kvp.Length > 1 ? Uri.UnescapeDataString(kvp[1].Trim()) : string.Empty;

                if (key == "sslmode")
                {
                    if (Enum.TryParse<SslMode>(value, ignoreCase: true, out var sslMode))
                    {
                        builder.SslMode = sslMode;
                    }
                    else if (value.Equals("require", StringComparison.OrdinalIgnoreCase))
                    {
                        builder.SslMode = SslMode.Require;
                    }
                }
                else if (key == "channel_binding" && builder.SslMode == SslMode.Disable)
                {
                    // Ignore channel_binding when SSL is disabled
                }
            }
        }

        return builder.ConnectionString;
    }

    /// <summary>
    /// Masks password credentials from connection strings for safe logging and diagnostic display.
    /// </summary>
    public static string MaskConnectionString(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return string.Empty;

        var masked = PasswordMaskRegex.Replace(connectionString, "$1=***");
        masked = UriPasswordMaskRegex.Replace(masked, ":***@");
        return masked;
    }
}
