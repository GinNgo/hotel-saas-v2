using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Application.Platform.Plans;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Quản trị gói cước SaaS dành cho Quản trị viên hệ thống (SuperAdmin / PlatformAdmin).
/// Hỗ trợ CRUD cấu hình gói, định mức tài nguyên (Phòng, Cơ sở, Nhân viên), tính năng và trạng thái kích hoạt.
/// </summary>
[Authorize(Roles = "SuperAdmin")]
[ApiController]
[Route("api/admin/plans")]
[Produces("application/json")]
public sealed class AdminPlansController : ControllerBase
{
    private readonly ISender _mediator;

    public AdminPlansController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Danh sách tất cả các gói dịch vụ phần mềm kèm thống kê doanh thu và số khách sạn đang sử dụng.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<AdminPlanItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllPlans(CancellationToken cancellationToken)
    {
        var plans = await _mediator.Send(new GetAdminPlansQuery(), cancellationToken);
        return Ok(plans.Select(MapToLegacyItemDto).ToList());
    }

    /// <summary>
    /// Xem chi tiết một gói cước theo Id.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(AdminPlanItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPlanById(Guid id, CancellationToken cancellationToken)
    {
        var plan = await _mediator.Send(new GetAdminPlanByIdQuery(id), cancellationToken);
        return Ok(MapToLegacyItemDto(plan));
    }

    /// <summary>
    /// Tạo mới một gói cước SaaS trong hệ thống.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(AdminPlanItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreatePlan([FromBody] SavePlanRequest request, CancellationToken cancellationToken)
    {
        var created = await _mediator.Send(new CreateAdminPlanCommand(
            request.Code,
            request.Name,
            request.Description,
            request.MonthlyPrice,
            request.YearlyPrice,
            request.MaxRooms,
            request.MaxProperties,
            request.MaxStaff,
            request.HasVnPay,
            request.HasAdvancedReports,
            request.IsActive,
            request.IsPopular,
            request.SortOrder,
            request.Features), cancellationToken);

        var dto = MapToLegacyItemDto(created);
        return CreatedAtAction(nameof(GetPlanById), new { id = dto.Id }, dto);
    }

    /// <summary>
    /// Cập nhật thông tin gói cước, giá, định mức và quyền hạn.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(AdminPlanItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePlan(Guid id, [FromBody] SavePlanRequest request, CancellationToken cancellationToken)
    {
        var updated = await _mediator.Send(new UpdateAdminPlanCommand(
            id,
            request.Code,
            request.Name,
            request.Description,
            request.MonthlyPrice,
            request.YearlyPrice,
            request.MaxRooms,
            request.MaxProperties,
            request.MaxStaff,
            request.HasVnPay,
            request.HasAdvancedReports,
            request.IsActive,
            request.IsPopular,
            request.SortOrder,
            request.Features), cancellationToken);

        return Ok(MapToLegacyItemDto(updated));
    }

    /// <summary>
    /// Chuyển đổi trạng thái kích hoạt / vô hiệu hóa gói cước.
    /// </summary>
    [HttpPatch("{id:guid}/toggle-active")]
    [ProducesResponseType(typeof(AdminPlanItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> TogglePlanActive(Guid id, CancellationToken cancellationToken)
    {
        var toggled = await _mediator.Send(new ToggleAdminPlanActiveCommand(id), cancellationToken);
        return Ok(MapToLegacyItemDto(toggled));
    }

    private static AdminPlanItemDto MapToLegacyItemDto(AdminPlanDto dto) => new()
    {
        Id = dto.Id,
        Code = dto.Code,
        Name = dto.Name,
        Description = dto.Description,
        MonthlyPrice = dto.MonthlyPrice,
        YearlyPrice = dto.YearlyPrice,
        MaxRooms = dto.MaxRooms,
        MaxProperties = dto.MaxProperties,
        MaxStaff = dto.MaxStaff,
        HasVnPay = dto.HasVnPay,
        HasAdvancedReports = dto.HasAdvancedReports,
        IsActive = dto.IsActive,
        IsPopular = dto.IsPopular,
        SortOrder = dto.SortOrder,
        Features = dto.Features,
        ActiveTenantsCount = dto.ActiveTenantsCount,
        EstimatedMonthlyRevenue = dto.EstimatedMonthlyRevenue
    };
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
