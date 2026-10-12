namespace HotelSaas.WebApi.Models;

/// <summary>
/// Payload for cancelling a reservation.
/// </summary>
public sealed class CancelReservationRequest
{
    /// <summary>
    /// Optional cancellation reason.
    /// </summary>
    public string? Reason { get; set; }
}
