using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Pricing.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Pricing;

/// <summary>
/// Unit and integration test suite for AI Dynamic Pricing Service.
/// Verifies occupancy calculations, surge pricing (+15%), dynamic discount (-10%),
/// and RevPAR strategic recommendations.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class DynamicPricingTests
{
    private static string GetConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION");
        if (!string.IsNullOrWhiteSpace(envConn)) return envConn;
        var port = Environment.GetEnvironmentVariable("TEST_POSTGRES_PORT") ?? "5435";
        return $"Host=localhost;Port={port};Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;";
    }

    private static ApplicationDbContext CreateContext(string schema)
    {
        var builder = new NpgsqlConnectionStringBuilder(GetConnectionString()) { SearchPath = schema };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(builder.ConnectionString)
            .Options;
        return new ApplicationDbContext(options, new DummyTenantService(), new DummyPropertyService());
    }

    private sealed class DummyTenantService : ICurrentTenantService { public Guid? TenantId { get; set; } }
    private sealed class DummyPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; } = true;
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    [Fact]
    public async Task DynamicPricing_HighOccupancy80Percent_ReturnsSurge15Percent()
    {
        var schema = $"test_pricing_surge_{Guid.NewGuid():N}";
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            await using var context = CreateContext(schema);
            await context.Database.MigrateAsync();

            var tenant = new Tenant { Id = Guid.NewGuid(), Code = "T-DP1", Name = "DP Tenant 1", Slug = $"dp-1-{Guid.NewGuid():N}" };
            var property = new Property { Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "P-DP1", Name = "DP Prop 1", Slug = $"dp-p1-{Guid.NewGuid():N}" };
            var roomType = new RoomType { Id = Guid.NewGuid(), TenantId = tenant.Id, PropertyId = property.Id, Name = "Suite", Code = "STE", BasePrice = 1000000m };
            context.Tenants.Add(tenant);
            context.Properties.Add(property);
            context.RoomTypes.Add(roomType);

            // Create 5 rooms
            var rooms = new List<Room>();
            for (int i = 1; i <= 5; i++)
            {
                var r = new Room { Id = Guid.NewGuid(), TenantId = tenant.Id, PropertyId = property.Id, RoomTypeId = roomType.Id, RoomNumber = $"10{i}", IsActive = true };
                rooms.Add(r);
                context.Rooms.Add(r);
            }

            // Create 4 overlapping Confirmed reservations -> 4 / 5 = 80% occupancy
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var tomorrow = today.AddDays(1);
            for (int i = 0; i < 4; i++)
            {
                var res = new Reservation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PropertyId = property.Id,
                    RoomId = rooms[i].Id,
                    ConfirmationCode = $"RES-DP-{i}",
                    Status = ReservationStatus.Confirmed,
                    CheckInDate = today,
                    CheckOutDate = tomorrow,
                    TotalAmount = 1000000m,
                    GuestName = $"Guest {i}",
                    GuestEmail = $"guest{i}@hotelsaas.local"
                };
                context.Reservations.Add(res);
            }
            await context.SaveChangesAsync();

            var service = new DynamicPricingService(context);

            // Act
            var adjustment = await service.CalculateDynamicAdjustmentAsync(
                property.Id,
                roomType.Id,
                RentalType.Daily,
                today,
                tomorrow,
                1000000m,
                CancellationToken.None);

            // Assert
            Assert.NotNull(adjustment);
            Assert.Equal("SurgePricing", adjustment.Category);
            Assert.Equal(1.15m, adjustment.Multiplier);
            Assert.Equal(150000m, adjustment.AdjustmentAmount); // +15% of 1,000,000
            Assert.Equal(80.0, adjustment.OccupancyPercent);
        }
        finally
        {
            await using var cleanupConn = new NpgsqlConnection(GetConnectionString());
            await cleanupConn.OpenAsync();
            await using var dropCmd = cleanupConn.CreateCommand();
            dropCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{schema}\" CASCADE;";
            await dropCmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task DynamicPricing_LowOccupancy20Percent_ReturnsDiscount10Percent()
    {
        var schema = $"test_pricing_disc_{Guid.NewGuid():N}";
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            await using var context = CreateContext(schema);
            await context.Database.MigrateAsync();

            var tenant = new Tenant { Id = Guid.NewGuid(), Code = "T-DP2", Name = "DP Tenant 2", Slug = $"dp-2-{Guid.NewGuid():N}" };
            var property = new Property { Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "P-DP2", Name = "DP Prop 2", Slug = $"dp-p2-{Guid.NewGuid():N}" };
            var roomType = new RoomType { Id = Guid.NewGuid(), TenantId = tenant.Id, PropertyId = property.Id, Name = "Deluxe", Code = "DLX", BasePrice = 800000m };
            context.Tenants.Add(tenant);
            context.Properties.Add(property);
            context.RoomTypes.Add(roomType);

            // Create 5 rooms
            var rooms = new List<Room>();
            for (int i = 1; i <= 5; i++)
            {
                var r = new Room { Id = Guid.NewGuid(), TenantId = tenant.Id, PropertyId = property.Id, RoomTypeId = roomType.Id, RoomNumber = $"20{i}", IsActive = true };
                rooms.Add(r);
                context.Rooms.Add(r);
            }

            // Create 1 reservation -> 1 / 5 = 20% occupancy (<= 30%)
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var tomorrow = today.AddDays(1);
            var res = new Reservation
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PropertyId = property.Id,
                RoomId = rooms[0].Id,
                ConfirmationCode = "RES-DP-LOW",
                Status = ReservationStatus.CheckedIn,
                CheckInDate = today,
                CheckOutDate = tomorrow,
                TotalAmount = 800000m,
                GuestName = "Low Occupancy Guest",
                GuestEmail = "low@hotelsaas.local"
            };
            context.Reservations.Add(res);
            await context.SaveChangesAsync();

            var service = new DynamicPricingService(context);

            // Act
            var adjustment = await service.CalculateDynamicAdjustmentAsync(
                property.Id,
                roomType.Id,
                RentalType.Daily,
                today,
                tomorrow,
                800000m,
                CancellationToken.None);

            // Assert
            Assert.NotNull(adjustment);
            Assert.Equal("DynamicDiscount", adjustment.Category);
            Assert.Equal(0.90m, adjustment.Multiplier);
            Assert.Equal(-80000m, adjustment.AdjustmentAmount); // -10% of 800,000
            Assert.Equal(20.0, adjustment.OccupancyPercent);
        }
        finally
        {
            await using var cleanupConn = new NpgsqlConnection(GetConnectionString());
            await cleanupConn.OpenAsync();
            await using var dropCmd = cleanupConn.CreateCommand();
            dropCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{schema}\" CASCADE;";
            await dropCmd.ExecuteNonQueryAsync();
        }
    }

    [Fact]
    public async Task DynamicPricing_ModerateOccupancy50Percent_ReturnsNullAdjustment()
    {
        var schema = $"test_pricing_mod_{Guid.NewGuid():N}";
        await using var conn = new NpgsqlConnection(GetConnectionString());
        await conn.OpenAsync();
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schema}\";";
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            await using var context = CreateContext(schema);
            await context.Database.MigrateAsync();

            var tenant = new Tenant { Id = Guid.NewGuid(), Code = "T-DP3", Name = "DP Tenant 3", Slug = $"dp-3-{Guid.NewGuid():N}" };
            var property = new Property { Id = Guid.NewGuid(), TenantId = tenant.Id, Code = "P-DP3", Name = "DP Prop 3", Slug = $"dp-p3-{Guid.NewGuid():N}" };
            var roomType = new RoomType { Id = Guid.NewGuid(), TenantId = tenant.Id, PropertyId = property.Id, Name = "Standard", Code = "STD", BasePrice = 500000m };
            context.Tenants.Add(tenant);
            context.Properties.Add(property);
            context.RoomTypes.Add(roomType);

            // Create 4 rooms, 2 booked = 50% occupancy
            var rooms = new List<Room>();
            for (int i = 1; i <= 4; i++)
            {
                var r = new Room { Id = Guid.NewGuid(), TenantId = tenant.Id, PropertyId = property.Id, RoomTypeId = roomType.Id, RoomNumber = $"30{i}", IsActive = true };
                rooms.Add(r);
                context.Rooms.Add(r);
            }

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var tomorrow = today.AddDays(1);
            for (int i = 0; i < 2; i++)
            {
                context.Reservations.Add(new Reservation
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PropertyId = property.Id,
                    RoomId = rooms[i].Id,
                    ConfirmationCode = $"RES-DP-MOD-{i}",
                    Status = ReservationStatus.Confirmed,
                    CheckInDate = today,
                    CheckOutDate = tomorrow,
                    TotalAmount = 500000m,
                    GuestName = $"Guest {i}",
                    GuestEmail = $"guest{i}@hotelsaas.local"
                });
            }
            await context.SaveChangesAsync();

            var service = new DynamicPricingService(context);

            // Act
            var adjustment = await service.CalculateDynamicAdjustmentAsync(
                property.Id,
                roomType.Id,
                RentalType.Daily,
                today,
                tomorrow,
                500000m,
                CancellationToken.None);

            // Assert
            Assert.Null(adjustment);

            // Verify GetPricingRecommendationsAsync
            var recommendations = await service.GetPricingRecommendationsAsync(property.Id, today, CancellationToken.None);
            Assert.NotNull(recommendations);
            Assert.Equal(50.0, recommendations.OverallOccupancyRate);
            Assert.Single(recommendations.Recommendations);
            Assert.Equal("Baseline Optimal", recommendations.Recommendations[0].Strategy);
        }
        finally
        {
            await using var cleanupConn = new NpgsqlConnection(GetConnectionString());
            await cleanupConn.OpenAsync();
            await using var dropCmd = cleanupConn.CreateCommand();
            dropCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{schema}\" CASCADE;";
            await dropCmd.ExecuteNonQueryAsync();
        }
    }
}
