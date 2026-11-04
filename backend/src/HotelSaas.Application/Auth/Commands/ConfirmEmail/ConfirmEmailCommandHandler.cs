using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Application.Auth.Commands.ConfirmEmail;

/// <summary>
/// Handles user email confirmation: validates token signature and lifetime,
/// records confirmation timestamp, and activates user state idempotently.
/// </summary>
public sealed class ConfirmEmailCommandHandler : IRequestHandler<ConfirmEmailCommand, ConfirmEmailResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly ILogger<ConfirmEmailCommandHandler> _logger;

    public ConfirmEmailCommandHandler(
        IApplicationDbContext context,
        IJwtService jwtService,
        ILogger<ConfirmEmailCommandHandler> logger)
    {
        _context = context;
        _jwtService = jwtService;
        _logger = logger;
    }

    public async Task<ConfirmEmailResponse> Handle(ConfirmEmailCommand request, CancellationToken cancellationToken)
    {
        var (isValid, userId, email) = _jwtService.ValidateEmailVerificationToken(request.Token);
        if (!isValid || userId == Guid.Empty)
        {
            throw new BadRequestException("ERR_INVALID_TOKEN", "Mã xác thực email không hợp lệ hoặc đã hết hạn (chỉ có hiệu lực trong 30 phút).");
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("Tài khoản người dùng không tồn tại.");
        }

        if (user.EmailVerifiedAtUtc.HasValue)
        {
            return new ConfirmEmailResponse(true, "Email này đã được xác thực trước đó.", user.Email);
        }

        user.EmailVerifiedAtUtc = DateTime.UtcNow;
        user.IsActive = true;
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Successfully verified email for user {UserId} ({Email})", user.Id, user.Email);
        return new ConfirmEmailResponse(true, "Xác thực email thành công! Tài khoản của bạn đã được kích hoạt.", user.Email);
    }
}
