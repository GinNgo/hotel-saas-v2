using System.Net;
using System.Reflection;
using System.Text;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Persistence;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Controllers;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Npgsql;

namespace HotelSaas.WebApi.Tests.Security;

/// <summary>
/// Verifies Wave 10 security, operational, and cloud deployment hardening:
/// 1. Fixed-window per-client-IP ASP.NET Core Rate Limiting ("auth", "webhooks", "public-print") returning HTTP 429.
/// 2. ForwardedHeadersMiddleware trusting reverse proxies (X-Forwarded-For / X-Forwarded-Proto) with cleared networks/proxies.
/// 3. Non-Development CORS excluding hardcoded localhost origins and honoring configured Cors:AllowedOrigins.
/// 4. Staging dev seeder opt-in guard (never auto-enabled on Staging/Production).
/// 5. MembershipLookupService resolving cloud DATABASE_URL (postgresql://) URIs via DatabaseConnectionResolver.
/// </summary>
public sealed class Wave10SecurityHardeningTests
{
    private const string TestJwtSecretKey = "Wave10SecurityHardeningTestSecretKey_AtLeast32BytesLong_2026!";

    [Fact]
    public void Controllers_HaveExpectedEnableRateLimitingPolicyAttributes()
    {
        var authPolicy = typeof(AuthController).GetCustomAttribute<EnableRateLimitingAttribute>();
        var webhookPolicy = typeof(WebhooksController).GetCustomAttribute<EnableRateLimitingAttribute>();
        var printPolicy = typeof(PrintDocumentsController).GetCustomAttribute<EnableRateLimitingAttribute>();
        var publicPolicy = typeof(PublicController).GetCustomAttribute<EnableRateLimitingAttribute>();
        var aiPolicy = typeof(AiController).GetCustomAttribute<EnableRateLimitingAttribute>();
        var paymentsVnpayIpnPolicy = typeof(PaymentsController)
            .GetMethod(nameof(PaymentsController.VnpayIpn))!
            .GetCustomAttribute<EnableRateLimitingAttribute>();
        var subscriptionsVnpayIpnPolicy = typeof(SubscriptionsController)
            .GetMethod(nameof(SubscriptionsController.VnpayIpn))!
            .GetCustomAttribute<EnableRateLimitingAttribute>();

        Assert.NotNull(authPolicy);
        Assert.Equal("auth", authPolicy!.PolicyName);

        Assert.NotNull(webhookPolicy);
        Assert.Equal("webhooks", webhookPolicy!.PolicyName);

        Assert.NotNull(printPolicy);
        Assert.Equal("public-print", printPolicy!.PolicyName);

        Assert.NotNull(publicPolicy);
        Assert.Equal("public-api", publicPolicy!.PolicyName);

        Assert.NotNull(aiPolicy);
        Assert.Equal("ai-chat", aiPolicy!.PolicyName);

        Assert.NotNull(paymentsVnpayIpnPolicy);
        Assert.Equal("webhooks", paymentsVnpayIpnPolicy!.PolicyName);

        Assert.NotNull(subscriptionsVnpayIpnPolicy);
        Assert.Equal("webhooks", subscriptionsVnpayIpnPolicy!.PolicyName);
    }

