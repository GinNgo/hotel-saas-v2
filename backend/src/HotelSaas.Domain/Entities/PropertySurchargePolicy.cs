using System;
using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a property-specific surcharge policy for early check-in or late check-out.
/// </summary>
public class PropertySurchargePolicy : BaseEntity, IPropertyScopedEntity
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
    /// Surcharge classification: EarlyCheckIn (1) or LateCheckOut (2).
    /// </summary>
    public SurchargeType SurchargeType { get; set; }

    /// <summary>
    /// Starting boundary time of the surcharge interval (inclusive).
    /// </summary>
    public TimeOnly FromTime { get; set; }

    /// <summary>
    /// Ending boundary time of the surcharge interval (exclusive or boundary inclusive).
    /// </summary>
    public TimeOnly ToTime { get; set; }

    /// <summary>
    /// Formula calculation method: PercentageOfNightly (1) or FlatAmount (2).
    /// </summary>
    public SurchargeCalculationMethod CalculationMethod { get; set; }

    /// <summary>
    /// Percentage rate applied against the nightly room price (e.g., 30.00% or 50.00%).
    /// Required when CalculationMethod is PercentageOfNightly.
    /// </summary>
    public decimal? Percentage { get; set; }

    /// <summary>
    /// Flat fee amount in currency VND.
    /// Required when CalculationMethod is FlatAmount.
    /// </summary>
    public decimal? FlatAmount { get; set; }

    /// <summary>
    /// Indicates whether this surcharge rule is currently active.
    /// </summary>
    public bool IsActive { get; set; } = true;
}
