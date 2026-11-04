using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Staff.Commands.CreateRole;
using HotelSaas.Application.Staff.Commands.CreateStaffMember;
using HotelSaas.Application.Staff.Commands.DeleteRole;
using HotelSaas.Application.Staff.Commands.DeleteStaffMember;
using HotelSaas.Application.Staff.Commands.UpdateRole;
using HotelSaas.Application.Staff.Commands.UpdateStaffMember;
using HotelSaas.Application.Staff.DTOs;
using HotelSaas.Application.Staff.Queries.GetPermissionFunctions;
using HotelSaas.Application.Staff.Queries.GetRolesWithPermissions;
using HotelSaas.Application.Staff.Queries.GetStaffMembers;
using HotelSaas.Application.Staff.Queries.GetStaffRoles;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Quản lý danh sách nhân sự, phân công chi nhánh, quản lý chức vụ và phân quyền ma trận CRUD (Staff & RBAC).
/// </summary>
[ApiController]
[Route("api/staff")]
[Produces("application/json")]
[Authorize]
public sealed class StaffController : ControllerBase
{
    private readonly ISender _mediator;

    public StaffController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Lấy danh sách nhân viên trong tổ chức lưu trú theo bộ lọc và phân trang.
    /// </summary>
    [HttpGet]
    [RequirePermission("STAFF", 1)]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<StaffMemberDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStaffMembers(
        [FromQuery] string? search,
        [FromQuery] Guid? propertyId,
        [FromQuery] StaffRole? staffRole,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetStaffMembersQuery
        {
            Search = search,
            PropertyId = propertyId,
            StaffRole = staffRole,
            IsActive = isActive,
            Page = page,
            PageSize = pageSize
        }, cancellationToken);

        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Lấy danh sách tóm tắt các vai trò RBAC có sẵn trong hệ thống và tổ chức.
    /// </summary>
    [HttpGet("roles")]
    [RequirePermission("STAFF", 1)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AccessRoleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStaffRoles(CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetStaffRolesQuery(), cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Lấy danh sách các chức năng quyền hệ thống hỗ trợ ma trận CRUD.
    /// </summary>
    [HttpGet("permissions/functions")]
    [RequirePermission("STAFF", 1)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PermissionFunctionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPermissionFunctions(CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetPermissionFunctionsQuery(), cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Lấy danh sách chi tiết các vai trò kèm ma trận quyền CRUD từng chức năng.
    /// </summary>
    [HttpGet("roles/detailed")]
    [RequirePermission("STAFF", 1)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<RoleDetailDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRolesWithPermissions(CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetRolesWithPermissionsQuery(), cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Tạo chức vụ mới cho tổ chức và cấu hình cấp quyền CRUD.
    /// </summary>
    [HttpPost("roles")]
    [RequirePermission("STAFF", 2)]
    [ProducesResponseType(typeof(ApiResponse<RoleDetailDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateRole(
        [FromBody] CreateRoleCommand command,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse.Ok(result, "Tạo chức vụ mới thành công."));
    }

    /// <summary>
    /// Cập nhật thông tin chức vụ và cấu hình quyền CRUD.
    /// </summary>
    [HttpPut("roles/{id:guid}")]
    [RequirePermission("STAFF", 4)]
    [ProducesResponseType(typeof(ApiResponse<RoleDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateRole(
        [FromRoute] Guid id,
        [FromBody] UpdateRoleCommand command,
        CancellationToken cancellationToken = default)
    {
        if (id != command.Id)
        {
            command = command with { Id = id };
        }

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(ApiResponse.Ok(result, "Cập nhật chức vụ thành công."));
    }

    /// <summary>
    /// Xóa chức vụ tùy biến khỏi tổ chức.
    /// </summary>
    [HttpDelete("roles/{id:guid}")]
    [RequirePermission("STAFF", 8)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteRole(
        [FromRoute] Guid id,
        CancellationToken cancellationToken = default)
    {
        await _mediator.Send(new DeleteRoleCommand(id), cancellationToken);
        return Ok(ApiResponse.Ok("Xóa chức vụ thành công."));
    }

    /// <summary>
    /// Thêm nhân viên mới vào tổ chức (gán chi nhánh hoặc phân công toàn chuỗi).
    /// </summary>
    [HttpPost]
    [RequirePermission("STAFF", 2)]
    [ProducesResponseType(typeof(ApiResponse<StaffMemberDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateStaffMember(
        [FromBody] CreateStaffMemberCommand command,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse.Ok(result, "Thêm nhân sự thành công."));
    }

    /// <summary>
    /// Cập nhật thông tin phân công chi nhánh, vai trò chức vụ hoặc kích hoạt tài khoản.
    /// </summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("STAFF", 4)]
    [ProducesResponseType(typeof(ApiResponse<StaffMemberDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateStaffMember(
        [FromRoute] Guid id,
        [FromBody] UpdateStaffMemberCommand command,
        CancellationToken cancellationToken = default)
    {
        if (id != command.Id)
        {
            command = command with { Id = id };
        }

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(ApiResponse.Ok(result, "Cập nhật nhân sự thành công."));
    }

    /// <summary>
    /// Xóa hoặc thu hồi phân công nhân sự khỏi tổ chức lưu trú.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [RequirePermission("STAFF", 8)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteStaffMember(
        [FromRoute] Guid id,
        CancellationToken cancellationToken = default)
    {
        await _mediator.Send(new DeleteStaffMemberCommand(id), cancellationToken);
        return Ok(ApiResponse.Ok("Thu hồi phân công nhân sự thành công."));
    }
}
