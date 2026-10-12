using System;
using System.Collections.Generic;
using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a versioned pricing schedule for a room type within a property branch.
/// Governs hourly and nightly rental calculations across the effective date interval [EffectiveFrom, EffectiveTo).
/// </summary>
public class RoomTypeRate : BaseEntity, IPropertyScopedEntity
{
    /// <summary>
    /// Foreign key to parent tenant enterprise.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to parent tenant enterprise.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Foreign key to parent physical branch/property.
    /// </summary>
    public Guid PropertyId { get; set; }

    /// <summary>
    /// Navigation property to parent physical branch/property.
    /// </summary>
    public Property? Property { get; set; }

    /// <summary>
    /// Foreign key to classified room type.
    /// </summary>
    public Guid RoomTypeId { get; set; }

    /// <summary>
    /// Navigation property to classified room type.
    /// </summary>
    public RoomType? RoomType { get; set; }

    /// <summary>
    /// Number of hours included in the initial hourly package (Decision D12 default: 2 hours).
    /// </summary>
    public int FirstHours { get; set; } = 2;

    /// <summary>
    /// Fixed lump-sum price for the initial hourly package.
    /// </summary>
    public decimal FirstHoursPrice { get; set; }

    /// <summary>
    /// Price per each additional hour exceeding the initial package (Decision D05 ceiling).
    /// </summary>
    public decimal AdditionalHourPrice { get; set; }

    /// <summary>
    /// Standard base price for one overnight stay (Decision D06, 12:00 to 12:00 next day).
    /// </summary>
    public decimal NightlyPrice { get; set; }

    /// <summary>
    /// Currency code (ISO 4217, default: "VND").
    /// </summary>
    public string Currency { get; set; } = "VND";

    /// <summary>
    /// Effective starting date of this pricing schedule (inclusive).
    /// </summary>
    public DateOnly EffectiveFrom { get; set; }

    /// <summary>
    /// Effective ending date of this pricing schedule (exclusive).
    /// </summary>
    public DateOnly EffectiveTo { get; set; }

    /// <summary>
    /// User identifier of staff member who configured this rate table.
    /// </summary>
    public Guid CreatedByUserId { get; set; }

    /// <summary>
    /// Optional business reason or promotional note explaining rate configuration.
    /// </summary>
    public string? ChangeReason { get; set; }

    /// <summary>
    /// Indicates whether this rate record is active in the live schedule.
    /// </summary>
    public bool IsActive { get; set; } = true;

    // ── Navigation Collections ──────────────────────────────────────────

    /// <summary>
    /// Collection of audit log entries associated with modifications of this rate.
    /// </summary>
    public ICollection<RoomTypeRateAudit> Audits { get; set; } = new List<RoomTypeRateAudit>();
}
