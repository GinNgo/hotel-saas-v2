using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Explicit time-boxed support access grant authorizing platform support staff
/// to inspect or troubleshoot a tenant's workspace with auditability (`SDD-05 D24`).
/// </summary>
public class SupportAccessGrant : BaseEntity, ITenantScopedEntity
{
    /// <summary>
    /// Foreign key to the tenant granting temporary support access.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to the tenant.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// User identifier of the Tenant Owner/Admin who approved the grant.
    /// </summary>
    public Guid GrantedByUserId { get; set; }

    /// <summary>
    /// Platform support user identifier authorized by this grant.
    /// </summary>
    public Guid TargetSupportUserId { get; set; }

    /// <summary>
    /// Support access scope: <c>READ_ONLY</c> or <c>DIAGNOSTIC</c>.
    /// </summary>
    public string Scope { get; set; } = "READ_ONLY";

    /// <summary>
    /// Recorded business justification for granting temporary support access.
    /// </summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when the grant automatically expires.
    /// </summary>
    public DateTime ExpiresAtUtc { get; set; }

    /// <summary>
    /// UTC timestamp when the grant was manually revoked; null if active or naturally expired.
    /// </summary>
    public DateTime? RevokedAtUtc { get; set; }

    /// <summary>
    /// User identifier who revoked the grant early, if applicable.
    /// </summary>
    public Guid? RevokedByUserId { get; set; }

    /// <summary>
    /// Audit entries recorded while acting under this support access grant.
    /// </summary>
    public ICollection<SupportAuditLog> AuditLogs { get; set; } = new List<SupportAuditLog>();
}
