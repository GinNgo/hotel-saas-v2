using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Print.Commands.SavePrintTemplateConfig;
using HotelSaas.Application.Print.DTOs;
using HotelSaas.Application.Print.Queries.GetPrintableContract;
using HotelSaas.Application.Print.Queries.GetPrintableInvoice;
using HotelSaas.Application.Print.Queries.GetPrintableVoucher;
using HotelSaas.Application.Print.Queries.GetPrintTemplateConfig;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Cung cấp dữ liệu chuẩn hóa và mẫu in ấn cho các tài liệu:
/// 1. Hóa đơn thanh toán & Sổ cái phòng (Guest Invoice / Folio) kèm mã VietQR chuyển khoản.
/// 2. Phiếu xác nhận đặt phòng & Thẻ nhận phòng (Booking Voucher / Check-in Pass).
/// 3. Hợp đồng cung cấp dịch vụ phần mềm SaaS (SaaS Subscription Agreement).
/// 4. Cấu hình thông tin in ấn và thương hiệu (PrintTemplateConfig).
/// </summary>
[Authorize]
[ApiController]
[Route("api/print")]
[Produces("application/json")]
[EnableRateLimiting("public-print")]
public sealed class PrintDocumentsController : ControllerBase
{
    private readonly ISender _mediator;

