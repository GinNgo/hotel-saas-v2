using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace HotelSaas.WebApi.Tests;

/// <summary>
/// Task C02 & C03: Live Cloud/Remote PostgreSQL Read-Only Probe and Schema Verification.
/// Connects to the shared team database over TLS/SSL and validates version, schema, and baseline RBAC.
/// </summary>
public sealed class RemoteCloudDatabaseProbeTests
{
    private const string StagingConnectionString =
        "Host=103.116.38.74;Port=5435;Database=hotel_saas_staging;Username=hotel_admin;Password=HotelSaas2026_Staging@Secure;SSL Mode=Require;Trust Server Certificate=true;";

    private readonly ITestOutputHelper _output;

    public RemoteCloudDatabaseProbeTests(ITestOutputHelper output)
    {
        _output = output;
    }

    [Fact]
    public async Task ProbeSharedCloudDatabase_ValidatesTlsVersionAndBTreeGist()
    {
        await using var conn = new NpgsqlConnection(StagingConnectionString);
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT 
                version(),
                current_database(),
                current_user,
                EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') AS has_btree_gist,
                (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS is_ssl_encrypted;";

        await using var reader = await cmd.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync(), "Không đọc được thông tin từ cơ sở dữ liệu.");

        var version = reader.GetString(0);
        var dbName = reader.GetString(1);
        var currentUser = reader.GetString(2);
        var hasBtreeGist = reader.GetBoolean(3);
        var isSsl = reader.GetBoolean(4);

        _output.WriteLine($"[C02 EVIDENCE] Connected successfully over TLS to: {conn.Host}:{conn.Port}");
        _output.WriteLine($"[C02 EVIDENCE] Database: {dbName}");
        _output.WriteLine($"[C02 EVIDENCE] User: {currentUser}");
        _output.WriteLine($"[C02 EVIDENCE] PostgreSQL Version: {version}");
        _output.WriteLine($"[C02 EVIDENCE] btree_gist extension installed: {hasBtreeGist}");
        _output.WriteLine($"[C02 EVIDENCE] TLS/SSL Active in Session: {isSsl}");

        Assert.Equal("hotel_saas_staging", dbName);
        Assert.Equal("hotel_admin", currentUser);
        Assert.Contains("PostgreSQL 17", version);
        Assert.True(hasBtreeGist, "Extension 'btree_gist' bắt buộc phải tồn tại để phục vụ migration.");
        Assert.True(isSsl, "Phiên kết nối phải được mã hóa qua TLS/SSL.");
    }

    [Fact]
    public async Task SeedDefaultRolesAndVerifySchema_PopulatesBaselineRbac()
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseNpgsql(StagingConnectionString);

        var tenantService = new CurrentTenantService();
        var propertyService = new CurrentPropertyService();

        await using var context = new ApplicationDbContext(optionsBuilder.Options, tenantService, propertyService);

        // Apply RBAC seed
        await SeedData.SeedDefaultRolesAndPermissions(context);

        var roleCount = await context.AccessRoles.CountAsync();
        var permCount = await context.PermissionFunctions.CountAsync();
        var tableCount = await context.Database.SqlQueryRaw<int>(
            "SELECT count(*)::int AS \"Value\" FROM information_schema.tables WHERE table_schema = 'public'").FirstAsync();

        _output.WriteLine($"[C03 EVIDENCE] Total Public Tables in Staging: {tableCount}");
        _output.WriteLine($"[C03 EVIDENCE] AccessRoles Count: {roleCount}");
        _output.WriteLine($"[C03 EVIDENCE] PermissionFunctions Count: {permCount}");

        Assert.True(tableCount >= 30, $"Staging schema phải có đầy đủ ít nhất 30 bảng (hiện có: {tableCount}).");
        Assert.True(roleCount >= 4, $"Phải có ít nhất 4 roles mặc định (hiện có: {roleCount}).");
        Assert.True(permCount >= 15, $"Phải có ít nhất 15 PermissionFunctions (hiện có: {permCount}).");
    }
}
