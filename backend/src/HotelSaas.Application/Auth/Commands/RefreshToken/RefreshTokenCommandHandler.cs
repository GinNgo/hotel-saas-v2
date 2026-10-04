using System.Security.Claims;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.RefreshToken;

/// <summary>
/// Handles token refresh: validates the old refresh token, revokes it, and issues a new token pair.
/// </summary>
public sealed class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, LoginResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;

    /// <summary>
    /// Initializes a new instance of <see cref="RefreshTokenCommandHandler"/>.
    /// </summary>
    public RefreshTokenCommandHandler(IApplicationDbContext context, IJwtService jwtService)
    {
        _context = context;
        _jwtService = jwtService;
    }

    /// <inheritdoc />
    public async Task<LoginResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        // Extract userId from expired access token
        var principal = _jwtService.GetPrincipalFromExpiredToken(request.AccessToken);
        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? principal.FindFirst("sub")?.Value;

        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Token không hợp lệ.");

        // Find and validate the refresh token
        var storedToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt =>
                rt.Token == request.RefreshToken &&
                rt.UserId == userId &&
                rt.RevokedAtUtc == null &&
                rt.ExpiresAtUtc > DateTime.UtcNow,
                cancellationToken);

        if (storedToken is null)
            throw new UnauthorizedAccessException("Refresh token không hợp lệ hoặc đã hết hạn.");

        // Revoke the old refresh token
        storedToken.RevokedAtUtc = DateTime.UtcNow;

        // Load user with permissions
        var user = await _context.Users
            .Include(u => u.TenantStaffProfiles)
                .ThenInclude(ts => ts.Role!)
                    .ThenInclude(r => r.Permissions)
                        .ThenInclude(rp => rp.Function)
            .FirstAsync(u => u.Id == userId, cancellationToken);

        var activeStaff = user.TenantStaffProfiles
            .FirstOrDefault(ts => ts.IsActive);

        var permissionClaims = activeStaff?.Role?.Permissions
            .Select(rp => $"{rp.Function!.Code}:{rp.ActionMask}")
            .ToList() as IReadOnlyList<string>;

        // Generate new token pair
        var (accessToken, newRefreshToken, expiresAtUtc) = _jwtService.GenerateTokens(
            user.Id,
            user.Email,
            user.FullName,
            user.GlobalRole.ToString(),
            activeStaff?.TenantId,
            permissionClaims);

        // Persist new refresh token with rotation chain
        var refreshTokenEntity = new Domain.Entities.RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = newRefreshToken,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(_jwtService.GetRefreshTokenExpirationDays())
        };

        storedToken.ReplacedByToken = newRefreshToken;
        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        var userDto = new UserDto(
            user.Id,
            user.Email,
            user.FullName,
            user.GlobalRole.ToString(),
            activeStaff?.TenantId);

        return new LoginResponse(accessToken, newRefreshToken, expiresAtUtc, userDto);
    }
}
