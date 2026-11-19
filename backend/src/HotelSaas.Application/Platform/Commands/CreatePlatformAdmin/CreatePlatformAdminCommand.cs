using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Platform.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Commands.CreatePlatformAdmin;

/// <summary>
/// Command allowing a SuperAdmin to provision a new verified SuperAdmin account on the platform.
/// </summary>
public sealed record CreatePlatformAdminCommand(
    string Email,
    string FullName,
    string Password,
    string? PhoneNumber = null
) : IRequest<PlatformUserDto>;

/// <summary>
/// Handles <see cref="CreatePlatformAdminCommand"/> with email uniqueness, unique username generation, and password hashing.
/// </summary>
public sealed class CreatePlatformAdminCommandHandler
    : IRequestHandler<CreatePlatformAdminCommand, PlatformUserDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IPasswordHasher _passwordHasher;

    public CreatePlatformAdminCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUserContext,
        IPasswordHasher passwordHasher)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUserContext = currentUserContext ?? throw new ArgumentNullException(nameof(currentUserContext));
        _passwordHasher = passwordHasher ?? throw new ArgumentNullException(nameof(passwordHasher));
    }

    public async Task<PlatformUserDto> Handle(
        CreatePlatformAdminCommand request,
        CancellationToken cancellationToken)
    {
        PlatformUserMapper.EnsureSuperAdmin(_currentUserContext);

        var email = request.Email.Trim().ToLowerInvariant();

        var emailExists = await _context.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Email != null && u.Email.ToLower() == email, cancellationToken);

        if (emailExists)
        {
            throw new ConflictException(
                "ERR_EMAIL_EXISTS",
                "Email này đã được sử dụng trên hệ thống.");
        }

        var username = await GenerateUniqueUsernameAsync(email, cancellationToken);
        var now = DateTime.UtcNow;

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            Username = username,
            FullName = request.FullName.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim(),
            PasswordHash = _passwordHasher.Hash(request.Password),
            GlobalRole = GlobalUserRole.SuperAdmin,
            IsActive = true,
            EmailVerifiedAtUtc = now,
            PhoneVerifiedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        return await PlatformUserMapper.BuildDtoForSingleUserAsync(_context, user, cancellationToken);
    }

    private async Task<string> GenerateUniqueUsernameAsync(string normalizedEmail, CancellationToken cancellationToken)
    {
        var atIndex = normalizedEmail.IndexOf('@');
        var prefix = atIndex > 0 ? normalizedEmail[..atIndex] : normalizedEmail;

        var prefixTaken = await _context.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Username != null && u.Username.ToLower() == prefix, cancellationToken);

        if (!prefixTaken)
        {
            return prefix;
        }

        var emailUsernameTaken = await _context.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Username != null && u.Username.ToLower() == normalizedEmail, cancellationToken);

        if (!emailUsernameTaken)
        {
            return normalizedEmail;
        }

        return $"{prefix}-{Guid.NewGuid().ToString("N")[..6]}";
    }
}
