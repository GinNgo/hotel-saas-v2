using HotelSaas.Application.Common.Models;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Service responsible for resolving and selecting the authoritative tenant staff membership
/// for an incoming request deterministically and fail-closed.
/// Executes via direct parameterized query to prevent circular dependencies with EF context initialization.
/// </summary>
public interface IMembershipLookupService
{
    /// <summary>
    /// Resolves the authoritative membership for the given user, tenant, and optional target property.
    /// </summary>
    /// <param name="tenantId">The verified tenant identifier.</param>
    /// <param name="userId">The verified user identifier.</param>
    /// <param name="targetPropertyId">The requested target property identifier, if any.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A <see cref="MembershipLookupResult"/> representing the authoritative resolution decision.</returns>
    Task<MembershipLookupResult> ResolveMembershipAsync(
        Guid tenantId,
        Guid userId,
        Guid? targetPropertyId,
        CancellationToken cancellationToken = default);
}
