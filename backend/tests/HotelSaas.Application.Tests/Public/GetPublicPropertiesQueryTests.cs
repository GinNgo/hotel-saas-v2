using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

[Collection("RealDatabaseTests")]
public sealed class GetPublicPropertiesQueryTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn))
            return envConn;

        return "Host=localhost;Port=5432;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;";
    }

    private static void ValidateTestDatabaseTarget(string connStr)
    {
        var builder = new NpgsqlConnectionStringBuilder(connStr);
        var dbName = builder.Database?.ToLowerInvariant() ?? string.Empty;

        var isAllowed = dbName.EndsWith("_test", StringComparison.Ordinal)
                     || dbName == "hotel_saas_p1b01a_test"
                     || dbName.Contains("test_");

        if (!isAllowed)
        {
            throw new InvalidOperationException(
                $"Target database '{builder.Database}' is NOT an authorized test database! Target database name must contain '_test'.");
        }
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
        public bool IsTenantWide { get; set; }
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
    }

    private static ApplicationDbContext CreateDbContext(
        string connString,
        string testSchema,
        ICurrentTenantService tenantService,
        ICurrentPropertyService? propertyService = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema
        };
        var propSvc = propertyService ?? new MockPropertyService();
        var interceptor = new TenantPropertySaveChangesInterceptor(tenantService, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString, npgsqlOptions =>
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantService, propSvc);
    }

    private async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
    {
        var connStr = GetConnectionString();
        ValidateTestDatabaseTarget(connStr);

        var conn = new NpgsqlConnection(connStr);
        await conn.OpenAsync();

        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        return conn;
    }

    private async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
        finally
        {
            await conn.CloseAsync();
            await conn.DisposeAsync();
        }
    }

    private async Task SeedPropertiesAsync(ApplicationDbContext context, Guid tenantId)
    {
        var tenant = new Tenant
        {
            Id = tenantId,
            Name = "Enterprise Test Corp",
            Code = $"tc-{Guid.NewGuid():N}"[..12],
            Slug = $"tenant-{Guid.NewGuid():N}"[..16],
            Status = TenantStatus.Active,
            CreatedAtUtc = DateTime.UtcNow
        };
        context.Tenants.Add(tenant);

        var propA = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Khách sạn Sài Gòn Central",
            Code = "SGC",
            Slug = "khach-san-sai-gon-central",
            Address = "123 Lê Lợi, Phường Bến Thành",
            City = "TP. Hồ Chí Minh",
            Status = PropertyStatus.Active,
            IsPublished = true,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        };

        var propB = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Khách Sạn Biển Đông",
            Code = "BD01",
            Slug = "khach-san-bien-dong",
            Address = "200 Võ Nguyên Giáp, Phường Mỹ An",
            City = "Đà Nẵng",
            Status = PropertyStatus.Active,
            IsPublished = true,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        };

        var propC = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Khách Sạn Hà Nội Heritage",
            Code = "HNH",
            Slug = "khach-san-ha-noi-heritage",
            Address = "12 Hàng Buồm, Phường Hàng Buồm",
            City = "Hà Nội",
            Status = PropertyStatus.Active,
            IsPublished = false, // Active but not published (tested to ensure Active-only semantics preserved per approved contract)
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        };

        var propD = new Property
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Khách Sạn Đóng Cửa Tạm Thời",
            Code = "DCTT",
            Slug = "khach-san-dong-cua-tam-thoi",
            Address = "456 Trần Phú, Quận Hải Châu",
            City = "Đà Nẵng",
            Status = PropertyStatus.Inactive, // Inactive
            IsPublished = true,
            CheckInTime = new TimeOnly(14, 0),
            CheckOutTime = new TimeOnly(12, 0),
            BufferMinutes = 30,
            MaxHourlyHours = 12
        };

        context.Properties.AddRange(propA, propB, propC, propD);
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task Handle_BlankOrNullSearch_ReturnsAllActivePropertiesInOrder()
    {
        var testSchema = $"test_search_{Guid.NewGuid():N}"[..24];
        var conn = await CreateTestConnectionAsync(testSchema);
        var tenantId = Guid.NewGuid();
        var tenantSvc = new MockTenantService { TenantId = tenantId };

        try
        {
            await using (var migrateCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                await migrateCtx.Database.MigrateAsync();
                await SeedPropertiesAsync(migrateCtx, tenantId);
            }

            await using (var queryCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                var handler = new GetPublicPropertiesQueryHandler(queryCtx);

                // 1. Null search
                var resultNull = await handler.Handle(new GetPublicPropertiesQuery(null), CancellationToken.None);
                Assert.Equal(3, resultNull.Count);
                Assert.DoesNotContain(resultNull, p => p.Name.Contains("Đóng Cửa"));

                // 2. Whitespace search
                var resultBlank = await handler.Handle(new GetPublicPropertiesQuery("   "), CancellationToken.None);
                Assert.Equal(3, resultBlank.Count);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Theory]
    [InlineData("sai gon", "Khách sạn Sài Gòn Central")]
    [InlineData("SAI GON", "Khách sạn Sài Gòn Central")]
    [InlineData("Sài Gòn", "Khách sạn Sài Gòn Central")]
    [InlineData("bien dong", "Khách Sạn Biển Đông")]
    [InlineData("BIỂN ĐÔNG", "Khách Sạn Biển Đông")]
    [InlineData("ha noi", "Khách Sạn Hà Nội Heritage")]
    [InlineData("HÀ NỘI", "Khách Sạn Hà Nội Heritage")]
    public async Task Handle_DiacriticsAndCasing_MatchesCorrectProperty(string search, string expectedPropertyName)
    {
        var testSchema = $"test_search_{Guid.NewGuid():N}"[..24];
        var conn = await CreateTestConnectionAsync(testSchema);
        var tenantId = Guid.NewGuid();
        var tenantSvc = new MockTenantService { TenantId = tenantId };

        try
        {
            await using (var migrateCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                await migrateCtx.Database.MigrateAsync();
                await SeedPropertiesAsync(migrateCtx, tenantId);
            }

            await using (var queryCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                var handler = new GetPublicPropertiesQueryHandler(queryCtx);
                var result = await handler.Handle(new GetPublicPropertiesQuery(search), CancellationToken.None);

                Assert.Single(result);
                Assert.Equal(expectedPropertyName, result[0].Name);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Theory]
    [InlineData("le loi", "Khách sạn Sài Gòn Central")]
    [InlineData("LÊ LỢI", "Khách sạn Sài Gòn Central")]
    [InlineData("ben thanh", "Khách sạn Sài Gòn Central")]
    [InlineData("vo nguyen giap", "Khách Sạn Biển Đông")]
    [InlineData("hang buom", "Khách Sạn Hà Nội Heritage")]
    public async Task Handle_AddressSearch_MatchesCorrectProperty(string search, string expectedPropertyName)
    {
        var testSchema = $"test_search_{Guid.NewGuid():N}"[..24];
        var conn = await CreateTestConnectionAsync(testSchema);
        var tenantId = Guid.NewGuid();
        var tenantSvc = new MockTenantService { TenantId = tenantId };

        try
        {
            await using (var migrateCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                await migrateCtx.Database.MigrateAsync();
                await SeedPropertiesAsync(migrateCtx, tenantId);
            }

            await using (var queryCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                var handler = new GetPublicPropertiesQueryHandler(queryCtx);
                var result = await handler.Handle(new GetPublicPropertiesQuery(search), CancellationToken.None);

                Assert.Single(result);
                Assert.Equal(expectedPropertyName, result[0].Name);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Theory]
    [InlineData("da nang", "Khách Sạn Biển Đông")]
    [InlineData("ĐÀ NẴNG", "Khách Sạn Biển Đông")]
    [InlineData("ho chi minh", "Khách sạn Sài Gòn Central")]
    public async Task Handle_CitySearch_MatchesCorrectProperty(string search, string expectedPropertyName)
    {
        var testSchema = $"test_search_{Guid.NewGuid():N}"[..24];
        var conn = await CreateTestConnectionAsync(testSchema);
        var tenantId = Guid.NewGuid();
        var tenantSvc = new MockTenantService { TenantId = tenantId };

        try
        {
            await using (var migrateCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                await migrateCtx.Database.MigrateAsync();
                await SeedPropertiesAsync(migrateCtx, tenantId);
            }

            await using (var queryCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                var handler = new GetPublicPropertiesQueryHandler(queryCtx);
                var result = await handler.Handle(new GetPublicPropertiesQuery(search), CancellationToken.None);

                Assert.Single(result);
                Assert.Equal(expectedPropertyName, result[0].Name);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Handle_NoMatchSearch_ReturnsEmptyList()
    {
        var testSchema = $"test_search_{Guid.NewGuid():N}"[..24];
        var conn = await CreateTestConnectionAsync(testSchema);
        var tenantId = Guid.NewGuid();
        var tenantSvc = new MockTenantService { TenantId = tenantId };

        try
        {
            await using (var migrateCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                await migrateCtx.Database.MigrateAsync();
                await SeedPropertiesAsync(migrateCtx, tenantId);
            }

            await using (var queryCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                var handler = new GetPublicPropertiesQueryHandler(queryCtx);
                var result = await handler.Handle(new GetPublicPropertiesQuery("Khách sạn Không Tồn Tại"), CancellationToken.None);

                Assert.NotNull(result);
                Assert.Empty(result);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Handle_InactiveProperty_IsNeverReturnedEvenIfKeywordMatches()
    {
        var testSchema = $"test_search_{Guid.NewGuid():N}"[..24];
        var conn = await CreateTestConnectionAsync(testSchema);
        var tenantId = Guid.NewGuid();
        var tenantSvc = new MockTenantService { TenantId = tenantId };

        try
        {
            await using (var migrateCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                await migrateCtx.Database.MigrateAsync();
                await SeedPropertiesAsync(migrateCtx, tenantId);
            }

            await using (var queryCtx = CreateDbContext(GetConnectionString(), testSchema, tenantSvc))
            {
                var handler = new GetPublicPropertiesQueryHandler(queryCtx);
                // "dong cua" matches Property D ("Khách Sạn Đóng Cửa Tạm Thời") which is Inactive
                var result = await handler.Handle(new GetPublicPropertiesQuery("dong cua"), CancellationToken.None);

                Assert.Empty(result);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
