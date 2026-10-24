using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HotelSaas.WebApi.Tests;

/// <summary>
/// Unit tests verifying Task C01: Cloud Database Connection Resolver,
/// fail-closed startup guards, TLS enforcement, and Guest Portal middleware routing.
/// </summary>
public sealed class CloudDatabaseGuardTests
{
    private sealed class DummyMembershipLookupService : IMembershipLookupService
    {
        public bool ResolveCalled { get; private set; }

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            ResolveCalled = true;
            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(), StaffRole.Owner, targetPropertyId, targetPropertyId == null));
        }
    }

    [Fact]
    public void IsCloudDatabase_LocalhostAndDockerNames_ReturnsFalse()
    {
        Assert.False(CloudDatabaseGuard.IsCloudDatabase("Host=localhost;Database=dev;Username=postgres;Password=secret"));
        Assert.False(CloudDatabaseGuard.IsCloudDatabase("Host=127.0.0.1;Port=5432;Database=test;Username=postgres;Password=secret"));
        Assert.False(CloudDatabaseGuard.IsCloudDatabase("Host=postgres;Database=hotel_saas;Username=postgres;Password=secret"));
        Assert.False(CloudDatabaseGuard.IsCloudDatabase("Host=test_postgres;Database=hotel_saas;Username=postgres;Password=secret"));
        Assert.False(CloudDatabaseGuard.IsCloudDatabase(string.Empty));
        Assert.False(CloudDatabaseGuard.IsCloudDatabase(null));
    }

    [Fact]
    public void IsCloudDatabase_RemoteCloudHosts_ReturnsTrue()
    {
        Assert.True(CloudDatabaseGuard.IsCloudDatabase("Host=ep-cool-sample.us-east-2.aws.neon.tech;Database=neondb;Username=user;Password=secret;SSL Mode=Require"));
        Assert.True(CloudDatabaseGuard.IsCloudDatabase("Host=db.supabase.co;Database=postgres;Username=postgres;Password=secret;SSL Mode=Require"));
        Assert.True(CloudDatabaseGuard.IsCloudDatabase("Host=hotel-cluster.postgres.database.azure.com;Database=prod;Username=admin;Password=secret"));
        Assert.True(CloudDatabaseGuard.IsCloudDatabase("postgresql://admin:secret@ep-cool.us-east-2.aws.neon.tech:5432/neondb?sslmode=require"));
    }

    [Fact]
    public void ParsePostgresUri_StandardCloudUri_ParsesToNpgsqlFormat()
    {
        var uri = "postgresql://myuser:mypassword@ep-sample-123.us-east-2.aws.neon.tech:5432/hotel_saas_db?sslmode=require";
        var parsed = DatabaseConnectionResolver.ParsePostgresUri(uri);

        Assert.Contains("Host=ep-sample-123.us-east-2.aws.neon.tech", parsed);
        Assert.Contains("Database=hotel_saas_db", parsed);
        Assert.Contains("Username=myuser", parsed);
        Assert.Contains("Password=mypassword", parsed);
        Assert.Contains("SSL Mode=Require", parsed);
    }

    [Fact]
    public void ParsePostgresUri_UrlEncodedCredentials_DecodesCorrectly()
    {
        var uri = "postgresql://user%40example.com:p%40ss%3Aword@neon.tech:5432/db";
        var parsed = DatabaseConnectionResolver.ParsePostgresUri(uri);

        Assert.Contains("Username=user@example.com", parsed);
        Assert.Contains("Password=p@ss:word", parsed);
    }

    [Fact]
    public void MaskConnectionString_HidesPasswordSecurely()
    {
        var connStr = "Host=ep-sample.neon.tech;Database=db;Username=admin;Password=SuperSecretPass123!;SSL Mode=Require";
        var masked = DatabaseConnectionResolver.MaskConnectionString(connStr);

        Assert.DoesNotContain("SuperSecretPass123!", masked);
        Assert.Contains("Password=***", masked);

        var uriConnStr = "postgresql://admin:TopSecret999@ep-sample.neon.tech:5432/db";
        var maskedUri = DatabaseConnectionResolver.MaskConnectionString(uriConnStr);
        Assert.DoesNotContain("TopSecret999", maskedUri);
        Assert.Contains("admin:***@ep-sample.neon.tech", maskedUri);
    }

    [Fact]
    public void ValidateCloudConnectionSafety_CloudHostWithSslDisabled_ThrowsInvalidOperationException()
    {
        var insecureConn = "Host=ep-sample.neon.tech;Database=db;Username=admin;Password=secret;SSL Mode=Disable";
        var config = new ConfigurationBuilder().Build();

        var ex = Assert.Throws<InvalidOperationException>(() =>
            CloudDatabaseGuard.ValidateCloudConnectionSafety(insecureConn, config));

        Assert.Contains("bắt buộc phải bật mã hóa SSL/TLS", ex.Message);
    }

    [Fact]
    public void ValidateStartupExecution_CloudHostWithoutApproval_ThrowsInvalidOperationException()
    {
        var cloudConn = "Host=ep-sample.neon.tech;Database=db;Username=admin;Password=secret;SSL Mode=Require";
        var config = new ConfigurationBuilder().Build(); // No AllowCloudStartupDatabaseInit

        var ex = Assert.Throws<InvalidOperationException>(() =>
            CloudDatabaseGuard.ValidateStartupExecution(cloudConn, config));

        Assert.Contains("Khóa an toàn Cloud DB", ex.Message);
    }

    [Fact]
    public void ValidateStartupExecution_CloudHostWithExplicitApproval_Passes()
    {
        var cloudConn = "Host=ep-sample.neon.tech;Database=db;Username=admin;Password=secret;SSL Mode=Require";
        var inMemorySettings = new Dictionary<string, string?>
        {
            { "AllowCloudStartupDatabaseInit", "true" }
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();

        // Should not throw
        CloudDatabaseGuard.ValidateStartupExecution(cloudConn, config);
    }

    [Fact]
    public void ValidateStartupExecution_Localhost_PassesWithoutRestrictions()
    {
        var localConn = "Host=localhost;Database=hotel_saas_dev;Username=postgres;Password=postgres";
        var config = new ConfigurationBuilder().Build();

        // Localhost never requires AllowCloudStartupDatabaseInit
        CloudDatabaseGuard.ValidateStartupExecution(localConn, config);
    }

    [Fact]
    public async Task TenantPropertyContextMiddleware_AuthenticatedGuestCustomer_BypassesTenantRequirement()
    {
        // Arrange
        var nextCalled = false;
        RequestDelegate next = (ctx) =>
        {
            nextCalled = true;
            ctx.Response.StatusCode = 200;
            return Task.CompletedTask;
        };

        var middleware = new TenantPropertyContextMiddleware(next, NullLogger<TenantPropertyContextMiddleware>.Instance);

        var httpContext = new DefaultHttpContext();
        httpContext.Request.Path = "/api/guest/me";

        var guestUserId = Guid.NewGuid();
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, guestUserId.ToString()),
            new("sub", guestUserId.ToString()),
            new("globalRole", "Customer")
            // Note: NO tenantId or propertyId claim!
        };
        var identity = new ClaimsIdentity(claims, "Bearer");
        httpContext.User = new ClaimsPrincipal(identity);

        var tenantService = new CurrentTenantService();
        var propertyService = new CurrentPropertyService();
        var userContext = new CurrentUserContext(tenantService, propertyService);
        var membershipLookup = new DummyMembershipLookupService();

        // Act
        await middleware.InvokeAsync(httpContext, tenantService, propertyService, userContext, membershipLookup);

        // Assert: Middleware should not block with 401/403, but call next and set user context!
        Assert.True(nextCalled);
        Assert.Equal(200, httpContext.Response.StatusCode);
        Assert.Equal(guestUserId, userContext.UserId);
        Assert.Equal(GlobalUserRole.Customer, userContext.GlobalRole);
        Assert.False(membershipLookup.ResolveCalled);
    }
}
