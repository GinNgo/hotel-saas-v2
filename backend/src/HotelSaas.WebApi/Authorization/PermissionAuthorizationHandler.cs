using System.Security.Claims;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.WebApi.Authorization;

/// <summary>
/// Evaluates <see cref="PermissionRequirement"/> by checking the authenticated user's
/// RBAC role permissions via the database. Platform <see cref="GlobalUserRole.SuperAdmin"/>
/// users bypass all checks.
/// </summary>
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IApplicationDbContext _context;

    /// <summary>
    /// Initializes a new instance of <see cref="PermissionAuthorizationHandler"/>.
    /// </summary>
    /// <param name="context">The application database context for querying role permissions.</param>
    public PermissionAuthorizationHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        var userIdClaim = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                          ?? context.User.FindFirstValue("sub");

        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return;
        }

        // SuperAdmin bypasses all permission checks.
        var globalRoleClaim = context.User.FindFirstValue("globalRole");
        if (globalRoleClaim is not null &&
            Enum.TryParse<GlobalUserRole>(globalRoleClaim, ignoreCase: true, out var globalRole) &&
            globalRole == GlobalUserRole.SuperAdmin)
        {
            context.Succeed(requirement);
            return;
        }

        // Query tenant staff -> role -> permissions for the authenticated user.
        var hasPermission = await _context.TenantStaffMembers
            .AsNoTracking()
            .Where(ts => ts.UserId == userId && ts.IsActive)
            .SelectMany(ts => ts.Role!.Permissions)
            .AnyAsync(rp =>
                rp.Function!.Code == requirement.FunctionCode &&
                (rp.ActionMask & requirement.RequiredAction) == requirement.RequiredAction);

        if (hasPermission)
        {
            context.Succeed(requirement);
        }
    }
}
