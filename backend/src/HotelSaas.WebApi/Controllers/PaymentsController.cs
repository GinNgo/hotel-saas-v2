using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Commands.CreatePayment;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Payments.Queries.GetPayments;
using HotelSaas.Application.Payments.Queries.GetPaymentSummary;
using HotelSaas.Application.Payments.Queries.GetShiftReport;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages payment collections, cashier transactions, and daily collection summaries.
/// </summary>
[ApiController]
[Route("api/payments")]
[Produces("application/json")]
[Authorize]
public sealed class PaymentsController : ControllerBase
{
    private readonly ISender _mediator;

    public PaymentsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Records a manual payment (Cash, Bank Transfer) or deposit for a reservation.
    /// </summary>
    [HttpPost]
    [RequirePermission("PAYMENTS", PermissionAction.Create)]
    [ProducesResponseType(typeof(PaymentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreatePayment(
        [FromBody] CreatePaymentRequest request,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        var targetPropertyId = ResolveTargetPropertyId(propertyId);
        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header or query) is required." });
        }

        var idempotencyKey = request.IdempotencyKey;
        if (string.IsNullOrWhiteSpace(idempotencyKey) &&
            Request.Headers.TryGetValue("Idempotency-Key", out var headerKey) &&
            !string.IsNullOrWhiteSpace(headerKey))
        {
            idempotencyKey = headerKey.ToString();
        }

        var command = new CreatePaymentCommand(
            targetPropertyId.Value,
            request.ReservationId,
            request.Amount,
            request.Method,
            request.TransactionRef,
            idempotencyKey,
            request.IsDeposit
        );

        var result = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Lists payment history for the property with optional filters and pagination.
    /// </summary>
    [HttpGet]
    [RequirePermission("PAYMENTS", PermissionAction.Read)]
    [ProducesResponseType(typeof(PagedResult<PaymentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPayments(
        [FromQuery] Guid? propertyId,
        [FromQuery] Guid? reservationId,
        [FromQuery] PaymentMethod? method,
        [FromQuery] PaymentStatus? status,
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var targetPropertyId = ResolveTargetPropertyId(propertyId);
        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header or query) is required." });
        }

        var query = new GetPaymentsQuery(
            targetPropertyId.Value,
            reservationId,
            method,
            status,
            dateFrom,
            dateTo,
            page,
            pageSize
        );

        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves cashier collection summary for a property on a specific date.
    /// </summary>
    [HttpGet("summary")]
    [RequirePermission("PAYMENTS", PermissionAction.Read)]
    [ProducesResponseType(typeof(PaymentSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPaymentSummary(
        [FromQuery] Guid? propertyId,
        [FromQuery] DateOnly? date,
        CancellationToken cancellationToken)
    {
        var targetPropertyId = ResolveTargetPropertyId(propertyId);
        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header or query) is required." });
        }

        var query = new GetPaymentSummaryQuery(targetPropertyId.Value, date);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves shift cashier collection report and line-by-line audit for a specific shift and date.
    /// </summary>
    [HttpGet("shift-report")]
    [RequirePermission("PAYMENTS", PermissionAction.Read)]
    [ProducesResponseType(typeof(ShiftReportDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetShiftReport(
        [FromQuery] Guid? propertyId,
        [FromQuery] DateOnly? date,
        [FromQuery] ShiftType shiftType = ShiftType.Morning,
        CancellationToken cancellationToken = default)
    {
        var targetPropertyId = ResolveTargetPropertyId(propertyId);
        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header or query) is required." });
        }

        var query = new GetShiftReportQuery(targetPropertyId.Value, date, shiftType);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Creates a signed VNPay sandbox checkout URL for a reservation or booking hold.
    /// </summary>
    [HttpPost("vnpay/create-url")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HotelSaas.Application.Common.Interfaces.VnpayCreateUrlResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateVnpayUrl(
        [FromBody] CreateVnpayUrlApiRequest request,
        CancellationToken cancellationToken)
    {
        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var command = new HotelSaas.Application.Payments.Commands.CreateVnpayUrl.CreateVnpayUrlCommand(
            request.ReservationId,
            request.LookupToken,
            clientIp,
            request.ReturnUrl);

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Asynchronous Server-to-Server IPN webhook endpoint invoked by VNPay payment gateway.
    /// </summary>
    [HttpGet("vnpay-ipn")]
    [HttpGet("/api/public/payments/vnpay/ipn")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HotelSaas.Application.Payments.Commands.ProcessVnpayIpn.VnpayIpnResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> VnpayIpn(CancellationToken cancellationToken)
    {
        var queryDict = Request.Query.ToDictionary(q => q.Key, q => q.Value.ToString());
        var command = new HotelSaas.Application.Payments.Commands.ProcessVnpayIpn.ProcessVnpayIpnCommand(queryDict);
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Return URL endpoint redirecting or confirming transaction status for client browser.
    /// </summary>
    [HttpGet("vnpay-return")]
    [HttpGet("/api/public/payments/vnpay/return")]
    [AllowAnonymous]
    public async Task<IActionResult> VnpayReturn(CancellationToken cancellationToken)
    {
        var queryDict = Request.Query.ToDictionary(q => q.Key, q => q.Value.ToString());
        var command = new HotelSaas.Application.Payments.Commands.ProcessVnpayIpn.ProcessVnpayIpnCommand(queryDict);
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(new { success = result.RspCode == "00" || result.RspCode == "02", data = result });
    }

    private Guid? ResolveTargetPropertyId(Guid? queryPropertyId)
    {
        if (Request.Headers.TryGetValue("X-Property-Id", out var headerVal) &&
            Guid.TryParse(headerVal, out var headerGuid))
        {
            if (queryPropertyId.HasValue && queryPropertyId.Value != headerGuid)
            {
                return null;
            }
            return headerGuid;
        }

        return queryPropertyId;
    }
}

public sealed record CreateVnpayUrlApiRequest(
    Guid? ReservationId = null,
    string? LookupToken = null,
    string? ReturnUrl = null
);
