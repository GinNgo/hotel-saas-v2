using System;
using System.Threading;
using System.Threading.Tasks;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Dispatches real-time events to active receptionist terminals and PMS staff via SignalR (Task A03 / T01).
/// </summary>
public interface INotificationDispatcher
{
    Task NotifyNewReservationConfirmedAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string guestName,
        string roomTypeName,
        decimal totalAmount,
        decimal depositPaid,
        CancellationToken cancellationToken = default);

    Task NotifyReservationStatusChangedAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string previousStatus,
        string newStatus,
        CancellationToken cancellationToken = default);

    Task NotifyHousekeepingAlertAsync(
        string propertyId,
        string roomNumber,
        string roomStatus,
        string message,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Dispatches Event 01: BookingPaymentConfirmed when payment is authoritatively confirmed (Task Week 05 T02).
    /// </summary>
    Task NotifyBookingPaymentConfirmedAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string guestName,
        decimal totalAmount,
        decimal paidAmount,
        string paymentMethod,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Dispatches Event 02: BookingCancellationRequested when guest cancels online or staff cancels booking (Task Week 05 T02).
    /// </summary>
    Task NotifyBookingCancellationRequestedAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string guestName,
        string reason,
        decimal refundableAmount,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Dispatches Event 03: HoldExpired when a 15-minute online booking hold expires on server (Task Week 05 T02).
    /// Returns true if dispatched successfully, false otherwise to prevent premature deduplication marking.
    /// </summary>
    Task<bool> NotifyHoldExpiredAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string roomTypeName,
        CancellationToken cancellationToken = default);
}
