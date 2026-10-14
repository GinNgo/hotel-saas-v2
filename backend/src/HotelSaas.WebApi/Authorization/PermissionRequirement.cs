using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Authorization;

namespace HotelSaas.WebApi.Authorization;

/// <summary>
/// Authorization requirement that demands a specific bitmask action
/// on a named permission function (e.g., ROOMS + Read), or any one of multiple
/// alternative permission combinations (OR semantics).
/// </summary>
public sealed class PermissionRequirement : IAuthorizationRequirement
{
    /// <summary>
    /// Initializes a new <see cref="PermissionRequirement"/> for a single required permission.
    /// </summary>
    /// <param name="functionCode">The permission function code (e.g., "ROOMS").</param>
    /// <param name="requiredAction">The bitmask action required (e.g., <see cref="PermissionAction.Read"/>).</param>
    public PermissionRequirement(string functionCode, int requiredAction)
    {
        FunctionCode = functionCode;
        RequiredAction = requiredAction;
        AlternativePermissions = new[] { (functionCode, requiredAction) };
    }

    /// <summary>
    /// Initializes a new <see cref="PermissionRequirement"/> for multiple alternative permissions (OR logic).
    /// </summary>
    /// <param name="alternativePermissions">List of alternative (FunctionCode, RequiredAction) pairs.</param>
    public PermissionRequirement(IReadOnlyList<(string FunctionCode, int RequiredAction)> alternativePermissions)
    {
        if (alternativePermissions == null || alternativePermissions.Count == 0)
        {
            throw new ArgumentException("At least one permission must be specified.", nameof(alternativePermissions));
        }

        FunctionCode = alternativePermissions[0].FunctionCode;
        RequiredAction = alternativePermissions[0].RequiredAction;
        AlternativePermissions = alternativePermissions;
    }

    /// <summary>
    /// The primary or first permission function code.
    /// </summary>
    public string FunctionCode { get; }

    /// <summary>
    /// The primary or first required bitmask action.
    /// </summary>
    public int RequiredAction { get; }

    /// <summary>
    /// The full list of alternative permissions (match any).
    /// </summary>
    public IReadOnlyList<(string FunctionCode, int RequiredAction)> AlternativePermissions { get; }
}
