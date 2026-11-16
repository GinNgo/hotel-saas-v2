using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Commands.ProcessVnpayIpn;
using HotelSaas.Domain.Enums;
using HotelSaas.Infrastructure.Hubs;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Middleware;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using Xunit;
using Xunit.Abstractions;
using Xunit.Sdk;

namespace HotelSaas.WebApi.Tests;

[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public sealed class TestPriorityAttribute : Attribute
{
    public int Priority { get; }

    public TestPriorityAttribute(int priority) => Priority = priority;
}

public sealed class PriorityTestCaseOrderer : ITestCaseOrderer
{
    public IEnumerable<TTestCase> OrderTestCases<TTestCase>(IEnumerable<TTestCase> testCases)
        where TTestCase : ITestCase
    {
        return testCases.OrderBy(tc =>
        {
            var attr = tc.TestMethod.Method
                .GetCustomAttributes(typeof(TestPriorityAttribute).AssemblyQualifiedName)
                .FirstOrDefault();
            return attr?.GetNamedArgument<int>(nameof(TestPriorityAttribute.Priority)) ?? 0;
        }).ThenBy(tc => tc.TestMethod.Method.Name, StringComparer.Ordinal);
    }
}

/// <summary>
/// Non-database unit and pipeline tests verifying Correlation ID propagation,
/// SystemMetricsRecorder/SystemMetricsRegistry Prometheus counters, VNPay IPN tracking,
/// SignalR connection gauges, multi-tenant isolation block counters, bounded metric cardinality,
/// and Serilog structured logging enrichment.
/// </summary>
[TestCaseOrderer("HotelSaas.WebApi.Tests.PriorityTestCaseOrderer", "HotelSaas.WebApi.Tests")]
public sealed class ObservabilityMetricsAndLoggingTests
{
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

    private sealed class StubVnpayPaymentService : IVnpayPaymentService
    {
        private readonly VnpayVerificationResult _result;

        public StubVnpayPaymentService(VnpayVerificationResult result)
        {
            _result = result;
        }

        public VnpayCreateUrlResult CreatePaymentUrl(
            Guid reservationId,
            string confirmationCode,
            decimal amountVnd,
            string orderInfo,
            string clientIp,
            string? returnUrl = null) =>
            throw new NotSupportedException();

        public VnpayVerificationResult VerifyCallback(IDictionary<string, string> queryParams) => _result;
    }

    public class NoopDbProxy : DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args) => null;
    }

    private sealed class StubMembershipLookupService : IMembershipLookupService
    {
        public Func<Guid, Guid, Guid?, CancellationToken, Task<MembershipLookupResult>>? Handler { get; set; }

        public Task<MembershipLookupResult> ResolveMembershipAsync(
            Guid tenantId,
            Guid userId,
            Guid? targetPropertyId,
            CancellationToken cancellationToken = default)
        {
            if (Handler != null)
            {
                return Handler(tenantId, userId, targetPropertyId, cancellationToken);
            }

            return Task.FromResult(MembershipLookupResult.Succeeded(
                Guid.NewGuid(), StaffRole.Receptionist, targetPropertyId, false));
        }
    }

    private sealed class InMemoryLogSink : ILogEventSink
    {
        public ConcurrentQueue<LogEvent> Events { get; } = new();

        public void Emit(LogEvent logEvent) => Events.Enqueue(logEvent);
    }

    private static string? GetLogProperty(LogEvent logEvent, string name)
    {
        if (!logEvent.Properties.TryGetValue(name, out var value))
        {
            return null;
        }

        return value is ScalarValue sv ? sv.Value?.ToString() : value.ToString();
    }

    private static async Task<WebApplication> CreateTestMiddlewareAppAsync()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Testing"
        });
        builder.WebHost.UseTestServer();

        builder.Services.AddSingleton<ICurrentTenantService, StubTenantService>();
        builder.Services.AddSingleton<ICurrentPropertyService, StubPropertyService>();
        builder.Services.AddSingleton<ICurrentUserContext>(sp =>
            new CurrentUserContext(
                sp.GetRequiredService<ICurrentTenantService>(),
                sp.GetRequiredService<ICurrentPropertyService>()));

        var app = builder.Build();
        app.UseMiddleware<CorrelationAndStructuredLogMiddleware>();

        app.MapGet("/api/test/ping", () => Results.Ok(new { status = "ok" }));
        app.MapGet("/api/public/payments/vnpay/ipn", () => Results.Ok(new { RspCode = "97", Message = "Invalid Checksum" }));
        app.MapGet("/api/test/blocked", (HttpContext ctx) =>
        {
            ctx.Items["ErrorCode"] = "ERR_PROPERTY_FORBIDDEN";
            return Results.Json(new { errorCode = "ERR_PROPERTY_FORBIDDEN" }, statusCode: StatusCodes.Status403Forbidden);
        });

        await app.StartAsync();
        return app;
    }

    private static long GetMetricValueOrZero(string prometheusText, string metricNameWithLabels)
    {
        var prefix = metricNameWithLabels + " ";
        var lines = prometheusText.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            if (line.StartsWith(prefix, StringComparison.Ordinal))
            {
                var valuePart = line[prefix.Length..].Trim();
                if (long.TryParse(valuePart, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value))
                {
                    return value;
                }
            }
        }

        return 0;
    }

    [Fact]
    public async Task CorrelationMiddleware_WhenClientSendsCorrelationId_EchoesExactHeader()
    {
        await using var app = await CreateTestMiddlewareAppAsync();
        using var client = app.GetTestClient();

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/test/ping");
        const string expectedCorrelationId = "trace-client-obs-2026";
        request.Headers.Add(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, expectedCorrelationId);

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.TryGetValues(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, out var values));
        Assert.Equal(expectedCorrelationId, Assert.Single(values));
    }

    [Fact]
    public async Task CorrelationMiddleware_WhenCorrelationIdAbsent_GeneratesReqPrefixedCorrelationId()
    {
        await using var app = await CreateTestMiddlewareAppAsync();
        using var client = app.GetTestClient();

        var response = await client.GetAsync("/api/test/ping");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.TryGetValues(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, out var values));
        var generatedId = Assert.Single(values);
        Assert.StartsWith("req-", generatedId, StringComparison.Ordinal);
        Assert.True(Guid.TryParseExact(generatedId["req-".Length..], "N", out _));
    }

    [Fact]
    public async Task CorrelationMiddleware_VnpayIpnHttp200_DoesNotDuplicateVnpaySuccessMetric()
    {
        await using var app = await CreateTestMiddlewareAppAsync();
        using var client = app.GetTestClient();

        var beforeText = SystemMetricsRegistry.ExportPrometheusText();
        var beforeRequests = GetMetricValueOrZero(beforeText, "hotelsaas_http_requests_total");
        var beforeVnpay00 = GetMetricValueOrZero(beforeText, "hotelsaas_vnpay_ipn_total{rsp_code=\"00\"}");

        var response = await client.GetAsync("/api/public/payments/vnpay/ipn");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var afterText = SystemMetricsRegistry.ExportPrometheusText();
        var afterRequests = GetMetricValueOrZero(afterText, "hotelsaas_http_requests_total");
        var afterVnpay00 = GetMetricValueOrZero(afterText, "hotelsaas_vnpay_ipn_total{rsp_code=\"00\"}");

        Assert.Equal(beforeRequests + 1, afterRequests);
        Assert.Equal(beforeVnpay00, afterVnpay00);
    }

    [Fact]
    public async Task CorrelationMiddleware_WhenBlockedWithErrorCode_RecordsIsolationBlockMetric()
    {
        await using var app = await CreateTestMiddlewareAppAsync();
        using var client = app.GetTestClient();

        var beforeText = SystemMetricsRegistry.ExportPrometheusText();
        var beforeBlocks = GetMetricValueOrZero(beforeText, "hotelsaas_tenant_isolation_blocks_total");
        var beforeReason = GetMetricValueOrZero(beforeText, "hotelsaas_tenant_isolation_blocks_by_reason_total{error_code=\"ERR_PROPERTY_FORBIDDEN\"}");

        var response = await client.GetAsync("/api/test/blocked");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var afterText = SystemMetricsRegistry.ExportPrometheusText();
        var afterBlocks = GetMetricValueOrZero(afterText, "hotelsaas_tenant_isolation_blocks_total");
        var afterReason = GetMetricValueOrZero(afterText, "hotelsaas_tenant_isolation_blocks_by_reason_total{error_code=\"ERR_PROPERTY_FORBIDDEN\"}");

        Assert.Equal(beforeBlocks + 1, afterBlocks);
        Assert.Equal(beforeReason + 1, afterReason);
    }

    [Theory]
    [InlineData("00")]
    [InlineData("01")]
    [InlineData("02")]
    [InlineData("04")]
    [InlineData("97")]
    public void SystemMetricsRecorder_RecordVnpayIpnResult_UpdatesPrometheusCounterForCode(string rspCode)
    {
        ISystemMetricsRecorder recorder = new SystemMetricsRecorder();
        var metricKey = $"hotelsaas_vnpay_ipn_total{{rsp_code=\"{rspCode}\"}}";

        var before = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), metricKey);
        recorder.RecordVnpayIpnResult(rspCode);
        var after = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), metricKey);

        Assert.Equal(before + 1, after);
    }

    [Fact]
    public void SystemMetricsRecorder_SignalRConnectionGauge_IncrementsAndDecrements()
    {
        ISystemMetricsRecorder recorder = new SystemMetricsRecorder();

        var before = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_signalr_active_connections");

        recorder.IncrementSignalRConnection();
        var afterIncrement = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_signalr_active_connections");
        Assert.Equal(before + 1, afterIncrement);

        recorder.DecrementSignalRConnection();
        var afterDecrement = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_signalr_active_connections");
        Assert.Equal(before, afterDecrement);
    }

    [Fact]
    public void SystemMetricsRecorder_RecordIsolationBlock_UpdatesTotalAndReasonMetrics()
    {
        ISystemMetricsRecorder recorder = new SystemMetricsRecorder();

        var beforeText = SystemMetricsRegistry.ExportPrometheusText();
        var beforeTotal = GetMetricValueOrZero(beforeText, "hotelsaas_tenant_isolation_blocks_total");
        var beforeReason = GetMetricValueOrZero(beforeText, "hotelsaas_tenant_isolation_blocks_by_reason_total{error_code=\"ERR_PROPERTY_FORBIDDEN\"}");

        recorder.RecordIsolationBlock("ERR_PROPERTY_FORBIDDEN");

        var afterText = SystemMetricsRegistry.ExportPrometheusText();
        var afterTotal = GetMetricValueOrZero(afterText, "hotelsaas_tenant_isolation_blocks_total");
        var afterReason = GetMetricValueOrZero(afterText, "hotelsaas_tenant_isolation_blocks_by_reason_total{error_code=\"ERR_PROPERTY_FORBIDDEN\"}");

        Assert.Equal(beforeTotal + 1, afterTotal);
        Assert.Equal(beforeReason + 1, afterReason);
    }

    [Fact]
    public async Task NotificationHub_LifecycleHooks_UpdateSignalRConnectionGauge()
    {
        ISystemMetricsRecorder recorder = new SystemMetricsRecorder();
        using var hub = new NotificationHub(context: null, logger: null, metricsRecorder: recorder);

        var before = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_signalr_active_connections");

        await hub.OnConnectedAsync();
        var afterConnect = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_signalr_active_connections");
        Assert.Equal(before + 1, afterConnect);

        await hub.OnDisconnectedAsync(null);
        var afterDisconnect = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_signalr_active_connections");
        Assert.Equal(before, afterDisconnect);
    }

    [Fact]
    public async Task ProcessVnpayIpnCommandHandler_InvalidChecksumAndEmptyTxnRef_RecordPrometheusMetrics()
    {
        var dbProxy = DispatchProxy.Create<IApplicationDbContext, NoopDbProxy>();
        ISystemMetricsRecorder recorder = new SystemMetricsRecorder();

        // 1. Invalid signature -> RspCode "97"
        var invalidSigService = new StubVnpayPaymentService(new VnpayVerificationResult(
            IsValid: false,
            ResponseCode: "97",
            TransactionStatus: null,
            TransactionNo: null,
            TxnRef: null,
            Amount: 0m,
            Message: "Invalid Checksum",
            IsSignatureValid: false,
            IsSuccess: false));

        var before97 = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_vnpay_ipn_total{rsp_code=\"97\"}");
        var handler97 = new ProcessVnpayIpnCommandHandler(dbProxy, invalidSigService, metricsRecorder: recorder);
        var res97 = await handler97.Handle(new ProcessVnpayIpnCommand(new Dictionary<string, string>()), CancellationToken.None);
        var after97 = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_vnpay_ipn_total{rsp_code=\"97\"}");

        Assert.Equal("97", res97.RspCode);
        Assert.Equal(before97 + 1, after97);

        // 2. Valid signature, missing TxnRef -> RspCode "01"
        var missingTxnService = new StubVnpayPaymentService(new VnpayVerificationResult(
            IsValid: true,
            ResponseCode: "00",
            TransactionStatus: "00",
            TransactionNo: "TX123",
            TxnRef: string.Empty,
            Amount: 100000m,
            Message: "OK",
            IsSignatureValid: true,
            IsSuccess: true));

        var before01 = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_vnpay_ipn_total{rsp_code=\"01\"}");
        var handler01 = new ProcessVnpayIpnCommandHandler(dbProxy, missingTxnService, metricsRecorder: recorder);
        var res01 = await handler01.Handle(new ProcessVnpayIpnCommand(new Dictionary<string, string>()), CancellationToken.None);
        var after01 = GetMetricValueOrZero(SystemMetricsRegistry.ExportPrometheusText(), "hotelsaas_vnpay_ipn_total{rsp_code=\"01\"}");

        Assert.Equal("01", res01.RspCode);
        Assert.Equal(before01 + 1, after01);
    }

    [Fact]
    public async Task CorrelationMiddleware_SetsCorrelationIdOnItemsAndResponseHeadersImmediately()
    {
        string? observedItemCorrelationId = null;
        string? observedHeaderCorrelationId = null;

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Testing"
        });
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton<ICurrentTenantService, StubTenantService>();
        builder.Services.AddSingleton<ICurrentPropertyService, StubPropertyService>();
        builder.Services.AddSingleton<ICurrentUserContext>(sp =>
            new CurrentUserContext(
                sp.GetRequiredService<ICurrentTenantService>(),
                sp.GetRequiredService<ICurrentPropertyService>()));

        await using var app = builder.Build();
        app.UseMiddleware<CorrelationAndStructuredLogMiddleware>();
        app.Use(async (ctx, next) =>
        {
            observedItemCorrelationId = ctx.Items[CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName]?.ToString();
            observedHeaderCorrelationId = ctx.Response.Headers[CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName].ToString();
            await next();
        });
        app.MapGet("/api/test/immediate", () => Results.Ok(new { ok = true }));

        await app.StartAsync();
        using var client = app.GetTestClient();

        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/test/immediate");
        req.Headers.Add(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, "imm-corr-789");

        var response = await client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("imm-corr-789", observedItemCorrelationId);
        Assert.Equal("imm-corr-789", observedHeaderCorrelationId);
    }

    [Fact]
    public void SystemMetricsRegistry_404NonApiRoute_NormalizesToUnmatched()
    {
        var beforeText = SystemMetricsRegistry.ExportPrometheusText();
        var beforeUnmatched = GetMetricValueOrZero(beforeText, "hotelsaas_http_route_requests_total{method=\"GET\",route=\"/_unmatched\",status=\"404\"}");
        var beforeApi404 = GetMetricValueOrZero(beforeText, "hotelsaas_http_route_requests_total{method=\"GET\",route=\"/api/missing-endpoint\",status=\"404\"}");

        SystemMetricsRegistry.RecordHttpRequest("GET", "/wp-login.php", StatusCodes.Status404NotFound, 1.2, null, null);
        SystemMetricsRegistry.RecordHttpRequest("GET", "/robots.txt", StatusCodes.Status404NotFound, 0.8, null, null);
        SystemMetricsRegistry.RecordHttpRequest("GET", "/api/missing-endpoint", StatusCodes.Status404NotFound, 2.0, null, null);

        var afterText = SystemMetricsRegistry.ExportPrometheusText();
        var afterUnmatched = GetMetricValueOrZero(afterText, "hotelsaas_http_route_requests_total{method=\"GET\",route=\"/_unmatched\",status=\"404\"}");
        var afterApi404 = GetMetricValueOrZero(afterText, "hotelsaas_http_route_requests_total{method=\"GET\",route=\"/api/missing-endpoint\",status=\"404\"}");

        Assert.Equal(beforeUnmatched + 2, afterUnmatched);
        Assert.Equal(beforeApi404 + 1, afterApi404);
    }

    [Fact]
    public async Task TenantPropertyContextMiddleware_EnrichesSerilogAndPreservesTenantIdOnEarlyCrossBranchReject()
    {
        var sink = new InMemoryLogSink();
        var tenantId = Guid.NewGuid();
        var branchA = Guid.NewGuid();
        var branchB = Guid.NewGuid();
        var userId = Guid.NewGuid();

        using var serilogLogger = new LoggerConfiguration()
            .MinimumLevel.Information()
            .Enrich.FromLogContext()
            .WriteTo.Sink(sink)
            .CreateLogger();

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Testing"
        });
        builder.WebHost.UseTestServer();
        builder.Host.UseSerilog((_, cfg) =>
            cfg.MinimumLevel.Information()
               .Enrich.FromLogContext()
               .WriteTo.Sink(sink),
            preserveStaticLogger: true);

        builder.Services.AddScoped<ICurrentTenantService, StubTenantService>();
        builder.Services.AddScoped<ICurrentPropertyService, StubPropertyService>();
        builder.Services.AddScoped<ICurrentUserContext, CurrentUserContext>();
        builder.Services.AddSingleton<IMembershipLookupService>(new StubMembershipLookupService
        {
            Handler = (_, _, targetPropId, _) => Task.FromResult(
                MembershipLookupResult.Succeeded(Guid.NewGuid(), StaffRole.Receptionist, targetPropId, false))
        });

        await using var app = builder.Build();
        app.UseMiddleware<CorrelationAndStructuredLogMiddleware>();
        app.UseSerilogRequestLogging(opts =>
        {
            opts.Logger = serilogLogger;
            opts.EnrichDiagnosticContext = Program.EnrichSerilogDiagnosticContext;
        });
        app.Use(async (ctx, next) =>
        {
            if (ctx.Request.Headers.TryGetValue("X-Test-User", out var u))
            {
                var claims = new List<Claim>
                {
                    new("sub", u.ToString()),
                    new("globalRole", "TenantStaff"),
                    new("tenantId", ctx.Request.Headers["X-Test-Tenant"].ToString()),
                    new("propertyId", ctx.Request.Headers["X-Test-Property"].ToString())
                };
                ctx.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestBearer"));
            }

            await next();
        });
        app.UseMiddleware<TenantPropertyContextMiddleware>();
        app.MapGet("/api/rooms", (ILogger<ObservabilityMetricsAndLoggingTests> logger) =>
        {
            logger.LogInformation("Inside rooms handler");
            return Results.Ok(new { status = "ok" });
        });

        await app.StartAsync();
        using var client = app.GetTestClient();

        // 1. Early cross-branch rejection (header X-Property-Id: branchB while token has branchA)
        using var blockedReq = new HttpRequestMessage(HttpMethod.Get, "/api/rooms");
        blockedReq.Headers.Add(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, "corr-blocked-branch");
        blockedReq.Headers.Add("X-Test-User", userId.ToString());
        blockedReq.Headers.Add("X-Test-Tenant", tenantId.ToString());
        blockedReq.Headers.Add("X-Test-Property", branchA.ToString());
        blockedReq.Headers.Add("X-Property-Id", branchB.ToString());

        var blockedRes = await client.SendAsync(blockedReq);
        Assert.Equal(HttpStatusCode.Forbidden, blockedRes.StatusCode);

        var blockedRequestLog = Assert.Single(sink.Events, e =>
            GetLogProperty(e, "SourceContext") == "Serilog.AspNetCore.RequestLoggingMiddleware" &&
            GetLogProperty(e, "CorrelationId") == "corr-blocked-branch");

        Assert.Equal(tenantId.ToString(), GetLogProperty(blockedRequestLog, "TenantId"));
        Assert.Equal("unscoped", GetLogProperty(blockedRequestLog, "PropertyId"));
        Assert.Equal(userId.ToString(), GetLogProperty(blockedRequestLog, "UserId"));
        Assert.Equal("403", GetLogProperty(blockedRequestLog, "StatusCode"));
        Assert.Equal("ERR_PROPERTY_FORBIDDEN", GetLogProperty(blockedRequestLog, "ErrorCode"));

        // 2. Authorized request -> inner handler logs + Serilog request log both carry full tenant/property/user context
        using var okReq = new HttpRequestMessage(HttpMethod.Get, "/api/rooms");
        okReq.Headers.Add(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, "corr-allowed-branch");
        okReq.Headers.Add("X-Test-User", userId.ToString());
        okReq.Headers.Add("X-Test-Tenant", tenantId.ToString());
        okReq.Headers.Add("X-Test-Property", branchA.ToString());

        var okRes = await client.SendAsync(okReq);
        Assert.Equal(HttpStatusCode.OK, okRes.StatusCode);

        var innerHandlerLog = Assert.Single(sink.Events, e =>
            e.MessageTemplate.Text == "Inside rooms handler" &&
            GetLogProperty(e, "CorrelationId") == "corr-allowed-branch");

        Assert.Equal(tenantId.ToString(), GetLogProperty(innerHandlerLog, "TenantId"));
        Assert.Equal(branchA.ToString(), GetLogProperty(innerHandlerLog, "PropertyId"));
        Assert.Equal(userId.ToString(), GetLogProperty(innerHandlerLog, "UserId"));

        var okRequestLog = Assert.Single(sink.Events, e =>
            GetLogProperty(e, "SourceContext") == "Serilog.AspNetCore.RequestLoggingMiddleware" &&
            GetLogProperty(e, "CorrelationId") == "corr-allowed-branch");

        Assert.Equal(tenantId.ToString(), GetLogProperty(okRequestLog, "TenantId"));
        Assert.Equal(branchA.ToString(), GetLogProperty(okRequestLog, "PropertyId"));
        Assert.Equal(userId.ToString(), GetLogProperty(okRequestLog, "UserId"));
        Assert.Equal("200", GetLogProperty(okRequestLog, "StatusCode"));
        Assert.Null(GetLogProperty(okRequestLog, "ErrorCode"));
    }

    [Fact]
    [TestPriority(100)]
    public void SystemMetricsRegistry_BoundsAllDictionariesAtMax256Keys_WithOverflowBucketing()
    {
        for (int i = 0; i < 300; i++)
        {
            SystemMetricsRegistry.RecordHttpRequest(
                "GET",
                $"/api/cardinality-route-{i}",
                StatusCodes.Status200OK,
                1.0,
                Guid.NewGuid(),
                Guid.NewGuid());

            SystemMetricsRegistry.RecordIsolationBlock($"ERR_CARDINALITY_REASON_{i}");
        }

        var snapshot = SystemMetricsRegistry.GetCardinalitySnapshot();
        Assert.InRange(snapshot.RouteKeys, 1, 256);
        Assert.InRange(snapshot.IsolationReasonKeys, 1, 256);
        Assert.InRange(snapshot.TenantActiveKeys, 1, 256);

        var promText = SystemMetricsRegistry.ExportPrometheusText();
        var overflowRoutes = GetMetricValueOrZero(promText, "hotelsaas_http_route_requests_total{method=\"OTHER\",route=\"/_overflow\",status=\"200\"}");
        var overflowReasons = GetMetricValueOrZero(promText, "hotelsaas_tenant_isolation_blocks_by_reason_total{error_code=\"OTHER_OVERFLOW\"}");

        Assert.True(overflowRoutes >= 45, $"Expected >= 45 overflow route hits, got {overflowRoutes}");
        Assert.True(overflowReasons >= 45, $"Expected >= 45 overflow isolation reason hits, got {overflowReasons}");
    }
}
