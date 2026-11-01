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
/// Handles user registration: validates email uniqueness, hashes password, saves user with phone/avatar, and dispatches welcome/verification email.
/// </summary>
public sealed class RegisterCommandHandler : IRequestHandler<RegisterCommand, RegisterResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IEmailService _emailService;
    private readonly ILogger<RegisterCommandHandler> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="RegisterCommandHandler"/>.
    /// </summary>
    public RegisterCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IEmailService emailService,
        ILogger<RegisterCommandHandler> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
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

        // Dispatch Welcome / Verification Email asynchronously without blocking client registration response
        try
        {
            await _emailService.SendWelcomeEmailAsync(user.Email, user.FullName, cancellationToken);
            _logger.LogInformation("Dispatched welcome email to newly registered user {Email}", user.Email);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not send welcome email to {Email}", user.Email);
        }

        return new RegisterResponse(user.Id, "Đăng ký thành công.");
    }
}
