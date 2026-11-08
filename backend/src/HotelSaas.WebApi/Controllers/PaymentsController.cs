using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.Commands.ApproveRefund;
using HotelSaas.Application.Payments.Commands.ConfirmRefundPayout;
using HotelSaas.Application.Payments.Commands.CreatePayment;
using HotelSaas.Application.Payments.Commands.RejectRefund;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Payments.Queries.GetPayments;
using HotelSaas.Application.Payments.Queries.GetPaymentSummary;
using HotelSaas.Application.Payments.Queries.GetRefundRequests;
using HotelSaas.Application.Payments.Queries.GetRefundRequestDetail;
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
/// Manages payment collections, cashier transactions, daily collection summaries, and refund approvals (Decision D23).
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
    /// Lists refund requests for the property with optional status/date filters and pagination (Decision D23).
    /// </summary>
    [HttpGet("refunds")]
    [RequirePermission("PAYMENTS", PermissionAction.Read)]
    [ProducesResponseType(typeof(PagedResult<RefundRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetRefundRequests(
        [FromQuery] Guid? propertyId,
        [FromQuery] string? status,
        [FromQuery] DateOnly? dateFrom,
        [FromQuery] DateOnly? dateTo,
        [FromQuery] string? searchTerm,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var targetPropertyId = ResolveTargetPropertyId(propertyId);
        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header or query) is required." });
        }

        var query = new GetRefundRequestsQuery(targetPropertyId.Value, status, dateFrom, dateTo, searchTerm, page, pageSize);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves full details, original payments, and D23 audit trail for a single refund request.
    /// </summary>
    [HttpGet("refunds/{id:guid}")]
    [RequirePermission("PAYMENTS", PermissionAction.Read)]
    [ProducesResponseType(typeof(RefundRequestDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRefundRequestDetail(
        [FromRoute] Guid id,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken = default)
    {
        var targetPropertyId = ResolveTargetPropertyId(propertyId);
        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header or query) is required." });
        }

        var query = new GetRefundRequestDetailQuery(id, targetPropertyId.Value);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Approves a pending refund request (Decision D23).
    /// Authorized exclusively for Owner and Property Manager with PAYMENTS:Approve.
    /// </summary>
    [HttpPost("refunds/{id:guid}/approve")]
    [RequirePermission("PAYMENTS", PermissionAction.Approve)]
    [ProducesResponseType(typeof(RefundRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ApproveRefund(
        [FromRoute] Guid id,
        [FromBody] ApproveRefundApiRequest? request,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken = default)
    {
        var targetPropertyId = ResolveTargetPropertyId(propertyId);
        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header or query) is required." });
        }

        var command = new ApproveRefundCommand(id, targetPropertyId.Value, request?.Notes);
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Rejects a pending refund request with a mandatory reason (Decision D23).
    /// Authorized exclusively for Owner and Property Manager with PAYMENTS:Approve.
    /// </summary>
    [HttpPost("refunds/{id:guid}/reject")]
    [RequirePermission("PAYMENTS", PermissionAction.Approve)]
    [ProducesResponseType(typeof(RefundRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RejectRefund(
        [FromRoute] Guid id,
        [FromBody] RejectRefundApiRequest request,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken = default)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { code = "ERR_REASON_REQUIRED", message = "Vui lòng nhập lý do từ chối yêu cầu hoàn tiền." });
        }

        var targetPropertyId = ResolveTargetPropertyId(propertyId);
        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header or query) is required." });
        }

        var command = new RejectRefundCommand(id, targetPropertyId.Value, request.Reason);
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Confirms that refund disbursement has been completed with a valid bank reference or voucher (Decision D23).
    /// </summary>
    [HttpPost("refunds/{id:guid}/confirm-payout")]
    [RequirePermission("PAYMENTS", PermissionAction.Approve)]
    [ProducesResponseType(typeof(RefundRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ConfirmRefundPayout(
        [FromRoute] Guid id,
        [FromBody] ConfirmRefundPayoutApiRequest request,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken = default)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.BankTransactionRef))
        {
            return BadRequest(new { code = "ERR_BANK_REF_REQUIRED", message = "Mã tham chiếu ngân hàng hoặc số phiếu chi là bắt buộc." });
        }

        var targetPropertyId = ResolveTargetPropertyId(propertyId);
        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header or query) is required." });
        }

        var command = new ConfirmRefundPayoutCommand(
            id,
            targetPropertyId.Value,
            request.PayoutMethod,
            request.BankTransactionRef,
            request.Notes);

        var result = await _mediator.Send(command, cancellationToken);
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
    [HttpPost("/api/public/payments/vnpay/create-url")]
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

    /// <summary>
    /// Generates dynamic VietQR code for bank transfer with confirmation code in description (Task A02).
    /// </summary>
    [HttpPost("vietqr/generate")]
    [HttpPost("/api/public/payments/vietqr/generate")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<VietQrResult>), StatusCodes.Status200OK)]
    public IActionResult GenerateVietQr(
        [FromBody] VietQrApiRequest request,
        [FromServices] IVietQrService vietQrService)
    {
        if (request == null || request.Amount <= 0)
        {
            return BadRequest(ApiResponse.Fail("ERR_INVALID_AMOUNT", "Số tiền chuyển khoản không hợp lệ."));
        }

        var payload = new VietQrPayload(
            BankBin: request.BankBin ?? "970422",
            AccountNumber: request.AccountNumber ?? "0345678910",
            AccountName: request.AccountName ?? "HOTEL SAAS RESORT",
            Amount: request.Amount,
            Description: request.Description ?? $"DATPHONG {request.ConfirmationCode ?? "HOTEL"}",
            ConfirmationCode: request.ConfirmationCode ?? "HOTEL",
            ReservationId: request.ReservationId
        );

        var result = vietQrService.GenerateDynamicQr(payload);
        return Ok(ApiResponse.Ok(result, "Sinh mã VietQR thành công."));
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

public sealed record ApproveRefundApiRequest(string? Notes = null);
public sealed record RejectRefundApiRequest(string Reason);
public sealed record ConfirmRefundPayoutApiRequest(PaymentMethod PayoutMethod, string BankTransactionRef, string? Notes = null);
public sealed record CreateVnpayUrlApiRequest(
    Guid? ReservationId = null,
    string? LookupToken = null,
    string? ReturnUrl = null
);
public sealed record VietQrApiRequest(decimal Amount, string? ConfirmationCode = null, Guid? ReservationId = null, string? BankBin = null, string? AccountNumber = null, string? AccountName = null, string? Description = null);
