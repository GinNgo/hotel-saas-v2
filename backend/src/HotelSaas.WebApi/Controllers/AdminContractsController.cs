using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Quản lý Hợp đồng Cung cấp Dịch vụ Phần mềm SaaS giữa Nền tảng và các Khách sạn / Doanh nghiệp Đối tác.
/// Hỗ trợ tạo hợp đồng, phê duyệt, ký kết điện tử và theo dõi trạng thái hiệu lực.
/// </summary>
[ApiController]
[Route("api/admin/contracts")]
[Produces("application/json")]
public sealed class AdminContractsController : ControllerBase
{
    private readonly IApplicationDbContext _context;

    public AdminContractsController(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
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
        var query = _context.TenantContracts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(c => c.Tenant)
            .AsQueryable();

        if (tenantId.HasValue && tenantId != Guid.Empty)
        {
            query = query.Where(c => c.TenantId == tenantId.Value);
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<TenantContractStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(c => c.Status == parsedStatus);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c =>
                c.ContractNumber.ToLower().Contains(s) ||
                c.RepresentativeName.ToLower().Contains(s) ||
                c.RepresentativeEmail.ToLower().Contains(s) ||
                (c.Tenant != null && c.Tenant.Name.ToLower().Contains(s)));
        }

        var contracts = await query
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var result = contracts.Select(c => new TenantContractSummaryDto
        {
            Id = c.Id,
            TenantId = c.TenantId,
            TenantName = c.Tenant?.Name ?? "Đối tác chưa đặt tên",
            ContractNumber = c.ContractNumber,
            PlanCode = c.PlanCode,
            PlanName = c.PlanName,
            ContractType = c.ContractType,
            RepresentativeName = c.RepresentativeName,
            RepresentativeEmail = c.RepresentativeEmail,
            RepresentativePhone = c.RepresentativePhone,
            StartDate = c.StartDate,
            EndDate = c.EndDate,
            BillingCycle = c.BillingCycle.ToString(),
            ContractValue = c.ContractValue,
            Status = c.Status.ToString(),
            SignedAtUtc = c.SignedAtUtc,
            HasDigitalSignature = !string.IsNullOrEmpty(c.DigitalSignatureHash),
            CreatedAtUtc = c.CreatedAtUtc
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Xem chi tiết hợp đồng và các điều khoản cam kết pháp lý.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(TenantContractDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetContractById(Guid id, CancellationToken cancellationToken)
    {
        var contract = await _context.TenantContracts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(c => c.Tenant)
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (contract == null)
        {
            return NotFound(new { code = "ERR_CONTRACT_NOT_FOUND", message = "Không tìm thấy hợp đồng." });
        }

        var propertiesCount = await _context.Properties
            .AsNoTracking()
            .CountAsync(p => p.TenantId == contract.TenantId, cancellationToken);

        var roomsCount = await _context.Rooms
            .AsNoTracking()
            .CountAsync(r => r.TenantId == contract.TenantId, cancellationToken);

        var detail = new TenantContractDetailDto
        {
            Id = contract.Id,
            TenantId = contract.TenantId,
            TenantName = contract.Tenant?.Name ?? "Đối tác",
            TenantCode = contract.Tenant?.Code ?? "",
            ContractNumber = contract.ContractNumber,
            PlanCode = contract.PlanCode,
            PlanName = contract.PlanName,
            ContractType = contract.ContractType,
            RepresentativeName = contract.RepresentativeName,
            RepresentativeEmail = contract.RepresentativeEmail,
            RepresentativePhone = contract.RepresentativePhone,
            StartDate = contract.StartDate,
            EndDate = contract.EndDate,
            BillingCycle = contract.BillingCycle.ToString(),
            ContractValue = contract.ContractValue,
            Status = contract.Status.ToString(),
            SignedAtUtc = contract.SignedAtUtc,
            DigitalSignatureHash = contract.DigitalSignatureHash,
            TermsAndConditions = contract.TermsAndConditions,
            Notes = contract.Notes,
            ActivePropertiesCount = propertiesCount,
            ActiveRoomsCount = roomsCount,
            CreatedAtUtc = contract.CreatedAtUtc
        };

        return Ok(detail);
    }

    /// <summary>
    /// Khởi tạo một bản ghi hợp đồng dịch vụ mới.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(TenantContractDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateContract([FromBody] CreateContractRequest request, CancellationToken cancellationToken)
    {
        if (request.TenantId == Guid.Empty)
        {
            return BadRequest(new { code = "ERR_TENANT_REQUIRED", message = "Cần chọn Khách sạn / Doanh nghiệp đối tác." });
        }

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == request.TenantId, cancellationToken);

        if (tenant == null)
        {
            return BadRequest(new { code = "ERR_TENANT_NOT_FOUND", message = "Không tìm thấy Khách sạn / Doanh nghiệp đối tác." });
        }

        var contractNo = string.IsNullOrWhiteSpace(request.ContractNumber)
            ? $"HD-{DateTime.UtcNow:yyyyMM}-{Random.Shared.Next(1000, 9999)}"
            : request.ContractNumber.Trim().ToUpperInvariant();

        var contract = new TenantContract
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            ContractNumber = contractNo,
            PlanCode = request.PlanCode.Trim().ToUpperInvariant(),
            PlanName = request.PlanName.Trim(),
            ContractType = string.IsNullOrWhiteSpace(request.ContractType) ? "Standard" : request.ContractType.Trim(),
            RepresentativeName = request.RepresentativeName.Trim(),
            RepresentativeEmail = request.RepresentativeEmail.Trim(),
            RepresentativePhone = request.RepresentativePhone?.Trim() ?? "",
            StartDate = request.StartDate,
            EndDate = request.EndDate > request.StartDate ? request.EndDate : request.StartDate.AddMonths(12),
            BillingCycle = Enum.TryParse<BillingCycle>(request.BillingCycle, true, out var cycle) ? cycle : BillingCycle.Monthly,
            ContractValue = request.ContractValue,
            Status = TenantContractStatus.Active,
            SignedAtUtc = DateTime.UtcNow,
            DigitalSignatureHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{contractNo}-{request.TenantId}-{DateTime.UtcNow:O}"))),
            TermsAndConditions = string.IsNullOrWhiteSpace(request.TermsAndConditions)
                ? "Bên A cung cấp bản quyền sử dụng Nền tảng Quản trị Khách sạn Hotel SaaS Platform v2 theo định mức cam kết. Bên B chịu trách nhiệm thanh toán đúng kỳ hạn và tuân thủ các quy định vận hành an toàn dữ liệu."
                : request.TermsAndConditions.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.TenantContracts.Add(contract);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetContractById), new { id = contract.Id }, new TenantContractDetailDto
        {
            Id = contract.Id,
            TenantId = contract.TenantId,
            TenantName = tenant.Name,
            TenantCode = tenant.Code,
            ContractNumber = contract.ContractNumber,
            PlanCode = contract.PlanCode,
            PlanName = contract.PlanName,
            ContractType = contract.ContractType,
            RepresentativeName = contract.RepresentativeName,
            RepresentativeEmail = contract.RepresentativeEmail,
            RepresentativePhone = contract.RepresentativePhone,
            StartDate = contract.StartDate,
            EndDate = contract.EndDate,
            BillingCycle = contract.BillingCycle.ToString(),
            ContractValue = contract.ContractValue,
            Status = contract.Status.ToString(),
            SignedAtUtc = contract.SignedAtUtc,
            DigitalSignatureHash = contract.DigitalSignatureHash,
            TermsAndConditions = contract.TermsAndConditions,
            Notes = contract.Notes,
            CreatedAtUtc = contract.CreatedAtUtc
        });
    }

