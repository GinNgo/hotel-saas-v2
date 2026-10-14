using System;
using System.Threading.Tasks;
using Npgsql;

namespace HotelSaas.Application.Tests.MigrationFixtures;

/// <summary>
/// Lifecycle and concurrency management for PostgreSQL database-level extensions (e.g. btree_gist).
/// Enforces database-level advisory transaction locking to serialize concurrent runners,
/// guarantees installation strictly in the stable 'public' schema,
/// and fails-fast without data destruction if an extension is found in an unauthorized schema.
/// </summary>
public static class PostgresExtensionLifecycleHelper
{
    /// <summary>
    /// Dedicated 64-bit PostgreSQL advisory lock key for btree_gist synchronization.
    /// Derived deterministically from 'btree_gist' + phase identifier.
    /// </summary>
    public const long AdvisoryLockKey = 7420261008;

    /// <summary>
    /// Target stable schema where database-wide extensions must reside.
    /// </summary>
    public const string TargetStableSchema = "public";

    /// <summary>
    /// PostgreSQL procedural DO block that synchronizes extension verification and installation.
    /// Uses pg_advisory_xact_lock to serialize concurrent processes,
    /// verifies existing schema location with fail-fast validation,
    /// and ensures installation strictly into schema 'public'.
    /// </summary>
    public const string EnsureBtreeGistSql = @"
DO $$
DECLARE
    v_schema text;
BEGIN
    -- 1. Database-level advisory transaction lock to serialize concurrent runners
    PERFORM pg_advisory_xact_lock(7420261008);

    -- 2. Inspect existing extension location
    SELECT n.nspname INTO v_schema
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'btree_gist';

    IF v_schema IS NOT NULL THEN
        -- 3. Fail-fast if extension is in an unauthorized schema (do not drop, relocate, or recreate)
        IF v_schema != 'public' THEN
            RAISE EXCEPTION '[EXTENSION CONFIGURATION ERROR] Extension btree_gist is installed in unauthorized schema % instead of public. Manual intervention required.', v_schema;
        END IF;
    ELSE
        -- 4. Create in stable 'public' schema
        CREATE SCHEMA IF NOT EXISTS public;
        CREATE EXTENSION btree_gist SCHEMA public;
    END IF;
END $$;";

    /// <summary>
    /// Ensures btree_gist is safely initialized in schema 'public' under database advisory lock.
    /// </summary>
    public static async Task EnsureBtreeGistExtensionAsync(NpgsqlConnection conn)
    {
        ArgumentNullException.ThrowIfNull(conn);

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = EnsureBtreeGistSql;
        await cmd.ExecuteNonQueryAsync();
    }

    /// <summary>
    /// Retrieves the current schema of the btree_gist extension, or null if not installed.
    /// </summary>
    public static async Task<string?> GetBtreeGistSchemaAsync(NpgsqlConnection conn)
    {
        ArgumentNullException.ThrowIfNull(conn);

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT n.nspname 
            FROM pg_extension e 
            JOIN pg_namespace n ON e.extnamespace = n.oid 
            WHERE e.extname = 'btree_gist';";

        var result = await cmd.ExecuteScalarAsync();
        return result as string;
    }
}
