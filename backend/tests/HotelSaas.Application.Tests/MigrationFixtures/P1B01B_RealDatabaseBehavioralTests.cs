using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Xunit;
using Xunit.Abstractions;

namespace HotelSaas.Application.Tests.MigrationFixtures;

/// <summary>
/// Comprehensive behavioral tests for Package P1B-01B:
/// Multi-Property Domain Model, EF Core Mappings, Migration Backfill,
/// Cross-Scope Database Constraints, and RESTRICT Deletion Protection.
/// Executed on an isolated PostgreSQL test database with dedicated schemas.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class P1B01B_RealDatabaseBehavioralTests
{
    private readonly ITestOutputHelper _output;

    public P1B01B_RealDatabaseBehavioralTests(ITestOutputHelper output)
    {
        _output = output;
    }

    private static string GetConnectionString()
    {
        var rawConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
               ?? Environment.GetEnvironmentVariable("HOTEL_SAAS_TEST_CONNECTION_STRING")
               ?? "Host=localhost;Port=5432;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;";

        var builder = new NpgsqlConnectionStringBuilder(rawConn)
        {
            Pooling = false
        };
        return builder.ConnectionString;
    }

    private static void ValidateTestDatabaseTarget(string connStr)
    {
        PostgresTestDatabaseGuard.ValidateConnectionTarget(connStr);
    }

    private static string RedactConnectionString(string connStr)
    {
        try
        {
            var builder = new NpgsqlConnectionStringBuilder(connStr);
            if (!string.IsNullOrEmpty(builder.Password))
            {
                builder.Password = "******";
            }
            return builder.ConnectionString;
        }
        catch
        {
            return "[REDACTED_MALFORMED_CONNECTION_STRING]";
        }
    }

    private static readonly string FixturesDirectory =
        Directory.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Fixtures", "P1B01A"))
            ? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Fixtures", "P1B01A")
            : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "Fixtures", "P1B01A");

    private sealed class TestCurrentTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; } = null;
    }

    private static ApplicationDbContext CreateDbContext(string connString, string testSchema, Guid? tenantId = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(connString)
        {
            SearchPath = testSchema,
            Pooling = false
        };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .Options;
        return new ApplicationDbContext(options, new TestCurrentTenantService { TenantId = tenantId });
    }

    private async Task<NpgsqlConnection> CreateTestConnectionAsync(string testSchema)
    {
        var connStr = GetConnectionString();
        ValidateTestDatabaseTarget(connStr);

        var conn = new NpgsqlConnection(connStr);
        try
        {
            await conn.OpenAsync();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"[TEST HARNESS FAILURE] Could not connect to PostgreSQL test database at '{RedactConnectionString(connStr)}'.", ex);
        }

        // Ensure btree_gist extension is safely initialized in stable 'public' schema under database advisory lock
        await PostgresExtensionLifecycleHelper.EnsureBtreeGistExtensionAsync(conn);

        // Isolate in dedicated test schema, exclude public
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{testSchema}\"; SET search_path TO \"{testSchema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        return conn;
    }

    private async Task CleanupTestSchemaAsync(NpgsqlConnection conn, string testSchema)
    {
        if (!Regex.IsMatch(testSchema, @"^p1b01(a|b)_(test|drift)_[a-zA-Z0-9]+$"))
        {
            throw new ArgumentException($"Invalid schema name '{testSchema}' - refusing to drop unauthorized schema.", nameof(testSchema));
        }

        if (conn.State != System.Data.ConnectionState.Open)
        {
            await conn.OpenAsync();
        }

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SET search_path TO public; DROP SCHEMA IF EXISTS \"{testSchema}\" CASCADE;";
        await cmd.ExecuteNonQueryAsync();

        NpgsqlConnection.ClearAllPools();
    }

    [Fact]
    public async Task Behavior_01_FreshDbBaseline_Allows_MultiProperty_Creation_Under_Same_Tenant()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // 1. Initialize schema via REAL EF Core Migrations (InitialBaseline -> MultiProperty_Foundation)
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            // Verify __EFMigrationsHistory contains both migrations
            await using (var histCmd = conn.CreateCommand())
            {
                histCmd.CommandText = "SELECT \"MigrationId\" FROM \"__EFMigrationsHistory\" ORDER BY \"MigrationId\";";
                await using var reader = await histCmd.ExecuteReaderAsync();
                var appliedMigrations = new List<string>();
                while (await reader.ReadAsync())
                {
                    appliedMigrations.Add(reader.GetString(0));
                }
                Assert.Contains("20261006000000_InitialBaseline", appliedMigrations);
                Assert.Contains("20261006105053_P1B01B_MultiProperty_Foundation", appliedMigrations);
            }

            var tenantId = Guid.NewGuid();

            // 2. Use EF Core ApplicationDbContext to create Tenant and multiple Properties
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Sen Vàng Hospitality Group",
                    Code = "SENVANG",
                    Slug = "sen-vang-group",
                    Address = "123 Tran Hung Dao",
                    City = "Da Nang",
                    Status = TenantStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                var propHanoi = new Property
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Name = "Sen Vàng Hà Nội",
                    Code = "SV-HN",
                    Slug = "sen-vang-ha-noi",
                    Address = "10 Hang Bong, Hoan Kiem",
                    City = "Hanoi",
                    PropertyType = PropertyType.Hotel,
                    CheckInTime = new TimeOnly(12, 0, 0),
                    CheckOutTime = new TimeOnly(12, 0, 0),
                    BufferMinutes = 30,
                    TaxRatePercent = 8.00m,
                    ServiceFeeRatePercent = 5.00m,
                    IsPublished = false,
                    Status = PropertyStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                var propDaNang = new Property
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Name = "Sen Vàng Đà Nẵng Beach Resort",
                    Code = "SV-DN",
                    Slug = "sen-vang-da-nang",
                    Address = "200 Vo Nguyen Giap",
                    City = "Da Nang",
                    PropertyType = PropertyType.Resort,
                    CheckInTime = new TimeOnly(14, 0, 0),
                    CheckOutTime = new TimeOnly(11, 0, 0),
                    BufferMinutes = 45,
                    TaxRatePercent = 10.00m,
                    ServiceFeeRatePercent = 7.00m,
                    IsPublished = false,
                    Status = PropertyStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.AddRange(propHanoi, propDaNang);
                await ctx.SaveChangesAsync();
            }

            // 3. Query back and verify both properties exist under the same tenant
            await using (var verifyCtx = CreateDbContext(conn.ConnectionString, testSchema, tenantId))
            {
                var tenantWithProps = await verifyCtx.Tenants
                    .Include(t => t.Properties)
                    .FirstOrDefaultAsync(t => t.Code == "SENVANG");

                Assert.NotNull(tenantWithProps);
                Assert.Equal(2, tenantWithProps.Properties.Count);

                var hn = await verifyCtx.Properties.FirstOrDefaultAsync(p => p.Code == "SV-HN");
                Assert.NotNull(hn);
                Assert.Equal("Hanoi", hn.City);
                Assert.Equal(8.00m, hn.TaxRatePercent);

                var dn = await verifyCtx.Properties.FirstOrDefaultAsync(p => p.Code == "SV-DN");
                Assert.NotNull(dn);
                Assert.Equal(PropertyType.Resort, dn.PropertyType);
                Assert.Equal(45, dn.BufferMinutes);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_02_Composite_FK_Prevents_Room_From_Referencing_RoomType_In_Different_Property()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // Initialize schema via real EF Core Migrations
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            var tenantId = Guid.NewGuid();
            var propAId = Guid.NewGuid();
            var propBId = Guid.NewGuid();
            var roomTypeBId = Guid.NewGuid();

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Multi Branch Group",
                    Code = "MBG",
                    Slug = "mbg",
                    Address = "Add 1",
                    City = "City 1",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var propA = new Property
                {
                    Id = propAId,
                    TenantId = tenantId,
                    Name = "Branch A",
                    Code = "BRA",
                    Slug = "bra",
                    Address = "Add A",
                    City = "City A",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var propB = new Property
                {
                    Id = propBId,
                    TenantId = tenantId,
                    Name = "Branch B",
                    Code = "BRB",
                    Slug = "brb",
                    Address = "Add B",
                    City = "City B",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var roomTypeB = new RoomType
                {
                    Id = roomTypeBId,
                    TenantId = tenantId,
                    PropertyId = propBId, // Belongs to Property B
                    Name = "Suite Deluxe",
                    Code = "DLX-B",
                    BasePrice = 1200000m,
                    MaxOccupancy = 2,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.AddRange(propA, propB);
                ctx.RoomTypes.Add(roomTypeB);
                await ctx.SaveChangesAsync();
            }

            // Attempt to create a Room in Property A that references RoomType in Property B
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var invalidRoom = new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propAId, // Property A
                    RoomTypeId = roomTypeBId, // RoomType belongs to Property B!
                    RoomNumber = "101",
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Rooms.Add(invalidRoom);

                var ex = await Assert.ThrowsAsync<DbUpdateException>(async () =>
                {
                    await ctx.SaveChangesAsync();
                });

                var pex = Assert.IsType<PostgresException>(ex.InnerException);
                Assert.Equal("23503", pex.SqlState); // foreign_key_violation
                Assert.Contains("FK_Rooms_RoomTypes_Property_RoomType", pex.ConstraintName);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_03_Composite_FK_Prevents_Reservation_From_Booking_Room_In_Different_Property()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // Initialize schema via real EF Core Migrations
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            var tenantId = Guid.NewGuid();
            var propAId = Guid.NewGuid();
            var propBId = Guid.NewGuid();
            var roomTypeAId = Guid.NewGuid();
            var roomAId = Guid.NewGuid();

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Test Tenant",
                    Code = "TT",
                    Slug = "tt",
                    Address = "Add",
                    City = "City",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var propA = new Property
                {
                    Id = propAId,
                    TenantId = tenantId,
                    Name = "Property A",
                    Code = "PA",
                    Slug = "pa",
                    Address = "Add A",
                    City = "City A",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var propB = new Property
                {
                    Id = propBId,
                    TenantId = tenantId,
                    Name = "Property B",
                    Code = "PB",
                    Slug = "pb",
                    Address = "Add B",
                    City = "City B",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var roomTypeA = new RoomType
                {
                    Id = roomTypeAId,
                    TenantId = tenantId,
                    PropertyId = propAId,
                    Name = "Standard Room",
                    Code = "STD-A",
                    BasePrice = 500000m,
                    MaxOccupancy = 2,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var roomA = new Room
                {
                    Id = roomAId,
                    TenantId = tenantId,
                    PropertyId = propAId, // Room is in Property A
                    RoomTypeId = roomTypeAId,
                    RoomNumber = "A-101",
                    Floor = 1,
                    Status = RoomStatus.Clean,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.AddRange(propA, propB);
                ctx.RoomTypes.Add(roomTypeA);
                ctx.Rooms.Add(roomA);
                await ctx.SaveChangesAsync();
            }

            // Attempt to book a reservation in Property B, but pointing to Room in Property A
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var invalidReservation = new Reservation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propBId, // Property B
                    RoomId = roomAId,      // Room A belongs to Property A!
                    GuestName = "Nguyen Van A",
                    GuestEmail = "guest@example.com",
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    ConfirmationCode = "CNF123",
                    TotalAmount = 500000m,
                    Status = ReservationStatus.Confirmed,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Reservations.Add(invalidReservation);

                var ex = await Assert.ThrowsAsync<DbUpdateException>(async () =>
                {
                    await ctx.SaveChangesAsync();
                });

                var pex = Assert.IsType<PostgresException>(ex.InnerException);
                Assert.Equal("23503", pex.SqlState);
                Assert.Contains("FK_Reservations_Rooms_Property_Room", pex.ConstraintName);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_04_Composite_FK_Prevents_Payment_From_Crossing_Reservation_Property_Boundary()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // Initialize schema via real EF Core Migrations
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            var tenantId = Guid.NewGuid();
            var propAId = Guid.NewGuid();
            var propBId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var roomId = Guid.NewGuid();
            var resAId = Guid.NewGuid();

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Tenant Payment Test",
                    Code = "TPT",
                    Slug = "tpt",
                    Address = "Add",
                    City = "City",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var propA = new Property
                {
                    Id = propAId,
                    TenantId = tenantId,
                    Name = "Prop A",
                    Code = "PA",
                    Slug = "pa",
                    Address = "A",
                    City = "A",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var propB = new Property
                {
                    Id = propBId,
                    TenantId = tenantId,
                    Name = "Prop B",
                    Code = "PB",
                    Slug = "pb",
                    Address = "B",
                    City = "B",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var roomType = new RoomType
                {
                    Id = roomTypeId,
                    TenantId = tenantId,
                    PropertyId = propAId,
                    Name = "Type A",
                    Code = "TA",
                    BasePrice = 100m,
                    MaxOccupancy = 1,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var room = new Room
                {
                    Id = roomId,
                    TenantId = tenantId,
                    PropertyId = propAId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "A1",
                    Floor = 1,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var resA = new Reservation
                {
                    Id = resAId,
                    TenantId = tenantId,
                    PropertyId = propAId, // Reservation belongs to Property A
                    RoomId = roomId,
                    GuestName = "Guest",
                    GuestEmail = "guest@test.com",
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    ConfirmationCode = "CF1",
                    TotalAmount = 100m,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.AddRange(propA, propB);
                ctx.RoomTypes.Add(roomType);
                ctx.Rooms.Add(room);
                ctx.Reservations.Add(resA);
                await ctx.SaveChangesAsync();
            }

            // Attempt to record payment in Property B for Reservation A (Property A)
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var invalidPayment = new Payment
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    PropertyId = propBId, // Property B!
                    ReservationId = resAId, // Belongs to Property A!
                    Amount = 100m,
                    Method = PaymentMethod.Cash,
                    Status = PaymentStatus.Completed,
                    PaidAtUtc = DateTime.UtcNow,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Payments.Add(invalidPayment);

                var ex = await Assert.ThrowsAsync<DbUpdateException>(async () =>
                {
                    await ctx.SaveChangesAsync();
                });

                var pex = Assert.IsType<PostgresException>(ex.InnerException);
                Assert.Equal("23503", pex.SqlState);
                Assert.Contains("FK_Payments_Reservations_Property_Res", pex.ConstraintName);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_05_TenantStaff_Partial_Unique_Indexes_Enforce_TenantWide_Vs_PropertyScoped_Membership()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // Initialize schema via real EF Core Migrations
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            var tenantId = Guid.NewGuid();
            var prop1Id = Guid.NewGuid();
            var prop2Id = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var userOwnerId = Guid.NewGuid();
            var userStaffId = Guid.NewGuid();

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Membership Tenant",
                    Code = "MT",
                    Slug = "mt",
                    Address = "Add",
                    City = "City",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var prop1 = new Property
                {
                    Id = prop1Id,
                    TenantId = tenantId,
                    Name = "Prop 1",
                    Code = "P1",
                    Slug = "p1",
                    Address = "A",
                    City = "A",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var prop2 = new Property
                {
                    Id = prop2Id,
                    TenantId = tenantId,
                    Name = "Prop 2",
                    Code = "P2",
                    Slug = "p2",
                    Address = "B",
                    City = "B",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var role = new AccessRole
                {
                    Id = roleId,
                    TenantId = tenantId,
                    Name = "Role 1",
                    Code = "R1",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var userOwner = new User
                {
                    Id = userOwnerId,
                    Username = "owner_user",
                    Email = "owner@test.com",
                    PasswordHash = "hash",
                    FullName = "Owner",
                    GlobalRole = GlobalUserRole.TenantStaff,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var userStaff = new User
                {
                    Id = userStaffId,
                    Username = "staff_user",
                    Email = "staff@test.com",
                    PasswordHash = "hash",
                    FullName = "Staff",
                    GlobalRole = GlobalUserRole.TenantStaff,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.AddRange(prop1, prop2);
                ctx.AccessRoles.Add(role);
                ctx.Users.AddRange(userOwner, userStaff);
                await ctx.SaveChangesAsync();
            }

            // Case A: Tenant-wide member (Owner: PropertyId = null)
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var ownerStaff = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userOwnerId,
                    RoleId = roleId,
                    StaffRole = StaffRole.Owner,
                    PropertyId = null, // Tenant-wide
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                ctx.TenantStaffMembers.Add(ownerStaff);
                await ctx.SaveChangesAsync();
            }

            // Attempt duplicate Tenant-wide assignment for the same user -> Should fail uq_tenant_staff_tenant_wide
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var duplicateOwner = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userOwnerId,
                    RoleId = roleId,
                    StaffRole = StaffRole.Owner,
                    PropertyId = null,
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                ctx.TenantStaffMembers.Add(duplicateOwner);

                var ex = await Assert.ThrowsAsync<DbUpdateException>(async () =>
                {
                    await ctx.SaveChangesAsync();
                });

                var pex = Assert.IsType<PostgresException>(ex.InnerException);
                Assert.Equal("23505", pex.SqlState); // unique_violation
                Assert.Contains("uq_tenant_staff_tenant_wide", pex.ConstraintName);
            }

            // Case B: Property-scoped member (Manager: PropertyId = prop1Id)
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var managerStaffP1 = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userStaffId,
                    RoleId = roleId,
                    StaffRole = StaffRole.Manager,
                    PropertyId = prop1Id, // Scoped to Property 1
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                ctx.TenantStaffMembers.Add(managerStaffP1);
                await ctx.SaveChangesAsync();
            }

            // Duplicate on the SAME Property 1 -> Should fail uq_tenant_staff_property_scoped
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var duplicateManagerP1 = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userStaffId,
                    RoleId = roleId,
                    StaffRole = StaffRole.Manager,
                    PropertyId = prop1Id,
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                ctx.TenantStaffMembers.Add(duplicateManagerP1);

                var ex = await Assert.ThrowsAsync<DbUpdateException>(async () =>
                {
                    await ctx.SaveChangesAsync();
                });

                var pex = Assert.IsType<PostgresException>(ex.InnerException);
                Assert.Equal("23505", pex.SqlState);
                Assert.Contains("uq_tenant_staff_property_scoped", pex.ConstraintName);
            }

            // Assignment to DIFFERENT Property 2 -> Allowed!
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var managerStaffP2 = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userStaffId,
                    RoleId = roleId,
                    StaffRole = StaffRole.Manager,
                    PropertyId = prop2Id, // Scoped to Property 2
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                ctx.TenantStaffMembers.Add(managerStaffP2);
                await ctx.SaveChangesAsync();

                Assert.False(managerStaffP2.IsTenantWide);
                Assert.Equal(prop2Id, managerStaffP2.PropertyId);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_06_Restrict_Delete_Prevents_Cascading_Deletion_Of_Operational_Data()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // Initialize schema via real EF Core Migrations
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            var tenantId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var roomId = Guid.NewGuid();

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Restrict Tenant",
                    Code = "RT",
                    Slug = "rt",
                    Address = "Add",
                    City = "City",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var prop = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Protected Property",
                    Code = "PP",
                    Slug = "pp",
                    Address = "Add",
                    City = "City",
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var roomType = new RoomType
                {
                    Id = roomTypeId,
                    TenantId = tenantId,
                    PropertyId = propId,
                    Name = "Type",
                    Code = "TY",
                    BasePrice = 100m,
                    MaxOccupancy = 1,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                var room = new Room
                {
                    Id = roomId,
                    TenantId = tenantId,
                    PropertyId = propId,
                    RoomTypeId = roomTypeId,
                    RoomNumber = "101",
                    Floor = 1,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(prop);
                ctx.RoomTypes.Add(roomType);
                ctx.Rooms.Add(room);
                await ctx.SaveChangesAsync();
            }

            // Attempt to delete Property via SQL DELETE command
            await using (var delCmd = conn.CreateCommand())
            {
                delCmd.CommandText = $"DELETE FROM \"Properties\" WHERE \"Id\" = '{propId}';";
                var ex = await Assert.ThrowsAsync<PostgresException>(async () =>
                {
                    await delCmd.ExecuteNonQueryAsync();
                });

                // PostgreSQL raises SQLSTATE 23001 (restrict_violation) for ON DELETE RESTRICT
                Assert.True(ex.SqlState == "23001" || ex.SqlState == "23503");
                Assert.True(
                    ex.ConstraintName == "FK_RoomTypes_Properties_PropertyId" || 
                    ex.ConstraintName == "FK_Rooms_Properties_PropertyId");
            }

            // Verify that the property and its room are still completely intact
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantId))
            {
                var propStillExists = await ctx.Properties.AnyAsync(p => p.Id == propId);
                var roomStillExists = await ctx.Rooms.AnyAsync(r => r.Id == roomId);
                Assert.True(propStillExists);
                Assert.True(roomStillExists);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_07_ExistingDb_Migration_And_Backfill_Enables_EFCore_MultiProperty_Queries()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // 1. Seed legacy EnsureCreated baseline (22 tables, no Property)
            var legacyDdl = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "00_LegacyEnsureCreatedBaseline.sql"));
            await using (var ddlCmd = conn.CreateCommand())
            {
                ddlCmd.CommandText = legacyDdl;
                await ddlCmd.ExecuteNonQueryAsync();
            }

            // 2. Seed legacy operational data
            var tenantId = Guid.NewGuid();
            var ownerId = Guid.NewGuid();
            var managerId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var roomId = Guid.NewGuid();
            var resId = Guid.NewGuid();
            var payId = Guid.NewGuid();
            var roleId = Guid.NewGuid();

            await using (var seedCmd = conn.CreateCommand())
            {
                seedCmd.CommandText = $@"
                    INSERT INTO ""Tenants"" (""Id"", ""Name"", ""Code"", ""Slug"", ""Address"", ""City"", ""PhoneNumber"", ""Email"", ""PropertyType"", ""StarRating"", ""CheckInTime"", ""CheckOutTime"", ""TaxRatePercent"", ""ServiceFeeRatePercent"", ""SubscriptionTier"", ""Status"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{tenantId}', 'Khách Sạn Biển Đông', 'BIENDONG', 'bien-dong', '12 Bach Dang', 'Da Nang', '0901234567', 'info@biendong.vn', 1, 4, '14:00:00', '12:00:00', 10.00, 5.00, 2, 2, NOW(), NOW());

                    INSERT INTO ""Users"" (""Id"", ""Username"", ""Email"", ""PasswordHash"", ""FullName"", ""GlobalRole"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES 
                    ('{ownerId}', 'owner_bd', 'owner@biendong.vn', 'hash', 'Chủ Khách Sạn', 3, true, NOW(), NOW()),
                    ('{managerId}', 'mgr_bd', 'mgr@biendong.vn', 'hash', 'Quản Lý Chi Nhánh', 3, true, NOW(), NOW());

                    INSERT INTO ""AccessRoles"" (""Id"", ""TenantId"", ""Name"", ""Code"", ""IsSystemRole"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{roleId}', '{tenantId}', 'Staff Role', 'STAFF', false, NOW(), NOW());

                    INSERT INTO ""TenantStaffMembers"" (""Id"", ""TenantId"", ""UserId"", ""RoleId"", ""StaffRole"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES 
                    (gen_random_uuid(), '{tenantId}', '{ownerId}', '{roleId}', 1, true, NOW(), NOW()),
                    (gen_random_uuid(), '{tenantId}', '{managerId}', '{roleId}', 2, true, NOW(), NOW());

                    INSERT INTO ""RoomTypes"" (""Id"", ""TenantId"", ""Name"", ""Code"", ""BasePrice"", ""MaxOccupancy"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{roomTypeId}', '{tenantId}', 'Deluxe Sea View', 'DLX-SEA', 1500000, 2, NOW(), NOW());

                    INSERT INTO ""Rooms"" (""Id"", ""TenantId"", ""RoomTypeId"", ""RoomNumber"", ""Floor"", ""Status"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{roomId}', '{tenantId}', '{roomTypeId}', '501', 5, 1, true, NOW(), NOW());

                    INSERT INTO ""Reservations"" (""Id"", ""TenantId"", ""RoomId"", ""GuestName"", ""GuestEmail"", ""CheckInDate"", ""CheckOutDate"", ""ConfirmationCode"", ""NumberOfGuests"", ""TotalAmount"", ""Status"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{resId}', '{tenantId}', '{roomId}', 'Tran Thi Khach', 'khach@test.com', '2026-10-10', '2026-10-12', 'BD501A', 2, 3000000, 2, NOW(), NOW());

                    INSERT INTO ""Payments"" (""Id"", ""TenantId"", ""ReservationId"", ""Amount"", ""Method"", ""Status"", ""PaidAtUtc"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{payId}', '{tenantId}', '{resId}', 3000000, 1, 2, NOW(), NOW(), NOW());
                ";
                await seedCmd.ExecuteNonQueryAsync();
            }

            // 3. Execute Script 01 (Pre-Check & Recovery)
            // Strictly verifies 100% of 22 baseline tables, 134 columns, 26 FKs, indexes
            // and stamps '20261006000000_InitialBaseline'
            var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
            await using (var cmd01 = conn.CreateCommand())
            {
                cmd01.CommandText = sql01;
                await cmd01.ExecuteNonQueryAsync();
            }

            // 4. Execute REAL EF Core Migration via Database.MigrateAsync()
            // EF Core detects 20261006000000_InitialBaseline is ALREADY stamped!
            // It ONLY runs 20261006105053_P1B01B_MultiProperty_Foundation:
            // Creates Properties, adds PropertyId columns, executes backfill SQL, alters columns to NOT NULL, and adds composite FKs!
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            // 5. Verify __EFMigrationsHistory contains both migrations
            await using (var histCmd = conn.CreateCommand())
            {
                histCmd.CommandText = "SELECT \"MigrationId\" FROM \"__EFMigrationsHistory\" ORDER BY \"MigrationId\";";
                await using var reader = await histCmd.ExecuteReaderAsync();
                var applied = new List<string>();
                while (await reader.ReadAsync())
                {
                    applied.Add(reader.GetString(0));
                }
                Assert.Contains("20261006000000_InitialBaseline", applied);
                Assert.Contains("20261006105053_P1B01B_MultiProperty_Foundation", applied);
            }

            // 6. Validate through EF Core ApplicationDbContext
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema, tenantId))
            {
                // Property created
                var properties = await ctx.Properties.ToListAsync();
                Assert.Single(properties);
                var mainProp = properties[0];
                Assert.Equal("MAIN", mainProp.Code);
                Assert.Equal("Khách Sạn Biển Đông - Chi nhánh chính", mainProp.Name);
                Assert.Equal(10.00m, mainProp.TaxRatePercent);
                Assert.Equal(5.00m, mainProp.ServiceFeeRatePercent);
                Assert.False(mainProp.IsPublished); // Preserved safe publication status

                // Staff membership backfill
                var staffMembers = await ctx.TenantStaffMembers.ToListAsync();
                Assert.Equal(2, staffMembers.Count);

                var owner = staffMembers.Find(s => s.StaffRole == StaffRole.Owner);
                Assert.NotNull(owner);
                Assert.Null(owner.PropertyId);
                Assert.True(owner.IsTenantWide);

                var manager = staffMembers.Find(s => s.StaffRole == StaffRole.Manager);
                Assert.NotNull(manager);
                Assert.Equal(mainProp.Id, manager.PropertyId);
                Assert.False(manager.IsTenantWide);

                // Rooms and RoomTypes backfill
                var rooms = await ctx.Rooms.Include(r => r.Property).Include(r => r.RoomType).ToListAsync();
                Assert.Single(rooms);
                Assert.Equal(mainProp.Id, rooms[0].PropertyId);
                Assert.Equal(mainProp.Id, rooms[0].RoomType!.PropertyId);
                Assert.Equal("501", rooms[0].RoomNumber);

                // Reservations and Payments backfill
                var reservations = await ctx.Reservations.Include(res => res.Property).ToListAsync();
                Assert.Single(reservations);
                Assert.Equal(mainProp.Id, reservations[0].PropertyId);

                var payments = await ctx.Payments.Include(p => p.Property).ToListAsync();
                Assert.Single(payments);
                Assert.Equal(mainProp.Id, payments[0].PropertyId);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_08_EFCore_Migration_Rollback_To_Baseline_And_Reapply_Forward()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // 1. Seed legacy EnsureCreated baseline schema & operational data
            var legacyDdl = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "00_LegacyEnsureCreatedBaseline.sql"));
            await using (var ddlCmd = conn.CreateCommand())
            {
                ddlCmd.CommandText = legacyDdl;
                await ddlCmd.ExecuteNonQueryAsync();
            }

            var tenantId = Guid.NewGuid();
            var roomTypeId = Guid.NewGuid();
            var roomId = Guid.NewGuid();
            await using (var seedCmd = conn.CreateCommand())
            {
                seedCmd.CommandText = $@"
                    INSERT INTO ""Tenants"" (""Id"", ""Name"", ""Code"", ""Slug"", ""Address"", ""City"", ""PhoneNumber"", ""Email"", ""PropertyType"", ""StarRating"", ""CheckInTime"", ""CheckOutTime"", ""TaxRatePercent"", ""ServiceFeeRatePercent"", ""SubscriptionTier"", ""Status"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{tenantId}', 'Khách Sạn Rollback Test', 'ROLLBACK', 'rollback-test', '1 Le Duan', 'Hanoi', '0909999999', 'info@rollback.vn', 1, 3, '12:00:00', '12:00:00', 8.00, 0.00, 1, 1, NOW(), NOW());

                    INSERT INTO ""RoomTypes"" (""Id"", ""TenantId"", ""Name"", ""Code"", ""BasePrice"", ""MaxOccupancy"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{roomTypeId}', '{tenantId}', 'Standard', 'STD-RB', 800000, 2, NOW(), NOW());

                    INSERT INTO ""Rooms"" (""Id"", ""TenantId"", ""RoomTypeId"", ""RoomNumber"", ""Floor"", ""Status"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{roomId}', '{tenantId}', '{roomTypeId}', '101', 1, 1, true, NOW(), NOW());
                ";
                await seedCmd.ExecuteNonQueryAsync();
            }

            // 2. Pre-check stamps 20261006000000_InitialBaseline
            var sql01 = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "01_SchemaPreCheckAndRecovery.sql"));
            await using (var cmd01 = conn.CreateCommand())
            {
                cmd01.CommandText = sql01;
                await cmd01.ExecuteNonQueryAsync();
            }

            // 3. Migrate forward to latest via EF Core MigrateAsync()
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await ctx.Database.MigrateAsync();
            }

            // Verify Properties exists and Room has PropertyId
            await using (var chkCmd = conn.CreateCommand())
            {
                chkCmd.CommandText = @"
                    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'Properties') AND
                           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Rooms' AND column_name = 'PropertyId');
                ";
                var existsBeforeRollback = (bool)(await chkCmd.ExecuteScalarAsync())!;
                Assert.True(existsBeforeRollback);
            }

            // 4. EXECUTE REAL EF CORE ROLLBACK: Migrate back to InitialBaseline
            await using (var rollbackCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var migrator = rollbackCtx.Database.GetService<IMigrator>();
                await migrator.MigrateAsync("20261006000000_InitialBaseline");
            }

            // 5. Verify Rollback Evidence:
            // - Properties table is DROPPED
            // - PropertyId column on Rooms is DROPPED
            // - __EFMigrationsHistory ONLY contains InitialBaseline
            // - Baseline table data is PRESERVED
            await using (var vfyRollback = conn.CreateCommand())
            {
                vfyRollback.CommandText = @"
                    SELECT 
                        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'Properties'),
                        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Rooms' AND column_name = 'PropertyId'),
                        (SELECT COUNT(*) FROM ""__EFMigrationsHistory""),
                        (SELECT ""MigrationId"" FROM ""__EFMigrationsHistory"" LIMIT 1),
                        (SELECT COUNT(*) FROM ""Rooms"" WHERE ""RoomNumber"" = '101')
                ";
                await using var rdr = await vfyRollback.ExecuteReaderAsync();
                Assert.True(await rdr.ReadAsync());
                var propTableExists = rdr.GetBoolean(0);
                var roomPropColExists = rdr.GetBoolean(1);
                var histCount = rdr.GetInt64(2);
                var onlyMigration = rdr.GetString(3);
                var roomCount = rdr.GetInt64(4);

                Assert.False(propTableExists, "Properties table must be dropped after rollback to InitialBaseline.");
                Assert.False(roomPropColExists, "PropertyId column on Rooms must be dropped after rollback.");
                Assert.Equal(1, histCount);
                Assert.Equal("20261006000000_InitialBaseline", onlyMigration);
                Assert.Equal(1, roomCount);
            }

            // 6. EXECUTE REAL EF CORE FORWARD MIGRATION AGAIN (Idempotency verification)
            await using (var forwardCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var migrator = forwardCtx.Database.GetService<IMigrator>();
                await migrator.MigrateAsync("20261006105053_P1B01B_MultiProperty_Foundation");
            }

            // 7. Verify Forward Migration Evidence:
            // - Properties re-created
            // - Rooms.PropertyId re-added and backfilled
            // - Both migrations recorded
            await using (var vfyForward = conn.CreateCommand())
            {
                vfyForward.CommandText = @"
                    SELECT 
                        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'Properties'),
                        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Rooms' AND column_name = 'PropertyId'),
                        (SELECT COUNT(*) FROM ""__EFMigrationsHistory"")
                ";
                await using var rdr = await vfyForward.ExecuteReaderAsync();
                Assert.True(await rdr.ReadAsync());
                Assert.True(rdr.GetBoolean(0));
                Assert.True(rdr.GetBoolean(1));
                Assert.Equal(2, rdr.GetInt64(2));
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_09_Migration_Backfill_Maps_Tenant_Status_To_Property_Status_Correctly()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // 1. Seed legacy EnsureCreated baseline schema
            var legacyDdl = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "00_LegacyEnsureCreatedBaseline.sql"));
            await using (var ddlCmd = conn.CreateCommand())
            {
                ddlCmd.CommandText = legacyDdl;
                await ddlCmd.ExecuteNonQueryAsync();
            }

            var tActiveId = Guid.NewGuid();
            var tSuspendedId = Guid.NewGuid();
            var tPendingId = Guid.NewGuid();

            // 2. Insert 3 tenants with different statuses
            await using (var seedCmd = conn.CreateCommand())
            {
                seedCmd.CommandText = $@"
                    INSERT INTO ""Tenants"" (""Id"", ""Name"", ""Code"", ""Slug"", ""Address"", ""City"", ""PhoneNumber"", ""Email"", ""PropertyType"", ""StarRating"", ""CheckInTime"", ""CheckOutTime"", ""TaxRatePercent"", ""ServiceFeeRatePercent"", ""SubscriptionTier"", ""Status"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES 
                        ('{tActiveId}', 'Active Tenant', 'T-ACT', 'active-tenant', '123 Street', 'Hanoi', '0901111111', 'active@test.com', 1, 4, '14:00:00', '12:00:00', 8.0, 5.0, 1, 2, NOW(), NOW()),
                        ('{tSuspendedId}', 'Suspended Tenant', 'T-SUSP', 'suspended-tenant', '456 Street', 'Danang', '0902222222', 'suspended@test.com', 1, 3, '14:00:00', '12:00:00', 10.0, 0.0, 1, 3, NOW(), NOW()),
                        ('{tPendingId}', 'Pending Tenant', 'T-PEND', 'pending-tenant', '789 Street', 'HCMC', '0903333333', 'pending@test.com', 1, 2, '14:00:00', '12:00:00', 0.0, 0.0, 1, 1, NOW(), NOW());
                ";
                await seedCmd.ExecuteNonQueryAsync();
            }

            // 3. Stamp baseline migration history
            await using (var stampCmd = conn.CreateCommand())
            {
                stampCmd.CommandText = @"
                    CREATE TABLE IF NOT EXISTS ""__EFMigrationsHistory"" (
                        ""MigrationId"" character varying(150) NOT NULL CONSTRAINT ""PK___EFMigrationsHistory"" PRIMARY KEY,
                        ""ProductVersion"" character varying(32) NOT NULL
                    );
                    INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                    VALUES ('20261006000000_InitialBaseline', '10.0.12');
                ";
                await stampCmd.ExecuteNonQueryAsync();
            }

            // 4. Run EF Core MigrateAsync
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await ctx.Database.MigrateAsync();
            }

            // 5. Query and verify Property status mapping:
            // Active Tenant (2) -> Property Active (1)
            // Suspended Tenant (3) -> Property Suspended (2)
            // PendingApproval Tenant (1) -> Property Inactive (0)
            await using (var qCmd = conn.CreateCommand())
            {
                qCmd.CommandText = $@"
                    SELECT ""TenantId"", ""Status"" FROM ""Properties""
                    WHERE ""TenantId"" IN ('{tActiveId}', '{tSuspendedId}', '{tPendingId}');
                ";
                await using var rdr = await qCmd.ExecuteReaderAsync();
                var statusMap = new Dictionary<Guid, int>();
                while (await rdr.ReadAsync())
                {
                    statusMap[rdr.GetGuid(0)] = rdr.GetInt32(1);
                }

                Assert.Equal(3, statusMap.Count);
                Assert.Equal(1, statusMap[tActiveId]);     // PropertyStatus.Active
                Assert.Equal(2, statusMap[tSuspendedId]);  // PropertyStatus.Suspended
                Assert.Equal(0, statusMap[tPendingId]);    // PropertyStatus.Inactive
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_10_Migration_Backfill_Fails_Fast_When_Unknown_StaffRole_Exists()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // 1. Seed legacy EnsureCreated baseline schema
            var legacyDdl = await File.ReadAllTextAsync(Path.Combine(FixturesDirectory, "00_LegacyEnsureCreatedBaseline.sql"));
            await using (var ddlCmd = conn.CreateCommand())
            {
                ddlCmd.CommandText = legacyDdl;
                await ddlCmd.ExecuteNonQueryAsync();
            }

            var tenantId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var roleId = Guid.NewGuid();
            var staffId = Guid.NewGuid();

            // 2. Insert Tenant, User, AccessRole, and a Staff with INVALID StaffRole = 99
            await using (var seedCmd = conn.CreateCommand())
            {
                seedCmd.CommandText = $@"
                    INSERT INTO ""Tenants"" (""Id"", ""Name"", ""Code"", ""Slug"", ""Address"", ""City"", ""PhoneNumber"", ""Email"", ""PropertyType"", ""StarRating"", ""CheckInTime"", ""CheckOutTime"", ""TaxRatePercent"", ""ServiceFeeRatePercent"", ""SubscriptionTier"", ""Status"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{tenantId}', 'Staff Test Tenant', 'T-STAFF', 'staff-tenant', '123 Street', 'Hanoi', '0901234567', 'staff_t@test.com', 1, 3, '14:00:00', '12:00:00', 10.0, 5.0, 1, 2, NOW(), NOW());

                    INSERT INTO ""Users"" (""Id"", ""TenantId"", ""Username"", ""Email"", ""FullName"", ""PasswordHash"", ""GlobalRole"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{userId}', '{tenantId}', 'staff_user', 'staff@test.com', 'Staff User', 'hash', 3, true, NOW(), NOW());

                    INSERT INTO ""AccessRoles"" (""Id"", ""TenantId"", ""Name"", ""Code"", ""IsSystemRole"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{roleId}', '{tenantId}', 'Custom Role', 'CUSTOM', false, NOW(), NOW());

                    INSERT INTO ""TenantStaffMembers"" (""Id"", ""TenantId"", ""UserId"", ""RoleId"", ""StaffRole"", ""IsActive"", ""CreatedAtUtc"", ""UpdatedAtUtc"")
                    VALUES ('{staffId}', '{tenantId}', '{userId}', '{roleId}', 99, true, NOW(), NOW());
                ";
                await seedCmd.ExecuteNonQueryAsync();
            }

            // 3. Stamp baseline migration history
            await using (var stampCmd = conn.CreateCommand())
            {
                stampCmd.CommandText = @"
                    CREATE TABLE IF NOT EXISTS ""__EFMigrationsHistory"" (
                        ""MigrationId"" character varying(150) NOT NULL CONSTRAINT ""PK___EFMigrationsHistory"" PRIMARY KEY,
                        ""ProductVersion"" character varying(32) NOT NULL
                    );
                    INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                    VALUES ('20261006000000_InitialBaseline', '10.0.12');
                ";
                await stampCmd.ExecuteNonQueryAsync();
            }

            // 4. Run EF Core MigrateAsync - MUST abort and fail fast!
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var ex = await Assert.ThrowsAsync<Npgsql.PostgresException>(() => ctx.Database.MigrateAsync());
                Assert.Contains("MIGRATION ABORT", ex.Message);
                Assert.Contains("StaffRole", ex.Message);
            }

            // 5. Verify migration was NOT recorded in __EFMigrationsHistory
            await using (var chkCmd = conn.CreateCommand())
            {
                chkCmd.CommandText = @"
                    SELECT COUNT(*) FROM ""__EFMigrationsHistory"" 
                    WHERE ""MigrationId"" = '20261006105053_P1B01B_MultiProperty_Foundation';
                ";
                var count = (long)(await chkCmd.ExecuteScalarAsync())!;
                Assert.Equal(0, count);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }

    [Fact]
    public async Task Behavior_11_TenantStaff_Partial_Unique_Indexes_Exclude_StaffRole_Blocks_Different_Roles_Same_Property_And_Preserves_Across_Rollback_Reapply()
    {
        var testSchema = $"p1b01b_test_{Guid.NewGuid():N}";
        await using var conn = await CreateTestConnectionAsync(testSchema);

        try
        {
            // 1. Run real EF Core migration forward
            await using (var migrateCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await migrateCtx.Database.MigrateAsync();
            }

            // 2. Verify index definitions right after migrate:
            // Must have uq_tenant_staff_tenant_wide ("TenantId", "UserId") WHERE ("PropertyId" IS NULL)
            // and uq_tenant_staff_property_scoped ("TenantId", "UserId", "PropertyId") WHERE ("PropertyId" IS NOT NULL)
            // Both must NOT contain "StaffRole" in the key columns
            await using (var idxCmd = conn.CreateCommand())
            {
                idxCmd.CommandText = $@"
                    SELECT indexname, indexdef FROM pg_indexes
                    WHERE schemaname = '{testSchema}' 
                      AND tablename = 'TenantStaffMembers'
                      AND indexname IN ('uq_tenant_staff_tenant_wide', 'uq_tenant_staff_property_scoped')
                    ORDER BY indexname;
                ";
                await using var rdr = await idxCmd.ExecuteReaderAsync();
                var indexDefs = new Dictionary<string, string>();
                while (await rdr.ReadAsync())
                {
                    indexDefs[rdr.GetString(0)] = rdr.GetString(1);
                }

                Assert.Equal(2, indexDefs.Count);
                Assert.True(indexDefs.ContainsKey("uq_tenant_staff_tenant_wide"));
                Assert.True(indexDefs.ContainsKey("uq_tenant_staff_property_scoped"));

                var tenantWideDef = indexDefs["uq_tenant_staff_tenant_wide"];
                var propertyScopedDef = indexDefs["uq_tenant_staff_property_scoped"];

                // Verify keys and predicate
                Assert.Contains("\"TenantId\"", tenantWideDef);
                Assert.Contains("\"UserId\"", tenantWideDef);
                Assert.Contains("\"PropertyId\" IS NULL", tenantWideDef);
                Assert.DoesNotContain("\"StaffRole\"", tenantWideDef);

                Assert.Contains("\"TenantId\"", propertyScopedDef);
                Assert.Contains("\"UserId\"", propertyScopedDef);
                Assert.Contains("\"PropertyId\"", propertyScopedDef);
                Assert.Contains("\"PropertyId\" IS NOT NULL", propertyScopedDef);
                Assert.DoesNotContain("\"StaffRole\"", propertyScopedDef);
            }

            // 3. Seed Tenant, User, Property, and AccessRole
            var tenantId = Guid.NewGuid();
            var userId = Guid.NewGuid();
            var propId = Guid.NewGuid();
            var roleId = Guid.NewGuid();

            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var tenant = new Tenant
                {
                    Id = tenantId,
                    Name = "Multi Role Test Hotel",
                    Code = "MULTIROLE",
                    Slug = "multi-role-test",
                    Address = "123 Test St",
                    City = "Hanoi",
                    Status = TenantStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                var prop = new Property
                {
                    Id = propId,
                    TenantId = tenantId,
                    Name = "Main Branch",
                    Code = "MAIN",
                    Slug = "multi-role-main",
                    Address = "123 Test St",
                    City = "Hanoi",
                    Status = PropertyStatus.Active,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                var user = new User
                {
                    Id = userId,
                    TenantId = tenantId,
                    Username = "staff_member",
                    Email = "staff@multirole.com",
                    PasswordHash = "hash",
                    FullName = "Staff Member",
                    GlobalRole = GlobalUserRole.TenantStaff,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                var role = new AccessRole
                {
                    Id = roleId,
                    TenantId = tenantId,
                    Name = "Operational Role",
                    Code = "OPROLE",
                    IsSystemRole = false,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                ctx.Tenants.Add(tenant);
                ctx.Properties.Add(prop);
                ctx.Users.Add(user);
                ctx.AccessRoles.Add(role);
                await ctx.SaveChangesAsync();
            }

            // 4. Insert first role: Manager on Property
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var managerStaff = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userId,
                    PropertyId = propId,
                    RoleId = roleId,
                    StaffRole = StaffRole.Manager,
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                ctx.TenantStaffMembers.Add(managerStaff);
                await ctx.SaveChangesAsync();
            }

            // 5. Attempt second insert: SAME Tenant, SAME User, SAME Property, but different role (Receptionist)
            // MUST be blocked by uq_tenant_staff_property_scoped with SQLSTATE 23505!
            await using (var ctx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var receptionistStaff = new TenantStaff
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = userId,
                    PropertyId = propId,
                    RoleId = roleId,
                    StaffRole = StaffRole.Receptionist,
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };
                ctx.TenantStaffMembers.Add(receptionistStaff);

                var ex = await Assert.ThrowsAsync<DbUpdateException>(async () =>
                {
                    await ctx.SaveChangesAsync();
                });

                var pex = Assert.IsType<PostgresException>(ex.InnerException);
                Assert.Equal("23505", pex.SqlState); // unique_violation
                Assert.Contains("uq_tenant_staff_property_scoped", pex.ConstraintName);
            }

            // 6. Test Rollback to InitialBaseline and verify partial unique indexes are dropped
            await using (var rollbackCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                var migrator = rollbackCtx.Database.GetService<IMigrator>();
                await migrator.MigrateAsync("20261006000000_InitialBaseline");
            }

            await using (var chkRollback = conn.CreateCommand())
            {
                chkRollback.CommandText = $@"
                    SELECT COUNT(*) FROM pg_indexes
                    WHERE schemaname = '{testSchema}' 
                      AND tablename = 'TenantStaffMembers'
                      AND indexname IN ('uq_tenant_staff_tenant_wide', 'uq_tenant_staff_property_scoped');
                ";
                var countAfterRollback = (long)(await chkRollback.ExecuteScalarAsync())!;
                Assert.Equal(0, countAfterRollback);
            }

            // 7. Test Reapply forward migration and verify index definitions are restored identical (without StaffRole)
            await using (var reapplyCtx = CreateDbContext(conn.ConnectionString, testSchema))
            {
                await reapplyCtx.Database.MigrateAsync();
            }

            await using (var vfyReapply = conn.CreateCommand())
            {
                vfyReapply.CommandText = $@"
                    SELECT indexname, indexdef FROM pg_indexes
                    WHERE schemaname = '{testSchema}' 
                      AND tablename = 'TenantStaffMembers'
                      AND indexname IN ('uq_tenant_staff_tenant_wide', 'uq_tenant_staff_property_scoped')
                    ORDER BY indexname;
                ";
                await using var rdr = await vfyReapply.ExecuteReaderAsync();
                var reapplyDefs = new Dictionary<string, string>();
                while (await rdr.ReadAsync())
                {
                    reapplyDefs[rdr.GetString(0)] = rdr.GetString(1);
                }

                Assert.Equal(2, reapplyDefs.Count);

                var tenantWideReapply = reapplyDefs["uq_tenant_staff_tenant_wide"];
                var propertyScopedReapply = reapplyDefs["uq_tenant_staff_property_scoped"];

                Assert.Contains("\"TenantId\"", tenantWideReapply);
                Assert.Contains("\"UserId\"", tenantWideReapply);
                Assert.Contains("\"PropertyId\" IS NULL", tenantWideReapply);
                Assert.DoesNotContain("\"StaffRole\"", tenantWideReapply);

                Assert.Contains("\"TenantId\"", propertyScopedReapply);
                Assert.Contains("\"UserId\"", propertyScopedReapply);
                Assert.Contains("\"PropertyId\"", propertyScopedReapply);
                Assert.Contains("\"PropertyId\" IS NOT NULL", propertyScopedReapply);
                Assert.DoesNotContain("\"StaffRole\"", propertyScopedReapply);
            }
        }
        finally
        {
            await CleanupTestSchemaAsync(conn, testSchema);
        }
    }
}
