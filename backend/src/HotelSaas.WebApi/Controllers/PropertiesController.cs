using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Properties.Commands.CreateProperty;
using HotelSaas.Application.Properties.Commands.UpdateProperty;
using HotelSaas.Application.Properties.Commands.UpdatePropertyPolicies;
using HotelSaas.Application.Properties.DTOs;
using HotelSaas.Application.Properties.Queries.GetPropertyPolicies;
using HotelSaas.Application.Properties.Queries.GetTenantProperties;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages branch properties, chain overview, and operational policy configurations.
/// </summary>
[ApiController]
[Route("api/properties")]
[Produces("application/json")]
[Authorize]
public sealed class PropertiesController : ControllerBase
{
    private readonly ISender _mediator;

    public PropertiesController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Gets all branch properties belonging to the current tenant enterprise with operational metrics.
    /// </summary>
    [HttpGet]
    [RequirePermission("PROPERTIES", PermissionAction.Read)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<TenantPropertySummaryDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetProperties(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetTenantPropertiesQuery(), cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Creates a new branch property under the current tenant enterprise.
    /// </summary>
    [HttpPost]
    [RequirePermission("PROPERTIES", PermissionAction.Create)]
    [ProducesResponseType(typeof(ApiResponse<TenantPropertySummaryDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateProperty([FromBody] CreatePropertyCommand command, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse.Ok(result, "Tạo cơ sở lưu trú / chi nhánh thành công."));
    }

    /// <summary>
    /// Updates property branch details, accommodation type, tourist zone, and booking modes.
    /// </summary>
    [HttpPut("{id:guid}")]
    [RequirePermission("PROPERTIES", PermissionAction.Update)]
    [ProducesResponseType(typeof(ApiResponse<TenantPropertySummaryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProperty(
        [FromRoute] Guid id,
        [FromBody] UpdatePropertyCommand command,
        CancellationToken cancellationToken)
    {
        var finalCommand = command with { PropertyId = id };
        var result = await _mediator.Send(finalCommand, cancellationToken);
        return Ok(ApiResponse.Ok(result, "Cập nhật thông tin chi nhánh thành công."));
    }

    /// <summary>
    /// Retrieves operational policies, turnover buffer, and surcharges for a property branch.
    /// </summary>
    [HttpGet("{id:guid}/policies")]
    [RequirePermission("PROPERTIES", PermissionAction.Read)]
    [ProducesResponseType(typeof(ApiResponse<PropertyPoliciesDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPolicies([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetPropertyPoliciesQuery(id), cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Updates operational policies and surcharges for a property branch.
    /// </summary>
    [HttpPut("{id:guid}/policies")]
    [RequirePermission("PROPERTIES", PermissionAction.Update)]
    [ProducesResponseType(typeof(ApiResponse<PropertyPoliciesDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePolicies(
        [FromRoute] Guid id,
        [FromBody] UpdatePropertyPoliciesCommand command,
        CancellationToken cancellationToken)
    {
        var finalCommand = command with { PropertyId = id };
        var result = await _mediator.Send(finalCommand, cancellationToken);
        return Ok(ApiResponse.Ok(result, "Cập nhật chính sách chi nhánh thành công."));
    }
}
