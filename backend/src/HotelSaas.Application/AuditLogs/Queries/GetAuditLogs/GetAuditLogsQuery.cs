using System;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;

/// <summary>
/// CQRS Query for retrieving a paginated, filtered list of immutable system audit logs (GET /api/audit-logs).
/// Restricted to Owner and Manager roles within their authorized tenant and branch scope.
/// </summary>
public sealed record GetAuditLogsQuery(
    Guid? PropertyId = null,
    Guid? UserId = null,
    string? Action = null,
    string? EntityName = null,
    Guid? EntityId = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<ApiResponse<PagedResult<AuditLogListItemDto>>>;

