using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Application.Auth.Commands.Register;

/// <summary>
/// Handles user registration: validates email uniqueness, hashes password, saves user with phone/avatar,
/// generates secure verification token, and dispatches email verification.
/// </summary>
public sealed class RegisterCommandHandler : IRequestHandler<RegisterCommand, RegisterResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtService _jwtService;
    private readonly IEmailService _emailService;
    private readonly ILogger<RegisterCommandHandler> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="RegisterCommandHandler"/>.
    /// </summary>
    public RegisterCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IJwtService jwtService,
        IEmailService emailService,
        ILogger<RegisterCommandHandler> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtService = jwtService;
        _emailService = emailService;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<RegisterResponse> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var emailExists = await _context.Users
            .AnyAsync(u => u.Email.ToLower() == request.Email.ToLower(), cancellationToken);

        if (emailExists)
            throw new ConflictException("Email đã được sử dụng.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email.Trim().ToLower(),
            Username = request.Email.Trim().ToLower(),
            PasswordHash = _passwordHasher.Hash(request.Password),
            FullName = request.FullName.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim(),
            AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim(),
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true,
            EmailVerifiedAtUtc = null
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        // Generate secure 30-minute verification token
        var verificationToken = _jwtService.GenerateEmailVerificationToken(user.Id, user.Email, TimeSpan.FromMinutes(30));
        var appUrl = !string.IsNullOrWhiteSpace(request.AppUrl)
            ? request.AppUrl.Trim().TrimEnd('/')
            : "https://luxustay.duckdns.org";
        var verificationUrl = $"{appUrl}/confirm-email?token={Uri.EscapeDataString(verificationToken)}";

        // Dispatch Verification Email asynchronously without blocking client registration response
        try
        {
            await _emailService.SendVerificationEmailAsync(user.Email, user.FullName, verificationUrl, 30, cancellationToken);
            _logger.LogInformation("Dispatched verification email to newly registered user {Email} with URL {Url}", user.Email, verificationUrl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not send verification email to {Email}", user.Email);
        }

        return new RegisterResponse(user.Id, "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.");
    }
}
