using System;
using HotelSaas.Domain.Common;

namespace HotelSaas.Domain.Entities;

/// <summary>
/// Standardized action names recorded in <see cref="AuditLog"/>.
/// </summary>
public static class AuditActions
{
    public const string Create = "Create";
    public const string Update = "Update";
    public const string Delete = "Delete";
}

/// <summary>
/// Immutable system audit log entry recording critical business mutations (e.g., room rate changes,
/// surcharge policy changes, and invoice deletions) with strict tenant and branch partitioning.
/// </summary>
public class AuditLog : ITenantScopedEntity
{
    /// <summary>
    /// Unique identifier for the audit log entry.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Foreign key to the tenant enterprise owning the audited resource.
    /// </summary>
    public Guid TenantId { get; set; }

    /// <summary>
    /// Navigation property to the owning tenant enterprise.
    /// </summary>
    public Tenant? Tenant { get; set; }

    /// <summary>
    /// Optional foreign key to the physical property/branch where the mutation occurred.
    /// Null when the audited entity is strictly tenant-scoped without a branch binding.
    /// </summary>
    public Guid? PropertyId { get; set; }

    /// <summary>
    /// Navigation property to the physical property/branch.
    /// </summary>
    public Property? Property { get; set; }

    /// <summary>
    /// Optional identifier of the authenticated user who performed the action.
    /// Null for unauthenticated system/background operations.
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// Mutation action performed ("Create", "Update", "Delete").
    /// </summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>
    /// Logical entity type name of the modified resource (e.g., "RoomTypeRate", "Invoice").
    /// </summary>
    public string EntityName { get; set; } = string.Empty;

    /// <summary>
    /// Primary key identifier of the audited entity instance.
    /// </summary>
    public Guid EntityId { get; set; }

    /// <summary>
    /// JSON representation (jsonb) of previous scalar values prior to Update or Delete; null on Create.
    /// </summary>
    public string? OldValues { get; set; }

    /// <summary>
    /// JSON representation (jsonb) of new scalar values after Create or Update; null on Delete.
    /// </summary>
    public string? NewValues { get; set; }

    /// <summary>
    /// Verified client IP address from trusted connection context, if available.
    /// </summary>
    public string? IpAddress { get; set; }

    /// <summary>
    /// UTC timestamp when the audited action was recorded.
    /// </summary>
    public DateTime CreatedAtUtc { get; set; }
}

