namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Provides access to the current tenant identifier for the request scope.
/// Used by EF Core Global Query Filters to enforce tenant data isolation.
/// </summary>
public interface ICurrentTenantService
{
    /// <summary>
    /// The identifier of the currently authenticated tenant.
    /// Null when no tenant context is established (e.g., system-level operations).
    /// </summary>
    Guid? TenantId { get; set; }
}
