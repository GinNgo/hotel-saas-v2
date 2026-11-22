using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Ai.Commands.ApplyDynamicPricing;
using HotelSaas.Application.Ai.DTOs;
using HotelSaas.Application.Ai.Queries.GetAiUsageStatus;
using HotelSaas.Application.Ai.Queries.GetDynamicPricingRecommendations;
using HotelSaas.Application.Ai.Queries.ProcessAiChat;
using HotelSaas.Application.Ai.Queries.ProcessAiConcierge;
using HotelSaas.Application.Ai.Queries.ProcessAiSmartSearch;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Pricing.Services;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.RoomTypes.DTOs;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// AI Concierge service providing 24/7 intelligent hospitality assistant,
/// Vietnamese semantic room search, dynamic filter chips, and dynamic pricing advice.
/// </summary>
[ApiController]
[Route("api/ai")]
[Produces("application/json")]
[EnableRateLimiting("ai-chat")]
public sealed class AiController : ControllerBase
{
    private readonly ISender _mediator;

    public AiController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Processes guest or customer queries via AI Concierge, returning natural Vietnamese advice and matching room cards.
    /// </summary>
    [HttpPost("concierge")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AiConciergeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ProcessConciergeQuery([FromBody] AiConciergeRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _mediator.Send(
                new ProcessAiConciergeQuery(request?.Message ?? string.Empty, request?.PropertySlug),
                cancellationToken);
            return Ok(response);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Checks current tenant AI consumption against monthly subscription quota.
    /// </summary>
    [HttpGet("usage-status")]
    [Authorize]
    [ProducesResponseType(typeof(AiUsageStatusDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAiUsageStatus(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _mediator.Send(new GetAiUsageStatusQuery(), cancellationToken);
            return Ok(result);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Analyzes real-time inventory occupancy and returns AI Dynamic Pricing recommendations for a property.
    /// </summary>
    [HttpGet("dynamic-pricing/recommendations")]
    [Authorize]
    [RequirePermission("AI_FEATURES", PermissionAction.Read)]
    [ProducesResponseType(typeof(DynamicPricingSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDynamicPricingRecommendations(
        [FromQuery] Guid? propertyId,
        [FromQuery] DateOnly? date,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _mediator.Send(new GetDynamicPricingRecommendationsQuery(propertyId, date), cancellationToken);
            if (result == null)
            {
                return Ok(new { message = "Dịch vụ định giá động AI chưa được kích hoạt." });
            }

            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            var (code, msg) = ParseUnauthorized(ex.Message, "ERR_TENANT_REQUIRED");
            return Unauthorized(ApiResponse.Fail(code, msg));
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(ApiResponse.Fail("ERR_PROPERTY_NOT_FOUND", ex.Message));
        }
        catch (BadRequestException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.ErrorCode, ex.Message));
        }
    }

    /// <summary>
    /// Applies a selected AI dynamic pricing recommendation by creating or interval-splitting an active room type rate.
    /// </summary>
    [HttpPost("dynamic-pricing/apply")]
    [Authorize]
    [RequirePermission("AI_FEATURES", PermissionAction.Update)]
    [ProducesResponseType(typeof(RoomTypeRateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApplyDynamicPricingRecommendation(
        [FromBody] ApplyDynamicPricingRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest(ApiResponse.Fail("ERR_INVALID_REQUEST", "Vui lòng chọn hạng phòng hợp lệ để áp dụng giá AI."));
        }

        try
        {
            var createdRate = await _mediator.Send(new ApplyDynamicPricingCommand(
                request.RoomTypeId,
                request.NightlyPrice,
                request.PropertyId,
                request.EffectiveFrom,
                request.EffectiveTo,
                request.FirstHours,
                request.FirstHoursPrice,
                request.AdditionalHourPrice,
                request.Currency,
                request.ChangeReason), cancellationToken);

            return Ok(createdRate);
        }
        catch (UnauthorizedAccessException ex)
        {
            var (code, msg) = ParseUnauthorized(ex.Message, "ERR_TENANT_REQUIRED");
            return Unauthorized(ApiResponse.Fail(code, msg));
        }
        catch (ForbiddenException)
        {
            return Forbid();
        }
        catch (NotFoundException ex)
        {
            return NotFound(ApiResponse.Fail("ERR_ROOM_TYPE_NOT_FOUND", ex.Message));
        }
        catch (BadRequestException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.ErrorCode, ex.Message));
        }
    }

    /// <summary>
    /// AI Smart Search endpoint: parses natural Vietnamese query, maps to landmarks/provinces/rentals,
    /// queries authoritative database properties (zero-hallucination), and returns dynamic suggested filter chips.
    /// </summary>
    [HttpPost("smart-search")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AiSmartSearchResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SmartSearch([FromBody] AiSmartSearchRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _mediator.Send(
                new ProcessAiSmartSearchQuery(request?.Query ?? string.Empty, request?.UserLatitude, request?.UserLongitude),
                cancellationToken);
            return Ok(response);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    /// <summary>
    /// Conversational AI Concierge endpoint grounded in real active properties, prices, and Google Maps links.
    /// </summary>
    [HttpPost("chat")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AiChatResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ProcessChatQuery(
        [FromBody] AiChatRequest? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await _mediator.Send(
                new ProcessAiChatQuery(request?.Message, request?.Messages, request?.Location),
                cancellationToken);
            return Ok(response);
        }
        catch (BadRequestException ex)
        {
            return BadRequest(new { code = ex.ErrorCode, message = ex.Message });
        }
    }

    private static (string Code, string Message) ParseUnauthorized(string message, string defaultCode)
    {
        var idx = message.IndexOf(':');
        if (message.StartsWith("ERR_", StringComparison.Ordinal) && idx > 0)
        {
            return (message[..idx].Trim(), message[(idx + 1)..].Trim());
        }

        return (defaultCode, message);
    }
}
