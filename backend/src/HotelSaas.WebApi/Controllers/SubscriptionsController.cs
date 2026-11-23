using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Commands.ProcessVnpayIpn;
using HotelSaas.Application.Subscriptions.Commands.ConfirmSubscriptionPayment;
using HotelSaas.Application.Subscriptions.Commands.InitiateSubscriptionUpgrade;
using HotelSaas.Application.Subscriptions.DTOs;
using HotelSaas.Application.Subscriptions.Queries.GetCurrentSubscription;
using HotelSaas.Application.Subscriptions.Queries.GetSubscriptionPlans;
using HotelSaas.Application.Subscriptions.Queries.GetSubscriptionVietQr;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages tenant SaaS subscription plans, usage quotas, and VNPay billing upgrades via MediatR.
/// </summary>
[ApiController]
[Route("api/subscriptions")]
[Produces("application/json")]
[Authorize]
public sealed class SubscriptionsController : ControllerBase
{
    private readonly ISender _mediator;

    public SubscriptionsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Retrieves the current tenant's active subscription status, live DB limits, resource utilization, and billing history.
    /// </summary>
    [HttpGet("current")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(TenantSubscriptionCurrentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetCurrentSubscription(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetCurrentSubscriptionQuery(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns the catalog of active SaaS subscription packages sourced live from the SubscriptionPlans table.
    /// </summary>
    [HttpGet("plans")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<SubscriptionPlanCatalogDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAvailablePlans(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetSubscriptionPlansQuery(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Initiates a subscription upgrade by creating a Pending SubscriptionPayment and optional VNPay checkout URL.
    /// </summary>
    [HttpPost("upgrade")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Update)]
    [ProducesResponseType(typeof(SubscriptionUpgradeInitiationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpgradeSubscription(
        [FromBody] UpgradeSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var result = await _mediator.Send(new InitiateSubscriptionUpgradeCommand(
            request.TargetTier,
            request.BillingCycle ?? BillingCycle.Monthly,
            clientIp,
            request.ReturnUrl), cancellationToken);

        return Ok(result);
    }

    /// <summary>
    /// Generates a dynamic SePay/VietQR bank transfer instruction for a pending SaaS subscription upgrade payment.
    /// </summary>
    [HttpGet("payments/{paymentId:guid}/vietqr")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(ApiResponse<SubscriptionVietQrDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> GetSubscriptionVietQr(
        Guid paymentId,
        [FromServices] IConfiguration configuration,
        [FromServices] IHostEnvironment environment,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _mediator.Send(new GetSubscriptionVietQrQuery(
                PaymentId: paymentId,
                PlatformBankName: configuration["Payment:Sepay:PlatformBankName"],
                PlatformAccountNumber: configuration["Payment:Sepay:PlatformAccountNumber"],
                PlatformAccountHolder: configuration["Payment:Sepay:PlatformAccountHolder"],
                IsDevelopment: environment.IsDevelopment()), cancellationToken);

            return Ok(ApiResponse.Ok(result, "Sinh mã VietQR nâng cấp gói cước thành công."));
        }
        catch (UnprocessableEntityException ex)
        {
            return UnprocessableEntity(ApiResponse.Fail(ex.ErrorCode, ex.Message));
        }
    }

    /// <summary>
    /// Confirms an already-settled or VNPay-signed subscription payment for the authenticated tenant.
    /// Manual activation of a Pending payment without signed VNPay parameters requires SuperAdmin role.
    /// </summary>
    [HttpPost("payments/{paymentId:guid}/confirm")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Update)]
    [ProducesResponseType(typeof(ConfirmSubscriptionPaymentResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ConfirmPayment(
        Guid paymentId,
        [FromBody] ConfirmSubscriptionPaymentRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new ConfirmSubscriptionPaymentCommand(
            PaymentId: paymentId,
            VnpayParams: request?.VnpayParams,
            GatewayTransactionNo: request?.GatewayTransactionNo), cancellationToken);

        return Ok(result);
    }

    /// <summary>
    /// Verifies VNPay browser return parameters for the authenticated tenant's subscription payment.
    /// </summary>
    [HttpPost("vnpay-return")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Update)]
    [ProducesResponseType(typeof(ConfirmSubscriptionPaymentResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyVnpayReturn(
        [FromBody] Dictionary<string, string> vnpayParams,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new ConfirmSubscriptionPaymentCommand(
            PaymentId: null,
            VnpayParams: vnpayParams), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Anonymous server-to-server VNPay IPN callback endpoint confirming subscription upgrades.
    /// </summary>
    [HttpGet("vnpay-ipn")]
    [HttpPost("vnpay-ipn")]
    [AllowAnonymous]
    [EnableRateLimiting("webhooks")]
    [ProducesResponseType(typeof(VnpayIpnResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> VnpayIpn(CancellationToken cancellationToken)
    {
        var vnpParams = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in Request.Query)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                vnpParams[key] = value.ToString();
            }
        }

        if (Request.HasFormContentType)
        {
            var form = await Request.ReadFormAsync(cancellationToken);
            foreach (var (key, value) in form)
            {
                if (!string.IsNullOrWhiteSpace(value) && !vnpParams.ContainsKey(key))
                {
                    vnpParams[key] = value.ToString();
                }
            }
        }

        var response = await _mediator.Send(new ProcessSubscriptionVnpayIpnCommand(vnpParams), cancellationToken);
        return Ok(response);
    }
}

public sealed class TenantSubscriptionDto
{
    public Guid SubscriptionId { get; set; }
    public Guid TenantId { get; set; }
    public int Tier { get; set; }
    public string TierName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal PricePerCycle { get; set; }
    public string Currency { get; set; } = "VND";
    public DateTime CurrentPeriodStartUtc { get; set; }
    public DateTime CurrentPeriodEndUtc { get; set; }
    public bool AutoRenew { get; set; }
    public int CurrentRoomCount { get; set; }
    public int MaxRoomsAllowed { get; set; }
    public int CurrentPropertyCount { get; set; }
    public int MaxPropertiesAllowed { get; set; }
    public double RoomUsagePercentage { get; set; }
    public List<string> Features { get; set; } = new();
    public bool IsNearQuota { get; set; }
}

public sealed class SubscriptionPackageDto
{
    public int Tier { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal MonthlyPrice { get; set; }
    public decimal AnnualPrice { get; set; }
    public int MaxRooms { get; set; }
    public int MaxProperties { get; set; }
    public int MaxStaff { get; set; }
    public string Badge { get; set; } = string.Empty;
    public bool IsPopular { get; set; }
    public List<string> Features { get; set; } = new();
}

public sealed class UpgradeSubscriptionRequest
{
    public int TargetTier { get; set; }
    public BillingCycle? BillingCycle { get; set; }
    public string? ReturnUrl { get; set; }
}

public sealed class ConfirmSubscriptionPaymentRequest
{
    public IDictionary<string, string>? VnpayParams { get; set; }
    public string? GatewayTransactionNo { get; set; }
}
