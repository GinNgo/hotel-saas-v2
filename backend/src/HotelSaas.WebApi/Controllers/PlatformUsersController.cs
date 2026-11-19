using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Platform.Commands.CreatePlatformAdmin;
using HotelSaas.Application.Platform.Commands.TogglePlatformUserStatus;
using HotelSaas.Application.Platform.Commands.UpdatePlatformUserRole;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Application.Platform.Queries.GetPlatformUsers;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Platform-level SuperAdmin endpoints for IAM user directory inspection, SuperAdmin account provisioning,
/// account lock/unlock lifecycle, and global role governance.
/// </summary>
[Authorize(Roles = "SuperAdmin")]
[ApiController]
[Route("api/platform/users")]
[Produces("application/json")]
public sealed class PlatformUsersController : ControllerBase
{
    private readonly ISender _mediator;

    public PlatformUsersController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    [HttpGet]
    [ProducesResponseType(typeof(PlatformUsersResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search,
        [FromQuery] GlobalUserRole? role,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        return Ok(await _mediator.Send(
            new GetPlatformUsersQuery(search, role, isActive, page, pageSize),
            ct));
    }

    [HttpPost("admins")]
    [ProducesResponseType(typeof(PlatformUserDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateAdmin(
        [FromBody] CreatePlatformAdminRequest request,
        CancellationToken ct = default)
    {
        return StatusCode(
            StatusCodes.Status201Created,
            await _mediator.Send(
                new CreatePlatformAdminCommand(
                    request.Email ?? string.Empty,
                    request.FullName ?? string.Empty,
                    request.Password ?? string.Empty,
                    request.PhoneNumber),
                ct));
    }

    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(typeof(PlatformUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleStatus(
        Guid id,
        [FromBody] TogglePlatformUserStatusRequest? request,
        CancellationToken ct = default)
    {
        return Ok(await _mediator.Send(
            new TogglePlatformUserStatusCommand(id, request?.TargetIsActive, request?.Reason),
            ct));
    }

    [HttpPatch("{id:guid}/role")]
    [ProducesResponseType(typeof(PlatformUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRole(
        Guid id,
        [FromBody] UpdatePlatformUserRoleRequest request,
        CancellationToken ct = default)
    {
        return Ok(await _mediator.Send(
            new UpdatePlatformUserRoleCommand(id, request.TargetRole),
            ct));
    }
}

public sealed record CreatePlatformAdminRequest(
    string Email,
    string FullName,
    string Password,
    string? PhoneNumber = null
);

public sealed record TogglePlatformUserStatusRequest(
    bool? TargetIsActive = null,
    string? Reason = null
);

public sealed record UpdatePlatformUserRoleRequest(
    GlobalUserRole TargetRole
);
