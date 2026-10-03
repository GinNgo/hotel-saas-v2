using HotelSaas.Domain.Common;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Represents a promotional offer or discount code that can be applied to reservations.
/// </summary>
public class Promotion : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant this promotion belongs to.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Unique promotional code within the tenant (e.g., "SUMMER2026").
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Display name of the promotion.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional description of the promotion terms.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Type of discount applied by this promotion.
    /// </summary>
    public PromotionType Type { get; set; }

    /// <summary>
    /// Discount value — percentage (e.g., 15.0 for 15%) or fixed monetary amount,
    /// depending on the promotion type.
    /// </summary>
    public decimal Value { get; set; }

    /// <summary>
    /// Minimum number of nights required for the promotion to apply.
    /// </summary>
    public int MinNights { get; set; } = 1;

    /// <summary>
    /// Maximum number of times this promotion can be used; null for unlimited.
    /// </summary>
    public int? MaxUsage { get; set; }

    /// <summary>
    /// Current number of times this promotion has been applied.
    /// </summary>
    public int CurrentUsage { get; set; } = 0;

    /// <summary>
    /// UTC timestamp when the promotion becomes active.
    /// </summary>
    public DateTime StartsAtUtc { get; set; }

    /// <summary>
    /// UTC timestamp when the promotion expires.
    /// </summary>
    public DateTime EndsAtUtc { get; set; }

    /// <summary>
    /// Whether the promotion is currently active and available for use.
    /// </summary>
    public bool IsActive { get; set; } = true;
}
