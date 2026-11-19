using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Reviews.Commands.ReplyGuestReview;
using HotelSaas.Application.Reviews.Commands.ToggleReviewVisibility;
using HotelSaas.Application.Reviews.DTOs;
using HotelSaas.Application.Reviews.Queries.GetPmsPropertyReviews;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// PMS back-office endpoints for managing verified guest reviews, publishing replies,
/// and moderating public review visibility within tenant and branch scope.
/// </summary>
[ApiController]
[Route("api/reviews")]
[Produces("application/json")]
[Authorize]
public sealed class ReviewsController : ControllerBase
{
    private readonly ISender _mediator;

    public ReviewsController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Retrieves paginated guest reviews and aggregate KPIs scoped to the caller's tenant and branch.
    /// </summary>
    [HttpGet]
    [RequirePermission("REVIEWS", PermissionAction.Read)]
    [ProducesResponseType(typeof(ApiResponse<PmsReviewsPagedResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetReviews(
        [FromQuery] Guid? propertyId = null,
        [FromQuery] int? rating = null,
        [FromQuery] bool? hasReply = null,
        [FromQuery] bool? isPublished = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var query = new GetPmsPropertyReviewsQuery(
            PropertyId: propertyId,
            Rating: rating,
            HasReply: hasReply,
            IsPublished: isPublished,
            Search: search,
            Page: page,
            PageSize: pageSize);

        var result = await _mediator.Send(query, cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }

    /// <summary>
    /// Publishes or updates an official owner/manager reply on a guest review.
    /// </summary>
    [HttpPost("{id:guid}/reply")]
    [RequirePermission("REVIEWS", PermissionAction.Update)]
    [ProducesResponseType(typeof(ApiResponse<PmsGuestReviewItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReplyReview(
        [FromRoute] Guid id,
        [FromBody] ReplyGuestReviewRequest? request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            return BadRequest(ApiResponse.Fail("ERR_EMPTY_BODY", "Dữ liệu phản hồi không hợp lệ."));
        }

        var result = await _mediator.Send(new ReplyGuestReviewCommand(id, request.Reply), cancellationToken);
        return Ok(ApiResponse.Ok(result, "Phản hồi đánh giá thành công."));
    }

    /// <summary>
    /// Toggles public visibility (IsPublished) for a guest review.
    /// </summary>
    [HttpPatch("{id:guid}/visibility")]
    [RequirePermission("REVIEWS", PermissionAction.Update)]
    [ProducesResponseType(typeof(ApiResponse<PmsGuestReviewItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleVisibility(
        [FromRoute] Guid id,
        [FromBody] ToggleReviewVisibilityRequest? request,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            return BadRequest(ApiResponse.Fail("ERR_EMPTY_BODY", "Dữ liệu cập nhật hiển thị không hợp lệ."));
        }

        var result = await _mediator.Send(new ToggleReviewVisibilityCommand(id, request.IsPublished), cancellationToken);
        var message = result.IsPublished
            ? "Đã hiển thị đánh giá công khai."
            : "Đã ẩn đánh giá khỏi trang công khai.";
        return Ok(ApiResponse.Ok(result, message));
    }
}

public sealed record ReplyGuestReviewRequest(string Reply);

public sealed record ToggleReviewVisibilityRequest(bool IsPublished);
