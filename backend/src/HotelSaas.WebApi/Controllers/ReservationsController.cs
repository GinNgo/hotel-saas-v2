using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Payments.Queries.GetFolio;
using HotelSaas.Application.Reservations.Commands.CancelReservation;
using HotelSaas.Application.Reservations.Commands.CheckInReservation;
using HotelSaas.Application.Reservations.Commands.CheckOutReservation;
using HotelSaas.Application.Reservations.Commands.CreateReservation;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Queries.GetReservationById;
using HotelSaas.Application.Reservations.Queries.GetReservations;
using HotelSaas.Application.Reservations.Queries.GetRoomAvailability;
using HotelSaas.Application.Reservations.Queries.GetReservationCancellationPreview;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Application.Public.Commands.ConfirmGuestBooking;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Manages room reservations, availability calculation, and immutable quote snapshots.
/// </summary>
[ApiController]
[Route("api/reservations")]
[Produces("application/json")]
[Authorize]
public sealed class ReservationsController : ControllerBase
{
    private readonly ISender _mediator;

    public ReservationsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Creates a verified reservation for a specific room within the current property.
    /// </summary>
    /// <param name="command">Reservation creation request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The confirmed reservation details including immutable pricing snapshot.</returns>
    /// <response code="201">Reservation created successfully.</response>
    /// <response code="400">Validation error or total amount mismatch with current pricing.</response>
    /// <response code="404">Property, room, or room type not found.</response>
    /// <response code="409">Room is unavailable or conflicts with turnover buffer.</response>
    [HttpPost]
    [RequirePermission("RESERVATIONS", PermissionAction.Create)]
    [ProducesResponseType(typeof(ReservationDetailDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        [FromBody] CreateReservationCommand command,
        CancellationToken cancellationToken)
    {
        var idempotencyHeader = Request.Headers["Idempotency-Key"].ToString();
        if (string.IsNullOrWhiteSpace(idempotencyHeader))
        {
            idempotencyHeader = Request.Headers["X-Idempotency-Key"].ToString();
        }

        var effectiveCommand = !string.IsNullOrWhiteSpace(idempotencyHeader) && string.IsNullOrWhiteSpace(command.IdempotencyKey)
            ? command with { IdempotencyKey = idempotencyHeader.Trim() }
            : command;

        var result = await _mediator.Send(effectiveCommand, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Id, propertyId = result.PropertyId }, result);
    }

    /// <summary>
    /// Retrieves a paginated list of reservations for a property.
    /// </summary>
    [HttpGet]
    [RequirePermission("RESERVATIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList(
        [FromQuery] Guid propertyId,
        [FromQuery] ReservationStatus? status = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new GetReservationsQuery(propertyId, status, from, to, search, page, pageSize);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves detailed information for a single reservation including its immutable breakdown snapshot.
    /// </summary>
    [HttpGet("{id:guid}")]
    [RequirePermission("RESERVATIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(ReservationDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(
        [FromRoute] Guid id,
        [FromQuery] Guid propertyId,
        CancellationToken cancellationToken)
    {
        var query = new GetReservationByIdQuery(id, propertyId);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Checks room availability across physical rooms for a requested time interval, accounting for turnover buffer.
    /// </summary>
    [HttpGet("availability")]
    [RequirePermission("RESERVATIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(IReadOnlyList<RoomAvailabilityDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAvailability(
        [FromQuery] Guid propertyId,
        [FromQuery] RentalType rentalType,
        [FromQuery] DateTime startAtUtc,
        [FromQuery] DateTime endAtUtc,
        [FromQuery] Guid? roomTypeId = null,
        [FromQuery] DateOnly? checkInDate = null,
        [FromQuery] DateOnly? checkOutDate = null,
        CancellationToken cancellationToken = default)
    {
        var query = new GetRoomAvailabilityQuery(
            propertyId, rentalType, startAtUtc, endAtUtc, roomTypeId, checkInDate, checkOutDate);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Checks in a guest for a confirmed reservation, transitioning the reservation to CheckedIn and room to Occupied.
    /// </summary>
    [HttpPost("{id:guid}/check-in")]
    [RequirePermission("CHECK_IN_OUT", PermissionAction.Update)]
    [ProducesResponseType(typeof(ReservationDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CheckIn(
        [FromRoute] Guid id,
        [FromQuery] Guid propertyId,
        CancellationToken cancellationToken)
    {
        var command = new CheckInReservationCommand(id, propertyId);
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Checks out a guest from an active reservation, transitioning the reservation to CheckedOut and room to Dirty.
    /// </summary>
    [HttpPost("{id:guid}/check-out")]
    [RequirePermission("CHECK_IN_OUT", PermissionAction.Update)]
    [ProducesResponseType(typeof(ReservationDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CheckOut(
        [FromRoute] Guid id,
        [FromQuery] Guid propertyId,
        CancellationToken cancellationToken)
    {
        var command = new CheckOutReservationCommand(id, propertyId);
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Cancels a confirmed or pending reservation prior to check-in, recording the cancellation reason.
    /// </summary>
    /// <summary>
    /// Previews the financial and policy impact of cancelling a reservation for staff before confirming.
    /// Completely read-only calculation.
    /// </summary>
    [HttpGet("{id:guid}/cancellation-preview")]
    [RequirePermission("RESERVATIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(CancellationEstimateResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCancellationPreview(
        [FromRoute] Guid id,
        [FromQuery] Guid propertyId,
        CancellationToken cancellationToken)
    {
        var query = new GetReservationCancellationPreviewQuery(id, propertyId);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("RESERVATIONS", PermissionAction.Update)]
    [ProducesResponseType(typeof(ReservationDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Cancel(
        [FromRoute] Guid id,
        [FromQuery] Guid propertyId,
        [FromBody] CancelReservationRequest? request,
        CancellationToken cancellationToken)
    {
        var command = new CancelReservationCommand(id, propertyId, request?.Reason);
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves the financial folio statement for a reservation, including total charges, completed payments, and balance.
    /// </summary>
    [HttpGet("{id:guid}/folio")]
    [RequirePermission("RESERVATIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(FolioDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFolio(
        [FromRoute] Guid id,
        [FromQuery] Guid propertyId,
        CancellationToken cancellationToken)
    {
        var query = new GetFolioQuery(id, propertyId);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Confirms a pending reservation (e.g. online hold) upon receiving authorized manual deposit collection by staff.
    /// </summary>
    [HttpPost("{id:guid}/confirm")]
    [RequirePermission("RESERVATIONS", PermissionAction.Update)]
    [RequirePermission("PAYMENTS", PermissionAction.Create)]
    [ProducesResponseType(typeof(GuestBookingDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ConfirmReservation(
        [FromRoute] Guid id,
        [FromQuery] Guid propertyId,
        [FromBody] ConfirmGuestBookingRequest request,
        CancellationToken cancellationToken)
    {
        var idempotencyKey = request?.IdempotencyKey;
        if (string.IsNullOrWhiteSpace(idempotencyKey) &&
            Request.Headers.TryGetValue("Idempotency-Key", out var headerKey) &&
            !string.IsNullOrWhiteSpace(headerKey))
        {
            idempotencyKey = headerKey.ToString();
        }

        if (request == null || request.PaymentAmount == null || request.PaymentAmount <= 0)
        {
            return BadRequest(new { code = "ERR_INVALID_PAYMENT_AMOUNT", message = "Số tiền thanh toán phải lớn hơn 0." });
        }

        if (string.IsNullOrWhiteSpace(request.TransactionRef))
        {
            return BadRequest(new { code = "ERR_TRANSACTION_REF_REQUIRED", message = "Yêu cầu mã giao dịch hoặc chứng từ nộp cọc hợp lệ." });
        }

        if (!Enum.TryParse<PaymentMethod>(request.PaymentMethod, true, out var method) || (method != PaymentMethod.Cash && method != PaymentMethod.BankTransfer))
        {
            return BadRequest(new { code = "ERR_INVALID_PAYMENT_METHOD", message = "Chỉ chấp nhận phương thức thanh toán Tiền mặt (Cash) hoặc Chuyển khoản (BankTransfer)." });
        }

        var command = new ConfirmGuestBookingCommand(
            LookupToken: null,
            ReservationId: id,
            PropertyId: propertyId,
            PaymentAmount: request.PaymentAmount.Value,
            PaymentMethod: method,
            TransactionRef: request.TransactionRef,
            IdempotencyKey: idempotencyKey);

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Posts a minibar, laundry, or extra service charge to the reservation folio.
    /// </summary>
    [HttpPost("{id:guid}/folio/items")]
    [RequirePermission("RESERVATIONS", PermissionAction.Update)]
    [RequirePermission("PAYMENTS", PermissionAction.Create)]
    [ProducesResponseType(typeof(FolioDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddFolioItem(
        [FromRoute] Guid id,
        [FromQuery] Guid? propertyId,
        [FromBody] AddFolioItemRequest request,
        CancellationToken cancellationToken)
    {
        var targetPropertyId = (propertyId.HasValue && propertyId.Value != Guid.Empty)
            ? propertyId.Value
            : (request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty
                ? request.PropertyId.Value
                : Guid.Empty);

        if (targetPropertyId == Guid.Empty && Request.Headers.TryGetValue("X-Property-Id", out var headerProp) && Guid.TryParse(headerProp, out var parsedProp))
        {
            targetPropertyId = parsedProp;
        }

        var command = new HotelSaas.Application.Payments.Commands.AddFolioItem.AddFolioItemCommand(
            id,
            targetPropertyId,
            request.ItemCode,
            request.Description,
            request.Quantity,
            request.UnitPrice,
            request.Category ?? "Service");

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }
}

public sealed record AddFolioItemRequest(
    string ItemCode,
    string Description,
    int Quantity,
    decimal UnitPrice,
    string? Category = "Service",
    Guid? PropertyId = null
);
