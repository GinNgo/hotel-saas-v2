using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogById;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;
using HotelSaas.Application.Common.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Read-only endpoints for querying immutable system audit logs.
/// Restricted strictly to Owner and Manager roles within their verified tenant and property scope.
/// </summary>
[ApiController]
[Route("api/audit-logs")]
[Produces("application/json")]
[Authorize]
public sealed class AuditLogsController : ControllerBase
{
    private readonly ISender _mediator;

    public AuditLogsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Retrieves a paginated, newest-first list of audit logs filtered by date range, user, action, entity, and branch.
    /// </summary>
    /// <param name="propertyId">Optional branch filter. Required or auto-bound for branch-scoped Managers.</param>
    /// <param name="userId">Optional filter by actor UserId.</param>
    /// <param name="action">Optional filter by action ("Create", "Update", "Delete").</param>
    /// <param name="entityName">Optional filter by entity name (e.g., "RoomTypeRate", "PropertySurchargePolicy", "Invoice").</param>
    /// <param name="entityId">Optional filter by specific entity primary key.</param>
    /// <param name="fromUtc">Optional inclusive UTC start timestamp.</param>
    /// <param name="toUtc">Optional inclusive UTC end timestamp.</param>
    /// <param name="from">Optional alias for fromUtc.</param>
    /// <param name="to">Optional alias for toUtc.</param>
    /// <param name="page">1-based page number (default: 1).</param>
    /// <param name="pageSize">Items per page (default: 20, max: 100).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AuditLogListItemDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetList(
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
        CancellationToken cancellationToken = default)
    {
        var query = new GetAuditLogsQuery(
            PropertyId: propertyId,
            UserId: userId,
            Action: action,
            EntityName: entityName,
            EntityId: entityId,
            FromUtc: fromUtc ?? from,
            ToUtc: toUtc ?? to,
            Page: page,
            PageSize: pageSize);

        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves detailed information for a single audit log entry including sanitized OldValues and NewValues.
    /// </summary>
    /// <param name="id">Unique identifier of the audit log entry.</param>
    /// <param name="propertyId">Optional branch context verification parameter.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AuditLogDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(
        [FromRoute] Guid id,
        [FromQuery] Guid? propertyId = null,
        CancellationToken cancellationToken = default)
    {
        var query = new GetAuditLogByIdQuery(id, propertyId);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }
}

