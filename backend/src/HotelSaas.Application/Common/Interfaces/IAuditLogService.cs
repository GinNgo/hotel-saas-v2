using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Domain.Entities;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Service interface for tracking and persisting compliance and security audit logs
/// across tenants, branches, administrators, and users.
/// </summary>
public interface IAuditLogService
{
    /// <summary>
    /// Records an audit log entry for a user or administrator action across branches.
    /// Ambient TenantId, UserId, and IP Address are automatically resolved from request context.
    /// </summary>
    /// <param name="action">Action name ("Create", "Update", "Delete", or standardized custom security action).</param>
    /// <param name="entityName">Logical entity/resource name (e.g., "Reservation", "StaffMember", "Property").</param>
    /// <param name="entityId">Primary key of the audited resource.</param>
    /// <param name="oldValues">Scalar or dictionary of prior values (null on Create).</param>
    /// <param name="newValues">Scalar or dictionary of new values (null on Delete).</param>
    /// <param name="propertyId">Optional physical branch ID where the action occurred.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task<AuditLog> RecordActionAsync(
        string action,
        string entityName,
        Guid entityId,
        object? oldValues = null,
        object? newValues = null,
        Guid? propertyId = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Explicitly records an audit log entry with specified tenant, property, and user boundaries.
    /// Useful for background workers, integrations, or security overrides.
    /// </summary>
    Task<AuditLog> RecordActionExplicitAsync(
        Guid tenantId,
        Guid? propertyId,
        Guid? userId,
        string action,
        string entityName,
        Guid entityId,
        object? oldValues = null,
        object? newValues = null,
        string? ipAddress = null,
        CancellationToken cancellationToken = default);
}
