using System;
using System.Collections.Generic;
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
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    /// Strictly read-only verification to prevent race conditions with server IPN webhook.
    /// </summary>
    [HttpGet("vnpay-return")]
    [HttpGet("/api/public/payments/vnpay/return")]
    [AllowAnonymous]
    public IActionResult VnpayReturn([FromServices] IVnpayPaymentService vnpayService)
    {
        var queryDict = Request.Query.ToDictionary(q => q.Key, q => q.Value.ToString());
        var verify = vnpayService.VerifyCallback(queryDict);

        var isSuccess = verify.IsSignatureValid && verify.IsSuccess;
        var responseCode = verify.ResponseCode ?? "99";
        var message = verify.IsSignatureValid
            ? (isSuccess ? "Giao dịch thanh toán thành công." : $"Giao dịch không thành công (Mã lỗi: {responseCode}).")
            : "Chữ ký số không hợp lệ (Invalid Checksum).";

        queryDict.TryGetValue("vnp_BankCode", out var bankCode);

        return Ok(new
        {
            success = isSuccess,
            data = new
            {
                rspCode = verify.IsSignatureValid ? (isSuccess ? "00" : responseCode) : "97",
                message,
                txnRef = verify.TxnRef,
                transactionNo = verify.TransactionNo,
                amount = verify.Amount,
                bankCode
            }
        });
    }

    private static readonly Dictionary<string, string> BankNameToBinMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["MB"] = "970422",
        ["MBBANK"] = "970422",
        ["MB BANK"] = "970422",
        ["VIETINBANK"] = "970415",
        ["ICB"] = "970415",
        ["CTG"] = "970415",
        ["VIETCOMBANK"] = "970436",
        ["VCB"] = "970436",
        ["TECHCOMBANK"] = "970407",
        ["TCB"] = "970407",
        ["BIDV"] = "970418",
        ["TPBANK"] = "970423",
        ["TPB"] = "970423",
        ["VPBANK"] = "970432",
        ["VPB"] = "970432",
        ["OCB"] = "970448",
        ["AGRIBANK"] = "970405",
        ["VBA"] = "970405",
        ["SACOMBANK"] = "970403",
        ["STB"] = "970403",
        ["ACB"] = "970416",
        ["VIB"] = "970441",
        ["MSB"] = "970426",
        ["HDBANK"] = "970437",
        ["SHB"] = "970443",
        ["SEABANK"] = "970440",
        ["EXIMBANK"] = "970431",
        ["EIB"] = "970431"
    };

    /// <summary>
    /// Generates dynamic VietQR code for bank transfer with confirmation code in description (Task A02).
    /// Queries PrintTemplateConfigs for the reservation's PropertyId (or TenantId fallback) and returns 422 if bank info is not configured.
    /// </summary>
    [HttpPost("vietqr/generate")]
    [HttpPost("/api/public/payments/vietqr/generate")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<VietQrResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> GenerateVietQr(
        [FromBody] VietQrApiRequest request,
        [FromServices] IVietQrService vietQrService,
        [FromServices] IApplicationDbContext dbContext,
        CancellationToken cancellationToken = default)
    {
        if (request == null || request.Amount <= 0)
        {
            return BadRequest(ApiResponse.Fail("ERR_INVALID_AMOUNT", "Số tiền chuyển khoản không hợp lệ."));
        }

        Reservation? reservation = null;
        Guid targetTenantId = Guid.Empty;
        Guid? targetPropertyId = null;

        if (request.ReservationId.HasValue && request.ReservationId.Value != Guid.Empty)
        {
            reservation = await dbContext.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == request.ReservationId.Value, cancellationToken);

            if (reservation == null)
            {
                return NotFound(ApiResponse.Fail("ERR_RESERVATION_NOT_FOUND", "Không tìm thấy hồ sơ đặt phòng."));
            }

            targetTenantId = reservation.TenantId;
            targetPropertyId = reservation.PropertyId;
        }
        else if (!string.IsNullOrWhiteSpace(request.ConfirmationCode))
        {
            var codeOrToken = request.ConfirmationCode.Trim();
            var candidates = await dbContext.Reservations
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(r =>
                    (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == codeOrToken.ToUpper()) ||
                    (r.Notes != null && r.Notes.Contains(codeOrToken)))
                .Take(10)
                .ToListAsync(cancellationToken);

            reservation = candidates.FirstOrDefault(r =>
            {
                if (string.Equals(r.ConfirmationCode, codeOrToken, StringComparison.OrdinalIgnoreCase))
                    return true;
                var snap = ReservationSnapshotHelper.TryDeserialize(r.Notes);
                return snap != null &&
                       !string.IsNullOrWhiteSpace(snap.LookupToken) &&
                       string.Equals(snap.LookupToken, codeOrToken, StringComparison.OrdinalIgnoreCase);
            });

            if (reservation != null)
            {
                targetTenantId = reservation.TenantId;
                targetPropertyId = reservation.PropertyId;
            }
        }

        if (targetTenantId == Guid.Empty && request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty)
        {
            var property = await dbContext.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == request.PropertyId.Value, cancellationToken);

            if (property != null)
            {
                targetTenantId = property.TenantId;
                targetPropertyId = property.Id;
            }
        }

        if (targetTenantId == Guid.Empty)
        {
            return UnprocessableEntity(ApiResponse.Fail(
                "ERR_BANK_ACCOUNT_NOT_CONFIGURED",
                "Không xác định được cơ sở lưu trú hoặc cơ sở chưa cấu hình tài khoản ngân hàng nhận chuyển khoản VietQR."));
        }

        var configs = await dbContext.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.TenantId == targetTenantId && (c.PropertyId == targetPropertyId || c.PropertyId == null))
            .ToListAsync(cancellationToken);

        var config = (targetPropertyId.HasValue
                ? configs.FirstOrDefault(c => c.PropertyId == targetPropertyId.Value)
                : null)
            ?? configs.FirstOrDefault(c => c.PropertyId == null);

        if (config == null ||
            string.IsNullOrWhiteSpace(config.BankName) ||
            string.IsNullOrWhiteSpace(config.BankAccountNumber))
        {
            return UnprocessableEntity(ApiResponse.Fail(
                "ERR_BANK_ACCOUNT_NOT_CONFIGURED",
                "Cơ sở lưu trú chưa cấu hình tài khoản ngân hàng nhận thanh toán VietQR. Vui lòng chọn phương thức thanh toán VNPay hoặc liên hệ lễ tân."));
        }

        var accountHolder = !string.IsNullOrWhiteSpace(config.BankAccountHolder)
            ? config.BankAccountHolder.Trim()
            : config.HeaderCompanyName?.Trim();

        if (string.IsNullOrWhiteSpace(accountHolder))
        {
            return UnprocessableEntity(ApiResponse.Fail(
                "ERR_BANK_ACCOUNT_NOT_CONFIGURED",
                "Cơ sở lưu trú chưa cấu hình tên chủ tài khoản ngân hàng nhận thanh toán VietQR."));
        }

        var bankBin = ResolveBankBin(config.BankName);
        var effectiveCode = !string.IsNullOrWhiteSpace(reservation?.ConfirmationCode)
            ? reservation!.ConfirmationCode
            : (!string.IsNullOrWhiteSpace(request.ConfirmationCode) ? request.ConfirmationCode.Trim() : "BOOKING");

        var payload = new VietQrPayload(
            BankBin: bankBin,
            AccountNumber: config.BankAccountNumber.Trim(),
            AccountName: accountHolder,
            Amount: request.Amount,
            Description: !string.IsNullOrWhiteSpace(request.Description) ? request.Description.Trim() : $"DATPHONG {effectiveCode}",
            ConfirmationCode: effectiveCode,
            ReservationId: reservation?.Id ?? request.ReservationId
        );

        var result = vietQrService.GenerateDynamicQr(payload);
        return Ok(ApiResponse.Ok(result, "Sinh mã VietQR thành công."));
    }

    private static string ResolveBankBin(string rawBankNameOrBin)
    {
        var trimmed = rawBankNameOrBin.Trim();
        if (trimmed.Length == 6 && trimmed.All(char.IsDigit))
        {
            return trimmed;
        }

        if (BankNameToBinMap.TryGetValue(trimmed, out var mappedBin))
        {
            return mappedBin;
        }

        var compact = trimmed.Replace(" ", string.Empty, StringComparison.Ordinal);
        return BankNameToBinMap.TryGetValue(compact, out mappedBin) ? mappedBin : trimmed;
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
public sealed record VietQrApiRequest(
    decimal Amount,
    string? ConfirmationCode = null,
    Guid? ReservationId = null,
    string? BankBin = null,
    string? AccountNumber = null,
    string? AccountName = null,
    string? Description = null,
    Guid? PropertyId = null);
