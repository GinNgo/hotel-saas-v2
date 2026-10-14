using HotelSaas.Application.Common.Interfaces;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// BCrypt-based password hashing service for secure credential storage.
/// Uses a work factor of 10 for a balance between security and performance.
/// </summary>
public sealed class PasswordHasherService : IPasswordHasher
{
    /// <inheritdoc />
    public string Hash(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, workFactor: 10);

    /// <inheritdoc />
    public bool Verify(string password, string hash) =>
        BCrypt.Net.BCrypt.Verify(password, hash);
}
