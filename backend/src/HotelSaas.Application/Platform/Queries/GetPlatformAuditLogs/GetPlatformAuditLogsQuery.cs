using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;
using HotelSaas.Application.AuditLogs.Services;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.Queries.GetPlatformAuditLogs;

public sealed record GetPlatformAuditLogsQuery(
    Guid? TenantId = null,
    Guid? PropertyId = null,
    Guid? UserId = null,
    string? Action = null,
    string? EntityName = null,
    Guid? EntityId = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int Page = 1,
    int PageSize = 20,
    string? Search = null) : IRequest<ApiResponse<PagedResult<AuditLogListItemDto>>>;

public sealed record GetPlatformAuditLogByIdQuery(Guid Id) : IRequest<ApiResponse<AuditLogDetailDto>>;

public sealed class GetPlatformAuditLogsQueryHandler
    : IRequestHandler<GetPlatformAuditLogsQuery, ApiResponse<PagedResult<AuditLogListItemDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetPlatformAuditLogsQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<ApiResponse<PagedResult<AuditLogListItemDto>>> Handle(
        GetPlatformAuditLogsQuery request,
        CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException(
                "ERR_FORBIDDEN",
                "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền truy cập nhật ký kiểm toán toàn nền tảng.");
        }

        DateTime? normalizedFromUtc = request.FromUtc.HasValue ? NormalizeFromUtc(request.FromUtc.Value) : null;
        DateTime? normalizedToUtc = request.ToUtc.HasValue ? NormalizeToUtc(request.ToUtc.Value) : null;

        if (normalizedFromUtc.HasValue && normalizedToUtc.HasValue && normalizedFromUtc.Value > normalizedToUtc.Value)
        {
            throw new BadRequestException(
                "ERR_INVALID_DATE_RANGE",
                "Thời gian bắt đầu không được lớn hơn thời gian kết thúc.");
        }

        var query = _context.AuditLogs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AsQueryable();

        if (request.TenantId.HasValue && request.TenantId.Value != Guid.Empty)
        {
            query = query.Where(a => a.TenantId == request.TenantId.Value);
        }

        if (request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty)
        {
            query = query.Where(a => a.PropertyId == request.PropertyId.Value);
        }

        if (request.UserId.HasValue && request.UserId.Value != Guid.Empty)
        {
            query = query.Where(a => a.UserId == request.UserId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Action))
        {
            var canonicalAction = NormalizeCanonicalAction(request.Action);
            query = query.Where(a => a.Action == canonicalAction);
        }

        if (!string.IsNullOrWhiteSpace(request.EntityName))
        {
            var trimmedEntity = request.EntityName.Trim();
            query = query.Where(a => a.EntityName == trimmedEntity);
        }

        if (request.EntityId.HasValue && request.EntityId.Value != Guid.Empty)
        {
            query = query.Where(a => a.EntityId == request.EntityId.Value);
        }

        if (normalizedFromUtc.HasValue)
        {
            query = query.Where(a => a.CreatedAtUtc >= normalizedFromUtc.Value);
        }

        if (normalizedToUtc.HasValue)
        {
            query = query.Where(a => a.CreatedAtUtc <= normalizedToUtc.Value);
        }

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 20 : (request.PageSize > 100 ? 100 : request.PageSize);
        var trimmedSearch = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim();

        int totalCount;
        List<AuditLog> pageRows;
        Dictionary<Guid, AuditPayloadSanitizer.SanitizedAuditPayload>? precomputedSanitized = null;

        if (trimmedSearch is null)
        {
            totalCount = await query.CountAsync(cancellationToken);

            pageRows = await query
                .OrderByDescending(a => a.CreatedAtUtc)
                .ThenByDescending(a => a.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);
        }
        else
        {
            var candidates = await query
                .OrderByDescending(a => a.CreatedAtUtc)
                .ThenByDescending(a => a.Id)
                .Take(5000)
                .ToListAsync(cancellationToken);

            precomputedSanitized = new Dictionary<Guid, AuditPayloadSanitizer.SanitizedAuditPayload>();
            var matched = new List<AuditLog>();

            foreach (var candidate in candidates)
            {
                var sanitized = AuditPayloadSanitizer.SanitizeAndSummarize(
                    candidate.Action,
                    candidate.EntityName,
                    candidate.OldValues,
                    candidate.NewValues);

                var isMatch =
                    candidate.Action.Contains(trimmedSearch, StringComparison.OrdinalIgnoreCase) ||
                    candidate.EntityName.Contains(trimmedSearch, StringComparison.OrdinalIgnoreCase) ||
                    candidate.EntityId.ToString().Contains(trimmedSearch, StringComparison.OrdinalIgnoreCase) ||
                    (!string.IsNullOrEmpty(sanitized.SanitizedOldValuesJson) &&
                     sanitized.SanitizedOldValuesJson.Contains(trimmedSearch, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrEmpty(sanitized.SanitizedNewValuesJson) &&
                     sanitized.SanitizedNewValuesJson.Contains(trimmedSearch, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrEmpty(candidate.IpAddress) &&
                     candidate.IpAddress.Contains(trimmedSearch, StringComparison.OrdinalIgnoreCase));

                if (isMatch)
                {
                    matched.Add(candidate);
                    precomputedSanitized[candidate.Id] = sanitized;
                }
            }

            totalCount = matched.Count;
            pageRows = matched
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();
        }

        if (pageRows.Count == 0)
        {
            return ApiResponse.Ok(new PagedResult<AuditLogListItemDto>(
                Array.Empty<AuditLogListItemDto>(),
                totalCount,
                page,
                pageSize));
        }

        var distinctUserIds = pageRows
            .Where(a => a.UserId.HasValue && a.UserId.Value != Guid.Empty)
            .Select(a => a.UserId!.Value)
            .Distinct()
            .ToList();

        var userLookup = distinctUserIds.Count > 0
            ? await _context.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(u => distinctUserIds.Contains(u.Id))
                .Select(u => new { u.Id, u.FullName, u.Email })
                .ToDictionaryAsync(u => u.Id, cancellationToken)
            : new();

        var distinctPropertyIds = pageRows
            .Where(a => a.PropertyId.HasValue && a.PropertyId.Value != Guid.Empty)
            .Select(a => a.PropertyId!.Value)
            .Distinct()
            .ToList();

        var propertyLookup = distinctPropertyIds.Count > 0
            ? await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => distinctPropertyIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Name, p.Code })
                .ToDictionaryAsync(p => p.Id, cancellationToken)
            : new();

        var distinctTenantIds = pageRows
            .Where(a => a.TenantId != Guid.Empty)
            .Select(a => a.TenantId)
            .Distinct()
            .ToList();

        var tenantLookup = distinctTenantIds.Count > 0
            ? await _context.Tenants
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(t => distinctTenantIds.Contains(t.Id))
                .Select(t => new { t.Id, t.Name, t.Code })
                .ToDictionaryAsync(t => t.Id, cancellationToken)
            : new();

        var items = pageRows.Select(a =>
        {
            var sanitized = precomputedSanitized != null && precomputedSanitized.TryGetValue(a.Id, out var cached)
                ? cached
                : AuditPayloadSanitizer.SanitizeAndSummarize(
                    a.Action,
                    a.EntityName,
                    a.OldValues,
                    a.NewValues);

            var userMeta = a.UserId.HasValue && userLookup.TryGetValue(a.UserId.Value, out var u) ? u : null;
            var propMeta = a.PropertyId.HasValue && propertyLookup.TryGetValue(a.PropertyId.Value, out var p) ? p : null;
            var tenantMeta = tenantLookup.TryGetValue(a.TenantId, out var t) ? t : null;

            return new AuditLogListItemDto
            {
                Id = a.Id,
                TenantId = a.TenantId,
                PropertyId = a.PropertyId,
                PropertyName = propMeta?.Name ?? tenantMeta?.Name ?? "Nền tảng SaaS",
                PropertyCode = propMeta?.Code ?? tenantMeta?.Code ?? "PLATFORM",
                UserId = a.UserId,
                UserFullName = userMeta?.FullName,
                UserEmail = userMeta?.Email,
                Action = a.Action,
                EntityName = a.EntityName,
                EntityId = a.EntityId,
                CreatedAtUtc = SpecifyUtc(a.CreatedAtUtc),
                ChangedFields = sanitized.ChangedFields,
                ChangeSummary = sanitized.ChangeSummary
            };
        }).ToList();

        return ApiResponse.Ok(new PagedResult<AuditLogListItemDto>(items, totalCount, page, pageSize));
    }

    internal static string NormalizeCanonicalAction(string rawAction) =>
        GetAuditLogsQueryHandler.NormalizeCanonicalAction(rawAction);

    internal static DateTime NormalizeFromUtc(DateTime dt) => dt.Kind switch
    {
        DateTimeKind.Utc => dt,
        DateTimeKind.Local => dt.ToUniversalTime(),
        _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
    };

    internal static DateTime NormalizeToUtc(DateTime dt)
    {
        var utc = dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };

        if (dt.TimeOfDay == TimeSpan.Zero && dt.Kind == DateTimeKind.Unspecified)
        {
            return utc.Date.AddDays(1).AddTicks(-1);
        }

        return utc;
    }

    internal static DateTime SpecifyUtc(DateTime dt) =>
        dt.Kind == DateTimeKind.Utc ? dt : DateTime.SpecifyKind(dt, DateTimeKind.Utc);
}

