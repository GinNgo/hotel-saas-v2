using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Platform.Commands.ApprovePropertyPublish;
using HotelSaas.Application.Platform.Commands.ToggleTenantStatus;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Application.Platform.Queries.GetPlatformTenants;
using HotelSaas.Application.SupportGrants.Commands.LogSupportDiagnosticAccess;
using HotelSaas.Application.SupportGrants.DTOs;
using HotelSaas.Application.SupportGrants.Queries.GetPlatformSupportGrants;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Platform-level SuperAdmin endpoints for managing tenant lifecycle, branch publish approvals,
/// and temporary diagnostic access via time-boxed SupportAccessGrants (SDD-05 D24).
/// </summary>
[Authorize(Roles = "SuperAdmin")]
[ApiController]
[Route("api/platform")]
[Produces("application/json")]
public sealed class PlatformTenantsController : ControllerBase
{
    private readonly ISender _mediator;

    public PlatformTenantsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    [HttpGet("tenants")]
    [ProducesResponseType(typeof(IReadOnlyList<PlatformTenantDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTenants(
        [FromQuery] string? search,
        [FromQuery] TenantStatus? status,
        [FromQuery] bool? onlyPendingPublish,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new GetPlatformTenantsQuery(search, status, onlyPendingPublish),
            cancellationToken);
        return Ok(result);
    }

    [HttpPatch("tenants/{id:guid}/status")]
    [ProducesResponseType(typeof(ToggleTenantStatusResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleTenantStatus(
        Guid id,
        [FromBody] ToggleTenantStatusRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new ToggleTenantStatusCommand(id, request?.TargetStatus, request?.Reason),
            cancellationToken);
        return Ok(result);
    }

    [HttpPost("properties/{id:guid}/publish-approval")]
    [ProducesResponseType(typeof(ApprovePropertyPublishResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApprovePropertyPublish(
        Guid id,
        [FromBody] ApprovePropertyPublishRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new ApprovePropertyPublishCommand(id, request.IsPublished, request.Note),
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("support-grants")]
    [ProducesResponseType(typeof(IReadOnlyList<SupportAccessGrantDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSupportGrants(
        [FromQuery] Guid? tenantId,
        [FromQuery] bool onlyActive = false,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(
            new GetPlatformSupportGrantsQuery(tenantId, onlyActive),
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("support-grants/{grantId:guid}/diagnostics")]
    [ProducesResponseType(typeof(SupportDiagnosticSnapshotDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AccessGrantDiagnostics(
        Guid grantId,
        CancellationToken cancellationToken)
    {
        var resourcePath = HttpContext.Request.Path.Value ?? $"/api/platform/support-grants/{grantId}/diagnostics";
        var result = await _mediator.Send(
            new LogSupportDiagnosticAccessCommand(grantId, resourcePath),
            cancellationToken);
        return Ok(result);
    }
}

public sealed record ToggleTenantStatusRequest(
    TenantStatus? TargetStatus = null,
    string? Reason = null
);

public sealed record ApprovePropertyPublishRequest(
    bool IsPublished,
    string? Note = null
);
