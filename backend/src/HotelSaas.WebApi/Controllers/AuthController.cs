using HotelSaas.Application.Auth.Commands.Login;
using HotelSaas.Application.Auth.Commands.RefreshToken;
using HotelSaas.Application.Auth.Commands.Register;
using HotelSaas.Application.Auth.Commands.RevokeToken;
using HotelSaas.Application.Auth.Commands.SwitchContext;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// Handles user authentication operations including registration, login,
/// token refresh, and token revocation.
/// </summary>
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public sealed class AuthController : ControllerBase
{
    private readonly IMediator _mediator;

    /// <summary>
    /// Initializes a new instance of <see cref="AuthController"/>.
    /// </summary>
    /// <param name="mediator">MediatR mediator for dispatching commands.</param>
    public AuthController(IMediator mediator)
    {
        _mediator = mediator;
    }

    /// <summary>
    /// Registers a new user account on the platform.
    /// </summary>
    /// <param name="command">Registration details including email, password, and full name.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The newly created user's authentication tokens.</returns>
    /// <response code="201">User registered successfully.</response>
    /// <response code="400">Validation errors in the request body.</response>
    /// <response code="409">A user with the given email already exists.</response>
    [HttpPost("register")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(
        [FromBody] RegisterCommand command,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Registers a new hotel partner, creates tenant enterprise and primary property branch.
    /// </summary>
    /// <param name="command">Partner registration payload including owner credentials and hotel location details.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Created partner tenant, branch, and owner summary.</returns>
    /// <response code="201">Partner registered successfully.</response>
    /// <response code="400">Validation errors in the request body.</response>
    /// <response code="409">Email already in use.</response>
    [HttpPost("partner-register")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> PartnerRegister(
        [FromBody] HotelSaas.Application.Auth.Commands.RegisterPartner.RegisterPartnerCommand command,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new { success = true, data = result });
    }

    /// <summary>
    /// Authenticates a user with email and password credentials.
    /// </summary>
    /// <param name="command">Login credentials.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>JWT access token and refresh token pair.</returns>
    /// <response code="200">Login successful.</response>
    /// <response code="400">Validation errors in the request body.</response>
    /// <response code="401">Invalid credentials.</response>
    [HttpPost("login")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        [FromBody] LoginCommand command,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Exchanges a valid refresh token for a new access/refresh token pair.
    /// </summary>
    /// <param name="command">The expired access token and current refresh token.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>New JWT access token and refresh token pair.</returns>
    /// <response code="200">Token refreshed successfully.</response>
    /// <response code="400">Validation errors in the request body.</response>
    /// <response code="401">Invalid or expired refresh token.</response>
    [HttpPost("refresh-token")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RefreshToken(
        [FromBody] RefreshTokenCommand command,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Revokes a refresh token to prevent further use. Requires authentication.
    /// </summary>
    /// <param name="command">The refresh token to revoke.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Confirmation of revocation.</returns>
    /// <response code="200">Token revoked successfully.</response>
    /// <response code="400">Validation errors in the request body.</response>
    /// <response code="401">User is not authenticated.</response>
    [HttpPost("revoke-token")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> RevokeToken(
        [FromBody] RevokeTokenCommand command,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Switches the active working property context and issues updated scoped tokens. Requires authentication.
    /// </summary>
    /// <param name="command">The target property identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>New scoped JWT and refresh tokens.</returns>
    /// <response code="200">Context switched successfully.</response>
    /// <response code="400">Invalid property identifier.</response>
    /// <response code="401">User is not authenticated.</response>
    /// <response code="403">User is not authorized for the target property.</response>
    [HttpPost("switch-context")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> SwitchContext(
        [FromBody] SwitchContextCommand command,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(new { success = true, data = result });
    }

    /// <summary>
    /// Gets the list of valid available tenant and property memberships/contexts for the current authenticated user.
    /// Used during login/bootstrap for users with multiple branches to select their working context.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A list of valid memberships and branch contexts.</returns>
    /// <response code="200">Returns list of valid contexts.</response>
    /// <response code="401">User is not authenticated.</response>
    [HttpGet("me/memberships")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMyMemberships(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new HotelSaas.Application.Auth.Queries.GetMyMemberships.GetMyMembershipsQuery(), cancellationToken);
        return Ok(new { success = true, data = result });
    }
}
