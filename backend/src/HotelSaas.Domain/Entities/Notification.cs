using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents an in-app notification sent to a user within a tenant context.
/// </summary>
public class Notification : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this notification belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Foreign key to the user who receives this notification.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the recipient user.
    /// </summary>
    public User? User { get; set; }

    /// <summary>
    /// Category of the notification event.
    /// </summary>
    public NotificationType Type { get; set; }

    /// <summary>
    /// Short title displayed in the notification list.
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Detailed message body of the notification.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Whether the user has read this notification.
    /// </summary>
    public bool IsRead { get; set; } = false;

    /// <summary>
    /// UTC timestamp when the notification was read; null if unread.
    /// </summary>
    public DateTime? ReadAtUtc { get; set; }

    /// <summary>
    /// Optional JSON payload with additional context-specific data.
    /// </summary>
    public string? Data { get; set; }

    /// <summary>
    /// Optional identifier of the related domain entity (e.g., ReservationId, PaymentId).
    /// </summary>
    public Guid? RelatedEntityId { get; set; }

    /// <summary>
    /// Optional type name of the related entity (e.g., "Reservation", "Payment").
    /// </summary>
    public string? RelatedEntityType { get; set; }
}
