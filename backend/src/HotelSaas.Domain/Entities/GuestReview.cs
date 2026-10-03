using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a guest review and rating for a completed reservation.
/// </summary>
public class GuestReview : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this review belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Foreign key to the reservation being reviewed.
    /// </summary>
    public Guid ReservationId { get; set; }

    /// <summary>
    /// Navigation property to the reviewed reservation.
    /// </summary>
    public Reservation? Reservation { get; set; }

    /// <summary>
    /// Foreign key to the guest user who submitted the review.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the guest user.
    /// </summary>
    public User? User { get; set; }

    /// <summary>
    /// Overall rating from 1 (poor) to 5 (excellent).
    /// </summary>
    public int OverallRating { get; set; }

    /// <summary>
    /// Optional cleanliness rating from 1 to 5.
    /// </summary>
    public int? CleanlinessRating { get; set; }

    /// <summary>
    /// Optional location rating from 1 to 5.
    /// </summary>
    public int? LocationRating { get; set; }

    /// <summary>
    /// Optional service quality rating from 1 to 5.
    /// </summary>
    public int? ServiceRating { get; set; }

    /// <summary>
    /// Optional value-for-money rating from 1 to 5.
    /// </summary>
    public int? ValueRating { get; set; }

    /// <summary>
    /// Optional free-text comment from the guest.
    /// </summary>
    public string? Comment { get; set; }

    /// <summary>
    /// Optional reply from the property owner to the review.
    /// </summary>
    public string? OwnerReply { get; set; }

    /// <summary>
    /// UTC timestamp when the owner replied; null if no reply.
    /// </summary>
    public DateTime? RepliedAtUtc { get; set; }

    /// <summary>
    /// Whether the review is publicly visible to other guests.
    /// </summary>
    public bool IsPublished { get; set; } = true;
}
