using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.Login;

/// <summary>
/// Handles user login: verifies credentials, generates JWT + refresh token, and persists the session.
/// </summary>
public sealed class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtService _jwtService;

    /// <summary>
    /// Initializes a new instance of <see cref="LoginCommandHandler"/>.
    /// </summary>
    public LoginCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IJwtService jwtService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtService = jwtService;
    }

    /// <inheritdoc />
    public async Task<LoginResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Users
            .Include(u => u.TenantStaffProfiles)
                .ThenInclude(ts => ts.Role!)
                    .ThenInclude(r => r.Permissions)
                        .ThenInclude(rp => rp.Function)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower(), cancellationToken);

        if (user is null || !user.IsActive)
            throw new UnauthorizedAccessException("Email hoặc mật khẩu không đúng.");

        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Email hoặc mật khẩu không đúng.");

        // Build permission claims from active staff profile
        var activeStaff = user.TenantStaffProfiles
            .FirstOrDefault(ts => ts.IsActive);

        var permissionClaims = activeStaff?.Role?.Permissions
            .Select(rp => $"{rp.Function!.Code}:{rp.ActionMask}")
            .ToList() as IReadOnlyList<string>;

        var (accessToken, refreshToken, expiresAtUtc) = _jwtService.GenerateTokens(
            user.Id,
            user.Email,
            user.FullName,
            user.GlobalRole.ToString(),
            activeStaff?.TenantId,
            permissionClaims);

        // Create and persist refresh token
        var refreshTokenEntity = new Domain.Entities.RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(_jwtService.GetRefreshTokenExpirationDays())
        };

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        var userDto = new UserDto(
            user.Id,
            user.Email,
            user.FullName,
            user.GlobalRole.ToString(),
            activeStaff?.TenantId);

        return new LoginResponse(accessToken, refreshToken, expiresAtUtc, userDto);
    }
}
