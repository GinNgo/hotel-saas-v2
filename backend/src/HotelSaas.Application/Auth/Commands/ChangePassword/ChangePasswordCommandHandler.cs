using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.ChangePassword;

/// <summary>
/// Handles authenticated password change: verifies current password, sets new BCrypt hash,
/// and revokes all active refresh tokens.
/// </summary>
public sealed class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand, ApiResponse<object?>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IPasswordHasher _passwordHasher;

    public ChangePasswordCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUserContext,
        IPasswordHasher passwordHasher)
    {
        _context = context;
        _currentUserContext = currentUserContext;
        _passwordHasher = passwordHasher;
    }

    public async Task<ApiResponse<object?>> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.UserId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập để đổi mật khẩu.");
        }

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == _currentUserContext.UserId, cancellationToken);

        if (user is null || !user.IsActive)
        {
            throw new UnauthorizedAccessException("Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.");
        }

        if (string.IsNullOrEmpty(user.PasswordHash) ||
            !_passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            throw new BadRequestException("ERR_INVALID_CURRENT_PASSWORD", "Mật khẩu hiện tại không chính xác.");
        }

        var now = DateTime.UtcNow;
        user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
        user.UpdatedAtUtc = now;

        var activeTokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == user.Id && rt.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var rt in activeTokens)
        {
            rt.RevokedAtUtc = now;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return ApiResponse.Ok("Đổi mật khẩu thành công.");
    }
}
