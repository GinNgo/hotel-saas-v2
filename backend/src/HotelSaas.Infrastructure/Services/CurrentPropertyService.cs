using HotelSaas.Application.Common.Interfaces;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Scoped service that holds the current property identifier and scoping for the request lifetime.
/// Typically populated by TenantPropertyContextMiddleware after JWT validation and DB lookup.
/// </summary>
public sealed class CurrentPropertyService : ICurrentPropertyService
{
    /// <inheritdoc />
    public Guid? PropertyId { get; set; }

    /// <inheritdoc />
    public bool IsTenantWide { get; set; }

    /// <inheritdoc />
    public IReadOnlyList<Guid> ExcludedPropertyIds { get; set; } = new List<Guid>();

    /// <inheritdoc />
    public Guid? HeaderPropertyId { get; set; }

    /// <inheritdoc />
    public Guid? TokenPropertyId { get; set; }
}
