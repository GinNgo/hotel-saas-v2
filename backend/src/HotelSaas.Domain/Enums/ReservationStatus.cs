namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the lifecycle status of a reservation.
/// </summary>
public enum ReservationStatus
{
    /// <summary>
    /// Reservation created but awaiting payment confirmation.
    /// </summary>
    PendingPayment = 1,

    /// <summary>
    /// Payment received and reservation is confirmed.
    /// </summary>
    Confirmed = 2,

    /// <summary>
    /// Guest has checked in.
    /// </summary>
    CheckedIn = 3,

    /// <summary>
    /// Guest has checked out.
    /// </summary>
    CheckedOut = 4,

    /// <summary>
    /// Reservation has been cancelled.
    /// </summary>
    Cancelled = 5,

    /// <summary>
    /// Guest did not arrive for the reservation.
    /// </summary>
    NoShow = 6
}
