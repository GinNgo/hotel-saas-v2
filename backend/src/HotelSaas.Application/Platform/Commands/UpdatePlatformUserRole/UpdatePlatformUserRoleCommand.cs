using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Commands.UpdatePlatformUserRole;

/// <summary>
/// Command allowing a SuperAdmin to promote or demote another platform user's global role.
/// </summary>
public sealed record UpdatePlatformUserRoleCommand(
    Guid UserId,
    GlobalUserRole TargetRole
) : IRequest<PlatformUserDto>;

/// <summary>
/// Handles <see cref="UpdatePlatformUserRoleCommand"/> with self-demotion and last-SuperAdmin safety guardrails.
/// </summary>
public sealed class UpdatePlatformUserRoleCommandHandler
    : IRequestHandler<UpdatePlatformUserRoleCommand, PlatformUserDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUserContext;

    public UpdatePlatformUserRoleCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUserContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUserContext = currentUserContext ?? throw new ArgumentNullException(nameof(currentUserContext));
    }

    public async Task<PlatformUserDto> Handle(
        UpdatePlatformUserRoleCommand request,
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

        if (user.Id == _currentUserContext.UserId && user.GlobalRole != request.TargetRole)
        {
            throw new BadRequestException(
                "ERR_SELF_ROLE_CHANGE_FORBIDDEN",
                "Không thể tự thay đổi vai trò của tài khoản SuperAdmin đang đăng nhập.");
        }

        if (user.GlobalRole == GlobalUserRole.SuperAdmin &&
            request.TargetRole != GlobalUserRole.SuperAdmin &&
            user.IsActive)
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

        var previousRole = user.GlobalRole;
        var now = DateTime.UtcNow;
        user.GlobalRole = request.TargetRole;

        if (request.TargetRole == GlobalUserRole.SuperAdmin)
        {
            user.EmailVerifiedAtUtc ??= now;
            user.PhoneVerifiedAtUtc ??= now;
        }

        user.UpdatedAtUtc = now;

        try
        {
            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = user.TenantId ?? Guid.Empty,
                PropertyId = null,
                UserId = _currentUserContext.UserId != Guid.Empty ? _currentUserContext.UserId : null,
                Action = AuditActions.Update,
                EntityName = nameof(User),
                EntityId = user.Id,
                OldValues = JsonSerializer.Serialize(new { GlobalRole = previousRole.ToString() }),
                NewValues = JsonSerializer.Serialize(new
                {
                    GlobalRole = request.TargetRole.ToString(),
                    Email = user.Email
                }),
                IpAddress = _currentUserContext.IpAddress,
                CreatedAtUtc = now
            });
        }
        catch (NotImplementedException)
        {
            // Optional AuditLogs DbSet in minimal test stubs
        }

        await _context.SaveChangesAsync(cancellationToken);

        return await PlatformUserMapper.BuildDtoForSingleUserAsync(_context, user, cancellationToken);
    }
}
