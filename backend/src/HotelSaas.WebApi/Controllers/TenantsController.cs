using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.SupportGrants.Commands.CreateSupportGrant;
using HotelSaas.Application.SupportGrants.Commands.RevokeSupportGrant;
using HotelSaas.Application.SupportGrants.DTOs;
using HotelSaas.Application.SupportGrants.Queries.GetTenantSupportGrants;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Tenant Owner endpoints for granting, revoking, and auditing time-boxed SupportAccessGrants (SDD-05 D24).
/// </summary>
[Authorize]
[ApiController]
[Route("api/tenants")]
[Produces("application/json")]
public sealed class TenantsController : ControllerBase
{
    private readonly ISender _mediator;

    public TenantsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    [HttpGet("current/support-grants")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(IReadOnlyList<SupportAccessGrantDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentSupportGrants(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetTenantSupportGrantsQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpGet("current/support-grants/audit-logs")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(IReadOnlyList<SupportAuditLogDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCurrentSupportAuditLogs(
        [FromQuery] Guid? grantId,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetTenantSupportAuditLogsQuery(grantId), cancellationToken);
        return Ok(result);
    }

    [HttpGet("current/support-users")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(IReadOnlyList<SupportUserOptionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAvailableSupportUsers(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetAvailableSupportUsersQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpPost("current/support-grants")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Update)]
    [ProducesResponseType(typeof(SupportAccessGrantDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateSupportGrant(
        [FromBody] CreateSupportGrantRequest request,
        CancellationToken cancellationToken)
    {
        var created = await _mediator.Send(new CreateSupportGrantCommand(
            request.TargetSupportUserId,
            request.Scope,
            request.Reason,
            request.ExpiresAtUtc), cancellationToken);

        return CreatedAtAction(nameof(GetCurrentSupportGrants), null, created);
    }

    [HttpPost("current/support-grants/{grantId:guid}/revoke")]
    [RequirePermission("SUBSCRIPTIONS", PermissionAction.Update)]
    [ProducesResponseType(typeof(SupportAccessGrantDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RevokeSupportGrant(
        Guid grantId,
        [FromBody] RevokeSupportGrantRequest? request,
        CancellationToken cancellationToken)
    {
        var revoked = await _mediator.Send(new RevokeSupportGrantCommand(grantId, request?.Reason), cancellationToken);
        return Ok(revoked);
    }
}

public sealed record CreateSupportGrantRequest(
    Guid TargetSupportUserId,
    string Scope,
    string Reason,
    DateTime ExpiresAtUtc
);

public sealed record RevokeSupportGrantRequest(
    string? Reason = null
);
