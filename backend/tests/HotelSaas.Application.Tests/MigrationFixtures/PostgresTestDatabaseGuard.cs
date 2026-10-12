using System;
using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Npgsql;

namespace HotelSaas.Application.Tests.MigrationFixtures;

/// <summary>
/// Strict database access and lifecycle guard for test harnesses.
/// Strictly enforces:
/// 1. Shared database must match canonical name 'hotel_saas_p1b01a_test' exactly.
/// 2. Ephemeral databases must have dedicated prefix 'hotel_saas_tmp_' followed by a valid 32-hex GUID.
/// 3. Bans loose whitelisting like Contains("test_") or EndsWith("_test").
/// 4. Tracks database ownership: DROP DATABASE is strictly restricted to ephemeral databases created and registered by the current harness instance.
/// 5. Shared test database cannot be dropped under any circumstances.
/// </summary>
public static class PostgresTestDatabaseGuard
{
    public const string SharedTestDatabaseName = "hotel_saas_p1b01a_test";
    public const string EphemeralDatabasePrefix = "hotel_saas_tmp_";

    private static readonly Regex EphemeralDatabaseRegex = new(
        @"^hotel_saas_tmp_[0-9a-fA-F]{32}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    // Thread-safe registry of ephemeral databases created and owned by this test harness run
    private static readonly ConcurrentDictionary<string, bool> OwnedDatabases = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Generates an authorized ephemeral test database name with the dedicated prefix and a valid GUID in "N" format.
    /// </summary>
    public static string GenerateEphemeralDatabaseName()
    {
        return $"{EphemeralDatabasePrefix}{Guid.NewGuid():N}";
    }

    /// <summary>
    /// Validates whether a database name is strictly authorized for test operations.
    /// Authorized names are either:
    /// - The canonical shared test database ('hotel_saas_p1b01a_test')
    /// - An ephemeral database matching '^hotel_saas_tmp_[0-9a-fA-F]{32}$'
    /// </summary>
    public static void ValidateAuthorizedTestDatabaseName(string databaseName)
    {
        if (string.IsNullOrWhiteSpace(databaseName))
        {
            throw new ArgumentException("[DATABASE GUARD] Database name cannot be null or whitespace.", nameof(databaseName));
        }

        var normalized = databaseName.Trim();

        if (string.Equals(normalized, SharedTestDatabaseName, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (EphemeralDatabaseRegex.IsMatch(normalized))
        {
            return;
        }

        throw new InvalidOperationException(
            $"[CRITICAL SECURITY ALERT] Target database '{databaseName}' is NOT an authorized test database! " +
            $"Refusing to execute DDL/DML. Target database must be '{SharedTestDatabaseName}' or match pattern '{EphemeralDatabasePrefix}<guid:N>'.");
    }

    /// <summary>
    /// Validates the database specified in an Npgsql connection string against the strict whitelist.
    /// </summary>
    public static void ValidateConnectionTarget(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentException("[DATABASE GUARD] Connection string cannot be null or whitespace.", nameof(connectionString));
        }

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var dbName = builder.Database;

        if (string.IsNullOrWhiteSpace(dbName))
        {
            throw new InvalidOperationException("[CRITICAL SECURITY ALERT] Connection string does not specify a target Database.");
        }

        ValidateAuthorizedTestDatabaseName(dbName);
    }

    /// <summary>
    /// Registers an ephemeral database as owned by the current test harness upon successful creation.
    /// </summary>
    public static void RecordDatabaseCreated(string databaseName)
    {
        ValidateAuthorizedTestDatabaseName(databaseName);

        if (string.Equals(databaseName, SharedTestDatabaseName, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("[DATABASE GUARD] Shared test database cannot be registered as an ephemeral owned database.");
        }

        OwnedDatabases.TryAdd(databaseName, true);
    }

    /// <summary>
    /// Validates that an ephemeral database is owned and safe to be dropped, then unregisters ownership.
    /// Rules:
    /// 1. Shared database ('hotel_saas_p1b01a_test') CANNOT be dropped under any circumstances.
    /// 2. Must match the ephemeral database naming pattern.
    /// 3. Must be owned (created and recorded by the current test harness execution).
    /// </summary>
    public static void ValidateAndUnregisterForDrop(string databaseName)
    {
        if (string.IsNullOrWhiteSpace(databaseName))
        {
            throw new ArgumentException("[DATABASE GUARD] Database name cannot be null or whitespace.", nameof(databaseName));
        }

        var normalized = databaseName.Trim();

        if (string.Equals(normalized, SharedTestDatabaseName, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"[CRITICAL SECURITY ALERT] Refusing to drop shared test database '{SharedTestDatabaseName}'!");
        }

        if (!EphemeralDatabaseRegex.IsMatch(normalized))
        {
            throw new InvalidOperationException(
                $"[CRITICAL SECURITY ALERT] Database '{databaseName}' does not match the ephemeral database naming pattern '{EphemeralDatabasePrefix}<guid:N>'!");
        }

        if (!OwnedDatabases.TryRemove(normalized, out _))
        {
            throw new InvalidOperationException(
                $"[CRITICAL SECURITY ALERT] Refusing to drop unowned database '{databaseName}'! " +
                "Only databases created by the current test harness execution can be dropped.");
        }
    }

    /// <summary>
    /// Checks if a database is currently recorded as owned by the harness.
    /// </summary>
    public static bool IsDatabaseOwned(string databaseName)
    {
        return !string.IsNullOrWhiteSpace(databaseName) && OwnedDatabases.ContainsKey(databaseName.Trim());
    }
}
