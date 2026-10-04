using HotelSaas.Application.Auth.DTOs;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.Register;

/// <summary>
/// Handles user registration: validates email uniqueness, hashes password, and persists the new user.
/// </summary>
public sealed class RegisterCommandHandler : IRequestHandler<RegisterCommand, RegisterResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    /// <summary>
    /// Initializes a new instance of <see cref="RegisterCommandHandler"/>.
    /// </summary>
    public RegisterCommandHandler(IApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    /// <inheritdoc />
    public async Task<RegisterResponse> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var emailExists = await _context.Users
            .AnyAsync(u => u.Email.ToLower() == request.Email.ToLower(), cancellationToken);

        if (emailExists)
            throw new InvalidOperationException("Email đã được sử dụng.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email.Trim().ToLower(),
            Username = request.Email.Trim().ToLower(),
            PasswordHash = _passwordHasher.Hash(request.Password),
            FullName = request.FullName.Trim(),
            GlobalRole = GlobalUserRole.Customer,
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        return new RegisterResponse(user.Id, "Đăng ký thành công.");
    }
}
