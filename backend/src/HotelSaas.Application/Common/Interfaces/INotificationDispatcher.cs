using System;
using System.Threading;
using System.Threading.Tasks;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Dispatches real-time events to active receptionist terminals and PMS staff via SignalR (Task A03).
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
}
