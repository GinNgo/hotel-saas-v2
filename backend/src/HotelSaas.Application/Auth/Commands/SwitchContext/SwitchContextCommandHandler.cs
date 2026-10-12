using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.SwitchContext;

/// <summary>
/// Command handler that verifies user authority for a target property,
/// locks the user row with FOR UPDATE, and issues new scoped JWT and refresh tokens.
/// </summary>
public sealed class SwitchContextCommandHandler : IRequestHandler<SwitchContextCommand, SwitchContextResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly IJwtService _jwtService;

    /// <summary>
    /// Initializes a new instance of <see cref="SwitchContextCommandHandler"/>.
    /// </summary>
    public SwitchContextCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        IJwtService jwtService)
    {
        _context = context;
        _userContext = userContext;
        _membershipLookupService = membershipLookupService;
        _jwtService = jwtService;
    }

    /// <inheritdoc />
    public async Task<SwitchContextResponse> Handle(
        SwitchContextCommand request,
        CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu xác thực danh tính để chuyển ngữ cảnh.");
        }

        // Verify target property existence (bypassing query filters to find owning tenant)
        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId, cancellationToken);

        if (property is null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);

        // 1. Root Synchronization Mutex: Lock user row using FOR UPDATE
        await _context.LockUserRowAsync(userId, cancellationToken);

        // 2. Deterministically resolve membership at target property
        var lookupResult = await _membershipLookupService.ResolveMembershipAsync(
            property.TenantId,
            userId,
            request.PropertyId,
            cancellationToken);

        if (lookupResult.Status == MembershipLookupStatus.MembershipRevoked)
        {
            throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED",
                lookupResult.ErrorMessage ?? "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi.");
        }

        if (lookupResult.Status != MembershipLookupStatus.Success || !lookupResult.RoleId.HasValue)
        {
            throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN",
                lookupResult.ErrorMessage ?? "Bạn không có quyền truy cập vào chi nhánh này.");
        }

        // 3. Load user profile
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null || !user.IsActive)
        {
            throw new UnauthorizedAccessException("Tài khoản người dùng đã bị khóa hoặc không tồn tại.");
        }

        // 4. Load permissions for the authoritative role
        var permissions = await _context.RolePermissions
            .AsNoTracking()
            .Where(rp => rp.RoleId == lookupResult.RoleId.Value)
            .Select(rp => $"{rp.Function!.Code}:{rp.ActionMask}")
            .ToListAsync(cancellationToken);

        var scope = lookupResult.IsTenantWide ? "TenantWide" : "PropertyScoped";

        // 5. Generate new scoped tokens with alias claims
        var (accessToken, newRefreshToken, expiresAtUtc) = _jwtService.GenerateTokens(
            user.Id,
            user.Email,
            user.FullName,
            user.GlobalRole.ToString(),
            property.TenantId,
            permissions,
            request.PropertyId,
            scope,
            lookupResult.StaffRole?.ToString());

        // 6. Persist new refresh token
        var refreshTokenEntity = new Domain.Entities.RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = newRefreshToken,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(_jwtService.GetRefreshTokenExpirationDays())
        };

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var currentContextDto = new CurrentContextDto(
            property.TenantId,
            request.PropertyId,
            scope,
            lookupResult.StaffRole?.ToString() ?? "Staff");

        return new SwitchContextResponse(
            accessToken,
            newRefreshToken,
            expiresAtUtc,
            currentContextDto);
    }
}
