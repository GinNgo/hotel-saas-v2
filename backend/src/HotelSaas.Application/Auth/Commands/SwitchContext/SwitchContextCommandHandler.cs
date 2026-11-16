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

        Guid tenantId;
        Guid? targetPropertyId = request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty
            ? request.PropertyId.Value
            : null;

        if (!targetPropertyId.HasValue)
        {
            // Switching back to Chain HQ (TenantWide) scope
            tenantId = _userContext.TenantId ?? Guid.Empty;
            if (tenantId == Guid.Empty)
            {
                tenantId = await _context.TenantStaffMembers
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(s => s.UserId == userId && s.PropertyId == null && s.IsActive)
                    .Select(s => s.TenantId)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            if (tenantId == Guid.Empty)
            {
                throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN",
                    "Tài khoản của bạn chỉ được phân quyền theo chi nhánh, không có quyền truy cập chế độ Toàn chuỗi (HQ).");
            }
        }
        else
        {
            // Verify target property existence (bypassing query filters to find owning tenant)
            var property = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == targetPropertyId.Value, cancellationToken);

            if (property is null)
            {
                throw new NotFoundException("Chi nhánh không tồn tại.");
            }

            tenantId = property.TenantId;
        }

        await using var transaction = await _context.BeginTransactionAsync(cancellationToken);

        // 1. Root Synchronization Mutex: Lock user row using FOR UPDATE
        await _context.LockUserRowAsync(userId, cancellationToken);

        // 2. Deterministically resolve membership at target property or HQ (null)
        var lookupResult = await _membershipLookupService.ResolveMembershipAsync(
            tenantId,
            userId,
            targetPropertyId,
            cancellationToken);

        if (lookupResult.Status == MembershipLookupStatus.MembershipRevoked)
        {
            throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED",
                lookupResult.ErrorMessage ?? "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi.");
        }

        if (lookupResult.Status != MembershipLookupStatus.Success || !lookupResult.RoleId.HasValue)
        {
            var forbiddenMessage = !targetPropertyId.HasValue
                ? "Tài khoản của bạn chỉ được phân quyền theo chi nhánh, không có quyền truy cập chế độ Toàn chuỗi (HQ)."
                : (lookupResult.ErrorMessage ?? "Bạn không có quyền truy cập vào chi nhánh này.");

            throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", forbiddenMessage);
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

        var scope = !targetPropertyId.HasValue || lookupResult.IsTenantWide ? "TenantWide" : "PropertyScoped";
        var roleName = lookupResult.StaffRole?.ToString() ?? (!targetPropertyId.HasValue ? "Owner" : "Staff");

        // 5. Generate new scoped tokens with alias claims
        var (accessToken, newRefreshToken, expiresAtUtc) = _jwtService.GenerateTokens(
            user.Id,
            user.Email,
            user.FullName,
            user.GlobalRole.ToString(),
            tenantId,
            permissions,
            targetPropertyId,
            scope,
            roleName);

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
            tenantId,
            targetPropertyId,
            scope,
            roleName);

        return new SwitchContextResponse(
            accessToken,
            newRefreshToken,
            expiresAtUtc,
            currentContextDto);
    }
}
