using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Quotes.Queries.CalculateQuote;
using HotelSaas.WebApi.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Quote Engine endpoint for verified pricing estimation.
/// Enforces ROOMS.Read OR RESERVATIONS.Read permissions per contract.
/// </summary>
[ApiController]
[Route("api/quotes")]
[Produces("application/json")]
[Authorize]
public sealed class QuotesController : ControllerBase
{
    private readonly ISender _mediator;

    public QuotesController(ISender mediator)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
    }

    /// <summary>
    /// Calculates a verified price estimate for hourly or overnight room rentals.
    /// </summary>
    /// <param name="query">Parameters including property, room type, rental type, and dates.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Price breakdown, total amount, and 5-minute TTL expiration timestamp.</returns>
    [HttpPost("calculate")]
    [RequireAnyPermission("ROOMS", PermissionAction.Read, "RESERVATIONS", PermissionAction.Read)]
    [ProducesResponseType(typeof(ApiResponse<QuoteDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> CalculateQuote(
        [FromBody] CalculateQuoteQuery query,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(query, cancellationToken);
        return Ok(ApiResponse.Ok(result));
    }
}
