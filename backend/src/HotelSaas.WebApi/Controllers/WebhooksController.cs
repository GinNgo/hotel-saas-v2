using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Payments.Commands.ProcessSepayWebhook;
using HotelSaas.WebApi.Middleware;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Enables request body buffering before MVC model binding so HMAC-SHA256 webhook signatures (<c>X-SePay-Signature</c>)
/// can be verified against the exact raw JSON payload.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class EnableWebhookBodyBufferingAttribute : Attribute, IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        context.HttpContext.Request.EnableBuffering();
    }
}

/// <summary>
/// Receives server-to-server payment gateway webhooks (SePay VietQR) and exposes a strictly Development-only simulator.
/// </summary>
[ApiController]
[Route("api/webhooks")]
[Produces("application/json")]
[EnableRateLimiting("webhooks")]
public sealed class WebhooksController : ControllerBase
{
    private readonly ISender _mediator;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;
    private readonly ILogger<WebhooksController>? _logger;
    private readonly ISystemMetricsRecorder? _metricsRecorder;

    public WebhooksController(
        ISender mediator,
        IConfiguration configuration,
        IHostEnvironment environment,
        ILogger<WebhooksController>? logger = null,
        ISystemMetricsRecorder? metricsRecorder = null)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _environment = environment ?? throw new ArgumentNullException(nameof(environment));
        _logger = logger;
        _metricsRecorder = metricsRecorder;
    }

    [NonAction]
    public Task<IActionResult> HandleSepayWebhook(
        SepayWebhookPayload? payload,
        CancellationToken cancellationToken) =>
        HandleSepayWebhook(payload, propertyId: null, cancellationToken);

    /// <summary>
    /// Receives incoming bank transfer notifications from SePay using constant-time Apikey authentication.
    /// Supports both global webhook endpoint (<c>/api/webhooks/sepay</c>) and property-scoped endpoint (<c>/api/webhooks/sepay/{propertyId}</c>).
    /// Always returns HTTP 200 OK after authentication for handled, ignored, duplicate, partial, or expired events.
    /// </summary>
    [HttpPost("sepay")]
    [HttpPost("sepay/{propertyId:guid}")]
    [AllowAnonymous]
    [EnableWebhookBodyBuffering]
    [ProducesResponseType(typeof(SepayWebhookHttpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(SepayWebhookErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> HandleSepayWebhook(
        [FromBody] SepayWebhookPayload? payload,
        [FromRoute] Guid? propertyId = null,
        CancellationToken cancellationToken = default)
    {
        var hasApiKey = TryExtractSepayApiKey(out var providedKey);
        var hasHmacSignature = TryExtractSepayHmacSignature(out var providedHmacSig, out var hmacTimestamp);
        if (!hasApiKey && !hasHmacSignature)
        {
            return RejectUnauthorized();
        }

        string? rawBody = null;
        if (hasHmacSignature)
        {
            rawBody = await ReadRawRequestBodyOrSerializeAsync(payload, cancellationToken);
        }

        var globalSecret = _configuration["Payment:Sepay:ApiKey"];
        var isGlobalKeyMatch =
            (hasApiKey && IsConstantTimeMatch(providedKey, globalSecret)) ||
            (hasHmacSignature && ProcessSepayWebhookCommandHandler.VerifyHmacSha256Signature(
                providedHmacSig,
                rawBody,
                hmacTimestamp,
                globalSecret));

        if (!isGlobalKeyMatch && payload == null)
        {
            return RejectUnauthorized();
        }

        if (payload == null)
        {
            _metricsRecorder?.RecordSepayWebhook("ignored");
            return Ok(new SepayWebhookHttpResponse(true, "ignored", "Empty webhook payload ignored."));
        }

        var expectedPlatformAccount = ResolveExpectedPlatformAccountNumber();
        var requireBankAccountMatch = _configuration.GetValue<bool?>("Payment:Sepay:RequireBankAccountMatch")
            ?? (!_environment.IsDevelopment() && !_environment.IsEnvironment("Testing"));

        var command = new ProcessSepayWebhookCommand(
            Id: payload.Id,
            Gateway: payload.Gateway,
            TransactionDate: payload.TransactionDate,
            AccountNumber: payload.AccountNumber,
            SubAccount: payload.SubAccount,
            Code: payload.Code,
            Content: payload.Content,
            TransferType: payload.TransferType,
            Description: payload.Description,
            TransferAmount: payload.TransferAmount,
            Accumulated: payload.Accumulated,
            ReferenceCode: payload.ReferenceCode,
            ExpectedPlatformAccountNumber: expectedPlatformAccount,
            RequireBankAccountMatch: requireBankAccountMatch,
            ProvidedApiKey: hasApiKey ? providedKey : null,
            IsGlobalApiKeyMatched: isGlobalKeyMatch,
            RoutePropertyId: propertyId,
            ProvidedHmacSignature: hasHmacSignature ? providedHmacSig : null,
            HmacTimestamp: hmacTimestamp,
            RawPayloadBody: rawBody);

        try
        {
            var result = await _mediator.Send(command, cancellationToken);
            if (string.Equals(result.Status, "unauthorized", StringComparison.OrdinalIgnoreCase))
            {
                return RejectUnauthorized();
            }

            return Ok(new SepayWebhookHttpResponse(true, result.Status, result.Message));
        }
        catch
        {
            _metricsRecorder?.RecordSepayWebhook("error");
            throw;
        }
    }

    /// <summary>
    /// Development-only endpoint to simulate an incoming SePay bank transfer for local demos without a public tunnel.
    /// Returns HTTP 404 Not Found in Staging, Production, and all non-Development environments.
    /// </summary>
    [HttpPost("sepay/simulate")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(SepayWebhookHttpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(SepayWebhookErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SimulateSepayWebhook(
        [FromBody] SimulateSepayWebhookRequest? request,
        CancellationToken cancellationToken = default)
    {
        if (!_environment.IsDevelopment())
        {
            return NotFound(new SepayWebhookErrorResponse(false, "Not Found"));
        }

        if (request == null)
        {
            return Ok(new SepayWebhookHttpResponse(true, "ignored", "Empty simulation request ignored."));
        }

        var command = new SimulateSepayWebhookCommand(
            ConfirmationCode: request.ConfirmationCode,
            SubscriptionRef: request.SubscriptionRef,
            Amount: request.Amount,
            ReferenceCode: request.ReferenceCode,
            ConfiguredPlatformBankName: _configuration["Payment:Sepay:PlatformBankName"],
            ConfiguredPlatformAccountNumber: ResolveExpectedPlatformAccountNumber());

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(new SepayWebhookHttpResponse(true, result.Status, result.Message));
    }

    private string? ResolveExpectedPlatformAccountNumber()
    {
        var primary = _configuration["Payment:Sepay:PlatformAccountNumber"];
        if (!string.IsNullOrWhiteSpace(primary))
        {
            return primary;
        }

        var fallback = _configuration["Payment:Sepay:ExpectedPlatformAccountNumber"];
        return !string.IsNullOrWhiteSpace(fallback) ? fallback : null;
    }

    private IActionResult RejectUnauthorized()
    {
        var clientIp = HttpContext?.Connection?.RemoteIpAddress?.ToString() ?? "unknown";
        var correlationId = ResolveCorrelationId();
        if (HttpContext != null)
        {
            HttpContext.Items["ErrorCode"] = "ERR_SEPAY_UNAUTHORIZED";
        }

        _logger?.LogWarning(
            "SePay webhook authentication rejected (401 Unauthorized) from ClientIp={ClientIp} [CorrelationId={CorrelationId}]",
            clientIp,
            correlationId);
        _metricsRecorder?.RecordSepayWebhook("auth_failed");

        return Unauthorized(new SepayWebhookErrorResponse(false, "Unauthorized", correlationId));
    }

    private bool TryExtractSepayApiKey(out string providedKey)
    {
        providedKey = string.Empty;

        if (Request?.Headers == null ||
            !Request.Headers.TryGetValue("Authorization", out var authValues))
        {
            return false;
        }

        var rawHeader = authValues.ToString().Trim();
        const string prefix = "Apikey ";
        if (!rawHeader.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        providedKey = rawHeader[prefix.Length..].Trim();
        return !string.IsNullOrEmpty(providedKey);
    }

    private bool TryExtractSepayHmacSignature(out string providedSignature, out string? timestamp)
    {
        providedSignature = string.Empty;
        timestamp = null;

        if (Request?.Headers == null ||
            !Request.Headers.TryGetValue("X-SePay-Signature", out var sigValues))
        {
            return false;
        }

        providedSignature = sigValues.ToString().Trim();
        if (Request.Headers.TryGetValue("X-SePay-Timestamp", out var tsValues))
        {
            var rawTs = tsValues.ToString().Trim();
            if (!string.IsNullOrEmpty(rawTs))
            {
                timestamp = rawTs;
            }
        }

        return !string.IsNullOrEmpty(providedSignature);
    }

    private async Task<string> ReadRawRequestBodyOrSerializeAsync(
        SepayWebhookPayload? payload,
        CancellationToken cancellationToken)
    {
        if (Request?.Body != null && Request.Body.CanSeek)
        {
            Request.Body.Position = 0;
            using var reader = new StreamReader(
                Request.Body,
                Encoding.UTF8,
                detectEncodingFromByteOrderMarks: false,
                bufferSize: 4096,
                leaveOpen: true);
            var bodyText = await reader.ReadToEndAsync(cancellationToken);
            Request.Body.Position = 0;
            if (!string.IsNullOrEmpty(bodyText))
            {
                return bodyText;
            }
        }

        return payload != null ? JsonSerializer.Serialize(payload) : string.Empty;
    }

    private static bool IsConstantTimeMatch(string? providedKey, string? expectedKey)
    {
        if (string.IsNullOrWhiteSpace(providedKey) || string.IsNullOrWhiteSpace(expectedKey))
        {
            return false;
        }

        var expectedBytes = Encoding.UTF8.GetBytes(expectedKey.Trim());
        var providedBytes = Encoding.UTF8.GetBytes(providedKey.Trim());

        return expectedBytes.Length == providedBytes.Length &&
               CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
    }

    private string? ResolveCorrelationId()
    {
        if (HttpContext == null)
        {
            return null;
        }

        if (HttpContext.Items.TryGetValue("CorrelationId", out var corrObj) &&
            corrObj is string corrStr && !string.IsNullOrWhiteSpace(corrStr))
        {
            return corrStr;
        }

        if (HttpContext.Items.TryGetValue(CorrelationAndStructuredLogMiddleware.CorrelationIdHeaderName, out var hdrObj) &&
            hdrObj is string hdrStr && !string.IsNullOrWhiteSpace(hdrStr))
        {
            return hdrStr;
        }

        return HttpContext.TraceIdentifier;
    }
}

public sealed class SepayWebhookPayload
{
    public long Id { get; set; }
    public string? Gateway { get; set; }
    public string? TransactionDate { get; set; }
    public string? AccountNumber { get; set; }
    public string? SubAccount { get; set; }
    public string? Code { get; set; }
    public string? Content { get; set; }
    public string? TransferType { get; set; }
    public string? Description { get; set; }
    public decimal TransferAmount { get; set; }
    public decimal? Accumulated { get; set; }
    public string? ReferenceCode { get; set; }
}

public sealed class SimulateSepayWebhookRequest
{
    public string? ConfirmationCode { get; set; }
    public string? SubscriptionRef { get; set; }
    public decimal? Amount { get; set; }
    public string? ReferenceCode { get; set; }
}

public sealed record SepayWebhookHttpResponse(bool Success, string Status, string Message);

public sealed record SepayWebhookErrorResponse(bool Success, string Message, string? CorrelationId = null);
