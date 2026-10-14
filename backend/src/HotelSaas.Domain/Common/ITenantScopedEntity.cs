namespace HotelSaas.Domain.Common;

/// <summary>
/// Marker interface for entities that belong to a specific tenant.
/// Used by EF Core Global Query Filters to enforce tenant isolation.
/// </summary>
public interface ITenantScopedEntity
{
    /// <summary>
    /// The identifier of the tenant this entity belongs to.
    /// </summary>
    Guid TenantId { get; set; }
}
