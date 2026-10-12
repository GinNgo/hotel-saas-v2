using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Properties.Commands.UpdatePropertyPolicies;
using HotelSaas.Application.Properties.DTOs;
using HotelSaas.Application.Properties.Queries.GetPropertyPolicies;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages branch properties and operational policy configurations.
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
