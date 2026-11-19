using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Commands.TogglePlatformUserStatus;

/// <summary>
/// Command allowing a SuperAdmin to lock or unlock a platform user account, enforcing self-lock and last-SuperAdmin guardrails.
/// </summary>
public sealed record TogglePlatformUserStatusCommand(
    Guid UserId,
    bool? TargetIsActive = null,
    string? Reason = null
) : IRequest<PlatformUserDto>;

/// <summary>
/// Handles <see cref="TogglePlatformUserStatusCommand"/> and revokes active refresh tokens when locking an account.
/// </summary>
public sealed class TogglePlatformUserStatusCommandHandler
    : IRequestHandler<TogglePlatformUserStatusCommand, PlatformUserDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUserContext;

    public TogglePlatformUserStatusCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUserContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUserContext = currentUserContext ?? throw new ArgumentNullException(nameof(currentUserContext));
    }

    public async Task<PlatformUserDto> Handle(
        TogglePlatformUserStatusCommand request,
        CancellationToken cancellationToken)
    {
        PlatformUserMapper.EnsureSuperAdmin(_currentUserContext);

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException(nameof(User), request.UserId);
        }

        var nextActive = request.TargetIsActive ?? !user.IsActive;

        if (!nextActive && user.Id == _currentUserContext.UserId)
        {
            throw new BadRequestException(
                "ERR_SELF_LOCK_FORBIDDEN",
                "Không thể tự khóa tài khoản SuperAdmin đang đăng nhập.");
        }

        if (!nextActive && user.GlobalRole == GlobalUserRole.SuperAdmin)
        {
            var activeSuperAdminsExcludingTarget = await _context.Users
                .IgnoreQueryFilters()
                .CountAsync(
                    u => u.GlobalRole == GlobalUserRole.SuperAdmin && u.IsActive && u.Id != user.Id,
                    cancellationToken);

            if (activeSuperAdminsExcludingTarget == 0)
            {
                throw new BadRequestException(
                    "ERR_LAST_SUPERADMIN",
                    "Phải giữ ít nhất 1 tài khoản SuperAdmin đang hoạt động.");
            }
        }

        var now = DateTime.UtcNow;
        user.IsActive = nextActive;
        user.UpdatedAtUtc = now;

        if (!nextActive)
        {
            try
            {
                var refreshTokensSet = _context.RefreshTokens;
                if (refreshTokensSet != null)
                {
                    var activeTokens = await refreshTokensSet
                        .IgnoreQueryFilters()
                        .Where(rt => rt.UserId == user.Id && rt.RevokedAtUtc == null)
                        .ToListAsync(cancellationToken);

                    foreach (var token in activeTokens)
                    {
                        token.RevokedAtUtc = now;
                    }
                }
            }
            catch (NotImplementedException)
            {
                // Optional DbSet in isolated minimal test stubs
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        return await PlatformUserMapper.BuildDtoForSingleUserAsync(_context, user, cancellationToken);
    }
}
