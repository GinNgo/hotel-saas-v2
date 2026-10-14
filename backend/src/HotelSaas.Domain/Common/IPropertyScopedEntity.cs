using System;

namespace HotelSaas.Domain.Common;

/// <summary>
/// Marker interface for entities that belong to a specific physical property (branch).
/// Enforces multi-property scoping across data access operations.
/// </summary>
public interface IPropertyScopedEntity : ITenantScopedEntity
{
    /// <summary>
    /// Foreign key identifier to the owning physical property.
    /// </summary>
    Guid PropertyId { get; set; }
}
