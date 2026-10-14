namespace HotelSaas.Domain.Enums;

/// <summary>
/// Represents the type of notification sent to a user.
/// </summary>
public enum NotificationType
{
    /// <summary>
    /// A new booking has been created.
    /// </summary>
    NewBooking = 0,

    /// <summary>
    /// A booking has been confirmed.
    /// </summary>
    BookingConfirmed = 1,

    /// <summary>
    /// A booking has been cancelled.
    /// </summary>
    BookingCancelled = 2,

    /// <summary>
    /// A payment has been received successfully.
    /// </summary>
    PaymentReceived = 3,

    /// <summary>
    /// A payment attempt has failed.
    /// </summary>
    PaymentFailed = 4,

    /// <summary>
    /// Reminder for an upcoming guest check-in.
    /// </summary>
    CheckInReminder = 5,

    /// <summary>
    /// Reminder for an upcoming guest check-out.
    /// </summary>
    CheckOutReminder = 6,

    /// <summary>
    /// A room's status has changed.
    /// </summary>
    RoomStatusChanged = 7,

    /// <summary>
    /// A housekeeping task has been assigned to a staff member.
    /// </summary>
    HousekeepingAssigned = 8,

    /// <summary>
    /// A housekeeping task has been completed.
    /// </summary>
    HousekeepingCompleted = 9,

    /// <summary>
    /// AI has generated a pricing suggestion.
    /// </summary>
    AiPricingSuggestion = 10,

    /// <summary>
    /// The tenant's subscription is about to expire.
    /// </summary>
    SubscriptionExpiring = 11,

    /// <summary>
    /// A subscription payment has failed.
    /// </summary>
    SubscriptionPaymentFailed = 12,

    /// <summary>
    /// A general system alert or administrative notification.
    /// </summary>
    SystemAlert = 13
}
