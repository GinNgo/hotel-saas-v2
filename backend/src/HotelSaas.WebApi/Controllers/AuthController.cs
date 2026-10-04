using HotelSaas.Application.Auth.Commands.Login;
using HotelSaas.Application.Auth.Commands.RefreshToken;
using HotelSaas.Application.Auth.Commands.Register;
using HotelSaas.Application.Auth.Commands.RevokeToken;
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
}
