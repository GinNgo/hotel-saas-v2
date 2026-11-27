using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.WebApi.Services;
using Microsoft.Extensions.Configuration;
using Serilog.Core;
using Serilog.Events;
using Xunit;

namespace HotelSaas.WebApi.Tests;

public sealed class ObservabilityControlTests
{
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
}
