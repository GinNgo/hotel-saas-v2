namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Enforces tenant SaaS subscription quotas against configured plan limits.
/// </summary>
public interface ISubscriptionQuotaGuard
{
    /// <summary>
    /// Ensures the tenant has remaining property capacity under its active subscription plan.
    /// </summary>
    Task EnsureCanCreatePropertyAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ensures the tenant has remaining room capacity under its active subscription plan.
    /// </summary>
    Task EnsureCanCreateRoomAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ensures the tenant has remaining distinct staff capacity under its active subscription plan.
    /// </summary>
    Task EnsureCanCreateStaffAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
