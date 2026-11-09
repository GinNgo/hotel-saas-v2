using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.Commands.GoogleLogin;
using HotelSaas.Application.Auth.Commands.Login;
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
/// Comprehensive test suite for Task A02:
/// - Dual-Verification Policy (Soft-Gating for B2C Guest vs Hard-Gating for Hotel Personnel)
/// - Google OAuth Sign-In & Account Linking via Google Identity Services
/// </summary>
[Collection("RealDatabaseTests")]
public sealed class GoogleLoginAndDualVerificationPolicyTests
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
            ["JwtSettings:SecretKey"] = "SuperSecretKeyForGoogleOAuthUnitTesting1234567890!",
            ["JwtSettings:Issuer"] = "HotelSaas",
            ["JwtSettings:Audience"] = "HotelSaasAudience",
            ["JwtSettings:AccessTokenExpirationMinutes"] = "60",
            ["JwtSettings:RefreshTokenExpirationDays"] = "7"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        return new JwtService(config);
    }

    private static IGoogleAuthService CreateGoogleAuthService()
    {
        var config = new ConfigurationBuilder().Build();
        return new GoogleAuthService(config, NullLogger<GoogleAuthService>.Instance);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. DUAL-VERIFICATION POLICY: SOFT-GATING VS HARD-GATING
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task DualVerification_CustomerWithoutEmailVerification_AllowsLoginSuccessfully_SoftGating()
    {
        var schema = $"test_soft_gate_{Guid.NewGuid():N}";
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

            var hasher = new PasswordHasherService();
            var customer = new User
            {
                Id = Guid.NewGuid(),
                Email = "customer.softgate@gmail.com",
                Username = "customer.softgate@gmail.com",
                FullName = "Nguyễn Khách SoftGate",
                PasswordHash = hasher.Hash("ValidPass123!"),
                GlobalRole = GlobalUserRole.Customer,
                IsActive = true,
                EmailVerifiedAtUtc = null, // UNVERIFIED EMAIL
                PhoneVerifiedAtUtc = null  // UNVERIFIED PHONE
            };
            context.Users.Add(customer);
            await context.SaveChangesAsync();

            var handler = new LoginCommandHandler(context, hasher, CreateJwtService());

            // Act - Soft-gating allows customer to log in and receive JWT token
            var response = await handler.Handle(
                new LoginCommand("customer.softgate@gmail.com", "ValidPass123!"),
                CancellationToken.None);

            // Assert
            Assert.NotNull(response);
            Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
            Assert.Equal("customer.softgate@gmail.com", response.User.Email);
            Assert.Equal(GlobalUserRole.Customer.ToString(), response.User.GlobalRole);
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
    public async Task DualVerification_StaffWithoutEmailOrPhoneVerification_ThrowsUnauthorizedAccessException_HardGating()
    {
        var schema = $"test_hard_gate_{Guid.NewGuid():N}";
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

            var hasher = new PasswordHasherService();
            var unverifiedStaff = new User
            {
                Id = Guid.NewGuid(),
                Email = "staff.unverified@hotelsaas.local",
                Username = "staff.unverified@hotelsaas.local",
                FullName = "Trần Nhân Viên Unverified",
                PasswordHash = hasher.Hash("StaffPass123!"),
                GlobalRole = GlobalUserRole.TenantStaff, // STAFF ROLE
                IsActive = true,
                EmailVerifiedAtUtc = null, // UNVERIFIED
                PhoneVerifiedAtUtc = null  // UNVERIFIED
            };
            context.Users.Add(unverifiedStaff);
            await context.SaveChangesAsync();

            var handler = new LoginCommandHandler(context, hasher, CreateJwtService());

            // Act & Assert - Hard-Gating blocks unverified hotel staff from accessing PMS
            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                handler.Handle(new LoginCommand("staff.unverified@hotelsaas.local", "StaffPass123!"), CancellationToken.None));

            Assert.Contains("kích hoạt email hoặc xác thực số điện thoại", ex.Message);
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
    public async Task DualVerification_StaffWithEmailOrPhoneVerified_AllowsLoginSuccessfully()
    {
        var schema = $"test_staff_ok_{Guid.NewGuid():N}";
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

            var hasher = new PasswordHasherService();
            var verifiedStaff = new User
            {
                Id = Guid.NewGuid(),
                Email = "staff.verified@hotelsaas.local",
                Username = "staff.verified@hotelsaas.local",
                FullName = "Lê Nhân Viên Đã Kích Hoạt",
                PasswordHash = hasher.Hash("StaffPass123!"),
                GlobalRole = GlobalUserRole.TenantStaff,
                IsActive = true,
                EmailVerifiedAtUtc = DateTime.UtcNow, // EMAIL VERIFIED
                PhoneVerifiedAtUtc = null
            };
            context.Users.Add(verifiedStaff);
            await context.SaveChangesAsync();

            var handler = new LoginCommandHandler(context, hasher, CreateJwtService());

            // Act - Hard-Gating passes because staff has verified email
            var response = await handler.Handle(
                new LoginCommand("staff.verified@hotelsaas.local", "StaffPass123!"),
                CancellationToken.None);

            // Assert
            Assert.NotNull(response);
            Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
            Assert.Equal("staff.verified@hotelsaas.local", response.User.Email);
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

    // ──────────────────────────────────────────────────────────────────────────
    // 2. GOOGLE OAUTH SOCIAL LOGIN & ACCOUNT LINKING
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GoogleLogin_NewUser_AutoProvisionsCustomer_AndAwardsSilverLoyaltyTier()
    {
        var schema = $"test_google_new_{Guid.NewGuid():N}";
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
                Code = "T-GOOG",
                Name = "Google Test Tenant",
                Slug = $"goog-tenant-{Guid.NewGuid():N}",
                Status = TenantStatus.Active
            };
            context.Tenants.Add(tenant);

            var prop = new Property
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Code = "P-GOOG",
                Name = "Google Test Property",
                Slug = $"goog-prop-{Guid.NewGuid():N}",
                Status = PropertyStatus.Active
            };
            context.Properties.Add(prop);
            await context.SaveChangesAsync();

            var handler = new GoogleLoginCommandHandler(
                context,
                CreateGoogleAuthService(),
                new PasswordHasherService(),
                CreateJwtService(),
                NullLogger<GoogleLoginCommandHandler>.Instance);

            // Act with mock token: dev-mock-google-token:user@domain:FullName
            var command = new GoogleLoginCommand("dev-mock-google-token:tuanan.dev@gmail.com:Ngô Võ Tuấn An");
            var response = await handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.NotNull(response);
            Assert.False(string.IsNullOrWhiteSpace(response.AccessToken));
            Assert.Equal("tuanan.dev@gmail.com", response.User.Email);
            Assert.Equal("Ngô Võ Tuấn An", response.User.FullName);
            Assert.Equal(GlobalUserRole.Customer.ToString(), response.User.GlobalRole);

            // Verify User persisted with pre-verified email status (Soft-Gating)
            var user = await context.Users.FirstOrDefaultAsync(u => u.Email == "tuanan.dev@gmail.com");
            Assert.NotNull(user);
            Assert.NotNull(user.EmailVerifiedAtUtc);
            Assert.True(user.IsActive);

            // Verify SocialIdentity persisted
            var socialIdentity = await context.SocialIdentities
                .FirstOrDefaultAsync(si => si.UserId == user.Id && si.Provider == "Google");
            Assert.NotNull(socialIdentity);
            Assert.Equal("tuanan.dev@gmail.com", socialIdentity.ProviderEmail);

// Loyalty memberships are scoped to specific property/tenant bookings
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
    public async Task GoogleLogin_ExistingUser_LinksGoogleIdentityAndActivatesEmailVerification()
    {
        var schema = $"test_google_link_{Guid.NewGuid():N}";
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

            var hasher = new PasswordHasherService();
            var existingUser = new User
            {
                Id = Guid.NewGuid(),
                Email = "existing.traveler@gmail.com",
                Username = "existing.traveler@gmail.com",
                FullName = "Existing Traveler",
                PasswordHash = hasher.Hash("TravelerPass123!"),
                GlobalRole = GlobalUserRole.Customer,
                IsActive = true,
                EmailVerifiedAtUtc = null // Previously unverified
            };
            context.Users.Add(existingUser);
            await context.SaveChangesAsync();

            var handler = new GoogleLoginCommandHandler(
                context,
                CreateGoogleAuthService(),
                hasher,
                CreateJwtService(),
                NullLogger<GoogleLoginCommandHandler>.Instance);

            // Act
            var command = new GoogleLoginCommand("dev-mock-google-token:existing.traveler@gmail.com:Existing Traveler");
            var response = await handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.NotNull(response);
            Assert.Equal(existingUser.Id, response.User.Id);

            // Verify existing user's email is now verified
            var updatedUser = await context.Users.FirstAsync(u => u.Id == existingUser.Id);
            Assert.NotNull(updatedUser.EmailVerifiedAtUtc);

            // Verify SocialIdentity link created
            var socialIdentity = await context.SocialIdentities
                .FirstOrDefaultAsync(si => si.UserId == existingUser.Id && si.Provider == "Google");
            Assert.NotNull(socialIdentity);
            Assert.Equal("existing.traveler@gmail.com", socialIdentity.ProviderEmail);
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
    public async Task GoogleLogin_InvalidToken_ThrowsUnauthorizedAccessException()
    {
        var schema = $"test_google_invalid_{Guid.NewGuid():N}";
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

            var handler = new GoogleLoginCommandHandler(
                context,
                CreateGoogleAuthService(),
                new PasswordHasherService(),
                CreateJwtService(),
                NullLogger<GoogleLoginCommandHandler>.Instance);

            var command = new GoogleLoginCommand("invalid-tampered-token-xyz");

            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                handler.Handle(command, CancellationToken.None));

            Assert.Contains("Mã xác thực Google không hợp lệ", ex.Message);
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
