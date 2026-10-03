using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a hotel/property tenant on the platform.
/// Each tenant operates as an isolated business unit with its own rooms, staff, and reservations.
/// </summary>
public class Tenant : BaseEntity
{
    /// <summary>
    /// Display name of the property.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Unique short code for the property (e.g., "HTL-001").
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// URL-friendly slug derived from the property name.
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the property.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Physical address of the property.
    /// </summary>
    public string Address { get; set; } = string.Empty;

    /// <summary>
    /// City where the property is located.
    /// </summary>
    public string City { get; set; } = string.Empty;

    /// <summary>
    /// Contact phone number for the property.
    /// </summary>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Contact email address for the property.
    /// </summary>
    public string? Email { get; set; }

    /// <summary>
    /// URL to the property's logo image.
    /// </summary>
    public string? LogoUrl { get; set; }

    /// <summary>
    /// Type of hospitality property (Hotel, Resort, Hostel, etc.).
    /// </summary>
    public PropertyType PropertyType { get; set; } = PropertyType.Hotel;

    /// <summary>
    /// Star rating of the property (1–5).
    /// </summary>
    public int StarRating { get; set; }

    /// <summary>
    /// Default check-in time for the property.
    /// </summary>
    public TimeOnly CheckInTime { get; set; } = new(14, 0);

    /// <summary>
    /// Default check-out time for the property.
    /// </summary>
    public TimeOnly CheckOutTime { get; set; } = new(12, 0);

    /// <summary>
    /// Free-text cancellation policy displayed to guests.
    /// </summary>
    public string? CancellationPolicy { get; set; }

    /// <summary>
    /// Free-text policy regarding children.
    /// </summary>
    public string? ChildrenPolicy { get; set; }

    /// <summary>
    /// Free-text policy regarding pets.
    /// </summary>
    public string? PetPolicy { get; set; }

    /// <summary>
    /// Free-text house rules displayed to guests.
    /// </summary>
    public string? HouseRules { get; set; }

    /// <summary>
    /// Tax rate percentage applied to charges (e.g., 10.0 = 10%).
    /// </summary>
    public decimal TaxRatePercent { get; set; }

    /// <summary>
    /// Service fee rate percentage applied to charges.
    /// </summary>
    public decimal ServiceFeeRatePercent { get; set; }

    /// <summary>
    /// Geographic latitude coordinate of the property.
    /// </summary>
    public double? Latitude { get; set; }

    /// <summary>
    /// Geographic longitude coordinate of the property.
    /// </summary>
    public double? Longitude { get; set; }

    /// <summary>
    /// Subscription tier determining feature availability and limits.
    /// </summary>
    public SubscriptionTier SubscriptionTier { get; set; } = SubscriptionTier.Basic;

    /// <summary>
    /// Current lifecycle status of the tenant.
    /// </summary>
    public TenantStatus Status { get; set; } = TenantStatus.Active;

    // ── Navigation Properties ──────────────────────────────────────────

    /// <summary>
    /// Collection of rooms belonging to this property.
    /// </summary>
    public ICollection<Room> Rooms { get; set; } = new List<Room>();

    /// <summary>
    /// Collection of room types defined for this property.
    /// </summary>
    public ICollection<RoomType> RoomTypes { get; set; } = new List<RoomType>();

    /// <summary>
    /// Collection of reservations made at this property.
    /// </summary>
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();

    /// <summary>
    /// Collection of staff members assigned to this property.
    /// </summary>
    public ICollection<TenantStaff> StaffMembers { get; set; } = new List<TenantStaff>();
}