    /// <summary>
    /// Thay đổi trạng thái hiệu lực hợp đồng (Kích hoạt, Tạm ngưng, Chấm dứt, Gia hạn).
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateContractStatus(
        Guid id,
        [FromBody] UpdateContractStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<TenantContractStatus>(request.Status, true, out var newStatus))
        {
            return BadRequest(new { code = "ERR_INVALID_STATUS", message = "Trạng thái hợp đồng không hợp lệ." });
        }

        var contract = await _context.TenantContracts
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

        if (contract == null)
        {
            return NotFound(new { code = "ERR_CONTRACT_NOT_FOUND", message = "Không tìm thấy hợp đồng." });
        }

        contract.Status = newStatus;
        if (newStatus == TenantContractStatus.Active && !contract.SignedAtUtc.HasValue)
        {
            contract.SignedAtUtc = DateTime.UtcNow;
            contract.DigitalSignatureHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{contract.ContractNumber}-{contract.TenantId}-{DateTime.UtcNow:O}")));
        }

        if (!string.IsNullOrWhiteSpace(request.Note))
        {
            contract.Notes = string.IsNullOrWhiteSpace(contract.Notes)
                ? $"[{DateTime.UtcNow:dd/MM/yyyy HH:mm}] {request.Note}"
                : $"{contract.Notes}\n[{DateTime.UtcNow:dd/MM/yyyy HH:mm}] {request.Note}";
        }

        contract.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            id = contract.Id,
            contractNumber = contract.ContractNumber,
            status = contract.Status.ToString(),
            signedAtUtc = contract.SignedAtUtc,
            notes = contract.Notes
        });
    }
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
}
