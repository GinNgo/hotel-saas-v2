using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Contracts.Commands.CreateAdminContract;
using HotelSaas.Application.Contracts.Commands.UpdateAdminContractStatus;
using HotelSaas.Application.Contracts.DTOs;
using HotelSaas.Application.Contracts.Queries.GetAdminContractById;
using HotelSaas.Application.Contracts.Queries.GetAdminContracts;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Quản lý Hợp đồng Cung cấp Dịch vụ Phần mềm SaaS giữa Nền tảng và các Khách sạn / Doanh nghiệp Đối tác.
/// Hỗ trợ tạo hợp đồng, phê duyệt, ký kết điện tử và theo dõi trạng thái hiệu lực.
/// </summary>
[Authorize(Roles = "SuperAdmin")]
[ApiController]
[Route("api/admin/contracts")]
[Produces("application/json")]
public sealed class AdminContractsController : ControllerBase
{
    private readonly ISender _mediator;

    public AdminContractsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Danh sách hợp đồng đối tác có phân trang, lọc theo trạng thái và tìm kiếm từ khóa.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<TenantContractSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetContracts(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] Guid? tenantId,
        CancellationToken cancellationToken)
    {
        try
        {
            var contracts = await _mediator.Send(new GetAdminContractsQuery(status, search, tenantId), cancellationToken);
            return Ok(contracts.Select(MapToSummaryDto).ToList());
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
    }

    /// <summary>
    /// Xem chi tiết hợp đồng và các điều khoản cam kết pháp lý.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TenantContractDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetContractById(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var detail = await _mediator.Send(new GetAdminContractByIdQuery(id), cancellationToken);
            return Ok(MapToDetailDto(detail));
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { code = "ERR_CONTRACT_NOT_FOUND", message = ex.Message });
        }
    }

    /// <summary>
    /// Khởi tạo một bản ghi hợp đồng dịch vụ mới.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(TenantContractDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateContract([FromBody] CreateContractRequest request, CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest(new { code = "ERR_TENANT_REQUIRED", message = "Cần chọn Khách sạn / Doanh nghiệp đối tác." });
        }

        try
        {
            var detail = await _mediator.Send(new CreateAdminContractCommand(
                request.TenantId,
                request.ContractNumber,
                request.PlanCode,
                request.PlanName,
                request.ContractType,
                request.RepresentativeName,
                request.RepresentativeEmail,
                request.RepresentativePhone,
                request.StartDate,
                request.EndDate,
                request.BillingCycle,
                request.ContractValue,
                request.TermsAndConditions,
                request.Notes), cancellationToken);

            var dto = MapToDetailDto(detail);
            return CreatedAtAction(nameof(GetContractById), new { id = dto.Id }, dto);
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Thay đổi trạng thái hiệu lực hợp đồng (Kích hoạt, Tạm ngưng, Chấm dứt, Gia hạn).
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(typeof(TenantContractSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateContractStatus(
        Guid id,
        [FromBody] UpdateContractStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest(new { code = "ERR_INVALID_STATUS", message = "Trạng thái hợp đồng không hợp lệ." });
        }

        try
        {
            var updated = await _mediator.Send(new UpdateAdminContractStatusCommand(
                id,
                request.Status,
                request.Note,
                request.Notes), cancellationToken);

            return Ok(MapToSummaryDto(updated));
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { code = "ERR_CONTRACT_NOT_FOUND", message = ex.Message });
        }
    }

    private static TenantContractSummaryDto MapToSummaryDto(AdminContractSummaryDto dto) => new()
    {
        Id = dto.Id,
        TenantId = dto.TenantId,
        TenantName = dto.TenantName,
        ContractNumber = dto.ContractNumber,
        PlanCode = dto.PlanCode,
        PlanName = dto.PlanName,
        ContractType = dto.ContractType,
        RepresentativeName = dto.RepresentativeName,
        RepresentativeEmail = dto.RepresentativeEmail,
        RepresentativePhone = dto.RepresentativePhone,
        StartDate = dto.StartDate,
        EndDate = dto.EndDate,
        BillingCycle = dto.BillingCycle,
        ContractValue = dto.ContractValue,
        Status = dto.Status,
        SignedAtUtc = dto.SignedAtUtc,
        HasDigitalSignature = dto.HasDigitalSignature,
        DigitalSignatureHash = dto.DigitalSignatureHash,
        Notes = dto.Notes,
        CreatedAtUtc = dto.CreatedAtUtc
    };

    private static TenantContractDetailDto MapToDetailDto(AdminContractDetailDto dto) => new()
    {
        Id = dto.Id,
        TenantId = dto.TenantId,
        TenantName = dto.TenantName,
        TenantCode = dto.TenantCode,
        ContractNumber = dto.ContractNumber,
        PlanCode = dto.PlanCode,
        PlanName = dto.PlanName,
        ContractType = dto.ContractType,
        RepresentativeName = dto.RepresentativeName,
        RepresentativeEmail = dto.RepresentativeEmail,
        RepresentativePhone = dto.RepresentativePhone,
        StartDate = dto.StartDate,
        EndDate = dto.EndDate,
        BillingCycle = dto.BillingCycle,
        ContractValue = dto.ContractValue,
        Status = dto.Status,
        SignedAtUtc = dto.SignedAtUtc,
        DigitalSignatureHash = dto.DigitalSignatureHash,
        TermsAndConditions = dto.TermsAndConditions,
        Notes = dto.Notes,
        ActivePropertiesCount = dto.ActivePropertiesCount,
        ActiveRoomsCount = dto.ActiveRoomsCount,
        CreatedAtUtc = dto.CreatedAtUtc
    };
}

public sealed class TenantContractSummaryDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string ContractNumber { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string ContractType { get; set; } = string.Empty;
    public string RepresentativeName { get; set; } = string.Empty;
    public string RepresentativeEmail { get; set; } = string.Empty;
    public string RepresentativePhone { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string BillingCycle { get; set; } = string.Empty;
    public decimal ContractValue { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? SignedAtUtc { get; set; }
    public bool HasDigitalSignature { get; set; }
    public string? DigitalSignatureHash { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class TenantContractDetailDto
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public string TenantCode { get; set; } = string.Empty;
    public string ContractNumber { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public string ContractType { get; set; } = string.Empty;
    public string RepresentativeName { get; set; } = string.Empty;
    public string RepresentativeEmail { get; set; } = string.Empty;
    public string RepresentativePhone { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string BillingCycle { get; set; } = string.Empty;
    public decimal ContractValue { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? SignedAtUtc { get; set; }
    public string? DigitalSignatureHash { get; set; }
    public string? TermsAndConditions { get; set; }
    public string? Notes { get; set; }
    public int ActivePropertiesCount { get; set; }
    public int ActiveRoomsCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class CreateContractRequest
{
    public Guid TenantId { get; set; }
    public string? ContractNumber { get; set; }
    public string PlanCode { get; set; } = "PRO";
    public string PlanName { get; set; } = "Gói Chuyên Nghiệp (Pro)";
    public string ContractType { get; set; } = "Standard";
    public string RepresentativeName { get; set; } = string.Empty;
    public string RepresentativeEmail { get; set; } = string.Empty;
    public string? RepresentativePhone { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string BillingCycle { get; set; } = "Monthly";
    public decimal ContractValue { get; set; }
    public string? TermsAndConditions { get; set; }
    public string? Notes { get; set; }
}

public sealed class UpdateContractStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Note { get; set; }
    public string? Notes { get; set; }
}
