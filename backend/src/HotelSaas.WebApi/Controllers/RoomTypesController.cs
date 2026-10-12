using HotelSaas.Application.Common.Models;
using HotelSaas.Application.RoomTypes.Commands.CreateRoomType;
using HotelSaas.Application.RoomTypes.Commands.DeleteRoomType;
using HotelSaas.Application.RoomTypes.Commands.UpdateRoomType;
using HotelSaas.Application.RoomTypes.DTOs;
using HotelSaas.Application.RoomTypes.Queries.GetRoomTypeById;
using HotelSaas.Application.RoomTypes.Queries.GetRoomTypes;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages room types for the property including creation, retrieval, updates, and deletion.
/// </summary>
[ApiController]
[Route("api/room-types")]
[Produces("application/json")]
[Authorize]
public sealed class RoomTypesController : ControllerBase
{
    private readonly ISender _mediator;

    /// <summary>
    /// Initializes a new instance of <see cref="RoomTypesController"/>.
    /// </summary>
    /// <param name="mediator">MediatR sender for dispatching commands and queries.</param>
    public RoomTypesController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Creates a new room type for the current tenant.
    /// </summary>
    /// <param name="command">Room type creation payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The newly created room type.</returns>
    /// <response code="201">Room type created successfully.</response>
    /// <response code="400">Validation errors in the request body.</response>
    /// <response code="409">Room type code already exists.</response>
    [HttpPost]
    [RequirePermission("ROOM_TYPES", PermissionAction.Create)]
    [ProducesResponseType(typeof(RoomTypeDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateRoomTypeCommand command,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Retrieves a paginated list of room types with optional keyword search.
    /// </summary>
    /// <param name="search">Optional keyword search matching room type name or code.</param>
    /// <param name="page">1-based page number (default: 1).</param>
    /// <param name="pageSize">Number of items per page (default: 20).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Paginated result of room types.</returns>
    /// <response code="200">List of room types returned successfully.</response>
    [HttpGet]
    [RequirePermission("ROOM_TYPES", PermissionAction.Read)]
    [ProducesResponseType(typeof(PagedResult<RoomTypeDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetRoomTypesQuery(search, page, pageSize), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves a single room type by its identifier.
    /// </summary>
    /// <param name="id">The unique identifier of the room type.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The room type details, or 404 if not found.</returns>
    /// <response code="200">Room type found and returned.</response>
    /// <response code="404">Room type not found.</response>
    [HttpGet("{id:guid}")]
    [RequirePermission("ROOM_TYPES", PermissionAction.Read)]
    [ProducesResponseType(typeof(RoomTypeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetRoomTypeByIdQuery(id), cancellationToken);
        if (result is null)
        {
            return NotFound();
        }

        return Ok(result);
    }

    /// <summary>
    /// Updates an existing room type.
    /// </summary>
    /// <param name="id">The unique identifier of the room type to update.</param>
    /// <param name="command">Updated room type payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The updated room type.</returns>
    /// <response code="200">Room type updated successfully.</response>
    /// <response code="400">Validation errors or ID mismatch.</response>
    /// <response code="404">Room type not found.</response>
    /// <response code="409">Room type code already exists for another room type.</response>
    [HttpPut("{id:guid}")]
    [RequirePermission("ROOM_TYPES", PermissionAction.Update)]
    [ProducesResponseType(typeof(RoomTypeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(
        [FromRoute] Guid id,
        [FromBody] UpdateRoomTypeCommand command,
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
    /// Deletes a room type by identifier.
    /// </summary>
    /// <param name="id">The unique identifier of the room type to delete.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>No content on success.</returns>
    /// <response code="204">Room type deleted successfully.</response>
    /// <response code="404">Room type not found.</response>
    /// <response code="409">Room type cannot be deleted because rooms are currently using it.</response>
    [HttpDelete("{id:guid}")]
    [RequirePermission("ROOM_TYPES", PermissionAction.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(
        [FromRoute] Guid id,
        CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteRoomTypeCommand(id), cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Retrieves active rate schedules for a room type.
    /// </summary>
    [HttpGet("{id:guid}/rates")]
    [RequirePermission("ROOM_TYPES", PermissionAction.Read)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<HotelSaas.Application.RoomTypes.DTOs.RoomTypeRateDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRates(
        [FromRoute] Guid id,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new HotelSaas.Application.RoomTypes.Queries.GetRoomTypeRates.GetRoomTypeRatesQuery(id, propertyId), cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Retrieves rate audit history and interval splitting trail for a room type.
    /// </summary>
    [HttpGet("{id:guid}/rates/history")]
    [RequirePermission("ROOM_TYPES", PermissionAction.Read)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<HotelSaas.Application.RoomTypes.DTOs.RoomTypeRateAuditDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRateHistory(
        [FromRoute] Guid id,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new HotelSaas.Application.RoomTypes.Queries.GetRoomTypeRateHistory.GetRoomTypeRateHistoryQuery(id, propertyId), cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Configures or interval-splits a versioned rate schedule for a room type.
    /// </summary>
    [HttpPost("{id:guid}/rates")]
    [RequirePermission("ROOM_TYPES", PermissionAction.Update)]
    [ProducesResponseType(typeof(ApiResponse<HotelSaas.Application.RoomTypes.DTOs.RoomTypeRateDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateRate(
        [FromRoute] Guid id,
        [FromBody] HotelSaas.Application.RoomTypes.Commands.CreateRoomTypeRate.CreateRoomTypeRateCommand command,
        CancellationToken cancellationToken)
    {
        var finalCommand = command with { RoomTypeId = id };
        var result = await _mediator.Send(finalCommand, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, ApiResponse.Ok(result, "Cấu hình bảng giá thành công."));
    }
}
