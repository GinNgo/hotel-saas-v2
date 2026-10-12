using System;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Rooms.Queries.GetRooms;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Rooms;

/// <summary>
/// Integration tests verifying DELIVERY-CATALOG-01 date filtering, totalCount accuracy,
/// multi-page pagination consistency, and Asia/Ho_Chi_Minh timezone boundaries.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class GetRoomsDateFilterAndPaginationTests
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
        public bool IsTenantWide { get; set; } = true;
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
            .UseNpgsql(builder.ConnectionString)
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
        if (!Regex.IsMatch(testSchema, @"^p2b01_test_[a-zA-Z0-9]+$"))
        {
            throw new ArgumentException($"Invalid schema name '{testSchema}' - refusing to drop unauthorized schema.", nameof(testSchema));
        }

        try
        {
            if (conn.State != System.Data.ConnectionState.Open)
            {
                await conn.OpenAsync();
            }

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
            await cmd.ExecuteNonQueryAsync();
        }
        catch { }
        finally
        {
            await conn.DisposeAsync();
        }
    }

    [Fact]
    public async Task GetRooms_DateFilter_FiltersBeforeCountAndPagination_MultiPage()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockTenantService { TenantId = tenantId };
            var propertyService = new MockPropertyService { PropertyId = propId };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Date Test Tenant",
                    Code = $"DT-{tenantId:N}"[..12],
                    Slug = $"date-tenant-{tenantId:N}"[..24],
                    Address = "123 Le Duan",
                    City = "Hanoi",
                    Status = TenantStatus.Active
                };
                var property = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Date Test Property",
                    Code = $"DP-{propId:N}"[..12],
                    Slug = $"date-prop-{propId:N}"[..24],
                    Address = "123 Le Duan",
                    City = "Hanoi",
                    Status = PropertyStatus.Active
                };
                var roomType = new RoomType
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    Name = "Standard Room",
                    Code = "STD",
                    BasePrice = 500000m,
                    MaxOccupancy = 2
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.Add(property);
                seedCtx.RoomTypes.Add(roomType);
                await seedCtx.SaveChangesAsync();

                // Seed 25 rooms:
                // 20 rooms created on 2026-10-01 (old)
                // 5 rooms created on 2026-10-09 (today in Asia/Ho_Chi_Minh: 2026-10-08 17:00:00Z to 2026-10-09 17:00:00Z)
                var oldDate = new DateTime(2026, 10, 1, 10, 0, 0, DateTimeKind.Utc);
                var todayUtc = new DateTime(2026, 10, 9, 3, 0, 0, DateTimeKind.Utc); // 10:00 AM VN time on Oct 9

                for (int i = 1; i <= 20; i++)
                {
                    seedCtx.Rooms.Add(new Room
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        PropertyId = propId,
                        RoomTypeId = roomType.Id,
                        RoomNumber = $"1{i:D2}",
                        Floor = 1,
                        Status = RoomStatus.Clean,
                        IsActive = true,
                        CreatedAtUtc = oldDate,
                        UpdatedAtUtc = oldDate
                    });
                }

                for (int i = 1; i <= 5; i++)
                {
                    seedCtx.Rooms.Add(new Room
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        PropertyId = propId,
                        RoomTypeId = roomType.Id,
                        RoomNumber = $"2{i:D2}",
                        Floor = 2,
                        Status = RoomStatus.Clean,
                        IsActive = true,
                        CreatedAtUtc = todayUtc,
                        UpdatedAtUtc = todayUtc
                    });
                }
                await seedCtx.SaveChangesAsync();
            }

            await using var queryCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService);
            var handler = new GetRoomsQueryHandler(queryCtx);

            // 1. Unfiltered query with page 1, pageSize 10: totalCount must be 25
            var unfilteredResult = await handler.Handle(
                new GetRoomsQuery(PropertyId: propId, Page: 1, PageSize: 10),
                CancellationToken.None);

            Assert.Equal(25, unfilteredResult.TotalCount);
            Assert.Equal(10, unfilteredResult.Items.Count);

            // 2. Date-filtered query for 2026-10-09:
            // In Asia/Ho_Chi_Minh: [2026-10-08T17:00:00Z, 2026-10-09T17:00:00Z)
            var startUtc = new DateTime(2026, 10, 8, 17, 0, 0, DateTimeKind.Utc);
            var endExclusiveUtc = new DateTime(2026, 10, 9, 17, 0, 0, DateTimeKind.Utc);

            var filteredResult = await handler.Handle(
                new GetRoomsQuery(
                    PropertyId: propId,
                    Page: 1,
                    PageSize: 10,
                    CreatedFromUtc: startUtc,
                    CreatedToUtc: endExclusiveUtc),
                CancellationToken.None);

            // TotalCount must be 5 (filtered BEFORE count and pagination)
            Assert.Equal(5, filteredResult.TotalCount);
            Assert.Equal(5, filteredResult.Items.Count);
            Assert.All(filteredResult.Items, r => Assert.StartsWith("2", r.RoomNumber));
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task GetRooms_DateFilter_MatchingItemsOnLaterPages_ReachableOnPageOneAfterFilter()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockTenantService { TenantId = tenantId };
            var propertyService = new MockPropertyService { PropertyId = propId };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Page Test Tenant",
                    Code = $"PT-{tenantId:N}"[..12],
                    Slug = $"page-tenant-{tenantId:N}"[..24],
                    Address = "456 Tran Phu",
                    City = "Da Nang",
                    Status = TenantStatus.Active
                };
                var property = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Page Test Property",
                    Code = $"PP-{propId:N}"[..12],
                    Slug = $"page-prop-{propId:N}"[..24],
                    Address = "456 Tran Phu",
                    City = "Da Nang",
                    Status = PropertyStatus.Active
                };
                var roomType = new RoomType
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    Name = "Deluxe Room",
                    Code = "DLX",
                    BasePrice = 1000000m,
                    MaxOccupancy = 2
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.Add(property);
                seedCtx.RoomTypes.Add(roomType);
                await seedCtx.SaveChangesAsync();

                // Rooms 101-130: 30 rooms.
                // Rooms 101-125 (Floor 1-2): created on 2026-10-01.
                // Rooms 126-130 (Floor 3): created on 2026-10-09.
                // Under default sorting (Floor, RoomNumber), rooms 126-130 would be at index 26-30 (Page 2 if pageSize=20).
                var oldDate = new DateTime(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc);
                var todayUtc = new DateTime(2026, 10, 9, 8, 0, 0, DateTimeKind.Utc);

                for (int i = 1; i <= 25; i++)
                {
                    seedCtx.Rooms.Add(new Room
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        PropertyId = propId,
                        RoomTypeId = roomType.Id,
                        RoomNumber = $"1{i:D2}",
                        Floor = i <= 15 ? 1 : 2,
                        Status = RoomStatus.Clean,
                        IsActive = true,
                        CreatedAtUtc = oldDate,
                        UpdatedAtUtc = oldDate
                    });
                }

                for (int i = 26; i <= 30; i++)
                {
                    seedCtx.Rooms.Add(new Room
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        PropertyId = propId,
                        RoomTypeId = roomType.Id,
                        RoomNumber = $"1{i:D2}",
                        Floor = 3,
                        Status = RoomStatus.Clean,
                        IsActive = true,
                        CreatedAtUtc = todayUtc,
                        UpdatedAtUtc = todayUtc
                    });
                }
                await seedCtx.SaveChangesAsync();
            }

            await using var queryCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService);
            var handler = new GetRoomsQueryHandler(queryCtx);

            // Filter by 2026-10-09 with Page = 1, PageSize = 20:
            var startUtc = new DateTime(2026, 10, 8, 17, 0, 0, DateTimeKind.Utc);
            var endExclusiveUtc = new DateTime(2026, 10, 9, 17, 0, 0, DateTimeKind.Utc);

            var page1Result = await handler.Handle(
                new GetRoomsQuery(
                    PropertyId: propId,
                    Page: 1,
                    PageSize: 20,
                    CreatedFromUtc: startUtc,
                    CreatedToUtc: endExclusiveUtc),
                CancellationToken.None);

            // Verify: Because filter occurred BEFORE pagination, Page 1 now contains ALL 5 rooms!
            Assert.Equal(5, page1Result.TotalCount);
            Assert.Equal(5, page1Result.Items.Count);
            Assert.Contains(page1Result.Items, r => r.RoomNumber == "126");
            Assert.Contains(page1Result.Items, r => r.RoomNumber == "130");
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task GetRooms_DateFilter_BranchIsolation_Preserved()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propA = Guid.NewGuid();
            var propB = Guid.NewGuid();
            var tenantService = new MockTenantService { TenantId = tenantId };
            var propertyService = new MockPropertyService { PropertyId = propA };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Iso Tenant",
                    Code = $"IT-{tenantId:N}"[..12],
                    Slug = $"iso-tenant-{tenantId:N}"[..24],
                    Address = "789 Nguyen Van Linh",
                    City = "HCMC",
                    Status = TenantStatus.Active
                };
                var propertyA = new Property
                {
                    Id = propA,
                    TenantId = tenantId,
                    Name = "Branch A",
                    Code = $"BA-{propA:N}"[..12],
                    Slug = $"branch-a-{propA:N}"[..24],
                    Address = "Branch A Addr",
                    City = "HCMC",
                    Status = PropertyStatus.Active
                };
                var propertyB = new Property
                {
                    Id = propB,
                    TenantId = tenantId,
                    Name = "Branch B",
                    Code = $"BB-{propB:N}"[..12],
                    Slug = $"branch-b-{propB:N}"[..24],
                    Address = "Branch B Addr",
                    City = "HCMC",
                    Status = PropertyStatus.Active
                };
                var roomTypeA = new RoomType
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propA,
                    Name = "Type A",
                    Code = "TA",
                    BasePrice = 500000m,
                    MaxOccupancy = 2
                };
                var roomTypeB = new RoomType
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propB,
                    Name = "Type B",
                    Code = "TB",
                    BasePrice = 600000m,
                    MaxOccupancy = 2
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.AddRange(propertyA, propertyB);
                seedCtx.RoomTypes.AddRange(roomTypeA, roomTypeB);
                await seedCtx.SaveChangesAsync();

                var todayUtc = new DateTime(2026, 10, 9, 5, 0, 0, DateTimeKind.Utc);

                // 3 rooms in Branch A, 4 rooms in Branch B, all created on 2026-10-09
                for (int i = 1; i <= 3; i++)
                {
                    seedCtx.Rooms.Add(new Room
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        PropertyId = propA,
                        RoomTypeId = roomTypeA.Id,
                        RoomNumber = $"A{i}",
                        Floor = 1,
                        Status = RoomStatus.Clean,
                        IsActive = true,
                        CreatedAtUtc = todayUtc,
                        UpdatedAtUtc = todayUtc
                    });
                }
                for (int i = 1; i <= 4; i++)
                {
                    seedCtx.Rooms.Add(new Room
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        PropertyId = propB,
                        RoomTypeId = roomTypeB.Id,
                        RoomNumber = $"B{i}",
                        Floor = 1,
                        Status = RoomStatus.Clean,
                        IsActive = true,
                        CreatedAtUtc = todayUtc,
                        UpdatedAtUtc = todayUtc
                    });
                }
                await seedCtx.SaveChangesAsync();
            }

            await using var queryCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService);
            var handler = new GetRoomsQueryHandler(queryCtx);

            var startUtc = new DateTime(2026, 10, 8, 17, 0, 0, DateTimeKind.Utc);
            var endExclusiveUtc = new DateTime(2026, 10, 9, 17, 0, 0, DateTimeKind.Utc);

            // Query Branch A only
            var resultA = await handler.Handle(
                new GetRoomsQuery(
                    PropertyId: propA,
                    CreatedFromUtc: startUtc,
                    CreatedToUtc: endExclusiveUtc),
                CancellationToken.None);

            Assert.Equal(3, resultA.TotalCount);
            Assert.Equal(3, resultA.Items.Count);
            Assert.All(resultA.Items, r => Assert.Equal(propA, r.PropertyId));
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task GetRooms_TimezoneBoundary_AsiaHoChiMinh_CorrectHalfOpenInterval()
    {
        var testSchema = $"p2b01_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var tenantService = new MockTenantService { TenantId = tenantId };
            var propertyService = new MockPropertyService { PropertyId = propId };

            await using (var seedCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService))
            {
                await seedCtx.Database.MigrateAsync();

                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Timezone Tenant",
                    Code = $"TZT-{tenantId:N}"[..12],
                    Slug = $"tz-tenant-{tenantId:N}"[..24],
                    Address = "101 Hoang Sa",
                    City = "HCMC",
                    Status = TenantStatus.Active
                };
                var property = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Timezone Property",
                    Code = $"TZP-{propId:N}"[..12],
                    Slug = $"tz-prop-{propId:N}"[..24],
                    Address = "101 Hoang Sa",
                    City = "HCMC",
                    Status = PropertyStatus.Active
                };
                var roomType = new RoomType
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    Name = "TZ Room",
                    Code = "TZ",
                    BasePrice = 700000m,
                    MaxOccupancy = 2
                };

                seedCtx.Tenants.Add(tenant);
                seedCtx.Properties.Add(property);
                seedCtx.RoomTypes.Add(roomType);
                await seedCtx.SaveChangesAsync();

                // Date in Vietnam is 2026-10-09:
                // Vietnam 00:00:00 is UTC 2026-10-08 17:00:00Z.
                // Vietnam 23:59:59.999 is UTC 2026-10-09 16:59:59.999Z.
                // Next day 00:00:00 (endExclusive) is UTC 2026-10-09 17:00:00Z.

                // Room 1: 2026-10-08 16:59:00Z -> 23:59:00 on Oct 8 in VN (OUTSIDE, before)
                var rBefore = new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomType.Id,
                    RoomNumber = "R-BEFORE",
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    IsActive = true,
                    CreatedAtUtc = new DateTime(2026, 10, 8, 16, 59, 0, DateTimeKind.Utc),
                    UpdatedAtUtc = new DateTime(2026, 10, 8, 16, 59, 0, DateTimeKind.Utc)
                };

                // Room 2: 2026-10-08 17:00:00Z -> 00:00:00 on Oct 9 in VN (INSIDE, boundary start)
                var rExactStart = new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomType.Id,
                    RoomNumber = "R-START",
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    IsActive = true,
                    CreatedAtUtc = new DateTime(2026, 10, 8, 17, 0, 0, DateTimeKind.Utc),
                    UpdatedAtUtc = new DateTime(2026, 10, 8, 17, 0, 0, DateTimeKind.Utc)
                };

                // Room 3: 2026-10-09 05:00:00Z -> 12:00:00 on Oct 9 in VN (INSIDE, middle of day)
                var rMidDay = new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomType.Id,
                    RoomNumber = "R-MID",
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    IsActive = true,
                    CreatedAtUtc = new DateTime(2026, 10, 9, 5, 0, 0, DateTimeKind.Utc),
                    UpdatedAtUtc = new DateTime(2026, 10, 9, 5, 0, 0, DateTimeKind.Utc)
                };

                // Room 4: 2026-10-09 16:59:59Z -> 23:59:59 on Oct 9 in VN (INSIDE, boundary end)
                var rJustBeforeEnd = new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomType.Id,
                    RoomNumber = "R-LAST",
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    IsActive = true,
                    CreatedAtUtc = new DateTime(2026, 10, 9, 16, 59, 59, DateTimeKind.Utc),
                    UpdatedAtUtc = new DateTime(2026, 10, 9, 16, 59, 59, DateTimeKind.Utc)
                };

                // Room 5: 2026-10-09 17:00:00Z -> 00:00:00 on Oct 10 in VN (OUTSIDE, endExclusive)
                var rNextDay = new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomType.Id,
                    RoomNumber = "R-NEXT",
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    IsActive = true,
                    CreatedAtUtc = new DateTime(2026, 10, 9, 17, 0, 0, DateTimeKind.Utc),
                    UpdatedAtUtc = new DateTime(2026, 10, 9, 17, 0, 0, DateTimeKind.Utc)
                };

                seedCtx.Rooms.AddRange(rBefore, rExactStart, rMidDay, rJustBeforeEnd, rNextDay);
                await seedCtx.SaveChangesAsync();
            }

            await using var queryCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantService, propertyService);
            var handler = new GetRoomsQueryHandler(queryCtx);

            var startUtc = new DateTime(2026, 10, 8, 17, 0, 0, DateTimeKind.Utc);
            var endExclusiveUtc = new DateTime(2026, 10, 9, 17, 0, 0, DateTimeKind.Utc);

            var result = await handler.Handle(
                new GetRoomsQuery(
                    PropertyId: propId,
                    CreatedFromUtc: startUtc,
                    CreatedToUtc: endExclusiveUtc),
                CancellationToken.None);

            // Exactly 3 rooms must be returned (R-START, R-MID, R-LAST).
            // R-BEFORE and R-NEXT must NOT be returned!
            Assert.Equal(3, result.TotalCount);
            Assert.Equal(3, result.Items.Count);
            var numbers = result.Items.Select(r => r.RoomNumber).ToList();
            Assert.Contains("R-START", numbers);
            Assert.Contains("R-MID", numbers);
            Assert.Contains("R-LAST", numbers);
            Assert.DoesNotContain("R-BEFORE", numbers);
            Assert.DoesNotContain("R-NEXT", numbers);
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
