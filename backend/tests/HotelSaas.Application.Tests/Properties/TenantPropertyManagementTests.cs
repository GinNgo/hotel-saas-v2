using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Properties.Commands.CreateProperty;
using HotelSaas.Application.Properties.Commands.UpdateProperty;
using HotelSaas.Application.Properties.Queries.GetTenantProperties;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Properties;

[Collection("RealDatabaseTests")]
public class TenantPropertyManagementTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        var baseConn = !string.IsNullOrWhiteSpace(envConn)
            ? envConn
            : "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

        var builder = new NpgsqlConnectionStringBuilder(baseConn)
        {
            Pooling = false
        };
        return builder.ConnectionString;
    }

    private sealed class MockTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class MockPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
    }

    private static ApplicationDbContext CreateDbContext(
        string connectionString,
        string schema,
        ICurrentTenantService? tenantService = null,
        ICurrentPropertyService? propertyService = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = schema,
            Pooling = false
        };

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .Options;

        return new ApplicationDbContext(
            options,
            tenantService ?? new MockTenantService(),
            propertyService ?? new MockPropertyService());
    }

    private static async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
    {
        var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $@"
            CREATE SCHEMA IF NOT EXISTS ""{testSchema}"";
            SET search_path TO ""{testSchema}"", public;
        ";
        await cmd.ExecuteNonQueryAsync();

        return conn;
    }

    private static async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $@"DROP SCHEMA IF EXISTS ""{testSchema}"" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
        finally
        {
            await conn.DisposeAsync();
        }
    }

    [Fact]
    public async Task CreateProperty_And_GetTenantProperties_Succeeds()
    {
        var testSchema = $"test_prop_{Guid.NewGuid():N}"[..24];
        var conn = await CreateTestConnectionAsync(testSchema);
        var tenantId = Guid.NewGuid();
        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var locationSvc = new LocationLookupService();

        try
        {
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc))
            {
                await migrateCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Enterprise Chain Group",
                    Code = $"cg-{Guid.NewGuid():N}"[..12],
                    Slug = $"chain-{Guid.NewGuid():N}"[..16],
                    Status = TenantStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow
                };
                migrateCtx.Tenants.Add(tenant);
                await migrateCtx.SaveChangesAsync();
            }

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc))
            {
                var createHandler = new CreatePropertyCommandHandler(ctx, tenantSvc, locationSvc);

                var createCmd = new CreatePropertyCommand(
                    Name: "Mây Homestay Đà Lạt",
                    Code: "MAY-DL",
                    Slug: "may-homestay-da-lat",
                    Address: "12 Hoàng Hoa Thám, Phường 10",
                    City: "Lâm Đồng",
                    PhoneNumber: "0909123456",
                    Email: "may@homestay.local",
                    PropertyType: PropertyType.Homestay,
                    StarRating: 3,
                    TouristZoneSlug: "da-lat",
                    TouristZoneName: null,
                    NearbyLandmarksJson: null,
                    AllowHourlyBooking: true,
                    AllowOvernightBooking: true,
                    AllowDailyBooking: true,
                    Latitude: 11.9400,
                    Longitude: 108.4500
                );

                var created = await createHandler.Handle(createCmd, CancellationToken.None);
                Assert.NotNull(created);
                Assert.Equal("Mây Homestay Đà Lạt", created.Name);
                Assert.Equal("MAY-DL", created.Code);
                Assert.Equal(PropertyType.Homestay, created.PropertyType);
                Assert.Equal("da-lat", created.TouristZoneSlug);
                Assert.Equal("Đà Lạt", created.TouristZoneName);
            }

            // Query back via GetTenantPropertiesQueryHandler
            await using (var queryCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc))
            {
                var queryHandler = new GetTenantPropertiesQueryHandler(queryCtx, tenantSvc);
                var list = await queryHandler.Handle(new GetTenantPropertiesQuery(), CancellationToken.None);

                Assert.Single(list);
                Assert.Equal("Mây Homestay Đà Lạt", list[0].Name);
                Assert.Equal("Homestay", list[0].PropertyTypeName);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task UpdateProperty_UpdatesFieldsCorrectly()
    {
        var testSchema = $"test_prop_upd_{Guid.NewGuid():N}"[..24];
        var conn = await CreateTestConnectionAsync(testSchema);
        var tenantId = Guid.NewGuid();
        var propId = Guid.NewGuid();
        var tenantSvc = new MockTenantService { TenantId = tenantId };
        var locationSvc = new LocationLookupService();

        try
        {
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc))
            {
                await migrateCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Enterprise Motel Corp",
                    Code = $"mc-{Guid.NewGuid():N}"[..12],
                    Slug = $"motel-corp-{Guid.NewGuid():N}"[..16],
                    Status = TenantStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow
                };
                migrateCtx.Tenants.Add(tenant);

                var prop = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Original Motel",
                    Code = "MOTEL-01",
                    Slug = "original-motel",
                    Address = "123 Street",
                    City = "Vũng Tàu",
                    PropertyType = PropertyType.Motel,
                    Status = PropertyStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                migrateCtx.Properties.Add(prop);
                await migrateCtx.SaveChangesAsync();
            }

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantSvc))
            {
                var updateHandler = new UpdatePropertyCommandHandler(ctx, tenantSvc, locationSvc);
                var updateCmd = new UpdatePropertyCommand(
                    PropertyId: propId,
                    Name: "Sunset Vũng Tàu Motel",
                    Address: "456 Thùy Vân, Phường Thắng Tam",
                    City: "Bà Rịa - Vũng Tàu",
                    PhoneNumber: "0918889999",
                    Email: "sunset@motel.local",
                    PropertyType: PropertyType.Motel,
                    StarRating: 2,
                    TouristZoneSlug: "vung-tau",
                    TouristZoneName: null,
                    NearbyLandmarksJson: "[{\"Name\":\"Bãi Sau Vũng Tàu\",\"DistanceKm\":0.1}]",
                    AllowHourlyBooking: true,
                    AllowOvernightBooking: true,
                    AllowDailyBooking: false,
                    IsPublished: true,
                    Status: PropertyStatus.Active,
                    Latitude: 10.3350,
                    Longitude: 107.0900
                );

                var updated = await updateHandler.Handle(updateCmd, CancellationToken.None);
                Assert.Equal("Sunset Vũng Tàu Motel", updated.Name);
                Assert.Equal("vung-tau", updated.TouristZoneSlug);
                Assert.Equal("Vũng Tàu", updated.TouristZoneName);
                Assert.True(updated.AllowHourlyBooking);
                Assert.False(updated.AllowDailyBooking);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
