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

namespace HotelSaas.Application.Auth.Commands.SocialLogin;

/// <summary>
/// Authenticates or auto-provisions a guest user via federated Social Identity (Google, Facebook).
/// Reuses credentials and architecture from LuxeStay reference.
/// </summary>
public sealed record SocialLoginCommand(
    string Provider,
    string ProviderSubject,
    string ProviderEmail,
    string? FullName = null,
    string? AvatarUrl = null
) : IRequest<LoginResponse>;

public sealed class SocialLoginCommandHandler : IRequestHandler<SocialLoginCommand, LoginResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtService _jwtService;

    public SocialLoginCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IJwtService jwtService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _passwordHasher = passwordHasher ?? throw new ArgumentNullException(nameof(passwordHasher));
        _jwtService = jwtService ?? throw new ArgumentNullException(nameof(jwtService));
    }

    public async Task<LoginResponse> Handle(SocialLoginCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Provider) || string.IsNullOrWhiteSpace(request.ProviderSubject))
        {
            throw new ArgumentException("Yêu cầu thông tin nhà cung cấp (Provider) và định danh định mức (Subject).");
        }

        var provider = request.Provider.Trim();
        var subject = request.ProviderSubject.Trim();
        var email = (request.ProviderEmail ?? $"{provider.ToLower()}_{subject}@social.hotelsaas.local").Trim().ToLowerInvariant();
        var displayName = !string.IsNullOrWhiteSpace(request.FullName) ? request.FullName.Trim() : email.Split('@')[0];

        // 1. Check existing social link
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

            socialLink.LastLoginAtUtc = DateTime.UtcNow;
            socialLink.ProviderEmail = email;
            if (!string.IsNullOrWhiteSpace(request.AvatarUrl) && string.IsNullOrWhiteSpace(user.AvatarUrl))
            {
                user.AvatarUrl = request.AvatarUrl;
            }
        }
        else
        {
            // 2. Check if a local user already exists with this email
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email, cancellationToken);

            if (existingUser != null)
            {
                user = existingUser;
                if (!user.IsActive)
                {
                    throw new UnauthorizedAccessException("Tài khoản đã bị tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ.");
                }

                if (!string.IsNullOrWhiteSpace(request.AvatarUrl) && string.IsNullOrWhiteSpace(user.AvatarUrl))
                {
                    user.AvatarUrl = request.AvatarUrl;
                }
            }
            else
            {
                // Auto-provision brand new Customer user
                user = new User
                {
                    Id = Guid.NewGuid(),
                    Email = email,
                    Username = email,
                    FullName = displayName,
                    AvatarUrl = request.AvatarUrl,
                    PasswordHash = _passwordHasher.Hash(Guid.NewGuid().ToString("N")),
                    GlobalRole = GlobalUserRole.Customer,
                    IsActive = true,
                    EmailVerifiedAtUtc = DateTime.UtcNow,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);

                // Auto-create guest loyalty membership if default tenant exists
                var defaultTenant = await _context.Tenants.Include(t => t.Properties).FirstOrDefaultAsync(cancellationToken);
                if (defaultTenant != null)
                {
                    var enrolledPropId = defaultTenant.Properties.FirstOrDefault()?.Id ?? Guid.Empty;
                    var membership = new GuestLoyaltyMembership
                    {
                        Id = Guid.NewGuid(),
                        TenantId = defaultTenant.Id,
                        EnrolledPropertyId = enrolledPropId,
                        UserId = user.Id,
                        MemberCode = $"MEM-{DateTime.UtcNow:yyMM}-{Random.Shared.Next(1000, 9999)}",
                        Tier = LoyaltyTier.Silver,
                        PointsBalance = 50, // Welcome gift 50 loyalty points
                        LifetimePoints = 50,
                        CompletedStaysCount = 0,
                        CreatedAtUtc = DateTime.UtcNow,
                        UpdatedAtUtc = DateTime.UtcNow
                    };
                    _context.GuestLoyaltyMemberships.Add(membership);
                }
            }

            // Create SocialIdentity link
            var newSocialIdentity = new SocialIdentity
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Provider = provider,
                ProviderSubject = subject,
                ProviderEmail = email,
                AvatarUrl = request.AvatarUrl,
                LastLoginAtUtc = DateTime.UtcNow,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            };

            _context.SocialIdentities.Add(newSocialIdentity);
        }

        // 3. Resolve context memberships (if user also has staff profiles)
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

        return new LoginResponse(accessToken, refreshToken, expiresAtUtc, userDto, validMemberships);
    }
}
