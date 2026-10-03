using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents an individual physical room within a property.
/// </summary>
public class Room : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this room belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to the owning tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Foreign key to the room type classification.
    /// </summary>
    public Guid RoomTypeId { get; set; }

    /// <summary>
    /// Navigation property to the room type.
    /// </summary>
    public RoomType? RoomType { get; set; }

    /// <summary>
    /// Room number or identifier displayed to guests (e.g., "101", "A-201").
    /// </summary>
    public string RoomNumber { get; set; } = string.Empty;

    /// <summary>
    /// Floor number where the room is located.
    /// </summary>
    public int Floor { get; set; }

    /// <summary>
    /// Current housekeeping and occupancy status of the room.
    /// </summary>
    public RoomStatus Status { get; set; } = RoomStatus.Clean;

    /// <summary>
    /// Optional internal notes about the room (e.g., maintenance history).
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>
    /// Whether this room is active and available for booking.
    /// </summary>
    public bool IsActive { get; set; } = true;

    // ── Navigation Properties ──────────────────────────────────────────

    /// <summary>
    /// Collection of reservations for this room.
    /// </summary>
    public ICollection<Reservation> Reservations { get; set; } = new List<Reservation>();
}
