using System;
using System.Collections.Generic;

namespace HotelSaas.Application.AuditLogs.DTOs;

/// <summary>
/// Represents a single sanitized field change between OldValues and NewValues.
/// </summary>
public sealed record AuditFieldChangeDto(
    string FieldName,
    string? OldValue,
    string? NewValue);

/// <summary>
/// Detailed audit log DTO returned by GET /api/audit-logs/{id}.
/// Includes sanitized OldValues/NewValues JSON payloads and structured field-level diffs.
/// </summary>
public sealed record AuditLogDetailDto
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

    /// <summary>Verified client IP address recorded at the time of the action, if available.</summary>
    public string? IpAddress { get; init; }

    /// <summary>UTC timestamp when the audited action was recorded.</summary>
    public DateTime CreatedAtUtc { get; init; }

    /// <summary>Sanitized JSON string of previous values prior to Update or Delete; null on Create.</summary>
    public string? OldValues { get; init; }

    /// <summary>Sanitized JSON string of new values after Create or Update; null on Delete.</summary>
    public string? NewValues { get; init; }

    /// <summary>List of scalar field names affected in this audit entry (after sensitive-field filtering).</summary>
    public IReadOnlyList<string> ChangedFields { get; init; } = Array.Empty<string>();

    /// <summary>Safe, sanitized summary of the recorded change.</summary>
    public string ChangeSummary { get; init; } = string.Empty;

    /// <summary>Structured field-by-field before/after comparison list (after sensitive-field filtering).</summary>
    public IReadOnlyList<AuditFieldChangeDto> Changes { get; init; } = Array.Empty<AuditFieldChangeDto>();
}

