using System;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace HotelSaas.Infrastructure.Persistence;

/// <summary>
/// Enforces fail-closed security and startup guard rails for cloud/remote PostgreSQL databases (Task C01).
/// Prevents accidental corruption of shared cloud datasets from uncoordinated local migrations or mock seeders.
/// </summary>
public static class CloudDatabaseGuard
{
    private static readonly string[] LocalHostnames =
    {
        "localhost",
        "127.0.0.1",
        "::1",
        "0.0.0.0",
        "postgres",
        "test_postgres",
        "db"
    };

    /// <summary>
    /// Determines whether the connection string points to an external remote/cloud database.
    /// </summary>
    public static bool IsCloudDatabase(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return false;

        try
        {
            var normalized = DatabaseConnectionResolver.NormalizeConnectionString(connectionString);
            var builder = new NpgsqlConnectionStringBuilder(normalized);

            if (string.IsNullOrWhiteSpace(builder.Host))
                return false;

            var host = builder.Host.Trim().ToLowerInvariant();

            foreach (var local in LocalHostnames)
            {
                if (host == local || host.EndsWith($".{local}", StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }

            return true;
        }
        catch
        {
            // If it cannot be parsed as a local connection, treat as potential cloud for safety
            return false;
        }
    }

    /// <summary>
    /// Validates safety constraints when connecting to a remote/cloud PostgreSQL instance.
    /// 1. Cloud databases MUST have TLS/SSL enabled (SSL Mode cannot be Disable).
    /// 2. Startup DDL/migration is blocked unless explicitly authorized via AllowCloudStartupDatabaseInit.
    /// </summary>
    public static void ValidateCloudConnectionSafety(string? connectionString, IConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(connectionString) || !IsCloudDatabase(connectionString))
            return;

        var normalized = DatabaseConnectionResolver.NormalizeConnectionString(connectionString);
        var builder = new NpgsqlConnectionStringBuilder(normalized);

        // Rule 1: SSL/TLS enforcement for all remote cloud databases
        if (builder.SslMode == SslMode.Disable)
        {
            throw new InvalidOperationException(
                "Khóa an toàn Cloud DB (Task C01): Kết nối tới máy chủ cơ sở dữ liệu từ xa bắt buộc phải bật mã hóa SSL/TLS (SSL Mode không được là Disable).");
        }
    }

    /// <summary>
    /// Validates whether startup database initialization (EF Core MigrateAsync + Seeding) is permitted to run.
    /// </summary>
    public static void ValidateStartupExecution(string? connectionString, IConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        if (IsCloudDatabase(connectionString))
        {
            var allowCloudInit = string.Equals(configuration?["AllowCloudStartupDatabaseInit"], "true", StringComparison.OrdinalIgnoreCase);
            if (!allowCloudInit)
            {
                throw new InvalidOperationException(
                    "Khóa an toàn Cloud DB (Task C01): Ứng dụng đang kết nối tới cơ sở dữ liệu Cloud từ xa. " +
                    "Để ngăn chặn việc tự động chạy migration hoặc xoá/seed dữ liệu đè lên môi trường chung của nhóm, " +
                    "bạn phải cấu hình 'SkipStartupDatabaseInit=true' (hoặc bật 'AllowCloudStartupDatabaseInit=true' nếu được nhóm trưởng phân công chạy migration).");
            }
        }
    }
}
