using HotelSaas.Application.Auth.Commands.ForgotPassword;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Application.Auth.Commands.ResendConfirmation;

/// <summary>
/// Re-issues a 30-minute signed email confirmation link for unverified accounts.
/// Returns non-enumerating success for anonymous requests.
/// </summary>
public sealed class ResendConfirmationCommandHandler : IRequestHandler<ResendConfirmationCommand, ApiResponse<object?>>
{
    private const string AnonymousGenericMessage =
        "Nếu tài khoản tồn tại và chưa xác thực, email kích hoạt mới đã được gửi.";

    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IJwtService _jwtService;
    private readonly IEmailService _emailService;
    private readonly ILogger<ResendConfirmationCommandHandler>? _logger;

    public ResendConfirmationCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUserContext,
        IJwtService jwtService,
        IEmailService emailService,
        ILogger<ResendConfirmationCommandHandler>? logger = null)
    {
        _context = context;
        _currentUserContext = currentUserContext;
        _jwtService = jwtService;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<ApiResponse<object?>> Handle(ResendConfirmationCommand request, CancellationToken cancellationToken)
    {
        var baseUrl = ForgotPasswordCommandHandler.ResolveSafeAppUrl(request.AppUrl);

        if (_currentUserContext.IsAuthenticated && _currentUserContext.UserId != Guid.Empty)
        {
            var currentUser = await _context.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == _currentUserContext.UserId, cancellationToken);

            if (currentUser is null || !currentUser.IsActive)
            {
                throw new UnauthorizedAccessException("Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.");
            }

            if (currentUser.EmailVerifiedAtUtc.HasValue)
            {
                return ApiResponse.Ok("Địa chỉ email của bạn đã được xác thực trước đó.");
            }

            await SendVerificationAsync(currentUser, baseUrl, cancellationToken);
            return ApiResponse.Ok("Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư của bạn.");
        }

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            throw new BadRequestException("ERR_EMAIL_REQUIRED", "Vui lòng nhập địa chỉ email để gửi lại liên kết xác thực.");
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user is { IsActive: true } && !user.EmailVerifiedAtUtc.HasValue)
        {
            await SendVerificationAsync(user, baseUrl, cancellationToken);
        }

        return ApiResponse.Ok(AnonymousGenericMessage);
    }

    private async Task SendVerificationAsync(User user, string baseUrl, CancellationToken cancellationToken)
    {
        var token = _jwtService.GenerateEmailVerificationToken(user.Id, user.Email, TimeSpan.FromMinutes(30));
        var verificationUrl = $"{baseUrl}/confirm-email?token={Uri.EscapeDataString(token)}";

        try
        {
            await _emailService.SendVerificationEmailAsync(
                user.Email,
                user.FullName,
                verificationUrl,
                30,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Could not resend confirmation email to {Email}", user.Email);
        }
    }
}
