using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Notifications.Commands.DeleteNotification;
using HotelSaas.Application.Notifications.Commands.MarkAllNotificationsRead;
using HotelSaas.Application.Notifications.Commands.MarkNotificationRead;
using HotelSaas.Application.Notifications.DTOs;
using HotelSaas.Application.Notifications.Queries.GetNotifications;
using HotelSaas.Application.Notifications.Queries.GetUnreadNotificationCount;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// User-scoped REST persistence endpoints for in-app notifications.
/// Strictly filtered by authenticated UserId and verified TenantId inside MediatR handlers.
/// </summary>
[Authorize]
[ApiController]
[Route("api/notifications")]
[Produces("application/json")]
public sealed class NotificationsController : ControllerBase
{
    private readonly ISender _mediator;

    public NotificationsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<NotificationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNotifications(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool unreadOnly = false,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetNotificationsQuery(page, pageSize, unreadOnly), cancellationToken);
        return Ok(result);
    }

    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(UnreadNotificationCountDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnreadCount(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetUnreadNotificationCountQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpPatch("{id:guid}/read")]
    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(typeof(NotificationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new MarkNotificationReadCommand(id), cancellationToken);
        return Ok(result);
    }

    [HttpPost("read-all")]
    [HttpPatch("read-all")]
    [ProducesResponseType(typeof(MarkAllNotificationsReadResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllAsRead(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new MarkAllNotificationsReadCommand(), cancellationToken);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteNotification(Guid id, CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteNotificationCommand(id), cancellationToken);
        return NoContent();
    }
}
