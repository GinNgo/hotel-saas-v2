using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Housekeeping.Commands.AssignHousekeepingTask;
using HotelSaas.Application.Housekeeping.Commands.ClaimHousekeepingTask;
using HotelSaas.Application.Housekeeping.Commands.CompleteHousekeepingTask;
using HotelSaas.Application.Housekeeping.Commands.CreateHousekeepingTask;
using HotelSaas.Application.Housekeeping.Commands.StartHousekeepingTask;
using HotelSaas.Application.Housekeeping.DTOs;
using HotelSaas.Application.Housekeeping.Queries.GetHousekeepingStaff;
using HotelSaas.Application.Housekeeping.Queries.GetHousekeepingTasks;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages room housekeeping task queues, self-claiming (BR-HK06), assignment, and lifecycle transitions.
/// </summary>
[ApiController]
[Authorize]
[Route("api/housekeeping")]
public sealed class HousekeepingController : ControllerBase
{
    private readonly ISender _mediator;
    private readonly ICurrentPropertyService _propertyService;

    public HousekeepingController(ISender mediator, ICurrentPropertyService propertyService)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
    }

    [HttpGet]
    [RequirePermission("HOUSEKEEPING", PermissionAction.Read)]
    [ProducesResponseType(typeof(IReadOnlyList<HousekeepingTaskDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTasks(
        [FromQuery] Guid? propertyId,
        [FromQuery] HousekeepingTaskStatus? status = null,
        [FromQuery] HousekeepingPriority? priority = null,
        [FromQuery] bool? assignedToMe = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedPropertyId = ResolvePropertyId(propertyId);
        var result = await _mediator.Send(
            new GetHousekeepingTasksQuery(resolvedPropertyId, status, priority, assignedToMe),
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("staff")]
    [RequirePermission("HOUSEKEEPING", PermissionAction.Read)]
    [ProducesResponseType(typeof(IReadOnlyList<HousekeepingStaffOptionDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAssignableStaff(
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken = default)
    {
        var resolvedPropertyId = ResolvePropertyId(propertyId);
        var result = await _mediator.Send(new GetHousekeepingStaffQuery(resolvedPropertyId), cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [RequirePermission("HOUSEKEEPING", PermissionAction.Create)]
    [ProducesResponseType(typeof(HousekeepingTaskDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateTask(
        [FromBody] CreateHousekeepingTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        var resolvedPropertyId = ResolvePropertyId(request.PropertyId);
        var result = await _mediator.Send(
            new CreateHousekeepingTaskCommand(
                resolvedPropertyId,
                request.RoomId,
                request.Priority,
                request.Notes,
                request.AssignedToUserId),
            cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPost("{id:guid}/assign")]
    [RequirePermission("HOUSEKEEPING", PermissionAction.Update)]
    [ProducesResponseType(typeof(HousekeepingTaskDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> AssignTask(
        [FromRoute] Guid id,
        [FromBody] AssignHousekeepingTaskRequest request,
        [FromQuery] Guid? propertyId = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedPropertyId = ResolvePropertyId(propertyId ?? request.PropertyId);
        var result = await _mediator.Send(
            new AssignHousekeepingTaskCommand(id, resolvedPropertyId, request.AssignedToUserId),
            cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/claim")]
    [RequirePermission("HOUSEKEEPING", PermissionAction.Update)]
    [ProducesResponseType(typeof(HousekeepingTaskDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ClaimTask(
        [FromRoute] Guid id,
        [FromQuery] Guid? propertyId = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedPropertyId = ResolvePropertyId(propertyId);
        var result = await _mediator.Send(new ClaimHousekeepingTaskCommand(id, resolvedPropertyId), cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/start")]
    [RequirePermission("HOUSEKEEPING", PermissionAction.Update)]
    [ProducesResponseType(typeof(HousekeepingTaskDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> StartTask(
        [FromRoute] Guid id,
        [FromQuery] Guid? propertyId = null,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] StartHousekeepingTaskRequest? request = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedPropertyId = ResolvePropertyId(propertyId ?? request?.PropertyId);
        var result = await _mediator.Send(
            new StartHousekeepingTaskCommand(id, resolvedPropertyId, request?.Notes),
            cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/complete")]
    [RequirePermission("HOUSEKEEPING", PermissionAction.Update)]
    [ProducesResponseType(typeof(HousekeepingTaskDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> CompleteTask(
        [FromRoute] Guid id,
        [FromQuery] Guid? propertyId = null,
        [FromBody] CompleteHousekeepingTaskRequest? request = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedPropertyId = ResolvePropertyId(propertyId ?? request?.PropertyId);
        var result = await _mediator.Send(
            new CompleteHousekeepingTaskCommand(id, resolvedPropertyId, request?.Notes),
            cancellationToken);
        return Ok(result);
    }

    private Guid ResolvePropertyId(Guid? explicitPropertyId)
    {
        if (explicitPropertyId.HasValue && explicitPropertyId.Value != Guid.Empty)
        {
            return explicitPropertyId.Value;
        }

        return _propertyService.HeaderPropertyId
            ?? _propertyService.TokenPropertyId
            ?? Guid.Empty;
    }
}

public sealed record CreateHousekeepingTaskRequest(
    Guid RoomId,
    HousekeepingPriority Priority = HousekeepingPriority.Normal,
    string? Notes = null,
    Guid? AssignedToUserId = null,
    Guid? PropertyId = null
);

public sealed record AssignHousekeepingTaskRequest(
    Guid AssignedToUserId,
    Guid? PropertyId = null
);

public sealed record StartHousekeepingTaskRequest(
    string? Notes = null,
    Guid? PropertyId = null
);

public sealed record CompleteHousekeepingTaskRequest(
    string? Notes = null,
    Guid? PropertyId = null
);
