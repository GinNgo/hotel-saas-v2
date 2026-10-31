using System;
using System.Collections.Generic;

namespace HotelSaas.Application.AuditLogs.DTOs;

/// <summary>
/// Summary item DTO for paginated audit log queries (GET /api/audit-logs).
/// Contains actor, branch, target entity metadata, and a sanitized human-readable change summary.
/// </summary>
public sealed record AuditLogListItemDto
{
    /// <summary>Unique identifier of the audit log entry.</summary>
    public Guid Id { get; init; }

    /// <summary>Tenant identifier owning this audit log entry.</summary>
    public Guid TenantId { get; init; }

    /// <summary>Optional branch/property identifier. Null for tenant-wide entities without branch binding.</summary>
    public Guid? PropertyId { get; init; }

    /// <summary>Display name of the branch/property, if applicable.</summary>
    public string? PropertyName { get; init; }

    /// <summary>Code of the branch/property, if applicable.</summary>
    public string? PropertyCode { get; init; }

    /// <summary>Identifier of the staff user who performed the action; null for system/background actions.</summary>
    public Guid? UserId { get; init; }

    /// <summary>Full name of the user who performed the action, if available.</summary>
    public string? UserFullName { get; init; }

    /// <summary>Email of the user who performed the action, if available.</summary>
    public string? UserEmail { get; init; }

    /// <summary>Mutation action performed ("Create", "Update", "Delete").</summary>
    public string Action { get; init; } = string.Empty;

    /// <summary>Logical entity type name (e.g., "RoomTypeRate", "PropertySurchargePolicy", "Invoice").</summary>
    public string EntityName { get; init; } = string.Empty;

    /// <summary>Primary key identifier of the audited entity instance.</summary>
    public Guid EntityId { get; init; }

    /// <summary>UTC timestamp when the audited action was recorded.</summary>
    public DateTime CreatedAtUtc { get; init; }

    /// <summary>List of scalar field names affected in this audit entry (after sensitive-field filtering).</summary>
    public IReadOnlyList<string> ChangedFields { get; init; } = Array.Empty<string>();

    /// <summary>Safe, sanitized summary of the recorded change suitable for list display.</summary>
    public string ChangeSummary { get; init; } = string.Empty;
}

