using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Application.AuditLogs.Services;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;

/// <summary>
/// Handles <see cref="GetAuditLogsQuery"/> with fail-closed RBAC (Owner/Manager only),
/// multi-tenant/multi-property scope isolation, server-side pagination, and zero N+1 lookups.
/// </summary>
public sealed class GetAuditLogsQueryHandler
    : IRequestHandler<GetAuditLogsQuery, ApiResponse<PagedResult<AuditLogListItemDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    public GetAuditLogsQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
    }

    public async Task<ApiResponse<PagedResult<AuditLogListItemDto>>> Handle(
        GetAuditLogsQuery request,
        CancellationToken cancellationToken)
    {
        // 1. Fail-closed Tenant & Identity verification
        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("ERR_TENANT_REQUIRED: Yêu cầu ngữ cảnh Tenant hợp lệ.");
        }

        var userId = _userContext.UserId;
        if (userId == Guid.Empty || !_userContext.IsAuthenticated)
        {
            throw new UnauthorizedAccessException("ERR_UNAUTHORIZED: Yêu cầu xác thực danh tính người dùng.");
        }

        if (_userContext.TenantId.HasValue &&
            _userContext.TenantId.Value != Guid.Empty &&
            _userContext.TenantId.Value != tenantId.Value)
        {
            throw new ForbiddenException("ERR_CROSS_TENANT_ACCESS", "Không được phép truy cập nhật ký kiểm toán của Tenant khác.");
        }

        // Customers and SuperAdmins are strictly prohibited from accessing tenant business audit logs
        if (_userContext.GlobalRole == GlobalUserRole.Customer ||
            _userContext.GlobalRole == GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Tài khoản không có quyền truy cập nhật ký kiểm toán.");
        }

        // 2. Anti-tampering checks on Property headers & token scope
        var requestedPropertyId = request.PropertyId.HasValue && request.PropertyId.Value != Guid.Empty
            ? request.PropertyId
            : null;

        if (_propertyService.HeaderPropertyId.HasValue &&
            requestedPropertyId.HasValue &&
            _propertyService.HeaderPropertyId.Value != requestedPropertyId.Value)
        {
            throw new BadRequestException(
                "ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh được yêu cầu.");
        }

        if (!_propertyService.IsTenantWide)
        {
            var boundPropertyId = _propertyService.PropertyId ?? _propertyService.TokenPropertyId ?? _userContext.PropertyId;
            if (!boundPropertyId.HasValue || boundPropertyId.Value == Guid.Empty)
            {
                throw new ForbiddenException(
                    "ERR_PROPERTY_REQUIRED",
                    "Nhân sự cấp chi nhánh bắt buộc phải có ngữ cảnh chi nhánh hợp lệ.");
            }

            if (requestedPropertyId.HasValue && requestedPropertyId.Value != boundPropertyId.Value)
            {
                throw new ForbiddenException(
                    "ERR_PROPERTY_FORBIDDEN",
                    "Bạn không có quyền xem nhật ký kiểm toán của chi nhánh khác.");
            }

            requestedPropertyId = boundPropertyId.Value;
        }
        else if (!requestedPropertyId.HasValue && _propertyService.HeaderPropertyId.HasValue)
        {
            requestedPropertyId = _propertyService.HeaderPropertyId.Value;
        }

        // 3. Authoritative membership & RBAC verification (Owner or Manager ONLY)
        var membership = await _membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            requestedPropertyId,
            cancellationToken);

        EnsureMembershipSuccess(membership);
        EnsureOwnerOrManagerRole(membership.StaffRole, _userContext.StaffRole);

        // If membership resolved as property-scoped (not tenant-wide), enforce its exact PropertyId
        Guid? effectivePropertyFilter = requestedPropertyId;
        if (!membership.IsTenantWide || !_propertyService.IsTenantWide)
        {
            effectivePropertyFilter = requestedPropertyId ?? membership.PropertyId ?? _propertyService.PropertyId;
            if (!effectivePropertyFilter.HasValue || effectivePropertyFilter.Value == Guid.Empty)
            {
                throw new ForbiddenException(
                    "ERR_PROPERTY_REQUIRED",
                    "Yêu cầu chọn chi nhánh làm việc được phân quyền để tra cứu nhật ký.");
            }
        }

        var excludedProperties = (_propertyService.ExcludedPropertyIds ?? Array.Empty<Guid>())
            .Concat(membership.ExcludedPropertyIds ?? Array.Empty<Guid>())
            .Distinct()
            .ToList();

        if (effectivePropertyFilter.HasValue && excludedProperties.Contains(effectivePropertyFilter.Value))
        {
            throw new ForbiddenException(
                "ERR_MEMBERSHIP_REVOKED",
                "Quyền nhân sự của bạn tại chi nhánh này đã bị thu hồi.");
        }

        // 4. Validate date range if provided
        DateTime? normalizedFromUtc = request.FromUtc.HasValue ? NormalizeFromUtc(request.FromUtc.Value) : null;
        DateTime? normalizedToUtc = request.ToUtc.HasValue ? NormalizeToUtc(request.ToUtc.Value) : null;

        if (normalizedFromUtc.HasValue && normalizedToUtc.HasValue && normalizedFromUtc.Value > normalizedToUtc.Value)
        {
            throw new BadRequestException(
                "ERR_INVALID_DATE_RANGE",
                "Thời gian bắt đầu không được lớn hơn thời gian kết thúc.");
        }

        // 5. Build server-side query leveraging T03-A composite indexes
        var query = _context.AuditLogs
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId.Value);

        if (effectivePropertyFilter.HasValue)
        {
            // Branch-scoped query: strictly return logs belonging to the authorized branch (excludes null/tenant-only logs for non-tenant-wide users)
            query = query.Where(a => a.PropertyId == effectivePropertyFilter.Value);
        }
        else if (excludedProperties.Count > 0)
        {
            // Tenant-wide Owner query: return tenant-level logs (PropertyId == null) + all non-excluded branch logs
            query = query.Where(a => !a.PropertyId.HasValue || !excludedProperties.Contains(a.PropertyId.Value));
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

        var totalCount = await query.CountAsync(cancellationToken);

        var pageRows = await query
            .OrderByDescending(a => a.CreatedAtUtc)
            .ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        if (pageRows.Count == 0)
        {
            return ApiResponse.Ok(new PagedResult<AuditLogListItemDto>(
                Array.Empty<AuditLogListItemDto>(),
                totalCount,
                page,
                pageSize));
        }

        // 6. Batch-resolve User and Property display metadata (Zero N+1 queries)
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
                .Where(p => p.TenantId == tenantId.Value && distinctPropertyIds.Contains(p.Id))
                .Select(p => new { p.Id, p.Name, p.Code })
                .ToDictionaryAsync(p => p.Id, cancellationToken)
            : new();

        // 7. Map to safe DTOs with read-time sanitization
        var items = pageRows.Select(a =>
        {
            var sanitized = AuditPayloadSanitizer.SanitizeAndSummarize(
                a.Action,
                a.EntityName,
                a.OldValues,
                a.NewValues);

            var userMeta = a.UserId.HasValue && userLookup.TryGetValue(a.UserId.Value, out var u) ? u : null;
            var propMeta = a.PropertyId.HasValue && propertyLookup.TryGetValue(a.PropertyId.Value, out var p) ? p : null;

            return new AuditLogListItemDto
            {
                Id = a.Id,
                TenantId = a.TenantId,
                PropertyId = a.PropertyId,
                PropertyName = propMeta?.Name,
                PropertyCode = propMeta?.Code,
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

    internal static void EnsureMembershipSuccess(MembershipLookupResult membership)
    {
        if (membership.Status == MembershipLookupStatus.Success)
        {
            return;
        }

        switch (membership.Status)
        {
            case MembershipLookupStatus.MembershipRevoked:
                throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", membership.ErrorMessage ?? "Quyền nhân sự tại chi nhánh đã bị thu hồi.");
            case MembershipLookupStatus.PropertyNotFound:
                throw new NotFoundException(membership.ErrorMessage ?? "Chi nhánh không tồn tại.");
            case MembershipLookupStatus.PropertyInactive:
                throw new ConflictException("ERR_PROPERTY_INACTIVE", membership.ErrorMessage ?? "Chi nhánh hiện không hoạt động.");
            case MembershipLookupStatus.PropertyForbidden:
                throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", membership.ErrorMessage ?? "Bạn không có quyền truy cập chi nhánh này.");
            case MembershipLookupStatus.PropertyRequired:
                throw new ForbiddenException("ERR_PROPERTY_REQUIRED", membership.ErrorMessage ?? "Yêu cầu chọn chi nhánh làm việc để tiếp tục.");
            case MembershipLookupStatus.TenantNotFoundOrInactive:
                throw new ForbiddenException("ERR_TENANT_INACTIVE", membership.ErrorMessage ?? "Doanh nghiệp hiện bị tạm ngưng.");
            case MembershipLookupStatus.UserNotFoundOrInactive:
                throw new UnauthorizedAccessException("ERR_USER_DEACTIVATED: " + (membership.ErrorMessage ?? "Tài khoản người dùng đã bị vô hiệu hóa."));
            default:
                throw new ForbiddenException("ERR_FORBIDDEN", membership.ErrorMessage ?? "Không có quyền truy cập nhật ký kiểm toán.");
        }
    }

    internal static void EnsureOwnerOrManagerRole(StaffRole? membershipRole, StaffRole? contextRole)
    {
        static bool IsAllowedRole(StaffRole? role) =>
            role == StaffRole.Owner || role == StaffRole.Manager;

        if (!IsAllowedRole(membershipRole) || (contextRole.HasValue && !IsAllowedRole(contextRole)))
        {
            throw new ForbiddenException(
                "ERR_FORBIDDEN",
                "Chỉ Chủ khách sạn (Owner) hoặc Quản lý (Manager) mới có quyền truy cập nhật ký kiểm toán.");
        }
    }

    private static string NormalizeCanonicalAction(string rawAction)
    {
        var trimmed = rawAction.Trim();
        if (string.Equals(trimmed, AuditActions.Create, StringComparison.OrdinalIgnoreCase))
            return AuditActions.Create;
        if (string.Equals(trimmed, AuditActions.Update, StringComparison.OrdinalIgnoreCase))
            return AuditActions.Update;
        if (string.Equals(trimmed, AuditActions.Delete, StringComparison.OrdinalIgnoreCase))
            return AuditActions.Delete;

        throw new BadRequestException(
            "ERR_INVALID_ACTION_FILTER",
            "Giá trị lọc Action chỉ chấp nhận Create, Update hoặc Delete.");
    }

    private static DateTime NormalizeFromUtc(DateTime dt)
    {
        return dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };
    }

    private static DateTime NormalizeToUtc(DateTime dt)
    {
        var utc = dt.Kind switch
        {
            DateTimeKind.Utc => dt,
            DateTimeKind.Local => dt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc)
        };

        // If caller passed a date-only boundary at 00:00:00.000, include the full day up to 23:59:59.9999999
        if (dt.TimeOfDay == TimeSpan.Zero && dt.Kind == DateTimeKind.Unspecified)
        {
            return utc.Date.AddDays(1).AddTicks(-1);
        }

        return utc;
    }

    internal static DateTime SpecifyUtc(DateTime dt)
    {
        return dt.Kind == DateTimeKind.Utc
            ? dt
            : DateTime.SpecifyKind(dt, DateTimeKind.Utc);
    }
}

