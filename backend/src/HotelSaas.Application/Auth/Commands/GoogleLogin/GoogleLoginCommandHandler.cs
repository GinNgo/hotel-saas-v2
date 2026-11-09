using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Application.Auth.Commands.GoogleLogin;

/// <summary>
/// Handles Google OAuth Social Sign-In:
/// 1. Cryptographically validates Google ID Token with Google Identity Services.
/// 2. Implements Soft-Gating for B2C Guests (auto-assigns EmailVerifiedAtUtc = now).
/// 3. Idempotently links Google identity to existing accounts or provisions new Customer users.
/// 4. Generates standard platform JWT and Refresh Tokens.
/// </summary>
public sealed class GoogleLoginCommandHandler : IRequestHandler<GoogleLoginCommand, LoginResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IGoogleAuthService _googleAuthService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtService _jwtService;
    private readonly ILogger<GoogleLoginCommandHandler> _logger;

    public GoogleLoginCommandHandler(
        IApplicationDbContext context,
        IGoogleAuthService googleAuthService,
        IPasswordHasher passwordHasher,
        IJwtService jwtService,
        ILogger<GoogleLoginCommandHandler> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _googleAuthService = googleAuthService ?? throw new ArgumentNullException(nameof(googleAuthService));
        _passwordHasher = passwordHasher ?? throw new ArgumentNullException(nameof(passwordHasher));
        _jwtService = jwtService ?? throw new ArgumentNullException(nameof(jwtService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<LoginResponse> Handle(GoogleLoginCommand request, CancellationToken cancellationToken)
    {
        // 1. Verify Google ID Token
        var verification = await _googleAuthService.VerifyGoogleTokenAsync(request.IdToken, cancellationToken);
        if (!verification.IsValid || string.IsNullOrWhiteSpace(verification.Subject) || string.IsNullOrWhiteSpace(verification.Email))
        {
            _logger.LogWarning("Google login rejected: {Error}", verification.ErrorMessage);
            throw new UnauthorizedAccessException(verification.ErrorMessage ?? "Mã xác thực Google không hợp lệ hoặc đã hết hạn.");
        }

        var provider = "Google";
        var subject = verification.Subject.Trim();
        var email = verification.Email.Trim().ToLowerInvariant();
        var displayName = !string.IsNullOrWhiteSpace(verification.FullName) ? verification.FullName.Trim() : email.Split('@')[0];

        // 2. Check existing social link
        var socialLink = await _context.SocialIdentities
            .Include(si => si.User)
            .FirstOrDefaultAsync(si => si.Provider == provider && si.ProviderSubject == subject, cancellationToken);

        User user;

        if (socialLink != null)
        {
            user = socialLink.User ?? await _context.Users.FirstAsync(u => u.Id == socialLink.UserId, cancellationToken);
            if (!user.IsActive)
            {
                throw new UnauthorizedAccessException("Tài khoản đã bị tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ.");
            }

            // Google OAuth email is verified by Google
            user.EmailVerifiedAtUtc ??= DateTime.UtcNow;
            socialLink.LastLoginAtUtc = DateTime.UtcNow;
            socialLink.ProviderEmail = email;

            if (!string.IsNullOrWhiteSpace(verification.AvatarUrl) && string.IsNullOrWhiteSpace(user.AvatarUrl))
            {
                user.AvatarUrl = verification.AvatarUrl;
            }
        }
        else
        {
            // 3. Check existing user by email
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email, cancellationToken);

            if (existingUser != null)
            {
                user = existingUser;
                if (!user.IsActive)
                {
                    throw new UnauthorizedAccessException("Tài khoản đã bị tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ.");
                }

                user.EmailVerifiedAtUtc ??= DateTime.UtcNow;

                if (!string.IsNullOrWhiteSpace(verification.AvatarUrl) && string.IsNullOrWhiteSpace(user.AvatarUrl))
                {
                    user.AvatarUrl = verification.AvatarUrl;
                }
            }
            else
            {
                // Auto-provision brand new Customer user with Soft-Gating pre-verified email
                user = new User
                {
                    Id = Guid.NewGuid(),
                    Email = email,
                    Username = email,
                    FullName = displayName,
                    AvatarUrl = verification.AvatarUrl,
                    PasswordHash = _passwordHasher.Hash(Guid.NewGuid().ToString("N")),
                    GlobalRole = GlobalUserRole.Customer,
                    IsActive = true,
                    EmailVerifiedAtUtc = DateTime.UtcNow,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // Create SocialIdentity link
            var newSocialIdentity = new SocialIdentity
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Provider = provider,
                ProviderSubject = subject,
                ProviderEmail = email,
                AvatarUrl = verification.AvatarUrl,
                LastLoginAtUtc = DateTime.UtcNow,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };

            _context.SocialIdentities.Add(newSocialIdentity);
        }

        // 4. Resolve context memberships (in case user has staff profiles)
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

        var activeStaffProfiles = staffProfiles
            .Where(ts => ts.IsActive &&
                         ts.Tenant != null && ts.Tenant.Status == TenantStatus.Active &&
                         (ts.PropertyId == null || (ts.Property != null && ts.Property.Status == PropertyStatus.Active)))
            .ToList();

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

        Guid? tenantId = null;
        Guid? propertyId = null;
        string? scope = null;
        string? staffRole = null;
        IReadOnlyList<string>? permissionClaims = null;

        if (activeStaffProfiles.Count == 1)
        {
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

        _logger.LogInformation("Google OAuth login succeeded for user {UserId} ({Email})", user.Id, user.Email);
        return new LoginResponse(accessToken, refreshToken, expiresAtUtc, userDto, validMemberships);
    }
}
