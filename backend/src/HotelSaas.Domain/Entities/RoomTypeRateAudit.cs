using System;
using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Audit trail entity recording modifications, interval splittings, and lifecycle actions on room type rates.
/// Linked with composite foreign key to RoomTypes to ensure strict branch partitioning.
/// </summary>
public class RoomTypeRateAudit : BaseEntity, IPropertyScopedEntity
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
    /// Optional foreign key to associated room type rate entity.
    /// </summary>
    public Guid? RateId { get; set; }

    /// <summary>
    /// Navigation property to associated room type rate entity.
    /// </summary>
    public RoomTypeRate? Rate { get; set; }

    /// <summary>
    /// Previous effective start date prior to this modification.
    /// </summary>
    public DateOnly? OldEffectiveFrom { get; set; }

    /// <summary>
    /// Previous effective end date prior to this modification.
    /// </summary>
    public DateOnly? OldEffectiveTo { get; set; }

    /// <summary>
    /// Previous nightly price prior to this modification.
    /// </summary>
    public decimal? OldNightlyPrice { get; set; }

    /// <summary>
    /// New effective start date after this modification.
    /// </summary>
    public DateOnly NewEffectiveFrom { get; set; }

    /// <summary>
    /// New effective end date after this modification.
    /// </summary>
    public DateOnly NewEffectiveTo { get; set; }

    /// <summary>
    /// New nightly price after this modification.
    /// </summary>
    public decimal NewNightlyPrice { get; set; }

    /// <summary>
    /// Categorical action type (e.g., "Created", "Split_Shortened", "Split_Created", "Replaced", "Deactivated").
    /// </summary>
    public string ActionType { get; set; } = string.Empty;

    /// <summary>
    /// Staff user identifier who triggered this pricing action.
    /// </summary>
    public Guid ChangedByUserId { get; set; }

    /// <summary>
    /// Timestamp when this pricing action was executed.
    /// </summary>
    public DateTime ChangedAtUtc { get; set; }

    /// <summary>
    /// Business reason supplied for this pricing change.
    /// </summary>
    public string? ChangeReason { get; set; }
}
