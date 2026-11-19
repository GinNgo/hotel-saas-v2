using HotelSaas.Application.Auth.Commands.ForgotPassword;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.ResetPassword;

/// <summary>
/// Validates a password reset token and its bound PasswordHash fingerprint, updates the user's password,
/// and revokes all active refresh tokens for security.
/// </summary>
public sealed class ResetPasswordCommandHandler : IRequestHandler<ResetPasswordCommand, ApiResponse<object?>>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IPasswordHasher _passwordHasher;

    public ResetPasswordCommandHandler(
        IApplicationDbContext context,
        IJwtService jwtService,
        IPasswordHasher passwordHasher)
    {
        _context = context;
        _jwtService = jwtService;
        _passwordHasher = passwordHasher;
    }

    public async Task<ApiResponse<object?>> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var (isValid, userId, email, tokenFingerprint) = _jwtService.ValidatePasswordResetToken(request.Token);
        if (!isValid || userId == Guid.Empty)
        {
            throw new BadRequestException("ERR_INVALID_RESET_TOKEN", "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
        }

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user is null || !user.IsActive)
        {
            throw new BadRequestException("ERR_INVALID_RESET_TOKEN", "Liên kết đặt lại mật khẩu không hợp lệ hoặc tài khoản đã bị khóa.");
        }

        var currentFingerprint = ForgotPasswordCommandHandler.ComputePasswordFingerprint(user.PasswordHash);
        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(currentFingerprint, tokenFingerprint, StringComparison.Ordinal))
        {
            throw new BadRequestException("ERR_RESET_TOKEN_USED", "Liên kết đặt lại mật khẩu đã được sử dụng hoặc không còn hiệu lực.");
        }

        var now = DateTime.UtcNow;
        user.PasswordHash = _passwordHasher.Hash(request.NewPassword);
        user.EmailVerifiedAtUtc ??= now;
        user.UpdatedAtUtc = now;

        var activeTokens = await _context.RefreshTokens
            .Where(rt => rt.UserId == user.Id && rt.RevokedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var rt in activeTokens)
        {
            rt.RevokedAtUtc = now;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return ApiResponse.Ok("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.");
    }
}
