using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Application.Platform.Queries.GetDashboardSummary;
using HotelSaas.Application.Platform.Queries.GetPlatformOverview;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Exposes separate Platform SuperAdmin overview analytics and Property/Tenant PMS operational summary endpoints.
/// </summary>
[Authorize]
[ApiController]
[Route("api")]
[Produces("application/json")]
public sealed class PlatformOverviewController : ControllerBase
{
    private readonly ISender _mediator;

    public PlatformOverviewController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    [HttpGet("platform/overview")]
    [Authorize(Roles = "SuperAdmin")]
    [ProducesResponseType(typeof(PlatformOverviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPlatformOverview(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetPlatformOverviewQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpGet("dashboard/summary")]
    [RequirePermission("DASHBOARD", PermissionAction.Read)]
    [ProducesResponseType(typeof(DashboardSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDashboardSummary(
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetDashboardSummaryQuery(propertyId), cancellationToken);
        return Ok(result);
    }
}
