using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Rooms.Commands.CreateRoom;
using HotelSaas.Application.Rooms.Commands.DeleteRoom;
using HotelSaas.Application.Rooms.Commands.UpdateRoom;
using HotelSaas.Application.Rooms.Commands.UpdateRoomStatus;
using HotelSaas.Application.Rooms.DTOs;
using HotelSaas.Application.Rooms.Queries.GetRoomById;
using HotelSaas.Application.Rooms.Queries.GetRooms;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages physical rooms including creation, retrieval, updates, status changes, and deletion.
/// </summary>
[ApiController]
[Route("api/rooms")]
[Produces("application/json")]
[Authorize]
public sealed class RoomsController : ControllerBase
{
    private readonly ISender _mediator;

    /// <summary>
    /// Initializes a new instance of <see cref="RoomsController"/>.
    /// </summary>
    /// <param name="mediator">MediatR sender for dispatching commands and queries.</param>
    public RoomsController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Creates a new physical room in the property.
    /// </summary>
    /// <param name="command">Room creation payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The newly created room details.</returns>
    /// <response code="201">Room created successfully.</response>
    /// <response code="400">Validation errors in the request body.</response>
    /// <response code="404">Specified room type does not exist.</response>
    /// <response code="409">Room number already exists.</response>
    [HttpPost]
    [RequirePermission("ROOMS", PermissionAction.Create)]
    [ProducesResponseType(typeof(RoomDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateRoomCommand command,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Retrieves a paginated list of rooms with optional filters.
    /// </summary>
    /// <param name="search">Optional keyword search matching room number.</param>
    /// <param name="roomTypeId">Optional filter by room type identifier.</param>
    /// <param name="status">Optional filter by room status.</param>
    /// <param name="floor">Optional filter by floor number.</param>
    /// <param name="isActive">Optional filter by active status.</param>
    /// <param name="createdFromUtc">Optional filter by creation start timestamp (inclusive, UTC).</param>
    /// <param name="createdToUtc">Optional filter by creation end timestamp (exclusive, UTC).</param>
    /// <param name="createdFrom">Backwards compatibility alias for createdFromUtc.</param>
    /// <param name="createdTo">Backwards compatibility alias for createdToUtc.</param>
    /// <param name="page">1-based page number (default: 1).</param>
    /// <param name="pageSize">Number of items per page (default: 20).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paginated result of rooms.</returns>
    /// <response code="200">List of rooms returned successfully.</response>
    [HttpGet]
    [RequirePermission("ROOMS", PermissionAction.Read)]
    [ProducesResponseType(typeof(PagedResult<RoomDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] string? search,
        [FromQuery] Guid? roomTypeId,
        [FromQuery] RoomStatus? status,
        [FromQuery] int? floor,
        [FromQuery] bool? isActive,
        [FromQuery] DateTime? createdFromUtc,
        [FromQuery] DateTime? createdToUtc,
        [FromQuery] DateTime? createdFrom,
        [FromQuery] DateTime? createdTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var fromUtc = createdFromUtc ?? createdFrom;
        var toUtc = createdToUtc ?? createdTo;
        var query = new GetRoomsQuery(
            Search: search,
            RoomTypeId: roomTypeId,
            Status: status,
            Floor: floor,
            IsActive: isActive,
            Page: page,
            PageSize: pageSize,
            CreatedFromUtc: fromUtc,
            CreatedToUtc: toUtc);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves a single room by its identifier.
    /// </summary>
    /// <param name="id">The unique identifier of the room.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The room details, or 404 if not found.</returns>
    /// <response code="200">Room found and returned.</response>
    /// <response code="404">Room not found.</response>
    [HttpGet("{id:guid}")]
    [RequirePermission("ROOMS", PermissionAction.Read)]
    [ProducesResponseType(typeof(RoomDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetRoomByIdQuery(id), cancellationToken);
        if (result is null)
        {
            return NotFound();
        }

        return Ok(result);
    }

    /// <summary>
    /// Updates an existing room.
    /// </summary>
    /// <param name="id">The unique identifier of the room to update.</param>
    /// <param name="command">Updated room payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The updated room details.</returns>
    /// <response code="200">Room updated successfully.</response>
    /// <response code="400">Validation errors or ID mismatch.</response>
    /// <response code="404">Room or room type not found.</response>
    /// <response code="409">Room number already exists for another room.</response>
    [HttpPut("{id:guid}")]
    [RequirePermission("ROOMS", PermissionAction.Update)]
    [ProducesResponseType(typeof(RoomDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        [FromRoute] Guid id,
        [FromBody] UpdateRoomCommand command,
        CancellationToken cancellationToken)
    {
        if (command.Id != Guid.Empty && id != command.Id)
        {
            return BadRequest("ID trong URL không khớp với ID trong body.");
        }

        var cmd = command.Id == Guid.Empty ? command with { Id = id } : command;
        var result = await _mediator.Send(cmd, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Deletes a room by identifier.
    /// </summary>
    /// <param name="id">The unique identifier of the room to delete.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>No content on success.</returns>
    /// <response code="204">Room deleted successfully.</response>
    /// <response code="404">Room not found.</response>
    /// <response code="409">Room cannot be deleted because it has active reservations.</response>
    [HttpDelete("{id:guid}")]
    [RequirePermission("ROOMS", PermissionAction.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteRoomCommand(id), cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Updates the housekeeping or occupancy status of a specific room.
    /// </summary>
    /// <param name="id">The unique identifier of the room.</param>
    /// <param name="request">The status update payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The updated room details.</returns>
    /// <response code="200">Room status updated successfully.</response>
    /// <response code="404">Room not found.</response>
    [HttpPatch("{id:guid}/status")]
    [RequirePermission("ROOMS", PermissionAction.Update)]
    [ProducesResponseType(typeof(RoomDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateStatus(
        [FromRoute] Guid id,
        [FromBody] UpdateRoomStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null || !request.ExpectedOldStatus.HasValue)
        {
            throw new BadRequestException("ERR_VALIDATION", "Trạng thái mong đợi cũ (ExpectedOldStatus) là bắt buộc.");
        }

        var result = await _mediator.Send(new UpdateRoomStatusCommand(id, request.Status, request.ExpectedOldStatus), cancellationToken);
        return Ok(result);
    }
}
