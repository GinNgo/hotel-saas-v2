using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Immutable audit record of actions performed under a <see cref="SupportAccessGrant"/>.
/// </summary>
public class SupportAuditLog : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant accessed during support.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Foreign key to the governing <see cref="SupportAccessGrant"/>.
    /// </summary>
    public Guid SupportAccessGrantId { get; set; }

    /// <summary>
    /// Navigation property to the governing grant.
    /// </summary>
    public SupportAccessGrant? SupportAccessGrant { get; set; }

    /// <summary>
    /// Platform support user performing the audited action.
    /// </summary>
    public Guid ActorUserId { get; set; }

    /// <summary>
    /// Action performed (e.g., <c>VIEW_DIAGNOSTICS</c>, <c>GRANT_CREATED</c>, <c>GRANT_REVOKED</c>).
    /// </summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>
    /// Logical resource or API endpoint accessed.
    /// </summary>
    public string ResourcePath { get; set; } = string.Empty;

    /// <summary>
    /// Optional structured JSON metadata describing the support action.
    /// </summary>
    public string? DetailsJson { get; set; }

    /// <summary>
    /// Client IP address captured for security forensics.
    /// </summary>
    public string? IpAddress { get; set; }
}
