using System;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Application.Common.Models;
using MediatR;

namespace HotelSaas.Application.AuditLogs.Queries.GetAuditLogById;

/// <summary>
/// CQRS Query for retrieving detailed information of a single audit log entry (GET /api/audit-logs/{id}).
/// Enforces fail-closed RBAC (Owner/Manager only) and strict tenant/branch scope verification.
/// </summary>
public sealed record GetAuditLogByIdQuery(
    Guid Id,
    Guid? PropertyId = null
) : IRequest<ApiResponse<AuditLogDetailDto>>;

