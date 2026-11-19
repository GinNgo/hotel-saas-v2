using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Promotions.Commands.CreatePromotion;
using HotelSaas.Application.Promotions.Commands.TogglePromotionStatus;
using HotelSaas.Application.Promotions.Commands.UpdatePromotion;
using HotelSaas.Application.Promotions.DTOs;
using HotelSaas.Application.Promotions.Queries.GetPromotions;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages tenant-scoped promotional campaigns, discount codes, and activation status.
/// </summary>
[ApiController]
[Route("api/promotions")]
[Produces("application/json")]
[Authorize]
public sealed class PromotionsController : ControllerBase
{
    private readonly ISender _mediator;

    public PromotionsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Lists promotional campaigns for the current tenant with optional active/search filters.
    /// </summary>
    [HttpGet]
    [RequirePermission("PROMOTIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PromotionDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetList(
        [FromQuery] bool? isActive = null,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetPromotionsQuery(isActive, search), cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Creates a new promotional campaign with normalized unique code per tenant.
    /// </summary>
    [HttpPost]
    [RequirePermission("PROMOTIONS", PermissionAction.Create)]
    [ProducesResponseType(typeof(ApiResponse<PromotionDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreatePromotionCommand command,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse.Ok(result, "Tạo mã khuyến mãi thành công."));
    }

    /// <summary>
    /// Updates an existing promotional campaign for the current tenant.
    /// </summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("PROMOTIONS", PermissionAction.Update)]
    [ProducesResponseType(typeof(ApiResponse<PromotionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        [FromRoute] Guid id,
        [FromBody] UpdatePromotionCommand command,
        CancellationToken cancellationToken = default)
    {
        if (command.Id != Guid.Empty && command.Id != id)
        {
            return BadRequest(ApiResponse.Fail("ERR_ID_MISMATCH", "ID trong URL không khớp với ID trong dữ liệu gửi lên."));
        }

        var result = await _mediator.Send(command with { Id = id }, cancellationToken);
        return Ok(ApiResponse.Ok(result, "Cập nhật mã khuyến mãi thành công."));
    }

    /// <summary>
    /// Toggles or explicitly sets the active status of a promotional campaign.
    /// </summary>
    [HttpPatch("{id:guid}/toggle")]
    [RequirePermission("PROMOTIONS", PermissionAction.Update)]
    [ProducesResponseType(typeof(ApiResponse<PromotionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleStatus(
        [FromRoute] Guid id,
        [FromBody] TogglePromotionStatusRequest? request = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new TogglePromotionStatusCommand(id, request?.IsActive), cancellationToken);
        return Ok(ApiResponse.Ok(result, "Cập nhật trạng thái mã khuyến mãi thành công."));
    }
}

public sealed record TogglePromotionStatusRequest(bool? IsActive = null);
