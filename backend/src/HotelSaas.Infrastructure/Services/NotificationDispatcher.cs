using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Dispatches strongly-typed SignalR notifications to property-scoped groups (Task A03).
/// </summary>
public sealed class NotificationDispatcher : INotificationDispatcher
{
    private readonly IHubContext<NotificationHub, INotificationClient> _hubContext;
    private readonly ILogger<NotificationDispatcher> _logger;

    public NotificationDispatcher(
        IHubContext<NotificationHub, INotificationClient> hubContext,
        ILogger<NotificationDispatcher> logger)
    {
        _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task NotifyNewReservationConfirmedAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string guestName,
        string roomTypeName,
        decimal totalAmount,
        decimal depositPaid,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return;

        var groupName = NotificationHub.GetPropertyGroupName(propertyId);
        var payload = new ReservationNotificationPayload(
            ReservationId: reservationId,
            ConfirmationCode: confirmationCode,
            GuestName: guestName,
            RoomTypeName: roomTypeName,
            TotalAmount: totalAmount,
            DepositPaid: depositPaid,
            Status: "Confirmed",
            PropertyId: propertyId,
            CreatedAtUtc: DateTime.UtcNow.ToString("o")
        );

        try
        {
            await _hubContext.Clients.Group(groupName).ReceiveNewReservation(payload);
            _logger.LogInformation("SignalR dispatched ReceiveNewReservation to group {Group} for code {Code}", groupName, confirmationCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to dispatch SignalR notification to group {Group}", groupName);
        }
    }

    public async Task NotifyReservationStatusChangedAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string previousStatus,
        string newStatus,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return;

        var groupName = NotificationHub.GetPropertyGroupName(propertyId);
        var payload = new ReservationStatusNotificationPayload(
            ReservationId: reservationId,
            ConfirmationCode: confirmationCode,
            PreviousStatus: previousStatus,
            NewStatus: newStatus,
            PropertyId: propertyId,
            UpdatedAtUtc: DateTime.UtcNow.ToString("o")
        );

        try
        {
            await _hubContext.Clients.Group(groupName).ReceiveReservationStatusUpdated(payload);
            _logger.LogInformation("SignalR dispatched ReceiveReservationStatusUpdated to group {Group} for code {Code}", groupName, confirmationCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to dispatch SignalR status change to group {Group}", groupName);
        }
    }

    public async Task NotifyHousekeepingAlertAsync(
        string propertyId,
        string roomNumber,
        string roomStatus,
        string message,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return;

        var groupName = NotificationHub.GetPropertyGroupName(propertyId);
        var payload = new HousekeepingNotificationPayload(
            RoomNumber: roomNumber,
            RoomStatus: roomStatus,
            PropertyId: propertyId,
            Message: message,
            UpdatedAtUtc: DateTime.UtcNow.ToString("o")
        );

        try
        {
            await _hubContext.Clients.Group(groupName).ReceiveHousekeepingAlert(payload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to dispatch SignalR housekeeping alert to group {Group}", groupName);
        }
    }
}
