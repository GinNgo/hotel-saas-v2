using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a category of rooms within a property (e.g., "Deluxe Double", "Standard Twin").
/// </summary>
public class RoomType : BaseEntity, IPropertyScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this room type belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to the owning tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Foreign key to the physical property/branch this room type belongs to.
    /// </summary>
    public Guid PropertyId { get; set; }

    /// <summary>
    /// Navigation property to the owning physical property.
    /// </summary>
    public Property? Property { get; set; }

    /// <summary>
    /// Display name of the room type.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Unique code identifier within the tenant (e.g., "DLX", "STD").
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the room type and its amenities.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Base nightly price for this room type.
    /// </summary>
    public decimal BasePrice { get; set; }

    /// <summary>
    /// Maximum number of guests this room type can accommodate.
    /// </summary>
    public int MaxOccupancy { get; set; }

    /// <summary>
    /// Optional bed type description (e.g., "King", "Twin", "Queen").
    /// </summary>
    public string? BedType { get; set; }

    /// <summary>
    /// Optional room size in square meters.
    /// </summary>
    public decimal? SquareMeters { get; set; }

    /// <summary>
    /// Optional URL to a representative image of this room type.
    /// </summary>
    public string? ImageUrl { get; set; }

    // ── Navigation Properties ──────────────────────────────────────────

    /// <summary>
    /// Collection of individual rooms of this type.
    /// </summary>
    public ICollection<Room> Rooms { get; set; } = new List<Room>();

    /// <summary>
    /// Collection of versioned pricing rates defined for this room type.
    /// </summary>
    public ICollection<RoomTypeRate> Rates { get; set; } = new List<RoomTypeRate>();

    /// <summary>
    /// Collection of audit log entries tracking rate modifications and interval splittings.
    /// </summary>
    public ICollection<RoomTypeRateAudit> RateAudits { get; set; } = new List<RoomTypeRateAudit>();
}
