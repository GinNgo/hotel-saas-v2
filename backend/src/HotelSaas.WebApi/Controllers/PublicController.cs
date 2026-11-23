using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Commands.CancelGuestBooking;
using HotelSaas.Application.Public.Commands.ConfirmGuestBooking;
using HotelSaas.Application.Public.Commands.CreateGuestHold;
using HotelSaas.Application.Public.Commands.ExtendGuestHold;
using HotelSaas.Application.Public.Commands.RescheduleGuestBooking;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.CalculatePublicQuote;
using HotelSaas.Application.Public.Queries.GetGuestBookingByToken;
using HotelSaas.Application.Public.Queries.GetGuestCancellationPreview;
using HotelSaas.Application.Public.Queries.GetPublicAvailability;
using HotelSaas.Application.Public.Queries.GetPublicBrands;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Application.Public.Queries.GetPublicPropertyBySlug;
using HotelSaas.Application.Public.Queries.GetPublicRoomTypes;
using HotelSaas.Application.Promotions.DTOs;
using HotelSaas.Application.Promotions.Queries.GetPublicPromotions;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Reviews.Commands.SubmitGuestReview;
using HotelSaas.Application.Reviews.DTOs;
using HotelSaas.Application.Reviews.Queries.GetPropertyReviews;
using HotelSaas.Domain.Enums;
using HotelSaas.WebApi.Authorization;
using HotelSaas.WebApi.Models;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Public endpoints for guest property discovery, availability check, quoting, and room hold (P5-GUEST-BOOKING-01).
/// Booking confirmation requires authorized staff with manual deposit collection (Decision D08, D15, D21).
/// </summary>
[ApiController]
[Route("api/public")]
[Produces("application/json")]
[EnableRateLimiting("public-api")]
public sealed class PublicController : ControllerBase
{
    private readonly ISender _mediator;
    private readonly ILocationLookupService? _locationService;

