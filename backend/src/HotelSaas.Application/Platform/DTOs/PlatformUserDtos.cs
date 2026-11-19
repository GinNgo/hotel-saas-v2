using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Platform.DTOs;

/// <summary>
/// Global KPI summary across all user accounts registered on the SaaS platform.
/// </summary>
public sealed record PlatformUserSummaryDto(
    int TotalUsers,
    int SuperAdminCount,
    int TenantStaffCount,
    int CustomerCount,
    int ActiveCount,
    int LockedCount
);

/// <summary>
/// Sanitized platform-level projection of a user account (strictly excludes credentials and tenant business records).
/// </summary>
public sealed record PlatformUserDto(
    Guid Id,
    string Email,
    string Username,
    string FullName,
    string? PhoneNumber,
    GlobalUserRole GlobalRole,
    string GlobalRoleName,
    bool IsActive,
    bool EmailVerified,
    bool PhoneVerified,
    Guid? DefaultTenantId,
    string? DefaultTenantName,
    int MembershipsCount,
    DateTime CreatedAtUtc
);

/// <summary>
/// Paginated response for SuperAdmin platform user governance queries.
/// </summary>
public sealed record PlatformUsersResponseDto(
    PlatformUserSummaryDto Summary,
    IReadOnlyList<PlatformUserDto> Items,
    int TotalCount,
    int Page,
    int PageSize
);

internal static class PlatformUserMapper
{
    public static void EnsureSuperAdmin(ICurrentUserContext currentUserContext)
    {
        if (!currentUserContext.IsAuthenticated || currentUserContext.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException(
                "ERR_FORBIDDEN",
                "Chỉ SuperAdmin mới có quyền quản trị tài khoản nền tảng.");
        }
    }

    public static string GetGlobalRoleName(GlobalUserRole role) => role switch
    {
        GlobalUserRole.SuperAdmin => "Quản trị nền tảng (SuperAdmin)",
        GlobalUserRole.TenantStaff => "Chủ cơ sở & Nhân sự",
        GlobalUserRole.Customer => "Khách hàng B2C",
        _ => role.ToString()
    };

    public static async Task<PlatformUserDto> BuildDtoForSingleUserAsync(
        IApplicationDbContext context,
        User user,
        CancellationToken cancellationToken)
    {
        var membershipsCount = 0;
        Guid? fallbackTenantId = null;

        try
        {
            var staffSet = context.TenantStaffMembers;
            if (staffSet != null)
            {
                var memberships = await staffSet
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(m => m.IsActive && m.UserId == user.Id)
                    .Select(m => m.TenantId)
                    .ToListAsync(cancellationToken);

                membershipsCount = memberships.Count;
                if (memberships.Count > 0)
                {
                    fallbackTenantId = memberships[0];
                }
            }
        }
        catch (NotImplementedException)
        {
            // Optional DbSet in isolated minimal test stubs
        }

        var defaultTenantId = user.TenantId ?? fallbackTenantId;
        string? defaultTenantName = null;

        if (defaultTenantId.HasValue)
        {
            try
            {
                var tenantSet = context.Tenants;
                if (tenantSet != null)
                {
                    var tid = defaultTenantId.Value;
                    defaultTenantName = await tenantSet
                        .IgnoreQueryFilters()
                        .AsNoTracking()
                        .Where(t => t.Id == tid)
                        .Select(t => t.Name)
                        .FirstOrDefaultAsync(cancellationToken);
                }
            }
            catch (NotImplementedException)
            {
                // Optional DbSet in isolated minimal test stubs
            }
        }

        return new PlatformUserDto(
            Id: user.Id,
            Email: user.Email ?? string.Empty,
            Username: user.Username ?? string.Empty,
            FullName: user.FullName ?? string.Empty,
            PhoneNumber: user.PhoneNumber,
            GlobalRole: user.GlobalRole,
            GlobalRoleName: GetGlobalRoleName(user.GlobalRole),
            IsActive: user.IsActive,
            EmailVerified: user.EmailVerifiedAtUtc.HasValue,
            PhoneVerified: user.PhoneVerifiedAtUtc.HasValue,
            DefaultTenantId: defaultTenantId,
            DefaultTenantName: defaultTenantName,
            MembershipsCount: membershipsCount,
            CreatedAtUtc: user.CreatedAtUtc);
    }
}
