using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Dispatches strongly-typed SignalR notifications to property-scoped groups (Task A03 / T01).
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
            _logger.LogInformation("SignalR dispatched ReceiveHousekeepingAlert to group {Group} for room {Room}", groupName, roomNumber);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to dispatch SignalR housekeeping alert to group {Group}", groupName);
        }
    }

    public async Task NotifyBookingPaymentConfirmedAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string guestName,
        decimal totalAmount,
        decimal paidAmount,
        string paymentMethod,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return;

        var financialGroupName = NotificationHub.GetPropertyFinancialGroupName(propertyId);
        var frontdeskGroupName = NotificationHub.GetPropertyFrontdeskGroupName(propertyId);
        var eventId = $"evt-pay-{confirmationCode}";

        // 1. Detailed financial payload strictly for Manager / Owner / Financial Authority
        var financialPayload = new PaymentConfirmedNotificationPayload(
            EventId: eventId,
            ReservationId: reservationId,
            ConfirmationCode: confirmationCode,
            GuestName: guestName,
            TotalAmount: totalAmount,
            PaidAmount: paidAmount,
            PaymentMethod: paymentMethod,
            PropertyId: propertyId,
            CreatedAtUtc: DateTime.UtcNow.ToString("o"),
            TargetRoute: $"/reservations?code={confirmationCode}"
        );

        // 2. Sanitized operational payload for Receptionists (zero financial figures, no payment method details)
        var frontdeskPayload = new PaymentConfirmedNotificationPayload(
            EventId: eventId,
            ReservationId: reservationId,
            ConfirmationCode: confirmationCode,
            GuestName: guestName,
            TotalAmount: 0m,
            PaidAmount: 0m,
            PaymentMethod: string.Empty,
            PropertyId: propertyId,
            CreatedAtUtc: DateTime.UtcNow.ToString("o"),
            TargetRoute: $"/reservations?code={confirmationCode}"
        );

        try
        {
            await _hubContext.Clients.Group(financialGroupName).ReceiveBookingPaymentConfirmed(financialPayload);
            _logger.LogInformation("SignalR dispatched ReceiveBookingPaymentConfirmed (financial) to group {Group} for code {Code}",
                financialGroupName, confirmationCode);

            await _hubContext.Clients.Group(frontdeskGroupName).ReceiveBookingPaymentConfirmed(frontdeskPayload);
            _logger.LogInformation("SignalR dispatched ReceiveBookingPaymentConfirmed (sanitized frontdesk) to group {Group} for code {Code}",
                frontdeskGroupName, confirmationCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to dispatch SignalR BookingPaymentConfirmed for property {PropertyId}", propertyId);
        }
    }

    public async Task NotifyBookingCancellationRequestedAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string guestName,
        string reason,
        decimal refundableAmount,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return;

        var frontdeskGroupName = NotificationHub.GetPropertyFrontdeskGroupName(propertyId);
        var financialGroupName = NotificationHub.GetPropertyFinancialGroupName(propertyId);
        var eventId = $"evt-cancel-{confirmationCode}";

        try
        {
            // 1. Dispatch full financial detail to Manager / Financial role
            var financialPayload = new BookingCancellationNotificationPayload(
                EventId: eventId,
                ReservationId: reservationId,
                ConfirmationCode: confirmationCode,
                GuestName: guestName,
                Reason: reason,
                RefundableAmount: refundableAmount,
                PropertyId: propertyId,
                CreatedAtUtc: DateTime.UtcNow.ToString("o"),
                TargetRoute: refundableAmount > 0 ? "/payments" : $"/reservations?code={confirmationCode}"
            );
            await _hubContext.Clients.Group(financialGroupName).ReceiveBookingCancellationRequested(financialPayload);
            _logger.LogInformation("SignalR dispatched BookingCancellationRequested (financial) to {Group} for code {Code}",
                financialGroupName, confirmationCode);

            // 2. Dispatch sanitized operational alert to frontdesk channel (RefundableAmount: 0, no payout leakage)
            var operationalPayload = new BookingCancellationNotificationPayload(
                EventId: eventId,
                ReservationId: reservationId,
                ConfirmationCode: confirmationCode,
                GuestName: guestName,
                Reason: reason,
                RefundableAmount: 0m,
                PropertyId: propertyId,
                CreatedAtUtc: DateTime.UtcNow.ToString("o"),
                TargetRoute: $"/reservations?code={confirmationCode}"
            );
            await _hubContext.Clients.Group(frontdeskGroupName).ReceiveBookingCancellationRequested(operationalPayload);
            _logger.LogInformation("SignalR dispatched ReceiveBookingCancellationRequested (sanitized frontdesk) to {Group} for code {Code}",
                frontdeskGroupName, confirmationCode);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to dispatch SignalR BookingCancellationRequested for property {PropertyId}", propertyId);
        }
    }

    public async Task<bool> NotifyHoldExpiredAsync(
        string propertyId,
        string reservationId,
        string confirmationCode,
        string roomTypeName,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return false;

        var groupName = NotificationHub.GetPropertyGroupName(propertyId);
        var eventId = $"evt-holdexp-{confirmationCode}";
        var payload = new HoldExpiredNotificationPayload(
            EventId: eventId,
            ReservationId: reservationId,
            ConfirmationCode: confirmationCode,
            RoomTypeName: roomTypeName,
            PropertyId: propertyId,
            CreatedAtUtc: DateTime.UtcNow.ToString("o"),
            TargetRoute: $"/reservations?code={confirmationCode}"
        );

        try
        {
            await _hubContext.Clients.Group(groupName).ReceiveHoldExpired(payload);
            _logger.LogInformation("SignalR dispatched ReceiveHoldExpired to group {Group} for code {Code}",
                groupName, confirmationCode);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to dispatch SignalR HoldExpired to group {Group}", groupName);
            return false;
        }
    }
}
