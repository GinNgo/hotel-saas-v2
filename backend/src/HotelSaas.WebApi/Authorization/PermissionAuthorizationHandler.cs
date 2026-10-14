using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.WebApi.Authorization;

/// <summary>
/// Evaluates <see cref="PermissionRequirement"/> by checking the authenticated user's
/// RBAC role permissions via the database. Supports single and composite OR requirements.
/// Platform <see cref="GlobalUserRole.SuperAdmin"/> users bypass all checks.
/// </summary>
public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    /// <summary>
    /// Initializes a new instance of <see cref="PermissionAuthorizationHandler"/>.
    /// </summary>
    /// <param name="context">The application database context for querying role permissions.</param>
    /// <param name="userContext">Current request user and authoritative role context.</param>
    public PermissionAuthorizationHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    /// <inheritdoc />
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        // Fail-closed: Must possess an authoritative role resolved by context middleware
        if (!_userContext.RoleId.HasValue || _userContext.RoleId.Value == Guid.Empty)
        {
            return;
        }

        var roleId = _userContext.RoleId.Value;

        if (requirement.AlternativePermissions.Count > 1)
        {
            var functionCodes = requirement.AlternativePermissions
                .Select(p => p.FunctionCode)
                .Distinct()
                .ToList();

            var rolePermissions = await _context.RolePermissions
                .AsNoTracking()
                .Where(rp => rp.RoleId == roleId && functionCodes.Contains(rp.Function!.Code))
                .Select(rp => new { Code = rp.Function!.Code, rp.ActionMask })
                .ToListAsync();

            var hasAnyPermission = requirement.AlternativePermissions.Any(req =>
                rolePermissions.Any(rp => rp.Code == req.FunctionCode &&
                                          (rp.ActionMask & req.RequiredAction) == req.RequiredAction));

            if (hasAnyPermission)
            {
                context.Succeed(requirement);
            }
        }
        else
        {
            var targetCode = requirement.FunctionCode;
            // Query permissions strictly for the authoritative role of the current context (Zero-Aggregation)
            var hasPermission = await _context.RolePermissions
                .AsNoTracking()
                .AnyAsync(rp =>
                    rp.RoleId == roleId &&
                    rp.Function!.Code == targetCode &&
                    (rp.ActionMask & requirement.RequiredAction) == requirement.RequiredAction);

            if (hasPermission)
            {
                context.Succeed(requirement);
            }
        }
    }
}
