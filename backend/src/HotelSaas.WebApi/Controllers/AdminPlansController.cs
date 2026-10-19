using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Quản trị gói cước SaaS dành cho Quản trị viên hệ thống (SuperAdmin / PlatformAdmin).
/// Hỗ trợ CRUD cấu hình gói, định mức tài nguyên (Phòng, Cơ sở, Nhân viên), tính năng và trạng thái kích hoạt.
/// </summary>
[ApiController]
[Route("api/admin/plans")]
[Produces("application/json")]
public sealed class AdminPlansController : ControllerBase
{
    private readonly IApplicationDbContext _context;

    public AdminPlansController(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    /// <summary>
    /// Danh sách tất cả các gói dịch vụ phần mềm kèm thống kê doanh thu và số khách sạn đang sử dụng.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<AdminPlanItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllPlans(CancellationToken cancellationToken)
    {
        var plans = await _context.SubscriptionPlans
            .AsNoTracking()
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.MonthlyPrice)
            .ToListAsync(cancellationToken);

        // Đếm số lượng tenant theo từng gói
        var subscriptions = await _context.Subscriptions
            .AsNoTracking()
            .Where(s => s.Status == Domain.Enums.SubscriptionStatus.Active)
            .ToListAsync(cancellationToken);

        var result = plans.Select(p =>
        {
            var features = string.IsNullOrWhiteSpace(p.FeaturesJson)
                ? new List<string>()
                : JsonSerializer.Deserialize<List<string>>(p.FeaturesJson) ?? new List<string>();

            // Ước tính subscriber count dựa trên Tier name hoặc Plan Code
            var subscriberCount = subscriptions.Count(s =>
                s.Tier.ToString().Equals(p.Code, StringComparison.OrdinalIgnoreCase) ||
                (p.Code == "STARTER" && s.Tier == Domain.Enums.SubscriptionTier.Basic) ||
                (p.Code == "PRO" && s.Tier == Domain.Enums.SubscriptionTier.Pro) ||
                (p.Code == "ENTERPRISE" && s.Tier == Domain.Enums.SubscriptionTier.Enterprise));

            return new AdminPlanItemDto
            {
                Id = p.Id,
                Code = p.Code,
                Name = p.Name,
                Description = p.Description,
                MonthlyPrice = p.MonthlyPrice,
                YearlyPrice = p.YearlyPrice,
                MaxRooms = p.MaxRooms,
                MaxProperties = p.MaxProperties,
                MaxStaff = p.MaxStaff,
                HasVnPay = p.HasVnPay,
                HasAdvancedReports = p.HasAdvancedReports,
                IsActive = p.IsActive,
                IsPopular = p.IsPopular,
                SortOrder = p.SortOrder,
                Features = features,
                ActiveTenantsCount = subscriberCount,
                EstimatedMonthlyRevenue = subscriberCount * p.MonthlyPrice
            };
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Xem chi tiết một gói cước theo Id.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AdminPlanItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPlanById(Guid id, CancellationToken cancellationToken)
    {
        var plan = await _context.SubscriptionPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (plan == null)
        {
            return NotFound(new { code = "ERR_PLAN_NOT_FOUND", message = "Không tìm thấy thông tin gói dịch vụ." });
        }

        var features = string.IsNullOrWhiteSpace(plan.FeaturesJson)
            ? new List<string>()
            : JsonSerializer.Deserialize<List<string>>(plan.FeaturesJson) ?? new List<string>();

        var dto = new AdminPlanItemDto
        {
            Id = plan.Id,
            Code = plan.Code,
            Name = plan.Name,
            Description = plan.Description,
            MonthlyPrice = plan.MonthlyPrice,
            YearlyPrice = plan.YearlyPrice,
            MaxRooms = plan.MaxRooms,
            MaxProperties = plan.MaxProperties,
            MaxStaff = plan.MaxStaff,
            HasVnPay = plan.HasVnPay,
            HasAdvancedReports = plan.HasAdvancedReports,
            IsActive = plan.IsActive,
            IsPopular = plan.IsPopular,
            SortOrder = plan.SortOrder,
            Features = features
        };

        return Ok(dto);
    }

    /// <summary>
    /// Tạo mới một gói cước SaaS trong hệ thống.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(AdminPlanItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreatePlan([FromBody] SavePlanRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { code = "ERR_INVALID_INPUT", message = "Mã gói và Tên gói không được để trống." });
        }

        var codeUpper = request.Code.Trim().ToUpperInvariant();
        var exists = await _context.SubscriptionPlans
            .AnyAsync(p => p.Code == codeUpper, cancellationToken);

        if (exists)
        {
            return BadRequest(new { code = "ERR_PLAN_CODE_EXISTS", message = $"Mã gói '{codeUpper}' đã tồn tại trong hệ thống." });
        }

        var plan = new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Code = codeUpper,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            MonthlyPrice = request.MonthlyPrice,
            YearlyPrice = request.YearlyPrice > 0 ? request.YearlyPrice : request.MonthlyPrice * 10,
            MaxRooms = request.MaxRooms,
            MaxProperties = Math.Max(1, request.MaxProperties),
            MaxStaff = Math.Max(1, request.MaxStaff),
            HasVnPay = request.HasVnPay,
            HasAdvancedReports = request.HasAdvancedReports,
            IsActive = request.IsActive,
            IsPopular = request.IsPopular,
            SortOrder = request.SortOrder,
            FeaturesJson = request.Features != null && request.Features.Count > 0
                ? JsonSerializer.Serialize(request.Features)
                : null,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.SubscriptionPlans.Add(plan);
        await _context.SaveChangesAsync(cancellationToken);

        var createdDto = new AdminPlanItemDto
        {
            Id = plan.Id,
            Code = plan.Code,
            Name = plan.Name,
            Description = plan.Description,
            MonthlyPrice = plan.MonthlyPrice,
            YearlyPrice = plan.YearlyPrice,
            MaxRooms = plan.MaxRooms,
            MaxProperties = plan.MaxProperties,
            MaxStaff = plan.MaxStaff,
            HasVnPay = plan.HasVnPay,
            HasAdvancedReports = plan.HasAdvancedReports,
            IsActive = plan.IsActive,
            IsPopular = plan.IsPopular,
            SortOrder = plan.SortOrder,
            Features = request.Features ?? new List<string>()
        };

        return CreatedAtAction(nameof(GetPlanById), new { id = plan.Id }, createdDto);
    }

    /// <summary>
    /// Cập nhật thông tin gói cước, giá, định mức và quyền hạn.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(AdminPlanItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePlan(Guid id, [FromBody] SavePlanRequest request, CancellationToken cancellationToken)
    {
        var plan = await _context.SubscriptionPlans
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (plan == null)
        {
            return NotFound(new { code = "ERR_PLAN_NOT_FOUND", message = "Không tìm thấy gói cước để cập nhật." });
        }

        plan.Name = request.Name.Trim();
        plan.Description = request.Description?.Trim();
        plan.MonthlyPrice = request.MonthlyPrice;
        plan.YearlyPrice = request.YearlyPrice > 0 ? request.YearlyPrice : request.MonthlyPrice * 10;
        plan.MaxRooms = request.MaxRooms;
        plan.MaxProperties = Math.Max(1, request.MaxProperties);
        plan.MaxStaff = Math.Max(1, request.MaxStaff);
        plan.HasVnPay = request.HasVnPay;
        plan.HasAdvancedReports = request.HasAdvancedReports;
        plan.IsActive = request.IsActive;
        plan.IsPopular = request.IsPopular;
        plan.SortOrder = request.SortOrder;
        plan.FeaturesJson = request.Features != null && request.Features.Count > 0
            ? JsonSerializer.Serialize(request.Features)
            : null;
        plan.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new AdminPlanItemDto
        {
            Id = plan.Id,
            Code = plan.Code,
            Name = plan.Name,
            Description = plan.Description,
            MonthlyPrice = plan.MonthlyPrice,
            YearlyPrice = plan.YearlyPrice,
            MaxRooms = plan.MaxRooms,
            MaxProperties = plan.MaxProperties,
            MaxStaff = plan.MaxStaff,
            HasVnPay = plan.HasVnPay,
            HasAdvancedReports = plan.HasAdvancedReports,
            IsActive = plan.IsActive,
            IsPopular = plan.IsPopular,
            SortOrder = plan.SortOrder,
            Features = request.Features ?? new List<string>()
        });
    }

