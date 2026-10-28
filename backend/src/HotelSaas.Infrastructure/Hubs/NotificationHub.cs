using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;

namespace HotelSaas.Infrastructure.Hubs;

/// <summary>
/// Strongly-typed client contract for receptionist terminals and guest notifications.
/// </summary>
public interface INotificationClient
{
    Task ReceiveNewReservation(ReservationNotificationPayload notification);
    Task ReceiveReservationStatusUpdated(ReservationStatusNotificationPayload notification);
    Task ReceiveHousekeepingAlert(HousekeepingNotificationPayload alert);
}

public sealed record ReservationNotificationPayload(
    string ReservationId,
    string ConfirmationCode,
    string GuestName,
    string RoomTypeName,
    decimal TotalAmount,
    decimal DepositPaid,
    string Status,
    string PropertyId,
    string CreatedAtUtc
);

public sealed record ReservationStatusNotificationPayload(
    string ReservationId,
    string ConfirmationCode,
    string PreviousStatus,
    string NewStatus,
    string PropertyId,
    string UpdatedAtUtc
);

public sealed record HousekeepingNotificationPayload(
    string RoomNumber,
    string RoomStatus,
    string PropertyId,
    string Message,
    string UpdatedAtUtc
);

/// <summary>
/// Realtime SignalR Hub for hotel operations and automated booking alerts (Task A03).
/// Groups clients by PropertyId so branches only receive notifications pertinent to their facility.
/// </summary>
public class NotificationHub : Hub<INotificationClient>
{
    public static string GetPropertyGroupName(string propertyId) => $"Property_{propertyId.Trim().ToLowerInvariant()}";

    public async Task JoinProperty(string propertyId)
    {
        if (!string.IsNullOrWhiteSpace(propertyId))
        {
            var groupName = GetPropertyGroupName(propertyId);
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        }
    }

    public async Task LeaveProperty(string propertyId)
    {
        if (!string.IsNullOrWhiteSpace(propertyId))
        {
            var groupName = GetPropertyGroupName(propertyId);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        }
    }
}
