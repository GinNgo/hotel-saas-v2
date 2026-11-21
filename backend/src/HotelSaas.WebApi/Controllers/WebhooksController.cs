using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Payments.Commands.ProcessSepayWebhook;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace HotelSaas.WebApi.Controllers;

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

    public WebhooksController(
        ISender mediator,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _environment = environment ?? throw new ArgumentNullException(nameof(environment));
    }

    /// <summary>
    /// Receives incoming bank transfer notifications from SePay using constant-time Apikey authentication.
    /// Always returns HTTP 200 OK after authentication for handled, ignored, duplicate, partial, or expired events.
    /// </summary>
    [HttpPost("sepay")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(SepayWebhookHttpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(SepayWebhookErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> HandleSepayWebhook(
        [FromBody] SepayWebhookPayload? payload,
        CancellationToken cancellationToken = default)
    {
        if (!IsValidSepayApiKey())
        {
            return Unauthorized(new SepayWebhookErrorResponse(false, "Unauthorized"));
        }

        if (payload == null)
        {
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
            RequireBankAccountMatch: requireBankAccountMatch);

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(new SepayWebhookHttpResponse(true, result.Status, result.Message));
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

    private bool IsValidSepayApiKey()
    {
        var configuredKey = _configuration["Payment:Sepay:ApiKey"];
        if (string.IsNullOrWhiteSpace(configuredKey))
        {
            return false;
        }

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

        var providedKey = rawHeader[prefix.Length..].Trim();
        if (string.IsNullOrEmpty(providedKey))
        {
            return false;
        }

        var expectedBytes = Encoding.UTF8.GetBytes(configuredKey.Trim());
        var providedBytes = Encoding.UTF8.GetBytes(providedKey);

        return expectedBytes.Length == providedBytes.Length &&
               CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
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

public sealed record SepayWebhookErrorResponse(bool Success, string Message);
