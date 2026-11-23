using System;
using System.Collections.Generic;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.SupportGrants.DTOs;

public sealed record SupportUserOptionDto(
    Guid UserId,
    string FullName,
    string Email
);

public sealed record SupportAccessGrantDto(
    Guid Id,
    Guid TenantId,
    string TenantName,
    Guid GrantedByUserId,
    string GrantedByEmail,
    Guid TargetSupportUserId,
    string TargetSupportEmail,
    string TargetSupportName,
    string Scope,
    string Reason,
    DateTime ExpiresAtUtc,
    DateTime? RevokedAtUtc,
    Guid? RevokedByUserId,
    string Status,
    bool IsCurrentlyActive,
    DateTime CreatedAtUtc
);

public sealed record SupportAuditLogDto(
    Guid Id,
    Guid TenantId,
    Guid SupportAccessGrantId,
    Guid ActorUserId,
    string ActorEmail,
    string Action,
    string ResourcePath,
    string? DetailsJson,
    string? IpAddress,
    DateTime CreatedAtUtc
);

public sealed record SupportDiagnosticBranchDto(
    Guid PropertyId,
    string Name,
    string Code,
    PropertyStatus Status,
    bool IsPublished,
    int RoomCount,
    int ActiveReservationsCount
);

public sealed record SupportDiagnosticSnapshotDto(
    Guid GrantId,
    Guid TenantId,
    string TenantName,
    string TenantCode,
    TenantStatus TenantStatus,
    string Scope,
    DateTime ExpiresAtUtc,
    int PropertyCount,
    int TotalRooms,
    int ActiveStaffCount,
    int AuditEntriesCount,
    IReadOnlyList<SupportDiagnosticBranchDto> Branches
);