    public PrintDocumentsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Lấy dữ liệu in Hóa đơn / Sổ cái thanh toán phòng của khách hàng theo ReservationId.
    /// Bao gồm thông tin cơ sở, chi tiết hạng phòng, phụ thu, chiết khấu, VAT và chuỗi payload VietQR chuẩn.
    /// </summary>
    [HttpGet("invoice/{reservationId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PrintableInvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrintableInvoice(
        Guid reservationId,
        [FromQuery] string? code = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _mediator.Send(new GetPrintableInvoiceQuery(reservationId, code), cancellationToken);
            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { code = "ERR_RESERVATION_NOT_FOUND", message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Lấy dữ liệu in Phiếu xác nhận đặt phòng / Thẻ làm thủ tục (Booking Voucher) theo LookupToken hoặc ConfirmationCode.
    /// Che giấu PII trừ khi người dùng đã xác thực là chủ đơn / nhân viên cơ sở hoặc cung cấp đúng LookupToken đầy đủ.
    /// </summary>
    [HttpGet("voucher/{confirmationCode}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PrintableVoucherDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrintableVoucher(string confirmationCode, CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _mediator.Send(new GetPrintableVoucherQuery(confirmationCode), cancellationToken);
            return Ok(result);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { code = "ERR_VOUCHER_NOT_FOUND", message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Lấy dữ liệu in Hợp đồng Cung cấp Dịch vụ Phần mềm SaaS chính thức theo ContractId.
    /// </summary>
    [HttpGet("contract/{contractId:guid}")]
    [ProducesResponseType(typeof(PrintableContractDocumentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPrintableContract(Guid contractId, CancellationToken cancellationToken = default)
    {
        try
        {
            var dto = await _mediator.Send(new GetPrintableContractQuery(contractId), cancellationToken);
            return Ok(MapContractDocumentDto(dto));
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { code = "ERR_CONTRACT_NOT_FOUND", message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Lấy cấu hình in ấn hiện tại của khách sạn (bắt buộc Tenant scope và quyền SETTINGS:Read).
    /// </summary>
    [HttpGet("template-config")]
    [RequirePermission("SETTINGS", PermissionAction.Read)]
    [ProducesResponseType(typeof(PrintTemplateConfigDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetTemplateConfig(
        [FromQuery] Guid? tenantId = null,
        [FromQuery] Guid? propertyId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var dto = await _mediator.Send(new GetPrintTemplateConfigQuery(tenantId, propertyId), cancellationToken);
            return Ok(MapTemplateConfigDto(dto));
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { code = ex.ErrorCode, message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Cập nhật cấu hình in ấn của cơ sở / khách sạn.
    /// </summary>
    [HttpPut("template-config")]
    [RequirePermission("SETTINGS", PermissionAction.Update)]
    public async Task<IActionResult> SaveTemplateConfig(
        [FromBody] PrintTemplateConfigDto request,
        [FromQuery] Guid? propertyId = null,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            return BadRequest(new { code = "ERR_INVALID_REQUEST", message = "Dữ liệu cấu hình không hợp lệ." });
        }

        try
        {
            var dto = await _mediator.Send(new SavePrintTemplateConfigCommand(
                request.TenantId,
                request.PropertyId,
                propertyId,
                request.HeaderCompanyName,
                request.HeaderAddress,
                request.TaxNumber,
                request.Hotline,
                request.LogoUrl,
                request.BankName,
                request.BankAccountNumber,
                request.BankAccountHolder,
                request.FooterNote,
                request.CheckInPolicyText,
                request.ShowVietQrCode,
                request.DefaultPaperSize), cancellationToken);

            return Ok(MapTemplateConfigDto(dto));
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { code = ex.ErrorCode, message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    private static PrintableContractDocumentDto MapContractDocumentDto(PrintableContractDto dto) => new()
    {
        ContractId = dto.ContractId,
        ContractNumber = dto.ContractNumber,
        CreatedAtUtc = dto.CreatedAtUtc,
        SignedDate = dto.SignedDate,
        SignedAtUtc = dto.SignedAtUtc,
        Status = dto.Status,
        IsSigned = dto.IsSigned,
        StartDate = dto.StartDate,
        EndDate = dto.EndDate,
        PlatformCompanyName = dto.PlatformCompanyName,
        PlatformAddress = dto.PlatformAddress,
        PlatformTaxCode = dto.PlatformTaxCode,
        PlatformHotline = dto.PlatformHotline,
        PlatformRepresentative = dto.PlatformRepresentative,
        TenantCompanyName = dto.TenantCompanyName,
        TenantCode = dto.TenantCode,
        TenantRepresentative = dto.TenantRepresentative,
        TenantEmail = dto.TenantEmail,
        TenantPhone = dto.TenantPhone,
        TenantAddress = dto.TenantAddress,
        PlanCode = dto.PlanCode,
        PlanName = dto.PlanName,
        ContractType = dto.ContractType,
        BillingCycle = dto.BillingCycle,
        ContractValue = dto.ContractValue,
        MaxPropertiesAllowed = dto.MaxPropertiesAllowed,
        MaxRoomsAllowed = dto.MaxRoomsAllowed,
        DigitalSignatureHash = dto.DigitalSignatureHash,
        TermsAndConditions = dto.TermsAndConditions
    };

    private static PrintTemplateConfigDto MapTemplateConfigDto(PrintTemplateSettingsDto dto) => new()
    {
        Id = dto.Id,
        TenantId = dto.TenantId,
        PropertyId = dto.PropertyId,
        HeaderCompanyName = dto.HeaderCompanyName,
        HeaderAddress = dto.HeaderAddress,
        TaxNumber = dto.TaxNumber,
        Hotline = dto.Hotline,
        LogoUrl = dto.LogoUrl,
        BankName = dto.BankName,
        BankAccountNumber = dto.BankAccountNumber,
        BankAccountHolder = dto.BankAccountHolder,
        FooterNote = dto.FooterNote,
        CheckInPolicyText = dto.CheckInPolicyText,
        ShowVietQrCode = dto.ShowVietQrCode,
        DefaultPaperSize = dto.DefaultPaperSize
    };
}

public sealed class PrintableContractDocumentDto
{
    public Guid ContractId { get; set; }
    public string ContractNumber { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime SignedDate { get; set; }
    public DateTime? SignedAtUtc { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsSigned { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string PlatformCompanyName { get; set; } = string.Empty;
    public string PlatformAddress { get; set; } = string.Empty;
    public string PlatformTaxCode { get; set; } = string.Empty;
    public string PlatformHotline { get; set; } = string.Empty;
    public string PlatformRepresentative { get; set; } = string.Empty;
    public string TenantCompanyName { get; set; } = string.Empty;
    public string TenantCode { get; set; } = string.Empty;
    public string TenantRepresentative { get; set; } = string.Empty;
    public string TenantEmail { get; set; } = string.Empty;
    public string TenantPhone { get; set; } = string.Empty;
    public string TenantAddress { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string ContractType { get; set; } = string.Empty;
    public string BillingCycle { get; set; } = string.Empty;
    public decimal ContractValue { get; set; }
    public int MaxPropertiesAllowed { get; set; }
    public int MaxRoomsAllowed { get; set; }
    public string DigitalSignatureHash { get; set; } = string.Empty;
    public string TermsAndConditions { get; set; } = string.Empty;
}

public sealed class PrintTemplateConfigDto
{
    public Guid? Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? PropertyId { get; set; }
    public string HeaderCompanyName { get; set; } = string.Empty;
    public string HeaderAddress { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;
    public string Hotline { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string BankName { get; set; } = string.Empty;
    public string BankAccountNumber { get; set; } = string.Empty;
    public string BankAccountHolder { get; set; } = string.Empty;
    public string FooterNote { get; set; } = string.Empty;
    public string CheckInPolicyText { get; set; } = string.Empty;
    public bool ShowVietQrCode { get; set; }
    public string DefaultPaperSize { get; set; } = "A4";
}