public sealed class GetPlatformAuditLogByIdQueryHandler
    : IRequestHandler<GetPlatformAuditLogByIdQuery, ApiResponse<AuditLogDetailDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetPlatformAuditLogByIdQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<ApiResponse<AuditLogDetailDto>> Handle(
        GetPlatformAuditLogByIdQuery request,
        CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException(
                "ERR_FORBIDDEN",
                "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền xem chi tiết nhật ký kiểm toán.");
        }

        var auditLog = await _context.AuditLogs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

        if (auditLog == null)
        {
            throw new NotFoundException("Không tìm thấy bản ghi nhật ký kiểm toán.");
        }

        string? userFullName = null;
        string? userEmail = null;
        if (auditLog.UserId.HasValue && auditLog.UserId.Value != Guid.Empty)
        {
            var userMeta = await _context.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(u => u.Id == auditLog.UserId.Value)
                .Select(u => new { u.FullName, u.Email })
                .FirstOrDefaultAsync(cancellationToken);

            userFullName = userMeta?.FullName;
            userEmail = userMeta?.Email;
        }

        string? propertyName = null;
        string? propertyCode = null;
        if (auditLog.PropertyId.HasValue && auditLog.PropertyId.Value != Guid.Empty)
        {
            var propMeta = await _context.Properties
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(p => p.Id == auditLog.PropertyId.Value)
                .Select(p => new { p.Name, p.Code })
                .FirstOrDefaultAsync(cancellationToken);

            propertyName = propMeta?.Name;
            propertyCode = propMeta?.Code;
        }
        else if (auditLog.TenantId != Guid.Empty)
        {
            var tenantMeta = await _context.Tenants
                .IgnoreQueryFilters()
                .AsNoTracking()
                .Where(t => t.Id == auditLog.TenantId)
                .Select(t => new { t.Name, t.Code })
                .FirstOrDefaultAsync(cancellationToken);

            propertyName = tenantMeta?.Name;
            propertyCode = tenantMeta?.Code;
        }

        var sanitized = AuditPayloadSanitizer.SanitizeAndSummarize(
            auditLog.Action,
            auditLog.EntityName,
            auditLog.OldValues,
            auditLog.NewValues);

        var detailDto = new AuditLogDetailDto
        {
            Id = auditLog.Id,
            TenantId = auditLog.TenantId,
            PropertyId = auditLog.PropertyId,
            PropertyName = propertyName ?? "Nền tảng SaaS",
            PropertyCode = propertyCode ?? "PLATFORM",
            UserId = auditLog.UserId,
            UserFullName = userFullName,
            UserEmail = userEmail,
            Action = auditLog.Action,
            EntityName = auditLog.EntityName,
            EntityId = auditLog.EntityId,
            IpAddress = auditLog.IpAddress,
            CreatedAtUtc = GetPlatformAuditLogsQueryHandler.SpecifyUtc(auditLog.CreatedAtUtc),
            OldValues = sanitized.SanitizedOldValuesJson,
            NewValues = sanitized.SanitizedNewValuesJson,
            ChangedFields = sanitized.ChangedFields,
            ChangeSummary = sanitized.ChangeSummary,
            Changes = sanitized.Changes
        };

        return ApiResponse.Ok(detailDto);
    }
}
