using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Persistence.Interceptors;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Isolation;

/// <summary>
/// Automated proof of Multi-Tenant and Cross-Branch (Multi-Property) Data Isolation.
/// Verifies EF Core Global Query Filters, Fail-Closed Null Context, Owner ExcludedPropertyIds,
/// and TenantPropertySaveChangesInterceptor immutability & anti-cross-mutation guards.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class MultiTenantBranchIsolationTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        var baseConn = !string.IsNullOrWhiteSpace(envConn)
            ? envConn
            : "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

        var builder = new NpgsqlConnectionStringBuilder(baseConn)
        {
            Pooling = false,
            PersistSecurityInfo = true
        };
        return builder.ConnectionString;
    }

    private sealed class ScopedTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class ScopedPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; }
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private static ApplicationDbContext CreateScopedContext(
        string baseConnStr,
        string schema,
        Guid? tenantId,
        Guid? propertyId,
        bool isTenantWide,
        IReadOnlyList<Guid>? excludedPropertyIds = null,
        Guid? headerPropertyId = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(baseConnStr)
        {
            SearchPath = schema,
            Pooling = false
        };

        var tenantSvc = new ScopedTenantService { TenantId = tenantId };
        var propSvc = new ScopedPropertyService
        {
            PropertyId = propertyId,
            IsTenantWide = isTenantWide,
            ExcludedPropertyIds = excludedPropertyIds ?? Array.Empty<Guid>(),
            HeaderPropertyId = headerPropertyId,
            TokenPropertyId = propertyId
        };

        var interceptor = new TenantPropertySaveChangesInterceptor(tenantSvc, propSvc);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .AddInterceptors(interceptor)
            .Options;

        return new ApplicationDbContext(options, tenantSvc, propSvc);
    }

    [Fact]
    public async Task Proof1_GlobalQueryFilters_EnforceStrictCrossTenantAndCrossBranchIsolation()
    {
        var baseConnStr = GetConnectionString();
        var schema = $"iso_filter_{Guid.NewGuid():N}"[..24];

        await using var conn = new NpgsqlConnection(baseConnStr);
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            var tenantA = Guid.NewGuid();
            var branchA1 = Guid.NewGuid(); // Grand Saigon (Active)
            var branchA2 = Guid.NewGuid(); // Ocean Da Nang (Active)
            var branchA3 = Guid.NewGuid(); // Suspended Branch

            var tenantB = Guid.NewGuid();
            var branchB1 = Guid.NewGuid(); // Competitor Hotel

            // 1. Seed Tenant A (3 branches) & Tenant B (1 branch)
            await using (var seedA = CreateScopedContext(baseConnStr, schema, tenantA, null, isTenantWide: true))
            {
                await seedA.Database.MigrateAsync();

                seedA.Tenants.Add(new Tenant
                {
                    Id = tenantA,
                    Name = "Grand Hospitality Group (Tenant A)",
                    Code = "TENANT-A",
                    Slug = $"tenant-a-{Guid.NewGuid():N}"[..16],
                    Status = TenantStatus.Active
                });

                seedA.Properties.AddRange(
                    new Property { Id = branchA1, TenantId = tenantA, Name = "Grand Saigon Branch 1", Code = "G-SGN", Slug = $"g-sgn-{Guid.NewGuid():N}"[..14], Status = PropertyStatus.Active },
                    new Property { Id = branchA2, TenantId = tenantA, Name = "Ocean Danang Branch 2", Code = "O-DAD", Slug = $"o-dad-{Guid.NewGuid():N}"[..14], Status = PropertyStatus.Active },
                    new Property { Id = branchA3, TenantId = tenantA, Name = "Dalat Suspended Branch 3", Code = "D-DLI", Slug = $"d-dli-{Guid.NewGuid():N}"[..14], Status = PropertyStatus.Active }
                );

                var rtA1 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = branchA1, Name = "Deluxe SGN", Code = "DLX-SGN", BasePrice = 1500000m };
                var rtA2 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = branchA2, Name = "Suite DAD", Code = "STE-DAD", BasePrice = 2500000m };
                var rtA3 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = branchA3, Name = "Villa DLI", Code = "VLA-DLI", BasePrice = 3500000m };
                seedA.RoomTypes.AddRange(rtA1, rtA2, rtA3);

                var roomA1 = new Room { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = branchA1, RoomTypeId = rtA1.Id, RoomNumber = "101-SGN", Status = RoomStatus.Clean };
                var roomA2 = new Room { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = branchA2, RoomTypeId = rtA2.Id, RoomNumber = "201-DAD", Status = RoomStatus.Clean };
                var roomA3 = new Room { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = branchA3, RoomTypeId = rtA3.Id, RoomNumber = "301-DLI", Status = RoomStatus.Clean };
                seedA.Rooms.AddRange(roomA1, roomA2, roomA3);

                seedA.Reservations.AddRange(
                    new Reservation
                    {
                        Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = branchA1, RoomId = roomA1.Id,
                        ConfirmationCode = "RES-A1-001", GuestName = "Khách Chi Nhánh Sài Gòn", TotalAmount = 1500000m,
                        CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                        CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                        Status = ReservationStatus.Confirmed
                    },
                    new Reservation
                    {
                        Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = branchA2, RoomId = roomA2.Id,
                        ConfirmationCode = "RES-A2-001", GuestName = "Khách Chi Nhánh Đà Nẵng", TotalAmount = 2500000m,
                        CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                        CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                        Status = ReservationStatus.Confirmed
                    }
                );

                await seedA.SaveChangesAsync();
            }

            await using (var seedB = CreateScopedContext(baseConnStr, schema, tenantB, null, isTenantWide: true))
            {
                seedB.Tenants.Add(new Tenant
                {
                    Id = tenantB,
                    Name = "Competitor Resort Group (Tenant B)",
                    Code = "TENANT-B",
                    Slug = $"tenant-b-{Guid.NewGuid():N}"[..16],
                    Status = TenantStatus.Active
                });

                seedB.Properties.Add(new Property
                {
                    Id = branchB1, TenantId = tenantB, Name = "Competitor Nha Trang", Code = "C-CXR", Slug = $"c-cxr-{Guid.NewGuid():N}"[..14], Status = PropertyStatus.Active
                });

                var rtB1 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantB, PropertyId = branchB1, Name = "Competitor Room", Code = "CMP-01", BasePrice = 1800000m };
                seedB.RoomTypes.Add(rtB1);

                var roomB1 = new Room { Id = Guid.NewGuid(), TenantId = tenantB, PropertyId = branchB1, RoomTypeId = rtB1.Id, RoomNumber = "999-CMP", Status = RoomStatus.Clean };
                seedB.Rooms.Add(roomB1);

                seedB.Reservations.Add(new Reservation
                {
                    Id = Guid.NewGuid(), TenantId = tenantB, PropertyId = branchB1, RoomId = roomB1.Id,
                    ConfirmationCode = "RES-B1-999", GuestName = "Khách Đối Thủ Tenant B", TotalAmount = 1800000m,
                    CheckInDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
                    CheckOutDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(2)),
                    Status = ReservationStatus.Confirmed
                });

                await seedB.SaveChangesAsync();
            }

            // ── CASE 1: Fail-Closed Null Tenant Context returns ZERO rows ──────────────────
            await using (var nullCtx = CreateScopedContext(baseConnStr, schema, tenantId: null, propertyId: null, isTenantWide: false))
            {
                Assert.Empty(await nullCtx.Properties.ToListAsync());
                Assert.Empty(await nullCtx.Rooms.ToListAsync());
                Assert.Empty(await nullCtx.Reservations.ToListAsync());
            }

            // ── CASE 2: Staff Pinned to Branch A1 ONLY sees Branch A1 data (Branch A2 & Tenant B invisible) ──
            await using (var staffBranchA1Ctx = CreateScopedContext(baseConnStr, schema, tenantA, branchA1, isTenantWide: false))
            {
                var rooms = await staffBranchA1Ctx.Rooms.AsNoTracking().ToListAsync();
                Assert.Single(rooms);
                Assert.Equal("101-SGN", rooms[0].RoomNumber);
                Assert.Equal(branchA1, rooms[0].PropertyId);

                var reservations = await staffBranchA1Ctx.Reservations.AsNoTracking().ToListAsync();
                Assert.Single(reservations);
                Assert.Equal("RES-A1-001", reservations[0].ConfirmationCode);
            }

            // ── CASE 3: Staff Pinned to Branch A2 ONLY sees Branch A2 data ─────────────────
            await using (var staffBranchA2Ctx = CreateScopedContext(baseConnStr, schema, tenantA, branchA2, isTenantWide: false))
            {
                var rooms = await staffBranchA2Ctx.Rooms.AsNoTracking().ToListAsync();
                Assert.Single(rooms);
                Assert.Equal("201-DAD", rooms[0].RoomNumber);
                Assert.Equal(branchA2, rooms[0].PropertyId);

                var reservations = await staffBranchA2Ctx.Reservations.AsNoTracking().ToListAsync();
                Assert.Single(reservations);
                Assert.Equal("RES-A2-001", reservations[0].ConfirmationCode);
            }

            // ── CASE 4: Tenant-Wide Owner of Tenant A with ExcludedPropertyIds=[branchA3] sees A1 & A2, NOT A3 & NOT Tenant B ──
            await using (var ownerCtx = CreateScopedContext(baseConnStr, schema, tenantA, propertyId: null, isTenantWide: true, excludedPropertyIds: new[] { branchA3 }))
            {
                var rooms = await ownerCtx.Rooms.AsNoTracking().ToListAsync();
                Assert.Equal(2, rooms.Count);
                Assert.Contains(rooms, r => r.RoomNumber == "101-SGN");
                Assert.Contains(rooms, r => r.RoomNumber == "201-DAD");
                Assert.DoesNotContain(rooms, r => r.RoomNumber == "301-DLI");
                Assert.DoesNotContain(rooms, r => r.RoomNumber == "999-CMP");
            }
        }
        finally
        {
            await using var dropCmd = conn.CreateCommand();
            dropCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{schema}\" CASCADE;";
            await dropCmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task Proof2_SaveChangesInterceptor_BlocksCrossTenantAndCrossBranchMutations()
    {
        var baseConnStr = GetConnectionString();
        var schema = $"iso_mut_{Guid.NewGuid():N}"[..24];

        await using var conn = new NpgsqlConnection(baseConnStr);
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            var tenantA = Guid.NewGuid();
            var branchA1 = Guid.NewGuid();
            var branchA2 = Guid.NewGuid();
            var tenantB = Guid.NewGuid();
            var roomTypeA1Id = Guid.NewGuid();
            var roomA2Id = Guid.NewGuid();

            // Seed initial state
            await using (var seedCtx = CreateScopedContext(baseConnStr, schema, tenantA, null, isTenantWide: true))
            {
                await seedCtx.Database.MigrateAsync();

                seedCtx.Tenants.AddRange(
                    new Tenant { Id = tenantA, Name = "Tenant A", Code = "TA", Slug = $"ta-{Guid.NewGuid():N}"[..12], Status = TenantStatus.Active },
                    new Tenant { Id = tenantB, Name = "Tenant B", Code = "TB", Slug = $"tb-{Guid.NewGuid():N}"[..12], Status = TenantStatus.Active }
                );

                seedCtx.Properties.AddRange(
                    new Property { Id = branchA1, TenantId = tenantA, Name = "Branch A1", Code = "BA1", Slug = $"ba1-{Guid.NewGuid():N}"[..12], Status = PropertyStatus.Active },
                    new Property { Id = branchA2, TenantId = tenantA, Name = "Branch A2", Code = "BA2", Slug = $"ba2-{Guid.NewGuid():N}"[..12], Status = PropertyStatus.Active }
                );

                var rtA1 = new RoomType { Id = roomTypeA1Id, TenantId = tenantA, PropertyId = branchA1, Name = "Standard A1", Code = "STD-A1" };
                var rtA2 = new RoomType { Id = Guid.NewGuid(), TenantId = tenantA, PropertyId = branchA2, Name = "Standard A2", Code = "STD-A2" };
                seedCtx.RoomTypes.AddRange(rtA1, rtA2);

                seedCtx.Rooms.Add(new Room
                {
                    Id = roomA2Id,
                    TenantId = tenantA,
                    PropertyId = branchA2,
                    RoomTypeId = rtA2.Id,
                    RoomNumber = "202-A2",
                    Status = RoomStatus.Clean
                });

                await seedCtx.SaveChangesAsync();
            }

            // ── GUARD 1: Staff scoped to Tenant A attempting to insert entity for Tenant B -> ERR_CROSS_TENANT_MUTATION ──
            await using (var ctxCrossTenant = CreateScopedContext(baseConnStr, schema, tenantA, branchA1, isTenantWide: false))
            {
                ctxCrossTenant.Rooms.Add(new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantB, // Cross-tenant injection attempt!
                    PropertyId = branchA1,
                    RoomTypeId = roomTypeA1Id,
                    RoomNumber = "HACK-999"
                });

                var ex = await Assert.ThrowsAsync<ForbiddenException>(() => ctxCrossTenant.SaveChangesAsync());
                Assert.Equal("ERR_CROSS_TENANT_MUTATION", ex.ErrorCode);
            }

            // ── GUARD 2: Staff scoped to Branch A1 attempting to create Room in Branch A2 -> ERR_CROSS_PROPERTY_MUTATION ──
            await using (var ctxCrossBranch = CreateScopedContext(baseConnStr, schema, tenantA, branchA1, isTenantWide: false))
            {
                ctxCrossBranch.Rooms.Add(new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantA,
                    PropertyId = branchA2, // Cross-branch injection attempt!
                    RoomTypeId = roomTypeA1Id,
                    RoomNumber = "HACK-BRANCH-2"
                });

                var ex = await Assert.ThrowsAsync<ForbiddenException>(() => ctxCrossBranch.SaveChangesAsync());
                Assert.Equal("ERR_CROSS_PROPERTY_MUTATION", ex.ErrorCode);
            }

            // ── GUARD 3: Staff scoped to Branch A1 attempting detached update on Branch A2's Room -> ERR_CROSS_PROPERTY_MUTATION ──
            await using (var ctxDetachedTamper = CreateScopedContext(baseConnStr, schema, tenantA, branchA1, isTenantWide: false))
            {
                var roomInBranch2 = await ctxDetachedTamper.Rooms
                    .IgnoreQueryFilters()
                    .FirstAsync(r => r.Id == roomA2Id);

                roomInBranch2.RoomNumber = "TAMPERED-BY-BRANCH-1";

                var ex = await Assert.ThrowsAsync<ForbiddenException>(() => ctxDetachedTamper.SaveChangesAsync());
                Assert.Equal("ERR_CROSS_PROPERTY_MUTATION", ex.ErrorCode);
            }

            // ── GUARD 4: Header X-Property-Id mismatch during entity creation -> ERR_CONTEXT_MISMATCH ──
            await using (var ctxHeaderMismatch = CreateScopedContext(baseConnStr, schema, tenantA, branchA1, isTenantWide: true, headerPropertyId: branchA1))
            {
                ctxHeaderMismatch.Rooms.Add(new Room
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantA,
                    PropertyId = branchA2, // Mismatches X-Property-Id: branchA1
                    RoomTypeId = roomTypeA1Id,
                    RoomNumber = "MISMATCH-101"
                });

                var ex = await Assert.ThrowsAsync<BadRequestException>(() => ctxHeaderMismatch.SaveChangesAsync());
                Assert.Equal("ERR_CONTEXT_MISMATCH", ex.ErrorCode);
            }
        }
        finally
        {
            await using var dropCmd = conn.CreateCommand();
            dropCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{schema}\" CASCADE;";
            await dropCmd.ExecuteNonQueryAsync();
        }
    }
}
