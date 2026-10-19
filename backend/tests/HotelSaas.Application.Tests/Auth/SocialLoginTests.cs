using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.Commands.SocialLogin;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Auth;

/// <summary>
/// Unit and integration test suite for Social Identity Login (Google & Facebook).
/// Verifies auto-provisioning Customer accounts, welcome loyalty points, idempotency, and security constraints.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class SocialLoginTests
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

    private static IJwtService CreateJwtService()
    {
        var dict = new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "SuperSecretKeyForSocialLoginUnitTesting1234567890!",
            ["JwtSettings:Issuer"] = "HotelSaas",
            ["JwtSettings:Audience"] = "HotelSaasAudience",
            ["JwtSettings:AccessTokenExpirationMinutes"] = "60",
            ["JwtSettings:RefreshTokenExpirationDays"] = "7"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        return new JwtService(config);
    }

    [Fact]
    public async Task SocialLogin_EmptyProviderOrSubject_ThrowsArgumentException()
    {
        var schema = $"test_social_val_{Guid.NewGuid():N}";
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

            var handler = new SocialLoginCommandHandler(
                context,
                new PasswordHasherService(),
                CreateJwtService());

            await Assert.ThrowsAsync<ArgumentException>(() =>
                handler.Handle(new SocialLoginCommand("", "sub123", "test@gmail.com"), CancellationToken.None));

            await Assert.ThrowsAsync<ArgumentException>(() =>
                handler.Handle(new SocialLoginCommand("Google", "", "test@gmail.com"), CancellationToken.None));
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
    public async Task SocialLogin_NewUser_AutoProvisionsCustomerAndSilverLoyaltyTier()
    {
        var schema = $"test_social_{Guid.NewGuid():N}";
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

            // Seed default tenant & property for welcome loyalty membership
            var tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Code = "T-SOC",
                Name = "Social Test Tenant",
                Slug = $"soc-tenant-{Guid.NewGuid():N}",
                Status = TenantStatus.Active
            };
            context.Tenants.Add(tenant);

            var prop = new Property
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Code = "P-SOC",
                Name = "Social Test Property",
                Slug = $"soc-prop-{Guid.NewGuid():N}",
                Status = PropertyStatus.Active
            };
            context.Properties.Add(prop);
            await context.SaveChangesAsync();

            var jwtService = CreateJwtService();
            var hasher = new PasswordHasherService();
            var handler = new SocialLoginCommandHandler(context, hasher, jwtService);

            var command = new SocialLoginCommand(
                Provider: "Google",
                ProviderSubject: "google-sub-998877",
                ProviderEmail: "alex.guest@gmail.com",
                FullName: "Alex Luxury Guest",
                AvatarUrl: "https://lh3.googleusercontent.com/a/test-avatar"
            );

            // Act
            var response = await handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.NotNull(response);
            Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
            Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
            Assert.Equal("alex.guest@gmail.com", response.User.Email);
            Assert.Equal("Alex Luxury Guest", response.User.FullName);
            Assert.Equal(GlobalUserRole.Customer.ToString(), response.User.GlobalRole);

            // Verify User persisted
            var createdUser = await context.Users.FirstOrDefaultAsync(u => u.Email == "alex.guest@gmail.com");
            Assert.NotNull(createdUser);
            Assert.Equal(GlobalUserRole.Customer, createdUser.GlobalRole);
            Assert.True(createdUser.IsActive);
            Assert.Equal("https://lh3.googleusercontent.com/a/test-avatar", createdUser.AvatarUrl);

            // Verify SocialIdentity persisted
            var socialIdentity = await context.SocialIdentities
                .FirstOrDefaultAsync(si => si.UserId == createdUser.Id && si.Provider == "Google");
            Assert.NotNull(socialIdentity);
            Assert.Equal("google-sub-998877", socialIdentity.ProviderSubject);

            // Verify Welcome Loyalty Membership (50 points Silver)
            var membership = await context.GuestLoyaltyMemberships
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(m => m.UserId == createdUser.Id);
            Assert.NotNull(membership);
            Assert.Equal(LoyaltyTier.Silver, membership.Tier);
            Assert.Equal(50, membership.PointsBalance);
            Assert.Equal(50, membership.LifetimePoints);

            // Test Subsequent Login (Idempotent reuse)
            var secondResponse = await handler.Handle(command, CancellationToken.None);
            Assert.NotNull(secondResponse);
            Assert.Equal(createdUser.Id, secondResponse.User.Id);

            // User count must still be 1
            var userCount = await context.Users.CountAsync(u => u.Email == "alex.guest@gmail.com");
            Assert.Equal(1, userCount);
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
    public async Task SocialLogin_InactiveUser_ThrowsUnauthorizedAccessException()
    {
        var schema = $"test_social_block_{Guid.NewGuid():N}";
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

            var blockedUser = new User
            {
                Id = Guid.NewGuid(),
                Email = "blocked.user@gmail.com",
                Username = "blocked.user@gmail.com",
                FullName = "Blocked Guest",
                PasswordHash = "dummyhash",
                GlobalRole = GlobalUserRole.Customer,
                IsActive = false // Locked account
            };
            context.Users.Add(blockedUser);

            var socialLink = new SocialIdentity
            {
                Id = Guid.NewGuid(),
                UserId = blockedUser.Id,
                Provider = "Facebook",
                ProviderSubject = "fb-subject-12345",
                ProviderEmail = "blocked.user@gmail.com",
                CreatedAtUtc = DateTime.UtcNow
            };
            context.SocialIdentities.Add(socialLink);
            await context.SaveChangesAsync();

            var handler = new SocialLoginCommandHandler(context, new PasswordHasherService(), CreateJwtService());

            var cmd = new SocialLoginCommand("Facebook", "fb-subject-12345", "blocked.user@gmail.com");

            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                handler.Handle(cmd, CancellationToken.None));

            Assert.Contains("Tài khoản đã bị tạm khóa", ex.Message);
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
