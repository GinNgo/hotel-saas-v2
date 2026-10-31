namespace HotelSaas.WebApi.Models;

/// <summary>
/// Payload submitted by a guest to request cancellation of their booking.
/// </summary>
public sealed class CancelGuestBookingRequest
{
    /// <summary>
    /// Guest email or phone number for identity ownership verification.
    /// </summary>
    public string? VerificationEmailOrPhone { get; set; }

    /// <summary>
    /// Optional cancellation reason provided by the guest.
    /// </summary>
    public string? Reason { get; set; }

    /// <summary>
    /// Optional client idempotency key to prevent double submission.
    /// </summary>
    public string? IdempotencyKey { get; set; }
}

