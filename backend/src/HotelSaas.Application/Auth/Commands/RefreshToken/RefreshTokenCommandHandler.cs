using System.Security.Claims;
using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.RefreshToken;

/// <summary>
/// Handles atomic token refresh with root row-level locking (FOR UPDATE on Users),
/// strict token owner binding, concurrent rotation conflict resolution (5s window),
/// and isolated token family revocation upon token reuse detection.
/// </summary>
public sealed class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, LoginResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IMembershipLookupService _membershipLookupService;

    /// <summary>
    /// Initializes a new instance of <see cref="RefreshTokenCommandHandler"/>.
    /// </summary>
    public RefreshTokenCommandHandler(
        IApplicationDbContext context,
        IJwtService jwtService,
        IMembershipLookupService membershipLookupService)
    {
        _context = context;
        _jwtService = jwtService;
        _membershipLookupService = membershipLookupService;
    }

    /// <inheritdoc />
    public async Task<LoginResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        // 1. Validate expired access token structure and extract identity
        var principal = _jwtService.GetPrincipalFromExpiredToken(request.AccessToken);
        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? principal.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedAccessException("Token không hợp lệ.");
        }

        // Verify claims alias integrity on expired token
        var tenantIdClaim = principal.FindFirst("tenantId")?.Value;
        var tidClaim = principal.FindFirst("tid")?.Value
            ?? principal.FindFirst("http://schemas.microsoft.com/identity/claims/tenantid")?.Value;
        if (!string.IsNullOrEmpty(tenantIdClaim) || !string.IsNullOrEmpty(tidClaim))
        {
            if (string.IsNullOrEmpty(tenantIdClaim) || string.IsNullOrEmpty(tidClaim) ||
                !string.Equals(tenantIdClaim, tidClaim, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("ERR_TOKEN_TAMPERED: Claims tenantId và tid không khớp.");
            }
        }
        var tenantIdStr = tenantIdClaim ?? tidClaim;
        Guid? tenantId = Guid.TryParse(tenantIdStr, out var parsedTenantId) ? parsedTenantId : null;

        var propertyIdClaim = principal.FindFirst("propertyId")?.Value;
        var pidClaim = principal.FindFirst("pid")?.Value;
        if (!string.IsNullOrEmpty(propertyIdClaim) || !string.IsNullOrEmpty(pidClaim))
        {
            if (string.IsNullOrEmpty(propertyIdClaim) || string.IsNullOrEmpty(pidClaim) ||
                !string.Equals(propertyIdClaim, pidClaim, StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("ERR_TOKEN_TAMPERED: Claims propertyId và pid không khớp.");
            }
        }
        var propertyIdStr = propertyIdClaim ?? pidClaim;
        Guid? propertyId = Guid.TryParse(propertyIdStr, out var parsedPropertyId) ? parsedPropertyId : null;

        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);

        // 2. Root Synchronization Mutex: Lock user row using FOR UPDATE before reading token chain
        await _context.LockUserRowAsync(userId, cancellationToken);

        // 3. Fresh Read of the user's refresh token chain under Read Committed isolation
        var userTokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == userId)
            .ToListAsync(cancellationToken);

        var storedToken = userTokens.FirstOrDefault(rt => rt.Token == request.RefreshToken);

        if (storedToken is null)
        {
            throw new UnauthorizedAccessException("Refresh token không hợp lệ hoặc đã hết hạn.");
        }

        // 4. Token Owner Binding: sub must match storedToken.UserId
        if (storedToken.UserId != userId)
        {
            throw new UnauthorizedAccessException("ERR_TOKEN_USER_MISMATCH: Danh tính trong Access Token không khớp với Refresh Token.");
        }

        var now = DateTime.UtcNow;

        // 5. Reuse and Revocation Analysis
        if (storedToken.RevokedAtUtc.HasValue)
        {
            var elapsed = now - storedToken.RevokedAtUtc.Value;

            // Concurrent rotation window (<= 5 seconds)
            if (elapsed <= TimeSpan.FromSeconds(5) && !string.IsNullOrEmpty(storedToken.ReplacedByToken))
            {
                throw new ConflictException("ERR_REFRESH_CONCURRENCY",
                    "Yêu cầu làm mới token đang có xung đột tại thời điểm rotation. Vui lòng thử lại với token mới nhất.");
            }

            // Outside 5-second window: TOKEN REUSE DETECTED!
            // Revoke the exact Token Family (descendants and ancestors via ReplacedByToken)
            var familyTokens = FindTokenFamily(userTokens, storedToken);
            foreach (var token in familyTokens)
            {
                if (token.RevokedAtUtc == null)
                {
                    token.RevokedAtUtc = now;
                }
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            throw new UnauthorizedAccessException("ERR_TOKEN_REUSED: Phát hiện hành vi sử dụng lại token đã thu hồi ngoài cửa sổ xung đột. Toàn bộ phiên làm việc của token này đã bị hủy.");
        }

        // Expiration check
        if (storedToken.ExpiresAtUtc <= now)
        {
            throw new UnauthorizedAccessException("Refresh token không hợp lệ hoặc đã hết hạn.");
        }

        // 6. Load user profile
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null || !user.IsActive)
        {
            throw new UnauthorizedAccessException("ERR_USER_DEACTIVATED: Tài khoản người dùng đã bị vô hiệu hóa.");
        }

        // 7. Deterministically revalidate target context and membership
        IReadOnlyList<string>? permissionClaims = null;
        string? scope = null;
        string? staffRole = null;
        Guid? effectivePropertyId = null;
        Guid? effectiveTenantId = null;

        if (tenantId.HasValue)
        {
            var lookupResult = await _membershipLookupService.ResolveMembershipAsync(
                tenantId.Value,
                userId,
                propertyId,
                cancellationToken);

            switch (lookupResult.Status)
            {
                case Common.Models.MembershipLookupStatus.UserNotFoundOrInactive:
                    throw new UnauthorizedAccessException("ERR_USER_DEACTIVATED: Tài khoản người dùng đã bị vô hiệu hóa.");

                case Common.Models.MembershipLookupStatus.TenantNotFoundOrInactive:
                    throw new UnauthorizedAccessException("ERR_TENANT_INACTIVE: Doanh nghiệp hiện đang bị tạm ngưng hoạt động.");

                case Common.Models.MembershipLookupStatus.PropertyNotFound:
                    throw new UnauthorizedAccessException("ERR_PROPERTY_NOT_FOUND: Chi nhánh không tồn tại hoặc không thuộc tổ chức doanh nghiệp này.");

                case Common.Models.MembershipLookupStatus.PropertyInactive:
                    throw new UnauthorizedAccessException("ERR_PROPERTY_INACTIVE: Chi nhánh hiện đang tạm ngưng hoạt động.");

                case Common.Models.MembershipLookupStatus.MembershipRevoked:
                    throw new UnauthorizedAccessException("ERR_MEMBERSHIP_REVOKED: Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi.");

                case Common.Models.MembershipLookupStatus.PropertyForbidden:
                    throw new UnauthorizedAccessException("ERR_PROPERTY_FORBIDDEN: Bạn không có quyền truy cập vào chi nhánh này.");

                case Common.Models.MembershipLookupStatus.PropertyRequired:
                    throw new UnauthorizedAccessException("ERR_PROPERTY_REQUIRED: Yêu cầu chọn chi nhánh làm việc để tiếp tục.");

                case Common.Models.MembershipLookupStatus.NoMembership:
                    throw new UnauthorizedAccessException("ERR_FORBIDDEN: Tài khoản không có tư cách thành viên hợp lệ trong doanh nghiệp này.");

                case Common.Models.MembershipLookupStatus.Success:
                    break;

                default:
                    throw new UnauthorizedAccessException("ERR_MEMBERSHIP_INVALID: Không thể xác thực quyền truy cập hợp lệ.");
            }

            if (!lookupResult.RoleId.HasValue)
            {
                throw new UnauthorizedAccessException("ERR_MEMBERSHIP_INVALID: Không tìm thấy vai trò hợp lệ.");
            }

            permissionClaims = await _context.RolePermissions
                .AsNoTracking()
                .Where(rp => rp.RoleId == lookupResult.RoleId.Value)
                .Select(rp => $"{rp.Function!.Code}:{rp.ActionMask}")
                .ToListAsync(cancellationToken);

            scope = lookupResult.IsTenantWide ? "TenantWide" : "PropertyScoped";
            staffRole = lookupResult.StaffRole?.ToString();
            effectivePropertyId = lookupResult.PropertyId;
            effectiveTenantId = tenantId.Value;
        }

        // 8. Valid Token: Atomic Rotation
        storedToken.RevokedAtUtc = now;

        var (accessToken, newRefreshToken, expiresAtUtc) = _jwtService.GenerateTokens(
            user.Id,
            user.Email,
            user.FullName,
            user.GlobalRole.ToString(),
            effectiveTenantId,
            permissionClaims,
            effectivePropertyId,
            scope,
            staffRole);

        storedToken.ReplacedByToken = newRefreshToken;

        var refreshTokenEntity = new Domain.Entities.RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = newRefreshToken,
            ExpiresAtUtc = now.AddDays(_jwtService.GetRefreshTokenExpirationDays())
        };

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var userDto = new UserDto(
            user.Id,
            user.Email,
            user.FullName,
            user.GlobalRole.ToString(),
            effectiveTenantId);

        return new LoginResponse(accessToken, newRefreshToken, expiresAtUtc, userDto);
    }

    /// <summary>
    /// Traverses the singly-linked token rotation chain via ReplacedByToken both forward (descendants)
    /// and backward (ancestors) to isolate exactly the compromised token family.
    /// </summary>
    private static HashSet<Domain.Entities.RefreshToken> FindTokenFamily(
        List<Domain.Entities.RefreshToken> allUserTokens,
        Domain.Entities.RefreshToken seedToken)
    {
        var family = new HashSet<Domain.Entities.RefreshToken> { seedToken };

        // 1. Forward traversal: follow ReplacedByToken
        var curr = seedToken;
        while (!string.IsNullOrEmpty(curr.ReplacedByToken))
        {
            var next = allUserTokens.FirstOrDefault(t => t.Token == curr.ReplacedByToken);
            if (next == null || !family.Add(next))
            {
                break;
            }
            curr = next;
        }

        // 2. Backward traversal: find predecessors that were replaced by tokens in family
        var addedMore = true;
        while (addedMore)
        {
            addedMore = false;
            foreach (var token in allUserTokens)
            {
                if (!string.IsNullOrEmpty(token.ReplacedByToken) &&
                    family.Any(f => f.Token == token.ReplacedByToken) &&
                    family.Add(token))
                {
                    addedMore = true;
                }
            }
        }

        return family;
    }
}
