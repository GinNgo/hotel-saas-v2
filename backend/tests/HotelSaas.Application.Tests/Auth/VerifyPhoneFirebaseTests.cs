using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.Commands.VerifyPhoneFirebase;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace HotelSaas.Application.Tests.Auth;

/// <summary>
/// Unit and integration test suite for Firebase Phone Authentication (Google Identity Platform).
/// Tests zero-cost SMS OTP verification, account linking, customer auto-provisioning, and phone conflict prevention.
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class VerifyPhoneFirebaseTests
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

    private static CurrentUserContext CreateUserContext(Guid? userId = null, string email = "")
    {
        var ctx = new CurrentUserContext(new DummyTenantService(), new DummyPropertyService());
        if (userId.HasValue && userId.Value != Guid.Empty)
        {
            ctx.SetUser(userId.Value, email, GlobalUserRole.Customer);
        }
        return ctx;
    }

    private static IJwtService CreateJwtService()
    {
        var dict = new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "SuperSecretKeyForPhoneVerificationTesting1234567890!",
            ["JwtSettings:Issuer"] = "HotelSaas",
            ["JwtSettings:Audience"] = "HotelSaasAudience",
            ["JwtSettings:AccessTokenExpirationMinutes"] = "60",
            ["JwtSettings:RefreshTokenExpirationDays"] = "7"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        return new JwtService(config);
    }

    private static IFirebaseAuthService CreateFirebaseAuthService()
    {
        var dict = new Dictionary<string, string?>
        {
            ["Firebase:ProjectId"] = "hotelsaas-platform-test"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        return new FirebaseAuthService(config, NullLogger<FirebaseAuthService>.Instance);
    }

    [Fact]
    public async Task VerifyPhoneFirebase_InvalidEmptyToken_ThrowsBadRequestException()
    {
        var schema = $"test_phone_val_{Guid.NewGuid():N}";
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

            var handler = new VerifyPhoneFirebaseCommandHandler(
                context,
                CreateFirebaseAuthService(),
                CreateUserContext(),
                new PasswordHasherService(),
                CreateJwtService(),
                NullLogger<VerifyPhoneFirebaseCommandHandler>.Instance);

            var ex = await Assert.ThrowsAsync<BadRequestException>(() =>
                handler.Handle(new VerifyPhoneFirebaseCommand(""), CancellationToken.None));

            Assert.Equal("ERR_INVALID_FIREBASE_TOKEN", ex.ErrorCode);
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
    public async Task VerifyPhoneFirebase_NewUser_AutoProvisionsCustomerAndSilverLoyaltyTier()
    {
        var schema = $"test_phone_new_{Guid.NewGuid():N}";
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

            // Seed default tenant & property
            var tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Code = "T-PHONE",
                Name = "Phone Auth Tenant",
                Slug = $"phone-tenant-{Guid.NewGuid():N}",
                Status = TenantStatus.Active
            };
            context.Tenants.Add(tenant);

            var prop = new Property
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Code = "P-PHONE",
                Name = "Phone Auth Property",
                Slug = $"phone-prop-{Guid.NewGuid():N}",
                Status = PropertyStatus.Active
            };
            context.Properties.Add(prop);
            await context.SaveChangesAsync();

            var handler = new VerifyPhoneFirebaseCommandHandler(
                context,
                CreateFirebaseAuthService(),
                CreateUserContext(),
                new PasswordHasherService(),
                CreateJwtService(),
                NullLogger<VerifyPhoneFirebaseCommandHandler>.Instance);

            var phoneToken = "dev-mock-token:+84909887766";
            var command = new VerifyPhoneFirebaseCommand(phoneToken, "Nguyễn Văn Phone");

            // Act
            var response = await handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.NotNull(response);
            Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
            Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
            Assert.Equal("Nguyễn Văn Phone", response.User.FullName);

            // Verify User in Database
            var user = await context.Users.FirstOrDefaultAsync(u => u.PhoneNumber == "+84909887766");
            Assert.NotNull(user);
            Assert.Equal("+84909887766", user.PhoneNumber);
            Assert.NotNull(user.PhoneVerifiedAtUtc);
            Assert.True(user.IsActive);
            Assert.Equal(GlobalUserRole.Customer, user.GlobalRole);

            // Verify Welcome Loyalty Membership
            var membership = await context.GuestLoyaltyMemberships
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(m => m.UserId == user.Id);
            Assert.NotNull(membership);
            Assert.Equal(LoyaltyTier.Silver, membership.Tier);
            Assert.Equal(50, membership.PointsBalance);
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
    public async Task VerifyPhoneFirebase_LoggedInUser_LinksPhoneSuccessfully()
    {
        var schema = $"test_phone_link_{Guid.NewGuid():N}";
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

            var existingUser = new User
            {
                Id = Guid.NewGuid(),
                Username = "tuananh.ngo@gmail.com",
                Email = "tuananh.ngo@gmail.com",
                FullName = "Ngô Võ Tuấn An",
                PasswordHash = "dummyhash",
                GlobalRole = GlobalUserRole.Customer,
                IsActive = true
            };
            context.Users.Add(existingUser);
            await context.SaveChangesAsync();

            var loggedInContext = CreateUserContext(existingUser.Id, existingUser.Email);

            var handler = new VerifyPhoneFirebaseCommandHandler(
                context,
                CreateFirebaseAuthService(),
                loggedInContext,
                new PasswordHasherService(),
                CreateJwtService(),
                NullLogger<VerifyPhoneFirebaseCommandHandler>.Instance);

            var phoneToken = "dev-mock-token:+84912345678";
            var response = await handler.Handle(new VerifyPhoneFirebaseCommand(phoneToken), CancellationToken.None);

            Assert.NotNull(response);
            Assert.Equal(existingUser.Id, response.User.Id);

            // Check database
            var updated = await context.Users.FirstAsync(u => u.Id == existingUser.Id);
            Assert.Equal("+84912345678", updated.PhoneNumber);
            Assert.NotNull(updated.PhoneVerifiedAtUtc);
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
    public async Task VerifyPhoneFirebase_DuplicatePhoneOnAnotherUser_ThrowsConflictException()
    {
        var schema = $"test_phone_dup_{Guid.NewGuid():N}";
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

            var userA = new User
            {
                Id = Guid.NewGuid(),
                Username = "user.a@gmail.com",
                Email = "user.a@gmail.com",
                FullName = "User A",
                PhoneNumber = "+84988776655", // Already holds this phone number
                PasswordHash = "hash1",
                IsActive = true
            };

            var userB = new User
            {
                Id = Guid.NewGuid(),
                Username = "user.b@gmail.com",
                Email = "user.b@gmail.com",
                FullName = "User B",
                PasswordHash = "hash2",
                IsActive = true
            };

            context.Users.AddRange(userA, userB);
            await context.SaveChangesAsync();

            var loggedInContextB = CreateUserContext(userB.Id, userB.Email);

            var handler = new VerifyPhoneFirebaseCommandHandler(
                context,
                CreateFirebaseAuthService(),
                loggedInContextB,
                new PasswordHasherService(),
                CreateJwtService(),
                NullLogger<VerifyPhoneFirebaseCommandHandler>.Instance);

            // User B attempts to verify with User A's phone number
            var phoneToken = "dev-mock-token:+84988776655";
            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                handler.Handle(new VerifyPhoneFirebaseCommand(phoneToken), CancellationToken.None));

            Assert.Equal("ERR_PHONE_ALREADY_EXISTS", ex.ErrorCode);
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
    public async Task VerifyPhoneFirebase_WithUserTestPhoneNumber_AuthenticatesAndProvisionsCustomer()
    {
        var schema = $"test_phone_user_{Guid.NewGuid():N}";
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

            var tenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Code = "T-PHONE",
                Name = "Phone Auth Tenant",
                Slug = $"phone-tenant-{Guid.NewGuid():N}",
                Status = TenantStatus.Active
            };
            context.Tenants.Add(tenant);

            var prop = new Property
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Code = "P-PHONE",
                Name = "Phone Auth Property",
                Slug = $"phone-prop-{Guid.NewGuid():N}",
                Status = PropertyStatus.Active
            };
            context.Properties.Add(prop);
            await context.SaveChangesAsync();

            var handler = new VerifyPhoneFirebaseCommandHandler(
                context,
                CreateFirebaseAuthService(),
                CreateUserContext(),
                new PasswordHasherService(),
                CreateJwtService(),
                NullLogger<VerifyPhoneFirebaseCommandHandler>.Instance);

            // Kiểm thử trực tiếp với Số điện thoại của người dùng: +84123456789
            var phoneToken = "dev-mock-token:+84123456789";
            var command = new VerifyPhoneFirebaseCommand(phoneToken, "Khách Hàng +84123456789");

            var response = await handler.Handle(command, CancellationToken.None);

            Assert.NotNull(response);
            Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
            Assert.False(string.IsNullOrWhiteSpace(response.RefreshToken));
            Assert.Equal("Khách Hàng +84123456789", response.User.FullName);

            var user = await context.Users.FirstOrDefaultAsync(u => u.PhoneNumber == "+84123456789");
            Assert.NotNull(user);
            Assert.Equal("+84123456789", user.PhoneNumber);
            Assert.NotNull(user.PhoneVerifiedAtUtc);
            Assert.Equal(GlobalUserRole.Customer, user.GlobalRole);
            Assert.True(user.IsActive);

            var membership = await context.GuestLoyaltyMemberships
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(m => m.UserId == user.Id);
            Assert.NotNull(membership);
            Assert.Equal(LoyaltyTier.Silver, membership.Tier);
            Assert.Equal(50, membership.PointsBalance);
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