    /// <summary>
    /// Chuyển đổi trạng thái kích hoạt / vô hiệu hóa gói cước.
    /// </summary>
    [HttpPatch("{id:guid}/toggle-active")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TogglePlanActive(Guid id, CancellationToken cancellationToken)
    {
        var plan = await _context.SubscriptionPlans
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (plan == null)
        {
            return NotFound(new { code = "ERR_PLAN_NOT_FOUND", message = "Không tìm thấy gói cước." });
        }

        plan.IsActive = !plan.IsActive;
        plan.UpdatedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { id = plan.Id, code = plan.Code, isActive = plan.IsActive });
    }
}

public sealed class AdminPlanItemDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal MonthlyPrice { get; set; }
    public decimal YearlyPrice { get; set; }
    public int MaxRooms { get; set; }
    public int MaxProperties { get; set; }
    public int MaxStaff { get; set; }
    public bool HasVnPay { get; set; }
    public bool HasAdvancedReports { get; set; }
    public bool IsActive { get; set; }
    public bool IsPopular { get; set; }
    public int SortOrder { get; set; }
    public List<string> Features { get; set; } = new();
    public int ActiveTenantsCount { get; set; }
    public decimal EstimatedMonthlyRevenue { get; set; }
}

public sealed class SavePlanRequest
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal MonthlyPrice { get; set; }
    public decimal YearlyPrice { get; set; }
    public int MaxRooms { get; set; }
    public int MaxProperties { get; set; } = 1;
    public int MaxStaff { get; set; } = 3;
    public bool HasVnPay { get; set; }
    public bool HasAdvancedReports { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsPopular { get; set; }
    public int SortOrder { get; set; }
    public List<string>? Features { get; set; }
}
