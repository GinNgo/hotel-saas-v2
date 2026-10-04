namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Service for securely hashing and verifying user passwords.
/// </summary>
public interface IPasswordHasher
{
    /// <summary>
    /// Generates a BCrypt hash of the given password.
    /// </summary>
    string Hash(string password);

    /// <summary>
    /// Verifies a plain-text password against a stored hash.
    /// </summary>
    bool Verify(string password, string hash);
}
