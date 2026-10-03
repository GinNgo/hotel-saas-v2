using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a guest reservation for a specific room within a property.
/// </summary>
public class Reservation : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this reservation belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to the owning tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Foreign key to the reserved room.
    /// </summary>
    public Guid RoomId { get; set; }

    /// <summary>
    /// Navigation property to the reserved room.
    /// </summary>
    public Room? Room { get; set; }

    /// <summary>
    /// Optional foreign key to the registered user who made the reservation.
    /// Null for walk-in or unregistered guests.
    /// </summary>
    public Guid? GuestUserId { get; set; }

    /// <summary>
    /// Navigation property to the guest's user account.
    /// </summary>
    public User? GuestUser { get; set; }

    /// <summary>
    /// Name of the guest (may differ from the registered user's name).
    /// </summary>
    public string GuestName { get; set; } = string.Empty;

    /// <summary>
    /// Email address of the guest for confirmation and communication.
    /// </summary>
    public string GuestEmail { get; set; } = string.Empty;

    /// <summary>
    /// Optional phone number of the guest.
    /// </summary>
    public string? GuestPhone { get; set; }

    /// <summary>
    /// Check-in date for the reservation.
    /// </summary>
    public DateOnly CheckInDate { get; set; }

    /// <summary>
    /// Check-out date for the reservation.
    /// </summary>
    public DateOnly CheckOutDate { get; set; }

    /// <summary>
    /// Total number of guests for this reservation.
    /// </summary>
    public int NumberOfGuests { get; set; }

    /// <summary>
    /// Total amount charged for the reservation including taxes and fees.
    /// </summary>
    public decimal TotalAmount { get; set; }

    /// <summary>
    /// Current lifecycle status of the reservation.
    /// </summary>
    public ReservationStatus Status { get; set; } = ReservationStatus.PendingPayment;

    /// <summary>
    /// Optional internal or guest-facing notes about the reservation.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Unique confirmation code sent to the guest (e.g., "RES-ABC123").
    /// </summary>
    public string ConfirmationCode { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the reservation was cancelled; null if not cancelled.
    /// </summary>
    public DateTime? CancelledAtUtc { get; set; }

    /// <summary>
    /// Reason provided for cancellation; null if not cancelled.
    /// </summary>
    public string? CancellationReason { get; set; }

    // ── Navigation Properties ──────────────────────────────────────────

    /// <summary>
    /// Collection of payments associated with this reservation.
    /// </summary>
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