    public PublicController(ISender mediator, ILocationLookupService? locationService = null)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _locationService = locationService;
    }

    /// <summary>
    /// Gets all active properties available for public booking with flexible filtering.
    /// </summary>
    [HttpGet("properties")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<PublicPropertyDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProperties(
        [FromQuery] string? search = null,
        [FromQuery] string? destinationKeyword = null,
        [FromQuery] string? propertyTypes = null,
        [FromQuery] RentalType? rentalType = null,
        [FromQuery] string? touristZoneSlug = null,
        [FromQuery] string? landmarkSlug = null,
        [FromQuery] double? maxDistanceKm = null,
        [FromQuery] double? maxDistanceMeters = null,
        [FromQuery] double? userLatitude = null,
        [FromQuery] double? userLongitude = null,
        [FromQuery] string? tenantSlug = null,
        [FromQuery] string? provinceCode = null,
        [FromQuery] decimal? minPrice = null,
        [FromQuery] decimal? maxPrice = null,
        [FromQuery] int? guests = null,
        [FromQuery] DateOnly? checkInDate = null,
        [FromQuery] DateOnly? checkOutDate = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] bool onlyPublished = false,
        [FromQuery] string? sortBy = null,
        CancellationToken cancellationToken = default)
    {
        List<PropertyType>? parsedTypes = null;
        var rawTypeInputs = new List<string>();

        if (!string.IsNullOrWhiteSpace(propertyTypes))
        {
            rawTypeInputs.Add(propertyTypes);
        }

        if (HttpContext?.Request?.Query.TryGetValue("propertyTypes", out var queryTypeValues) == true)
        {
            foreach (var v in queryTypeValues)
            {
                if (!string.IsNullOrWhiteSpace(v))
                {
                    rawTypeInputs.Add(v!);
                }
            }
        }

        if (rawTypeInputs.Count > 0)
        {
            var parsed = rawTypeInputs
                .SelectMany(v => v.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                .Select(t => Enum.TryParse<PropertyType>(t, true, out var pt) && Enum.IsDefined(typeof(PropertyType), pt)
                    ? pt
                    : (PropertyType?)null)
                .Where(pt => pt.HasValue)
                .Select(pt => pt!.Value)
                .Distinct()
                .ToList();

            if (parsed.Count > 0)
            {
                parsedTypes = parsed;
            }
        }

        var query = new GetPublicPropertiesQuery(
            Search: search,
            DestinationKeyword: destinationKeyword,
            PropertyTypes: parsedTypes,
            RentalType: rentalType,
            TouristZoneSlug: touristZoneSlug,
            LandmarkSlug: landmarkSlug,
            MaxDistanceKm: maxDistanceKm,
            MaxDistanceMeters: maxDistanceMeters,
            UserLatitude: userLatitude,
            UserLongitude: userLongitude,
            TenantSlug: tenantSlug,
            ProvinceCode: provinceCode,
            MinPrice: minPrice,
            MaxPrice: maxPrice,
            Guests: guests,
            CheckInDate: checkInDate,
            CheckOutDate: checkOutDate,
            Page: page,
            PageSize: pageSize,
            OnlyPublished: onlyPublished,
            SortBy: sortBy);

        var result = await _mediator.Send(query, cancellationToken);
        if (HttpContext?.Response != null)
        {
            var totalCount = result is PagedPropertyList paged ? paged.TotalCount : result.Count;
            HttpContext.Response.Headers["X-Total-Count"] = totalCount.ToString();
        }
        return Ok(result);
    }

    /// <summary>
    /// Gets active partner brand profiles with real property counts and aggregated review metrics.
    /// </summary>
    [HttpGet("brands")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<PublicBrandDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBrands(
        [FromQuery] bool onlyPublished = false,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetPublicBrandsQuery(onlyPublished), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Gets all recognized tourist destination zones.
    /// </summary>
    [HttpGet("tourist-zones")]
    [AllowAnonymous]
    public IActionResult GetTouristZones([FromQuery] string? provinceCode)
    {
        if (_locationService == null) return Ok(Array.Empty<TouristZoneDto>());
        var zones = _locationService.GetTouristZones(provinceCode);
        return Ok(zones);
    }

    /// <summary>
    /// Gets prominent landmarks for searching and proximity discovery.
    /// </summary>
    [HttpGet("landmarks")]
    [AllowAnonymous]
    public IActionResult GetLandmarks([FromQuery] string? provinceCode, [FromQuery] string? touristZoneSlug)
    {
        if (_locationService == null) return Ok(Array.Empty<LandmarkDto>());
        var landmarks = _locationService.GetLandmarks(provinceCode, touristZoneSlug);
        return Ok(landmarks);
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
    /// Lists active, non-expired public promotions across published partner brands.
    /// </summary>
    [HttpGet("promotions")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<PublicPromotionDealDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPromotions(
        [FromQuery] string? tenantSlug = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetPublicPromotionsQuery(tenantSlug), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Calculates authoritative quote using the core pricing engine.
    /// </summary>
    [HttpPost("quotes/calculate")]
    [HttpPost("quotes")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(QuoteDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CalculateQuote(
        [FromBody] CalculatePublicQuoteRequest request,
        [FromQuery] string? promoCode = null,
        CancellationToken cancellationToken = default)
    {
        var resolvedPromoCode = !string.IsNullOrWhiteSpace(request.PromoCode)
            ? request.PromoCode
            : promoCode;

        var query = new CalculatePublicQuoteQuery(
            request.PropertySlug,
            request.RoomTypeId,
            request.RentalType,
            request.StartAtUtc,
            request.EndAtUtc,
            request.CheckInDate,
            request.CheckOutDate,
            resolvedPromoCode);

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

        Guid? guestUserId = null;
        if (User?.Identity?.IsAuthenticated == true)
        {
            var subClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;
            if (Guid.TryParse(subClaim, out var parsedUserId))
            {
                guestUserId = parsedUserId;
            }
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
            idempotencyKey,
            request.PointsToRedeem,
            guestUserId,
            request.FirebaseIdToken,
            request.PaymentMethodPreference,
            request.PromoCode,
            request.SpecialRequests);

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
    /// Extends an active guest room hold by 5 minutes (maximum 1 extension per hold, allowed when &lt;= 3 minutes remain).
    /// </summary>
    [HttpPost("bookings/{lookupToken}/extend")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(GuestBookingDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ExtendHold(string lookupToken, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new ExtendGuestHoldCommand(lookupToken), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Reschedules a PendingPayment or Confirmed guest booking under row lock and recalculates pricing (`G0-05`).
    /// </summary>
    [HttpPost("bookings/{lookupToken}/reschedule")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(GuestBookingDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RescheduleBooking(
        string lookupToken,
        [FromBody] RescheduleGuestBookingApiRequest? request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest(new { code = "ERR_EMPTY_BODY", message = "Dữ liệu đổi lịch lưu trú không hợp lệ." });
        }

        Guid? authenticatedUserId = null;
        if (User?.Identity?.IsAuthenticated == true)
        {
            var subClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;
            if (Guid.TryParse(subClaim, out var parsedUserId))
            {
                authenticatedUserId = parsedUserId;
            }
        }

        var command = new RescheduleGuestBookingCommand(
            LookupToken: lookupToken,
            NewStartAtUtc: request.NewStartAtUtc,
            NewEndAtUtc: request.NewEndAtUtc,
            NewCheckInDate: request.NewCheckInDate,
            NewCheckOutDate: request.NewCheckOutDate,
            Reason: request.Reason,
            AuthenticatedUserId: authenticatedUserId);

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Previews the financial and policy impact of cancelling a booking via lookup token.
    /// Completely read-only.
    /// </summary>
    [HttpGet("bookings/{lookupToken}/cancel-preview")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(GuestCancellationPreviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCancelPreview(string lookupToken, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetGuestCancellationPreviewQuery(lookupToken), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Cancels a guest online reservation using their secure lookup token and optional identity verification.
    /// Unblocks physical room inventory immediately.
    /// </summary>
    [HttpPost("bookings/{lookupToken}/cancel")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(GuestBookingDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelBooking(
        string lookupToken,
        [FromBody] CancelGuestBookingRequest? request,
        CancellationToken cancellationToken)
    {
        var idempotencyKey = request?.IdempotencyKey;
        if (string.IsNullOrWhiteSpace(idempotencyKey) &&
            Request.Headers.TryGetValue("Idempotency-Key", out var headerKey) &&
            !string.IsNullOrWhiteSpace(headerKey))
        {
            idempotencyKey = headerKey.ToString();
        }

        var command = new CancelGuestBookingCommand(
            LookupToken: lookupToken,
            VerificationEmailOrPhone: request?.VerificationEmailOrPhone,
            Reason: request?.Reason,
            IdempotencyKey: idempotencyKey);

        var result = await _mediator.Send(command, cancellationToken);
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

    /// <summary>
    /// Gets verified reviews and aggregate ratings for an accommodation property.
    /// </summary>
    [HttpGet("properties/{slug}/reviews")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PropertyReviewsSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPropertyReviews(
        string slug,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetPropertyReviewsQuery(slug, page, pageSize), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Submits a verified guest review using the reservation lookup token.
    /// </summary>
    [HttpPost("bookings/{lookupToken}/review")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(GuestReviewDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitReview(
        string lookupToken,
        [FromBody] SubmitReviewApiRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            return BadRequest(new { code = "ERR_EMPTY_BODY", message = "Dữ liệu đánh giá không hợp lệ." });
        }

        var command = new SubmitGuestReviewCommand(
            LookupToken: lookupToken,
            Rating: request.Rating,
            CleanlinessRating: request.CleanlinessRating,
            LocationRating: request.LocationRating,
            ServiceRating: request.ServiceRating,
            ValueRating: request.ValueRating,
            Comment: request.Comment);

        var result = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}

public sealed record SubmitReviewApiRequest(
    int Rating,
    int? CleanlinessRating = null,
    int? LocationRating = null,
    int? ServiceRating = null,
    int? ValueRating = null,
    string? Comment = null
);

public sealed record CalculatePublicQuoteRequest(
    string PropertySlug,
    Guid RoomTypeId,
    RentalType RentalType,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    DateOnly? CheckInDate = null,
    DateOnly? CheckOutDate = null,
    string? PromoCode = null
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
    string? IdempotencyKey = null,
    int? PointsToRedeem = null,
    Guid? GuestUserId = null,
    string? FirebaseIdToken = null,
    PaymentMethodPreference PaymentMethodPreference = HotelSaas.Domain.Enums.PaymentMethodPreference.VNPay,
    string? PromoCode = null,
    string? SpecialRequests = null
);

public sealed record RescheduleGuestBookingApiRequest(
    DateTime NewStartAtUtc,
    DateTime NewEndAtUtc,
    DateOnly? NewCheckInDate = null,
    DateOnly? NewCheckOutDate = null,
    string? Reason = null
);

public sealed record ConfirmGuestBookingRequest(
    decimal? PaymentAmount = null,
    string? PaymentMethod = null,
    string? TransactionRef = null,
    Guid? PropertyId = null,
    string? IdempotencyKey = null
);
