using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Application.Auth.Commands.VerifyPhoneFirebase;

/// <summary>
/// Handles Phone OTP verification via Firebase ID Token.
/// Supports dual capability:
/// 1. Logged-in user linking/updating their verified phone number.
/// 2. Guest user phone-based login or frictionless auto-provisioning with Silver loyalty membership.
/// </summary>
public sealed class VerifyPhoneFirebaseCommandHandler : IRequestHandler<VerifyPhoneFirebaseCommand, LoginResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IFirebaseAuthService _firebaseAuthService;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtService _jwtService;
    private readonly ILogger<VerifyPhoneFirebaseCommandHandler> _logger;

    public VerifyPhoneFirebaseCommandHandler(
        IApplicationDbContext context,
        IFirebaseAuthService firebaseAuthService,
        ICurrentUserContext currentUserContext,
        IPasswordHasher passwordHasher,
        IJwtService jwtService,
        ILogger<VerifyPhoneFirebaseCommandHandler> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _firebaseAuthService = firebaseAuthService ?? throw new ArgumentNullException(nameof(firebaseAuthService));
        _currentUserContext = currentUserContext ?? throw new ArgumentNullException(nameof(currentUserContext));
        _passwordHasher = passwordHasher ?? throw new ArgumentNullException(nameof(passwordHasher));
        _jwtService = jwtService ?? throw new ArgumentNullException(nameof(jwtService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<LoginResponse> Handle(VerifyPhoneFirebaseCommand request, CancellationToken cancellationToken)
    {
        // 1. Verify token cryptographic signature with Google Identity Platform
        var verification = await _firebaseAuthService.VerifyIdTokenAsync(request.FirebaseIdToken, cancellationToken);
        if (!verification.IsValid || string.IsNullOrWhiteSpace(verification.PhoneNumber))
        {
            _logger.LogWarning("Firebase phone verification failed: {ErrorMessage}", verification.ErrorMessage);
            throw new BadRequestException("ERR_INVALID_FIREBASE_TOKEN", verification.ErrorMessage ?? "Mã xác thực số điện thoại Firebase không hợp lệ hoặc đã hết hạn.");
        }

        var verifiedPhone = verification.PhoneNumber;
        User user;

        // ── SCENARIO A: Currently logged-in user linking/verifying their phone number ──
        if (_currentUserContext.IsAuthenticated && _currentUserContext.UserId != Guid.Empty)
        {
            var currentUserId = _currentUserContext.UserId;
            user = await _context.Users.FirstOrDefaultAsync(u => u.Id == currentUserId, cancellationToken)
                ?? throw new NotFoundException("Tài khoản người dùng hiện tại không tồn tại trong hệ thống.");

            // Check if phone number is already taken by another account
            var duplicateUser = await _context.Users
                .FirstOrDefaultAsync(u => u.PhoneNumber == verifiedPhone && u.Id != currentUserId, cancellationToken);

            if (duplicateUser != null)
            {
                throw new ConflictException("ERR_PHONE_ALREADY_EXISTS", $"Số điện thoại {verifiedPhone} đã được liên kết với một tài khoản khác.");
            }

            user.PhoneNumber = verifiedPhone;
            user.PhoneVerifiedAtUtc = DateTime.UtcNow;
            user.UpdatedAtUtc = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Successfully verified and linked phone {Phone} to existing user {UserId}", verifiedPhone, user.Id);
        }
        // ── SCENARIO B: Guest user phone login or auto-provision ──
        else
        {
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.PhoneNumber == verifiedPhone, cancellationToken);

            if (existingUser != null)
            {
                user = existingUser;
                if (!user.IsActive)
                {
                    throw new UnauthorizedAccessException("Tài khoản đã bị tạm khóa. Vui lòng liên hệ bộ phận hỗ trợ.");
                }

                user.PhoneVerifiedAtUtc = DateTime.UtcNow;
                user.UpdatedAtUtc = DateTime.UtcNow;
                _logger.LogInformation("Existing user {UserId} logged in via verified phone {Phone}", user.Id, verifiedPhone);
            }
            else
            {
                // Auto-provision new Customer account
                var shortPhone = verifiedPhone.Length >= 4 ? verifiedPhone[^4..] : verifiedPhone;
                var displayName = !string.IsNullOrWhiteSpace(request.FullName)
                    ? request.FullName.Trim()
                    : $"Khách {shortPhone}";

                var syntheticEmail = $"{verifiedPhone.Replace("+", "").Trim()}@phone.hotelsaas.local";

                user = new User
                {
                    Id = Guid.NewGuid(),
                    Username = verifiedPhone,
                    Email = syntheticEmail,
                    FullName = displayName,
                    PhoneNumber = verifiedPhone,
                    PhoneVerifiedAtUtc = DateTime.UtcNow,
                    PasswordHash = _passwordHasher.Hash(Guid.NewGuid().ToString("N")),
                    GlobalRole = GlobalUserRole.Customer,
                    IsActive = true,
                    CreatedAtUtc = DateTime.UtcNow,
                    UpdatedAtUtc = DateTime.UtcNow
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);

                // Auto-create guest loyalty membership with default tenant
                var defaultTenant = await _context.Tenants
                    .Include(t => t.Properties)
                    .FirstOrDefaultAsync(cancellationToken);

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
                        PointsBalance = 50,
                        LifetimePoints = 50,
                        CompletedStaysCount = 0,
                        CreatedAtUtc = DateTime.UtcNow,
                        UpdatedAtUtc = DateTime.UtcNow
                    };
                    _context.GuestLoyaltyMemberships.Add(membership);
                    await _context.SaveChangesAsync(cancellationToken);
                }

                _logger.LogInformation("Auto-provisioned new Customer account {UserId} for phone {Phone}", user.Id, verifiedPhone);
            }
        }

        // 2. Resolve active tenant/property memberships (for staff users if any)
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

        // 3. Issue signed JWT Access and Refresh Tokens
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
