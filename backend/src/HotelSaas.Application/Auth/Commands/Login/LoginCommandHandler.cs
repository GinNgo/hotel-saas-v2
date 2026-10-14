using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.Login;

/// <summary>
/// Handles user login: verifies credentials, resolves valid context memberships independently of ambient scope
/// for authenticated users without weakening business query filters, avoids implicitly selecting a branch
/// when multiple branches exist, generates tokens, and persists the session.
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
        // 1. Authenticate user credentials first
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower(), cancellationToken);

        if (user is null || !user.IsActive)
            throw new UnauthorizedAccessException("Email hoặc mật khẩu không đúng.");

        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Email hoặc mật khẩu không đúng.");

        // 2. Query memberships independently of ambient tenant/property context ONLY for password-verified user
        // Using IgnoreQueryFilters on TenantStaffMembers ensures bootstrap discovery works when TenantId is null
        // without weakening business entity query filters.
        var staffProfiles = await _context.TenantStaffMembers
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(ts => ts.Tenant)
            .Include(ts => ts.Property)
            .Include(ts => ts.Role!)
                .ThenInclude(r => r.Permissions)
                    .ThenInclude(rp => rp.Function)
            .Where(ts => ts.UserId == user.Id)
            .ToListAsync(cancellationToken);

        // 3. Strict verification of membership status, Tenant status, and Property status
        var activeStaffProfiles = staffProfiles
            .Where(ts => ts.IsActive &&
                         ts.Tenant != null && ts.Tenant.Status == TenantStatus.Active &&
                         (ts.PropertyId == null || (ts.Property != null && ts.Property.Status == PropertyStatus.Active)))
            .ToList();

        // 4. Map all valid memberships for client bootstrap selection
        var validMemberships = activeStaffProfiles.Select(ts => new UserMembershipDto(
            ts.Id,
            ts.TenantId,
            ts.Tenant?.Name ?? string.Empty,
            ts.Tenant?.Code ?? string.Empty,
            ts.PropertyId,
            ts.Property?.Name,
            ts.Property?.Code,
            ts.StaffRole.ToString(),
            ts.Role?.Name ?? ts.StaffRole.ToString(),
            ts.PropertyId == null
        )).ToList();

        // 5. Resolve context without implicitly picking first branch
        Guid? tenantId = null;
        Guid? propertyId = null;
        string? scope = null;
        string? staffRole = null;
        IReadOnlyList<string>? permissionClaims = null;

        if (activeStaffProfiles.Count == 1)
        {
            // Unambiguous: exactly one valid active profile
            var single = activeStaffProfiles[0];
            tenantId = single.TenantId;
            var isTenantWide = single.PropertyId == null;
            propertyId = single.PropertyId;
            scope = isTenantWide ? "TenantWide" : "PropertyScoped";
            staffRole = single.StaffRole.ToString();
            permissionClaims = single.Role?.Permissions
                .Select(rp => $"{rp.Function!.Code}:{rp.ActionMask}")
                .ToList();
        }
        else if (activeStaffProfiles.Count > 1)
        {
            // Multiple memberships exist: check if one of them is Tenant-Wide
            var tenantWideProfile = activeStaffProfiles.FirstOrDefault(ts => ts.PropertyId == null);
            if (tenantWideProfile != null)
            {
                // Tenant-wide authority: operates tenant-wide, does NOT arbitrarily pick a branch
                tenantId = tenantWideProfile.TenantId;
                propertyId = null;
                scope = "TenantWide";
                staffRole = tenantWideProfile.StaffRole.ToString();
                permissionClaims = tenantWideProfile.Role?.Permissions
                    .Select(rp => $"{rp.Function!.Code}:{rp.ActionMask}")
                    .ToList();
            }
            else
            {
                // Multi-branch staff with NO tenant-wide role:
                // DO NOT implicitly pick the first branch! Issue bootstrap token.
                // PropertyId and scope remain null until the user explicitly selects a branch via switch-context.
                tenantId = activeStaffProfiles.All(ts => ts.TenantId == activeStaffProfiles[0].TenantId)
                    ? activeStaffProfiles[0].TenantId
                    : null;
                propertyId = null;
                scope = null;
                staffRole = null;
                permissionClaims = null;
            }
        }

        var (accessToken, refreshToken, expiresAtUtc) = _jwtService.GenerateTokens(
            user.Id,
            user.Email,
            user.FullName,
            user.GlobalRole.ToString(),
            tenantId,
            permissionClaims,
            propertyId,
            scope,
            staffRole);

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
            tenantId);

        return new LoginResponse(accessToken, refreshToken, expiresAtUtc, userDto, validMemberships);
    }
}
