using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Public.Commands.ConfirmGuestBooking;
using HotelSaas.Application.Public.Commands.CreateGuestHold;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.CalculatePublicQuote;
using HotelSaas.Application.Public.Queries.GetGuestBookingByToken;
using HotelSaas.Application.Public.Queries.GetPublicAvailability;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Application.Public.Queries.GetPublicPropertyBySlug;
using HotelSaas.Application.Public.Queries.GetPublicRoomTypes;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Public endpoints for guest property discovery, availability check, quoting, and room hold (P5-GUEST-BOOKING-01).
/// Booking confirmation requires authorized staff with manual deposit collection (Decision D08, D15, D21).
/// </summary>
[ApiController]
[Route("api/public")]
[Produces("application/json")]
public sealed class PublicController : ControllerBase
{
    private readonly ISender _mediator;

    public PublicController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Gets all active hotel properties available for public booking.
    /// </summary>
    [HttpGet("properties")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<PublicPropertyDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProperties([FromQuery] string? search, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetPublicPropertiesQuery(search), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Gets public detail of a property by its URL slug.
    /// </summary>
    [HttpGet("properties/{slug}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PublicPropertyDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPropertyBySlug(string slug, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetPublicPropertyBySlugQuery(slug), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Gets active room types for a property available for online booking.
    /// </summary>
    [HttpGet("properties/{slug}/room-types")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<PublicRoomTypeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRoomTypes(string slug, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetPublicRoomTypesQuery(slug), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Checks real-time room availability across room types for requested dates/hours.
    /// </summary>
    [HttpGet("properties/{slug}/availability")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<PublicRoomTypeAvailabilityDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAvailability(
        string slug,
        [FromQuery] RentalType rentalType,
        [FromQuery] DateTime startAtUtc,
        [FromQuery] DateTime endAtUtc,
        [FromQuery] DateOnly? checkInDate,
        [FromQuery] DateOnly? checkOutDate,
        CancellationToken cancellationToken)
    {
        var query = new GetPublicAvailabilityQuery(
            slug, rentalType, startAtUtc, endAtUtc, checkInDate, checkOutDate);
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Calculates authoritative quote using the core pricing engine.
    /// </summary>
    [HttpPost("quotes/calculate")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(QuoteDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CalculateQuote(
        [FromBody] CalculatePublicQuoteRequest request,
        CancellationToken cancellationToken)
    {
        var query = new CalculatePublicQuoteQuery(
            request.PropertySlug,
            request.RoomTypeId,
            request.RentalType,
            request.StartAtUtc,
            request.EndAtUtc,
            request.CheckInDate,
            request.CheckOutDate);

        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Creates a 15-minute room hold with auto physical room assignment and secure lookup token.
    /// </summary>
    [HttpPost("bookings/hold")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(GuestHoldDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateHold(
        [FromBody] CreateGuestHoldRequest request,
        CancellationToken cancellationToken)
    {
        var idempotencyKey = request.IdempotencyKey;
        if (string.IsNullOrWhiteSpace(idempotencyKey) &&
            Request.Headers.TryGetValue("Idempotency-Key", out var headerKey) &&
            !string.IsNullOrWhiteSpace(headerKey))
        {
            idempotencyKey = headerKey.ToString();
        }

        var command = new CreateGuestHoldCommand(
            request.PropertySlug,
            request.RoomTypeId,
            request.RentalType,
            request.StartAtUtc,
            request.EndAtUtc,
            request.GuestName,
            request.GuestEmail,
            request.GuestPhone,
            request.NumberOfGuests,
            request.CheckInDate,
            request.CheckOutDate,
            request.ExpectedTotalAmount,
            idempotencyKey);

        var result = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Looks up guest booking details using unguessable secure token. PII masked.
    /// </summary>
    [HttpGet("bookings/{lookupToken}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(GuestBookingDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBookingByToken(string lookupToken, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetGuestBookingByTokenQuery(lookupToken), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Confirms guest booking upon receiving manual deposit payment by authorized staff (Decision D08, D15, D21).
    /// Anonymous access is strictly forbidden.
    /// </summary>
    [HttpPost("bookings/{lookupToken}/confirm")]
    [Authorize]
    [RequirePermission("RESERVATIONS", PermissionAction.Update)]
    [RequirePermission("PAYMENTS", PermissionAction.Create)]
    [ProducesResponseType(typeof(GuestBookingDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ConfirmBooking(
        string lookupToken,
        [FromBody] ConfirmGuestBookingRequest request,
        [FromQuery] Guid? propertyId,
        CancellationToken cancellationToken)
    {
        var targetPropertyId = request?.PropertyId ?? propertyId;
        if (!targetPropertyId.HasValue && Request.Headers.TryGetValue("X-Property-Id", out var propHeader) && Guid.TryParse(propHeader, out var parsedProp))
        {
            targetPropertyId = parsedProp;
        }

        if (!targetPropertyId.HasValue)
        {
            return BadRequest(new { code = "ERR_PROPERTY_REQUIRED", message = "Property context (X-Property-Id header, query, or body) is required." });
        }

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
            LookupToken: lookupToken,
            ReservationId: null,
            PropertyId: targetPropertyId.Value,
            PaymentAmount: request.PaymentAmount.Value,
            PaymentMethod: method,
            TransactionRef: request.TransactionRef,
            IdempotencyKey: idempotencyKey);

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }
}

public sealed record CalculatePublicQuoteRequest(
    string PropertySlug,
    Guid RoomTypeId,
    RentalType RentalType,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    DateOnly? CheckInDate = null,
    DateOnly? CheckOutDate = null
);

public sealed record CreateGuestHoldRequest(
    string PropertySlug,
    Guid RoomTypeId,
    RentalType RentalType,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string GuestName,
    string GuestEmail,
    string? GuestPhone = null,
    int NumberOfGuests = 1,
    DateOnly? CheckInDate = null,
    DateOnly? CheckOutDate = null,
    decimal? ExpectedTotalAmount = null,
    string? IdempotencyKey = null
);

public sealed record ConfirmGuestBookingRequest(
    decimal? PaymentAmount = null,
    string? PaymentMethod = null,
    string? TransactionRef = null,
    Guid? PropertyId = null,
    string? IdempotencyKey = null
);
