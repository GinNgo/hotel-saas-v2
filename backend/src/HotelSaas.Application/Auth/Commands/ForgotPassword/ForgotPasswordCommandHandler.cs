using System.Security.Cryptography;
using System.Text;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Application.Auth.Commands.ForgotPassword;

/// <summary>
/// Generates a short-lived password reset token bound to a SHA-256 fingerprint of the current PasswordHash
/// and dispatches a password reset email without disclosing account existence.
/// </summary>
public sealed class ForgotPasswordCommandHandler : IRequestHandler<ForgotPasswordCommand, ApiResponse<object?>>
{
    private const string GenericSuccessMessage =
        "Nếu email tồn tại trên hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.";

    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IEmailService _emailService;
    private readonly ILogger<ForgotPasswordCommandHandler>? _logger;

    public ForgotPasswordCommandHandler(
        IApplicationDbContext context,
        IJwtService jwtService,
        IEmailService emailService,
        ILogger<ForgotPasswordCommandHandler>? logger = null)
    {
        _context = context;
        _jwtService = jwtService;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<ApiResponse<object?>> Handle(ForgotPasswordCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user is { IsActive: true })
        {
            var fingerprint = ComputePasswordFingerprint(user.PasswordHash);
            var token = _jwtService.GeneratePasswordResetToken(
                user.Id,
                user.Email,
                fingerprint,
                TimeSpan.FromMinutes(30));

            var baseUrl = ResolveSafeAppUrl(request.AppUrl);
            var resetUrl = $"{baseUrl}/auth/reset-password?token={Uri.EscapeDataString(token)}";

            try
            {
                await _emailService.SendPasswordResetEmailAsync(
                    user.Email,
                    user.FullName,
                    resetUrl,
                    30,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogWarning(ex, "Failed to dispatch password reset email to {Email}", user.Email);
            }
        }

        return ApiResponse.Ok(GenericSuccessMessage);
    }

    internal static string ComputePasswordFingerprint(string? passwordHash)
    {
        var input = passwordHash ?? string.Empty;
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
    }

    internal static string ResolveSafeAppUrl(string? appUrl)
    {
        if (!string.IsNullOrWhiteSpace(appUrl) &&
            Uri.TryCreate(appUrl.Trim(), UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            return uri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
        }

        return "https://luxustay.duckdns.org";
    }
}