    [Fact]
    public async Task RateLimiting_PublicApiAndAiChatPolicies_Enforce429PerClientIp()
    {
        using var factory = new Wave10HardeningWebApplicationFactory(
            environmentName: "Testing",
            extraConfig: new Dictionary<string, string?>
            {
                ["RateLimiting:PublicApiPermitLimit"] = "2",
                ["RateLimiting:AiChatPermitLimit"] = "2",
                ["RateLimiting:WindowSeconds"] = "60"
            });

        // Public API: first 2 succeed, 3rd is rate-limited (429)
        var pub1 = await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.2");
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Path = "/api/public/tourist-zones";
            ctx.Request.Headers["X-Forwarded-For"] = "198.51.100.40";
        });
        var pub2 = await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.2");
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Path = "/api/public/tourist-zones";
            ctx.Request.Headers["X-Forwarded-For"] = "198.51.100.40";
        });
        var pub3 = await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.2");
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Path = "/api/public/tourist-zones";
            ctx.Request.Headers["X-Forwarded-For"] = "198.51.100.40";
        });

        Assert.Equal(StatusCodes.Status200OK, pub1.Response.StatusCode);
        Assert.Equal(StatusCodes.Status200OK, pub2.Response.StatusCode);
        Assert.Equal(StatusCodes.Status429TooManyRequests, pub3.Response.StatusCode);

        // AI Chat: first 2 return 400 (empty message), 3rd is rate-limited (429)
        var ai1 = await SendPostJsonThroughProxyAsync(factory, "/api/ai/chat", "198.51.100.41");
        var ai2 = await SendPostJsonThroughProxyAsync(factory, "/api/ai/chat", "198.51.100.41");
        var ai3 = await SendPostJsonThroughProxyAsync(factory, "/api/ai/chat", "198.51.100.41");

        Assert.Equal(StatusCodes.Status400BadRequest, ai1.Response.StatusCode);
        Assert.Equal(StatusCodes.Status400BadRequest, ai2.Response.StatusCode);
        Assert.Equal(StatusCodes.Status429TooManyRequests, ai3.Response.StatusCode);
    }

    [Fact]
    public void JwtSecretGuard_InStagingEnvironment_RejectsDevPlaceholderKey()
    {
        using var factory = new Wave10HardeningWebApplicationFactory(
            environmentName: Environments.Staging,
            extraConfig: new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = "DevOnly_TestPlaceholderKey_NotForStagingOrProd_32B!"
            });

        var ex = Assert.ThrowsAny<Exception>(() => factory.CreateClient());
        var root = ex is TargetInvocationException tie && tie.InnerException != null ? tie.InnerException : ex;
        Assert.IsType<InvalidOperationException>(root);
        Assert.Contains("JwtSettings:SecretKey", root.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SeedDefaultRolesAndPermissions_WhenDevBootstrapDisabled_DoesNotSeedDevSuperAdminOrDummyBankConfig()
    {
        var baseConn = Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
            ?? "Host=localhost;Port=5435;Database=hotel_saas_p1b01a_test;Username=postgres;Password=postgres;Persist Security Info=true;";

        var connCheckBuilder = new NpgsqlConnectionStringBuilder(baseConn);
        var dbName = connCheckBuilder.Database?.ToLowerInvariant() ?? string.Empty;
        if (!dbName.EndsWith("_test", StringComparison.Ordinal) && !dbName.Contains("test_", StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"Refusing to run schema seed test against non-test database '{connCheckBuilder.Database}'.");
        }

        var schemaName = "wave10_seed_" + Guid.NewGuid().ToString("N")[..12];
        await using (var setupConn = new NpgsqlConnection(baseConn))
        {
            await setupConn.OpenAsync();
            await using var createCmd = setupConn.CreateCommand();
            createCmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schemaName}\";";
            await createCmd.ExecuteNonQueryAsync();
        }

        try
        {
            var schemaBuilder = new NpgsqlConnectionStringBuilder(baseConn) { SearchPath = schemaName };
            var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(schemaBuilder.ConnectionString, o =>
                    o.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName))
                .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning))
                .Options;

            var tenantSvc = new CurrentTenantService();
            var propSvc = new CurrentPropertyService();

            await using var db = new ApplicationDbContext(dbOptions, tenantSvc, propSvc);
            await db.Database.MigrateAsync();

            var realTenant = new Tenant
            {
                Id = Guid.NewGuid(),
                Name = "Real Production Hotel Group",
                Code = "REAL-01",
                Slug = "real-production-hotel",
                Address = "10 Le Loi",
                City = "TP. Hồ Chí Minh",
                Status = TenantStatus.Active
            };
            db.Tenants.Add(realTenant);
            await db.SaveChangesAsync();

            var emptyConfig = new ConfigurationBuilder().Build();

            // 1. Fresh DB with allowDevPlatformBootstrap: false (Staging/Production default)
            await SeedData.SeedDefaultRolesAndPermissions(db, allowDevPlatformBootstrap: false, configuration: emptyConfig);

            Assert.True(await db.AccessRoles.CountAsync() >= 5);
            Assert.True(await db.PermissionFunctions.CountAsync() >= 19);
            Assert.True(await db.SubscriptionPlans.CountAsync() >= 3);

            var housekeeperRole = await db.AccessRoles.FirstAsync(r => r.Code == "HOUSEKEEPER");
            var hkFunc = await db.PermissionFunctions.FirstAsync(f => f.Code == "HOUSEKEEPING");
            var hkPerm = await db.RolePermissions.FirstAsync(rp => rp.RoleId == housekeeperRole.Id && rp.FunctionId == hkFunc.Id);
            Assert.Equal(7, hkPerm.ActionMask);

            // Must NEVER create hardcoded dev SuperAdmin, dummy MBBank print config, or dummy Pro contract
            Assert.False(await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == "superadmin@hotelsaas.platform"));
            Assert.False(await db.Users.IgnoreQueryFilters().AnyAsync(u => u.GlobalRole == GlobalUserRole.SuperAdmin));
            Assert.False(await db.PrintTemplateConfigs.IgnoreQueryFilters().AnyAsync(c => c.TenantId == realTenant.Id));
            Assert.False(await db.TenantContracts.IgnoreQueryFilters().AnyAsync(c => c.TenantId == realTenant.Id));

            // 2. Subsequent startup (AccessRoles already exist) STILL must NOT seed dev bootstrap artifacts
            await SeedData.SeedDefaultRolesAndPermissions(db, allowDevPlatformBootstrap: false, configuration: emptyConfig);

            Assert.False(await db.Users.IgnoreQueryFilters().AnyAsync(u => u.GlobalRole == GlobalUserRole.SuperAdmin));
            Assert.False(await db.PrintTemplateConfigs.IgnoreQueryFilters().AnyAsync(c => c.TenantId == realTenant.Id));
            Assert.False(await db.TenantContracts.IgnoreQueryFilters().AnyAsync(c => c.TenantId == realTenant.Id));

            // 3. Explicit PlatformBootstrap:AdminEmail + PlatformBootstrap:AdminPassword creates ONLY that configured SuperAdmin
            var dynamicPassword = $"OpsBootstrap!{Guid.NewGuid():N}";
            var bootstrapConfig = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["PlatformBootstrap:AdminEmail"] = "ops.admin@hotelsaas.example",
                    ["PlatformBootstrap:AdminPassword"] = dynamicPassword
                })
                .Build();

            await SeedData.SeedDefaultRolesAndPermissions(db, allowDevPlatformBootstrap: false, configuration: bootstrapConfig);

            var configuredAdmin = await db.Users.IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Email == "ops.admin@hotelsaas.example");
            Assert.NotNull(configuredAdmin);
            Assert.Equal(GlobalUserRole.SuperAdmin, configuredAdmin!.GlobalRole);
            Assert.True(configuredAdmin.IsActive);
            Assert.False(await db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == "superadmin@hotelsaas.platform"));
            Assert.False(await db.PrintTemplateConfigs.IgnoreQueryFilters().AnyAsync(c => c.TenantId == realTenant.Id));
        }
        finally
        {
            try
            {
                await using var dropConn = new NpgsqlConnection(baseConn);
                await dropConn.OpenAsync();
                await using var dropCmd = dropConn.CreateCommand();
                dropCmd.CommandText = $"DROP SCHEMA IF EXISTS \"{schemaName}\" CASCADE;";
                await dropCmd.ExecuteNonQueryAsync();
            }
            catch
            {
                // Ignore cleanup failure
            }
        }
    }

    [Fact]
    public async Task RateLimiting_AuthPolicy_Enforces429PerClientIpViaForwardedHeaders()
    {
        using var factory = new Wave10HardeningWebApplicationFactory(
            environmentName: "Testing",
            extraConfig: new Dictionary<string, string?>
            {
                ["RateLimiting:AuthPermitLimit"] = "2",
                ["RateLimiting:WindowSeconds"] = "60"
            });

        // Client IP A: first 2 requests reach SocialLogin (503 disabled), 3rd is rate-limited (429)
        var req1 = await SendPostJsonThroughProxyAsync(factory, "/api/auth/social-login", "198.51.100.10");
        var req2 = await SendPostJsonThroughProxyAsync(factory, "/api/auth/social-login", "198.51.100.10");
        var req3 = await SendPostJsonThroughProxyAsync(factory, "/api/auth/social-login", "198.51.100.10");

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, req1.Response.StatusCode);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, req2.Response.StatusCode);
        Assert.Equal(StatusCodes.Status429TooManyRequests, req3.Response.StatusCode);
        Assert.True(req3.Response.Headers.ContainsKey("Retry-After"));

        // Distinct Client IP B is partitioned separately and not blocked by IP A
        var otherIpReq = await SendPostJsonThroughProxyAsync(factory, "/api/auth/social-login", "198.51.100.11");
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, otherIpReq.Response.StatusCode);
    }

    [Fact]
    public async Task RateLimiting_WebhooksPolicy_Enforces429WhenLimitExceeded()
    {
        using var factory = new Wave10HardeningWebApplicationFactory(
            environmentName: "Testing",
            extraConfig: new Dictionary<string, string?>
            {
                ["RateLimiting:WebhookPermitLimit"] = "2",
                ["RateLimiting:WindowSeconds"] = "60"
            });

        // Missing Apikey returns 401 on first 2 calls; 3rd call hits the "webhooks" rate limiter (429)
        var req1 = await SendPostJsonThroughProxyAsync(factory, "/api/webhooks/sepay", "198.51.100.20");
        var req2 = await SendPostJsonThroughProxyAsync(factory, "/api/webhooks/sepay", "198.51.100.20");
        var req3 = await SendPostJsonThroughProxyAsync(factory, "/api/webhooks/sepay", "198.51.100.20");

        Assert.Equal(StatusCodes.Status401Unauthorized, req1.Response.StatusCode);
        Assert.Equal(StatusCodes.Status401Unauthorized, req2.Response.StatusCode);
        Assert.Equal(StatusCodes.Status429TooManyRequests, req3.Response.StatusCode);
    }

    [Fact]
    public async Task RateLimiting_PublicPrintPolicy_Enforces429WhenLimitExceeded()
    {
        using var factory = new Wave10HardeningWebApplicationFactory(
            environmentName: "Testing",
            extraConfig: new Dictionary<string, string?>
            {
                ["RateLimiting:PublicPrintPermitLimit"] = "2",
                ["RateLimiting:WindowSeconds"] = "60"
            },
            configureTestServices: services =>
            {
                var existingSenders = services.Where(d => d.ServiceType == typeof(ISender)).ToList();
                foreach (var descriptor in existingSenders)
                {
                    services.Remove(descriptor);
                }

                services.AddSingleton<ISender>(new NotFoundStubSender());
            });

        var req1 = await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.2");
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Path = "/api/print/voucher/RES-TEST01";
            ctx.Request.Headers["X-Forwarded-For"] = "198.51.100.30";
        });
        var req2 = await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.2");
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Path = "/api/print/voucher/RES-TEST01";
            ctx.Request.Headers["X-Forwarded-For"] = "198.51.100.30";
        });
        var req3 = await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.2");
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Path = "/api/print/voucher/RES-TEST01";
            ctx.Request.Headers["X-Forwarded-For"] = "198.51.100.30";
        });

        Assert.Equal(StatusCodes.Status404NotFound, req1.Response.StatusCode);
        Assert.Equal(StatusCodes.Status404NotFound, req2.Response.StatusCode);
        Assert.Equal(StatusCodes.Status429TooManyRequests, req3.Response.StatusCode);
    }

    [Fact]
    public async Task ForwardedHeaders_ConfiguredWithClearedProxyLists_UpdatesRemoteIpAndScheme()
    {
        const string testMetricsKey = "wave10-test-metrics-secret-key";
        using var factory = new Wave10HardeningWebApplicationFactory(
            environmentName: "Testing",
            extraConfig: new Dictionary<string, string?>
            {
                ["Metrics:ApiKey"] = testMetricsKey
            });

        var forwardedOptions = factory.Services.GetRequiredService<IOptions<ForwardedHeadersOptions>>().Value;
        Assert.Equal(ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto, forwardedOptions.ForwardedHeaders);
        Assert.Empty(forwardedOptions.KnownIPNetworks);
        Assert.Empty(forwardedOptions.KnownProxies);

        // Request from Docker bridge proxy with external X-Forwarded-For & X-Forwarded-Proto
        var unauthenticatedMetrics = await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.2");
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Path = "/metrics";
            ctx.Request.Headers["X-Forwarded-For"] = "203.0.113.55";
            ctx.Request.Headers["X-Forwarded-Proto"] = "https";
        });

        Assert.Equal(IPAddress.Parse("203.0.113.55"), unauthenticatedMetrics.Connection.RemoteIpAddress);
        Assert.Equal("https", unauthenticatedMetrics.Request.Scheme);
        Assert.Equal(StatusCodes.Status401Unauthorized, unauthenticatedMetrics.Response.StatusCode);

        // Providing matching X-Metrics-Key succeeds for non-loopback Prometheus scraper
        var authenticatedMetrics = await factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.2");
            ctx.Request.Method = HttpMethods.Get;
            ctx.Request.Path = "/metrics";
            ctx.Request.Headers["X-Forwarded-For"] = "203.0.113.55";
            ctx.Request.Headers["X-Metrics-Key"] = testMetricsKey;
        });

        Assert.Equal(StatusCodes.Status200OK, authenticatedMetrics.Response.StatusCode);
    }

    [Fact]
    public void Cors_ResolveAllowedOrigins_ExcludesLocalhostInStagingAndProduction()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins:0"] = "https://staging.hotelsaas.local",
                ["Cors:AllowedOrigins:1"] = "https://app.hotelsaas.vn"
            })
            .Build();

        var devOrigins = Program.ResolveAllowedCorsOrigins(config, new StubHostEnvironment(Environments.Development));
        Assert.Contains("http://localhost:4200", devOrigins);
        Assert.Contains("http://localhost:3000", devOrigins);
        Assert.Contains("https://staging.hotelsaas.local", devOrigins);

        var testOrigins = Program.ResolveAllowedCorsOrigins(config, new StubHostEnvironment("Testing"));
        Assert.Contains("http://localhost:4200", testOrigins);
        Assert.Contains("http://localhost:3000", testOrigins);

        var stagingOrigins = Program.ResolveAllowedCorsOrigins(config, new StubHostEnvironment(Environments.Staging));
        Assert.DoesNotContain("http://localhost:4200", stagingOrigins);
        Assert.DoesNotContain("http://localhost:3000", stagingOrigins);
        Assert.Equal(2, stagingOrigins.Length);
        Assert.Contains("https://staging.hotelsaas.local", stagingOrigins);
        Assert.Contains("https://app.hotelsaas.vn", stagingOrigins);

        var prodOrigins = Program.ResolveAllowedCorsOrigins(config, new StubHostEnvironment(Environments.Production));
        Assert.DoesNotContain("http://localhost:4200", prodOrigins);
        Assert.DoesNotContain("http://localhost:3000", prodOrigins);
        Assert.Equal(2, prodOrigins.Length);
    }

    [Fact]
    public async Task Cors_HttpPipelineInStaging_RejectsLocalhostOrigin_AndAllowsConfiguredOrigin()
    {
        using var factory = new Wave10HardeningWebApplicationFactory(
            environmentName: Environments.Staging,
            extraConfig: new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins:0"] = "https://staging.hotelsaas.local"
            });
        using var client = factory.CreateClient();

        using var localhostReq = new HttpRequestMessage(HttpMethod.Get, "/health");
        localhostReq.Headers.Add("Origin", "http://localhost:4200");
        var localhostRes = await client.SendAsync(localhostReq);

        Assert.Equal(HttpStatusCode.OK, localhostRes.StatusCode);
        Assert.False(localhostRes.Headers.Contains("Access-Control-Allow-Origin"));

        using var allowedReq = new HttpRequestMessage(HttpMethod.Get, "/health");
        allowedReq.Headers.Add("Origin", "https://staging.hotelsaas.local");
        var allowedRes = await client.SendAsync(allowedReq);

        Assert.Equal(HttpStatusCode.OK, allowedRes.StatusCode);
        Assert.True(allowedRes.Headers.TryGetValues("Access-Control-Allow-Origin", out var originValues));
        Assert.Equal("https://staging.hotelsaas.local", Assert.Single(originValues));
        Assert.True(allowedRes.Headers.TryGetValues("Access-Control-Allow-Credentials", out var credValues));
        Assert.Equal("true", Assert.Single(credValues));
    }

    [Fact]
    public void DevSeederGuard_DoesNotAutoEnableOnStagingOrProduction_RequiresExplicitOptIn()
    {
        const string localConn = "Host=localhost;Database=hotelsaas;Username=postgres;Password=postgres";
        const string cloudConn = "Host=ep-sample.us-east-2.aws.neon.tech;Database=neondb;Username=u;Password=p;SSL Mode=Require";

        var emptyConfig = new ConfigurationBuilder().Build();
        var stagingOptInOnly = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["AllowStagingDevSeed"] = "true" })
            .Build();
        var stagingAndCloudOptIn = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["AllowStagingDevSeed"] = "true",
                ["AllowCloudDevSeed"] = "true"
            })
            .Build();

        // Staging never auto-seeds without explicit opt-in
        Assert.False(Program.ShouldRunDevSeeder(new StubHostEnvironment(Environments.Staging), emptyConfig, isCloudDb: false, localConn));
        Assert.False(Program.ShouldRunDevSeeder(new StubHostEnvironment(Environments.Staging), emptyConfig, isCloudDb: true, cloudConn));

        // Staging explicit opt-in works on local DB, but cloud DB additionally requires AllowCloudDevSeed=true
        Assert.True(Program.ShouldRunDevSeeder(new StubHostEnvironment(Environments.Staging), stagingOptInOnly, isCloudDb: false, localConn));
        Assert.False(Program.ShouldRunDevSeeder(new StubHostEnvironment(Environments.Staging), stagingOptInOnly, isCloudDb: true, cloudConn));
        Assert.True(Program.ShouldRunDevSeeder(new StubHostEnvironment(Environments.Staging), stagingAndCloudOptIn, isCloudDb: true, cloudConn));

        // Development still runs on local DB by default
        Assert.True(Program.ShouldRunDevSeeder(new StubHostEnvironment(Environments.Development), emptyConfig, isCloudDb: false, localConn));
        Assert.False(Program.ShouldRunDevSeeder(new StubHostEnvironment(Environments.Development), emptyConfig, isCloudDb: true, cloudConn));

        // Production never runs dev seeder even if opt-in flags are set
        Assert.False(Program.ShouldRunDevSeeder(new StubHostEnvironment(Environments.Production), stagingAndCloudOptIn, isCloudDb: false, localConn));
        Assert.False(Program.ShouldRunDevSeeder(new StubHostEnvironment(Environments.Production), stagingAndCloudOptIn, isCloudDb: true, cloudConn));
    }

    [Fact]
    public void MembershipLookupService_ResolvesCloudDatabaseUrlUri_AndRejectsMissingConfig()
    {
        var cloudUriConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DATABASE_URL"] = "postgresql://testuser:testpass%21@ep-sample-123.us-east-2.aws.neon.tech:5432/hotelsaas_unit?sslmode=require"
            })
            .Build();

        var service = new MembershipLookupService(cloudUriConfig, NullLogger<MembershipLookupService>.Instance);

        var connField = typeof(MembershipLookupService)
            .GetField("_connectionString", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(connField);

        var resolvedConnStr = Assert.IsType<string>(connField!.GetValue(service));
        var npgsqlBuilder = new NpgsqlConnectionStringBuilder(resolvedConnStr);

        Assert.Equal("ep-sample-123.us-east-2.aws.neon.tech", npgsqlBuilder.Host);
        Assert.Equal(5432, npgsqlBuilder.Port);
        Assert.Equal("hotelsaas_unit", npgsqlBuilder.Database);
        Assert.Equal("testuser", npgsqlBuilder.Username);
        Assert.Equal("testpass!", npgsqlBuilder.Password);
        Assert.Equal(SslMode.Require, npgsqlBuilder.SslMode);
        Assert.Equal(DatabaseConnectionResolver.ResolveConnectionString(cloudUriConfig), resolvedConnStr);

        // Missing both DefaultConnection and DATABASE_URL fails fast
        var emptyConfig = new ConfigurationBuilder().Build();
        Assert.Throws<InvalidOperationException>(() =>
            new MembershipLookupService(emptyConfig, NullLogger<MembershipLookupService>.Instance));
    }

    private static Task<HttpContext> SendPostJsonThroughProxyAsync(
        Wave10HardeningWebApplicationFactory factory,
        string path,
        string forwardedClientIp)
    {
        var payloadBytes = Encoding.UTF8.GetBytes("{}");
        return factory.Server.SendAsync(ctx =>
        {
            ctx.Connection.RemoteIpAddress = IPAddress.Parse("172.18.0.2");
            ctx.Request.Method = HttpMethods.Post;
            ctx.Request.Path = path;
            ctx.Request.ContentType = "application/json";
            ctx.Request.Body = new MemoryStream(payloadBytes);
            ctx.Request.ContentLength = payloadBytes.Length;
            ctx.Request.Headers["X-Forwarded-For"] = forwardedClientIp;
        });
    }

    private sealed class Wave10HardeningWebApplicationFactory : WebApplicationFactory<Program>
    {
        private readonly string _environmentName;
        private readonly IDictionary<string, string?>? _extraConfig;
        private readonly Action<IServiceCollection>? _configureTestServices;

        public Wave10HardeningWebApplicationFactory(
            string environmentName,
            IDictionary<string, string?>? extraConfig = null,
            Action<IServiceCollection>? configureTestServices = null)
        {
            _environmentName = environmentName;
            _extraConfig = extraConfig;
            _configureTestServices = configureTestServices;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Port=5432;Database=hotel_saas_unit_test;Username=postgres;Password=postgres",
                ["JwtSettings:SecretKey"] = TestJwtSecretKey,
                ["JwtSettings:Issuer"] = "HotelSaas",
                ["JwtSettings:Audience"] = "HotelSaasClient",
                ["SkipStartupDatabaseInit"] = "true"
            };

            if (_extraConfig != null)
            {
                foreach (var kvp in _extraConfig)
                {
                    settings[kvp.Key] = kvp.Value;
                }
            }

            builder.UseEnvironment(_environmentName);
            foreach (var kvp in settings)
            {
                builder.UseSetting(kvp.Key, kvp.Value);
            }

            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(settings);
            });

            builder.ConfigureTestServices(services =>
            {
                var bgServices = services
                    .Where(d => d.ServiceType == typeof(IHostedService) &&
                                (d.ImplementationType == typeof(ExpiredHoldSweepBackgroundService) ||
                                 d.ImplementationType == typeof(NightAuditBackgroundService)))
                    .ToList();
                foreach (var descriptor in bgServices)
                {
                    services.Remove(descriptor);
                }

                _configureTestServices?.Invoke(services);
            });
        }
    }

    private sealed class StubHostEnvironment : IHostEnvironment
    {
        public StubHostEnvironment(string environmentName) => EnvironmentName = environmentName;
        public string EnvironmentName { get; set; }
        public string ApplicationName { get; set; } = "HotelSaas.WebApi";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private sealed class NotFoundStubSender : ISender
    {
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default) =>
            throw new NotFoundException("Stubbed voucher not found.");

        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest =>
            throw new NotFoundException("Stubbed request not found.");

        public Task<object?> Send(object request, CancellationToken cancellationToken = default) =>
            throw new NotFoundException("Stubbed object request not found.");

        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();

        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default) =>
            throw new NotImplementedException();
    }
}
