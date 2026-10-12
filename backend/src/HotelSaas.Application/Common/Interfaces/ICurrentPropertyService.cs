namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Provides access to the current property identifier and scoping for the request scope.
/// Used by EF Core Global Query Filters and handlers to enforce property data isolation.
/// </summary>
public interface ICurrentPropertyService
{
    /// <summary>
    /// The identifier of the currently selected property.
    /// Null when operating tenant-wide or when no property context is established.
    /// </summary>
    Guid? PropertyId { get; set; }

    /// <summary>
    /// Indicates whether the current caller operates with tenant-wide authority.
    /// </summary>
    bool IsTenantWide { get; set; }

    /// <summary>
    /// List of property IDs explicitly excluded for the current caller (e.g., inactive exact memberships).
    /// </summary>
    IReadOnlyList<Guid> ExcludedPropertyIds { get; set; }

    /// <summary>
    /// The property identifier explicitly passed in the X-Property-Id HTTP request header, if present.
    /// </summary>
    Guid? HeaderPropertyId { get; set; }

    /// <summary>
    /// The property identifier embedded in the JWT token claim (propertyId or pid), if present.
    /// </summary>
    Guid? TokenPropertyId { get; set; }
}
