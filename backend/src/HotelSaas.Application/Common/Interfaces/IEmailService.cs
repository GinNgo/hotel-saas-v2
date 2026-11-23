namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Interface for sending transactional and operational emails across the platform.
/// </summary>
public interface IEmailService
{
    /// <summary>
    /// Sends an email verification request link to a registered customer.
    /// </summary>
    Task<bool> SendVerificationEmailAsync(
        string targetEmail,
        string customerName,
        string verificationUrl,
        long expiresInMinutes = 30,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a welcome email upon successful account registration.
    /// </summary>
    Task<bool> SendWelcomeEmailAsync(
        string targetEmail,
        string customerName,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a password reset link containing a time-limited token.
    /// </summary>
    Task<bool> SendPasswordResetEmailAsync(
        string targetEmail,
        string customerName,
        string resetUrl,
        long expiresInMinutes = 30,
        CancellationToken cancellationToken = default)
        => Task.FromResult(false);

    /// <summary>
    /// Sends a staff onboarding invitation link to set the initial password.
    /// </summary>
    Task<bool> SendStaffInvitationEmailAsync(
        string targetEmail,
        string staffName,
        string setupPasswordUrl,
        long expiresInMinutes = 1440,
        CancellationToken cancellationToken = default)
        => Task.FromResult(false);
}
