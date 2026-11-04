using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.AuditLogs.DTOs;
using HotelSaas.Application.AuditLogs.Queries.GetAuditLogs;
using HotelSaas.Application.AuditLogs.Services;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.AuditLogs.Queries.GetAuditLogById;

/// <summary>
/// Handles <see cref="GetAuditLogByIdQuery"/> with strict tenant/branch scope verification,
/// Owner/Manager RBAC enforcement, and read-time payload sanitization.
/// </summary>
public sealed class GetAuditLogByIdQueryHandler
    : IRequestHandler<GetAuditLogByIdQuery, ApiResponse<AuditLogDetailDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;

    public GetAuditLogByIdQueryHandler(
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

    public async Task<ApiResponse<AuditLogDetailDto>> Handle(
        GetAuditLogByIdQuery request,
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

        GetAuditLogsQueryHandler.EnsureMembershipSuccess(membership);
        GetAuditLogsQueryHandler.EnsureOwnerOrManagerRole(membership.StaffRole, _userContext.StaffRole);

        // 4. Query target AuditLog strictly scoped to TenantId (prevents cross-tenant existence probing)
        var auditLog = await _context.AuditLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == request.Id && a.TenantId == tenantId.Value, cancellationToken);

        if (auditLog == null)
        {
            throw new NotFoundException("Không tìm thấy bản ghi nhật ký kiểm toán.");
        }

        // 5. Verify branch-level or tenant-level access policy on the specific AuditLog record
        var excludedProperties = (_propertyService.ExcludedPropertyIds ?? Array.Empty<Guid>())
            .Concat(membership.ExcludedPropertyIds ?? Array.Empty<Guid>())
            .Distinct()
            .ToList();

        if (auditLog.PropertyId.HasValue)
        {
            if (excludedProperties.Contains(auditLog.PropertyId.Value))
            {
                throw new ForbiddenException(
                    "ERR_MEMBERSHIP_REVOKED",
                    "Quyền nhân sự của bạn tại chi nhánh của bản ghi này đã bị thu hồi.");
            }

            if (requestedPropertyId.HasValue && auditLog.PropertyId.Value != requestedPropertyId.Value)
            {
                throw new ForbiddenException(
                    "ERR_PROPERTY_FORBIDDEN",
                    "Bạn không có quyền truy cập nhật ký kiểm toán của chi nhánh khác.");
            }

            if (!_propertyService.IsTenantWide || !membership.IsTenantWide)
            {
                var allowedBranchId = requestedPropertyId ?? membership.PropertyId ?? _propertyService.PropertyId;
                if (!allowedBranchId.HasValue || auditLog.PropertyId.Value != allowedBranchId.Value)
                {
                    throw new ForbiddenException(
                        "ERR_PROPERTY_FORBIDDEN",
                        "Bạn không có quyền truy cập nhật ký kiểm toán của chi nhánh khác.");
                }
            }
            else
            {
                // Verify membership against the log's exact branch
                var branchMembership = await _membershipLookupService.ResolveMembershipAsync(
                    tenantId.Value,
                    userId,
                    auditLog.PropertyId.Value,
                    cancellationToken);

                GetAuditLogsQueryHandler.EnsureMembershipSuccess(branchMembership);
                GetAuditLogsQueryHandler.EnsureOwnerOrManagerRole(branchMembership.StaffRole, _userContext.StaffRole);
            }
        }
        else
        {
            // Tenant-level AuditLog (PropertyId == null): strictly requires tenant-wide authority
            if (!_propertyService.IsTenantWide || !membership.IsTenantWide)
            {
                throw new ForbiddenException(
                    "ERR_PROPERTY_FORBIDDEN",
                    "Nhật ký kiểm toán cấp toàn chuỗi chỉ dành cho người dùng có quyền quản trị toàn chuỗi (Owner).");
            }
        }

        // 6. Fetch actor and property metadata with AsNoTracking()
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
                .Where(p => p.TenantId == tenantId.Value && p.Id == auditLog.PropertyId.Value)
                .Select(p => new { p.Name, p.Code })
                .FirstOrDefaultAsync(cancellationToken);

            propertyName = propMeta?.Name;
            propertyCode = propMeta?.Code;
        }

        // 7. Sanitize OldValues & NewValues before returning
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
            PropertyName = propertyName,
            PropertyCode = propertyCode,
            UserId = auditLog.UserId,
            UserFullName = userFullName,
            UserEmail = userEmail,
            Action = auditLog.Action,
            EntityName = auditLog.EntityName,
            EntityId = auditLog.EntityId,
            IpAddress = auditLog.IpAddress,
            CreatedAtUtc = GetAuditLogsQueryHandler.SpecifyUtc(auditLog.CreatedAtUtc),
            OldValues = sanitized.SanitizedOldValuesJson,
            NewValues = sanitized.SanitizedNewValuesJson,
            ChangedFields = sanitized.ChangedFields,
            ChangeSummary = sanitized.ChangeSummary,
            Changes = sanitized.Changes
        };

        return ApiResponse.Ok(detailDto);
    }
}
