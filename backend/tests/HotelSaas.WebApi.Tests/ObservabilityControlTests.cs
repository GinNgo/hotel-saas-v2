using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Reflection;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Controllers;
using HotelSaas.WebApi.Middleware;
using HotelSaas.WebApi.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Serilog.Core;
using Serilog.Events;
using Xunit;

namespace HotelSaas.WebApi.Tests;

public sealed class ObservabilityControlTests
{
    private sealed class TestHeaderAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public TestHeaderAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue("X-Test-User", out var userVal) || string.IsNullOrWhiteSpace(userVal))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var role = Request.Headers.TryGetValue("X-Test-Role", out var roleVal) && !string.IsNullOrWhiteSpace(roleVal)
                ? roleVal.ToString()
                : "TenantStaff";

            var claims = new List<Claim>
            {
                new("sub", userVal.ToString()),
                new("globalRole", role)
            };

            if (Request.Headers.TryGetValue("X-Test-Tenant", out var tenantVal) && !string.IsNullOrWhiteSpace(tenantVal))
            {
                claims.Add(new Claim("tenantId", tenantVal.ToString()));
            }

            var identity = new ClaimsIdentity(claims, "TestBearer", ClaimTypes.Name, "globalRole");
            var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), "TestBearer");
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }

    private sealed class StubTenantService : ICurrentTenantService
    {
        public Guid? TenantId { get; set; }
    }

    private sealed class StubPropertyService : ICurrentPropertyService
    {
        public Guid? PropertyId { get; set; }
        public bool IsTenantWide { get; set; }
        public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = Array.Empty<Guid>();
        public Guid? HeaderPropertyId { get; set; }
        public Guid? TokenPropertyId { get; set; }
    }

    private sealed class StubMembershipLookupService : IMembershipLookupService
    {
        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Owner, targetPropertyId, true));
    }

    public class NotImplementedDbProxy : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) =>
            throw new NotImplementedException($"Stub DbContext member '{targetMethod?.Name}' not implemented.");
    }
    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;

        public StubHttpClientFactory(HttpMessageHandler handler)
        {
            _handler = handler;
        }

        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
    }

    private sealed class DelegatingStubHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;

        public DelegatingStubHandler(Func<HttpRequestMessage, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(_responder(request));
        }
    }

    private static ObservabilityControlService CreateService(
        LoggingLevelSwitch? levelSwitch = null,
        Func<HttpRequestMessage, HttpResponseMessage>? responder = null,
        Dictionary<string, string?>? configOverrides = null)
    {
        var cfgValues = new Dictionary<string, string?>
        {
            ["Observability:LokiUrl"] = "http://loki.test:3100",
            ["Observability:PrometheusUrl"] = "http://prom.test:9090",
            ["Observability:GrafanaUrl"] = "http://grafana.test:3000"
        };
        if (configOverrides != null)
        {
            foreach (var (k, v) in configOverrides)
            {
                cfgValues[k] = v;
            }
        }

        var config = new ConfigurationBuilder().AddInMemoryCollection(cfgValues).Build();
        var sw = levelSwitch ?? new LoggingLevelSwitch(LogEventLevel.Information);
        var handler = new DelegatingStubHandler(responder ?? (_ => new HttpResponseMessage(HttpStatusCode.OK)));
        return new ObservabilityControlService(sw, new StubHttpClientFactory(handler), config);
    }

    [Fact]
    public void UpdateSettings_SwitchesMinimumLevelAndTogglesFlags_AndRejectsInvalidLevel()
    {
        var levelSwitch = new LoggingLevelSwitch(LogEventLevel.Information);
        var service = CreateService(levelSwitch);
        var adminId = Guid.NewGuid();

        var updated = service.UpdateSettings("Warning", metricsExportEnabled: false, structuredRequestLoggingEnabled: false, updatedByUserId: adminId);

        Assert.Equal("Warning", updated.MinimumLogLevel);
        Assert.Equal(LogEventLevel.Warning, levelSwitch.MinimumLevel);
        Assert.False(service.IsMetricsExportEnabled);
        Assert.False(service.IsStructuredRequestLoggingEnabled);
        Assert.Equal(adminId, updated.UpdatedByUserId);
        Assert.NotNull(updated.UpdatedAtUtc);

        Assert.Throws<BadRequestException>(() =>
            service.UpdateSettings("InvalidLevel\"} |= \"hack", true, true, adminId));
    }

    [Fact]
    public void BuildLokiQuery_EnforcesLevelAllowlist_AndEscapesSearchSafely()
    {
        var q1 = ObservabilityControlService.BuildLokiQuery("Warning", "corr-123");
        Assert.Equal("{container=\"hotelsaas-backend-api\",level=\"Warning\"} |= \"corr-123\"", q1);

        var qInjected = ObservabilityControlService.BuildLokiQuery(
            "Error\"} | drop __error__",
            "foo\"bar\\baz\r\nqux");
        Assert.Equal("{container=\"hotelsaas-backend-api\"} |= \"foo\\\"bar\\\\bazqux\"", qInjected);
    }

    [Fact]
    public async Task QueryLokiLogsAsync_ParsesRenderedJsonAndDegradesGracefullyWhenOffline()
    {
        const string lokiJson = """
        {
          "status": "success",
          "data": {
            "resultType": "streams",
            "result": [
              {
                "stream": {
                  "container": "hotelsaas-backend-api",
                  "level": "Warning",
                  "tenant_id": "t-1",
                  "property_id": "p-1"
                },
                "values": [
                  [
                    "1764000000000000000",
                    "{\"Timestamp\":\"2026-11-27T08:00:00.0000000Z\",\"Level\":\"Warning\",\"RenderedMessage\":\"Security/Isolation Gate blocked\",\"Properties\":{\"CorrelationId\":\"corr-abc\",\"TenantId\":\"t-1\",\"PropertyId\":\"p-1\",\"UserId\":\"u-1\",\"StatusCode\":403,\"ElapsedMs\":12.5,\"ErrorCode\":\"ERR_FORBIDDEN\"}}"
                  ],
                  [
                    "1764000005000000000",
                    "{\"@t\":\"2026-11-27T08:00:05.0000000Z\",\"@l\":\"Error\",\"@m\":\"Unhandled error\",\"CorrelationId\":\"corr-500\",\"StatusCode\":500}"
                  ]
                ]
              }
            ]
          }
        }
        """;

        var service = CreateService(responder: req =>
        {
            Assert.Contains("/loki/api/v1/query_range", req.RequestUri!.PathAndQuery);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(lokiJson, Encoding.UTF8, "application/json")
            };
        });

        var res = await service.QueryLokiLogsAsync("Warning", "corr", 60, 50);
        Assert.True(res.Available);
        Assert.Equal(2, res.TotalReturned);
        Assert.Equal("corr-500", res.Entries[0].CorrelationId);
        Assert.Equal("Error", res.Entries[0].Level);
        Assert.Equal(500, res.Entries[0].StatusCode);

        Assert.Equal("corr-abc", res.Entries[1].CorrelationId);
        Assert.Equal("ERR_FORBIDDEN", res.Entries[1].ErrorCode);
        Assert.Equal(403, res.Entries[1].StatusCode);
        Assert.Equal(12.5, res.Entries[1].ElapsedMs);

        var offlineService = CreateService(responder: _ => throw new HttpRequestException("Connection refused"));
        var offlineRes = await offlineService.QueryLokiLogsAsync(null, null, 60, 50);
        Assert.False(offlineRes.Available);
        Assert.NotNull(offlineRes.ErrorMessage);
        Assert.Empty(offlineRes.Entries);
    }

    [Fact]
    public async Task GetStackStatusAsync_ProbesAllThreeServicesAndExtractsPrometheusScrapeTarget()
    {
        var service = CreateService(responder: req =>
        {
            var url = req.RequestUri!.ToString();
            if (url.EndsWith("/ready"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("ready") };
            if (url.EndsWith("/loki/api/v1/labels"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"data\":[\"container\",\"level\",\"tenant_id\"]}", Encoding.UTF8, "application/json") };
            if (url.EndsWith("/-/ready"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("Prometheus Server is Ready.") };
            if (url.EndsWith("/api/v1/targets"))
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("{\"data\":{\"activeTargets\":[{\"labels\":{\"job\":\"hotelsaas-backend-api\"},\"health\":\"up\",\"lastError\":\"\"}]}}", Encoding.UTF8, "application/json")
                };
            if (url.EndsWith("/api/health"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"database\":\"ok\",\"version\":\"11.2.0\"}", Encoding.UTF8, "application/json") };

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var status = await service.GetStackStatusAsync();
        Assert.Equal("up", status.PrometheusScrapeHealth);
        Assert.Null(status.PrometheusScrapeError);
        Assert.Equal(3, status.LokiLabels.Count);
        Assert.All(status.Services, s => Assert.Equal("up", s.Status));
        Assert.Contains(status.Services, s => s.Name == "Grafana" && s.Version == "11.2.0");
    }

    [Fact]
    public async Task PlatformObservabilityPipeline_EnforcesSuperAdminRole_AndHandlesStatusSettingsLogs()
    {
        const string lokiJson = """
        {
          "status": "success",
          "data": {
            "resultType": "streams",
            "result": [
              {
                "stream": { "container": "hotelsaas-backend-api", "level": "Warning", "tenant_id": "t-pipe", "property_id": "p-pipe" },
                "values": [
                  [ "1764000010000000000", "{\"Timestamp\":\"2026-11-27T09:00:00.0000000Z\",\"Level\":\"Warning\",\"RenderedMessage\":\"Isolation blocked\",\"Properties\":{\"CorrelationId\":\"corr-pipe-1\",\"StatusCode\":403}}" ]
                ]
              }
            ]
          }
        }
        """;

        var levelSwitch = new LoggingLevelSwitch(LogEventLevel.Information);
        var obsService = CreateService(levelSwitch, req =>
        {
            var url = req.RequestUri!.ToString();
            if (url.EndsWith("/ready"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("ready") };
            if (url.EndsWith("/loki/api/v1/labels"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"data\":[\"container\",\"level\"]}", Encoding.UTF8, "application/json") };
            if (url.EndsWith("/-/ready"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("Prometheus Server is Ready.") };
            if (url.EndsWith("/api/v1/targets"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"data\":{\"activeTargets\":[{\"labels\":{\"job\":\"hotelsaas-backend-api\"},\"health\":\"up\",\"lastError\":\"\"}]}}", Encoding.UTF8, "application/json") };
            if (url.EndsWith("/api/health"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"database\":\"ok\",\"version\":\"11.2.0\"}", Encoding.UTF8, "application/json") };
            if (url.Contains("/loki/api/v1/query_range"))
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(lokiJson, Encoding.UTF8, "application/json") };
            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseTestServer();
        builder.Services.AddAuthentication("TestBearer")
            .AddScheme<AuthenticationSchemeOptions, TestHeaderAuthHandler>("TestBearer", _ => { });
        builder.Services.AddAuthorizationBuilder();
        builder.Services.AddControllers()
            .AddApplicationPart(typeof(PlatformObservabilityController).Assembly)
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            });
        builder.Services.AddSingleton<IObservabilityControlService>(obsService);
        builder.Services.AddScoped<ICurrentTenantService, StubTenantService>();
        builder.Services.AddScoped<ICurrentPropertyService, StubPropertyService>();
        builder.Services.AddScoped<ICurrentUserContext, CurrentUserContext>();
        builder.Services.AddSingleton<IMembershipLookupService, StubMembershipLookupService>();
        builder.Services.AddSingleton(_ => DispatchProxy.Create<IApplicationDbContext, NotImplementedDbProxy>());

        await using var app = builder.Build();
        app.UseMiddleware<ExceptionHandlingMiddleware>();
        app.UseRouting();
        app.UseAuthentication();
        app.UseMiddleware<TenantPropertyContextMiddleware>();
        app.UseAuthorization();
        app.MapControllers();

        await app.StartAsync();
        using var client = app.GetTestClient();

        // 1. Unauthenticated -> 401 ERR_UNAUTHORIZED
        var anonRes = await client.GetAsync("/api/platform/observability/status");
        Assert.Equal(HttpStatusCode.Unauthorized, anonRes.StatusCode);
        using (var doc = JsonDocument.Parse(await anonRes.Content.ReadAsStringAsync()))
        {
            Assert.Equal("ERR_UNAUTHORIZED", doc.RootElement.GetProperty("errorCode").GetString());
        }

        // 2. Non-SuperAdmin TenantStaff -> 403 ERR_FORBIDDEN
        using var staffReq = new HttpRequestMessage(HttpMethod.Get, "/api/platform/observability/status");
        staffReq.Headers.Add("X-Test-User", Guid.NewGuid().ToString());
        staffReq.Headers.Add("X-Test-Role", "TenantStaff");
        staffReq.Headers.Add("X-Test-Tenant", Guid.NewGuid().ToString());
        var staffRes = await client.SendAsync(staffReq);
        Assert.Equal(HttpStatusCode.Forbidden, staffRes.StatusCode);
        using (var doc = JsonDocument.Parse(await staffRes.Content.ReadAsStringAsync()))
        {
            Assert.Equal("ERR_FORBIDDEN", doc.RootElement.GetProperty("errorCode").GetString());
        }

        var adminId = Guid.NewGuid().ToString();

        // 3. SuperAdmin GET status -> 200 OK
        using var statusReq = new HttpRequestMessage(HttpMethod.Get, "/api/platform/observability/status");
        statusReq.Headers.Add("X-Test-User", adminId);
        statusReq.Headers.Add("X-Test-Role", "SuperAdmin");
        var statusRes = await client.SendAsync(statusReq);
        Assert.Equal(HttpStatusCode.OK, statusRes.StatusCode);
        using (var doc = JsonDocument.Parse(await statusRes.Content.ReadAsStringAsync()))
        {
            Assert.Equal("up", doc.RootElement.GetProperty("prometheusScrapeHealth").GetString());
            Assert.Equal(3, doc.RootElement.GetProperty("services").GetArrayLength());
        }

        // 4. SuperAdmin GET logs -> 200 OK
        using var logsReq = new HttpRequestMessage(HttpMethod.Get, "/api/platform/observability/logs?level=Warning&minutes=60&limit=10");
        logsReq.Headers.Add("X-Test-User", adminId);
        logsReq.Headers.Add("X-Test-Role", "SuperAdmin");
        var logsRes = await client.SendAsync(logsReq);
        Assert.Equal(HttpStatusCode.OK, logsRes.StatusCode);
        using (var doc = JsonDocument.Parse(await logsRes.Content.ReadAsStringAsync()))
        {
            Assert.True(doc.RootElement.GetProperty("available").GetBoolean());
            Assert.Equal(1, doc.RootElement.GetProperty("totalReturned").GetInt32());
            Assert.Equal("corr-pipe-1", doc.RootElement.GetProperty("entries")[0].GetProperty("correlationId").GetString());
        }

        // 5. SuperAdmin PUT valid settings -> 200 OK & updates live switch + flags
        using var putReq = new HttpRequestMessage(HttpMethod.Put, "/api/platform/observability/settings");
        putReq.Headers.Add("X-Test-User", adminId);
        putReq.Headers.Add("X-Test-Role", "SuperAdmin");
        putReq.Content = JsonContent.Create(new UpdateObservabilitySettingsRequest("Warning", false, false));
        var putRes = await client.SendAsync(putReq);
        Assert.Equal(HttpStatusCode.OK, putRes.StatusCode);
        Assert.Equal(LogEventLevel.Warning, levelSwitch.MinimumLevel);
        Assert.False(obsService.IsMetricsExportEnabled);
        Assert.False(obsService.IsStructuredRequestLoggingEnabled);

        // 6. SuperAdmin PUT invalid level -> 400 BadRequest (ERR_INVALID_LOG_LEVEL)
        using var badPutReq = new HttpRequestMessage(HttpMethod.Put, "/api/platform/observability/settings");
        badPutReq.Headers.Add("X-Test-User", adminId);
        badPutReq.Headers.Add("X-Test-Role", "SuperAdmin");
        badPutReq.Content = JsonContent.Create(new UpdateObservabilitySettingsRequest("BogusLevel", true, true));
        var badPutRes = await client.SendAsync(badPutReq);
        Assert.Equal(HttpStatusCode.BadRequest, badPutRes.StatusCode);
        using (var doc = JsonDocument.Parse(await badPutRes.Content.ReadAsStringAsync()))
        {
            Assert.Equal("ERR_INVALID_LOG_LEVEL", doc.RootElement.GetProperty("errorCode").GetString());
        }
    }

    [Fact]
    public async Task MetricsEndpoint_RespectsRuntimeMetricsExportToggle_WhilePreservingAuthGuard()
    {
        var obsService = CreateService();

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton<IObservabilityControlService>(obsService);

        await using var app = builder.Build();
        app.MapGet("/metrics", (HttpContext httpContext, IConfiguration configuration, IObservabilityControlService observabilityControl) =>
        {
            if (!TenantPropertyContextMiddleware.IsAuthorizedMetricsRequest(
                    httpContext, configuration, out var isAuthenticatedNonSuperAdmin))
            {
                return isAuthenticatedNonSuperAdmin
                    ? Results.StatusCode(StatusCodes.Status403Forbidden)
                    : Results.Unauthorized();
            }

            if (!observabilityControl.IsMetricsExportEnabled)
            {
                return Results.Json(
                    new
                    {
                        errorCode = "ERR_METRICS_DISABLED",
                        message = "Xuất metrics Prometheus đang bị tắt bởi SuperAdmin."
                    },
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            return Results.Text(SystemMetricsRegistry.ExportPrometheusText(), "text/plain; version=0.0.4; charset=utf-8");
        });

        await app.StartAsync();
        using var client = app.GetTestClient();

        // 1. Enabled -> 200 OK text/plain
        var okRes = await client.GetAsync("/metrics");
        Assert.Equal(HttpStatusCode.OK, okRes.StatusCode);
        Assert.Contains("hotelsaas_", await okRes.Content.ReadAsStringAsync());

        // 2. Disabled via runtime switch -> 503 ERR_METRICS_DISABLED
        obsService.UpdateSettings("Information", metricsExportEnabled: false, structuredRequestLoggingEnabled: true, updatedByUserId: null);
        var disabledRes = await client.GetAsync("/metrics");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, disabledRes.StatusCode);
        using (var doc = JsonDocument.Parse(await disabledRes.Content.ReadAsStringAsync()))
        {
            Assert.Equal("ERR_METRICS_DISABLED", doc.RootElement.GetProperty("errorCode").GetString());
        }

        // 3. Re-enabled -> 200 OK
        obsService.UpdateSettings("Information", metricsExportEnabled: true, structuredRequestLoggingEnabled: true, updatedByUserId: null);
        var restoredRes = await client.GetAsync("/metrics");
        Assert.Equal(HttpStatusCode.OK, restoredRes.StatusCode);
    }

    [Fact]
    public void SanitizePayload_MasksSensitiveFieldsAndTruncatesLargeBodies()
    {
        const string rawJson = """
        {
          "email": "guest@luxustay.vn",
          "password": "SecretPassword123!",
          "nested": {
            "accessToken": "eyJhbGciOiJIUzI1NiJ9",
            "apiKey": "sepay-live-key",
            "otpCode": "123456",
            "cccd": "079200012345",
            "roomNumber": "101"
          }
        }
        """;

        var sanitized = ObservabilityControlService.SanitizePayload(rawJson);
        Assert.NotNull(sanitized);
        Assert.Contains("guest@luxustay.vn", sanitized);
        Assert.Contains("101", sanitized);
        Assert.DoesNotContain("SecretPassword123!", sanitized);
        Assert.DoesNotContain("eyJhbGciOiJIUzI1NiJ9", sanitized);
        Assert.DoesNotContain("sepay-live-key", sanitized);
        Assert.DoesNotContain("123456", sanitized);
        Assert.DoesNotContain("079200012345", sanitized);
        Assert.Contains("***REDACTED***", sanitized);

        var largeText = new string('x', 3000);
        var truncated = ObservabilityControlService.SanitizePayload(largeText);
        Assert.NotNull(truncated);
        Assert.True(truncated!.Length <= 2048);
        Assert.EndsWith("...[truncated]", truncated);
    }

    [Fact]
    public void UpdateSettings_TogglesPayloadLoggingEnabled_DefaultFalse()
    {
        var service = CreateService();
        Assert.False(service.IsPayloadLoggingEnabled);
        Assert.False(service.GetSettings().PayloadLoggingEnabled);

        var enabled = service.UpdateSettings("Information", true, true, Guid.NewGuid(), payloadLoggingEnabled: true);
        Assert.True(enabled.PayloadLoggingEnabled);
        Assert.True(service.IsPayloadLoggingEnabled);

        var disabled = service.UpdateSettings("Information", true, true, Guid.NewGuid(), payloadLoggingEnabled: false);
        Assert.False(disabled.PayloadLoggingEnabled);
        Assert.False(service.IsPayloadLoggingEnabled);
    }

    [Fact]
    public async Task CorrelationMiddleware_CapturesMaskedPayloadsOnlyWhenEnabled_AndSkipsLogsEndpoint()
    {
        var obsService = CreateService();
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton<IObservabilityControlService>(obsService);
        builder.Services.AddScoped<ICurrentTenantService, StubTenantService>();
        builder.Services.AddScoped<ICurrentPropertyService, StubPropertyService>();
        builder.Services.AddScoped<ICurrentUserContext, CurrentUserContext>();

        await using var app = builder.Build();

        string? capturedReqOnItems = null;
        string? capturedRespOnItems = null;
        app.Use(async (ctx, next) =>
        {
            await next();
            capturedReqOnItems = ctx.Items.TryGetValue(CorrelationAndStructuredLogMiddleware.RequestPayloadItemKey, out var rq) ? rq as string : null;
            capturedRespOnItems = ctx.Items.TryGetValue(CorrelationAndStructuredLogMiddleware.ResponsePayloadItemKey, out var rs) ? rs as string : null;
        });

        app.UseMiddleware<CorrelationAndStructuredLogMiddleware>();

        app.MapPost("/api/test/payload-echo", () => Results.Ok(new { ok = true, accessToken = "secret-jwt", bookingCode = "RES-99" }));
        app.MapGet("/api/platform/observability/logs", () => Results.Ok(new { available = true }));

        await app.StartAsync();
        using var client = app.GetTestClient();

        // 1. Default OFF -> Items remain null
        var offRes = await client.PostAsJsonAsync("/api/test/payload-echo", new { password = "pw1", amount = 500000 });
        Assert.Equal(HttpStatusCode.OK, offRes.StatusCode);
        Assert.Null(capturedReqOnItems);
        Assert.Null(capturedRespOnItems);

        // 2. Enabled -> Captures both masked RequestPayload & ResponsePayload
        obsService.UpdateSettings("Information", true, true, null, payloadLoggingEnabled: true);
        var onRes = await client.PostAsJsonAsync("/api/test/payload-echo", new { password = "pw1", amount = 500000 });
        Assert.Equal(HttpStatusCode.OK, onRes.StatusCode);
        var onBody = await onRes.Content.ReadAsStringAsync();
        Assert.Contains("RES-99", onBody);
        Assert.NotNull(capturedReqOnItems);
        Assert.Contains("500000", capturedReqOnItems);
        Assert.DoesNotContain("pw1", capturedReqOnItems);
        Assert.NotNull(capturedRespOnItems);
        Assert.Contains("RES-99", capturedRespOnItems);
        Assert.DoesNotContain("secret-jwt", capturedRespOnItems);

        // 3. Excluded /api/platform/observability/logs -> Never self-captures
        capturedReqOnItems = null;
        capturedRespOnItems = null;
        var logsRes = await client.GetAsync("/api/platform/observability/logs");
        Assert.Equal(HttpStatusCode.OK, logsRes.StatusCode);
        Assert.Null(capturedReqOnItems);
        Assert.Null(capturedRespOnItems);
    }

    [Fact]
    public async Task QueryLokiLogsAsync_ExtractsRequestAndResponsePayloads()
    {
        const string lokiJson = """
        {
          "status": "success",
          "data": {
            "resultType": "streams",
            "result": [
              {
                "stream": { "container": "hotelsaas-backend-api", "level": "Information" },
                "values": [
                  [
                    "1764000020000000000",
                    "{\"Timestamp\":\"2026-11-27T10:00:00.0000000Z\",\"Level\":\"Information\",\"RenderedMessage\":\"HTTP Payload POST /api/auth/login\",\"Properties\":{\"CorrelationId\":\"corr-pay-1\",\"StatusCode\":200,\"RequestPayload\":\"{\\\"email\\\":\\\"a@b.vn\\\",\\\"password\\\":\\\"***REDACTED***\\\"}\",\"ResponsePayload\":\"{\\\"ok\\\":true}\"}}"
                  ]
                ]
              }
            ]
          }
        }
        """;

        var service = CreateService(responder: _ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(lokiJson, Encoding.UTF8, "application/json")
        });

        var res = await service.QueryLokiLogsAsync(null, null, 60, 10);
        var entry = Assert.Single(res.Entries);
        Assert.Equal("corr-pay-1", entry.CorrelationId);
        Assert.Contains("***REDACTED***", entry.RequestPayload);
        Assert.Equal("{\"ok\":true}", entry.ResponsePayload);
    }
}
