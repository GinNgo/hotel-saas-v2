using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Application.Platform.Queries.GetDashboardSummary;
using HotelSaas.Application.Platform.Queries.GetPlatformAuditLogs;
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

    [HttpGet("platform/audit-logs")]
    [Authorize(Roles = "SuperAdmin")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AuditLogListItemDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPlatformAuditLogs(
        [FromQuery] Guid? tenantId = null,
        [FromQuery] Guid? propertyId = null,
        [FromQuery] Guid? userId = null,
        [FromQuery] string? action = null,
        [FromQuery] string? entityName = null,
        [FromQuery] Guid? entityId = null,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        var query = new GetPlatformAuditLogsQuery(
            TenantId: tenantId,
            PropertyId: propertyId,
            UserId: userId,
            Action: action,
            EntityName: entityName,
            EntityId: entityId,
            FromUtc: fromUtc ?? from,
            ToUtc: toUtc ?? to,
            Page: page,
            PageSize: pageSize,
            Search: search);

        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("platform/audit-logs/{id:guid}")]
    [Authorize(Roles = "SuperAdmin")]
    [ProducesResponseType(typeof(ApiResponse<AuditLogDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPlatformAuditLogById(
        [FromRoute] Guid id,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetPlatformAuditLogByIdQuery(id), cancellationToken);
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
