using HotelSaas.Application.Common.Interfaces;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Scoped service that holds the current tenant identifier for the request lifetime.
/// Typically populated by middleware after JWT token validation.
/// </summary>
public sealed class CurrentTenantService : ICurrentTenantService
{
    /// <inheritdoc />
    public Guid? TenantId { get; set; }
}
